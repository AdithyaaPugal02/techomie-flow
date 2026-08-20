import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { queryRows } from "../lib/runtime-env";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  return drizzle(async (source, params, method) => {
    const rows = await queryRows(source, params);
    const values = rows.map(row => Object.values(row));
    if (method === "get") return { rows: values[0] };
    return { rows: values };
  }, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
