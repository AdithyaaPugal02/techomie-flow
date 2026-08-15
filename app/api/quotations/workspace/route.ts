import { env } from "cloudflare:workers";
import { requireUser } from "../../../../lib/auth";
type R = Record<string, any>;
const now = () => new Date().toISOString();
const parse = (v: any, f: any = {}) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : (v ?? f);
  } catch {
    return f;
  }
};
const privateKeys = new Set([
  "purchaseCost",
  "purchase_cost",
  "buyingPrice",
  "supplierPrice",
  "margin",
  "profit",
  "minimumPrice",
]);
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
const audit = (u: string, a: string, id: number) =>
  env.DB.prepare(
    "INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,?,?,?,?)",
  )
    .bind(u, a, "quotation", String(id), now())
    .run();
const activity = (u: string, id: number, type: string, text: string) =>
  env.DB.prepare(
    "INSERT INTO activities(entity_type,entity_id,type,content,created_by,created_at)VALUES('quotation',?,?,?,?,?)",
  )
    .bind(String(id), type, text, u, now())
    .run();
export async function GET(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]),
      x = new URL(req.url),
      id = Number(x.searchParams.get("id")),
      q = await env.DB.prepare(
        "SELECT q.*,c.name customer_name,c.phone,c.gstin,c.billing_address,c.primary_contact,s.name site_name,s.address site_address,s.city,s.state,s.pincode,s.contact_name,s.contact_phone,u.name sales_name FROM quotations q JOIN customers c ON c.id=q.customer_id JOIN customer_sites s ON s.id=q.site_id LEFT JOIN users u ON u.id=q.sales_id WHERE q.id=? AND q.archived=0 AND (?!='sales' OR q.sales_id=? OR q.created_by=?)",
      )
        .bind(id, u.role, u.id, u.id)
        .first<R>();
    if (!q)
      return Response.json({ error: "Quotation unavailable" }, { status: 404 });
    const [activities, files, acceptances, revisions] = await Promise.all([
      env.DB.prepare(
        "SELECT a.*,u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.created_by WHERE a.entity_type='quotation' AND a.entity_id=? ORDER BY a.created_at DESC",
      )
        .bind(String(id))
        .all(),
      env.DB.prepare(
        "SELECT * FROM quotation_files WHERE quotation_id=? ORDER BY created_at DESC",
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        "SELECT * FROM quotation_acceptances WHERE quotation_id=? ORDER BY created_at DESC",
      )
        .bind(id)
        .all(),
      env.DB.prepare(
        "SELECT id,revision,pdf_key,created_by,created_at FROM quotation_revisions WHERE quotation_id=? ORDER BY revision DESC",
      )
        .bind(id)
        .all(),
    ]);
    const snapshot = parse(q.snapshot);
    return Response.json({
      quotation: {
        ...q,
        snapshot: u.role === "admin" ? snapshot : redact(snapshot),
      },
      activities: activities.results,
      files: files.results,
      acceptances: acceptances.results,
      revisions: revisions.results,
      admin: u.role === "admin",
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error:
              e instanceof Error
                ? e.message
                : "Unable to load quotation workspace",
          },
          { status: 500 },
        );
  }
}
export async function PATCH(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]),
      p = (await req.json()) as R,
      id = Number(p.id),
      q = await env.DB.prepare(
        "SELECT * FROM quotations WHERE id=? AND archived=0",
      )
        .bind(id)
        .first<R>();
    if (!q)
      return Response.json({ error: "Quotation not found" }, { status: 404 });
    if (u.role === "sales" && q.sales_id !== u.id && q.created_by !== u.id)
      return Response.json({ error: "Quotation unavailable" }, { status: 403 });
    const action = String(p.action || "autosave");
    if (action === "relink") {
      if (!["Draft", "Revision Required", "Revised", "Pending Internal Approval"].includes(String(q.status)))
        return Response.json(
          { error: "This quotation version is locked. Create a revision to change its customer." },
          { status: 409 },
        );
      const customerId = Number(p.customerId), siteId = String(p.siteId || "");
      if (!customerId || !siteId)
        return Response.json({ error: "Select both a customer and an installation site" }, { status: 400 });
      const relation = await env.DB.prepare(
        "SELECT s.*,c.name customer_name,c.phone,c.gstin,c.billing_address,c.primary_contact FROM customer_sites s JOIN customers c ON c.id=s.customer_id WHERE s.id=? AND s.customer_id=? AND s.archived=0 AND c.archived=0",
      ).bind(siteId, customerId).first<R>();
      if (!relation)
        return Response.json({ error: "Select a site that belongs to this customer" }, { status: 409 });
      const snapshot = parse(q.snapshot), details = snapshot.details || {};
      snapshot.details = {
        ...details,
        customer: relation.customer_name,
        customerName: relation.customer_name,
        phone: relation.phone,
        gstin: relation.gstin,
        billingAddress: relation.billing_address,
        primaryContact: relation.primary_contact,
        site: relation.name,
        siteName: relation.name,
        siteAddress: relation.address,
        city: relation.city,
        state: relation.state,
        pincode: relation.pincode,
        contactName: relation.contact_name,
        contactPhone: relation.contact_phone,
      };
      const t = now();
      await env.DB.prepare(
        "UPDATE quotations SET customer_id=?,site_id=?,snapshot=?,updated_at=? WHERE id=?",
      ).bind(customerId, siteId, JSON.stringify(snapshot), t, id).run();
      await activity(u.id, id, "Customer / Site Updated", `${relation.customer_name} · ${relation.name}`);
      await audit(u.id, "quote_customer_site_updated", id);
      return Response.json({ ok: true, savedAt: t });
    }
    if (action === "autosave") {
      if (
        ![
          "Draft",
          "Revision Required",
          "Revised",
          "Pending Internal Approval",
        ].includes(String(q.status))
      )
        return Response.json(
          {
            error:
              "This quotation version is locked. Create a revision to edit.",
          },
          { status: 409 },
        );
      const snapshot = p.snapshot || parse(q.snapshot),
        floors = snapshot.floors || [],
        items = floors.flatMap(
          (f: R) => f.rooms?.flatMap((r: R) => r.items || []) || [],
        ),
        roleSettings = parse(
          (
            await env.DB.prepare(
              "SELECT value FROM settings WHERE key='masters'",
            ).first<R>()
          )?.value,
          {},
        );
      for (const item of items) {
        if (!item.variantId && !item.custom)
          return Response.json(
            { error: `${item.name || "Item"} must be selected from Items` },
            { status: 409 },
          );
        if (item.variantId) {
          const v = await env.DB.prepare(
            "SELECT v.*,p.name product_name,p.brand,p.description,p.unit FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1",
          )
            .bind(item.variantId)
            .first<R>();
          if (!v)
            return Response.json(
              { error: `${item.name || "Item"} is inactive` },
              { status: 409 },
            );
          const min = Number(v.minimum_price || 0),
            net =
              Number(item.price || 0) * (1 - Number(item.discount || 0) / 100);
          if (u.role !== "admin" && min && net < min)
            return Response.json(
              { error: `${item.name} exceeds the allowed discount` },
              { status: 403 },
            );
          item.purchaseCost = Number(v.purchase_cost || 0);
          item.sku = v.sku;
          item.productId = v.product_id;
          item.image = item.image || v.image_key;
          item.warranty = item.warranty || v.warranty;
          item.gst = Number(item.gst ?? v.tax_rate ?? 18);
        }
      }
      const total = Number(p.total || 0),
        t = now();
      await env.DB.prepare(
        "UPDATE quotations SET snapshot=?,total=?,title=COALESCE(?,title),valid_until=COALESCE(?,valid_until),updated_at=? WHERE id=?",
      )
        .bind(
          JSON.stringify(snapshot),
          total,
          p.title || null,
          p.validUntil || null,
          t,
          id,
        )
        .run();
      await env.DB.batch([
        env.DB.prepare("DELETE FROM quotation_items WHERE quotation_id=?").bind(
          id,
        ),
        env.DB.prepare(
          "DELETE FROM quotation_rooms WHERE floor_id IN(SELECT id FROM quotation_floors WHERE quotation_id=?)",
        ).bind(id),
        env.DB.prepare(
          "DELETE FROM quotation_floors WHERE quotation_id=?",
        ).bind(id),
        env.DB.prepare(
          "DELETE FROM quotation_milestones WHERE quotation_id=? AND revision=?",
        ).bind(id, q.revision || 0),
      ]);
      const stmts: any[] = [];
      for (let fi = 0; fi < floors.length; fi++) {
        const f = floors[fi],
          fid = crypto.randomUUID();
        stmts.push(
          env.DB.prepare(
            "INSERT INTO quotation_floors(id,quotation_id,name,sort_order)VALUES(?,?,?,?)",
          ).bind(fid, id, f.name, fi),
        );
        for (let ri = 0; ri < (f.rooms || []).length; ri++) {
          const r = f.rooms[ri],
            rid = crypto.randomUUID();
          stmts.push(
            env.DB.prepare(
              "INSERT INTO quotation_rooms(id,floor_id,name,sort_order)VALUES(?,?,?,?)",
            ).bind(rid, fid, r.name, ri),
          );
          for (let ii = 0; ii < (r.items || []).length; ii++) {
            const x = r.items[ii];
            stmts.push(
              env.DB.prepare(
                "INSERT INTO quotation_items(id,quotation_id,room_id,product_id,variant_id,snapshot,quantity,unit_price,discount,tax_rate,tax_mode,installation,note,sort_order)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              ).bind(
                crypto.randomUUID(),
                id,
                rid,
                x.productId || null,
                x.variantId || null,
                JSON.stringify(x),
                Number(x.qty || 1),
                Number(x.price || 0),
                Number(x.discount || 0),
                Number(x.gst || 18),
                x.taxMode || "GST",
                Number(x.installation || 0),
                x.note || null,
                ii,
              ),
            );
          }
        }
      }
      for (let i = 0; i < (snapshot.paymentPlan || []).length; i++) {
        const m = snapshot.paymentPlan[i];
        stmts.push(
          env.DB.prepare(
            "INSERT INTO quotation_milestones(id,quotation_id,revision,name,percentage,fixed_amount,due_trigger,due_date,notes,amount,sort_order)VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          ).bind(
            crypto.randomUUID(),
            id,
            q.revision || 0,
            m.name,
            Number(m.percent || 0),
            m.fixedAmount || null,
            m.condition || m.dueTrigger || null,
            m.dueDate || null,
            m.notes || null,
            m.fixedAmount || (total * Number(m.percent || 0)) / 100,
            i,
          ),
        );
      }
      if (stmts.length) await env.DB.batch(stmts);
      await activity(
        u.id,
        id,
        "Draft Saved",
        `${items.length} lines saved; total ${total}`,
      );
      await audit(u.id, "quote_autosaved", id);
      return Response.json({ ok: true, savedAt: t });
    }
    if (action === "submit-review") {
      await env.DB.prepare(
        "UPDATE quotations SET status='Pending Internal Approval',updated_at=? WHERE id=?",
      )
        .bind(now(), id)
        .run();
      await activity(
        u.id,
        id,
        "Internal Review",
        "Submitted for Admin approval",
      );
      return Response.json({ ok: true, status: "Pending Internal Approval" });
    }
    if (action === "send") {
      if (u.role !== "admin")
        return Response.json(
          { error: "Admin approval is required before sending" },
          { status: 403 },
        );
      const s = parse(q.snapshot),
        items = (s.floors || []).flatMap(
          (f: R) => f.rooms?.flatMap((r: R) => r.items || []) || [],
        ),
        plan = s.paymentPlan || [];
      if (!items.length)
        return Response.json(
          { error: "Add at least one quotation item" },
          { status: 409 },
        );
      if (items.some((x: R) => !Number(x.price) && !x.optional))
        return Response.json(
          { error: "Every chargeable item needs a selling price" },
          { status: 409 },
        );
      const pct = plan.reduce(
        (a: number, m: R) => a + Number(m.percent || 0),
        0,
      );
      if (plan.length && Math.abs(pct - 100) > 0.01)
        return Response.json(
          { error: "Payment schedule must total 100%" },
          { status: 409 },
        );
      if (!q.valid_until)
        return Response.json(
          { error: "Validity date is required" },
          { status: 409 },
        );
      const t = now();
      await env.DB.prepare(
        "UPDATE quotations SET status='Sent',sent_amount=total,last_followup=?,updated_at=? WHERE id=?",
      )
        .bind(t, t, id)
        .run();
      await env.DB.prepare(
        "UPDATE quotation_revisions SET snapshot=? WHERE quotation_id=? AND revision=?",
      )
        .bind(q.snapshot, id, q.revision || 0)
        .run();
      await activity(
        u.id,
        id,
        "Quotation Sent",
        "Immutable customer snapshot locked",
      );
      await audit(u.id, "quote_sent", id);
      return Response.json({ ok: true, status: "Sent" });
    }
    if (action === "revision") {
      if (
        ![
          "Sent",
          "Viewed",
          "Negotiation",
          "Revision Required",
          "Rejected",
        ].includes(String(q.status))
      )
        return Response.json(
          { error: "Only a customer-shared quotation can be revised" },
          { status: 409 },
        );
      const rev = Number(q.revision || 0) + 1,
        t = now();
      await env.DB.prepare(
        "UPDATE quotations SET revision=?,status='Revised',updated_at=? WHERE id=?",
      )
        .bind(rev, t, id)
        .run();
      await env.DB.prepare(
        "INSERT INTO quotation_revisions(id,quotation_id,revision,snapshot,created_by,created_at)VALUES(?,?,?,?,?,?)",
      )
        .bind(crypto.randomUUID(), id, rev, q.snapshot, u.id, t)
        .run();
      await activity(
        u.id,
        id,
        "Revision Created",
        `Revision ${rev} opened; previous version remains read-only`,
      );
      await audit(u.id, "quote_revision_created", id);
      return Response.json({ ok: true, revision: rev, status: "Revised" });
    }
    if (action === "decision") {
      if (u.role !== "admin")
        return Response.json(
          { error: "Admin approval required" },
          { status: 403 },
        );
      const decision = String(p.decision),
        status = decision === "Accepted" ? "Accepted" : "Rejected",
        t = now();
      await env.DB.prepare(
        "UPDATE quotations SET status=?,accepted_amount=CASE WHEN ?='Accepted' THEN total ELSE accepted_amount END,updated_at=? WHERE id=?",
      )
        .bind(status, status, t, id)
        .run();
      await env.DB.prepare(
        "INSERT INTO quotation_acceptances(id,quotation_id,revision,decision,customer_name,comment,ip_address,user_agent,snapshot,created_at)VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          id,
          q.revision || 0,
          status,
          p.customerName || null,
          p.comment || null,
          req.headers.get("cf-connecting-ip") || null,
          req.headers.get("user-agent") || null,
          q.snapshot,
          t,
        )
        .run();
      await activity(
        u.id,
        id,
        `Quotation ${status}`,
        `${p.customerName || "Customer"}: ${p.comment || "No comment"}`,
      );
      await audit(u.id, `quote_${status.toLowerCase()}`, id);
      return Response.json({ ok: true, status });
    }
    if (action === "converted") {
      if (u.role !== "admin" || q.status !== "Accepted")
        return Response.json({ error: "Only an accepted quotation can be converted" }, { status: 409 });
      await env.DB.prepare("UPDATE quotations SET status='Converted to Project',updated_at=? WHERE id=?").bind(now(), id).run();
      await activity(u.id, id, "Converted to Project", `Linked project ${p.projectId || "created"}`);
      await audit(u.id, "quote_converted_to_project", id);
      return Response.json({ ok: true, status: "Converted to Project" });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error:
              e instanceof Error ? e.message : "Unable to update quotation",
          },
          { status: 500 },
        );
  }
}
