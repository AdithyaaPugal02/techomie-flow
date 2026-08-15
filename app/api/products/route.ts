import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";
import { variantSku } from "../../../lib/identifiers";
type R = Record<string, unknown>;
const safe = (r: R, admin: boolean) => {
  if (admin) {
    const cost = Number(r.purchase_cost || 0),
      sell = Number(r.selling_price || 0);
    return {
      ...r,
      margin: sell - cost,
      marginPercent: sell ? (sell > 0 ? ((sell - cost) / sell) * 100 : 0) : 0,
    };
  }
  const { purchase_cost, minimum_price, ...rest } = r;
  return rest;
};
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      x = new URL(req.url),
      id = x.searchParams.get("id"),
      admin = u.role === "admin";
    if (id) {
      const item = await env.DB.prepare(
        "SELECT p.*,v.id variant_id,v.name variant_name,v.sku,v.attributes,v.selling_price,v.minimum_price,v.purchase_cost,v.tax_rate variant_tax,v.hsn variant_hsn,v.warranty variant_warranty,v.image_key,v.active variant_active FROM products p JOIN variants v ON v.product_id=p.id WHERE v.id=?",
      )
        .bind(id)
        .first<R>();
      if (!item)
        return Response.json({ error: "Item not found" }, { status: 404 });
      const variants = (
          await env.DB.prepare(
            "SELECT * FROM variants WHERE product_id=? ORDER BY name",
          )
            .bind(item.id)
            .all<R>()
        ).results.map((r) => safe(r, admin)),
        usage = admin
          ? (
              await env.DB.prepare(
                "SELECT qi.quotation_id,q.number,q.status,qi.quantity,qi.unit_price,q.created_at FROM quotation_items qi JOIN quotations q ON q.id=qi.quotation_id WHERE qi.variant_id=? ORDER BY q.created_at DESC",
              )
                .bind(id)
                .all()
            ).results
          : [];
      return Response.json({ item: safe(item, admin), variants, usage });
    }
    const p = Math.max(1, Number(x.searchParams.get("page") || 1)),
      limit = [25, 50, 100].includes(Number(x.searchParams.get("limit")))
        ? Number(x.searchParams.get("limit"))
        : 25,
      where = ["1=1"],
      args: unknown[] = [];
    for (const [k, col] of [
      ["category", "p.category"],
      ["subcategory", "p.subcategory"],
      ["brand", "p.brand"],
      ["gst", "v.tax_rate"],
    ] as const) {
      const val = x.searchParams.get(k);
      if (val) {
        where.push(`${col}=?`);
        args.push(val);
      }
    }
    const q = x.searchParams.get("q");
    if (q) {
      where.push(
        "(p.name LIKE ? OR v.name LIKE ? OR v.sku LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR p.subcategory LIKE ? OR v.hsn LIKE ?)",
      );
      for (let i = 0; i < 7; i++) args.push(`%${q}%`);
    }
    const technology = x.searchParams.get("technology");
    if (technology) {
      where.push("v.attributes LIKE ?");
      args.push(`%${technology}%`);
    }
    const type = x.searchParams.get("type");
    if (type) {
      where.push(
        "COALESCE(json_extract(v.attributes,'$.itemType'),'Product')=?",
      );
      args.push(type);
    }
    const active = x.searchParams.get("active");
    if (active) {
      where.push("v.active=?");
      args.push(active === "active" ? 1 : 0);
    }
    const image = x.searchParams.get("image");
    if (image === "yes")
      where.push("v.image_key IS NOT NULL AND v.image_key!=''");
    if (image === "no") where.push("(v.image_key IS NULL OR v.image_key='')");
    const min = x.searchParams.get("minPrice"),
      max = x.searchParams.get("maxPrice");
    if (min) {
      where.push("v.selling_price>=?");
      args.push(Number(min));
    }
    if (max) {
      where.push("v.selling_price<=?");
      args.push(Number(max));
    }
    const base = `FROM variants v JOIN products p ON p.id=v.product_id WHERE ${where.join(" AND ")}`,
      count = await env.DB.prepare(`SELECT COUNT(*) total ${base}`)
        .bind(...args)
        .first<{ total: number }>(),
      rows = (
        await env.DB.prepare(
          `SELECT p.id product_id,p.name,p.category,p.subcategory,p.brand,p.series,p.short_description,p.description,p.unit,p.tax_rate default_tax,p.warranty default_warranty,p.active product_active,p.updated_at,v.id variant_id,v.name variant_name,v.sku,v.attributes,v.selling_price,v.minimum_price,v.purchase_cost,v.tax_rate,v.hsn,v.warranty,v.image_key,v.active ${base} ORDER BY p.name,v.name LIMIT ? OFFSET ?`,
        )
          .bind(...args, limit, (p - 1) * limit)
          .all<R>()
      ).results.map((r) => safe(r, admin));
    const filters = await env.DB.prepare(
      "SELECT DISTINCT category,subcategory,brand FROM products ORDER BY category,subcategory,brand",
    ).all();
    return Response.json({
      items: rows,
      pagination: {
        page: p,
        limit,
        total: count?.total || 0,
        pages: Math.ceil((count?.total || 0) / limit),
      },
      filters: filters.results,
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: e instanceof Error ? e.message : "Unable to load items" },
          { status: 500 },
        );
  }
}
export async function POST(req: Request) {
  try {
    const u = await requireUser(["admin"]),
      p = (await req.json()) as R;
    if (
      !p.name ||
      !(Number(p.sellingPrice) > 0) ||
      Number(p.purchaseCost) < 0
    )
      return Response.json(
        { error: "Name and valid prices are required" },
        { status: 400 },
      );
    const now = new Date().toISOString(),
      product = await env.DB.prepare(
        "INSERT INTO products(name,category,subcategory,series,brand,short_description,description,hsn,unit,tax_rate,warranty,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)RETURNING id",
      )
        .bind(
          p.name,
          p.category || "Other",
          p.subcategory || null,
          p.series || null,
          p.brand || "Noviq",
          p.shortDescription || null,
          p.description || null,
          p.hsn || null,
          p.unit || "Nos",
          Number(p.taxRate || 18),
          p.warranty || null,
          1,
          now,
          now,
        )
        .first<{ id: number }>(),
      attributes = {
        ...(p.attributes || { itemType: p.itemType || "Product" }),
        ...(p.sku && !String(p.sku).startsWith("TCM-") ? { supplierSku: p.sku } : {}),
      },
      variant = await env.DB.prepare(
        "INSERT INTO variants(product_id,sku,name,attributes,selling_price,minimum_price,purchase_cost,tax_rate,hsn,warranty,image_key,active)VALUES(?,?,?,?,?,?,?,?,?,?,?,1)RETURNING id",
      )
        .bind(
          product!.id,
          `TCM-TEMP-${crypto.randomUUID()}`,
          p.variantName || p.name,
          JSON.stringify(attributes),
          Number(p.sellingPrice),
          p.minimumPrice || null,
          Number(p.purchaseCost),
          Number(p.taxRate || 18),
          p.hsn || null,
          p.warranty || null,
          p.imageKey || null,
        )
        .first<{ id: number }>();
    const sku = variantSku({ category: p.category, brand: p.brand, series: p.series, name: p.name, attributes }, variant!.id);
    await env.DB.prepare("UPDATE variants SET sku=? WHERE id=?").bind(sku, variant!.id).run();
    await env.DB.prepare(
      "INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,'item_created','product',?,?)",
    )
      .bind(u.id, String(variant!.id), now)
      .run();
    return Response.json(
      { item: { productId: product!.id, variantId: variant!.id, sku } },
      { status: 201 },
    );
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: e instanceof Error ? e.message : "Unable to create item" },
          { status: 500 },
        );
  }
}
export async function PATCH(req: Request) {
  try {
    const u = await requireUser(["admin"]),
      p = (await req.json()) as R,
      id = Number(p.variantId),
      v = await env.DB.prepare("SELECT product_id FROM variants WHERE id=?")
        .bind(id)
        .first<{ product_id: number }>();
    if (!v) return Response.json({ error: "Item not found" }, { status: 404 });
    if (p.action === "archive") {
      const used = await env.DB.prepare(
        "SELECT 1 FROM quotation_items WHERE variant_id=? LIMIT 1",
      )
        .bind(id)
        .first();
      await env.DB.prepare("UPDATE variants SET active=0 WHERE id=?")
        .bind(id)
        .run();
      await env.DB.prepare(
        "UPDATE products SET active=0,updated_at=? WHERE id=?",
      )
        .bind(new Date().toISOString(), v.product_id)
        .run();
      return Response.json({ ok: true, archived: true, used: !!used });
    }
    const attributes = {
      ...(p.attributes || {}),
      ...(p.sku && !String(p.sku).startsWith("TCM-") ? { supplierSku: p.sku } : {}),
    },
      sku = variantSku({ category: p.category, brand: p.brand, series: p.series, name: p.name, attributes }, id);
    await env.DB.prepare(
      "UPDATE products SET name=?,category=?,subcategory=?,brand=?,series=?,short_description=?,description=?,hsn=?,unit=?,tax_rate=?,warranty=?,active=?,updated_at=? WHERE id=?",
    )
      .bind(
        p.name,
        p.category,
        p.subcategory || null,
        p.brand,
        p.series || null,
        p.shortDescription || null,
        p.description || null,
        p.hsn || null,
        p.unit || "Nos",
        Number(p.taxRate),
        p.warranty || null,
        p.active ? 1 : 0,
        new Date().toISOString(),
        v.product_id,
      )
      .run();
    await env.DB.prepare(
      "UPDATE variants SET sku=?,name=?,attributes=?,selling_price=?,minimum_price=?,purchase_cost=?,tax_rate=?,hsn=?,warranty=?,image_key=?,active=? WHERE id=?",
    )
      .bind(
        sku,
        p.variantName || p.name,
        JSON.stringify(attributes),
        Number(p.sellingPrice),
        p.minimumPrice || null,
        Number(p.purchaseCost),
        Number(p.taxRate),
        p.hsn || null,
        p.warranty || null,
        p.imageKey || null,
        p.active ? 1 : 0,
        id,
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,'item_updated','product',?,?)",
    )
      .bind(u.id, String(id), new Date().toISOString())
      .run();
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "Unable to update item" }, { status: 500 });
  }
}
