import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import { getISTDateString } from "@/lib/attendance";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);

    let targetEmployeeId = user.id;
    const requestedEmployeeId = url.searchParams.get("employeeId");

    if (requestedEmployeeId && requestedEmployeeId !== user.id) {
      if (user.role !== "admin") {
        return Response.json(
          { error: "Access denied. Employees can view only their own attendance records." },
          { status: 403 }
        );
      }
      targetEmployeeId = requestedEmployeeId;
    }

    const month = url.searchParams.get("month") || getISTDateString().slice(0, 7);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let sql =
      "SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role FROM attendance a JOIN users u ON u.id = a.employee_id WHERE a.employee_id = ?";
    const args: unknown[] = [targetEmployeeId];

    if (from && to) {
      sql += " AND a.attendance_date >= ? AND a.attendance_date <= ?";
      args.push(from, to);
    } else if (month) {
      sql += " AND a.attendance_date LIKE ?";
      args.push(`${month}-%`);
    }

    sql += " ORDER BY a.attendance_date DESC";

    const records = (await env.DB.prepare(sql).bind(...args).all()).results;

    return Response.json({
      employeeId: targetEmployeeId,
      month,
      records,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load history" },
      { status: 500 }
    );
  }
}
