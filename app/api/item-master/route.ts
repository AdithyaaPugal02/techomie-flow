import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";
/* eslint-disable @typescript-eslint/no-explicit-any */

type R = Record<string, any>;
const chunks = <T,>(rows: T[], size = 75) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
const stamp = () => new Date().toISOString();
const categoryId = (name: string) => `CAT-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

async function batch(rows: R[], statement: (row: R) => D1PreparedStatement) {
  for (const group of chunks(rows)) await env.DB.batch(group.map(statement));
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(), admin = user.role === "admin", url = new URL(req.url), id = url.searchParams.get("id"), view = url.searchParams.get("view");
    if (view === "imports") {
      if (!admin) return Response.json({ error: "Admin access required" }, { status: 403 });
      const jobs = (await env.DB.prepare("SELECT * FROM item_import_jobs ORDER BY started_at DESC LIMIT 25").all()).results;
      const errors = (await env.DB.prepare("SELECT * FROM item_import_errors WHERE resolved=0 ORDER BY CASE severity WHEN 'error' THEN 0 ELSE 1 END,source_sheet,source_page,source_row LIMIT 250").all()).results;
      return Response.json({ jobs, errors });
    }
    if (view === "quotation") {
      const q = `%${(url.searchParams.get("q") || "").trim().toLowerCase()}%`;
      const items = (await env.DB.prepare("SELECT b.id product_id,v.id variant_id,b.customer_name name,COALESCE(v.customer_name,b.customer_name) variant_name,v.internal_item_id sku,b.series,c.name category,s.name subcategory,br.name brand,b.description short_description,b.description,v.selling_price,v.technology,v.material,v.finish,b.unit,COALESCE(t.gst_rate,18) tax_rate,t.hsn_sac hsn,w.customer_text warranty,MAX(CASE WHEN m.customer_approved=1 THEN m.file_key END) image_key,json_object('technology',v.technology,'material',v.material,'finish',v.finish,'module',pc.module_size,'layoutCode',pc.layout_code) attributes FROM base_products b JOIN sellable_variants v ON v.base_product_id=b.id LEFT JOIN product_configurations pc ON pc.id=v.configuration_id LEFT JOIN item_categories c ON c.id=b.category_id LEFT JOIN item_subcategories s ON s.id=b.subcategory_id LEFT JOIN item_brands br ON br.id=b.customer_brand_id LEFT JOIN item_tax_codes t ON t.id=COALESCE(v.tax_code_id,b.tax_code_id) LEFT JOIN warranty_templates w ON w.id=COALESCE(v.warranty_template_id,b.warranty_template_id) LEFT JOIN product_media m ON m.base_product_id=b.id OR m.variant_id=v.id WHERE b.active=1 AND b.review_status='Approved' AND v.active=1 AND v.review_status='Approved' AND (LOWER(b.customer_name) LIKE ? OR LOWER(v.internal_item_id) LIKE ? OR LOWER(COALESCE(v.technology,'')) LIKE ?) GROUP BY v.id ORDER BY b.customer_name,v.technology,v.material LIMIT 100").bind(q, q, q).all()).results;
      return Response.json({ items });
    }
    if (id) {
      const visibility = admin ? "" : "AND b.active=1 AND b.review_status='Approved'";
      const item = await env.DB.prepare(`SELECT b.*,c.name category_name,s.name subcategory_name,br.name customer_brand,w.customer_text warranty,t.hsn_sac,t.gst_rate FROM base_products b LEFT JOIN item_categories c ON c.id=b.category_id LEFT JOIN item_subcategories s ON s.id=b.subcategory_id LEFT JOIN item_brands br ON br.id=b.customer_brand_id LEFT JOIN warranty_templates w ON w.id=b.warranty_template_id LEFT JOIN item_tax_codes t ON t.id=b.tax_code_id WHERE b.id=? ${visibility}`).bind(id).first<R>();
      if (!item) return Response.json({ error: "Item not found" }, { status: 404 });
      const variants = (await env.DB.prepare(`SELECT id,base_product_id,configuration_id,internal_item_id,customer_name,technology,material,finish,panel_colour,frame_colour,availability,selling_price,review_status,active FROM sellable_variants WHERE base_product_id=? ${admin ? "" : "AND active=1 AND review_status='Approved'"} ORDER BY technology,material,finish`).bind(id).all()).results;
      const configurations = (await env.DB.prepare("SELECT * FROM product_configurations WHERE base_product_id=? ORDER BY configuration_code").bind(id).all()).results;
      const media = (await env.DB.prepare(`SELECT id,kind,file_key,source,review_status,review_issue,customer_approved,sort_order FROM product_media WHERE base_product_id=? ${admin ? "" : "AND customer_approved=1"} ORDER BY sort_order`).bind(id).all()).results;
      if (!admin) return Response.json({ item, variants, configurations, media });
      const supplierItems = (await env.DB.prepare("SELECT si.*,s.name supplier_name,pb.name price_book_name,pb.effective_date,pb.default_tier FROM supplier_items si JOIN item_suppliers s ON s.id=si.supplier_id JOIN supplier_price_books pb ON pb.id=si.price_book_id WHERE si.variant_id IN (SELECT id FROM sellable_variants WHERE base_product_id=?) ORDER BY si.supplier_product_name").bind(id).all()).results;
      const modifiers = (await env.DB.prepare("SELECT * FROM item_price_modifiers WHERE base_product_id=? ORDER BY name").bind(id).all()).results;
      const mappings = (await env.DB.prepare("SELECT m.*,br.name brand_name,s.name supplier_name FROM customer_brand_mappings m LEFT JOIN item_brands br ON br.id=m.brand_id LEFT JOIN item_suppliers s ON s.id=m.supplier_id WHERE m.base_product_id=?").bind(id).all()).results;
      const audit = (await env.DB.prepare("SELECT h.*,u.name user_name FROM item_audit_history h LEFT JOIN users u ON u.id=h.created_by WHERE h.base_product_id=? ORDER BY h.created_at DESC LIMIT 100").bind(id).all()).results;
      return Response.json({ item, variants, configurations, media, supplierItems, modifiers, mappings, audit });
    }
    const page = Math.max(1, Number(url.searchParams.get("page") || 1)), limit = 25, q = `%${(url.searchParams.get("q") || "").trim().toLowerCase()}%`, status = url.searchParams.get("status") || "";
    const where = [admin ? "1=1" : "b.active=1 AND b.review_status='Approved'"], args: unknown[] = [];
    if (q !== "%%") { where.push("(LOWER(b.customer_name) LIKE ? OR LOWER(b.procurement_name) LIKE ? OR LOWER(b.internal_code) LIKE ?)"); args.push(q, q, q); }
    if (status) { where.push("b.review_status=?"); args.push(status); }
    const clause = where.join(" AND "), count = await env.DB.prepare(`SELECT COUNT(*) total FROM base_products b WHERE ${clause}`).bind(...args).first<{ total: number }>();
    const adminColumns = admin ? ",sp.supplier_name,sp.supplier_model,sp.net_buying_price" : "";
    const supplierJoin = admin ? "LEFT JOIN (SELECT si.variant_id,MIN(s.name) supplier_name,MIN(si.supplier_model) supplier_model,MIN(si.net_buying_price) net_buying_price FROM supplier_items si JOIN item_suppliers s ON s.id=si.supplier_id GROUP BY si.variant_id) sp ON sp.variant_id=v.id" : "";
    const items = (await env.DB.prepare(`SELECT b.id,b.internal_code,b.customer_name,b.procurement_name,b.series,b.unit,b.availability,b.review_status,b.active,b.updated_at,c.name category,br.name brand,COUNT(DISTINCT v.id) variant_count,MIN(v.selling_price) min_selling_price,MAX(v.selling_price) max_selling_price,MAX(CASE WHEN m.customer_approved=1 THEN m.file_key END) image_key,CASE WHEN MAX(CASE WHEN m.customer_approved=1 THEN 1 ELSE 0 END)=1 THEN 'Approved' WHEN COUNT(m.id)>0 THEN 'Needs Review' ELSE 'Missing' END image_status${adminColumns} FROM base_products b LEFT JOIN item_categories c ON c.id=b.category_id LEFT JOIN item_brands br ON br.id=b.customer_brand_id LEFT JOIN sellable_variants v ON v.base_product_id=b.id LEFT JOIN product_media m ON m.base_product_id=b.id ${supplierJoin} WHERE ${clause} GROUP BY b.id ORDER BY b.updated_at DESC,b.customer_name LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all()).results;
    return Response.json({ items, pagination: { page, limit, total: count?.total || 0, pages: Math.ceil((count?.total || 0) / limit) } });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: error instanceof Error ? error.message : "Unable to load Item Master" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin"]), payload = await req.json() as R;
    if (payload.action !== "stage" || !payload.package) return Response.json({ error: "A normalized review package is required" }, { status: 400 });
    const data = payload.package as R, jobId = crypto.randomUUID(), now = stamp();
    await env.DB.prepare("INSERT INTO item_import_jobs(id,source_file,source_hash,status,summary,started_at,created_by)VALUES(?,?,?,?,?,?,?)").bind(jobId, data.priceBooks?.map((x: R) => x.sourceFile).join("; ") || "Normalized Item Master package", null, "Imported", JSON.stringify(data.summary || {}), now, user.id).run();
    for (const supplier of data.suppliers || []) await env.DB.prepare("INSERT INTO item_suppliers(id,name,code,active,created_at,updated_at)VALUES(?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at").bind(supplier.id, supplier.name, supplier.code, now, now).run();
    await env.DB.prepare("INSERT INTO item_brands(id,name,brand_type,active,created_at,updated_at)VALUES('BRAND-OEM','Unbranded/OEM','Customer-facing',1,?,?) ON CONFLICT(id) DO NOTHING").bind(now, now).run();
    const categoryNames = [...new Set((data.baseProducts || []).map((x: R) => String(x.category || "Other")))] as string[];
    for (const name of categoryNames) await env.DB.prepare("INSERT INTO item_categories(id,name,code,active,sort_order,created_at,updated_at)VALUES(?,?,?,1,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at").bind(categoryId(name), name, categoryId(name).slice(4).toUpperCase(), now, now).run();
    for (const book of data.priceBooks || []) await env.DB.prepare("INSERT INTO supplier_price_books(id,supplier_id,name,version,effective_date,gst_status,default_tier,source_file,status,imported_at,created_by)VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,imported_at=excluded.imported_at").bind(book.id, book.supplierId, book.name, book.version, book.effectiveDate, book.gstStatus, book.defaultTier, book.sourceFile, "Imported", now, user.id).run();
    await batch(data.baseProducts || [], (x) => env.DB.prepare("INSERT INTO base_products(id,internal_code,procurement_name,customer_name,category_id,customer_brand_id,series,description,unit,pricing_method,availability,review_status,active,created_at,updated_at)VALUES(?,?,?,?,?,'BRAND-OEM',?,?,?, ?,?,'Needs Review',0,?,?) ON CONFLICT(id) DO UPDATE SET procurement_name=excluded.procurement_name,series=excluded.series,updated_at=excluded.updated_at").bind(x.id, x.internalCode, x.procurementName, x.customerName, categoryId(x.category || "Other"), x.series || null, x.description || null, x.unit || "Nos", x.pricingMethod, x.availability || "Available", now, now));
    await batch(data.configurations || [], (x) => env.DB.prepare("INSERT INTO product_configurations(id,base_product_id,configuration_code,module_size,light_switches,switches_6a,switches_16a,fan_controls,curtains,sockets,usb_socket,scenes,dimmer_type,doorbell_control,knob_control,load_rating,layout_code,fixed_technology,specifications,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET specifications=excluded.specifications,updated_at=excluded.updated_at").bind(x.id, x.baseProductId, x.configurationCode, x.moduleSize, x.lightSwitches, x.switches6a, x.switches16a, x.fanControls, x.curtains, x.sockets, x.usbSocket ? 1 : 0, x.scenes, x.dimmerType, x.doorbellControl ? 1 : 0, x.knobControl ? 1 : 0, x.loadRating, x.layoutCode, x.fixedTechnology, JSON.stringify(x.specifications || {}), now, now));
    await batch(data.variants || [], (x) => env.DB.prepare("INSERT INTO sellable_variants(id,base_product_id,configuration_id,internal_item_id,customer_name,technology,material,finish,availability,selling_price,selling_method,review_status,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,'Needs Review',0,?,?) ON CONFLICT(id) DO UPDATE SET technology=excluded.technology,material=excluded.material,updated_at=excluded.updated_at").bind(x.id, x.baseProductId, x.configurationId, x.internalItemId, x.customerName, x.technology, x.material, x.finish, x.availability || "Available", x.sellingPrice, x.sellingMethod, now, now));
    const supplierIds: R = { "Varni Digital": "SUP-VARNI", "Phlipton": "SUP-PHLIPTON" };
    await batch(data.supplierItems || [], (x) => env.DB.prepare("INSERT INTO supplier_items(id,supplier_id,price_book_id,variant_id,supplier_product_name,supplier_model,source_list_price,discount_percent,net_buying_price,currency,gst_status,source_sheet,source_page,source_row,source_data,review_status,imported_at)VALUES(?,?,?,?,?,?,?,?,?,'INR',?,?,?,?,?,'Imported',?) ON CONFLICT(id) DO UPDATE SET source_list_price=excluded.source_list_price,discount_percent=excluded.discount_percent,net_buying_price=excluded.net_buying_price,imported_at=excluded.imported_at").bind(x.id, supplierIds[x.supplier], x.priceBookId, x.variantId, x.supplierProductName, x.supplierModel, x.sourceListPrice, x.discountPercent, x.netBuyingPrice, x.gstStatus, x.sourceSheet, x.sourcePage, x.sourceRow, JSON.stringify({ source: x.source, image: x.image }), now));
    await batch(data.quantityTiers || [], (x) => env.DB.prepare("INSERT INTO quantity_price_tiers(id,supplier_item_id,name,min_quantity,max_quantity,unit_price,is_default,created_at)VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET unit_price=excluded.unit_price").bind(x.id, x.supplierItemId, x.name, x.minQuantity, x.maxQuantity, x.unitPrice, x.isDefault ? 1 : 0, now));
    await batch(data.modifiers || [], (x) => env.DB.prepare("INSERT INTO item_price_modifiers(id,base_product_id,variant_id,name,modifier_type,amount,conditions,customer_visible,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET amount=excluded.amount,conditions=excluded.conditions,updated_at=excluded.updated_at").bind(x.id, x.baseProductId, x.variantId, x.name, x.modifierType, x.amount, JSON.stringify(x.conditions || {}), x.customerVisible ? 1 : 0, x.active ? 1 : 0, now, now));
    await batch(data.media || [], (x) => env.DB.prepare("INSERT INTO product_media(id,base_product_id,kind,file_key,source,review_status,review_issue,customer_approved,sort_order,created_at,updated_at)VALUES(?,?,?,?,?,'Needs Review',?,0,0,?,?) ON CONFLICT(id) DO UPDATE SET file_key=excluded.file_key,review_status='Needs Review',updated_at=excluded.updated_at").bind(x.id, x.baseProductId, x.kind, x.fileKey || "", x.source, x.fileKey ? null : "Missing image", now, now));
    await batch(data.errors || [], (x) => env.DB.prepare("INSERT INTO item_import_errors(id,job_id,severity,code,message,source_sheet,source_page,source_row,source_data,resolved)VALUES(?,?,?,?,?,?,?,?,?,0)").bind(crypto.randomUUID(), jobId, x.severity, x.code, x.message, x.sourceSheet, x.sourcePage, x.sourceRow, JSON.stringify(x)));
    await env.DB.prepare("UPDATE item_import_jobs SET status='Needs Review',completed_at=? WHERE id=?").bind(stamp(), jobId).run();
    return Response.json({ ok: true, jobId, status: "Needs Review", summary: data.summary }, { status: 201 });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: error instanceof Error ? error.message : "Unable to stage Item Master import" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["admin"]), payload = await req.json() as R, now = stamp();
    if (payload.action === "approve-item") {
      const item = await env.DB.prepare("SELECT * FROM base_products WHERE id=?").bind(payload.id).first<R>();
      if (!item) return Response.json({ error: "Item not found" }, { status: 404 });
      const missing = await env.DB.prepare("SELECT COUNT(*) total FROM sellable_variants WHERE base_product_id=? AND (selling_price IS NULL OR selling_price<=0)").bind(payload.id).first<{ total: number }>();
      const approvedImage = await env.DB.prepare("SELECT 1 FROM product_media WHERE base_product_id=? AND customer_approved=1 LIMIT 1").bind(payload.id).first();
      const approvedBrand = await env.DB.prepare("SELECT 1 FROM customer_brand_mappings WHERE base_product_id=? AND approved_at IS NOT NULL LIMIT 1").bind(payload.id).first();
      if (missing?.total || !approvedImage || !approvedBrand) return Response.json({ error: "Approve a customer brand, quotation image and selling price for every variant first" }, { status: 409 });
      await env.DB.batch([
        env.DB.prepare("UPDATE base_products SET review_status='Approved',active=1,updated_at=? WHERE id=?").bind(now, payload.id),
        env.DB.prepare("UPDATE sellable_variants SET review_status='Approved',active=1,updated_at=? WHERE base_product_id=?").bind(now, payload.id),
        env.DB.prepare("INSERT INTO item_audit_history(id,base_product_id,action,before_snapshot,after_snapshot,created_by,created_at)VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), payload.id, "item_approved", JSON.stringify(item), JSON.stringify({ reviewStatus: "Approved", active: true }), user.id, now),
      ]);
      return Response.json({ ok: true, status: "Approved" });
    }
    if (payload.action === "set-brand-mapping") {
      const brandName = String(payload.brand || "").trim(), customerName = String(payload.customerName || "").trim();
      if (!brandName || !customerName) return Response.json({ error: "Customer brand and approved name are required" }, { status: 400 });
      const brandId = `BRAND-${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      await env.DB.batch([
        env.DB.prepare("INSERT INTO item_brands(id,name,brand_type,active,created_at,updated_at)VALUES(?,?, 'Customer-facing',1,?,?) ON CONFLICT(name) DO UPDATE SET updated_at=excluded.updated_at").bind(brandId, brandName, now, now),
        env.DB.prepare("INSERT INTO customer_brand_mappings(id,base_product_id,brand_id,customer_name,visibility,approved_by,approved_at,created_at,updated_at)VALUES(?,?,?,?,'Customer-facing',?,?,?,?) ON CONFLICT(id) DO UPDATE SET brand_id=excluded.brand_id,customer_name=excluded.customer_name,approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=excluded.updated_at").bind(`MAP-${payload.id}`, payload.id, brandId, customerName, user.id, now, now, now),
        env.DB.prepare("UPDATE base_products SET customer_brand_id=?,customer_name=?,updated_at=? WHERE id=?").bind(brandId, customerName, now, payload.id),
      ]);
      return Response.json({ ok: true });
    }
    if (payload.action === "approve-media") {
      await env.DB.prepare("UPDATE product_media SET customer_approved=1,review_status='Approved',review_issue=NULL,updated_at=? WHERE id=?").bind(now, payload.mediaId).run();
      return Response.json({ ok: true });
    }
    if (payload.action === "set-selling-price") {
      await env.DB.batch([
        env.DB.prepare("UPDATE sellable_variants SET selling_price=?,selling_method=?,updated_at=? WHERE id=?").bind(Number(payload.price), payload.method || "Manual fixed selling price", now, payload.variantId),
        env.DB.prepare("INSERT INTO selling_price_history(id,variant_id,price,method,effective_date,approved_by,created_at)VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), payload.variantId, Number(payload.price), payload.method || "Manual fixed selling price", now.slice(0, 10), user.id, now),
      ]);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported Item Master action" }, { status: 400 });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: error instanceof Error ? error.message : "Unable to update Item Master" }, { status: 500 });
  }
}
