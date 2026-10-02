import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { auditLog, sessions, users } from "../../../db/schema";
import { clearSession, hashPassword, randomToken, requireUser } from "../../../lib/auth";

export async function GET() {
  try {
    await requireUser(["admin", "crm", "sales", "technician"]);
    const rows = await getDb().select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      active: users.active,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    }).from(users);
    return Response.json({ users: rows });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: "Unable to load users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireUser(["admin"]);
    const p = await req.json() as {
      name?: string;
      email?: string;
      phone?: string;
      password?: string;
      role?: "admin" | "crm" | "sales" | "technician";
      active?: boolean;
    };
    if (!p.name?.trim() || !p.email?.includes("@") || (p.password?.length ?? 0) < 6 || !p.role) {
      return Response.json({ error: "Name, email, role and a password of at least 6 characters are required" }, { status: 400 });
    }
    const db = getDb(), id = crypto.randomUUID(), salt = randomToken(), now = new Date().toISOString();
    try {
      await db.insert(users).values({
        id,
        name: p.name.trim(),
        email: p.email.toLowerCase().trim(),
        phone: p.phone?.trim() || null,
        role: p.role,
        passwordSalt: salt,
        passwordHash: await hashPassword(p.password!, salt),
        active: typeof p.active === "boolean" ? p.active : true,
        createdAt: now,
      });
    } catch {
      return Response.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    await db.insert(auditLog).values({ userId: admin.id, action: "user_created", entityType: "user", entityId: id, createdAt: now });
    return Response.json({ user: { id, name: p.name, email: p.email, role: p.role, active: true } }, { status: 201 });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: "Unable to create user" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireUser(["admin"]);
    const p = await req.json() as {
      id?: string;
      name?: string;
      email?: string;
      phone?: string;
      active?: boolean;
      role?: "admin" | "crm" | "sales" | "technician";
      password?: string;
    };
    if (!p.id) return Response.json({ error: "User ID is required" }, { status: 400 });
    if (p.id === admin.id && (p.active === false || (p.role && p.role !== "admin"))) {
      return Response.json({ error: "You cannot deactivate or demote your own owner account" }, { status: 400 });
    }
    const changes: Record<string, unknown> = {};
    if (p.name && p.name.trim()) changes.name = p.name.trim();
    if (p.email && p.email.includes("@")) changes.email = p.email.toLowerCase().trim();
    if (typeof p.phone !== "undefined") changes.phone = p.phone?.trim() || null;
    if (typeof p.active === "boolean") changes.active = p.active;
    if (p.role) changes.role = p.role;
    if (p.password) {
      if (p.password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      const salt = randomToken();
      changes.passwordSalt = salt;
      changes.passwordHash = await hashPassword(p.password, salt);
    }
    if (!Object.keys(changes).length) return Response.json({ error: "No changes supplied" }, { status: 400 });
    try {
      await getDb().update(users).set(changes).where(eq(users.id, p.id));
    } catch (err: any) {
      if (String(err?.message || "").toLowerCase().includes("unique") || String(err?.message || "").toLowerCase().includes("email")) {
        return Response.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      throw err;
    }
    await getDb().insert(auditLog).values({
      userId: admin.id,
      action: "user_updated",
      entityType: "user",
      entityId: p.id,
      createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const caller = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "User ID is required" }, { status: 400 });

    const isSelf = id === caller.id;
    if (!isSelf && caller.role !== "admin") {
      return Response.json({ error: "Only administrators can delete other staff accounts" }, { status: 403 });
    }

    const db = getDb();
    const targetRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const target = targetRows[0];
    if (!target) return Response.json({ error: "User account not found" }, { status: 404 });

    // Safety guard: if deleting an admin account, ensure at least one other active admin remains
    if (target.role === "admin") {
      const allAdmins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (allAdmins.length <= 1) {
        return Response.json({
          error: "Cannot delete the sole administrator account. Please designate or create another admin first.",
        }, { status: 400 });
      }
    }

    // Safely reassign or clean up foreign key references across operational tables
    const cleanupOps: Array<{ sql: string; params: unknown[] }> = [
      // Direct deletes for user-specific activity records
      { sql: "DELETE FROM sessions WHERE user_id = ?", params: [id] },
      { sql: "DELETE FROM notifications WHERE user_id = ?", params: [id] },
      { sql: "DELETE FROM attendance WHERE employee_id = ?", params: [id] },
      { sql: "DELETE FROM project_team WHERE user_id = ?", params: [id] },
      { sql: "DELETE FROM training_submissions WHERE assignment_id IN (SELECT id FROM training_assignments WHERE user_id = ?)", params: [id] },
      { sql: "DELETE FROM training_checklist_progress WHERE assignment_id IN (SELECT id FROM training_assignments WHERE user_id = ?)", params: [id] },
      { sql: "DELETE FROM training_assignments WHERE user_id = ?", params: [id] },

      // Nullify optional assignments
      { sql: "UPDATE customers SET assigned_to = NULL WHERE assigned_to = ?", params: [id] },
      { sql: "UPDATE leads SET assigned_to = NULL WHERE assigned_to = ?", params: [id] },
      { sql: "UPDATE service_tickets SET assigned_to = NULL WHERE assigned_to = ?", params: [id] },
      { sql: "UPDATE project_tasks SET assigned_to = NULL WHERE assigned_to = ?", params: [id] },

      // Reassign operational history to caller (admin) so business records remain intact
      { sql: "UPDATE activities SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE attachments SET uploaded_by = ? WHERE uploaded_by = ?", params: [caller.id, id] },
      { sql: "UPDATE audit_log SET user_id = ? WHERE user_id = ?", params: [caller.id, id] },
      { sql: "UPDATE customer_notes SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE expense_history SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE expenses SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE expenses SET approved_by = ? WHERE approved_by = ?", params: [caller.id, id] },
      { sql: "UPDATE invoice_payments SET received_by = ? WHERE received_by = ?", params: [caller.id, id] },
      { sql: "UPDATE payments SET received_by = ? WHERE received_by = ?", params: [caller.id, id] },
      { sql: "UPDATE lead_followups SET assigned_to = ? WHERE assigned_to = ?", params: [caller.id, id] },
      { sql: "UPDATE lead_followups SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE leads SET lead_owner = ? WHERE lead_owner = ?", params: [caller.id, id] },
      { sql: "UPDATE leads SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE projects SET manager_id = ? WHERE manager_id = ?", params: [caller.id, id] },
      { sql: "UPDATE projects SET sales_id = ? WHERE sales_id = ?", params: [caller.id, id] },
      { sql: "UPDATE project_tasks SET assigned_by = ? WHERE assigned_by = ?", params: [caller.id, id] },
      { sql: "UPDATE quotation_files SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE quotation_revisions SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE quotations SET sales_id = ? WHERE sales_id = ?", params: [caller.id, id] },
      { sql: "UPDATE quotations SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE scope_variations SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE scope_variations SET approved_by = ? WHERE approved_by = ?", params: [caller.id, id] },
      { sql: "UPDATE service_tickets SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE settings SET updated_by = ? WHERE updated_by = ?", params: [caller.id, id] },
      { sql: "UPDATE site_visits SET assigned_to = ? WHERE assigned_to = ?", params: [caller.id, id] },
      { sql: "UPDATE site_visits SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE tax_adjustment_notes SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE tax_invoices SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE zoho_invoices SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_tasks SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_challenges SET user_id = ? WHERE user_id = ?", params: [caller.id, id] },
      { sql: "UPDATE training_challenge_comments SET user_id = ? WHERE user_id = ?", params: [caller.id, id] },
      { sql: "UPDATE training_challenge_attachments SET uploaded_by = ? WHERE uploaded_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_kb_articles SET created_by = ? WHERE created_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_status_history SET changed_by = ? WHERE changed_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_assignments SET assigned_by = ? WHERE assigned_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_assignments SET approved_by = ? WHERE approved_by = ?", params: [caller.id, id] },
      { sql: "UPDATE training_submissions SET reviewed_by = ? WHERE reviewed_by = ?", params: [caller.id, id] },
    ];

    for (const op of cleanupOps) {
      try {
        await env.DB.prepare(op.sql).bind(...op.params).run();
      } catch (err) {
        console.warn(`[user-delete] Non-fatal cleanup warning for query "${op.sql}":`, err);
      }
    }

    await db.delete(users).where(eq(users.id, id));
    await db.insert(auditLog).values({
      userId: caller.id,
      action: "user_deleted",
      entityType: "user",
      entityId: id,
      createdAt: new Date().toISOString(),
    });

    if (isSelf) {
      await clearSession();
    }

    return Response.json({ ok: true, selfDeleted: isSelf });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to delete user" }, { status: 500 });
  }
}
