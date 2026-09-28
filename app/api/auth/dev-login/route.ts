import { redirect } from "next/navigation";
import { setSession } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const host = req.headers.get("host") || "";
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.");
  if (!isLocal) {
    return new Response("Forbidden in production", { status: 403 });
  }

  try {
    const adminRows = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    const adminId = adminRows[0]?.id || "1b7ca933-76a2-4760-b549-c001b16d1ffe";
    await setSession(adminId);
  } catch (err) {
    console.error("Failed to query admin for dev login", err);
    await setSession("1b7ca933-76a2-4760-b549-c001b16d1ffe");
  }

  return redirect("/");
}
