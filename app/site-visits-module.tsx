"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type R = Record<string, any>;

const dt = (v: any) => (v ? new Date(v).toLocaleString("en-IN") : "—");

const DEFAULT_ROOM_PRESETS = [
  "Entrance / Foyer",
  "Living Room",
  "Dining Area",
  "Master Bedroom",
  "Bedroom 2",
  "Kitchen",
  "Balcony",
  "Home Theater",
  "Terrace / Outdoor",
];

const MODULE_OPTIONS = [
  "2M",
  "3M",
  "4M",
  "6M",
  "8M Horizontal",
  "8M Square",
  "12M",
  "16M",
  "18M",
];

const GATE_TYPES = [
  "Sliding Gate",
  "Swing Gate (Dual Leaf)",
  "Swing Gate (Single Leaf)",
  "Telescopic Gate",
  "Cantilever Gate",
  "Boom Barrier",
];

const GATE_WEIGHT_PRESETS = ["400kg", "600kg", "800kg", "1200kg", "1600kg", "2000kg"];

const emptySurvey: R = {
  visitType: "Initial Survey",
  purpose: "",
  gateAutomation: {
    enabled: false,
    gateType: "Sliding Gate",
    dimensions: { lengthFt: 16, heightFt: 6, weightKg: "800kg" },
    powerAtPillar: "Yes - Available",
    trackLengthMeters: 5,
    accessories: {
      remotesCount: 2,
      photocellSensors: true,
      flashingLamp: true,
      wifiController: true,
      electricLock: false,
      notes: "",
    },
  },
  walkthroughRooms: [
    {
      id: "rm-foyer",
      name: "Entrance / Foyer",
      floor: "Ground Floor",
      doorLock: {
        required: true,
        doorType: "Wooden (35-50mm)",
        features: ["Fingerprint", "PIN Code", "RFID Card", "Mobile App Unlock"],
        notes: "Main wooden entrance door",
      },
      switchboards: [
        {
          id: "sb-1",
          name: "Main Entrance Board",
          moduleSize: "4M",
          switches: 2,
          fans: 0,
          hvSwitches: 0,
          plugs5A: 1,
          plugs16A: 0,
          finish: "Glass Touch",
          notes: "Entry lighting & master scene",
        },
      ],
      curtains: { required: false, trackType: "Single Track", lengthFt: 0, powerPointNearTrack: false },
      sensors: { motionPir: true, presenceRadar: false, doorSensor: true, gasSensor: false },
    },
    {
      id: "rm-living",
      name: "Living Room",
      floor: "Ground Floor",
      doorLock: { required: false },
      switchboards: [
        {
          id: "sb-2",
          name: "Living Room Entry",
          moduleSize: "8M Horizontal",
          switches: 4,
          fans: 1,
          hvSwitches: 1,
          plugs5A: 1,
          plugs16A: 0,
          finish: "Glass Touch",
          notes: "Main lights, fan speed and AC point",
        },
        {
          id: "sb-3",
          name: "TV & Entertainment Unit",
          moduleSize: "6M",
          switches: 2,
          fans: 0,
          hvSwitches: 0,
          plugs5A: 2,
          plugs16A: 1,
          finish: "Glass Touch",
          notes: "Media & soundbar power sockets",
        },
      ],
      curtains: {
        required: true,
        trackType: "Dual Track (Sheer + Main)",
        lengthFt: 14,
        powerPointNearTrack: true,
        notes: "French window curtains",
      },
      sensors: { motionPir: false, presenceRadar: true, doorSensor: false, gasSensor: false },
    },
  ],
  checklist: [],
  items: [],
  customerPreferences: "",
  electrical: { neutralWire: "Available in all boards", dbSpace: "Adequate", earthing: "Good", powerBackup: "UPS Inverter" },
  network: { isp: "Airtel Fiber", routerLocation: "Living Room", coverage: "Good on Ground Floor", cabling: "CAT6" },
  readiness: { civil: "Completed", electrical: "Concealed Conduit Done", internet: "Active", access: "Permitted" },
  recommendations: "",
};

export default function SiteVisitsModule({
  role,
  initialFilter = {},
  onNavigate,
}: {
  role: string;
  initialFilter?: R;
  onNavigate?: (target: string, filter?: R) => void;
}) {
  const [rows, setRows] = useState<R[]>([]);
  const [leads, setLeads] = useState<R[]>([]);
  const [users, setUsers] = useState<R[]>([]);
  const [selected, setSelected] = useState<string | null>(initialFilter.id || null);
  const [detail, setDetail] = useState<R | null>(null);
  const [files, setFiles] = useState<R[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [show, setShow] = useState(initialFilter.create === "1");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/site-visits?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to load visits (${r.status})`);
        return;
      }
      const d = await r.json();
      setRows(d.visits || []);
      setLeads(d.leads || []);
      setUsers(d.users || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to connect to server");
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 120);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (id: string) => {
    setSelected(id);
    try {
      const r = await fetch(`/api/site-visits?id=${encodeURIComponent(id)}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to open visit (${r.status})`);
        return;
      }
      const d = await r.json();
      if (r.ok && d.visit) {
      const mergedSurvey = {
        ...emptySurvey,
        ...(d.visit.survey || {}),
        gateAutomation: {
          ...emptySurvey.gateAutomation,
          ...(d.visit.survey?.gateAutomation || {}),
          dimensions: {
            ...emptySurvey.gateAutomation.dimensions,
            ...(d.visit.survey?.gateAutomation?.dimensions || {}),
          },
          accessories: {
            ...emptySurvey.gateAutomation.accessories,
            ...(d.visit.survey?.gateAutomation?.accessories || {}),
          },
        },
        walkthroughRooms:
          d.visit.survey?.walkthroughRooms && d.visit.survey.walkthroughRooms.length > 0
            ? d.visit.survey.walkthroughRooms
            : emptySurvey.walkthroughRooms,
      };
      setDetail({ ...d.visit, survey: mergedSurvey });
      setFiles(d.files || []);
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load visit details");
    }
  };

  useEffect(() => {
    if (selected) open(selected);
  }, []);

  const deleteVisit = async (id: string) => {
    if (
      !window.confirm(
        "Permanently delete this site visit and its evidence? This action cannot be undone."
      )
    )
      return;
    const r = await fetch(`/api/site-visits?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) {
      setDetail(null);
      setSelected(null);
      load();
      setMsg("Site visit deleted successfully.");
    } else setMsg(d.error || "Failed to delete site visit.");
  };

  const stats = useMemo(
    () => ({
      scheduled: rows.filter((x) => x.status === "Scheduled").length,
      today: rows.filter(
        (x) => String(x.scheduled_at).slice(0, 10) === new Date().toISOString().slice(0, 10)
      ).length,
      completed: rows.filter((x) => x.status === "Completed").length,
      followup: rows.filter((x) => x.next_followup_at && x.status === "Completed").length,
    }),
    [rows]
  );

  return (
    <div className="svpage">
      <header>
        <div>
          <small>FIELD SALES & SURVEY</small>
          <h1>Site Visits & Technical Survey</h1>
          <p>
            Capture perimeter gate specifications, room-by-room electrical switchboards, smart locks
            and generate quotation proposals directly from the site survey.
          </p>
        </div>
        <button className="primary" onClick={() => setShow(true)}>
          ＋ Schedule site visit
        </button>
      </header>

      {msg && (
        <div className="svnotice">
          {msg}
          <button onClick={() => setMsg("")}>×</button>
        </div>
      )}

      <div className="svstats">
        {Object.entries(stats).map(([k, v]) => (
          <article key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </article>
        ))}
      </div>

      <div className="svtools">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search visit, customer, phone, site or city..."
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["Scheduled", "In Progress", "Completed", "Cancelled"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>

      <div className="svlist">
        <div className={`svrow head ${role === "admin" ? "admin" : ""}`}>
          <span>Visit</span>
          <span>Customer / Site</span>
          <span>Schedule</span>
          <span>Assigned to</span>
          <span>Purpose</span>
          <span>Status</span>
          {role === "admin" && <span>Actions</span>}
        </div>
        {rows.length === 0 ? (
          <div className="svempty">No site visits found matching the criteria.</div>
        ) : (
          rows.map((x) => (
            <div
              className={`svrow ${role === "admin" ? "admin" : ""}`}
              key={x.id}
              role="button"
              tabIndex={0}
              onClick={() => open(x.id)}
            >
              <span>
                <b>{x.id}</b>
                <small>{x.visitType || "Site survey"}</small>
              </span>
              <span>
                <b>{x.customer_name}</b>
                <small>
                  {x.site_name || x.city} · {x.phone}
                </small>
              </span>
              <span>
                <b>{dt(x.scheduled_at)}</b>
                <small>
                  {x.next_followup_at ? `Follow-up ${dt(x.next_followup_at)}` : "No follow-up"}
                </small>
              </span>
              <span>{x.assigned_name || "Unassigned"}</span>
              <span>{x.requirement || "Requirement survey"}</span>
              <em className={`svstatus-${String(x.status).toLowerCase().replace(/\s+/g, "-")}`}>
                {x.status}
              </em>
              {role === "admin" && (
                <span className="svactions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="svdelbtn"
                    title="Permanently delete site visit"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVisit(x.id);
                    }}
                  >
                    🗑 Delete
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {show && (
        <CreateVisit
          leads={leads}
          users={users}
          close={() => setShow(false)}
          done={(id: string) => {
            setShow(false);
            load();
            open(id);
          }}
          notice={setMsg}
        />
      )}

      {detail && (
        <VisitDrawer
          value={detail}
          set={setDetail}
          files={files}
          users={users}
          close={() => {
            setDetail(null);
            setSelected(null);
          }}
          saved={() => {
            open(detail.id);
            load();
          }}
          notice={setMsg}
          role={role}
          onDelete={deleteVisit}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function CreateVisit({ leads, users, close, done, notice }: R) {
  const [v, setV] = useState<R>({
    leadId: "",
    scheduledAt: "",
    assignedTo: "",
    visitType: "Initial Survey",
    purpose: "",
    visitNotes: "",
  });

  const save = async () => {
    const r = await fetch("/api/site-visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    });
    const d = await r.json();
    if (!r.ok) return notice(d.error);
    done(d.visit.id);
  };

  return (
    <div className="svmodalback">
      <div className="svmodal">
        <header>
          <div>
            <small>NEW FIELD APPOINTMENT</small>
            <h2>Schedule site visit</h2>
          </div>
          <button onClick={close}>×</button>
        </header>
        <main>
          <label>
            Lead / customer *
            <select value={v.leadId} onChange={(e) => setV({ ...v, leadId: e.target.value })}>
              <option value="">Select lead</option>
              {leads.map((x: R) => (
                <option key={x.id} value={x.id}>
                  {x.customer_name} · {x.site_name || x.city} · {x.phone}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date and time *
            <input
              type="datetime-local"
              value={v.scheduledAt}
              onChange={(e) => setV({ ...v, scheduledAt: e.target.value })}
            />
          </label>
          <label>
            Assigned employee
            <select value={v.assignedTo} onChange={(e) => setV({ ...v, assignedTo: e.target.value })}>
              <option value="">Lead owner / current user</option>
              {users.map((x: R) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visit type
            <select value={v.visitType} onChange={(e) => setV({ ...v, visitType: e.target.value })}>
              {[
                "Initial Survey",
                "Technical Survey",
                "Measurement Visit",
                "Pre-installation Check",
                "Customer Discussion",
                "Revisit",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            Purpose
            <textarea
              value={v.purpose}
              onChange={(e) => setV({ ...v, purpose: e.target.value })}
              placeholder="e.g. Survey for full home automation, gate motor & video door phone"
            />
          </label>
          <label className="wide">
            Preparation notes
            <textarea
              value={v.visitNotes}
              onChange={(e) => setV({ ...v, visitNotes: e.target.value })}
              placeholder="e.g. Bring laser meter, switchboard tester and catalog demo kit"
            />
          </label>
        </main>
        <footer>
          <button onClick={close}>Cancel</button>
          <button className="primary" disabled={!v.leadId || !v.scheduledAt} onClick={save}>
            Schedule visit
          </button>
        </footer>
      </div>
    </div>
  );
}

function VisitDrawer({
  value,
  set,
  files,
  users,
  close,
  saved,
  notice,
  role,
  onDelete,
  onNavigate,
}: R) {
  const [tab, setTab] = useState("🚪 Gate & Perimeter");
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);

  const survey = value.survey || emptySurvey;

  const change = (k: string, v: any) => set({ ...value, survey: { ...survey, [k]: v } });

  const patch = async (action = "save") => {
    setBusy(true);
    const r = await fetch("/api/site-visits", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...value, action }),
    });
    const d = await r.json();
    setBusy(false);
    notice(r.ok ? `Site visit ${d.status || "saved"}` : d.error);
    if (r.ok) saved();
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const f = new FormData();
    f.set("visitId", value.id);
    f.set("file", file);
    const r = await fetch("/api/site-visits/attachments", { method: "POST", body: f });
    const d = await r.json();
    notice(r.ok ? "Site evidence uploaded" : d.error);
    if (r.ok) saved();
  };

  // Convert survey directly to quotation
  const convertToQuotation = async () => {
    setConverting(true);
    try {
      // First save current survey state
      await fetch("/api/site-visits", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...value, action: "save" }),
      });

      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "convert-to-quote", visitId: value.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        notice(d.error || "Failed to generate quotation from survey");
        return;
      }
      notice(`✓ Quotation ${d.quotationNumber} generated successfully! Opening workspace...`);
      saved();
      if (onNavigate) {
        onNavigate("Quotations", { id: d.quotationId, open: "quote" });
      }
    } catch (e: any) {
      notice(e.message || "Quotation generation failed");
    } finally {
      setConverting(false);
    }
  };

  // Gate Automation Helpers
  const gate = survey.gateAutomation || {};
  const setGate = (updates: R) => change("gateAutomation", { ...gate, ...updates });

  // Room Walkthrough Helpers
  const rooms: R[] = survey.walkthroughRooms || [];
  const setRooms = (newRooms: R[]) => change("walkthroughRooms", newRooms);

  const addRoom = (roomName: string) => {
    const newRoom: R = {
      id: `rm-${Date.now().toString(36)}`,
      name: roomName,
      floor: "Ground Floor",
      doorLock: { required: false },
      switchboards: [
        {
          id: `sb-${Date.now().toString(36)}`,
          name: `${roomName} Main Board`,
          moduleSize: "8M Horizontal",
          switches: 4,
          fans: 1,
          hvSwitches: 0,
          plugs5A: 1,
          plugs16A: 0,
          finish: "Glass Touch",
          notes: "",
        },
      ],
      curtains: { required: false, trackType: "Single Track", lengthFt: 10, powerPointNearTrack: false },
      sensors: { motionPir: false, presenceRadar: false, doorSensor: false, gasSensor: false },
    };
    const next = [...rooms, newRoom];
    setRooms(next);
    setActiveRoomIdx(next.length - 1);
  };

  const removeRoom = (idx: number) => {
    if (!confirm(`Remove "${rooms[idx]?.name}" from survey?`)) return;
    const next = rooms.filter((_, i) => i !== idx);
    setRooms(next);
    setActiveRoomIdx(Math.max(0, idx - 1));
  };

  const updateCurrentRoom = (updates: R) => {
    const next = [...rooms];
    next[activeRoomIdx] = { ...next[activeRoomIdx], ...updates };
    setRooms(next);
  };

  const currentRoom = rooms[activeRoomIdx] || rooms[0];

  // Calculated BOQ Summary
  const calculatedBOQ = useMemo(() => {
    const items: R[] = [];
    if (gate.enabled) {
      items.push({
        cat: "Gate Automation",
        name: `Noviq AUTOZON ${gate.gateType || "Sliding Gate"} Kit (${gate.dimensions?.weightKg || "800kg"})`,
        qty: 1,
        desc: `${gate.dimensions?.lengthFt || 16}ft W x ${gate.dimensions?.heightFt || 6}ft H · ${gate.powerAtPillar}`,
      });
      if (gate.accessories?.photocellSensors) {
        items.push({
          cat: "Gate Automation",
          name: "Safety Infrared Photocell Sensor Pair",
          qty: 1,
          desc: "Obstacle anti-pinch safety beam",
        });
      }
      if (gate.accessories?.flashingLamp) {
        items.push({
          cat: "Gate Automation",
          name: "Flashing Warning Signal Lamp",
          qty: 1,
          desc: "Gate opening/closing indicator",
        });
      }
      if (Number(gate.accessories?.remotesCount || 0) > 0) {
        items.push({
          cat: "Gate Automation",
          name: "2-Channel Handheld RF Remote",
          qty: Number(gate.accessories.remotesCount),
          desc: "Wireless remote transmitters",
        });
      }
      if (!/swing/i.test(gate.gateType || "")) {
        const rackLen = Number(gate.trackLengthMeters || 5);
        items.push({
          cat: "Gate Automation",
          name: "Galvanized Steel Gear Rack (1m)",
          qty: rackLen,
          desc: `${rackLen} meters track drive`,
        });
      }
      if (gate.accessories?.electricLock) {
        items.push({
          cat: "Gate Automation",
          name: "Electronic Heavy Duty Gate Lock",
          qty: 1,
          desc: "Auto drop-bolt lock",
        });
      }
    }

    for (const r of rooms) {
      if (r.doorLock?.required) {
        items.push({
          cat: "Smart Door Locks",
          name: `Noviq Smart Biometric Door Lock`,
          qty: 1,
          desc: `${r.name} · ${r.doorLock.doorType || "Wooden Door"}`,
        });
      }
      for (const sb of r.switchboards || []) {
        const desc = [
          sb.switches ? `${sb.switches} Switch` : null,
          sb.fans ? `${sb.fans} Fan` : null,
          sb.hvSwitches ? `${sb.hvSwitches} HV 16A` : null,
          sb.plugs16A ? `${sb.plugs16A}x 16A Plug` : null,
          sb.plugs5A ? `${sb.plugs5A}x 5A Plug` : null,
        ]
          .filter(Boolean)
          .join(" + ");
        items.push({
          cat: "Smart Switches",
          name: `Smart Touch Switch ${sb.moduleSize || "8M"}`,
          qty: 1,
          desc: `${r.name} (${sb.name}) · ${desc || "Modular Switch"} · ${sb.finish || "Glass Touch"}`,
        });
      }
      if (r.curtains?.required) {
        items.push({
          cat: "Smart Curtains",
          name: `Noviq Smart Curtain Motor & Track (${r.curtains.lengthFt || 10}ft)`,
          qty: 1,
          desc: `${r.name} · ${r.curtains.trackType || "Single Track"}`,
        });
      }
      if (r.sensors?.presenceRadar) {
        items.push({
          cat: "Sensors & Automation",
          name: `mmWave Radar Presence Sensor`,
          qty: 1,
          desc: `${r.name} presence detection`,
        });
      }
      if (r.sensors?.motionPir) {
        items.push({
          cat: "Sensors & Automation",
          name: `Infrared Motion Sensor`,
          qty: 1,
          desc: `${r.name} motion automation`,
        });
      }
    }

    return items;
  }, [gate, rooms]);

  return (
    <div className="svdrawer">
      <header>
        <div>
          <div className="svhead-badge-row">
            <span className="svhead-id">{value.id}</span>
            <span className={`svhead-status status-${String(value.status).toLowerCase().replace(/\s+/g, "-")}`}>
              ● {value.status}
            </span>
            <span className="svhead-type">{survey.visitType || "Technical Survey"}</span>
          </div>
          <h2>{value.customer_name}</h2>
          <p>
            📍 {value.site_master || value.lead_site || value.city} · 📅 {dt(value.scheduled_at)}
          </p>
        </div>
        <button onClick={close} className="closebtn" title="Close drawer">
          ×
        </button>
      </header>

      {/* Action Toolbar */}
      <div className="svquick">
        <button
          type="button"
          className="btn-convert-quote"
          disabled={busy || converting}
          onClick={convertToQuotation}
          title="Create an official Quotation with all surveyed devices & switchboards"
        >
          {converting ? "⏳ Generating quote..." : "⚡ Generate Quotation from Survey"}
        </button>
        <button type="button" disabled={busy} onClick={() => patch("save")}>
          💾 Save survey
        </button>
        <button
          type="button"
          className="btn-complete-visit"
          disabled={busy}
          onClick={() => patch("complete")}
        >
          ✓ Complete visit
        </button>
        <a
          href={
            value.site_maps ||
            value.maps_url ||
            `https://maps.google.com/?q=${encodeURIComponent(
              value.site_address || value.lead_address || value.city || ""
            )}`
          }
          target="_blank"
          rel="noreferrer"
          className="btn-map"
        >
          🗺 Open map
        </a>
        <label className="uploadbtn">
          📷 Site photo
          <input
            type="file"
            accept="image/*,.pdf,video/mp4"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        {role === "admin" && onDelete && (
          <button className="danger" onClick={() => onDelete(value.id)}>
            🗑 Delete
          </button>
        )}
      </div>

      {/* Modern Navigation Tabs */}
      <nav className="svtabs">
        {[
          "🚪 Gate & Perimeter",
          "🏠 Room Walkthrough",
          "📋 Survey BOQ & Quote Handoff",
          "Overview",
          "Checklist & Readiness",
          "Photos & Evidence",
          "Outcome & Notes",
        ].map((x) => (
          <button
            key={x}
            type="button"
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "📋 Survey BOQ & Quote Handoff" && (
              <span className="boqcount-badge">{calculatedBOQ.length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="svbody">
        {/* TAB 1: GATE & PERIMETER AUTOMATION */}
        {tab === "🚪 Gate & Perimeter" && (
          <div className="gate-survey-container">
            <div className="gate-toggle-card">
              <div className="toggle-left">
                <span className="gate-icon">🚪</span>
                <div>
                  <h3>Gate & Perimeter Automation Required?</h3>
                  <p>
                    Enable motor sizing, gear rack length, safety photocells, remotes and pillar power
                    readiness for the entrance.
                  </p>
                </div>
              </div>
              <label className="switch-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(gate.enabled)}
                  onChange={(e) => setGate({ enabled: e.target.checked })}
                />
                <span className="slider round"></span>
              </label>
            </div>

            {gate.enabled ? (
              <div className="gate-details-grid">
                {/* Gate Type */}
                <div className="surveycard">
                  <h4>1. Gate Type & Configuration</h4>
                  <div className="chip-selector">
                    {GATE_TYPES.map((gt) => (
                      <button
                        key={gt}
                        type="button"
                        className={`chip-btn ${gate.gateType === gt ? "selected" : ""}`}
                        onClick={() => setGate({ gateType: gt })}
                      >
                        {gt}
                      </button>
                    ))}
                  </div>

                  <div className="gate-dimension-row">
                    <label>
                      <span>Width / Length (Feet) *</span>
                      <input
                        type="number"
                        min="4"
                        max="60"
                        value={gate.dimensions?.lengthFt || 16}
                        onChange={(e) =>
                          setGate({
                            dimensions: { ...gate.dimensions, lengthFt: Number(e.target.value) },
                            trackLengthMeters: Math.ceil(Number(e.target.value) * 0.3048) + 1,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Gate Height (Feet)</span>
                      <input
                        type="number"
                        min="3"
                        max="15"
                        value={gate.dimensions?.heightFt || 6}
                        onChange={(e) =>
                          setGate({
                            dimensions: { ...gate.dimensions, heightFt: Number(e.target.value) },
                          })
                        }
                      />
                    </label>
                  </div>

                  <label className="field-group">
                    <span>Estimated Gate Weight / Motor Capacity</span>
                    <div className="chip-selector">
                      {GATE_WEIGHT_PRESETS.map((wt) => (
                        <button
                          key={wt}
                          type="button"
                          className={`chip-btn ${gate.dimensions?.weightKg === wt ? "selected" : ""}`}
                          onClick={() =>
                            setGate({ dimensions: { ...gate.dimensions, weightKg: wt } })
                          }
                        >
                          {wt}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                {/* Electrical & Civil Readiness */}
                <div className="surveycard">
                  <h4>2. Electrical & Civil Readiness at Pillar</h4>
                  <label>
                    <span>Power Availability at Gate Pillar</span>
                    <select
                      value={gate.powerAtPillar || "Yes - Available"}
                      onChange={(e) => setGate({ powerAtPillar: e.target.value })}
                    >
                      <option value="Yes - Available">Yes - 230V AC Supply Available at Pillar</option>
                      <option value="No - Needs Cabling">No - Electrician needs to lay armored cable</option>
                      <option value="Needs Conduit">Civil conduit ready, wire pulling required</option>
                    </select>
                  </label>

                  {!/swing/i.test(gate.gateType || "") && (
                    <label>
                      <span>Gear Rack Length (Meters)</span>
                      <input
                        type="number"
                        min="2"
                        max="25"
                        value={gate.trackLengthMeters || 5}
                        onChange={(e) => setGate({ trackLengthMeters: Number(e.target.value) })}
                      />
                      <small className="helptext">
                        Standard recommendation: Gate width in meters + 1 meter overlap.
                      </small>
                    </label>
                  )}

                  <label>
                    <span>Civil Ground Level & Track Condition</span>
                    <input
                      type="text"
                      placeholder="e.g. Smooth concrete floor, leveled ground track"
                      value={gate.civilNotes || ""}
                      onChange={(e) => setGate({ civilNotes: e.target.value })}
                    />
                  </label>
                </div>

                {/* Gate Accessories */}
                <div className="surveycard wide">
                  <h4>3. Gate Automation Accessories & Add-ons</h4>
                  <div className="acc-grid">
                    <label className="acc-checkbox">
                      <input
                        type="checkbox"
                        checked={gate.accessories?.photocellSensors !== false}
                        onChange={(e) =>
                          setGate({
                            accessories: {
                              ...gate.accessories,
                              photocellSensors: e.target.checked,
                            },
                          })
                        }
                      />
                      <div>
                        <b>Safety Infrared Photocells (Pair)</b>
                        <small>Prevents gate from closing on vehicles or pedestrians</small>
                      </div>
                    </label>

                    <label className="acc-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(gate.accessories?.flashingLamp)}
                        onChange={(e) =>
                          setGate({
                            accessories: { ...gate.accessories, flashingLamp: e.target.checked },
                          })
                        }
                      />
                      <div>
                        <b>Flashing Warning Lamp</b>
                        <small>Visual strobe alert when gate motor is in motion</small>
                      </div>
                    </label>

                    <label className="acc-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(gate.accessories?.wifiController)}
                        onChange={(e) =>
                          setGate({
                            accessories: { ...gate.accessories, wifiController: e.target.checked },
                          })
                        }
                      />
                      <div>
                        <b>Wi-Fi / Mobile App Remote Trigger</b>
                        <small>Open gate from smartphone or smart home app</small>
                      </div>
                    </label>

                    <label className="acc-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(gate.accessories?.electricLock)}
                        onChange={(e) =>
                          setGate({
                            accessories: { ...gate.accessories, electricLock: e.target.checked },
                          })
                        }
                      />
                      <div>
                        <b>Heavy Electronic / Magnetic Gate Lock</b>
                        <small>High security lock for heavy winds and intruder resistance</small>
                      </div>
                    </label>
                  </div>

                  <div className="remotes-row">
                    <label>
                      <span>Handheld RF Remotes Quantity</span>
                      <div className="counter-box">
                        <button
                          type="button"
                          onClick={() =>
                            setGate({
                              accessories: {
                                ...gate.accessories,
                                remotesCount: Math.max(1, (gate.accessories?.remotesCount || 2) - 1),
                              },
                            })
                          }
                        >
                          -
                        </button>
                        <span>{gate.accessories?.remotesCount || 2} Remotes</span>
                        <button
                          type="button"
                          onClick={() =>
                            setGate({
                              accessories: {
                                ...gate.accessories,
                                remotesCount: (gate.accessories?.remotesCount || 2) + 1,
                              },
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </label>

                    <label className="flex-1">
                      <span>Gate Survey Notes</span>
                      <input
                        type="text"
                        placeholder="e.g. Existing manual sliding gate in good condition, dual pillars available"
                        value={gate.accessories?.notes || ""}
                        onChange={(e) =>
                          setGate({
                            accessories: { ...gate.accessories, notes: e.target.value },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="gate-disabled-placeholder">
                <span>🚪 Gate automation is marked as not required for this project.</span>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setGate({ enabled: true })}
                >
                  Enable Gate Automation
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROOM WALKTHROUGH & ELECTRICAL SWITCHBOARDS */}
        {tab === "🏠 Room Walkthrough" && (
          <div className="walkthrough-container">
            {/* Rooms Navigator Bar */}
            <div className="room-nav-bar">
              <div className="room-chips-list">
                {rooms.map((rm, idx) => (
                  <button
                    key={rm.id || idx}
                    type="button"
                    className={`room-chip ${activeRoomIdx === idx ? "active" : ""}`}
                    onClick={() => setActiveRoomIdx(idx)}
                  >
                    <span>{rm.name}</span>
                    <small>
                      {(rm.switchboards || []).length} boards
                      {rm.doorLock?.required ? " · 🔒" : ""}
                    </small>
                  </button>
                ))}
              </div>

              {/* Add Room Dropdown / Presets */}
              <div className="room-add-presets">
                <span className="add-label">＋ Add Room:</span>
                {DEFAULT_ROOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="preset-btn"
                    onClick={() => addRoom(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {currentRoom ? (
              <div className="active-room-workspace">
                {/* Room Header Banner */}
                <div className="room-banner">
                  <div>
                    <input
                      className="room-name-input"
                      value={currentRoom.name}
                      onChange={(e) => updateCurrentRoom({ name: e.target.value })}
                      placeholder="Room name..."
                    />
                    <select
                      className="room-floor-select"
                      value={currentRoom.floor || "Ground Floor"}
                      onChange={(e) => updateCurrentRoom({ floor: e.target.value })}
                    >
                      <option>Basement</option>
                      <option>Ground Floor</option>
                      <option>First Floor</option>
                      <option>Second Floor</option>
                      <option>Terrace</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => removeRoom(activeRoomIdx)}
                  >
                    🗑 Remove Room
                  </button>
                </div>

                {/* 1. Smart Door Lock Configurator */}
                <div className="surveycard">
                  <div className="card-top-toggle">
                    <div className="title-with-icon">
                      <span className="icon">🔒</span>
                      <div>
                        <h4>Smart Door Lock</h4>
                        <small>Configure smart lock for this room entrance</small>
                      </div>
                    </div>
                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(currentRoom.doorLock?.required)}
                        onChange={(e) =>
                          updateCurrentRoom({
                            doorLock: {
                              ...currentRoom.doorLock,
                              required: e.target.checked,
                              doorType: currentRoom.doorLock?.doorType || "Wooden (35-50mm)",
                              features: currentRoom.doorLock?.features || [
                                "Fingerprint",
                                "PIN Code",
                                "RFID Card",
                                "Mobile App Unlock",
                              ],
                            },
                          })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {currentRoom.doorLock?.required && (
                    <div className="doorlock-subform">
                      <div className="two-col">
                        <label>
                          <span>Door Material & Thickness</span>
                          <select
                            value={currentRoom.doorLock?.doorType || "Wooden (35-50mm)"}
                            onChange={(e) =>
                              updateCurrentRoom({
                                doorLock: { ...currentRoom.doorLock, doorType: e.target.value },
                              })
                            }
                          >
                            <option>Wooden (35-50mm)</option>
                            <option>Wooden Heavy (50-70mm)</option>
                            <option>Metal / Steel Door</option>
                            <option>Framed Glass Door</option>
                            <option>Main Double Door with Rebated Edge</option>
                          </select>
                        </label>
                        <label>
                          <span>Lock Specifications / Notes</span>
                          <input
                            type="text"
                            placeholder="e.g. Noviq AL1 Matte Black, handle mortise"
                            value={currentRoom.doorLock?.notes || ""}
                            onChange={(e) =>
                              updateCurrentRoom({
                                doorLock: { ...currentRoom.doorLock, notes: e.target.value },
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="unlock-modes">
                        <span>Included Unlock Features:</span>
                        <div className="chip-pills">
                          {["Fingerprint", "PIN Code", "RFID Card", "Mobile App Unlock", "Face Recognition", "Built-in Camera"].map((feat) => {
                            const selected = (currentRoom.doorLock?.features || []).includes(feat);
                            return (
                              <button
                                key={feat}
                                type="button"
                                className={`pill-btn ${selected ? "active" : ""}`}
                                onClick={() => {
                                  const cur = currentRoom.doorLock?.features || [];
                                  const next = selected
                                    ? cur.filter((x: string) => x !== feat)
                                    : [...cur, feat];
                                  updateCurrentRoom({
                                    doorLock: { ...currentRoom.doorLock, features: next },
                                  });
                                }}
                              >
                                {selected ? "✓ " : "+ "}
                                {feat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Switchboards Survey (The core user requirement!) */}
                <div className="surveycard">
                  <div className="board-section-head">
                    <div>
                      <h4>⚡ Switchboards in {currentRoom.name}</h4>
                      <small>
                        Capture module sizes (2M–18M), light switches, fan control, HV appliances (16A/25A) and plug sockets.
                      </small>
                    </div>
                    <button
                      type="button"
                      className="primary-btn-sm"
                      onClick={() => {
                        const newSb = {
                          id: `sb-${Date.now().toString(36)}`,
                          name: `Board ${(currentRoom.switchboards || []).length + 1}`,
                          moduleSize: "8M Horizontal",
                          switches: 4,
                          fans: 1,
                          hvSwitches: 0,
                          plugs5A: 1,
                          plugs16A: 0,
                          finish: "Glass Touch",
                          notes: "",
                        };
                        updateCurrentRoom({
                          switchboards: [...(currentRoom.switchboards || []), newSb],
                        });
                      }}
                    >
                      ＋ Add Switchboard
                    </button>
                  </div>

                  <div className="switchboard-list">
                    {(currentRoom.switchboards || []).length === 0 ? (
                      <div className="svempty">No switchboards added for this room yet.</div>
                    ) : (
                      currentRoom.switchboards.map((sb: R, sbIdx: number) => {
                        const updateSb = (updates: R) => {
                          const next = [...(currentRoom.switchboards || [])];
                          next[sbIdx] = { ...next[sbIdx], ...updates };
                          updateCurrentRoom({ switchboards: next });
                        };

                        const removeSb = () => {
                          const next = (currentRoom.switchboards || []).filter(
                            (_: any, i: number) => i !== sbIdx
                          );
                          updateCurrentRoom({ switchboards: next });
                        };

                        return (
                          <div key={sb.id || sbIdx} className="switchboard-card">
                            <div className="sb-header">
                              <div className="sb-title-row">
                                <span className="sb-badge">{sb.moduleSize || "8M"}</span>
                                <input
                                  className="sb-name-input"
                                  value={sb.name}
                                  onChange={(e) => updateSb({ name: e.target.value })}
                                  placeholder="e.g. Main Door Board, TV Unit..."
                                />
                              </div>
                              <button
                                type="button"
                                className="del-icon-btn"
                                onClick={removeSb}
                                title="Remove switchboard"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="sb-form-grid">
                              {/* Module Size */}
                              <label>
                                <span>Module Size *</span>
                                <select
                                  value={sb.moduleSize || "8M Horizontal"}
                                  onChange={(e) => updateSb({ moduleSize: e.target.value })}
                                >
                                  {MODULE_OPTIONS.map((m) => (
                                    <option key={m}>{m}</option>
                                  ))}
                                </select>
                              </label>

                              {/* Finish / Technology */}
                              <label>
                                <span>Switchboard Type & Finish</span>
                                <select
                                  value={sb.finish || "Glass Touch"}
                                  onChange={(e) => updateSb({ finish: e.target.value })}
                                >
                                  <option>Glass Touch</option>
                                  <option>Acrylic Touch</option>
                                  <option>Retrofit In-Wall Module</option>
                                  <option>Smart Mechanical</option>
                                </select>
                              </label>

                              {/* Point Counters */}
                              <div className="counters-container wide">
                                {/* Light Switches */}
                                <div className="point-box">
                                  <span className="point-label">💡 Light Switches</span>
                                  <div className="mini-counter">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({ switches: Math.max(0, (sb.switches || 0) - 1) })
                                      }
                                    >
                                      -
                                    </button>
                                    <b>{sb.switches || 0}</b>
                                    <button
                                      type="button"
                                      onClick={() => updateSb({ switches: (sb.switches || 0) + 1 })}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Fan Speed Control */}
                                <div className="point-box">
                                  <span className="point-label">🌀 Fan Speed Points</span>
                                  <div className="mini-counter">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({ fans: Math.max(0, (sb.fans || 0) - 1) })
                                      }
                                    >
                                      -
                                    </button>
                                    <b>{sb.fans || 0}</b>
                                    <button
                                      type="button"
                                      onClick={() => updateSb({ fans: (sb.fans || 0) + 1 })}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* High Voltage / Heavy Appliances */}
                                <div className="point-box hv">
                                  <span className="point-label">⚡ Heavy (16A/25A AC/Geyser)</span>
                                  <div className="mini-counter">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({
                                          hvSwitches: Math.max(0, (sb.hvSwitches || 0) - 1),
                                        })
                                      }
                                    >
                                      -
                                    </button>
                                    <b className="hv-val">{sb.hvSwitches || 0}</b>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({ hvSwitches: (sb.hvSwitches || 0) + 1 })
                                      }
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Standard 5A Sockets */}
                                <div className="point-box">
                                  <span className="point-label">🔌 5A / 6A Sockets</span>
                                  <div className="mini-counter">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({ plugs5A: Math.max(0, (sb.plugs5A || 0) - 1) })
                                      }
                                    >
                                      -
                                    </button>
                                    <b>{sb.plugs5A || 0}</b>
                                    <button
                                      type="button"
                                      onClick={() => updateSb({ plugs5A: (sb.plugs5A || 0) + 1 })}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Heavy 16A Sockets */}
                                <div className="point-box">
                                  <span className="point-label">🔌 16A Power Sockets</span>
                                  <div className="mini-counter">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSb({
                                          plugs16A: Math.max(0, (sb.plugs16A || 0) - 1),
                                        })
                                      }
                                    >
                                      -
                                    </button>
                                    <b>{sb.plugs16A || 0}</b>
                                    <button
                                      type="button"
                                      onClick={() => updateSb({ plugs16A: (sb.plugs16A || 0) + 1 })}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <label className="wide">
                                <span>Switchboard Notes / Two-Way Control</span>
                                <input
                                  type="text"
                                  placeholder="e.g. 2-way master switch with bed left, neutral wire available"
                                  value={sb.notes || ""}
                                  onChange={(e) => updateSb({ notes: e.target.value })}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. Motorized Curtains & Sensors */}
                <div className="curtains-sensors-grid">
                  {/* Curtains */}
                  <div className="surveycard">
                    <div className="card-top-toggle">
                      <div className="title-with-icon">
                        <span className="icon">🪟</span>
                        <div>
                          <h4>Motorized Curtains</h4>
                          <small>Track length & motor readiness</small>
                        </div>
                      </div>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(currentRoom.curtains?.required)}
                          onChange={(e) =>
                            updateCurrentRoom({
                              curtains: { ...currentRoom.curtains, required: e.target.checked },
                            })
                          }
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    {currentRoom.curtains?.required && (
                      <div className="curtain-subform">
                        <label>
                          <span>Track Configuration</span>
                          <select
                            value={currentRoom.curtains?.trackType || "Single Track"}
                            onChange={(e) =>
                              updateCurrentRoom({
                                curtains: { ...currentRoom.curtains, trackType: e.target.value },
                              })
                            }
                          >
                            <option>Single Track</option>
                            <option>Dual Track (Sheer + Main)</option>
                            <option>Motorized Roller Blind</option>
                          </select>
                        </label>
                        <label>
                          <span>Track Length (Feet)</span>
                          <input
                            type="number"
                            min="4"
                            max="40"
                            value={currentRoom.curtains?.lengthFt || 10}
                            onChange={(e) =>
                              updateCurrentRoom({
                                curtains: {
                                  ...currentRoom.curtains,
                                  lengthFt: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={Boolean(currentRoom.curtains?.powerPointNearTrack)}
                            onChange={(e) =>
                              updateCurrentRoom({
                                curtains: {
                                  ...currentRoom.curtains,
                                  powerPointNearTrack: e.target.checked,
                                },
                              })
                            }
                          />
                          <span>230V AC Power Socket available near curtain pelmet</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Sensors */}
                  <div className="surveycard">
                    <div className="title-with-icon">
                      <span className="icon">📡</span>
                      <div>
                        <h4>Sensors & Automation</h4>
                        <small>Presence, motion and security detectors</small>
                      </div>
                    </div>
                    <div className="sensors-checklist">
                      <label className="sensor-item">
                        <input
                          type="checkbox"
                          checked={Boolean(currentRoom.sensors?.presenceRadar)}
                          onChange={(e) =>
                            updateCurrentRoom({
                              sensors: { ...currentRoom.sensors, presenceRadar: e.target.checked },
                            })
                          }
                        />
                        <div>
                          <b>mmWave Radar Human Presence Sensor</b>
                          <small>Detects micro-movements, breathing, sitting</small>
                        </div>
                      </label>

                      <label className="sensor-item">
                        <input
                          type="checkbox"
                          checked={Boolean(currentRoom.sensors?.motionPir)}
                          onChange={(e) =>
                            updateCurrentRoom({
                              sensors: { ...currentRoom.sensors, motionPir: e.target.checked },
                            })
                          }
                        />
                        <div>
                          <b>PIR Motion Sensor</b>
                          <small>For walk-through paths and auto-lighting</small>
                        </div>
                      </label>

                      <label className="sensor-item">
                        <input
                          type="checkbox"
                          checked={Boolean(currentRoom.sensors?.doorSensor)}
                          onChange={(e) =>
                            updateCurrentRoom({
                              sensors: { ...currentRoom.sensors, doorSensor: e.target.checked },
                            })
                          }
                        />
                        <div>
                          <b>Door / Window Magnetic Sensor</b>
                          <small>Security alert and room entry triggers</small>
                        </div>
                      </label>

                      <label className="sensor-item">
                        <input
                          type="checkbox"
                          checked={Boolean(currentRoom.sensors?.gasSensor)}
                          onChange={(e) =>
                            updateCurrentRoom({
                              sensors: { ...currentRoom.sensors, gasSensor: e.target.checked },
                            })
                          }
                        />
                        <div>
                          <b>LPG Gas Leak Detector</b>
                          <small>Audible siren + mobile app notification</small>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 3: SURVEY BOQ & QUOTATION HANDOFF */}
        {tab === "📋 Survey BOQ & Quote Handoff" && (
          <div className="boq-handoff-container">
            <div className="handoff-cta-card">
              <div className="cta-left">
                <span className="cta-badge">HANDOFF READY</span>
                <h3>Transform Site Survey into Quotation</h3>
                <p>
                  All surveyed gate motors, safety accessories, room switchboards, smart locks,
                  curtains, and sensors are compiled below. Click to instantly generate an official
                  Draft Quotation.
                </p>
              </div>
              <button
                type="button"
                className="btn-huge-convert"
                disabled={busy || converting}
                onClick={convertToQuotation}
              >
                {converting ? "⏳ Generating quote..." : "⚡ Generate Quotation from Survey"}
              </button>
            </div>

            <div className="boq-summary-table-card">
              <div className="table-top">
                <h4>Aggregated Bill of Quantities ({calculatedBOQ.length} Items)</h4>
                <span>Auto-calculated from Entrance & Rooms</span>
              </div>
              <table className="boqtable">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Surveyed Device / Specification</th>
                    <th>Qty</th>
                    <th>Room / Location & Specifications</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedBOQ.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-cell">
                        No devices surveyed yet. Enable Gate Automation or add switchboards in Room
                        Walkthrough.
                      </td>
                    </tr>
                  ) : (
                    calculatedBOQ.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="boqcat-chip">{it.cat}</span>
                        </td>
                        <td>
                          <b>{it.name}</b>
                        </td>
                        <td>
                          <span className="boqqty">{it.qty}</span>
                        </td>
                        <td>
                          <small>{it.desc}</small>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: OVERVIEW */}
        {tab === "Overview" && (
          <div className="svgrid">
            <Card title="Customer & Site">
              <p>
                <b>Customer:</b> {value.customer_name} · 📞 {value.phone}
              </p>
              <p>
                <b>Site Address:</b> {value.site_address || value.lead_address || value.city}
              </p>
              <p>
                <b>Requirement:</b> {value.requirement || "Full Home Automation Survey"}
              </p>
            </Card>

            <Card title="Appointment Schedule">
              <label>
                <span>Schedule Date & Time</span>
                <input
                  type="datetime-local"
                  value={String(value.scheduled_at || "").slice(0, 16)}
                  onChange={(e) => set({ ...value, scheduledAt: e.target.value })}
                />
              </label>
              <label>
                <span>Assigned Employee</span>
                <select
                  value={value.assigned_to}
                  onChange={(e) => set({ ...value, assignedTo: e.target.value })}
                >
                  {users.map((x: R) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={value.status}
                  onChange={(e) => set({ ...value, status: e.target.value })}
                >
                  {["Scheduled", "In Progress", "Completed", "Cancelled"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </Card>

            <Card title="Visit Brief & Purpose">
              <label>
                <span>Visit Type</span>
                <input
                  value={survey.visitType || ""}
                  onChange={(e) => change("visitType", e.target.value)}
                />
              </label>
              <label>
                <span>Purpose & Scope</span>
                <textarea
                  value={survey.purpose || ""}
                  onChange={(e) => change("purpose", e.target.value)}
                />
              </label>
            </Card>
          </div>
        )}

        {/* TAB 5: CHECKLIST & READINESS */}
        {tab === "Checklist & Readiness" && (
          <div className="svgrid">
            <Card title="⚡ Electrical Readiness">
              <label>
                <span>Neutral Wire in Switchboard Boxes</span>
                <input
                  value={survey.electrical?.neutralWire || ""}
                  onChange={(e) =>
                    change("electrical", { ...survey.electrical, neutralWire: e.target.value })
                  }
                  placeholder="e.g. Yes - neutral wire pulled to all switchboxes"
                />
              </label>
              <label>
                <span>DB Box Space & RCCB</span>
                <input
                  value={survey.electrical?.dbSpace || ""}
                  onChange={(e) =>
                    change("electrical", { ...survey.electrical, dbSpace: e.target.value })
                  }
                  placeholder="e.g. 4-way space available in main MCB distribution board"
                />
              </label>
              <label>
                <span>Earthing & Voltage</span>
                <input
                  value={survey.electrical?.earthing || ""}
                  onChange={(e) =>
                    change("electrical", { ...survey.electrical, earthing: e.target.value })
                  }
                  placeholder="e.g. Solid copper earthing < 2V neutral-to-earth"
                />
              </label>
              <label>
                <span>Power Backup / Inverter</span>
                <input
                  value={survey.electrical?.powerBackup || ""}
                  onChange={(e) =>
                    change("electrical", { ...survey.electrical, powerBackup: e.target.value })
                  }
                  placeholder="e.g. 1.5 kVA Pure Sine Wave Inverter connected"
                />
              </label>
            </Card>

            <Card title="📶 Network & Wi-Fi Coverage">
              <label>
                <span>Internet Service Provider (ISP)</span>
                <input
                  value={survey.network?.isp || ""}
                  onChange={(e) => change("network", { ...survey.network, isp: e.target.value })}
                  placeholder="e.g. Airtel Xstream 300 Mbps Fiber"
                />
              </label>
              <label>
                <span>Wi-Fi Router Location</span>
                <input
                  value={survey.network?.routerLocation || ""}
                  onChange={(e) =>
                    change("network", { ...survey.network, routerLocation: e.target.value })
                  }
                  placeholder="e.g. Central Living Room TV console"
                />
              </label>
              <label>
                <span>Signal Coverage & Mesh Extenders</span>
                <input
                  value={survey.network?.coverage || ""}
                  onChange={(e) =>
                    change("network", { ...survey.network, coverage: e.target.value })
                  }
                  placeholder="e.g. Good on Ground Floor, 1 Mesh Node needed for 1st Floor"
                />
              </label>
            </Card>

            <Card title="🏗 Civil & Installation Readiness">
              <label>
                <span>Civil & Wall Painting Status</span>
                <input
                  value={survey.readiness?.civil || ""}
                  onChange={(e) =>
                    change("readiness", { ...survey.readiness, civil: e.target.value })
                  }
                  placeholder="e.g. Final painting in progress, ready for switch fixing"
                />
              </label>
              <label>
                <span>Site Access & Timings</span>
                <input
                  value={survey.readiness?.access || ""}
                  onChange={(e) =>
                    change("readiness", { ...survey.readiness, access: e.target.value })
                  }
                  placeholder="e.g. 9:00 AM to 6:30 PM permitted by association"
                />
              </label>
            </Card>
          </div>
        )}

        {/* TAB 6: PHOTOS & EVIDENCE */}
        {tab === "Photos & Evidence" && (
          <div className="photos-container">
            <label className="svupload">
              ＋ Upload site photos, gate photos, switchboard boxes or marked floor plans
              <input
                type="file"
                accept="image/*,.pdf,video/mp4"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
            <div className="svfiles">
              {files.length === 0 ? (
                <div className="svempty">No evidence photos uploaded yet.</div>
              ) : (
                files.map((x: R) => (
                  <a
                    key={x.id}
                    href={`/api/uploads/${x.file_key}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <b>{x.file_name}</b>
                    <small>
                      {x.kind} · {Math.round(x.size / 1024)} KB
                    </small>
                  </a>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 7: OUTCOME & NOTES */}
        {tab === "Outcome & Notes" && (
          <div className="svgrid">
            <Card title="Customer Confirmation">
              <label>
                <span>Requirement Confirmed with Customer</span>
                <textarea
                  value={value.requirementConfirmation || value.requirement_confirmation || ""}
                  onChange={(e) => set({ ...value, requirementConfirmation: e.target.value })}
                  placeholder="Customer confirmed interest in gate automation and whole home switches..."
                />
              </label>
              <label>
                <span>Budget Confirmed (INR)</span>
                <input
                  value={value.budgetConfirmation || value.budget_confirmation || ""}
                  onChange={(e) => set({ ...value, budgetConfirmation: e.target.value })}
                  placeholder="e.g. ₹2,50,000 to ₹3,50,000"
                />
              </label>
              <label>
                <span>Customer Preferences</span>
                <textarea
                  value={survey.customerPreferences || ""}
                  onChange={(e) => change("customerPreferences", e.target.value)}
                  placeholder="Prefers black glass touch switches and silent gate operator..."
                />
              </label>
            </Card>

            <Card title="Survey Outcome & Follow-up">
              <label>
                <span>Visit Outcome Notes *</span>
                <textarea
                  value={value.visitNotes ?? value.visit_notes ?? ""}
                  onChange={(e) => set({ ...value, visitNotes: e.target.value })}
                  placeholder="Record summary of survey, customer reaction and key takeaways..."
                />
              </label>
              <label>
                <span>Recommendations</span>
                <textarea
                  value={survey.recommendations || ""}
                  onChange={(e) => change("recommendations", e.target.value)}
                  placeholder="Recommended items to highlight in proposal..."
                />
              </label>
              <label>
                <span>Expected Quote Date</span>
                <input
                  type="date"
                  value={value.expectedQuoteDate || value.expected_quote_date || ""}
                  onChange={(e) => set({ ...value, expectedQuoteDate: e.target.value })}
                />
              </label>
              <label>
                <span>Next Follow-up</span>
                <input
                  type="datetime-local"
                  value={String(value.nextFollowupAt || value.next_followup_at || "").slice(0, 16)}
                  onChange={(e) => set({ ...value, nextFollowupAt: e.target.value })}
                />
              </label>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <section className="svcard">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
