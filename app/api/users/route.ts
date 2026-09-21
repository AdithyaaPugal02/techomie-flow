import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLog, users } from "../../../db/schema";
import { hashPassword, randomToken, requireUser } from "../../../lib/auth";

export async function GET() {
  try {
    await requireUser(["admin"]);
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
    const admin = await requireUser(["admin"]);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "User ID is required" }, { status: 400 });
    if (id === admin.id) return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
    await getDb().delete(users).where(eq(users.id, id));
    await getDb().insert(auditLog).values({
      userId: admin.id,
      action: "user_deleted",
      entityType: "user",
      entityId: id,
      createdAt: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to delete user" }, { status: 500 });
  }
}
