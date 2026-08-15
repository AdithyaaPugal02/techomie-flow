import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";
import { customerCode } from "../../../lib/identifiers";
type R = Record<string, unknown>;
const t = () => new Date().toISOString();
const log = (u: string, a: string, id: string) =>
  env.DB.prepare(
    "INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,?,?,?,?)",
  )
    .bind(u, a, "customer", id, t())
    .run();
export async function GET(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales", "technician"]),
      url = new URL(req.url),
      id = url.searchParams.get("id");
    if (id) {
      const c = await env.DB.prepare(
        "SELECT c.*,u.name assigned_name FROM customers c LEFT JOIN users u ON u.id=c.assigned_to WHERE c.id=? AND (? IN ('admin','crm') OR c.assigned_to=? OR EXISTS(SELECT 1 FROM projects p WHERE p.customer_id=c.id AND p.manager_id=? ) OR EXISTS(SELECT 1 FROM service_tickets s WHERE s.customer_id=c.id AND s.assigned_to=?))",
      )
        .bind(id, u.role, u.id, u.id, u.id)
        .first<R>();
      if (!c)
        return Response.json(
          { error: "Customer not found or unavailable" },
          { status: 404 },
        );
      const q = (sql: string) =>
        env.DB.prepare(sql)
          .bind(...Array((sql.match(/\?/g) || []).length).fill(id))
          .all<R>();
      const [
        contacts,
        sites,
        leads,
        quotes,
        invoices,
        projects,
        payments,
        warranties,
        service,
        amc,
        notes,
        docs,
        activity,
      ] = await Promise.all([
        q(
          "SELECT * FROM customer_contacts WHERE customer_id=? AND active=1 ORDER BY primary_contact DESC,name",
        ),
        q(
          "SELECT * FROM customer_sites WHERE customer_id=? AND archived=0 ORDER BY name",
        ),
        q(
          "SELECT l.*,u.name assigned_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.customer_id=? AND l.archived=0 ORDER BY l.created_at DESC",
        ),
        q(
          "SELECT q.*,s.name site_name FROM quotations q LEFT JOIN sites s ON s.id=q.site_id WHERE q.customer_id=? ORDER BY q.created_at DESC",
        ),
        q(
          "SELECT i.*,COALESCE((SELECT SUM(p.amount)FROM invoice_payments p WHERE p.invoice_id=i.id),0)paid FROM tax_invoices i WHERE i.customer_id=? ORDER BY i.invoice_date DESC",
        ),
        q(
          "SELECT p.*,s.name site_name,u.name manager_name FROM projects p LEFT JOIN customer_sites s ON s.id=p.site_id LEFT JOIN users u ON u.id=p.manager_id WHERE p.customer_id=? AND p.archived=0 ORDER BY p.updated_at DESC",
        ),
        q(
          "SELECT p.* FROM payments p JOIN projects pr ON pr.id=p.project_id WHERE pr.customer_id=? AND p.archived=0 ORDER BY p.date DESC",
        ),
        q(
          "SELECT w.*,s.name site_name FROM warranties w LEFT JOIN customer_sites s ON s.id=w.site_id WHERE w.customer_id=?",
        ),
        q(
          "SELECT st.*,s.name site_name,u.name assigned_name FROM service_tickets st LEFT JOIN customer_sites s ON s.id=st.site_id LEFT JOIN users u ON u.id=st.assigned_to WHERE st.customer_id=? AND st.archived=0",
        ),
        q("SELECT * FROM amc_contracts WHERE customer_id=?"),
        q(
          "SELECT n.*,u.name author FROM customer_notes n LEFT JOIN users u ON u.id=n.created_by WHERE n.customer_id=? ORDER BY n.created_at DESC",
        ),
        q(
          "SELECT * FROM attachments WHERE entity_type='customer' AND entity_id=CAST(? AS TEXT) AND archived=0 ORDER BY created_at DESC",
        ),
        q(
          "SELECT a.*,u.name staff_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (a.entity_type='customer' AND a.entity_id=CAST(? AS TEXT)) OR (a.entity_type IN ('lead','quotation','project','tax_invoice') AND a.entity_id IN(SELECT id FROM leads WHERE customer_id=?)) ORDER BY a.created_at DESC LIMIT 100",
        ),
      ]);
      const inv = invoices.results,
        received = inv.reduce((a, x) => a + Number(x.paid || 0), 0),
        invoiced = inv
          .filter((x) => x.status !== "Draft" && x.status !== "Cancelled")
          .reduce((a, x) => a + Number(x.grand_total || 0), 0);
      return Response.json({
        customer: { ...c, tags: c.tags ? JSON.parse(String(c.tags)) : [] },
        contacts: contacts.results,
        sites: sites.results,
        leads: leads.results,
        quotations: quotes.results,
        invoices: inv.map((x) => ({
          ...x,
          balance: Math.max(0, Number(x.grand_total) - Number(x.paid)),
        })),
        projects: projects.results,
        payments: payments.results,
        warranties: warranties.results,
        service: service.results,
        amc: amc.results,
        notes: notes.results,
        documents: docs.results,
        activity: activity.results,
        summary: {
          sites: sites.results.length,
          quoted: quotes.results.reduce((a, x) => a + Number(x.total || 0), 0),
          accepted: quotes.results
            .filter((x) =>
              ["accepted", "won", "invoiced"].includes(
                String(x.status).toLowerCase(),
              ),
            )
            .reduce((a, x) => a + Number(x.total || 0), 0),
          invoiced,
          received,
          pending: Math.max(0, invoiced - received),
          overdue: inv
            .filter(
              (x) =>
                x.status !== "Paid" &&
                String(x.due_date || "9999") <
                  new Date().toISOString().slice(0, 10),
            )
            .reduce(
              (a, x) => a + Math.max(0, Number(x.grand_total) - Number(x.paid)),
              0,
            ),
          activeProjects: projects.results.filter(
            (x) => x.status !== "Completed",
          ).length,
          completedProjects: projects.results.filter(
            (x) => x.status === "Completed",
          ).length,
          openService: service.results.filter(
            (x) =>
              !["Closed", "Resolved", "Completed"].includes(String(x.status)),
          ).length,
        },
      });
    }
    const q = url.searchParams.get("q") || "",
      status = url.searchParams.get("status") || "",
      city = url.searchParams.get("city") || "",
      assigned = url.searchParams.get("assigned") || "",
      where = ["c.archived=0"],
      args: unknown[] = [];
    if (!["admin", "crm"].includes(u.role)) {
      where.push(
        "(c.assigned_to=? OR EXISTS(SELECT 1 FROM projects p WHERE p.customer_id=c.id AND p.manager_id=?) OR EXISTS(SELECT 1 FROM service_tickets s WHERE s.customer_id=c.id AND s.assigned_to=?))",
      );
      args.push(u.id, u.id, u.id);
    }
    if (q) {
      where.push(
        "(c.customer_code LIKE ? OR c.name LIKE ? OR c.display_name LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ? OR c.email LIKE ? OR c.gstin LIKE ?)",
      );
      for (let i = 0; i < 7; i++) args.push(`%${q}%`);
    }
    if (status) {
      where.push("c.status=?");
      args.push(status);
    }
    if (city) {
      where.push("c.city LIKE ?");
      args.push(`%${city}%`);
    }
    if (assigned && u.role === "admin") {
      where.push("c.assigned_to=?");
      args.push(assigned);
    }
    const rows = (
      await env.DB.prepare(
        `SELECT c.*,u.name assigned_name,(SELECT COUNT(*) FROM customer_sites s WHERE s.customer_id=c.id AND s.archived=0)site_count,(SELECT COALESCE(SUM(i.grand_total),0) FROM tax_invoices i WHERE i.customer_id=c.id AND i.status NOT IN('Draft','Cancelled'))invoiced,(SELECT COALESCE(SUM(p.amount),0)FROM invoice_payments p JOIN tax_invoices i ON i.id=p.invoice_id WHERE i.customer_id=c.id)received FROM customers c LEFT JOIN users u ON u.id=c.assigned_to WHERE ${where.join(" AND ")} ORDER BY c.created_at DESC LIMIT 500`,
      )
        .bind(...args)
        .all<R>()
    ).results;
    const users = (
      await env.DB.prepare(
        "SELECT id,name,role FROM users WHERE active=1 ORDER BY name",
      ).all()
    ).results;
    return Response.json({
      customers: rows.map((x) => ({
        ...x,
        balance: Math.max(0, Number(x.invoiced) - Number(x.received)),
      })),
      users,
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to load customers",
          },
          { status: 500 },
        );
  }
}
export async function POST(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]),
      p = (await req.json()) as R;
    if (!p.name || !p.phone)
      return Response.json(
        { error: "Customer name and phone are required" },
        { status: 400 },
      );
    const dup = await env.DB.prepare(
      "SELECT id,customer_code,name,phone,email,gstin FROM customers WHERE archived=0 AND(phone=? OR (?!='' AND email=?)OR(?!='' AND gstin=?)OR lower(name)=lower(?))LIMIT 5",
    )
      .bind(
        p.phone,
        p.email || "",
        p.email || "",
        p.gstin || "",
        p.gstin || "",
        p.name,
      )
      .all();
    if (dup.results.length && !p.allowDuplicate)
      return Response.json(
        { error: "Possible duplicate customer found", duplicates: dup.results },
        { status: 409 },
      );
    const now = t(),
      row = await env.DB.prepare(
        "INSERT INTO customers(customer_code,customer_type,name,display_name,primary_contact,phone,whatsapp,email,alternate_phone,gstin,pan,billing_address,city,state,pincode,country,lead_source,assigned_to,status,notes,tags,archived,created_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)RETURNING id",
      )
        .bind(
          null,
          p.customerType || "Individual",
          p.name,
          p.displayName || p.name,
          p.primaryContact || p.name,
          p.phone,
          p.whatsapp || null,
          p.email || null,
          p.alternatePhone || null,
          p.gstin || null,
          p.pan || null,
          p.billingAddress || null,
          p.city || null,
          p.state || "Tamil Nadu",
          p.pincode || null,
          p.country || "India",
          p.leadSource || null,
          u.role === "sales" ? u.id : p.assignedTo || u.id,
          p.status || "Prospect",
          p.notes || null,
          JSON.stringify(p.tags || []),
          now,
        )
        .first<{ id: number }>();
    const code = customerCode(row!.id);
    await env.DB.prepare("UPDATE customers SET customer_code=? WHERE id=?")
      .bind(code, row!.id)
      .run();
    if (p.primaryContact) {
      await env.DB.prepare(
        "INSERT INTO customer_contacts(id,customer_id,name,designation,phone,whatsapp,email,primary_contact,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,1,1,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          row!.id,
          p.primaryContact,
          p.primaryDesignation || null,
          p.phone,
          p.whatsapp || null,
          p.email || null,
          now,
          now,
        )
        .run();
    }
    await log(u.id, "customer_created", String(row!.id));
    return Response.json(
      { customer: { id: row!.id, customerCode: code } },
      { status: 201 },
    );
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to create customer",
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
      action = String(p.action || "update"),
      now = t();
    if (action === "contact") {
      await env.DB.prepare(
        "INSERT INTO customer_contacts(id,customer_id,name,designation,phone,whatsapp,email,primary_contact,notes,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,1,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          id,
          p.name,
          p.designation || null,
          p.phone,
          p.whatsapp || null,
          p.email || null,
          p.primary ? 1 : 0,
          p.notes || null,
          now,
          now,
        )
        .run();
      await log(u.id, "customer_contact_added", String(id));
      return Response.json({ ok: true });
    }
    if (action === "site") {
      if (!id || !String(p.name || "").trim() || !String(p.address || "").trim())
        return Response.json(
          { error: "Customer, site name and full address are required" },
          { status: 400 },
        );
      const customer = await env.DB.prepare(
        "SELECT id FROM customers WHERE id=? AND archived=0",
      )
        .bind(id)
        .first();
      if (!customer)
        return Response.json({ error: "Customer not found" }, { status: 404 });
      const sid = `SITE-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      await env.DB.prepare(
        "INSERT INTO customer_sites(id,customer_id,site_code,name,address,city,state,pincode,maps_url,contact_name,contact_phone,property_type,construction_stage,floors,neutral_wire,survey_notes,electrical_readiness,network_details,access_requirements,status,archived)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Active',0)",
      )
        .bind(
          crypto.randomUUID(),
          id,
          sid,
          p.name,
          p.address,
          p.city || null,
          p.state || "Tamil Nadu",
          p.pincode || null,
          p.mapsUrl || null,
          p.contactName || null,
          p.contactPhone || null,
          p.propertyType || null,
          p.constructionStage || null,
          JSON.stringify(p.floors || []),
          p.neutralWire || null,
          p.surveyNotes || null,
          p.electricalReadiness || null,
          p.networkDetails || null,
          p.accessRequirements || null,
        )
        .run();
      await log(u.id, "customer_site_added", String(id));
      return Response.json({ ok: true, siteCode: sid });
    }
    if (action === "note") {
      await env.DB.prepare(
        "INSERT INTO customer_notes(id,customer_id,site_id,content,private,created_by,created_at,updated_at)VALUES(?,?,?,?,1,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          id,
          p.siteId || null,
          p.content,
          u.id,
          now,
          now,
        )
        .run();
      await log(u.id, "customer_note_added", String(id));
      return Response.json({ ok: true });
    }
    if (action === "archive") {
      if (u.role !== "admin")
        return Response.json({ error: "Admin only" }, { status: 403 });
      await env.DB.prepare(
        "UPDATE customers SET archived=1,status='Archived' WHERE id=?",
      )
        .bind(id)
        .run();
      await log(u.id, "customer_archived", String(id));
      return Response.json({ ok: true });
    }
    if (action === "merge") {
      if (u.role !== "admin")
        return Response.json({ error: "Admin only" }, { status: 403 });
      const source = Number(p.sourceId),
        target = id;
      if (source === target)
        return Response.json(
          { error: "Choose two different customers" },
          { status: 400 },
        );
      for (const table of [
        "leads",
        "customer_sites",
        "projects",
        "tax_invoices",
        "warranties",
        "service_tickets",
        "amc_contracts",
      ])
        await env.DB.prepare(
          `UPDATE ${table} SET customer_id=? WHERE customer_id=?`,
        )
          .bind(target, source)
          .run();
      await env.DB.prepare(
        "UPDATE customers SET archived=1,status='Archived',notes=COALESCE(notes,'')||? WHERE id=?",
      )
        .bind(`\nMerged into customer ${target}`, source)
        .run();
      await log(u.id, "customer_merged", String(target));
      return Response.json({ ok: true });
    }
    await env.DB.prepare(
      "UPDATE customers SET customer_type=?,name=?,display_name=?,primary_contact=?,phone=?,whatsapp=?,email=?,alternate_phone=?,gstin=?,pan=?,billing_address=?,city=?,state=?,pincode=?,country=?,lead_source=?,assigned_to=?,status=?,notes=?,tags=? WHERE id=?",
    )
      .bind(
        p.customerType,
        p.name,
        p.displayName,
        p.primaryContact,
        p.phone,
        p.whatsapp || null,
        p.email || null,
        p.alternatePhone || null,
        p.gstin || null,
        p.pan || null,
        p.billingAddress || null,
        p.city || null,
        p.state || "Tamil Nadu",
        p.pincode || null,
        p.country || "India",
        p.leadSource || null,
        u.role === "sales" ? u.id : p.assignedTo,
        p.status || "Active",
        p.notes || null,
        JSON.stringify(p.tags || []),
        id,
      )
      .run();
    await log(u.id, "customer_updated", String(id));
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to update customer",
          },
          { status: 500 },
        );
  }
}
