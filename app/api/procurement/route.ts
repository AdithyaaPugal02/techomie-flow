import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

type R = Record<string, any>;
const now = () => new Date().toISOString();

const parse = (v: any, fallback: any = {}) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : (v ?? fallback);
  } catch {
    return fallback;
  }
};

const privateKeys = new Set(["purchaseCost", "purchase_cost", "buyingPrice", "buying_price", "margin", "profit"]);
const redact = (v: any): any =>
  Array.isArray(v)
    ? v.map(redact)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .filter(([k]) => !privateKeys.has(k))
            .map(([k, x]) => [k, redact(x)]),
        )
      : v;

export async function GET(req: Request) {
  try {
    const user = await requireUser(["admin", "crm", "sales", "technician"]);
    const url = new URL(req.url);
    const quotationId = url.searchParams.get("quotationId");

    // Fetch quotations list for the procurement selector
    const quotesQuery = await env.DB.prepare(
      `SELECT q.id, q.number, q.revision, q.customer_id, q.site_id, q.title, q.status, q.total, q.quote_date, q.created_at, q.updated_at,
              c.name customer_name, c.phone customer_phone, s.name site_name, s.city,
              p.id linked_project_id, p.title linked_project_title
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN customer_sites s ON s.id = q.site_id
       LEFT JOIN projects p ON p.quotation_id = q.id
       WHERE q.archived = 0
       ORDER BY q.updated_at DESC, q.created_at DESC`
    ).all<R>();

    const quotations = quotesQuery.results || [];

    let targetQuotation: R | null = null;
    if (quotationId) {
      targetQuotation = await env.DB.prepare(
        `SELECT q.*, c.name customer_name, c.phone customer_phone, s.name site_name, s.city, s.address site_address,
                p.id linked_project_id, p.title linked_project_title
         FROM quotations q
         LEFT JOIN customers c ON c.id = q.customer_id
         LEFT JOIN customer_sites s ON s.id = q.site_id
         LEFT JOIN projects p ON p.quotation_id = q.id
         WHERE q.id = ? AND q.archived = 0`
      ).bind(Number(quotationId)).first<R>();

      if (targetQuotation) {
        const snap = parse(targetQuotation.snapshot);
        targetQuotation.snapshot = user.role === "admin" ? snap : redact(snap);
      }
    } else if (quotations.length > 0) {
      // Default to first quotation
      const firstId = quotations[0].id;
      targetQuotation = await env.DB.prepare(
        `SELECT q.*, c.name customer_name, c.phone customer_phone, s.name site_name, s.city, s.address site_address,
                p.id linked_project_id, p.title linked_project_title
         FROM quotations q
         LEFT JOIN customers c ON c.id = q.customer_id
         LEFT JOIN customer_sites s ON s.id = q.site_id
         LEFT JOIN projects p ON p.quotation_id = q.id
         WHERE q.id = ? AND q.archived = 0`
      ).bind(firstId).first<R>();

      if (targetQuotation) {
        const snap = parse(targetQuotation.snapshot);
        targetQuotation.snapshot = user.role === "admin" ? snap : redact(snap);
      }
    }

    // Also fetch tracked project materials
    const materialsQuery = await env.DB.prepare(
      `SELECT m.*, p.title project_title, p.customer_id, c.name customer_name, s.name site_name
       FROM project_materials m
       LEFT JOIN projects p ON p.id = m.project_id
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN customer_sites s ON s.id = p.site_id
       ORDER BY m.updated_at DESC`
    ).all<R>();

    const safeMaterials = user.role === "admin" 
      ? (materialsQuery.results || [])
      : (materialsQuery.results || []).map((m: R) => {
          const c = { ...m };
          delete c.buying_price;
          delete c.freight;
          return c;
        });

    // Also fetch active projects for linking
    const projectsQuery = await env.DB.prepare(
      `SELECT p.id, p.title, p.customer_id, p.site_id, p.quotation_id, p.status, c.name customer_name
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.archived = 0
       ORDER BY p.created_at DESC`
    ).all<R>();

    return Response.json({
      quotations,
      currentQuotation: targetQuotation,
      materials: safeMaterials,
      projects: projectsQuery.results || [],
      isAdmin: user.role === "admin",
    });
  } catch (e: any) {
    return e instanceof Response
      ? e
      : Response.json({ error: e?.message || "Failed to load procurement data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin", "crm", "sales", "technician"]);
    const body = (await req.json()) as R;
    const action = body.action || "sync_to_materials";

    if (action === "sync_to_materials") {
      const { projectId, items } = body;
      if (!projectId) {
        return Response.json({ error: "Project ID is required" }, { status: 400 });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return Response.json({ error: "No procurement items to sync" }, { status: 400 });
      }

      const timestamp = now();
      for (const it of items) {
        const id = `MAT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
        await env.DB.prepare(
          `INSERT INTO project_materials
             (id, project_id, name, sku, required_qty, ordered_qty, received_qty, at_site_qty, installed_qty, status, buying_price, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 'Required', ?, ?)`
        )
          .bind(
            id,
            projectId,
            String(it.name || "Item"),
            it.sku || null,
            Number(it.qty || it.requiredQty || 1),
            user.role === "admin" ? Number(it.purchaseCost || it.buyingPrice || 0) : null,
            timestamp
          )
          .run();
      }

      return Response.json({ ok: true, count: items.length });
    }

    if (action === "update_material") {
      const { id, status, ordered_qty, received_qty, at_site_qty, installed_qty, expected_delivery, purchase_reference } = body;
      if (!id) return Response.json({ error: "Material ID is required" }, { status: 400 });

      await env.DB.prepare(
        `UPDATE project_materials
         SET status = COALESCE(?, status),
             ordered_qty = COALESCE(?, ordered_qty),
             received_qty = COALESCE(?, received_qty),
             at_site_qty = COALESCE(?, at_site_qty),
             installed_qty = COALESCE(?, installed_qty),
             expected_delivery = COALESCE(?, expected_delivery),
             purchase_reference = COALESCE(?, purchase_reference),
             updated_at = ?
         WHERE id = ?`
      )
        .bind(
          status ?? null,
          ordered_qty != null ? Number(ordered_qty) : null,
          received_qty != null ? Number(received_qty) : null,
          at_site_qty != null ? Number(at_site_qty) : null,
          installed_qty != null ? Number(installed_qty) : null,
          expected_delivery ?? null,
          purchase_reference ?? null,
          now(),
          id
        )
        .run();

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return e instanceof Response
      ? e
      : Response.json({ error: e?.message || "Failed to process procurement request" }, { status: 500 });
  }
}
