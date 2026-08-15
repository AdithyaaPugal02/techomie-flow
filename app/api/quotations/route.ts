import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

type R = Record<string, any>;
type QuoteItem = { id?: string; productId?: number; variantId?: number; name: string; qty: number; price: number; discount?: number; gst?: number; installation?: number; note?: string; purchaseCost?: number; image?: string; [key: string]: any };
type Room = { id?: string; name: string; note?: string; items: QuoteItem[] };
type Floor = { id?: string; name: string; rooms: Room[] };
const stamp = () => new Date().toISOString();
const privateKeys = new Set(["purchaseCost", "purchase_cost", "buyingPrice", "supplierPrice", "supplier", "margin", "profit", "minimumPrice"]);
const redact = (v: any): any => Array.isArray(v) ? v.map(redact) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([k]) => !privateKeys.has(k)).map(([k, x]) => [k, redact(x)])) : v;
const audit = (userId: string, action: string, id: number) => env.DB.prepare("INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,?,?,?,?)").bind(userId, action, "quotation", String(id), stamp()).run();
const activity = (userId: string, id: number, type: string, content: string) => env.DB.prepare("INSERT INTO activities(entity_type,entity_id,type,content,created_by,created_at)VALUES('quotation',?,?,?,?,?)").bind(String(id), type, content, userId, stamp()).run();
const parse = (v: any, fallback: any = {}) => { try { return typeof v === "string" ? JSON.parse(v) : v ?? fallback; } catch { return fallback; } };
const statuses = ["Draft", "Ready for Review", "Sent", "Viewed", "Negotiation", "Accepted", "Rejected", "Expired", "Revised", "Converted to Project"];

export async function GET(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]), x = new URL(req.url), id = x.searchParams.get("id"), revision = x.searchParams.get("revision");
    if (id) {
      const quote = await env.DB.prepare("SELECT q.*,c.name customer_name,c.phone,c.billing_address,c.gstin,c.lead_source,s.name site_name,s.address site_address,s.city,s.state,s.contact_name,s.contact_phone,u.name sales_name,cu.name created_name FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id LEFT JOIN customer_sites s ON s.id=q.site_id LEFT JOIN users u ON u.id=q.sales_id LEFT JOIN users cu ON cu.id=q.created_by WHERE q.id=? AND (?!='sales' OR q.sales_id=? OR q.created_by=?)").bind(Number(id), u.role, u.id, u.id).first<R>();
      if (!quote) return Response.json({ error: "Quotation not found" }, { status: 404 });
      let snapshot = parse(quote.snapshot);
      if (revision !== null) {
        const rev = await env.DB.prepare("SELECT * FROM quotation_revisions WHERE quotation_id=? AND revision=?").bind(Number(id), Number(revision)).first<R>();
        if (!rev) return Response.json({ error: "Revision not found" }, { status: 404 });
        snapshot = parse(rev.snapshot); quote.revision = rev.revision; quote.pdf_key = rev.pdf_key; quote.historical = true;
      }
      const revisions = (await env.DB.prepare("SELECT id,revision,pdf_key,created_by,created_at FROM quotation_revisions WHERE quotation_id=? ORDER BY revision DESC").bind(Number(id)).all()).results;
      return Response.json({ quotation: { ...quote, snapshot: u.role === "admin" ? snapshot : redact(snapshot) }, revisions, statuses });
    }
    const where = ["q.archived=0"], args: any[] = [];
    if (u.role === "sales") { where.push("(q.sales_id=? OR q.created_by=?)"); args.push(u.id, u.id); }
    for (const [key, col] of [["status", "q.status"], ["customer", "q.customer_id"], ["employee", "q.sales_id"], ["type", "q.quote_type"], ["city", "s.city"]]) { const value = x.searchParams.get(key); if (value) { where.push(`${col}=?`); args.push(value); } }
    const q = x.searchParams.get("q"); if (q) { where.push("(q.number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR s.name LIKE ? OR q.title LIKE ? OR u.name LIKE ?)"); for (let i = 0; i < 6; i++) args.push(`%${q}%`); }
    const from = x.searchParams.get("from"), to = x.searchParams.get("to"), expiry = x.searchParams.get("expiry"), min = x.searchParams.get("min"), max = x.searchParams.get("max");
    if (from) { where.push("q.quote_date>=?"); args.push(from); } if (to) { where.push("q.quote_date<=?"); args.push(to); }
    if (expiry === "soon") where.push("q.valid_until BETWEEN date('now') AND date('now','+7 day')");
    if (expiry === "expired") where.push("q.valid_until<date('now')");
    if (min) { where.push("q.total>=?"); args.push(Number(min)); } if (max) { where.push("q.total<=?"); args.push(Number(max)); }
    const page = Math.max(1, Number(x.searchParams.get("page") || 1)), limit = [25, 50, 100].includes(Number(x.searchParams.get("limit"))) ? Number(x.searchParams.get("limit")) : 25;
    const base = `FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id LEFT JOIN customer_sites s ON s.id=q.site_id LEFT JOIN users u ON u.id=q.sales_id LEFT JOIN users cu ON cu.id=q.created_by WHERE ${where.join(" AND ")}`;
    const count = await env.DB.prepare(`SELECT COUNT(*) n ${base}`).bind(...args).first<{ n: number }>();
    const rows = (await env.DB.prepare(`SELECT q.*,c.name customer_name,c.phone,s.name site_name,s.city,u.name sales_name,cu.name created_name ${base} ORDER BY q.updated_at DESC,q.created_at DESC LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all<R>()).results;
    const customers = (await env.DB.prepare("SELECT id,name,phone FROM customers WHERE archived=0 ORDER BY name").all()).results;
    const sites = (await env.DB.prepare("SELECT id,customer_id,name,address,city,state,contact_name,contact_phone FROM customer_sites WHERE archived=0 ORDER BY name").all()).results;
    const users = (await env.DB.prepare("SELECT id,name,role FROM users WHERE active=1 AND role IN('admin','crm','sales') ORDER BY name").all()).results;
    return Response.json({ quotations: rows, pagination: { page, limit, total: count?.n || 0, pages: Math.ceil((count?.n || 0) / limit) }, filters: { customers, sites, users }, statuses });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to load quotations" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]), p = await req.json() as R, floors = ((p.floors?.length?p.floors:[{name:"Ground Floor",rooms:[{name:"Living Room",items:[]}]}])) as Floor[];
    if (!p.customerId || !p.siteId || !p.title || !p.quoteType) return Response.json({ error: "Customer, site, project title and quote type are required" }, { status: 400 });
    const site = await env.DB.prepare("SELECT * FROM customer_sites WHERE id=? AND customer_id=? AND archived=0").bind(p.siteId, p.customerId).first();
    if (!site) return Response.json({ error: "Select the correct customer site" }, { status: 409 });
    const items = floors.flatMap(f => f.rooms.flatMap(r => r.items));
    for (const item of items) {
      const v = item.variantId
        ? await env.DB.prepare("SELECT v.*,p.name product_name,p.brand,p.active product_active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1").bind(item.variantId).first<R>()
        : await env.DB.prepare("SELECT v.*,p.name product_name,p.brand,p.active product_active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.sku=? AND v.active=1 AND p.active=1").bind(item.sku).first<R>();
      if (!v) return Response.json({ error: `${item.name} is inactive or unavailable` }, { status: 409 });
      item.variantId = Number(v.id); item.productId = Number(v.product_id);
      const minimum = Number(v.minimum_price || 0), lineRate = Number(item.price || 0) * (1 - Number(item.discount || 0) / 100);
      if (u.role !== "admin" && minimum && lineRate < minimum) return Response.json({ error: `${item.name} exceeds the allowed discount` }, { status: 403 });
      item.purchaseCost = Number(v.purchase_cost || 0); item.image = item.image || v.image_key; item.sku = item.sku || v.sku;
    }
    const now = stamp(),settingRows=(await env.DB.prepare("SELECT key,value FROM settings WHERE key IN('numbering','paymentTerms','warranty','terms','tax','company','branding','banks')").all<R>()).results,configured=Object.fromEntries(settingRows.map(r=>[r.key,parse(r.value)])),prefix=String(configured.numbering?.quotePrefix||"QT"),start=Number(configured.numbering?.quoteStart||1145),next = await env.DB.prepare("SELECT COALESCE(MAX(CAST(substr(number,length(?)+2) AS INTEGER)),? - 1)+1 n FROM quotations WHERE number LIKE ?").bind(prefix,start,`${prefix}-%`).first<{ n: number }>(), number = `${prefix}-${next?.n || start}`;
    const validity=Number(configured.numbering?.quoteValidity||30),quoteDate = String(p.quoteDate || now.slice(0, 10)), validUntil = String(p.validUntil || new Date(Date.now() + validity * 86400000).toISOString().slice(0, 10));
    const defaultPlan=configured.paymentTerms?.templates?.find((x:R)=>x.id===configured.paymentTerms?.default)?.milestones,defaultWarranty=configured.warranty?.templates?.find((x:R)=>x.active),defaultTerms=configured.terms?.templates?.find((x:R)=>x.appliesTo===p.quoteType)||configured.terms?.templates?.find((x:R)=>x.id==="standard"),snapshot = { details: p.details || {}, floors, paymentPlan: p.paymentPlan || defaultPlan || [{ name: "Advance", percent: 20 }, { name: "Procurement", percent: 60 }, { name: "Handover", percent: 20 }], warranty: p.warranty || defaultWarranty?.wording || "Standard product warranty", terms: p.terms || defaultTerms?.content || "Prices are valid until the validity date. Site readiness is the customer's responsibility.", company:configured.company||{},branding:configured.branding||{},banks:configured.banks||{},customerNotes: p.customerNotes || "", internalNotes: p.internalNotes || "", quoteDiscount: Number(p.quoteDiscount || 0), pricingMode: p.pricingMode || configured.tax?.pricingMode || "exclusive", placeOfSupply: p.placeOfSupply || site.state || configured.tax?.placeOfSupply || "Tamil Nadu" };
    const inserted = await env.DB.prepare("INSERT INTO quotations(number,revision,customer_id,site_id,title,quote_type,category,quote_date,valid_until,status,snapshot,total,sales_id,created_by,created_at,updated_at)VALUES(?,0,?,?,?,?,?,?,?,'Draft',?,?,?,?,?,?) RETURNING id").bind(number, p.customerId, p.siteId, p.title, p.quoteType, p.category || null, quoteDate, validUntil, JSON.stringify(snapshot), Number(p.total || 0), p.salesId || u.id, u.id, now, now).first<{ id: number }>();
    if (!inserted) throw new Error("Quotation was not created");
    const statements: any[] = [];
    for (let fi = 0; fi < floors.length; fi++) { const f = floors[fi], floorId = f.id || crypto.randomUUID(); statements.push(env.DB.prepare("INSERT INTO quotation_floors(id,quotation_id,name,sort_order)VALUES(?,?,?,?)").bind(floorId, inserted.id, f.name, fi)); for (let ri = 0; ri < f.rooms.length; ri++) { const r = f.rooms[ri], roomId = r.id || crypto.randomUUID(); statements.push(env.DB.prepare("INSERT INTO quotation_rooms(id,floor_id,name,sort_order)VALUES(?,?,?,?)").bind(roomId, floorId, r.name, ri)); for (let ii = 0; ii < r.items.length; ii++) { const item = r.items[ii]; statements.push(env.DB.prepare("INSERT INTO quotation_items(id,quotation_id,room_id,product_id,variant_id,snapshot,quantity,unit_price,discount,tax_rate,tax_mode,installation,note,sort_order)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(item.id || crypto.randomUUID(), inserted.id, roomId, item.productId || null, item.variantId, JSON.stringify(item), item.qty, item.price, item.discount || 0, item.gst || 18, item.taxMode || "GST", item.installation || 0, item.note || null, ii)); } } }
    statements.push(env.DB.prepare("INSERT INTO quotation_revisions(id,quotation_id,revision,snapshot,created_by,created_at)VALUES(?,?,0,?,?,?)").bind(crypto.randomUUID(), inserted.id, JSON.stringify(snapshot), u.id, now));
    await env.DB.batch(statements); await audit(u.id, "quote_created", inserted.id); await activity(u.id, inserted.id, "Quotation Created", `${number} created as draft`);
    return Response.json({ quotation: { id: inserted.id, number, revision: 0, status: "Draft" } }, { status: 201 });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to create quotation" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]), p = await req.json() as R, id = Number(p.id), action = String(p.action || "update");
    const quote = await env.DB.prepare("SELECT * FROM quotations WHERE id=? AND archived=0").bind(id).first<R>(); if (!quote) return Response.json({ error: "Quotation not found" }, { status: 404 });
    if (u.role === "sales" && quote.sales_id !== u.id && quote.created_by !== u.id) return Response.json({ error: "Quotation unavailable" }, { status: 403 });
    if (action === "archive") { if (String(quote.status) !== "Draft") return Response.json({ error: "Only draft quotations can be archived" }, { status: 409 }); await env.DB.prepare("UPDATE quotations SET archived=1,updated_at=? WHERE id=?").bind(stamp(), id).run(); await audit(u.id, "quote_archived", id); return Response.json({ ok: true }); }
    if (action === "duplicate") { const now = stamp(), next = await env.DB.prepare("SELECT COALESCE(MAX(CAST(substr(number,4) AS INTEGER)),1144)+1 n FROM quotations WHERE number LIKE 'QT-%'").first<{ n: number }>(), number = `QT-${next?.n || 1145}`; const row = await env.DB.prepare("INSERT INTO quotations(number,revision,customer_id,site_id,title,quote_type,category,quote_date,valid_until,status,snapshot,total,sales_id,created_by,created_at,updated_at)VALUES(?,0,?,?,?,?,?,date('now'),date('now','+30 day'),'Draft',?,?,?,?,?,?) RETURNING id").bind(number, quote.customer_id, quote.site_id, `${quote.title} (Copy)`, quote.quote_type, quote.category, quote.snapshot, quote.total, quote.sales_id || u.id, u.id, now, now).first<{ id: number }>(); await env.DB.prepare("INSERT INTO quotation_revisions(id,quotation_id,revision,snapshot,created_by,created_at)VALUES(?,?,0,?,?,?)").bind(crypto.randomUUID(), row!.id, quote.snapshot, u.id, now).run(); await audit(u.id, "quote_duplicated", row!.id); return Response.json({ ok: true, id: row!.id, number }); }
    const transitions: Record<string, string> = { review: "Ready for Review", send: "Sent", viewed: "Viewed", negotiate: "Negotiation", accept: "Accepted", reject: "Rejected" };
    if (transitions[action]) { if (["accept", "reject", "review"].includes(action) && u.role !== "admin") return Response.json({ error: "Admin approval is required" }, { status: 403 }); const next = transitions[action], now = stamp(); await env.DB.prepare("UPDATE quotations SET status=?,sent_amount=CASE WHEN ?='Sent' THEN total ELSE sent_amount END,accepted_amount=CASE WHEN ?='Accepted' THEN total ELSE accepted_amount END,last_followup=CASE WHEN ? IN('Sent','Negotiation') THEN ? ELSE last_followup END,updated_at=? WHERE id=?").bind(next, next, next, next, now, now, id).run(); await audit(u.id, `quote_${action}`, id); await activity(u.id, id, `Quotation ${next}`, `${quote.number} marked ${next}`); return Response.json({ ok: true, status: next }); }
    if (action === "convert-project") return Response.json({ ok: true, useProjectsApi: true, quotationId: id });
    if (["Sent", "Viewed", "Negotiation", "Accepted", "Converted to Project"].includes(String(quote.status)) && action !== "revision") return Response.json({ error: "Create a revision to change a sent or accepted quotation" }, { status: 409 });
    const snapshot = p.snapshot || parse(quote.snapshot), revision = action === "revision" ? Number(quote.revision || 0) + 1 : Number(quote.revision || 0), status = action === "revision" ? "Revised" : String(p.status || quote.status), now = stamp();
    await env.DB.prepare("UPDATE quotations SET snapshot=?,total=?,status=?,revision=?,valid_until=COALESCE(?,valid_until),updated_at=? WHERE id=?").bind(JSON.stringify(snapshot), Number(p.total ?? quote.total), status, revision, p.validUntil || null, now, id).run();
    if (action === "revision") await env.DB.prepare("INSERT INTO quotation_revisions(id,quotation_id,revision,snapshot,created_by,created_at)VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(), id, revision, JSON.stringify(snapshot), u.id, now).run();
    await audit(u.id, action === "revision" ? "quote_revised" : "quote_updated", id); return Response.json({ ok: true, revision, status });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to update quotation" }, { status: 500 }); }
}
