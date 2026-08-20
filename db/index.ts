import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { queryRows } from "../lib/runtime-env";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  return drizzle(async (source, params, method) => {
    const rows = await queryRows(source, params);
    if (method === "values") return { rows: rows.map(row => Object.values(row)) };
    return { rows: Array.from(rows) };
  }, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
