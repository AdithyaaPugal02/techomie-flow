import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";
import {
  getAttendanceConfig,
  DEFAULT_ATTENDANCE_CONFIG,
  AttendanceConfig,
} from "@/lib/attendance";

export async function GET() {
  try {
    await requireUser();
    const config = await getAttendanceConfig();
    return Response.json({ config });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    // Admin only!
    const user = await requireUser(["admin"]);
    const body = (await req.json()) as Partial<AttendanceConfig>;

    if (!body.officeName || !body.officeAddress) {
      return Response.json(
        { error: "Office name and office address are required." },
        { status: 400 }
      );
    }

    if (
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number" ||
      isNaN(body.latitude) ||
      isNaN(body.longitude)
    ) {
      return Response.json(
        { error: "Valid latitude and longitude coordinates are required." },
        { status: 400 }
      );
    }

    const radius = Number(body.geofenceRadiusMeters);
    if (isNaN(radius) || radius <= 0) {
      return Response.json(
        { error: "Geofence radius must be a positive number in meters." },
        { status: 400 }
      );
    }

    const updatedConfig: AttendanceConfig = {
      officeName: String(body.officeName).trim(),
      officeAddress: String(body.officeAddress).trim(),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      geofenceRadiusMeters: radius,
      standardStartTime: String(body.standardStartTime || DEFAULT_ATTENDANCE_CONFIG.standardStartTime).trim(),
      standardClosingTime: String(body.standardClosingTime || DEFAULT_ATTENDANCE_CONFIG.standardClosingTime).trim(),
      gracePeriodMinutes: Math.max(0, Number(body.gracePeriodMinutes ?? 15)),
      minFullDayHours: Math.max(1, Number(body.minFullDayHours ?? 8)),
      minHalfDayHours: Math.max(1, Number(body.minHalfDayHours ?? 4)),
      weeklyOffDays: Array.isArray(body.weeklyOffDays) && body.weeklyOffDays.length > 0
        ? body.weeklyOffDays
        : ["Sunday"],
    };

    const now = new Date().toISOString();
    const jsonStr = JSON.stringify(updatedConfig);

    // Save into settings table
    const existing = await env.DB.prepare(
      "SELECT key FROM settings WHERE key = 'attendance_config'"
    ).first();

    if (existing) {
      await env.DB.prepare(
        "UPDATE settings SET value = ?, updated_by = ?, updated_at = ? WHERE key = 'attendance_config'"
      )
        .bind(jsonStr, user.id, now)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO settings (key, value, updated_by, updated_at) VALUES ('attendance_config', ?, ?, ?)"
      )
        .bind(jsonStr, user.id, now)
        .run();
    }

    return Response.json({
      success: true,
      message: "Attendance settings updated successfully.",
      config: updatedConfig,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
