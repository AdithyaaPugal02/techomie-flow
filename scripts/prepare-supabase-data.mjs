import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "supabase/local-d1-export.sql");
const target = path.join(root, "supabase/data-import.sql");
const excluded = new Set(["d1_migrations", "sqlite_sequence", "sqlite_stat1"]);
const sourceSql = fs.readFileSync(source, "utf8");
const columnOrder = new Map();
for (const block of sourceSql.split("CREATE TABLE ").slice(1)) {
  const open = block.indexOf("(");
  const close = block.indexOf(");", open);
  if (open < 0 || close < 0) continue;
  const table = block.slice(0, open).trim().replace(/^IF NOT EXISTS\s+/i, "").replaceAll(/[`"]+/g, "");
  const body = block.slice(open + 1, close).split(/\r?\n/).filter(line => !/^\s*FOREIGN KEY/i.test(line)).join("\n");
  const columns = [...body.matchAll(/[`"]([^`"]+)[`"]\s+(?:text|integer|real|blob|numeric)/gi)].map(column => column[1]);
  columnOrder.set(table, columns);
}

function extractInserts(sql) {
  const statements = [];
  let cursor = 0;
  while ((cursor = sql.indexOf('INSERT INTO "', cursor)) >= 0) {
    let quoted = false;
    let end = cursor;
    for (; end < sql.length; end++) {
      if (sql[end] === "'") {
        if (quoted && sql[end + 1] === "'") { end++; continue; }
        quoted = !quoted;
      }
      if (!quoted && sql[end] === ";") { end++; break; }
    }
    statements.push(sql.slice(cursor, end).replace(/\r?\n/g, " "));
    cursor = end;
  }
  return statements;
}

const inserts = extractInserts(sourceSql).filter(line => {
  const match = line.match(/^INSERT INTO "([^"]+)"/);
  return match && !excluded.has(match[1]);
}).map(line => {
  const table = line.match(/^INSERT INTO "([^"]+)"/)?.[1];
  const columns = table && columnOrder.get(table);
  if (!table || !columns?.length) throw new Error(`Could not determine column order for ${table ?? "an insert"}`);
  return line
    .replace(`INSERT INTO "${table}" VALUES`, `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(",")}) VALUES`)
    .replace(/\bchar\(/gi, "chr(");
});

const sequenceTables = ["activities", "audit_log", "customers", "products", "quotations", "sites", "variants"];
const sequences = sequenceTables.map(table =>
  `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"));`
);

const sql = [
  "BEGIN;",
  "SET LOCAL session_replication_role = replica;",
  ...inserts,
  ...sequences,
  "COMMIT;",
  "",
].join("\n");

fs.writeFileSync(target, sql);
console.log(`Prepared ${inserts.length} data rows in ${target}`);
