import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import {
  calculateHaversineDistance,
  getAttendanceConfig,
  getISTDateString,
  getISTMinutesFromMidnight,
  parseTimeToMinutes,
} from "@/lib/attendance";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as {
      latitude?: number;
      longitude?: number;
    };

    if (
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number" ||
      isNaN(body.latitude) ||
      isNaN(body.longitude)
    ) {
      return Response.json(
        { error: "Valid GPS coordinates (latitude and longitude) are required." },
        { status: 400 }
      );
    }

    const config = await getAttendanceConfig();
    const distanceMeters = calculateHaversineDistance(
      body.latitude,
      body.longitude,
      config.latitude,
      config.longitude
    );

    const today = getISTDateString();
    const nowServer = new Date();
    const serverTimestamp = nowServer.toISOString();

    // Check for existing attendance today
    const existing = await env.DB.prepare(
      "SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?"
    )
      .bind(user.id, today)
      .first<{ id: string; check_in_time: string | null }>();

    if (existing && existing.check_in_time) {
      return Response.json(
        {
          error: "You have already marked attendance for today.",
          existingCheckInTime: existing.check_in_time,
        },
        { status: 400 }
      );
    }

    const status = "Present";
    const lateMinutes = 0;
    const id = existing?.id || `ATT-${today.replace(/-/g, "")}-${user.id.slice(0, 8)}`;

    if (existing) {
      await env.DB.prepare(
        `UPDATE attendance SET
          check_in_time = ?,
          check_in_latitude = ?,
          check_in_longitude = ?,
          check_in_distance_meters = ?,
          status = ?,
          late_minutes = 0,
          updated_at = ?
        WHERE id = ?`
      )
        .bind(
          serverTimestamp,
          body.latitude,
          body.longitude,
          distanceMeters,
          status,
          serverTimestamp,
          id
        )
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO attendance (
          id, employee_id, attendance_date, check_in_time,
          check_in_latitude, check_in_longitude, check_in_distance_meters,
          status, late_minutes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
        .bind(
          id,
          user.id,
          today,
          serverTimestamp,
          body.latitude,
          body.longitude,
          distanceMeters,
          status,
          serverTimestamp,
          serverTimestamp
        )
        .run();
    }

    const record = await env.DB.prepare("SELECT * FROM attendance WHERE id = ?")
      .bind(id)
      .first();

    return Response.json({
      success: true,
      message: `Marked present successfully at ${nowServer.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}. Location recorded.`,
      status,
      distanceMeters,
      mapsUrl: `https://www.google.com/maps?q=${body.latitude},${body.longitude}`,
      record,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to mark attendance" },
      { status: 500 }
    );
  }
}
