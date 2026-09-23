"use client";
import { useEffect, useState, useMemo } from "react";

type R = Record<string, any>;

const money = (v: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const stages = [
  "Confirmed",
  "Advance Pending",
  "Advance Received",
  "Material Planning",
  "Procurement",
  "Materials Ready",
  "Materials at Site",
  "Installation Scheduled",
  "Installation",
  "Testing & Configuration",
  "Handover & Training",
  "Completed",
  "On Hold",
  "Cancelled",
];

const healthOptions = [
  "On Track",
  "Delayed",
  "Waiting for Customer",
  "Waiting for Material",
  "Waiting for Payment",
  "On Hold",
];

const categories = [
  "Smart Home Automation",
  "Smart Switches",
  "Door Lock",
  "CCTV",
  "Gate Automation",
  "Curtains",
  "Networking",
  "Service",
  "Other",
];

const tabs = [
  { id: "Overview", label: "Overview", icon: "📊" },
  { id: "Scope and Room-wise Items", label: "Scope & BOQ", icon: "📦" },
  { id: "Tasks and Checklist", label: "Tasks & Checklist", icon: "✓" },
  { id: "Materials and Procurement", label: "Materials", icon: "🚚" },
  { id: "Team and Schedule", label: "Team & Schedule", icon: "👥" },
  { id: "Payments and Invoice", label: "Finances & Invoices", icon: "💳" },
  { id: "Expenses", label: "Expenses", icon: "💰" },
  { id: "Site Readiness", label: "Site Readiness", icon: "⚡" },
  { id: "Photos and Documents", label: "Photos & Docs", icon: "📁" },
  { id: "Testing and Handover", label: "Testing & Handover", icon: "🤝" },
  { id: "Warranty and Service", label: "Warranty & Service", icon: "🛡" },
  { id: "Activity Timeline", label: "Timeline", icon: "🕒" },
];

export default function ProjectsModule({
  role,
  initialFilter,
  onNavigate,
}: {
  role: string;
  initialFilter: R;
  onNavigate: (x: string) => void;
}) {
  const [rows, setRows] = useState<R[]>([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [options, setOptions] = useState<R>({
    users: [],
    customers: [],
    sites: [],
    quotes: [],
  });
  const [filter, setFilter] = useState({
    q: initialFilter.id || "",
    status: initialFilter.status || "",
    health: "",
    category: "",
    manager: "",
    alert: "",
    page: "1",
  });
  const [detail, setDetail] = useState<R | null>(null);
  const [tab, setTab] = useState("Overview");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<R>({
    direct: true,
    customerId: "",
    siteId: "",
    quotationId: "",
    title: "",
    category: "Smart Home Automation",
    scope: "",
    value: "",
    managerId: "",
    salesId: "",
    directReason: "Small/service work approved by Admin",
    plannedStart: "",
    plannedEnd: "",
  });
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const p = new URLSearchParams(
        Object.entries(filter).filter(([, v]) => v) as [string, string][]
      );
      const r = await fetch(`/api/projects?${p}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to load projects (${r.status})`);
        return;
      }
      const d = await r.json();
      setRows(d.projects || []);
      setMeta(d.pagination || { page: 1, pages: 1, total: 0 });
      setOptions(d.filters || {});
    } catch (e: any) {
      setMsg(e?.message || "Failed to connect to server");
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const open = async (id: string) => {
    const r = await fetch(`/api/projects?id=${id}`);
    const d = await r.json();
    if (r.ok) {
      setDetail(d);
      setTab("Overview");
    } else {
      setMsg(d.error || "Failed to open project");
    }
  };

  const create = async () => {
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          customerId: Number(form.customerId),
          quotationId: form.quotationId ? Number(form.quotationId) : null,
          value: Number(form.value || 0),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        return { ok: false, error: d.error || "Creation failed" };
      }
      setShow(false);
      setMsg(`${d.project?.id || "Project"} created successfully`);
      load();
      if (d.project?.id) open(d.project.id);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to create project" };
    }
  };

  const act = async (p: R) => {
    if (!detail?.project?.id) return;
    const r = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: detail.project.id, ...p }),
    });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || "Update failed");
    setMsg("Project updated successfully");
    open(detail.project.id);
    load();
  };

  const upload = async (file: File, kind = "Site Photo") => {
    if (!detail?.project?.id) return;
    const f = new FormData();
    f.set("projectId", detail.project.id);
    f.set("file", file);
    f.set("kind", kind);
    const r = await fetch("/api/projects/attachments", {
      method: "POST",
      body: f,
    });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || "Upload failed");
    setMsg("File uploaded successfully");
    open(detail.project.id);
  };

  const deleteProject = async (id: string) => {
    if (
      !confirm(
        `Permanently delete project ${id}? All linked tasks and records will be deleted. This cannot be undone.`
      )
    )
      return;
    const r = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || "Unable to delete project");
    setMsg(`Project ${id} permanently deleted`);
    setDetail(null);
    load();
  };

  const stats = useMemo(
    () => ({
      active: rows.filter((x) => !["Completed", "Cancelled"].includes(x.status))
        .length,
      delayed: rows.filter((x) => x.health === "Delayed").length,
      installation: rows.filter((x) => x.status.includes("Installation"))
        .length,
      material: rows.filter((x) => x.health === "Waiting for Material").length,
      payment: rows.filter((x) => Number(x.pending) > 0).length,
      handover: rows.filter((x) => x.status === "Handover & Training").length,
    }),
    [rows]
  );

  return (
    <div className="projectsystem">
      <div className="projecthero">
        <div>
          <small>POST-SALE EXECUTION SYSTEM</small>
          <h1>Projects</h1>
          <p>
            Scope, people, materials, payments, installation, testing, handover and warranty in one permanent record.
          </p>
        </div>
        {role !== "technician" && (
          <button className="primary" onClick={() => setShow(true)}>
            ＋ Create Project
          </button>
        )}
      </div>

      {msg && (
        <div className="projectmsg">
          <span>{msg}</span>
          <button onClick={() => setMsg("")}>×</button>
        </div>
      )}

      {/* Quick KPI filter pills */}
      <div className="projectstats">
        <button
          className={!filter.alert && !filter.status ? "active" : ""}
          onClick={() => setFilter({ ...filter, alert: "", status: "" })}
        >
          <small>ALL ACTIVE</small>
          <b>{stats.active}</b>
        </button>
        <button
          className={filter.alert === "delayed" ? "active alert-red" : ""}
          onClick={() =>
            setFilter({
              ...filter,
              alert: filter.alert === "delayed" ? "" : "delayed",
            })
          }
        >
          <small>DELAYED</small>
          <b>{stats.delayed}</b>
        </button>
        <button
          className={filter.status === "Installation" ? "active alert-blue" : ""}
          onClick={() =>
            setFilter({
              ...filter,
              status: filter.status === "Installation" ? "" : "Installation",
            })
          }
        >
          <small>INSTALLATION</small>
          <b>{stats.installation}</b>
        </button>
        <button
          className={filter.alert === "material" ? "active alert-amber" : ""}
          onClick={() =>
            setFilter({
              ...filter,
              alert: filter.alert === "material" ? "" : "material",
            })
          }
        >
          <small>WAITING MATERIAL</small>
          <b>{stats.material}</b>
        </button>
        <button
          className={filter.alert === "payment" ? "active" : ""}
          onClick={() =>
            setFilter({
              ...filter,
              alert: filter.alert === "payment" ? "" : "payment",
            })
          }
        >
          <small>PENDING PAYMENT</small>
          <b>{stats.payment}</b>
        </button>
        <button
          className={filter.status === "Handover & Training" ? "active alert-green" : ""}
          onClick={() =>
            setFilter({
              ...filter,
              status:
                filter.status === "Handover & Training"
                  ? ""
                  : "Handover & Training",
            })
          }
        >
          <small>HANDOVER READY</small>
          <b>{stats.handover}</b>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="projecttools">
        <input
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Search by project, customer, site, quote, phone or manager…"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All stages</option>
          {stages.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select
          value={filter.health}
          onChange={(e) => setFilter({ ...filter, health: e.target.value })}
        >
          <option value="">All health</option>
          {healthOptions.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>

      {/* Project Master Table */}
      <div className="projecttable">
        <div
          className={`projectrow ${role === "technician" ? "tech" : ""} ${role === "admin" ? "admin" : ""} projecthead`}
        >
          <span>Project</span>
          <span>Customer / Location</span>
          <span>Quote</span>
          {role !== "technician" && (
            <>
              <span>Value</span>
              <span>Received / Pending</span>
            </>
          )}
          <span>Stage / Health</span>
          <span>Manager / Due</span>
          <span>Next task</span>
          {role === "admin" && <span>Actions</span>}
        </div>
        {rows.length === 0 ? (
          <div className="projectempty">No projects match the selected criteria.</div>
        ) : (
          rows.map((p) => (
            <div
              className={`projectrow ${role === "technician" ? "tech" : ""} ${role === "admin" ? "admin" : ""} ${detail?.project?.id === p.id ? "row-selected" : ""}`}
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => open(p.id)}
            >
              <span>
                <b className="pcode">{p.id}</b>
                <small className="ptitle">{p.title}</small>
              </span>
              <span>
                <b>{p.customer_name}</b>
                <small>
                  {p.site_name} · {p.city}
                </small>
              </span>
              <span>
                <b>{p.quote_number || "Direct"}</b>
                <small>{p.category}</small>
              </span>
              {role !== "technician" && (
                <>
                  <span>
                    <b>{money(p.value)}</b>
                  </span>
                  <span>
                    <b className="receivedval">{money(p.received)}</b>
                    <small className={Number(p.pending) > 0 ? "pendingval" : ""}>
                      {money(p.pending)} pending
                    </small>
                  </span>
                </>
              )}
              <span>
                <em className={`stagepill stage-${String(p.status).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                  {p.status}
                </em>
                <small className={`healthpill health-${String(p.health).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                  ● {p.health || "On Track"}
                </small>
              </span>
              <span>
                <b>{p.manager_name || "Unassigned"}</b>
                <small>{p.planned_end || "No due date"}</small>
              </span>
              <span>
                <b className="nexttasktext">{p.next_task || "No pending task"}</b>
              </span>
              {role === "admin" && (
                <span className="projectactions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="delbtn"
                    title="Permanently delete project"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(p.id);
                    }}
                  >
                    🗑
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="projectpages">
        <button
          disabled={meta.page <= 1}
          onClick={() => setFilter({ ...filter, page: String(meta.page - 1) })}
        >
          ← Previous
        </button>
        <span>
          {meta.total} projects · Page {meta.page} of {meta.pages}
        </span>
        <button
          disabled={meta.page >= meta.pages}
          onClick={() => setFilter({ ...filter, page: String(meta.page + 1) })}
        >
          Next →
        </button>
      </div>

      {/* Create Project Modal */}
      {show && (
        <ProjectCreate
          v={form}
          set={setForm}
          options={options}
          close={() => setShow(false)}
          save={create}
        />
      )}

      {/* Project Detail Drawer with Backdrop */}
      {detail && (
        <>
          <div
            className="projectdrawer-backdrop"
            onClick={() => setDetail(null)}
            title="Click to close project view"
          />
          <ProjectDetail
            d={detail}
            role={role}
            tab={tab}
            setTab={setTab}
            close={() => setDetail(null)}
            act={act}
            upload={upload}
            deleteProject={deleteProject}
            navigate={onNavigate}
            users={options.users || []}
          />
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// CREATE PROJECT MODAL
// -------------------------------------------------------------
function ProjectCreate({
  v,
  set,
  options,
  close,
  save,
}: {
  v: R;
  set: (x: R) => void;
  options: R;
  close: () => void;
  save: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const sites = useMemo(() => {
    return (options.sites || []).filter(
      (x: R) => String(x.customer_id) === String(v.customerId)
    );
  }, [options.sites, v.customerId]);

  const customerQuotes = useMemo(() => {
    return (options.quotes || []).filter(
      (x: R) => String(x.customer_id) === String(v.customerId)
    );
  }, [options.quotes, v.customerId]);

  const handleSave = async () => {
    setErr("");
    if (!v.customerId) {
      setErr("Please select a customer.");
      return;
    }
    if (!v.direct && !v.quotationId) {
      setErr("Please select an accepted quotation.");
      return;
    }
    if (!v.title?.trim()) {
      setErr("Please enter a project title.");
      return;
    }
    if (!v.managerId) {
      setErr("Please select a project manager.");
      return;
    }
    if (v.direct) {
      if (!v.scope?.trim()) {
        setErr("Please describe the scope of work.");
        return;
      }
      if (!v.directReason?.trim()) {
        setErr("Please specify direct creation approval reason.");
        return;
      }
    }

    setSaving(true);
    const res = await save();
    if (!res.ok) {
      setErr(res.error || "Failed to create project");
      setSaving(false);
    }
  };

  return (
    <div className="projectmodal-back" onClick={close}>
      <div className="projectmodal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <small>POST-SALE SETUP</small>
            <h2>Create New Project</h2>
          </div>
          <button className="closebtn" onClick={close} title="Close">
            ×
          </button>
        </header>

        <div className="projectform">
          <div className="projectmodal-workflow-pills">
            <button
              type="button"
              className={!v.direct ? "active" : ""}
              onClick={() => set({ ...v, direct: false })}
            >
              📋 From Accepted Quotation
            </button>
            <button
              type="button"
              className={v.direct ? "active" : ""}
              onClick={() => set({ ...v, direct: true })}
            >
              ⚡ Direct Service / Small Work
            </button>
          </div>

          {err && (
            <div className="projectmodal-error">
              <span>⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <label>
            <span>
              Customer <b>*</b>
            </span>
            <select
              value={v.customerId}
              onChange={(e) => {
                const cId = e.target.value;
                const cust = (options.customers || []).find(
                  (x: R) => String(x.id) === String(cId)
                );
                set({
                  ...v,
                  customerId: cId,
                  siteId: "",
                  quotationId: "",
                  address: cust?.billing_address || v.address || "",
                  title: v.title || (cust?.name ? `${cust.name} Project` : ""),
                });
              }}
            >
              <option value="">Select customer</option>
              {(options.customers || []).map((x: R) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Project Location / Address</span>
            <input
              type="text"
              placeholder="e.g. Site address or landmark"
              value={v.address || v.siteAddress || ""}
              onChange={(e) =>
                set({
                  ...v,
                  address: e.target.value,
                  siteAddress: e.target.value,
                })
              }
            />
          </label>

          {sites.length > 1 && (
            <label>
              <span>Existing Project / Site</span>
              <select
                value={v.siteId || ""}
                onChange={(e) => {
                  const s = sites.find((x: R) => String(x.id) === e.target.value);
                  set({
                    ...v,
                    siteId: e.target.value,
                    address: s?.address || v.address,
                  });
                }}
              >
                <option value="">Auto-create / Use project location</option>
                {sites.map((x: R) => (
                  <option key={x.id} value={x.id}>
                    {x.name} {x.city ? `(${x.city})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!v.direct && (
            <label className="wide">
              <span>
                Accepted Quotation <b>*</b>
              </span>
              <select
                value={v.quotationId}
                disabled={!v.customerId}
                onChange={(e) => {
                  const qId = e.target.value;
                  const q = customerQuotes.find((x: R) => String(x.id) === String(qId));
                  const cust = (options.customers || []).find(
                    (x: R) => String(x.id) === String(v.customerId)
                  );
                  set({
                    ...v,
                    quotationId: qId,
                    siteId: q?.site_id ? String(q.site_id) : v.siteId,
                    title:
                      v.title ||
                      (q ? `${cust?.name || "Project"} - ${q.number}` : v.title),
                    value: q?.total || v.value,
                  });
                }}
              >
                <option value="">
                  {!v.customerId
                    ? "Select customer first"
                    : customerQuotes.length === 0
                    ? "No accepted quotations for this customer"
                    : "Select accepted quote"}
                </option>
                {customerQuotes.map((x: R) => (
                  <option key={x.id} value={x.id}>
                    {x.number} · {money(x.total)}
                  </option>
                ))}
              </select>
              {v.customerId && customerQuotes.length === 0 && (
                <span className="projectmodal-hint">
                  Tip: If there are no accepted quotes, switch above to "Direct Service / Small Work".
                </span>
              )}
            </label>
          )}

          <label className="wide">
            <span>
              Project Title <b>*</b>
            </span>
            <input
              placeholder="e.g. Kurumbapalayam Smart Home Automation"
              value={v.title}
              onChange={(e) => set({ ...v, title: e.target.value })}
            />
          </label>

          <label>
            <span>Category</span>
            <select
              value={v.category}
              onChange={(e) => set({ ...v, category: e.target.value })}
            >
              {categories.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>
              Project Manager <b>*</b>
            </span>
            <select
              value={v.managerId}
              onChange={(e) => set({ ...v, managerId: e.target.value })}
            >
              <option value="">Select manager</option>
              {(options.users || []).map((x: R) => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.role}
                </option>
              ))}
            </select>
          </label>

          {v.direct && (
            <>
              <label className="wide">
                <span>
                  Scope of Work <b>*</b>
                </span>
                <textarea
                  rows={3}
                  placeholder="Detail scope, switches, sensors, wiring checks, direct deliverables..."
                  value={v.scope}
                  onChange={(e) => set({ ...v, scope: e.target.value })}
                />
              </label>
              <label>
                <span>Estimated Value (₹)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={v.value}
                  onChange={(e) => set({ ...v, value: e.target.value })}
                />
              </label>
              <label>
                <span>
                  Direct Creation Reason <b>*</b>
                </span>
                <input
                  placeholder="e.g. Small/service work approved by Admin"
                  value={v.directReason}
                  onChange={(e) => set({ ...v, directReason: e.target.value })}
                />
              </label>
            </>
          )}

          <label>
            <span>Planned Start Date</span>
            <input
              type="date"
              value={v.plannedStart}
              onChange={(e) => set({ ...v, plannedStart: e.target.value })}
            />
          </label>

          <label>
            <span>Planned Completion Date</span>
            <input
              type="date"
              value={v.plannedEnd}
              onChange={(e) => set({ ...v, plannedEnd: e.target.value })}
            />
          </label>
        </div>

        <footer>
          <button type="button" disabled={saving} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Creating Project…" : "Create Execution Project"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PROJECT DETAIL DRAWER
// -------------------------------------------------------------
function ProjectDetail({
  d,
  role,
  tab,
  setTab,
  close,
  act,
  upload,
  deleteProject,
  navigate,
  users,
}: {
  d: R;
  role: string;
  tab: string;
  setTab: (x: string) => void;
  close: () => void;
  act: (x: R) => void;
  upload: (f: File, k?: string) => void;
  deleteProject: (id: string) => void;
  navigate: (x: string) => void;
  users: R[];
}) {
  const p = d.project;
  const admin = role === "admin";
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<string | null>(null);

  // Status modal state
  const [nextStage, setNextStage] = useState(p.status);
  const [nextHealth, setNextHealth] = useState(p.health || "On Track");
  const [statusNotes, setStatusNotes] = useState("");

  // Task modal state
  const [taskForm, setTaskForm] = useState({
    title: "",
    category: "Installation",
    dueAt: "",
    assignedTo: p.manager_id || "",
    assignedBy: p.manager_id || "",
    priority: "Normal",
    mandatory: false,
    notes: "",
  });

  // Team modal state
  const [teamForm, setTeamForm] = useState({
    userId: "",
    role: "Technician",
  });

  // Scope variation modal state
  const [varForm, setVarForm] = useState({
    reason: "",
    valueImpact: "0",
    paymentImpact: "Recalculate milestones",
  });

  // Handover modal state
  const [handoverForm, setHandoverForm] = useState({
    accepted: true,
    trainingCompleted: true,
    notes: "",
  });

  // Close with Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modal) close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close, modal]);

  return (
    <div className={`projectdrawer ${expanded ? "expanded" : ""}`}>
      {/* Drawer Header */}
      <header>
        <div className="phead-left">
          <div className="phead-badge-row">
            <span className="phead-id">{p.id}</span>
            <span className={`phead-health health-${String(p.health).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
              ● {p.health || "On Track"}
            </span>
            <span className={`phead-status stage-${String(p.status).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
              {p.status}
            </span>
            <span className="phead-cat">{p.category}</span>
          </div>
          <h2>{p.title}</h2>
          <div className="phead-meta">
            <span>👤 {p.customer_name}</span>
            {p.phone && (
              <a href={`tel:${p.phone}`} className="phead-link">
                📞 {p.phone}
              </a>
            )}
            <span>📍 {p.site_name}, {p.city}</span>
            {p.quote_number && (
              <span className="phead-quote">
                📄 Quote: {p.quote_number} (Rev {p.quotation_revision || 0})
              </span>
            )}
          </div>
        </div>
        <div className="phead-right">
          <button
            type="button"
            className="expandbtn"
            title={expanded ? "Restore drawer view" : "Expand to wide canvas"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "⤡ Side panel" : "⤢ Full view"}
          </button>
          <button type="button" className="closebtn" onClick={close} title="Close project view">
            ×
          </button>
        </div>
      </header>

      {/* Primary Action Toolbar */}
      <div className="projectquick">
        <button className="btn-primary" onClick={() => setModal("status")}>
          ⚙ Update status
        </button>
        <button onClick={() => setModal("task")}>＋ Add task</button>
        <button onClick={() => navigate("Payments")}>💳 Record payment</button>
        <button onClick={() => setTab("Materials and Procurement")}>
          📦 Procurement
        </button>
        <button onClick={() => setModal("team")}>👤 Assign staff</button>
        <label className="uploadbtn">
          📷 Site photo
          <input
            type="file"
            accept="image/*,.pdf,video/mp4"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        {p.status !== "Installation" && p.status !== "Completed" && (
          <button
            className="btn-success"
            onClick={() =>
              act({
                action: "status",
                status: "Installation",
                notes: "Installation started from quick action bar",
              })
            }
          >
            ▶ Start installation
          </button>
        )}
        <button onClick={() => setModal("handover")}>🤝 Complete handover</button>
        <button onClick={() => navigate("Invoices")}>🧾 View invoices</button>
        {admin && (
          <button onClick={() => navigate("Expenses")}>💰 Add expense</button>
        )}
        {admin && (
          <button
            className="btn-danger"
            onClick={() => deleteProject(p.id)}
          >
            🗑 Delete
          </button>
        )}
      </div>

      {/* Polished Tab Navigation */}
      <nav className="projecttabnav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tabbtn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tabicon">{t.icon}</span>
            <span className="tablabel">{t.label}</span>
            {t.id === "Tasks and Checklist" && (d.tasks || []).length > 0 && (
              <span className="tabcount">
                {(d.tasks || []).filter((x: R) => x.status !== "Completed").length}
              </span>
            )}
            {t.id === "Materials and Procurement" && (d.materials || []).length > 0 && (
              <span className="tabcount">{(d.materials || []).length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Main Tab View Canvas */}
      <main>
        {tab === "Overview" ? (
          <div className="projectoverview">
            {/* Executive KPI Cards */}
            <div className="projectsummary">
              {role !== "technician" && (
                <div className="kpicard financial">
                  <div className="kpi-head">
                    <small>TOTAL VALUE</small>
                    <span className="kpi-badge">
                      {Math.round((Number(d.summary.received || 0) / Math.max(1, Number(p.value || 1))) * 100)}% Collected
                    </span>
                  </div>
                  <b>{money(p.value)}</b>
                  <div className="kpi-progress">
                    <div
                      className="kpi-bar"
                      style={{
                        width: `${Math.min(100, Math.round((Number(d.summary.received || 0) / Math.max(1, Number(p.value || 1))) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="kpi-sub">
                    <span className="text-emerald">Recv: {money(d.summary.received)}</span>
                    <span className="text-rose">Due: {money(d.summary.pending)}</span>
                  </div>
                </div>
              )}

              <div className="kpicard tasks">
                <div className="kpi-head">
                  <small>TASKS EXECUTION</small>
                  <span className="kpi-badge">{d.summary.taskPct}%</span>
                </div>
                <b>
                  {(d.tasks || []).filter((x: R) => x.status === "Completed").length} / {(d.tasks || []).length} Done
                </b>
                <div className="kpi-progress">
                  <div
                    className="kpi-bar"
                    style={{ width: `${Math.min(100, d.summary.taskPct || 0)}%` }}
                  />
                </div>
                <div className="kpi-sub">
                  <span>Next: {d.summary.nextTask}</span>
                </div>
              </div>

              <div className="kpicard materials">
                <div className="kpi-head">
                  <small>MATERIAL READINESS</small>
                  <span className="kpi-badge">{d.summary.materialPct}%</span>
                </div>
                <b>
                  {d.summary.materialPct === 100 ? "Ready at Site" : `${d.summary.materialPct}% Prepared`}
                </b>
                <div className="kpi-progress">
                  <div
                    className="kpi-bar"
                    style={{ width: `${Math.min(100, d.summary.materialPct || 0)}%` }}
                  />
                </div>
                <div className="kpi-sub">
                  <span>{(d.materials || []).length} procurement items tracked</span>
                </div>
              </div>

              <div className="kpicard schedule">
                <div className="kpi-head">
                  <small>SCHEDULE & HEALTH</small>
                  <span className={`health-dot health-${String(p.health).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                    {p.health || "On Track"}
                  </span>
                </div>
                <b>{p.planned_end || "No end date"}</b>
                <div className="kpi-sub">
                  <span>Start: {p.planned_start || "Not set"}</span>
                </div>
              </div>
            </div>

            {/* Visual Stage Stepper */}
            <div className="stagestepper">
              <span className="steppertitle">Execution Pipeline</span>
              <div className="stepperbar">
                {["Confirmed", "Procurement", "Installation", "Testing & Configuration", "Handover & Training"].map(
                  (stg, idx) => {
                    const currentIndex = stages.indexOf(p.status);
                    const stepIndex = stages.indexOf(stg);
                    const isPassed = currentIndex >= stepIndex;
                    const isCurrent = p.status === stg || (currentIndex >= stepIndex && currentIndex < stages.indexOf(stages[stepIndex + 2] || "Completed"));
                    return (
                      <div key={stg} className={`stepnode ${isPassed ? "completed" : ""} ${isCurrent ? "active" : ""}`}>
                        <span className="stepdot">{isPassed ? "✓" : idx + 1}</span>
                        <span className="steplabel">{stg}</span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Context Cards Grid */}
            <div className="projectinfo">
              {/* Customer & Location */}
              <section className="infocard">
                <div className="infocard-head">
                  <h3>Customer & Project Details</h3>
                  <button
                    className="ghostbtn"
                    onClick={() => navigate("Customers")}
                  >
                    Open CRM →
                  </button>
                </div>
                <div className="inforow">
                  <span>Customer Name</span>
                  <b>{p.customer_name}</b>
                </div>
                {p.phone && (
                  <div className="inforow">
                    <span>Phone Number</span>
                    <b>
                      <a href={`tel:${p.phone}`}>{p.phone}</a>
                    </b>
                  </div>
                )}
                <div className="inforow">
                  <span>Project Location / Address</span>
                  <b>{p.site_address || "—"}, {p.city || ""}</b>
                </div>
                <div className="inforow">
                  <span>Primary Contact</span>
                  <b>{p.primary_contact || "Primary customer contact"}</b>
                </div>
              </section>

              {/* Execution & Assignment */}
              <section className="infocard">
                <div className="infocard-head">
                  <h3>Execution Management</h3>
                  <button className="ghostbtn" onClick={() => setModal("status")}>
                    Manage →
                  </button>
                </div>
                <div className="inforow">
                  <span>Project Manager</span>
                  <b>{p.manager_name || "Unassigned"}</b>
                </div>
                <div className="inforow">
                  <span>Sales Representative</span>
                  <b>{p.sales_name || "Direct / Admin"}</b>
                </div>
                <div className="inforow">
                  <span>Quotation Reference</span>
                  <b>{p.quote_number || "Direct project"} (Rev {p.quotation_revision || 0})</b>
                </div>
                <div className="inforow">
                  <span>Planned Timeline</span>
                  <b>{p.planned_start || "—"} to {p.planned_end || "—"}</b>
                </div>
              </section>
            </div>

            {/* Next Tasks Quick Preview */}
            <div className="infocard mt-4">
              <div className="infocard-head">
                <h3>Immediate Next Tasks</h3>
                <button className="ghostbtn" onClick={() => setTab("Tasks and Checklist")}>
                  View all checklist ({(d.tasks || []).length}) →
                </button>
              </div>
              <div className="quicktasklist">
                {(d.tasks || [])
                  .filter((x: R) => x.status !== "Completed")
                  .slice(0, 4)
                  .map((t: R) => (
                    <div key={t.id} className="quicktaskitem">
                      <div className="quicktaskinfo">
                        <span className="taskcat">{t.category}</span>
                        <b>{t.title}</b>
                        <small>Due: {t.due_at || "Not scheduled"} · To: {t.assigned_name || "Unassigned"} · By: {t.assigned_by_name || p.manager_name || "Manager"}</small>
                      </div>
                      <button
                        className="markdonebtn"
                        onClick={() =>
                          act({
                            action: "completeTask",
                            taskId: t.id,
                            notes: "Marked done from Project Overview",
                          })
                        }
                      >
                        ✓ Mark Done
                      </button>
                    </div>
                  ))}
                {(d.tasks || []).filter((x: R) => x.status !== "Completed").length === 0 && (
                  <div className="alltaskscomplete">
                    ✓ All project tasks and checklists are completed!
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <ProjectTab
            tab={tab}
            d={d}
            admin={admin}
            role={role}
            act={act}
            upload={upload}
            openModal={setModal}
          />
        )}
      </main>

      {/* In-app Status Modal */}
      {modal === "status" && (
        <div className="submodal-back" onClick={() => setModal(null)}>
          <div className="submodal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Update Project Status & Health</h3>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            <div className="submodal-body">
              <label>
                <span>Project Stage</span>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Execution Health</span>
                <select
                  value={nextHealth}
                  onChange={(e) => setNextHealth(e.target.value)}
                >
                  {healthOptions.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status Update Notes</span>
                <textarea
                  rows={3}
                  placeholder="Record progress, notes, or delay reasons…"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                />
              </label>
            </div>
            <footer>
              <button onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  act({
                    action: "status",
                    status: nextStage,
                    health: nextHealth,
                    notes: statusNotes,
                  });
                  setModal(null);
                }}
              >
                Save Status
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* In-app Task Modal */}
      {modal === "task" && (
        <div className="submodal-back" onClick={() => setModal(null)}>
          <div className="submodal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Add Project Task</h3>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            <div className="submodal-body">
              <label>
                <span>Task Title *</span>
                <input
                  placeholder="e.g. Living room switch gang wiring check"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Category</span>
                <select
                  value={taskForm.category}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, category: e.target.value })
                  }
                >
                  <option value="Electrical Check">Electrical Check</option>
                  <option value="Material Planning">Material Planning</option>
                  <option value="Installation">Installation</option>
                  <option value="Configuration">Configuration</option>
                  <option value="Testing">Testing</option>
                  <option value="Customer Training">Customer Training</option>
                  <option value="Handover">Handover</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label>
                <span>Assign To</span>
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, assignedTo: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map((u: R) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assigned By</span>
                <select
                  value={taskForm.assignedBy}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, assignedBy: e.target.value })
                  }
                >
                  <option value="">Select assigner</option>
                  {users.map((u: R) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Due Date</span>
                <input
                  type="date"
                  value={taskForm.dueAt}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, dueAt: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, priority: e.target.value })
                  }
                >
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </label>
            </div>
            <footer>
              <button onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (!taskForm.title) return alert("Task title is required");
                  act({
                    action: "task",
                    ...taskForm,
                  });
                  setModal(null);
                  setTaskForm({
                    title: "",
                    category: "Installation",
                    dueAt: "",
                    assignedTo: p.manager_id || "",
                    assignedBy: p.manager_id || "",
                    priority: "Normal",
                    mandatory: false,
                    notes: "",
                  });
                }}
              >
                Create Task
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* In-app Team Modal */}
      {modal === "team" && (
        <div className="submodal-back" onClick={() => setModal(null)}>
          <div className="submodal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Assign Team Member</h3>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            <div className="submodal-body">
              <label>
                <span>Employee *</span>
                <select
                  value={teamForm.userId}
                  onChange={(e) =>
                    setTeamForm({ ...teamForm, userId: e.target.value })
                  }
                >
                  <option value="">Select employee</option>
                  {users.map((u: R) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Project Role</span>
                <select
                  value={teamForm.role}
                  onChange={(e) =>
                    setTeamForm({ ...teamForm, role: e.target.value })
                  }
                >
                  <option value="Lead Technician">Lead Technician</option>
                  <option value="Technician">Technician</option>
                  <option value="Electrician">Electrician</option>
                  <option value="Site Engineer">Site Engineer</option>
                  <option value="Project Manager">Project Manager</option>
                </select>
              </label>
            </div>
            <footer>
              <button onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (!teamForm.userId) return alert("Select an employee");
                  act({
                    action: "team",
                    ...teamForm,
                  });
                  setModal(null);
                }}
              >
                Assign Member
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* In-app Handover Modal */}
      {modal === "handover" && (
        <div className="submodal-back" onClick={() => setModal(null)}>
          <div className="submodal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Record Customer Handover & Sign-off</h3>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            <div className="submodal-body">
              <label className="checkboxlabel">
                <input
                  type="checkbox"
                  checked={handoverForm.trainingCompleted}
                  onChange={(e) =>
                    setHandoverForm({
                      ...handoverForm,
                      trainingCompleted: e.target.checked,
                    })
                  }
                />
                <span>Customer application training has been fully completed</span>
              </label>
              <label className="checkboxlabel">
                <input
                  type="checkbox"
                  checked={handoverForm.accepted}
                  onChange={(e) =>
                    setHandoverForm({
                      ...handoverForm,
                      accepted: e.target.checked,
                    })
                  }
                />
                <span>Customer has verified site & signed handover acceptance</span>
              </label>
              <label>
                <span>Handover Notes / Snags (if any)</span>
                <textarea
                  rows={3}
                  placeholder="Record customer feedback or minor snag resolution notes…"
                  value={handoverForm.notes}
                  onChange={(e) =>
                    setHandoverForm({ ...handoverForm, notes: e.target.value })
                  }
                />
              </label>
            </div>
            <footer>
              <button onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  act({
                    action: "handover",
                    handover: handoverForm,
                    date: new Date().toISOString(),
                    notes: handoverForm.notes || "Customer handover recorded",
                  });
                  setModal(null);
                }}
              >
                Complete Handover
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* In-app Scope Variation Modal */}
      {modal === "variation" && (
        <div className="submodal-back" onClick={() => setModal(null)}>
          <div className="submodal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Approved Scope Variation</h3>
              <button onClick={() => setModal(null)}>×</button>
            </header>
            <div className="submodal-body">
              <label>
                <span>Variation Reason / Description *</span>
                <textarea
                  rows={3}
                  placeholder="e.g. Added 2 Master Bedroom Touch Switches upon customer request"
                  value={varForm.reason}
                  onChange={(e) =>
                    setVarForm({ ...varForm, reason: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Value Impact (₹)</span>
                <input
                  type="number"
                  placeholder="0"
                  value={varForm.valueImpact}
                  onChange={(e) =>
                    setVarForm({ ...varForm, valueImpact: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Payment Schedule Impact</span>
                <input
                  value={varForm.paymentImpact}
                  onChange={(e) =>
                    setVarForm({ ...varForm, paymentImpact: e.target.value })
                  }
                />
              </label>
            </div>
            <footer>
              <button onClick={() => setModal(null)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (!varForm.reason) return alert("Enter variation reason");
                  act({
                    action: "variation",
                    reason: varForm.reason,
                    valueImpact: Number(varForm.valueImpact || 0),
                    paymentImpact: varForm.paymentImpact,
                  });
                  setModal(null);
                  setVarForm({
                    reason: "",
                    valueImpact: "0",
                    paymentImpact: "Recalculate milestones",
                  });
                }}
              >
                Approve Variation
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// TAB CONTENT SWITCHER
// -------------------------------------------------------------
function ProjectTab({
  tab,
  d,
  admin,
  role,
  act,
  upload,
  openModal,
}: {
  tab: string;
  d: R;
  admin: boolean;
  role: string;
  act: (x: R) => void;
  upload: (f: File, k?: string) => void;
  openModal: (m: string) => void;
}) {
  const p = d.project;

  // 1. SCOPE AND BOQ
  if (tab === "Scope and Room-wise Items") {
    let parsedScope: R | null = null;
    try {
      if (typeof p.scope_snapshot === "string") {
        parsedScope = JSON.parse(p.scope_snapshot);
      } else if (p.scope_snapshot && typeof p.scope_snapshot === "object") {
        parsedScope = p.scope_snapshot;
      }
    } catch {
      parsedScope = null;
    }

    const floors = parsedScope?.floors || [];
    const hasRoomBOQ = Array.isArray(floors) && floors.length > 0;

    return (
      <div className="tabcontent-wrap">
        <div className="tabactionbar">
          <div className="scopelock-badge">
            🔒 Original Accepted Scope · Changes require an Admin-approved variation
          </div>
          {admin && (
            <button
              className="btn-primary"
              onClick={() => openModal("variation")}
            >
              ＋ Add Approved Variation
            </button>
          )}
        </div>

        {hasRoomBOQ ? (
          <div className="boqfloors-wrap">
            {floors.map((fl: R, fidx: number) => (
              <div key={fl.name || fidx} className="boqfloor-card">
                <div className="boqfloor-header">
                  <h4>🏢 {fl.name || `Floor ${fidx + 1}`}</h4>
                  <span>{(fl.rooms || []).length} Rooms</span>
                </div>
                <div className="boqrooms-grid">
                  {(fl.rooms || []).map((rm: R, ridx: number) => (
                    <div key={rm.name || ridx} className="boqroom-card">
                      <div className="boqroom-head">
                        <b>{rm.name}</b>
                        <small>{(rm.items || []).length} Items</small>
                      </div>
                      <div className="boqitems-list">
                        {(rm.items || []).map((it: R, iidx: number) => (
                          <div key={it.id || iidx} className="boqitem-row">
                            <div className="boqitem-thumb">
                              {it.image ? (
                                <img src={it.image} alt={it.name} />
                              ) : (
                                <span>⚡</span>
                              )}
                            </div>
                            <div className="boqitem-details">
                              <b>{it.name}</b>
                              <small>{it.variant || it.series || it.sku || "Automation Item"}</small>
                            </div>
                            <div className="boqitem-qty">
                              <span>Qty</span>
                              <b>{it.qty || 1}</b>
                            </div>
                          </div>
                        ))}
                        {(rm.items || []).length === 0 && (
                          <div className="boqempty">No specific devices placed in this room.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="directscope-card">
            <h3>Direct Scope of Execution</h3>
            <p className="directscopetext">
              {parsedScope?.scope || p.scope || "Full Automation and installation scope as confirmed by customer."}
            </p>
            {p.direct_reason && (
              <div className="directreason-box">
                <span className="directreason-lbl">Approval Justification:</span>
                <span className="directreason-val">{p.direct_reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Variations History */}
        {(d.variations || []).length > 0 && (
          <div className="variationsection">
            <h3>Approved Scope Variations ({(d.variations || []).length})</h3>
            <div className="variationlist">
              {(d.variations || []).map((v: R) => (
                <div key={v.id} className="varitem">
                  <div>
                    <b>{v.reason}</b>
                    <small>Impact: {money(v.value_impact)} · {new Date(v.created_at).toLocaleDateString("en-IN")}</small>
                  </div>
                  <span className="varstatus">Approved</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. TASKS & CHECKLIST
  if (tab === "Tasks and Checklist") {
    return (
      <div className="tabcontent-wrap">
        <div className="tabactionbar">
          <div className="taskprogress-info">
            <b>{(d.tasks || []).filter((x: R) => x.status === "Completed").length} of {(d.tasks || []).length} completed</b>
          </div>
          <button className="btn-primary" onClick={() => openModal("task")}>
            ＋ Add Checklist Task
          </button>
        </div>
        <div className="projectcardslist">
          {(d.tasks || []).map((x: R) => (
            <article key={x.id} className={`taskcard ${x.status === "Completed" ? "completed" : ""}`}>
              <div className="taskcard-main">
                <div className="taskcard-tags">
                  <em className="taskcat">{x.category}</em>
                  <span className={`taskpriority prio-${String(x.priority).toLowerCase()}`}>{x.priority}</span>
                  {x.mandatory && <span className="taskmand">Mandatory</span>}
                </div>
                <b>{x.title}</b>
                <div className="taskcard-assignees">
                  <span>👤 Assigned to: <b>{x.assigned_name || "Unassigned"}</b></span>
                  <span>✍️ Assigned by: <b>{x.assigned_by_name || p.manager_name || "Manager"}</b></span>
                  <span>📅 Due: <b>{x.due_at || "Not set"}</b></span>
                </div>
                {x.notes && <p className="tasknotes">{x.notes}</p>}
              </div>
              <div className="taskcard-actions">
                <strong className={`statusbadge status-${String(x.status).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                  {x.status}
                </strong>
                {x.status !== "Completed" && (
                  <button
                    className="btn-success-sm"
                    onClick={() =>
                      act({
                        action: "completeTask",
                        taskId: x.id,
                        notes: "Completed by user sign-off",
                      })
                    }
                  >
                    ✓ Complete
                  </button>
                )}
              </div>
            </article>
          ))}
          {(d.tasks || []).length === 0 && (
            <div className="projectempty">No tasks added to this project yet.</div>
          )}
        </div>
      </div>
    );
  }

  // 3. MATERIALS & PROCUREMENT
  if (tab === "Materials and Procurement") {
    return (
      <div className="tabcontent-wrap">
        <div className="materialtable">
          <div className="materialrow materialhead">
            <span>Item & SKU</span>
            <span>Required</span>
            <span>Ordered</span>
            <span>Received</span>
            <span>At site</span>
            <span>Installed</span>
            <span>Pending</span>
            <span>Status</span>
            {admin && <span>Cost</span>}
          </div>
          {(d.materials || []).map((x: R) => (
            <div
              className="materialrow"
              key={x.id}
            >
              <span>
                <b>{x.name}</b>
                <small>{x.sku || "Custom Item"}</small>
              </span>
              <span><b>{x.required_qty}</b></span>
              <span>{x.ordered_qty}</span>
              <span>{x.received_qty}</span>
              <span>{x.at_site_qty}</span>
              <span>{x.installed_qty}</span>
              <span className={x.required_qty > x.received_qty ? "text-rose" : "text-emerald"}>
                {Math.max(0, x.required_qty - x.received_qty)}
              </span>
              <span>
                <em className={`matstatus mat-${String(x.status).toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
                  {x.status}
                </em>
              </span>
              {admin && <span><b>{money(x.buying_price)}</b></span>}
            </div>
          ))}
          {(d.materials || []).length === 0 && (
            <div className="projectempty">No material items linked to this project.</div>
          )}
        </div>
      </div>
    );
  }

  // 4. TEAM & SCHEDULE
  if (tab === "Team and Schedule") {
    return (
      <div className="tabcontent-wrap">
        <div className="tabactionbar">
          <div><b>Assigned Execution Staff ({(d.team || []).length})</b></div>
          <button className="btn-primary" onClick={() => openModal("team")}>
            ＋ Assign Member
          </button>
        </div>
        <div className="teamgrid">
          {(d.team || []).map((x: R) => (
            <div key={x.id} className="teamcard">
              <div className="teamavatar">{String(x.name || "U")[0]}</div>
              <div className="teaminfo">
                <b>{x.name}</b>
                <span className="teamrole">{x.role}</span>
                <small>Assigned: {x.assigned_at ? new Date(x.assigned_at).toLocaleDateString("en-IN") : "—"}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. PAYMENTS & INVOICES
  if (tab === "Payments and Invoice") {
    return (
      <div className="tabcontent-wrap">
        <div className="financegrid">
          {/* Payment Milestones */}
          <div className="milestones-card">
            <h4>Payment Milestones</h4>
            <div className="projectcardslist">
              {(d.milestones || []).map((x: R) => (
                <article key={x.id} className="milestoneitem">
                  <span>
                    <b>{x.name}</b>
                    <small>{x.due_condition || "As per agreement"}</small>
                  </span>
                  <div className="milestoneamt">
                    <b>{money(x.amount)}</b>
                    <span className={`statusbadge status-${String(x.status).toLowerCase()}`}>{x.status}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Invoices Generated */}
          <div className="invoices-card">
            <h4>Tax Invoices</h4>
            <div className="projectcardslist">
              {(d.invoices || []).map((x: R) => (
                <article key={x.id} className="invoiceitem">
                  <span>
                    <b>{x.number || "Draft Invoice"}</b>
                    <small>{x.invoice_date} · {x.status}</small>
                  </span>
                  <strong>{money(x.grand_total)}</strong>
                </article>
              ))}
              {(d.invoices || []).length === 0 && (
                <div className="projectempty">No invoices generated yet for this project.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. EXPENSES
  if (tab === "Expenses") {
    return admin ? (
      <div className="tabcontent-wrap">
        <div className="projectcardslist">
          {(d.expenses || []).map((x: R) => (
            <article key={x.id}>
              <span>
                <b>{x.category} · {x.vendor || "Direct"}</b>
                <small>{x.date} · {x.notes || "No notes"}</small>
              </span>
              <strong>{money(x.amount + (x.tax || 0))}</strong>
            </article>
          ))}
          {(d.expenses || []).length === 0 && (
            <div className="projectempty">No expenses logged for this project.</div>
          )}
        </div>
      </div>
    ) : (
      <p className="restrictedproject">Expense, buying cost and profit data are Admin only.</p>
    );
  }

  // 7. SITE READINESS
  if (tab === "Site Readiness") {
    const readiness = d.project.site_readiness || {};
    return (
      <div className="tabcontent-wrap">
        <div className="readiness-card">
          <div className="infocard-head">
            <h3>Site Electrical & Physical Readiness Checklist</h3>
            <span className={`health-dot ${readiness.confirmed ? "health-on-track" : "health-delayed"}`}>
              {readiness.confirmed ? "✓ Readiness Verified" : "Pending Confirmation"}
            </span>
          </div>
          <div className="checklist-items">
            {[
              "Civil & wall construction ready",
              "Conduit and back-box depths verified",
              "Neutral wire available in all automation switch boxes",
              "Dedicated earth and stable voltage confirmed",
              "Wi-Fi signal strength test completed",
            ].map((checkItem) => (
              <div key={checkItem} className="checkitem-row">
                <span className="checkicon">{readiness.confirmed ? "☑" : "☐"}</span>
                <span>{checkItem}</span>
              </div>
            ))}
          </div>
          {readiness.notes && (
            <div className="readinessnotes">
              <small>Notes / Site Observations</small>
              <p>{readiness.notes}</p>
            </div>
          )}
          <button
            className="btn-primary mt-4"
            onClick={() => {
              const notes = prompt("Enter site readiness observations", readiness.notes || "");
              if (notes !== null) {
                act({
                  action: "readiness",
                  readiness: { confirmed: true, notes, updatedAt: new Date().toISOString() },
                  notes: "Site readiness verified",
                });
              }
            }}
          >
            ✓ Confirm Site Readiness
          </button>
        </div>
      </div>
    );
  }

  // 8. PHOTOS & DOCUMENTS
  if (tab === "Photos and Documents") {
    return (
      <div className="tabcontent-wrap">
        <div className="tabactionbar">
          <label className="btn-primary uploadlabel">
            ＋ Upload Photo / Document
            <input
              type="file"
              accept="image/*,.pdf,video/mp4"
              onChange={(e) =>
                e.target.files?.[0] && upload(e.target.files[0], "Project document")
              }
            />
          </label>
        </div>
        <div className="docgrid">
          {(d.documents || []).map((x: R) => (
            <div key={x.id} className="doccard">
              <div className="docicon">📄</div>
              <div className="docinfo">
                <b>{x.file_name}</b>
                <small>{x.kind} · {new Date(x.created_at).toLocaleDateString("en-IN")}</small>
              </div>
              <a
                href={`/api/uploads/${x.file_key}`}
                target="_blank"
                rel="noreferrer"
                className="docopenbtn"
              >
                Open ↗
              </a>
            </div>
          ))}
          {(d.documents || []).length === 0 && (
            <div className="projectempty">No photos or documents uploaded yet.</div>
          )}
        </div>
      </div>
    );
  }

  // 9. TESTING & HANDOVER
  if (tab === "Testing and Handover") {
    const testing = d.project.testing_checklist || {};
    const handover = d.project.handover || {};
    return (
      <div className="tabcontent-wrap">
        <div className="handovergrid">
          <section className="handoversection">
            <h3>Testing & Configuration Checklist</h3>
            <div className="checkitem-row">
              <span className="checkicon">{testing.completed ? "☑" : "☐"}</span>
              <span>All smart switch modules paired and calibrated</span>
            </div>
            <div className="checkitem-row">
              <span className="checkicon">{testing.completed ? "☑" : "☐"}</span>
              <span>Automation scenes & schedules verified live</span>
            </div>
            <div className="checkitem-row">
              <span className="checkicon">{testing.completed ? "☑" : "☐"}</span>
              <span>Wi-Fi failover & manual override tested</span>
            </div>
            <button
              className="btn-primary mt-4"
              onClick={() =>
                act({
                  action: "testing",
                  testing: { completed: true, confirmedAt: new Date().toISOString() },
                  notes: "Testing checklist verified",
                })
              }
            >
              ✓ Confirm Testing Completed
            </button>
          </section>

          <section className="handoversection">
            <h3>Customer Handover Acceptance</h3>
            <div className="checkitem-row">
              <span className="checkicon">{handover.trainingCompleted ? "☑" : "☐"}</span>
              <span>Customer mobile application setup & family training</span>
            </div>
            <div className="checkitem-row">
              <span className="checkicon">{handover.accepted ? "☑" : "☐"}</span>
              <span>Handover acceptance & key sign-off</span>
            </div>
            {handover.notes && (
              <div className="readinessnotes">
                <small>Handover Feedback</small>
                <p>{handover.notes}</p>
              </div>
            )}
            <button
              className="btn-success mt-4"
              onClick={() => openModal("handover")}
            >
              🤝 Complete Customer Handover
            </button>
          </section>
        </div>
      </div>
    );
  }

  // 10. WARRANTY & SERVICE
  if (tab === "Warranty and Service") {
    const items = [...(d.warranties || []), ...(d.service || [])];
    return (
      <div className="tabcontent-wrap">
        <div className="projectcardslist">
          {items.map((x: R, i: number) => (
            <article key={x.id || i}>
              <span>
                <b>{x.serial_number || x.problem || "Warranty Card"}</b>
                <small>Date: {x.installation_date || x.created_at || "—"}</small>
              </span>
              <strong className="statusbadge">{x.status}</strong>
            </article>
          ))}
          {items.length === 0 && (
            <div className="projectempty">
              Warranty certificate is automatically activated upon Handover completion.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 11. ACTIVITY TIMELINE
  return (
    <div className="tabcontent-wrap">
      <div className="projecttimeline">
        {(d.activities || []).map((x: R) => (
          <article key={x.id}>
            <i />
            <span>
              <small>
                {new Date(x.created_at).toLocaleString("en-IN")} · {x.staff_name || "System"}
              </small>
              <b>{x.type}</b>
              <p>{x.content}</p>
            </span>
          </article>
        ))}
        {(d.activities || []).length === 0 && (
          <div className="projectempty">No activities recorded yet.</div>
        )}
      </div>
    </div>
  );
}
