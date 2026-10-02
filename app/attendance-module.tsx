"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./attendance.css";

type UserRole = "admin" | "sales" | "crm" | "technician" | string;

interface AttendanceModuleProps {
  role: UserRole;
  currentUser?: {
    id?: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface AttendanceRecord {
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
  total_working_minutes: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  checkInTimeFormatted?: string;
  markedAtFormatted?: string;
  markedTimeFormatted?: string;
  distanceFormatted?: string;
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceMeters?: number | null;
  employee_name?: string;
  employee_email?: string;
  employee_role?: string;
}

interface OfficeConfig {
  officeName: string;
  officeAddress: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  standardStartTime: string;
  standardClosingTime: string;
  gracePeriodMinutes: number;
  minFullDayHours: number;
  minHalfDayHours: number;
  weeklyOffDays?: string[];
}

interface MonthlyStats {
  month: string;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  totalWorkingMinutes: number;
  totalWorkingHours: number;
}

interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  totalHours: number;
  averageHours: number;
  recordsCount: number;
}

export default function AttendanceModule({
  role,
  currentUser,
}: AttendanceModuleProps) {
  const isAdmin = role === "admin";
  const [activeTab, setActiveTab] = useState<"dashboard" | "admin-reports" | "settings">("dashboard");

  // Live Clock
  const [liveTime, setLiveTime] = useState<string>("");
  const [liveDate, setLiveDate] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setLiveDate(
        now.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dashboard Data State
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [config, setConfig] = useState<OfficeConfig | null>(null);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [personalHistory, setPersonalHistory] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // GPS State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Haversine helper
  const computeDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, []);

  // Format distance helper
  const formatDist = useCallback((meters: number | null | undefined) => {
    if (meters === null || meters === undefined) return "Location recorded";
    if (meters <= 100) return "< 100m from office (At Office)";
    if (meters < 1000) return `${Math.round(meters)}m from office`;
    return `${(meters / 1000).toFixed(1)} km from office`;
  }, []);

  // Fetch GPS location
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser or device.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });
        if (config) {
          const dist = computeDistance(lat, lng, config.latitude, config.longitude);
          setCurrentDistance(dist);
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError("Location access denied. Please enable GPS permissions in browser settings.");
        } else if (err.code === 2) {
          setGpsError("Location unavailable. Please verify device GPS is active.");
        } else {
          setGpsError(`GPS timeout: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, [config, computeDistance]);

  // Load employee dashboard data
  const loadDashboard = useCallback(async (monthStr?: string) => {
    try {
      setLoading(true);
      const m = monthStr || selectedMonth;
      const res = await fetch(`/api/attendance/dashboard?month=${m}`);
      const data = await res.json();
      if (res.ok) {
        setTodayRecord(data.todayRecord);
        setConfig(data.config);
        setStats(data.stats);
        setPersonalHistory(data.history || []);
        if (data.config && currentCoords) {
          const dist = computeDistance(
            currentCoords.lat,
            currentCoords.lng,
            data.config.latitude,
            data.config.longitude
          );
          setCurrentDistance(dist);
        }
      } else {
        setNotice({ type: "error", msg: data.error || "Failed to load attendance" });
      }
    } catch {
      setNotice({ type: "error", msg: "Network error loading attendance dashboard" });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, currentCoords, computeDistance]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Auto-request location once config is ready
  useEffect(() => {
    if (config && !currentCoords && !gpsLoading) {
      refreshLocation();
    }
  }, [config, currentCoords, gpsLoading, refreshLocation]);

  // Mark Present handler
  const handleMarkPresent = async () => {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice({ type: "error", msg: "Geolocation is not supported by your browser." });
      return;
    }

    setActionLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await fetch("/api/attendance/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });
          const data = await res.json();
          if (res.ok) {
            setNotice({ type: "success", msg: data.message });
            loadDashboard();
            refreshLocation();
          } else {
            setNotice({ type: "error", msg: data.error || "Failed to mark attendance" });
          }
        } catch {
          setNotice({ type: "error", msg: "Network error during attendance submission" });
        } finally {
          setActionLoading(false);
        }
      },
      (err) => {
        setActionLoading(false);
        setNotice({
          type: "error",
          msg:
            err.code === 1
              ? "Location permission required. Please allow browser location access to mark attendance."
              : "Could not retrieve GPS coordinates. Please check your signal.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ================= ADMIN REPORTS STATE & HANDLERS =================
  const [adminMonth, setAdminMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [adminEmployeeFilter, setAdminEmployeeFilter] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("");
  const [adminFromDate, setAdminFromDate] = useState("");
  const [adminToDate, setAdminToDate] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminData, setAdminData] = useState<{
    overview: {
      totalEmployees: number;
      totalPresentDays: number;
      totalAbsentDays: number;
      totalLateArrivals: number;
      averageWorkingHours: number;
      currentlyCheckedInCount: number;
      currentlyCheckedIn: Array<{
        employeeId: string;
        employeeName: string;
        role: string;
        checkInTime: string;
        checkInTimeFormatted: string;
        latitude?: number | null;
        longitude?: number | null;
        distanceMeters?: number | null;
        distanceFormatted?: string;
        mapsUrl?: string | null;
        status: string;
      }>;
    };
    employeeSummaries: EmployeeSummary[];
    dailyRecords: AttendanceRecord[];
    employeesList: Array<{ id: string; name: string; email: string; role: string }>;
  } | null>(null);

  // Modal for employee detailed monthly history
  const [inspectedEmployee, setInspectedEmployee] = useState<EmployeeSummary | null>(null);
  const [inspectedHistory, setInspectedHistory] = useState<AttendanceRecord[]>([]);
  const [inspectedLoading, setInspectedLoading] = useState(false);

  const loadAdminReports = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setAdminLoading(true);
      const params = new URLSearchParams();
      params.set("month", adminMonth);
      if (adminEmployeeFilter) params.set("employeeId", adminEmployeeFilter);
      if (adminStatusFilter) params.set("status", adminStatusFilter);
      if (adminFromDate) params.set("from", adminFromDate);
      if (adminToDate) params.set("to", adminToDate);

      const res = await fetch(`/api/attendance/admin/reports?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setAdminData(d);
      } else {
        const d = await res.json();
        setNotice({ type: "error", msg: d.error || "Failed to load admin reports" });
      }
    } catch {
      setNotice({ type: "error", msg: "Network error loading admin reports" });
    } finally {
      setAdminLoading(false);
    }
  }, [isAdmin, adminMonth, adminEmployeeFilter, adminStatusFilter, adminFromDate, adminToDate]);

  useEffect(() => {
    if (activeTab === "admin-reports" && isAdmin) {
      loadAdminReports();
    }
  }, [activeTab, isAdmin, loadAdminReports]);

  // View employee detailed history in modal
  const handleInspectEmployee = async (emp: EmployeeSummary) => {
    setInspectedEmployee(emp);
    setInspectedLoading(true);
    try {
      const res = await fetch(`/api/attendance/history?employeeId=${emp.id}&month=${adminMonth}`);
      if (res.ok) {
        const d = await res.json();
        setInspectedHistory(d.records || []);
      }
    } catch {
      setInspectedHistory([]);
    } finally {
      setInspectedLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set("month", adminMonth);
    params.set("format", "csv");
    if (adminEmployeeFilter) params.set("employeeId", adminEmployeeFilter);
    if (adminStatusFilter) params.set("status", adminStatusFilter);
    if (adminFromDate) params.set("from", adminFromDate);
    if (adminToDate) params.set("to", adminToDate);

    window.open(`/api/attendance/admin/reports?${params.toString()}`, "_blank");
  };

  // Export PDF using html2pdf.js
  const reportPrintRef = useRef<HTMLDivElement>(null);
  const handleExportPDF = async () => {
    if (!reportPrintRef.current) return;
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Techomie-Attendance-${adminMonth}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      };
      html2pdf().set(opt).from(reportPrintRef.current).save();
    } catch (err) {
      console.error("PDF export error:", err);
      window.print();
    }
  };

  // ================= ADMIN SETTINGS STATE & HANDLERS =================
  const [settingsForm, setSettingsForm] = useState<OfficeConfig>({
    officeName: "",
    officeAddress: "",
    latitude: 11.0526,
    longitude: 77.0189,
    geofenceRadiusMeters: 100,
    standardStartTime: "09:30",
    standardClosingTime: "18:30",
    gracePeriodMinutes: 15,
    minFullDayHours: 8,
    minHalfDayHours: 4,
    weeklyOffDays: ["Sunday"],
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setSettingsForm({
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
        weeklyOffDays: config.weeklyOffDays || ["Sunday"],
      });
    }
  }, [config]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: "success", msg: "Office reference coordinates saved successfully!" });
        loadDashboard();
      } else {
        setNotice({ type: "error", msg: data.error || "Failed to update settings" });
      }
    } catch {
      setNotice({ type: "error", msg: "Network error saving settings" });
    } finally {
      setSettingsSaving(false);
    }
  };

  const isMarkedToday = Boolean(todayRecord && todayRecord.check_in_time);

  return (
    <div className="att-container">
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              notice.type === "success"
                ? "rgba(0, 210, 106, 0.15)"
                : notice.type === "info"
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border:
              notice.type === "success"
                ? "1px solid rgba(0, 210, 106, 0.4)"
                : notice.type === "info"
                ? "1px solid rgba(59, 130, 246, 0.4)"
                : "1px solid rgba(239, 68, 68, 0.4)",
            color:
              notice.type === "success"
                ? "#00d26a"
                : notice.type === "info"
                ? "#60a5fa"
                : "#ef4444",
          }}
        >
          <span>{notice.msg}</span>
          <button
            onClick={() => setNotice(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="att-header">
        <div className="att-title-box">
          <h1>
            <span>🕒</span> Employee Attendance
          </h1>
          <p>
            One-click attendance recording with automatic location capture for Techomie Smart Devices.
          </p>
        </div>

        <div className="att-tabs">
          <button
            type="button"
            className={`att-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span>My Attendance</span>
          </button>

          {/* CRITICAL: Admin-only Reports and Settings tabs */}
          {isAdmin && (
            <>
              <button
                type="button"
                className={`att-tab-btn ${activeTab === "admin-reports" ? "active" : ""}`}
                onClick={() => setActiveTab("admin-reports")}
              >
                <span>Admin Reports</span>
                {adminData?.overview?.currentlyCheckedInCount ? (
                  <span className="att-tab-badge">
                    {adminData.overview.currentlyCheckedInCount} Present Today
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className={`att-tab-btn ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span>Office Location Settings</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: EMPLOYEE ATTENDANCE DASHBOARD */}
      {activeTab === "dashboard" && (
        <>
          {/* Top Hero Section: Punch-In & Location Card */}
          <div className="att-hero-grid">
            {/* Left: Live Clock & Action Card */}
            <div className="att-card att-punch-card">
              <div className="att-live-date">{liveDate || "Loading date..."}</div>
              <div className="att-live-clock">{liveTime || "--:--:--"}</div>

              {/* Status Pill */}
              <div className={`att-status-pill ${isMarkedToday ? "present" : "not-checked-in"}`}>
                {isMarkedToday ? "✓ Marked Present for Today" : "○ Not Marked Yet Today"}
              </div>

              {/* Big Action Button */}
              <div className="att-action-btn-box">
                {!isMarkedToday ? (
                  <button
                    type="button"
                    className="att-punch-btn check-in"
                    onClick={handleMarkPresent}
                    disabled={actionLoading || loading}
                  >
                    <span>{actionLoading ? "Capturing Location..." : "📍 Mark Present"}</span>
                  </button>
                ) : (
                  <button type="button" className="att-punch-btn done" disabled>
                    <span>✓ Marked Present Today</span>
                  </button>
                )}
              </div>

              {/* Today's Punch Information */}
              <div className="att-today-times" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="att-time-cell">
                  <span>Time Marked</span>
                  <strong>
                    {todayRecord?.markedAtFormatted ||
                      (todayRecord?.check_in_time
                        ? new Date(todayRecord.check_in_time).toLocaleTimeString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "Not Yet Marked")}
                  </strong>
                </div>

                <div className="att-time-cell">
                  <span>Status</span>
                  <strong style={{ color: isMarkedToday ? "#00d26a" : "#8fa0bc" }}>
                    {isMarkedToday ? "Present" : "Pending"}
                  </strong>
                </div>
              </div>

              {/* If marked today, show Google Maps Link directly */}
              {isMarkedToday && todayRecord?.mapsUrl && (
                <div style={{ marginTop: "16px", width: "100%" }}>
                  <a
                    href={todayRecord.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="att-btn"
                    style={{
                      justifyContent: "center",
                      background: "rgba(59, 130, 246, 0.15)",
                      borderColor: "rgba(59, 130, 246, 0.4)",
                      color: "#60a5fa",
                      textDecoration: "none",
                    }}
                  >
                    <span>📍 View My Location on Google Maps</span>
                  </a>
                </div>
              )}
            </div>

            {/* Right: GPS Location Status Card */}
            <div className="att-card att-location-card">
              <div>
                <div className="att-loc-header">
                  <div>
                    <h3>
                      <span>⌖</span> GPS Location Capture
                    </h3>
                    <p>Mark attendance from anywhere — office, field site, or client premises.</p>
                  </div>
                  <button
                    type="button"
                    className="att-refresh-gps-btn"
                    onClick={refreshLocation}
                    disabled={gpsLoading}
                  >
                    <span>{gpsLoading ? "Acquiring..." : "↻ Refresh GPS"}</span>
                  </button>
                </div>

                {/* Status Banner */}
                {gpsLoading ? (
                  <div className="att-geofence-banner locating">
                    <div className="att-geofence-icon">⏳</div>
                    <div className="att-geofence-info">
                      <h4>Detecting current GPS coordinates...</h4>
                      <p>Acquiring device satellite and network coordinates.</p>
                    </div>
                  </div>
                ) : gpsError ? (
                  <div className="att-geofence-banner out-range">
                    <div className="att-geofence-icon">⚠</div>
                    <div className="att-geofence-info">
                      <h4>Location Permission Required</h4>
                      <p>{gpsError}</p>
                    </div>
                  </div>
                ) : currentCoords ? (
                  <div className="att-geofence-banner in-range">
                    <div className="att-geofence-icon">✓</div>
                    <div className="att-geofence-info">
                      <h4>GPS Coordinates Active</h4>
                      <p>
                        Current position: {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)} ({formatDist(currentDistance)}).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="att-geofence-banner locating">
                    <div className="att-geofence-icon">📍</div>
                    <div className="att-geofence-info">
                      <h4>Ready to Mark Present</h4>
                      <p>Click "Mark Present" to record your attendance and location.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Office & Coordinates Details */}
              <div className="att-office-meta">
                <div className="att-meta-row">
                  <span>Company Office:</span>
                  <strong>{config?.officeName || "Techomie Smart Devices"}</strong>
                </div>
                <div className="att-meta-row">
                  <span>Office Address:</span>
                  <strong>{config?.officeAddress || "Cheran ma Nagar, Coimbatore"}</strong>
                </div>
                <div className="att-meta-row">
                  <span>My Detected GPS:</span>
                  <strong>
                    {currentCoords
                      ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}`
                      : "Click Refresh GPS"}
                  </strong>
                </div>
                <div className="att-meta-row">
                  <span>Distance:</span>
                  <strong style={{ color: "#60a5fa" }}>{formatDist(currentDistance)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly KPI Stats Cards */}
          <div className="att-stats-grid">
            <div className="att-stat-card">
              <div className="att-stat-icon green">✓</div>
              <div className="att-stat-content">
                <h4>Present Days</h4>
                <b>{stats?.presentDays ?? 0}</b>
              </div>
            </div>

            <div className="att-stat-card">
              <div className="att-stat-icon red">✕</div>
              <div className="att-stat-content">
                <h4>Days Absent</h4>
                <b>{stats?.absentDays ?? 0}</b>
              </div>
            </div>

            <div className="att-stat-card">
              <div className="att-stat-icon blue">📅</div>
              <div className="att-stat-content">
                <h4>Selected Month</h4>
                <b style={{ fontSize: "16px" }}>{selectedMonth}</b>
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="att-section-header">
            <h3>My Attendance History</h3>
            <div className="att-controls-row">
              <label style={{ fontSize: "12px", color: "#8fa0bc" }}>Month:</label>
              <input
                type="month"
                className="att-input"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  loadDashboard(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="att-table-wrapper">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Time Marked</th>
                  <th>Distance from Office</th>
                  <th>Location / Google Maps</th>
                </tr>
              </thead>
              <tbody>
                {personalHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#8fa0bc", padding: "30px" }}>
                      No attendance records found for {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  personalHistory.map((rec) => {
                    const mapsUrl =
                      rec.mapsUrl ||
                      (rec.check_in_latitude && rec.check_in_longitude
                        ? `https://www.google.com/maps?q=${rec.check_in_latitude},${rec.check_in_longitude}`
                        : null);

                    return (
                      <tr key={rec.id}>
                        <td>
                          <strong>{rec.attendance_date}</strong>
                        </td>
                        <td>
                          <span className="att-tag present">
                            {rec.status || "Present"}
                          </span>
                        </td>
                        <td>
                          {rec.markedAtFormatted ||
                            (rec.check_in_time
                              ? new Date(rec.check_in_time).toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })
                              : "--:--")}
                        </td>
                        <td>
                          {rec.check_in_distance_meters !== null ? (
                            <span>{formatDist(rec.check_in_distance_meters)}</span>
                          ) : (
                            <span style={{ color: "#8fa0bc" }}>-</span>
                          )}
                        </td>
                        <td>
                          {mapsUrl ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="att-btn"
                              style={{
                                display: "inline-flex",
                                padding: "4px 10px",
                                fontSize: "11px",
                                textDecoration: "none",
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                                borderColor: "rgba(59, 130, 246, 0.3)",
                              }}
                            >
                              📍 View on Map
                            </a>
                          ) : (
                            <span style={{ color: "#8fa0bc" }}>No GPS</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: ADMIN REPORTS & ANALYTICS (ADMIN ONLY) */}
      {activeTab === "admin-reports" && isAdmin && (
        <>
          {/* Employees Marked Present Today Strip */}
          <div className="att-active-strip">
            <div className="att-pulse-title">
              <span className="att-pulse-dot" />
              <span>
                {adminData?.overview?.currentlyCheckedInCount ?? 0} Employee
                {(adminData?.overview?.currentlyCheckedInCount ?? 0) === 1 ? "" : "s"} Marked Present Today:
              </span>
            </div>
            <div className="att-avatars-list">
              {!adminData?.overview?.currentlyCheckedIn?.length ? (
                <span style={{ color: "#8fa0bc", fontSize: "13px" }}>No employees have marked present yet today.</span>
              ) : (
                adminData.overview.currentlyCheckedIn.map((item) => (
                  <div key={item.employeeId} className="att-chip">
                    <b>{item.employeeName}</b>
                    <small>({item.role})</small>
                    <span style={{ color: "#00d26a" }}>• @ {item.checkInTimeFormatted}</span>
                    <span style={{ color: "#8fa0bc" }}>({item.distanceFormatted || "On Site"})</span>
                    {item.mapsUrl && (
                      <a
                        href={item.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View exact location on Google Maps"
                        style={{ color: "#60a5fa", textDecoration: "none", marginLeft: "4px" }}
                      >
                        📍 Map
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin KPI Overview Cards */}
          <div className="att-stats-grid">
            <div className="att-stat-card">
              <div className="att-stat-icon blue">👥</div>
              <div className="att-stat-content">
                <h4>Total Employees</h4>
                <b>{adminData?.overview?.totalEmployees ?? 0}</b>
              </div>
            </div>

            <div className="att-stat-card">
              <div className="att-stat-icon green">✓</div>
              <div className="att-stat-content">
                <h4>Total Present Days</h4>
                <b>{adminData?.overview?.totalPresentDays ?? 0}</b>
              </div>
            </div>

            <div className="att-stat-card">
              <div className="att-stat-icon red">✕</div>
              <div className="att-stat-content">
                <h4>Total Absent Days</h4>
                <b>{adminData?.overview?.totalAbsentDays ?? 0}</b>
              </div>
            </div>

            <div className="att-stat-card">
              <div className="att-stat-icon purple">📍</div>
              <div className="att-stat-content">
                <h4>Marked Today</h4>
                <b>{adminData?.overview?.currentlyCheckedInCount ?? 0}</b>
              </div>
            </div>
          </div>

          {/* Filter Bar & Export Actions */}
          <div className="att-section-header">
            <h3>Employee Monthly Summary</h3>
            <div className="att-controls-row">
              <input
                type="month"
                className="att-input"
                value={adminMonth}
                onChange={(e) => setAdminMonth(e.target.value)}
              />
              <button type="button" className="att-btn" onClick={handleExportCSV}>
                <span>⬇ Export CSV</span>
              </button>
              <button type="button" className="att-btn att-btn-primary" onClick={handleExportPDF}>
                <span>📄 Export PDF</span>
              </button>
            </div>
          </div>

          {/* Employee-Wise Summary Table */}
          <div className="att-table-wrapper">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Present Days</th>
                  <th>Absent Days</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {adminLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "#8fa0bc" }}>
                      Loading employee attendance report...
                    </td>
                  </tr>
                ) : !adminData?.employeeSummaries?.length ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "#8fa0bc" }}>
                      No employee data found for {adminMonth}.
                    </td>
                  </tr>
                ) : (
                  adminData.employeeSummaries.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleInspectEmployee(emp)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#60a5fa",
                            fontWeight: 700,
                            cursor: "pointer",
                            textAlign: "left",
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          {emp.name}
                        </button>
                        <br />
                        <small style={{ color: "#8fa0bc" }}>{emp.email}</small>
                      </td>
                      <td>
                        <span className="att-tag" style={{ background: "rgba(255,255,255,0.08)", color: "#cbd5e1" }}>
                          {emp.role}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#00d26a" }}>{emp.present}</strong>
                      </td>
                      <td>
                        <strong style={{ color: "#ef4444" }}>{emp.absent}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="att-btn"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => handleInspectEmployee(emp)}
                        >
                          View Locations & Logs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Daily Attendance Detailed Log with Location & Maps */}
          <div className="att-section-header" style={{ marginTop: "24px" }}>
            <h3>Daily Attendance & Location Log</h3>
            <div className="att-controls-row">
              <select
                className="att-select"
                value={adminEmployeeFilter}
                onChange={(e) => setAdminEmployeeFilter(e.target.value)}
              >
                <option value="">All Employees</option>
                {adminData?.employeesList?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="att-input"
                placeholder="From Date"
                value={adminFromDate}
                onChange={(e) => setAdminFromDate(e.target.value)}
              />
              <input
                type="date"
                className="att-input"
                placeholder="To Date"
                value={adminToDate}
                onChange={(e) => setAdminToDate(e.target.value)}
              />
              {(adminEmployeeFilter || adminFromDate || adminToDate) && (
                <button
                  type="button"
                  className="att-btn"
                  onClick={() => {
                    setAdminEmployeeFilter("");
                    setAdminFromDate("");
                    setAdminToDate("");
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="att-table-wrapper">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Time Marked</th>
                  <th>Status</th>
                  <th>Distance from Office</th>
                  <th>Captured Location & Maps</th>
                </tr>
              </thead>
              <tbody>
                {!adminData?.dailyRecords?.length ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#8fa0bc" }}>
                      No daily records found matching filters.
                    </td>
                  </tr>
                ) : (
                  adminData.dailyRecords.map((r) => {
                    const mapsUrl =
                      r.mapsUrl ||
                      (r.check_in_latitude && r.check_in_longitude
                        ? `https://www.google.com/maps?q=${r.check_in_latitude},${r.check_in_longitude}`
                        : null);

                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.employee_name}</strong>
                          <br />
                          <small style={{ color: "#8fa0bc" }}>{r.employee_role}</small>
                        </td>
                        <td>{r.attendance_date}</td>
                        <td>
                          <b>{r.markedTimeFormatted || r.checkInTimeFormatted || "--:--"}</b>
                        </td>
                        <td>
                          <span className="att-tag present">
                            {r.status || "Present"}
                          </span>
                        </td>
                        <td>
                          <span>{r.distanceFormatted || formatDist(r.check_in_distance_meters)}</span>
                        </td>
                        <td>
                          {mapsUrl ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="att-btn"
                              style={{
                                display: "inline-flex",
                                padding: "4px 10px",
                                fontSize: "11px",
                                textDecoration: "none",
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "#60a5fa",
                                borderColor: "rgba(59, 130, 246, 0.3)",
                              }}
                            >
                              📍 Open in Google Maps
                            </a>
                          ) : (
                            <span style={{ color: "#8fa0bc" }}>No Location Captured</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Printable HTML Container for PDF Export */}
          <div style={{ display: "none" }}>
            <div id="attendance-report-print" ref={reportPrintRef} style={{ padding: "20px", color: "#000" }}>
              <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
                <h2 style={{ margin: "0 0 6px 0", color: "#0b111e" }}>TECHOMIE SMART DEVICES</h2>
                <h3 style={{ margin: "0 0 4px 0", color: "#475569" }}>Monthly Employee Attendance & Location Report</h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                  Month: {adminMonth} • Generated on {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>Total Employees: <b>{adminData?.overview?.totalEmployees ?? 0}</b></div>
                <div>Total Present: <b style={{ color: "green" }}>{adminData?.overview?.totalPresentDays ?? 0}</b></div>
                <div>Total Absent: <b style={{ color: "red" }}>{adminData?.overview?.totalAbsentDays ?? 0}</b></div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Employee</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Role</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Present Days</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "6px" }}>Absent Days</th>
                  </tr>
                </thead>
                <tbody>
                  {adminData?.employeeSummaries?.map((s) => (
                    <tr key={s.id}>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{s.name}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{s.role}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{s.present}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px" }}>{s.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: OFFICE LOCATION SETTINGS (ADMIN ONLY) */}
      {activeTab === "settings" && isAdmin && (
        <div className="att-card">
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#fff" }}>
              Registered Office Reference Location
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#8fa0bc" }}>
              These coordinates serve as the central reference point to calculate each employee's distance (e.g. at office vs on client site).
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="att-settings-form">
            <div className="att-form-grid">
              <div className="att-form-group">
                <label>Office Name *</label>
                <input
                  type="text"
                  required
                  value={settingsForm.officeName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, officeName: e.target.value })}
                />
              </div>

              <div className="att-form-group">
                <label>Office Reference Latitude *</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={settingsForm.latitude}
                  onChange={(e) => setSettingsForm({ ...settingsForm, latitude: Number(e.target.value) })}
                />
              </div>

              <div className="att-form-group">
                <label>Office Reference Longitude *</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={settingsForm.longitude}
                  onChange={(e) => setSettingsForm({ ...settingsForm, longitude: Number(e.target.value) })}
                />
              </div>

              <div className="att-form-group full">
                <label>Office Physical Address *</label>
                <textarea
                  rows={2}
                  required
                  value={settingsForm.officeAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, officeAddress: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <button
                type="submit"
                className="att-btn att-btn-primary"
                disabled={settingsSaving}
                style={{ padding: "12px 24px" }}
              >
                <span>{settingsSaving ? "Saving..." : "Save Office Reference"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Employee Detailed Monthly History with Location Map (Admin only) */}
      {inspectedEmployee && (
        <div className="att-modal-overlay" onClick={() => setInspectedEmployee(null)}>
          <div className="att-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="att-modal-header">
              <div>
                <h3>{inspectedEmployee.name} — Attendance & Locations</h3>
                <small style={{ color: "#8fa0bc" }}>
                  {inspectedEmployee.email} • {inspectedEmployee.role} • Month: {adminMonth}
                </small>
              </div>
              <button
                type="button"
                className="att-modal-close"
                onClick={() => setInspectedEmployee(null)}
              >
                ×
              </button>
            </div>

            <div className="att-modal-body">
              {inspectedLoading ? (
                <p style={{ textAlign: "center", color: "#8fa0bc", padding: "20px" }}>
                  Loading attendance records...
                </p>
              ) : inspectedHistory.length === 0 ? (
                <p style={{ textAlign: "center", color: "#8fa0bc", padding: "20px" }}>
                  No attendance records recorded for this employee in {adminMonth}.
                </p>
              ) : (
                <table className="att-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Time Marked</th>
                      <th>Distance from Office</th>
                      <th>Google Maps Pin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectedHistory.map((rec) => {
                      const mapsUrl =
                        rec.mapsUrl ||
                        (rec.check_in_latitude && rec.check_in_longitude
                          ? `https://www.google.com/maps?q=${rec.check_in_latitude},${rec.check_in_longitude}`
                          : null);

                      return (
                        <tr key={rec.id}>
                          <td>
                            <strong>{rec.attendance_date}</strong>
                          </td>
                          <td>
                            <span className="att-tag present">
                              {rec.status || "Present"}
                            </span>
                          </td>
                          <td>
                            {rec.check_in_time
                              ? new Date(rec.check_in_time).toLocaleTimeString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })
                              : "--:--"}
                          </td>
                          <td>
                            {rec.check_in_distance_meters !== null ? (
                              <span>{formatDist(rec.check_in_distance_meters)}</span>
                            ) : (
                              <span style={{ color: "#8fa0bc" }}>-</span>
                            )}
                          </td>
                          <td>
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="att-btn"
                                style={{
                                  display: "inline-flex",
                                  padding: "4px 10px",
                                  fontSize: "11px",
                                  textDecoration: "none",
                                  background: "rgba(59, 130, 246, 0.15)",
                                  color: "#60a5fa",
                                  borderColor: "rgba(59, 130, 246, 0.3)",
                                }}
                              >
                                📍 View Location on Map
                              </a>
                            ) : (
                              <span style={{ color: "#8fa0bc" }}>No GPS</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
