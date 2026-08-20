import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "supabase/local-d1-export.sql");
const target = path.join(root, "supabase/data-import.sql");
const excluded = new Set(["d1_migrations", "sqlite_sequence", "sqlite_stat1"]);
const inserts = fs.readFileSync(source, "utf8").split(/\r?\n/).filter(line => {
  const match = line.match(/^INSERT INTO "([^"]+)"/);
  return match && !excluded.has(match[1]);
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
