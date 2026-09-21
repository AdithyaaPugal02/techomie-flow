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
  bind(...args: Args) {
    this.args = args.map(value => typeof value === "boolean" ? (value ? 1 : 0) : value);
    return this;
  }
  async rows() {
    return queryRows(this.source, this.args);
  }
  async first<T = Row>() {
    const rows = await this.rows();
    return (rows[0] as T) ?? null;
  }
  async all<T = Row>() {
    const rows = await this.rows();
    return { results: rows as T[], success: true, meta: { changes: rows.length } };
  }
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
  async raw<T = unknown[]>() {
    const rows = await this.rows();
    return rows.map(row => Object.values(row)) as T[];
  }
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
const localUploadsDir = path.resolve(process.cwd(), "public/uploads");

class Files {
  async put(key: string, body: ReadableStream | Blob | ArrayBuffer | Buffer, options?: { httpMetadata?: { contentType?: string } }) {
    if (storage) {
      try {
        const payload = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
        const { error } = await storage.upload(key, payload as ArrayBuffer, { contentType: options?.httpMetadata?.contentType, upsert: true });
        if (!error) return { key };
      } catch {}
    }
    const targetPath = path.join(localUploadsDir, key);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    let buffer: Buffer;
    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (body instanceof ArrayBuffer) {
      buffer = Buffer.from(body);
    } else if (body instanceof Blob) {
      buffer = Buffer.from(await body.arrayBuffer());
    } else if (body instanceof ReadableStream) {
      const arrayBuffer = await new Response(body).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = Buffer.from(String(body));
    }
    fs.writeFileSync(targetPath, buffer);
    if (options?.httpMetadata?.contentType) {
      fs.writeFileSync(`${targetPath}.meta.json`, JSON.stringify(options.httpMetadata));
    }

    // Also mirror to .local-storage for backwards compatibility
    try {
      const legacyTarget = path.join(localStorageDir, key);
      fs.mkdirSync(path.dirname(legacyTarget), { recursive: true });
      fs.writeFileSync(legacyTarget, buffer);
    } catch {}

    return { key };
  }

  async get(key: string) {
    if (storage) {
      try {
        const { data, error } = await storage.download(key);
        if (!error && data) {
          return {
            body: data.stream(),
            httpMetadata: { contentType: data.type },
            httpEtag: `"${data.size}"`,
            writeHttpMetadata: (headers: Headers) => {
              if (data.type) headers.set("content-type", data.type);
            },
            size: data.size,
          };
        }
      } catch {}
    }

    let targetPath = path.join(localUploadsDir, key);
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(localStorageDir, key);
    }
    if (!fs.existsSync(targetPath)) return null;

    const stat = fs.statSync(targetPath);
    let contentType = "application/octet-stream";
    const metaPath = fs.existsSync(`${targetPath}.meta.json`) ? `${targetPath}.meta.json` : `${targetPath}.meta`;
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        if (meta.contentType) contentType = meta.contentType;
      } catch {}
    } else {
      const ext = path.extname(key).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".mp4": "video/mp4",
        ".json": "application/json",
      };
      if (mimeTypes[ext]) contentType = mimeTypes[ext];
    }
    const fileBuffer = fs.readFileSync(targetPath);
    return {
      body: fileBuffer,
      httpMetadata: { contentType },
      httpEtag: `"${stat.mtimeMs}-${stat.size}"`,
      writeHttpMetadata: (headers: Headers) => {
        headers.set("content-type", contentType);
      },
      size: stat.size,
    };
  }

  async delete(key: string) {
    if (storage) {
      try { await storage.remove([key]); } catch {}
    }
    const targetPath = path.join(localUploadsDir, key);
    if (fs.existsSync(targetPath)) {
      try { fs.unlinkSync(targetPath); } catch {}
    }
    const metaPath = `${targetPath}.meta.json`;
    if (fs.existsSync(metaPath)) {
      try { fs.unlinkSync(metaPath); } catch {}
    }
    const legacyTarget = path.join(localStorageDir, key);
    if (fs.existsSync(legacyTarget)) {
      try { fs.unlinkSync(legacyTarget); } catch {}
    }
    if (fs.existsSync(`${legacyTarget}.meta`)) {
      try { fs.unlinkSync(`${legacyTarget}.meta`); } catch {}
    }
  }
}

export const env = { DB: new Database(), FILES: new Files() };
