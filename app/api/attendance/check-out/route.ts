import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import {
  calculateHaversineDistance,
  getAttendanceConfig,
  getISTDateString,
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

    // Validate geofence on server
    if (distanceMeters > config.geofenceRadiusMeters) {
      return Response.json(
        {
          error:
            "You are outside the office premises. Attendance can only be marked from the registered office location.",
          distanceMeters,
          permittedRadiusMeters: config.geofenceRadiusMeters,
          officeName: config.officeName,
        },
        { status: 400 }
      );
    }

    const today = getISTDateString();
    const nowServer = new Date();
    const serverTimestamp = nowServer.toISOString();

    // Check for existing check-in today
    const existing = await env.DB.prepare(
      "SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?"
    )
      .bind(user.id, today)
      .first<{
        id: string;
        check_in_time: string | null;
        check_out_time: string | null;
        status: string;
      }>();

    if (!existing || !existing.check_in_time) {
      return Response.json(
        {
          error:
            "An employee must not be able to check out without an existing check-in for today.",
        },
        { status: 400 }
      );
    }

    if (existing.check_out_time) {
      return Response.json(
        {
          error: "You have already checked out for today.",
          existingCheckOutTime: existing.check_out_time,
        },
        { status: 400 }
      );
    }

    // Calculate total working minutes
    const checkInDate = new Date(existing.check_in_time);
    const totalWorkingMinutes = Math.max(
      0,
      Math.round((nowServer.getTime() - checkInDate.getTime()) / 60000)
    );

    // Determine final status
    const minFullMinutes = config.minFullDayHours * 60;
    const minHalfMinutes = config.minHalfDayHours * 60;

    let finalStatus = existing.status;
    if (totalWorkingMinutes < minHalfMinutes) {
      finalStatus = "Half Day"; // short shift
    } else if (totalWorkingMinutes < minFullMinutes) {
      finalStatus = "Half Day";
    } else {
      // If was Late, remains Late; if Present, remains Present
      finalStatus = existing.status === "Late" ? "Late" : "Present";
    }

    await env.DB.prepare(
      `UPDATE attendance SET
        check_out_time = ?,
        check_out_latitude = ?,
        check_out_longitude = ?,
        check_out_distance_meters = ?,
        total_working_minutes = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?`
    )
      .bind(
        serverTimestamp,
        body.latitude,
        body.longitude,
        distanceMeters,
        totalWorkingMinutes,
        finalStatus,
        serverTimestamp,
        existing.id
      )
      .run();

    const updatedRecord = await env.DB.prepare(
      "SELECT * FROM attendance WHERE id = ?"
    )
      .bind(existing.id)
      .first();

    const hours = Math.floor(totalWorkingMinutes / 60);
    const mins = totalWorkingMinutes % 60;

    return Response.json({
      success: true,
      message: `Check-out recorded at ${nowServer.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}. Total working time: ${hours}h ${mins}m.`,
      status: finalStatus,
      totalWorkingMinutes,
      totalWorkingHoursFormatted: `${hours}h ${mins}m`,
      distanceMeters,
      record: updatedRecord,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to record check-out" },
      { status: 500 }
    );
  }
}
