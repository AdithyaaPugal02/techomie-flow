import postgres from "postgres";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function translate(source: string) {
  let index = 0;
  return source
    .replace(/\?/g, () => `$${++index}`)
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(");
}

function createDatabase() {
  const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error("POSTGRES_URL is not configured");
  const client = postgres(connection, { prepare: false, max: 8, idle_timeout: 20 });

  return drizzle(async (source, params, method) => {
    const rows = await client.unsafe(translate(source), params);
    if (method === "values") return { rows: rows.map(row => Object.values(row)) };
    return { rows: Array.from(rows) };
  }, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
