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
      try {
        const consolidated = await env.DB.prepare(`
          SELECT
            (SELECT row_to_json(_c) FROM (SELECT c.*, u.name as assigned_name FROM customers c LEFT JOIN users u ON u.id=c.assigned_to WHERE c.id = $1) _c) as customer,
            (SELECT COALESCE(json_agg(_ct), '[]') FROM (SELECT * FROM customer_contacts WHERE customer_id=$1 AND active=1 ORDER BY primary_contact DESC, name) _ct) as contacts,
            (SELECT COALESCE(json_agg(_s), '[]') FROM (SELECT * FROM customer_sites WHERE customer_id=$1 AND archived=0 ORDER BY name) _s) as sites,
            (SELECT COALESCE(json_agg(_l), '[]') FROM (SELECT l.*, u.name as assigned_name FROM leads l LEFT JOIN users u ON u.id=l.assigned_to WHERE l.customer_id=$1 AND l.archived=0 ORDER BY l.created_at DESC) _l) as leads,
            (SELECT COALESCE(json_agg(_q), '[]') FROM (SELECT q.*, s.name as site_name FROM quotations q LEFT JOIN customer_sites s ON s.id=q.site_id WHERE q.customer_id=$1 ORDER BY q.created_at DESC) _q) as quotes,
            (SELECT COALESCE(json_agg(_i), '[]') FROM (SELECT i.*, COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0) as paid FROM tax_invoices i WHERE i.customer_id=$1 ORDER BY i.invoice_date DESC) _i) as invoices,
            (SELECT COALESCE(json_agg(_p), '[]') FROM (SELECT p.*, s.name as site_name, u.name as manager_name FROM projects p LEFT JOIN customer_sites s ON s.id=p.site_id LEFT JOIN users u ON u.id=p.manager_id WHERE p.customer_id=$1 AND p.archived=0 ORDER BY p.updated_at DESC) _p) as projects,
            (SELECT COALESCE(json_agg(_pm), '[]') FROM (SELECT p.* FROM payments p JOIN projects pr ON pr.id=p.project_id WHERE pr.customer_id=$1 AND p.archived=0 ORDER BY p.date DESC) _pm) as payments,
            (SELECT COALESCE(json_agg(_w), '[]') FROM (SELECT w.*, s.name as site_name FROM warranties w LEFT JOIN customer_sites s ON s.id=w.site_id WHERE w.customer_id=$1) _w) as warranties,
            (SELECT COALESCE(json_agg(_st), '[]') FROM (SELECT st.*, s.name as site_name, u.name as assigned_name FROM service_tickets st LEFT JOIN customer_sites s ON s.id=st.site_id LEFT JOIN users u ON u.id=st.assigned_to WHERE st.customer_id=$1 AND st.archived=0) _st) as service,
            (SELECT COALESCE(json_agg(_amc), '[]') FROM (SELECT * FROM amc_contracts WHERE customer_id=$1) _amc) as amc,
            (SELECT COALESCE(json_agg(_n), '[]') FROM (SELECT n.*, u.name as author FROM customer_notes n LEFT JOIN users u ON u.id=n.created_by WHERE n.customer_id=$1 ORDER BY n.created_at DESC) _n) as notes,
            (SELECT COALESCE(json_agg(_doc), '[]') FROM (SELECT * FROM attachments WHERE entity_type='customer' AND entity_id=CAST($1 AS TEXT) AND archived=0 ORDER BY created_at DESC) _doc) as docs,
            (SELECT COALESCE(json_agg(_act), '[]') FROM (SELECT a.*, u.name as staff_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE (a.entity_type='customer' AND a.entity_id=CAST($1 AS TEXT)) OR (a.entity_type IN ('lead','quotation','project','tax_invoice') AND a.entity_id IN(SELECT id FROM leads WHERE customer_id=$1)) ORDER BY a.created_at DESC LIMIT 100) _act) as activity
        `).bind(id).first<any>();

        if (consolidated && consolidated.customer) {
          const c = consolidated.customer;
          const inv = consolidated.invoices || [];
          const received = inv.reduce((a: number, x: any) => a + Number(x.paid || 0), 0);
          const invoiced = inv
            .filter((x: any) => x.status !== "Draft" && x.status !== "Cancelled")
            .reduce((a: number, x: any) => a + Number(x.grand_total || 0), 0);

          return Response.json({
            customer: { ...c, tags: c.tags ? (typeof c.tags === "string" ? JSON.parse(c.tags) : c.tags) : [] },
            contacts: consolidated.contacts || [],
            sites: consolidated.sites || [],
            leads: consolidated.leads || [],
            quotations: consolidated.quotes || [],
            invoices: inv.map((x: any) => ({
              ...x,
              balance: Math.max(0, Number(x.grand_total) - Number(x.paid)),
            })),
            projects: consolidated.projects || [],
            payments: consolidated.payments || [],
            warranties: consolidated.warranties || [],
            service: consolidated.service || [],
            amc: consolidated.amc || [],
            notes: consolidated.notes || [],
            documents: consolidated.docs || [],
            activity: consolidated.activity || [],
            summary: {
              sites: (consolidated.sites || []).length,
              quoted: (consolidated.quotes || []).reduce((a: number, x: any) => a + Number(x.total || 0), 0),
              accepted: (consolidated.quotes || [])
                .filter((x: any) => ["accepted", "won", "invoiced"].includes(String(x.status).toLowerCase()))
                .reduce((a: number, x: any) => a + Number(x.total || 0), 0),
              invoiced,
              received,
              pending: Math.max(0, invoiced - received),
              overdue: inv
                .filter((x: any) => x.status !== "Paid" && String(x.due_date || "9999") < new Date().toISOString().slice(0, 10))
                .reduce((a: number, x: any) => a + Math.max(0, Number(x.grand_total) - Number(x.paid)), 0),
              activeProjects: (consolidated.projects || []).filter((x: any) => x.status !== "Completed").length,
              completedProjects: (consolidated.projects || []).filter((x: any) => x.status === "Completed").length,
              openService: (consolidated.service || []).filter((x: any) => !["Closed", "Resolved", "Completed"].includes(String(x.status))).length,
            },
          });
        }
      } catch {}

      const c = await env.DB.prepare(
        "SELECT c.*,u.name assigned_name FROM customers c LEFT JOIN users u ON u.id=c.assigned_to WHERE c.id=?",
      )
        .bind(id)
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
          "SELECT q.*,s.name site_name FROM quotations q LEFT JOIN customer_sites s ON s.id=q.site_id WHERE q.customer_id=? ORDER BY q.created_at DESC",
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
    if (assigned) {
      where.push("c.assigned_to=?");
      args.push(assigned);
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
          p.assignedTo || u.id,
          p.status || "Prospect",
          p.notes || null,
          JSON.stringify(p.tags || []),
          now,
        )
        .first<{ id: number }>();
    const code = customerCode(row!.id);
    const contactId = crypto.randomUUID();

    // Run code update, contact insertion and audit log in parallel to save multiple network round-trips
    await Promise.all([
      env.DB.prepare("UPDATE customers SET customer_code=? WHERE id=?")
        .bind(code, row!.id)
        .run(),
      p.primaryContact
        ? env.DB.prepare(
            "INSERT INTO customer_contacts(id,customer_id,name,designation,phone,whatsapp,email,primary_contact,active,created_at,updated_at)VALUES(?,?,?,?,?,?,?,1,1,?,?)",
          )
            .bind(
              contactId,
              row!.id,
              p.primaryContact,
              p.primaryDesignation || null,
              p.phone,
              p.whatsapp || null,
              p.email || null,
              now,
              now,
            )
            .run()
        : Promise.resolve(),
      log(u.id, "customer_created", String(row!.id)),
    ]);

    const customerObj = {
      id: row!.id,
      customer_code: code,
      customerCode: code,
      customer_type: p.customerType || "Individual",
      name: p.name,
      display_name: p.displayName || p.name,
      primary_contact: p.primaryContact || p.name,
      phone: p.phone,
      whatsapp: p.whatsapp || null,
      email: p.email || null,
      alternate_phone: p.alternatePhone || null,
      gstin: p.gstin || null,
      pan: p.pan || null,
      billing_address: p.billingAddress || null,
      city: p.city || null,
      state: p.state || "Tamil Nadu",
      pincode: p.pincode || null,
      country: p.country || "India",
      lead_source: p.leadSource || null,
      assigned_to: p.assignedTo || u.id,
      assigned_name: u.name,
      status: p.status || "Prospect",
      notes: p.notes || null,
      tags: p.tags || [],
      archived: 0,
      created_at: now,
      invoiced: 0,
      received: 0,
      balance: 0,
      site_count: 0,
    };

    const detailObj = {
      customer: customerObj,
      contacts: p.primaryContact
        ? [
            {
              id: contactId,
              customer_id: row!.id,
              name: p.primaryContact,
              designation: p.primaryDesignation || null,
              phone: p.phone,
              whatsapp: p.whatsapp || null,
              email: p.email || null,
              primary_contact: 1,
              active: 1,
              created_at: now,
              updated_at: now,
            },
          ]
        : [],
      sites: [],
      leads: [],
      quotations: [],
      invoices: [],
      projects: [],
      payments: [],
      warranties: [],
      service: [],
      amc: [],
      notes: [],
      documents: [],
      activity: [
        {
          user_id: u.id,
          staff_name: u.name,
          action: "customer_created",
          entity_type: "customer",
          entity_id: String(row!.id),
          created_at: now,
        },
      ],
      summary: {
        sites: 0,
        quoted: 0,
        accepted: 0,
        invoiced: 0,
        received: 0,
        pending: 0,
        overdue: 0,
        activeProjects: 0,
        completedProjects: 0,
        openService: 0,
      },
    };

    return Response.json(
      { customer: customerObj, detail: detailObj },
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
        p.assignedTo || u.id,
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

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Customer ID is required" }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM customer_contacts WHERE customer_id=?").bind(id),
      env.DB.prepare("DELETE FROM customer_notes WHERE customer_id=?").bind(id),
      env.DB.prepare("DELETE FROM customer_sites WHERE customer_id=?").bind(id),
      env.DB.prepare("DELETE FROM attachments WHERE entity_type='customer' AND entity_id=?").bind(id),
      env.DB.prepare("DELETE FROM customers WHERE id=?").bind(id),
    ]);
    await log(user.id, "customer_deleted", String(id));
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to delete customer",
          },
          { status: 500 },
        );
  }
}
