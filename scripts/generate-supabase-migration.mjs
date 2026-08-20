import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "drizzle/meta/0010_snapshot.json"), "utf8"));
const quote = value => `"${String(value).replaceAll('"', '""')}"`;
const statements = [
  "-- Generated from the final Drizzle SQLite snapshot for Supabase PostgreSQL.",
  "create extension if not exists pgcrypto;",
];

function defaultSql(value) {
  if (value === undefined) return "";
  if (value === true || value === "true") return " DEFAULT 1";
  if (value === false || value === "false") return " DEFAULT 0";
  return ` DEFAULT ${value}`;
}

for (const table of Object.values(snapshot.tables)) {
  const columns = Object.values(table.columns).map(column => {
    let type = column.type === "real" ? "double precision" : column.type;
    if (column.autoincrement && type === "integer") type = "serial";
    return `  ${quote(column.name)} ${type}${defaultSql(column.default)}${column.notNull ? " NOT NULL" : ""}${column.primaryKey ? " PRIMARY KEY" : ""}`;
  });
  statements.push(`CREATE TABLE IF NOT EXISTS ${quote(table.name)} (\n${columns.join(",\n")}\n);`);
}

for (const table of Object.values(snapshot.tables)) {
  for (const constraint of Object.values(table.uniqueConstraints ?? {})) {
    statements.push(`ALTER TABLE ${quote(table.name)} ADD CONSTRAINT ${quote(constraint.name)} UNIQUE (${constraint.columns.map(quote).join(", ")});`);
  }
  for (const foreignKey of Object.values(table.foreignKeys ?? {})) {
    statements.push(`ALTER TABLE ${quote(table.name)} ADD CONSTRAINT ${quote(foreignKey.name)} FOREIGN KEY (${foreignKey.columnsFrom.map(quote).join(", ")}) REFERENCES ${quote(foreignKey.tableTo)} (${foreignKey.columnsTo.map(quote).join(", ")});`);
  }
  for (const index of Object.values(table.indexes ?? {})) {
    const columns = index.columns.map(column => quote(typeof column === "string" ? column : column.expression));
    statements.push(`CREATE ${index.isUnique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(index.name)} ON ${quote(table.name)} (${columns.join(", ")});`);
  }
}

statements.push("INSERT INTO storage.buckets (id, name, public) VALUES ('techomie-files', 'techomie-files', false) ON CONFLICT (id) DO NOTHING;");
const target = path.join(root, "supabase/migrations/20260820000000_initial_techomie_schema.sql");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${statements.join("\n\n")}\n`);
console.log(`Generated ${target}`);
