import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";
import { queryRows } from "../lib/runtime-env";

let database: ReturnType<typeof createDatabase> | undefined;

function projectedKeys(source: string) {
  const projection = source.match(/^\s*select\s+([\s\S]+?)\s+from\s/i)?.[1]
    ?? source.match(/\breturning\s+([\s\S]+)$/i)?.[1];
  if (!projection) return [];
  return projection.split(",").map(expression => {
    const names = [...expression.matchAll(/"([^"]+)"/g)].map(match => match[1]);
    return names.at(-1);
  }).filter((name): name is string => Boolean(name));
}

function createDatabase() {
  return drizzle(async (source, params, method) => {
    const rows = await queryRows(source, params);
    const keys = projectedKeys(source);
    const values = rows.map(row => keys.length ? keys.map(key => row[key]) : Object.values(row));
    if (method === "get") return { rows: values[0] };
    return { rows: values };
  }, { schema });
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
