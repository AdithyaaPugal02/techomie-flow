import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

type Args = unknown[];
type Row = Record<string, unknown>;

const connection = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
const sql = connection ? postgres(connection, { prepare: false, max: 8, idle_timeout: 20 }) : null;

function translate(source: string) {
  let index = 0;
  let query = source.replace(/\?/g, () => `$${++index}`);
  query = query
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/date\('now'\s*,\s*'\+([0-9]+) day'\)/gi, "(CURRENT_DATE + INTERVAL '$1 day')")
    .replace(/date\('now'\s*,\s*'-([0-9]+) day'\)/gi, "(CURRENT_DATE - INTERVAL '$1 day')")
    .replace(/date\('now'\)/gi, "CURRENT_DATE")
    .replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP")
    .replace(/json_extract\(([^,]+),\s*'\$\.([^']+)'\)/gi, "($1::jsonb #>> '{$2}')")
    .replace(/group_concat\(([^,)]+)\)/gi, "string_agg(($1)::text, ',')")
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(");
  if (/^\s*INSERT\s+/i.test(source) && /OR\s+IGNORE/i.test(source) && !/ON\s+CONFLICT/i.test(query)) {
    const returning = query.match(/\s+RETURNING\s+/i);
    query = returning
      ? `${query.slice(0, returning.index)} ON CONFLICT DO NOTHING${query.slice(returning.index!)}`
      : `${query} ON CONFLICT DO NOTHING`;
  }
  return query;
}

class Prepared {
  private args: Args = [];
  constructor(private source: string) {}
  bind(...args: Args) { this.args = args.map(value => typeof value === "boolean" ? (value ? 1 : 0) : value); return this; }
  async rows() {
    if (!sql) throw new Error("POSTGRES_URL is not configured");
    return sql.unsafe(translate(this.source), this.args as never[]) as unknown as Row[];
  }
  async first<T = Row>() { const rows = await this.rows(); return (rows[0] as T) ?? null; }
  async all<T = Row>() { const rows = await this.rows(); return { results: rows as T[], success: true, meta: { changes: rows.length } }; }
  async run() { const rows = await this.rows(); return { success: true, results: rows, meta: { changes: rows.length } }; }
  async raw<T = unknown[]>() { const rows = await this.rows(); return rows.map(row => Object.values(row)) as T[]; }
}

class Database {
  prepare(source: string) { return new Prepared(source); }
  async batch(statements: Prepared[]) { return Promise.all(statements.map(statement => statement.run())); }
  async exec(source: string) {
    if (!sql) throw new Error("POSTGRES_URL is not configured");
    await sql.unsafe(translate(source));
    return { count: 1, duration: 0 };
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "techomie-files";
const storage = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }).storage.from(bucket) : null;

class Files {
  async put(key: string, body: ReadableStream | Blob | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    if (!storage) throw new Error("Supabase Storage is not configured");
    const payload = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
    const { error } = await storage.upload(key, payload, { contentType: options?.httpMetadata?.contentType, upsert: true });
    if (error) throw error;
    return { key };
  }
  async get(key: string) {
    if (!storage) throw new Error("Supabase Storage is not configured");
    const { data, error } = await storage.download(key);
    if (error || !data) return null;
    return { body: data.stream(), httpMetadata: { contentType: data.type }, size: data.size };
  }
  async delete(key: string) {
    if (!storage) throw new Error("Supabase Storage is not configured");
    const { error } = await storage.remove([key]);
    if (error) throw error;
  }
}

export const env = { DB: new Database(), FILES: new Files() };
