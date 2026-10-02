import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import {
  getAttendanceConfig,
  getISTDateString,
  getISTMinutesFromMidnight,
  parseTimeToMinutes,
  getHolidaysMap,
  formatISTTime,
} from "@/lib/attendance";

type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_role: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_in_distance_meters: number | null;
  check_out_distance_meters: number | null;
  total_working_minutes: number;
  status: string;
  late_minutes: number;
  notes: string | null;
};

type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function GET(req: Request) {
  try {
    // Critical security constraint: Admin only!
    const user = await requireUser(["admin"]);
    const url = new URL(req.url);

    const today = getISTDateString();
    const month = url.searchParams.get("month") || today.slice(0, 7);
    const filterEmployeeId = url.searchParams.get("employeeId");
    const filterStatus = url.searchParams.get("status");
    const filterFrom = url.searchParams.get("from");
    const filterTo = url.searchParams.get("to");
    const format = url.searchParams.get("format");

    const config = await getAttendanceConfig();
    const holidays = await getHolidaysMap();

    // 1. Fetch all active employees
    const employees = (
      await env.DB.prepare(
        "SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY name ASC"
      ).all<EmployeeRow>()
    ).results;

    // 2. Fetch employees marked present today
    const currentlyPresentRows = (
      await env.DB.prepare(
        `SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
         FROM attendance a
         JOIN users u ON u.id = a.employee_id
         WHERE a.attendance_date = ? AND a.check_in_time IS NOT NULL`
      )
        .bind(today)
        .all<AttendanceRow>()
    ).results;

    // 3. Query all attendance records for the month or date range
    let sql = `
      SELECT a.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
      FROM attendance a
      JOIN users u ON u.id = a.employee_id
      WHERE 1=1
    `;
    const args: unknown[] = [];

    if (filterFrom && filterTo) {
      sql += " AND a.attendance_date >= ? AND a.attendance_date <= ?";
      args.push(filterFrom, filterTo);
    } else {
      sql += " AND a.attendance_date LIKE ?";
      args.push(`${month}-%`);
    }

    if (filterEmployeeId) {
      sql += " AND a.employee_id = ?";
      args.push(filterEmployeeId);
    }

    if (filterStatus) {
      sql += " AND a.status = ?";
      args.push(filterStatus);
    }

    sql += " ORDER BY a.attendance_date DESC, a.check_in_time DESC";

    const dailyRecords = (await env.DB.prepare(sql).bind(...args).all<AttendanceRow>()).results;

    // Format distance helper
    const formatDistance = (meters: number | null | undefined) => {
      if (meters === null || meters === undefined) return "No GPS";
      if (meters <= 100) return "< 100m (Office)";
      if (meters < 1000) return `${Math.round(meters)}m from office`;
      return `${(meters / 1000).toFixed(1)} km from office`;
    };

    // 7. Handle CSV Export
    if (format === "csv") {
      const esc = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
      const headers = [
        "Employee Name",
        "Employee Email",
        "Role",
        "Date",
        "Status",
        "Time Marked",
        "Latitude",
        "Longitude",
        "Distance From Office",
        "Google Maps Link",
      ];

      const csvRows = dailyRecords.map((r) => {
        const mapsUrl =
          r.check_in_latitude && r.check_in_longitude
            ? `https://www.google.com/maps?q=${r.check_in_latitude},${r.check_in_longitude}`
            : "";
        return [
          r.employee_name,
          r.employee_email,
          r.employee_role,
          r.attendance_date,
          r.status,
          formatISTTime(r.check_in_time),
          r.check_in_latitude ?? "",
          r.check_in_longitude ?? "",
          formatDistance(r.check_in_distance_meters),
          mapsUrl,
        ]
          .map(esc)
          .join(",");
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Techomie-Attendance-${month}.csv"`,
        },
      });
    }

    return Response.json({
      month,
      today,
      config: {
        officeName: config.officeName,
        officeAddress: config.officeAddress,
        geofenceRadiusMeters: config.geofenceRadiusMeters,
      },
      overview: {
        totalEmployees,
        totalPresentDays,
        totalAbsentDays,
        totalLateArrivals,
        averageWorkingHours: overallAverageWorkingHours,
        currentlyCheckedInCount: currentlyPresentRows.length,
        currentlyCheckedIn: currentlyPresentRows.map((r) => ({
          employeeId: r.employee_id,
          employeeName: r.employee_name,
          role: r.employee_role,
          checkInTime: r.check_in_time,
          checkInTimeFormatted: formatISTTime(r.check_in_time),
          latitude: r.check_in_latitude,
          longitude: r.check_in_longitude,
          distanceMeters: r.check_in_distance_meters,
          distanceFormatted: formatDistance(r.check_in_distance_meters),
          mapsUrl:
            r.check_in_latitude && r.check_in_longitude
              ? `https://www.google.com/maps?q=${r.check_in_latitude},${r.check_in_longitude}`
              : null,
          status: r.status,
        })),
      },
      employeeSummaries,
      dailyRecords: dailyRecords.map((r) => ({
        ...r,
        checkInTimeFormatted: formatISTTime(r.check_in_time),
        markedTimeFormatted: formatISTTime(r.check_in_time),
        latitude: r.check_in_latitude,
        longitude: r.check_in_longitude,
        distanceMeters: r.check_in_distance_meters,
        distanceFormatted: formatDistance(r.check_in_distance_meters),
        mapsUrl:
          r.check_in_latitude && r.check_in_longitude
            ? `https://www.google.com/maps?q=${r.check_in_latitude},${r.check_in_longitude}`
            : null,
      })),
      employeesList: employees,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load admin reports" },
      { status: 500 }
    );
  }
}
