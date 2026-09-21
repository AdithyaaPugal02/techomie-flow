import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export function initLocalDb(dbPath: string) {
  const isNew = !fs.existsSync(dbPath);
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode for concurrency and foreign keys
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
  if (!tables.includes("users")) {
    console.log("[local-db] Initializing database schema from 0011 snapshot...");
    const root = process.cwd();
    const snapshot = JSON.parse(fs.readFileSync(path.join(root, "drizzle/meta/0011_snapshot.json"), "utf8"));
    const quote = (val: any) => `"${String(val).replaceAll('"', '""')}"`;

    function defaultSql(val: any) {
      if (val === undefined) return "";
      if (val === true || val === "true") return " DEFAULT 1";
      if (val === false || val === "false") return " DEFAULT 0";
      if (typeof val === "number") return ` DEFAULT ${val}`;
      if (typeof val === "string") return ` DEFAULT '${val.replaceAll("'", "''")}'`;
      return ` DEFAULT ${val}`;
    }

    db.exec("BEGIN TRANSACTION;");
    try {
      for (const table of Object.values(snapshot.tables as Record<string, any>)) {
        const colDefs = [];
        for (const col of Object.values(table.columns as Record<string, any>)) {
          let def = `${quote(col.name)} ${col.type.toUpperCase()}`;
          if (col.primaryKey) {
            def += " PRIMARY KEY";
            if (col.autoincrement) def += " AUTOINCREMENT";
          }
          if (col.notNull) def += " NOT NULL";
          def += defaultSql(col.default);
          colDefs.push(def);
        }
        db.exec(`CREATE TABLE IF NOT EXISTS ${quote(table.name)} (\n  ${colDefs.join(",\n  ")}\n);`);
      }

      for (const table of Object.values(snapshot.tables as Record<string, any>)) {
        for (const idx of Object.values((table.indexes ?? {}) as Record<string, any>)) {
          const cols = idx.columns.map(quote).join(", ");
          db.exec(`CREATE ${idx.isUnique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(idx.name)} ON ${quote(table.name)} (${cols});`);
        }
      }
      db.exec("COMMIT;");
      console.log("[local-db] Schema created successfully.");
    } catch (err) {
      db.exec("ROLLBACK;");
      console.error("[local-db] Error creating schema:", err);
      throw err;
    }
  }

  // Check if products need seeding
  const productCount = db.prepare("SELECT COUNT(*) as count FROM products").all()[0]?.count || 0;
  const catalogPath = path.join(process.cwd(), "tmp/import/full-catalog.json");
  if (productCount === 0 && fs.existsSync(catalogPath)) {
    console.log("[local-db] Seeding products and variants from full-catalog.json...");
    try {
      const items = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
      const now = new Date().toISOString();

      db.exec("BEGIN TRANSACTION;");
      const insertProduct = db.prepare(`
        INSERT INTO products (name, category, subcategory, series, brand, description, hsn, tax_rate, warranty, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Noviq', ?, ?, ?, ?, 1, ?, ?)
      `);
      const insertVariant = db.prepare(`
        INSERT INTO variants (product_id, sku, name, attributes, selling_price, purchase_cost, tax_rate, hsn, warranty, image_key, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      const productMap = new Map();
      let pCount = 0;
      let vCount = 0;

      for (const item of items) {
        const prodKey = `${item.category}:::${item.series}:::${item.name}`;
        let prodId = productMap.get(prodKey);
        if (!prodId) {
          const res = insertProduct.run(
            item.name,
            item.category || "Smart Home",
            item.subcategory || null,
            item.series || null,
            item.description || item.name,
            item.hsn || null,
            Number(item.gst || 18),
            item.warranty || null,
            now,
            now
          );
          prodId = Number(res.lastInsertRowid);
          productMap.set(prodKey, prodId);
          pCount++;
        }

        const attrs = JSON.stringify({
          module: item.module,
          technology: item.technology,
          material: item.material,
          finish: item.finish,
        });

        try {
          insertVariant.run(
            prodId,
            item.sku || `SKU-${vCount + 1}`,
            item.name,
            attrs,
            Number(item.sellingPrice || 0),
            Number(item.purchaseCost || 0),
            Number(item.gst || 18),
            item.hsn || null,
            item.warranty || null,
            item.image || null
          );
          vCount++;
        } catch {
          // ignore duplicate SKU if any
        }
      }

      db.exec("COMMIT;");
      console.log(`[local-db] Seeded ${pCount} products and ${vCount} variants.`);
    } catch (err: any) {
      try { db.exec("ROLLBACK;"); } catch {}
      console.warn("[local-db] Seeding error (non-fatal):", err?.message);
    }
  }

  return db;
}
