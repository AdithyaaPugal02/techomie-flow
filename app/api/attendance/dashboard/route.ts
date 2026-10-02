import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import {
  getAttendanceConfig,
  getISTDateString,
  getISTMinutesFromMidnight,
  parseTimeToMinutes,
  getHolidaysMap,
} from "@/lib/attendance";

type AttendanceRecord = {
  id: string;
  employee_id: string;
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
  created_at: string;
  updated_at: string;
};

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const today = getISTDateString();
    const config = await getAttendanceConfig();
    const holidays = await getHolidaysMap();

    // Today's record for this employee
    const todayRecord = await env.DB.prepare(
      "SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?"
    )
      .bind(user.id, today)
      .first<AttendanceRecord>();

    // Selected month or current month (e.g. "2026-10")
    const month = url.searchParams.get("month") || today.slice(0, 7);

    // Records for this employee for the month
    const historyRows = (
      await env.DB.prepare(
        "SELECT * FROM attendance WHERE employee_id = ? AND attendance_date LIKE ? ORDER BY attendance_date DESC"
      )
        .bind(user.id, `${month}-%`)
        .all<AttendanceRecord>()
    ).results;

    // Calculate monthly statistics
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let totalWorkingMinutes = 0;

    const recordedDates = new Set<string>();
    for (const row of historyRows) {
      recordedDates.add(row.attendance_date);
      if (row.status === "Present" || row.status === "Late") {
        presentDays++;
        if (row.status === "Late") lateDays++;
      } else if (row.status === "Half Day") {
        halfDays++;
      }
      totalWorkingMinutes += row.total_working_minutes || 0;
    }

    // Calculate absent days for the month:
    // Only count days in the month that are <= today (or < today if today hasn't ended)
    // and are not weekly off (e.g., Sunday) and not configured holidays.
    const [yearNum, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const currentDayOfMonth =
      month === today.slice(0, 7) ? parseInt(today.slice(8, 10), 10) : daysInMonth;

    const closingMinutes = parseTimeToMinutes(config.standardClosingTime);
    const currentMinutesIST = getISTMinutesFromMidnight();
    const isTodayWorkdayEnded = currentMinutesIST >= closingMinutes;

    let absentDays = 0;
    for (let day = 1; day <= currentDayOfMonth; day++) {
      const dateStr = `${month}-${String(day).padStart(2, "0")}`;
      // Rule: Do not automatically mark an employee absent before the workday has ended
      if (dateStr === today && !isTodayWorkdayEnded) {
        continue;
      }

      // If already recorded, not absent
      if (recordedDates.has(dateStr)) continue;

      // Check if day of week is weekly off
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      const dayName = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
      }).format(d);

      if (config.weeklyOffDays.includes(dayName)) continue;
      if (holidays[dateStr]) continue;

      // Eligible working day with no attendance
      absentDays++;
    }

    const totalWorkingHours = +(totalWorkingMinutes / 60).toFixed(1);

    const enrichedToday = todayRecord
      ? {
          ...todayRecord,
          markedAtFormatted: todayRecord.check_in_time
            ? new Date(todayRecord.check_in_time).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : null,
          mapsUrl:
            todayRecord.check_in_latitude && todayRecord.check_in_longitude
              ? `https://www.google.com/maps?q=${todayRecord.check_in_latitude},${todayRecord.check_in_longitude}`
              : null,
        }
      : null;

    const enrichedHistory = historyRows.map((r) => ({
      ...r,
      markedAtFormatted: r.check_in_time
        ? new Date(r.check_in_time).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      mapsUrl:
        r.check_in_latitude && r.check_in_longitude
          ? `https://www.google.com/maps?q=${r.check_in_latitude},${r.check_in_longitude}`
          : null,
    }));

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      serverTime: new Date().toISOString(),
      todayDate: today,
      todayRecord: enrichedToday,
      config: {
        officeName: config.officeName,
        officeAddress: config.officeAddress,
        latitude: config.latitude,
        longitude: config.longitude,
        geofenceRadiusMeters: config.geofenceRadiusMeters,
        standardStartTime: config.standardStartTime,
        standardClosingTime: config.standardClosingTime,
        gracePeriodMinutes: config.gracePeriodMinutes,
        minFullDayHours: config.minFullDayHours,
        minHalfDayHours: config.minHalfDayHours,
      },
      stats: {
        month,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        totalWorkingMinutes,
        totalWorkingHours,
      },
      history: enrichedHistory,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
