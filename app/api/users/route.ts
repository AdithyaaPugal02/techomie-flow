import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLog, users } from "../../../db/schema";
import { hashPassword, randomToken, requireUser } from "../../../lib/auth";

export async function GET() {
  try {
    await requireUser(["admin"]);
    const rows = await getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active, lastLogin: users.lastLogin, createdAt: users.createdAt }).from(users);
    return Response.json({ users: rows });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: "Unable to load users" }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireUser(["admin"]);
    const p = await req.json() as { name?: string; email?: string; password?: string; role?: "admin" | "crm" | "sales" | "technician" };
    if (!p.name?.trim() || !p.email?.includes("@") || (p.password?.length ?? 0) < 10 || !p.role) return Response.json({ error: "Name, email, role and a password of at least 10 characters are required" }, { status: 400 });
    const db = getDb(), id = crypto.randomUUID(), salt = randomToken(), now = new Date().toISOString();
    try { await db.insert(users).values({ id, name: p.name.trim(), email: p.email.toLowerCase().trim(), role: p.role, passwordSalt: salt, passwordHash: await hashPassword(p.password!, salt), active: true, createdAt: now }); }
    catch { return Response.json({ error: "An account with this email already exists" }, { status: 409 }); }
    await db.insert(auditLog).values({ userId: admin.id, action: "user_created", entityType: "user", entityId: id, createdAt: now });
    return Response.json({ user: { id, name: p.name, email: p.email, role: p.role, active: true } }, { status: 201 });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: "Unable to create user" }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireUser(["admin"]);
    const p = await req.json() as { id?: string; active?: boolean; role?: "admin" | "crm" | "sales" | "technician"; password?: string };
    if (!p.id) return Response.json({ error: "User ID is required" }, { status: 400 });
    if (p.id === admin.id && (p.active === false || (p.role && p.role !== "admin"))) return Response.json({ error: "You cannot deactivate or demote your own owner account" }, { status: 400 });
    const changes: Record<string, unknown> = {};
    if (typeof p.active === "boolean") changes.active = p.active;
    if (p.role) changes.role = p.role;
    if (p.password) {
      if (p.password.length < 10) return Response.json({ error: "Password must be at least 10 characters" }, { status: 400 });
      const salt = randomToken(); changes.passwordSalt = salt; changes.passwordHash = await hashPassword(p.password, salt);
    }
    if (!Object.keys(changes).length) return Response.json({ error: "No changes supplied" }, { status: 400 });
    await getDb().update(users).set(changes).where(eq(users.id, p.id));
    await getDb().insert(auditLog).values({ userId: admin.id, action: "user_updated", entityType: "user", entityId: p.id, createdAt: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (e) { return e instanceof Response ? e : Response.json({ error: "Unable to update user" }, { status: 500 }); }
}
