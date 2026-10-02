import { env } from "cloudflare:workers";

export interface AttendanceConfig {
  officeName: string;
  officeAddress: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  standardStartTime: string; // e.g. "09:30"
  standardClosingTime: string; // e.g. "18:30"
  gracePeriodMinutes: number; // e.g. 15
  minFullDayHours: number; // e.g. 8
  minHalfDayHours: number; // e.g. 4
  weeklyOffDays: string[]; // e.g. ["Sunday"]
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  officeName: "Techomie Smart Devices - Head Office",
  officeAddress: "356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar, Coimbatore, Tamil Nadu 641048",
  latitude: 11.0526,
  longitude: 77.0189,
  geofenceRadiusMeters: 100,
  standardStartTime: "09:30",
  standardClosingTime: "18:30",
  gracePeriodMinutes: 15,
  minFullDayHours: 8,
  minHalfDayHours: 4,
  weeklyOffDays: ["Sunday"],
};

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius of Earth in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Returns current date string formatted as "YYYY-MM-DD" in Indian Standard Time (Asia/Kolkata).
 */
export function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // outputs "YYYY-MM-DD"
}

/**
 * Returns current minutes from midnight in Indian Standard Time (Asia/Kolkata).
 */
export function getISTMinutesFromMidnight(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hours = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hours * 60 + minutes;
}

/**
 * Parses time string like "09:30" or "18:00" to minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || "09:30").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Formats ISO string or Date to 12-hour IST time string like "09:35 AM".
 */
export function formatISTTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "--:--";
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "--:--";
  }
}

/**
 * Retrieves attendance configuration from settings table, falling back to defaults.
 */
export async function getAttendanceConfig(): Promise<AttendanceConfig> {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'attendance_config'"
    ).first<{ value: string | Record<string, unknown> }>();

    if (!row?.value) return DEFAULT_ATTENDANCE_CONFIG;

    const parsed =
      typeof row.value === "string" ? JSON.parse(row.value) : row.value;

    return {
      officeName: parsed.officeName || DEFAULT_ATTENDANCE_CONFIG.officeName,
      officeAddress: parsed.officeAddress || DEFAULT_ATTENDANCE_CONFIG.officeAddress,
      latitude: Number(parsed.latitude ?? DEFAULT_ATTENDANCE_CONFIG.latitude),
      longitude: Number(parsed.longitude ?? DEFAULT_ATTENDANCE_CONFIG.longitude),
      geofenceRadiusMeters: Number(
        parsed.geofenceRadiusMeters ?? DEFAULT_ATTENDANCE_CONFIG.geofenceRadiusMeters
      ),
      standardStartTime: parsed.standardStartTime || DEFAULT_ATTENDANCE_CONFIG.standardStartTime,
      standardClosingTime: parsed.standardClosingTime || DEFAULT_ATTENDANCE_CONFIG.standardClosingTime,
      gracePeriodMinutes: Number(
        parsed.gracePeriodMinutes ?? DEFAULT_ATTENDANCE_CONFIG.gracePeriodMinutes
      ),
      minFullDayHours: Number(
        parsed.minFullDayHours ?? DEFAULT_ATTENDANCE_CONFIG.minFullDayHours
      ),
      minHalfDayHours: Number(
        parsed.minHalfDayHours ?? DEFAULT_ATTENDANCE_CONFIG.minHalfDayHours
      ),
      weeklyOffDays: Array.isArray(parsed.weeklyOffDays)
        ? parsed.weeklyOffDays
        : DEFAULT_ATTENDANCE_CONFIG.weeklyOffDays,
    };
  } catch (err) {
    console.error("Error loading attendance config, using defaults:", err);
    return DEFAULT_ATTENDANCE_CONFIG;
  }
}

/**
 * Retrieves list of configured holidays as a set of "YYYY-MM-DD" dates.
 */
export async function getHolidaysMap(): Promise<Record<string, string>> {
  try {
    const rows = (
      await env.DB.prepare("SELECT date, name FROM attendance_holidays").all<{
        date: string;
        name: string;
      }>()
    ).results;
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.date] = r.name;
    }
    return map;
  } catch {
    return {};
  }
}
