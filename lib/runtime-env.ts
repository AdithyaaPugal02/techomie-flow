import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { initLocalDb } from "./local-db";

type Args = unknown[];
type Row = Record<string, unknown>;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

let localDbInstance: ReturnType<typeof initLocalDb> | null = null;
function getLocalDb() {
  if (!localDbInstance) {
    const dbPath = process.env.LOCAL_DB_PATH || path.join(process.cwd(), ".local-db.sqlite");
    localDbInstance = initLocalDb(dbPath);
  }
  return localDbInstance;
}

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
    .replace(/\bIFNULL\s*\(/gi, "COALESCE(")
    .replace(
      /(insert\s+into\s+"(?:activities|audit_log|customers|products|quotations|sites|variants)"\s*\(\s*"id"[^)]*\)\s*values\s*)\(\s*null\s*,/i,
      "$1(DEFAULT,",
    );
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
    return queryRows(this.source, this.args);
  }
  async first<T = Row>() { const rows = await this.rows(); return (rows[0] as T) ?? null; }
  async all<T = Row>() { const rows = await this.rows(); return { results: rows as T[], success: true, meta: { changes: rows.length } }; }
  async run() {
    if (!supabase) {
      const db = getLocalDb();
      const queryParams = this.args.map(value => typeof value === "boolean" ? (value ? 1 : 0) : value);
      if (/\breturning\b/i.test(this.source)) {
        const rows = db.prepare(this.source).all(...queryParams) as Row[];
        return { success: true, results: rows, meta: { changes: rows.length } };
      }
      const res = db.prepare(this.source).run(...queryParams);
      return { success: true, results: [], meta: { changes: Number(res.changes) } };
    }
    const rows = await this.rows();
    return { success: true, results: rows, meta: { changes: rows.length } };
  }
  async raw<T = unknown[]>() { const rows = await this.rows(); return rows.map(row => Object.values(row)) as T[]; }
}

class Database {
  prepare(source: string) { return new Prepared(source); }
  async batch(statements: Prepared[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
  async exec(source: string) {
    if (supabase) {
      await queryRows(source, []);
    } else {
      getLocalDb().exec(source);
    }
    return { count: 1, duration: 0 };
  }
}

export async function queryRows(source: string, args: Args = []) {
  const queryParams = args.map(value => typeof value === "boolean" ? (value ? 1 : 0) : value);
  if (supabase) {
    const { data, error } = await supabase.rpc("techomie_exec", { query_text: translate(source), query_params: queryParams });
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data : []) as Row[];
  }
  const db = getLocalDb();
  if (/^\s*(select|with|pragma)\b/i.test(source) || /\breturning\b/i.test(source)) {
    return db.prepare(source).all(...queryParams) as Row[];
  }
  db.prepare(source).run(...queryParams);
  return [] as Row[];
}

const bucket = process.env.SUPABASE_STORAGE_BUCKET || "techomie-files";
const storage = supabase?.storage.from(bucket) ?? null;
const localStorageDir = path.join(process.cwd(), ".local-storage");

class Files {
  async put(key: string, body: ReadableStream | Blob | ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
    if (storage) {
      const payload = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
      const { error } = await storage.upload(key, payload, { contentType: options?.httpMetadata?.contentType, upsert: true });
      if (error) throw error;
      return { key };
    }
    const target = path.join(localStorageDir, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const buffer = Buffer.from(
      body instanceof ReadableStream ? await new Response(body).arrayBuffer() :
      body instanceof Blob ? await body.arrayBuffer() : (body as ArrayBuffer)
    );
    fs.writeFileSync(target, buffer);
    if (options?.httpMetadata?.contentType) {
      fs.writeFileSync(`${target}.meta`, JSON.stringify(options.httpMetadata));
    }
    return { key };
  }
  async get(key: string) {
    if (storage) {
      const { data, error } = await storage.download(key);
      if (error || !data) return null;
      return { body: data.stream(), httpMetadata: { contentType: data.type }, size: data.size };
    }
    const target = path.join(localStorageDir, key);
    if (!fs.existsSync(target)) return null;
    const stat = fs.statSync(target);
    let contentType = "application/octet-stream";
    const metaPath = `${target}.meta`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        contentType = meta.contentType || contentType;
      } catch {}
    } else {
      const ext = path.extname(key).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
      };
      contentType = mimeMap[ext] || contentType;
    }
    const buffer = fs.readFileSync(target);
    return { body: buffer, httpMetadata: { contentType }, size: stat.size };
  }
  async delete(key: string) {
    if (storage) {
      const { error } = await storage.remove([key]);
      if (error) throw error;
      return;
    }
    const target = path.join(localStorageDir, key);
    if (fs.existsSync(target)) fs.unlinkSync(target);
    if (fs.existsSync(`${target}.meta`)) fs.unlinkSync(`${target}.meta`);
  }
}

export const env = { DB: new Database(), FILES: new Files() };
