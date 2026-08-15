"use client";
import { useEffect, useState } from "react";
type R = Record<string, any>;
const stages = [
  "New",
  "Contacted",
  "Qualified",
  "Site Visit Scheduled",
  "Site Visit Done",
  "Quote In Progress",
  "Quote Sent",
  "Negotiation / Follow-up",
  "Won",
  "Lost",
];
const requirements = [
  "Smart Home Automation",
  "Smart Switches",
  "Smart Door Locks",
  "Video Doorbell",
  "Smart Curtains",
  "Smart Lighting",
  "Sensors/Security",
  "CCTV",
  "Networking/Wi-Fi",
  "Gate Automation",
  "Service",
  "Other",
];
const actionTypes = [
  "Call",
  "WhatsApp",
  "Site Visit",
  "Send Items List",
  "Prepare Quote",
  "Payment Follow-up",
  "Other",
];
const money = (v: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const dt = () => new Date(Date.now() + 86400000).toISOString().slice(0, 16);
const empty = {
  customerName: "",
  customerType: "Individual",
  phone: "",
  whatsapp: "",
  email: "",
  preferredCommunication: "Call",
  existingCustomer: false,
  siteName: "",
  address: "",
  city: "",
  pincode: "",
  mapsUrl: "",
  siteContactName: "",
  siteContactPhone: "",
  propertyType: "Villa",
  constructionStage: "Planning",
  projectTimeline: "",
  source: "Instagram",
  requirementCategories: [] as string[],
  details: "",
  budget: "",
  estimatedValue: "",
  priority: "Warm",
  decisionMaker: "",
  decisionContact: "",
  decisionMakerCount: "1",
  expectedDecisionDate: "",
  competitor: "",
  assignedTo: "",
  leadOwner: "",
  followupAt: dt(),
  nextAction: "Call",
  notes: "",
};
export default function LeadsModule({
  role,
  initialFilter,
  onCreateQuote,
}: {
  role: string;
  initialFilter: Record<string, string>;
  onCreateQuote: () => void;
}) {
  const [rows, setRows] = useState<R[]>([]),
    [users, setUsers] = useState<R[]>([]),
    [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 }),
    [filters, setFilters] = useState({
      q: initialFilter.id || "",
      status: initialFilter.status || "",
      priority: "",
      assigned: "",
      source: "",
      category: "",
      city: "",
      due: "",
      sort: "newest",
      page: "1",
    }),
    [view, setView] = useState<"list" | "kanban">("list"),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState<R>(empty),
    [detail, setDetail] = useState<R | null>(null),
    [tab, setTab] = useState("Overview"),
    [follow, setFollow] = useState<R | null>(null),
    [visit, setVisit] = useState<R | null>(null),
    [outcome, setOutcome] = useState<R | null>(null);
  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const r = await fetch(`/api/leads?${p}`),
      d = await r.json();
    setLoading(false);
    if (r.ok) {
      setRows(d.leads);
      setUsers(d.users || []);
      setPagination(d.pagination);
    } else setMessage(d.error);
  };
  useEffect(() => {
    const x = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(x);
  }, [filters]);
  const open = async (id: string) => {
    const r = await fetch(`/api/leads?id=${id}`),
      d = await r.json();
    if (r.ok) {
      setDetail(d);
      setTab("Overview");
    } else setMessage(d.error);
  };
  const create = async (force = false) => {
    const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          estimatedValue: Number(draft.estimatedValue || 0),
          decisionMakerCount: Number(draft.decisionMakerCount || 1),
          allowDuplicate: force,
        }),
      }),
      d = await r.json();
    if (r.status === 409 && d.duplicate) {
      if (
        confirm(
          `${d.error}: ${d.duplicate.customer_name} (${d.duplicate.id}). Create anyway?`,
        )
      )
        return create(true);
    }
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setAdding(false);
    setDraft(empty);
    setMessage(`${d.lead.id} created with first follow-up`);
    load();
    open(d.lead.id);
  };
  const patch = async (payload: R) => {
    if (!detail) return;
    const r = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: detail.lead.id, ...payload }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return false;
    }
    setMessage("Lead updated");
    await open(detail.lead.id);
    load();
    return true;
  };
  const addFollow = async (v: R) => {
    const r = await fetch("/api/leads/followups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, leadId: detail?.lead.id }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setFollow(null);
    setMessage("Follow-up scheduled");
    open(detail!.lead.id);
    load();
  };
  const completeFollow = async (v: R) => {
    const r = await fetch("/api/leads/followups", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, id: outcome?.id, action: "complete" }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setOutcome(null);
    setMessage("Follow-up completed and timeline updated");
    open(detail!.lead.id);
    load();
  };
  const scheduleVisit = async (v: R) => {
    const r = await fetch("/api/leads/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, leadId: detail?.lead.id }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setVisit(null);
    setMessage("Site visit scheduled");
    open(detail!.lead.id);
    load();
  };
  const communicate = async (type: string) => {
    if (!detail) return;
    const phone = String(
      type === "WhatsApp"
        ? detail.lead.whatsapp || detail.lead.phone
        : detail.lead.phone,
    ).replace(/\D/g, "");
    if (type === "WhatsApp") {
      const text = prompt(
        "Edit WhatsApp message",
        `Hello ${detail.lead.customer_name}, this is Techomie Smart Devices regarding your ${detail.lead.requirement_categories?.join(", ") || "smart home"} enquiry.`,
      );
      if (!text) return;
      window.open(
        `https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(text)}`,
        "_blank",
      );
    } else window.location.href = `tel:${phone}`;
    if (confirm(`Log this ${type} action in the timeline?`)) {
      await fetch("/api/leads/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: detail.lead.id,
          type: `${type} Action`,
          notes: `${type} initiated with customer`,
        }),
      });
      open(detail.lead.id);
    }
  };
  const convert = async () => {
    if (!detail) return;
    const r = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: detail.lead.id, action: "convert" }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(
      `${d.quotationNumber} created with customer and site details copied`,
    );
    onCreateQuote();
  };
  const kpis = {
    new: rows.filter((x) => x.status === "New").length,
    notContacted: rows.filter((x) => x.status === "New").length,
    today: rows.filter(
      (x) =>
        String(x.followup_at).slice(0, 10) ===
        new Date().toISOString().slice(0, 10),
    ).length,
    overdue: rows.filter((x) => x.overdue).length,
    visits: rows.filter((x) => x.status === "Site Visit Scheduled").length,
    hot: rows.filter((x) => x.priority === "Hot").length,
    quote: rows.filter((x) =>
      ["Quote In Progress", "Quote Sent"].includes(x.status),
    ).length,
    won: rows.filter((x) => x.status === "Won").length,
    lost: rows.filter((x) => x.status === "Lost").length,
  };
  if (role === "technician")
    return (
      <div className="modulepage">
        <h1>Leads</h1>
        <p className="formerror">
          Technician accounts do not have general CRM access.
        </p>
      </div>
    );
  return (
    <div className="leadcrm">
      <div className="leadhero">
        <div>
          <small>CRM PIPELINE</small>
          <h1>Leads</h1>
          <p>
            Every enquiry, follow-up, site visit and conversion in one permanent
            workflow.
          </p>
        </div>
        <div>
          <button
            onClick={() => (window.location.href = "/api/leads/export")}
            disabled={!["admin", "crm"].includes(role)}
          >
            Export filtered
          </button>
          <button className="primary" onClick={() => setAdding(true)}>
            ＋ Add Lead
          </button>
        </div>
      </div>
      {message && (
        <div className="leadnotice">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <div className="leadkpis">
        {Object.entries(kpis).map(([k, v]) => (
          <button
            key={k}
            onClick={() =>
              setFilters({
                ...filters,
                due: k === "overdue" ? "overdue" : k === "today" ? "today" : "",
                status:
                  k === "new"
                    ? "New"
                    : k === "visits"
                      ? "Site Visit Scheduled"
                      : k === "hot"
                        ? ""
                        : k === "quote"
                          ? "Quote Sent"
                          : k === "won"
                            ? "Won"
                            : k === "lost"
                              ? "Lost"
                              : "",
                priority: k === "hot" ? "Hot" : "",
              })
            }
          >
            <small>
              {
                (
                  {
                    new: "New leads",
                    notContacted: "Not contacted",
                    today: "Follow-ups today",
                    overdue: "Overdue",
                    visits: "Site visits",
                    hot: "Hot leads",
                    quote: "Quote pending/sent",
                    won: "Won",
                    lost: "Lost",
                  } as R
                )[k]
              }
            </small>
            <b>{v}</b>
          </button>
        ))}
      </div>
      <div className="leadtools">
        <label className="leadsearch">
          ⌕
          <input
            value={filters.q}
            onChange={(e) =>
              setFilters({ ...filters, q: e.target.value, page: "1" })
            }
            placeholder="Lead ID, customer, phone, WhatsApp, city, site or staff"
          />
        </label>
        {[
          ["status", ["", ...stages]],
          ["priority", ["", "Hot", "Warm", "Cold"]],
          ["assigned", ["", ...users.map((x) => x.id)]],
          [
            "source",
            [
              "",
              "Instagram",
              "Facebook",
              "Google",
              "Website",
              "Referral",
              "Walk-in",
              "Expo",
              "Existing Customer",
              "Architect",
              "Builder",
              "Other",
            ],
          ],
          ["category", ["", ...requirements]],
          ["due", ["", "today", "overdue", "visit", "quote"]],
          [
            "sort",
            ["newest", "oldest", "followup", "value", "priority", "activity"],
          ],
        ].map(([key, opts]: any) => (
          <select
            key={key}
            value={(filters as R)[key]}
            onChange={(e) =>
              setFilters({ ...filters, [key]: e.target.value, page: "1" })
            }
          >
            <option value="">{key}</option>
            {opts.filter(Boolean).map((x: string) => (
              <option key={x} value={x}>
                {key === "assigned"
                  ? users.find((u) => u.id === x)?.name || x
                  : x}
              </option>
            ))}
          </select>
        ))}
        <input
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        />
        <div className="viewtoggle">
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            className={view === "kanban" ? "active" : ""}
            onClick={() => setView("kanban")}
          >
            Kanban
          </button>
        </div>
      </div>
      {loading ? (
        <div className="leadloading">Loading CRM records…</div>
      ) : view === "list" ? (
        <div className="leadtable">
          <div className="leadrow leadhead">
            <span>Lead / Customer</span>
            <span>Site & Requirement</span>
            <span>Priority / Stage</span>
            <span>Owner & Value</span>
            <span>Next action</span>
            <span>Actions</span>
          </div>
          {rows.map((l) => (
            <LeadRow
              key={l.id}
              l={l}
              open={() => open(l.id)}
              communicate={communicate}
            />
          ))}
        </div>
      ) : (
        <div className="leadkanban">
          {stages.map((st) => (
            <section key={st}>
              <header>
                <b>{st}</b>
                <span>{rows.filter((x) => x.status === st).length}</span>
              </header>
              {rows
                .filter((x) => x.status === st)
                .map((l) => (
                  <button
                    key={l.id}
                    onClick={() => open(l.id)}
                    className={l.overdue ? "overdue" : ""}
                  >
                    <small>
                      {l.id} · {l.priority}
                    </small>
                    <b>{l.customer_name}</b>
                    <span>{l.site_name || l.city || "Site pending"}</span>
                    <em>{money(l.estimated_value)}</em>
                    <i>
                      {l.next_action} ·{" "}
                      {l.followup_at
                        ? new Date(l.followup_at).toLocaleString("en-IN")
                        : "Not set"}
                    </i>
                  </button>
                ))}
            </section>
          ))}
        </div>
      )}
      <div className="leadpages">
        <button
          disabled={pagination.page <= 1}
          onClick={() =>
            setFilters({ ...filters, page: String(pagination.page - 1) })
          }
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.pages} · {pagination.total}{" "}
          leads
        </span>
        <button
          disabled={pagination.page >= pagination.pages}
          onClick={() =>
            setFilters({ ...filters, page: String(pagination.page + 1) })
          }
        >
          Next
        </button>
      </div>
      {adding && (
        <LeadModal title="Add Lead" onClose={() => setAdding(false)}>
          <LeadForm v={draft} setV={setDraft} users={users} role={role} />
          <Actions
            cancel={() => setAdding(false)}
            save={() => create(false)}
            label="Create lead & first follow-up"
          />
        </LeadModal>
      )}
      {detail && (
        <Detail
          data={detail}
          tab={tab}
          setTab={setTab}
          close={() => setDetail(null)}
          role={role}
          patch={patch}
          follow={() =>
            setFollow({
              scheduledAt: dt(),
              actionType: "Call",
              assignedTo: detail.lead.assigned_to,
              notes: "",
            })
          }
          visit={() =>
            setVisit({
              scheduledAt: dt(),
              assignedTo: detail.lead.assigned_to,
              mapsUrl: detail.lead.maps_url || "",
              visitNotes: "",
            })
          }
          communicate={communicate}
          convert={convert}
          complete={setOutcome}
        />
      )}{" "}
      {follow && (
        <SimpleModal
          title="Add Follow-up"
          values={follow}
          fields={[
            ["scheduledAt", "datetime-local"],
            ["actionType", actionTypes],
            ["assignedTo", users],
            ["notes", "textarea"],
          ]}
          set={setFollow}
          close={() => setFollow(null)}
          save={() => addFollow(follow)}
        />
      )}{" "}
      {visit && (
        <SimpleModal
          title="Schedule Site Visit"
          values={visit}
          fields={[
            ["scheduledAt", "datetime-local"],
            ["assignedTo", users],
            ["mapsUrl", "text"],
            ["visitNotes", "textarea"],
          ]}
          set={setVisit}
          close={() => setVisit(null)}
          save={() => scheduleVisit(visit)}
        />
      )}{" "}
      {outcome && (
        <SimpleModal
          title="Complete Follow-up"
          values={{
            outcome: "Connected",
            discussionNote: "",
            nextAction: "Call",
            nextFollowupAt: dt(),
            updatedStage: detail?.lead.status,
          }}
          fields={[
            [
              "outcome",
              [
                "Connected",
                "No Answer",
                "Customer Busy",
                "Site Visit Confirmed",
                "Quote Requested",
                "Quote Sent",
                "Negotiation",
                "Not Interested",
                "Other",
              ],
            ],
            ["discussionNote", "textarea"],
            ["nextAction", actionTypes],
            ["nextFollowupAt", "datetime-local"],
            ["updatedStage", stages],
          ]}
          set={(v) => setOutcome({ ...outcome, ...v })}
          close={() => setOutcome(null)}
          save={() => completeFollow(outcome)}
        />
      )}
    </div>
  );
}

function LeadRow({ l, open }: { l: R; open: () => void; communicate: any }) {
  return (
    <div
      className={`leadrow ${l.overdue ? "overdue" : ""} ${l.inactive ? "inactive" : ""}`}
    >
      <span>
        <b>{l.customer_name}</b>
        <small>
          {l.id} · {l.phone}
        </small>
        <div>
          <a href={`tel:${l.phone}`}>Call</a>
          <a
            target="_blank"
            href={`https://wa.me/91${String(l.whatsapp || l.phone)
              .replace(/\D/g, "")
              .slice(-10)}`}
          >
            WhatsApp
          </a>
        </div>
      </span>
      <span>
        <b>{l.site_name || l.city || "Site pending"}</b>
        <small>
          {(l.requirement_categories || []).slice(0, 2).join(" · ") ||
            "Requirement pending"}
        </small>
      </span>
      <span>
        <em className={`leadpriority ${String(l.priority).toLowerCase()}`}>
          {l.priority}
        </em>
        <b>{l.status}</b>
        {l.overdue ? (
          <strong>OVERDUE</strong>
        ) : l.inactive ? (
          <strong>INACTIVE 7+ DAYS</strong>
        ) : null}
      </span>
      <span>
        <b>{l.assigned_name || "Unassigned"}</b>
        <small>{money(l.estimated_value)}</small>
      </span>
      <span>
        <b>{l.next_action || "Missing"}</b>
        <small>
          {l.followup_at
            ? new Date(l.followup_at).toLocaleString("en-IN")
            : "No follow-up"}
        </small>
      </span>
      <span>
        <button onClick={open}>Open</button>
      </span>
    </div>
  );
}
function LeadModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: any;
}) {
  return (
    <div className="modalback">
      <div className="leadmodal">
        <header>
          <div>
            <small>TECHOMIE CRM</small>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
function LeadForm({
  v,
  setV,
  users,
  role,
}: {
  v: R;
  setV: (x: R) => void;
  users: R[];
  role: string;
}) {
  const field = (key: string, label: string, type = "text") => (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={v[key] || ""}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="leadform">
      <h3>Customer details</h3>
      {field("customerName", "Customer full name *")}
      {field("phone", "Primary phone *", "tel")}
      {field("whatsapp", "WhatsApp", "tel")}
      {field("email", "Email", "email")}
      <Select
        v={v}
        setV={setV}
        k="customerType"
        label="Customer type"
        options={[
          "Individual",
          "Builder",
          "Architect",
          "Contractor",
          "Business",
        ]}
      />
      <Select
        v={v}
        setV={setV}
        k="preferredCommunication"
        label="Preferred communication"
        options={["Call", "WhatsApp", "Email"]}
      />
      <h3>Site details</h3>
      {field("siteName", "Site / project name")}
      {field("city", "City")}
      {field("pincode", "Pincode")}
      {field("mapsUrl", "Google Maps link", "url")}
      <label className="wide">
        <span>Full site address</span>
        <textarea
          value={v.address || ""}
          onChange={(e) => setV({ ...v, address: e.target.value })}
        />
      </label>
      {field("siteContactName", "Site contact person")}
      {field("siteContactPhone", "Site contact number")}
      <Select
        v={v}
        setV={setV}
        k="propertyType"
        label="Property type"
        options={[
          "Villa",
          "Apartment",
          "Flat",
          "Office",
          "Showroom",
          "Factory",
          "Other",
        ]}
      />
      <Select
        v={v}
        setV={setV}
        k="constructionStage"
        label="Construction stage"
        options={[
          "Planning",
          "Electrical Work",
          "Interior Work",
          "Ready for Installation",
          "Existing Building",
        ]}
      />
      {field("projectTimeline", "Expected project timeline")}
      <h3>Requirement & qualification</h3>
      <Select
        v={v}
        setV={setV}
        k="source"
        label="Lead source"
        options={[
          "Instagram",
          "Facebook",
          "Google",
          "Website",
          "Referral",
          "Walk-in",
          "Expo",
          "Existing Customer",
          "Architect",
          "Builder",
          "Other",
        ]}
      />
      <div className="wide reqchecks">
        <span>Requirement categories</span>
        {requirements.map((x) => (
          <label key={x}>
            <input
              type="checkbox"
              checked={(v.requirementCategories || []).includes(x)}
              onChange={(e) =>
                setV({
                  ...v,
                  requirementCategories: e.target.checked
                    ? [...(v.requirementCategories || []), x]
                    : (v.requirementCategories || []).filter(
                        (y: string) => y !== x,
                      ),
                })
              }
            />
            {x}
          </label>
        ))}
      </div>
      <label className="wide">
        <span>Requirement details</span>
        <textarea
          value={v.details || ""}
          onChange={(e) => setV({ ...v, details: e.target.value })}
        />
      </label>
      {field("budget", "Budget range")}
      {field("estimatedValue", "Estimated deal value", "number")}
      <Select
        v={v}
        setV={setV}
        k="priority"
        label="Priority"
        options={["Hot", "Warm", "Cold"]}
      />
      {field("decisionMaker", "Decision maker")}
      {field("decisionContact", "Decision contact")}
      {field("decisionMakerCount", "Number of decision makers", "number")}
      {field("expectedDecisionDate", "Expected decision date", "date")}
      {field("competitor", "Competitor / brand considered")}
      <h3>Ownership & first action</h3>
      {role !== "sales" && (
        <label>
          <span>Assigned employee</span>
          <select
            value={v.assignedTo || ""}
            onChange={(e) => setV({ ...v, assignedTo: e.target.value })}
          >
            <option value="">Assign to me</option>
            {users.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Select
        v={v}
        setV={setV}
        k="nextAction"
        label="Next action *"
        options={actionTypes}
      />
      {field("followupAt", "First follow-up *", "datetime-local")}
      <label className="wide">
        <span>Initial remarks</span>
        <textarea
          value={v.notes || ""}
          onChange={(e) => setV({ ...v, notes: e.target.value })}
        />
      </label>
    </div>
  );
}
function Select({
  v,
  setV,
  k,
  label,
  options,
}: {
  v: R;
  setV: (x: R) => void;
  k: string;
  label: string;
  options: string[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        value={v[k] || ""}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
      >
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
}
function Actions({
  cancel,
  save,
  label,
}: {
  cancel: () => void;
  save: () => void;
  label: string;
}) {
  return (
    <div className="leadactions">
      <button onClick={cancel}>Cancel</button>
      <button className="primary" onClick={save}>
        {label}
      </button>
    </div>
  );
}
function Detail({
  data,
  tab,
  setTab,
  close,
  role,
  patch,
  follow,
  visit,
  communicate,
  convert,
  complete,
}: {
  data: R;
  tab: string;
  setTab: (x: string) => void;
  close: () => void;
  role: string;
  patch: (x: R) => void;
  follow: () => void;
  visit: () => void;
  communicate: (x: string) => void;
  convert: () => void;
  complete: (x: R) => void;
}) {
  const l = data.lead,
    tabs = [
      "Overview",
      "Activity Timeline",
      "Follow-ups",
      "Site Visit",
      "Quotations",
      "Attachments",
      "Conversion / Outcome",
    ];
  return (
    <div className="leaddrawer">
      <header>
        <div>
          <small>
            {l.id} · {l.priority}
          </small>
          <h2>{l.customer_name}</h2>
          <p>
            {l.site_name || l.city} · {l.phone}
          </p>
        </div>
        <button onClick={close}>×</button>
      </header>
      <div className="detailactions">
        <button onClick={() => communicate("Call")}>Call</button>
        <button onClick={() => communicate("WhatsApp")}>WhatsApp</button>
        <button onClick={follow}>＋ Follow-up</button>
        <button onClick={visit}>Schedule visit</button>
        <button className="primary" onClick={convert}>
          Create quotation
        </button>
      </div>
      <nav>
        {tabs.map((x) => (
          <button
            className={tab === x ? "active" : ""}
            key={x}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </nav>
      <main>
        {tab === "Overview" && (
          <div className="detailoverview">
            <section>
              <h3>Pipeline control</h3>
              <label>
                <span>Stage</span>
                <select
                  value={l.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    if (status === "Lost") {
                      const reason = prompt(
                        "Loss reason: Price too high / Chose competitor / Project delayed / No response / No budget / Requirement cancelled / Outside service area / Other",
                      );
                      const note = reason && prompt("Detailed loss note");
                      if (reason && note)
                        patch({
                          status,
                          lostReason: reason,
                          lostNote: note,
                          nextAction: null,
                          followupAt: null,
                        });
                    } else
                      patch({
                        status,
                        nextAction: l.next_action,
                        followupAt: l.followup_at,
                      });
                  }}
                >
                  {stages.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <Info k="Priority" v={l.priority} />
              <Info k="Assigned" v={l.assigned_name} />
              <Info k="Estimated value" v={money(l.estimated_value)} />
              <Info
                k="Next action"
                v={`${l.next_action} · ${l.followup_at ? new Date(l.followup_at).toLocaleString("en-IN") : "Missing"}`}
              />
            </section>
            <section>
              <h3>Customer & site</h3>
              <Info
                k="Customer"
                v={`${l.customer_type} · ${l.customer_name}`}
              />
              <Info
                k="Phone / WhatsApp"
                v={`${l.phone} / ${l.whatsapp || "—"}`}
              />
              <Info
                k="Site"
                v={`${l.site_name || "—"}, ${l.address || ""}, ${l.city || ""} ${l.pincode || ""}`}
              />
              <Info
                k="Property"
                v={`${l.property_type || "—"} · ${l.construction_stage || "—"}`}
              />
              <Info k="Source" v={l.source} />
            </section>
            <section>
              <h3>Requirement</h3>
              <div className="detailtags">
                {(l.requirement_categories || []).map((x: string) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
              <p>{l.details || "No detailed notes"}</p>
              <Info
                k="Decision maker"
                v={`${l.decision_maker || "—"} · ${l.decision_contact || ""}`}
              />
              <Info k="Budget" v={l.budget || "Not entered"} />
            </section>
          </div>
        )}
        {tab === "Activity Timeline" && <Timeline rows={data.activities} />}{" "}
        {tab === "Follow-ups" && (
          <div className="detailcards">
            {data.followups.map((x: R) => (
              <article key={x.id}>
                <em>{x.status}</em>
                <b>
                  {x.action_type} ·{" "}
                  {new Date(x.scheduled_at).toLocaleString("en-IN")}
                </b>
                <span>{x.assigned_name}</span>
                <p>{x.discussion_note || x.outcome || "Pending"}</p>
                {x.status !== "Completed" && (
                  <button onClick={() => complete(x)}>
                    Complete with outcome
                  </button>
                )}
              </article>
            ))}
          </div>
        )}{" "}
        {tab === "Site Visit" && (
          <div className="detailcards">
            {data.visits.map((x: R) => (
              <article key={x.id}>
                <em>{x.status}</em>
                <b>
                  {x.id} · {new Date(x.scheduled_at).toLocaleString("en-IN")}
                </b>
                <span>{x.assigned_name}</span>
                <p>{x.visit_notes || "Visit pending"}</p>
              </article>
            ))}
          </div>
        )}{" "}
        {tab === "Quotations" && (
          <div className="detailcards">
            {data.quotations.length ? (
              data.quotations.map((x: R) => (
                <article key={x.id}>
                  <em>{x.status}</em>
                  <b>{x.number}</b>
                  <span>{money(x.total)}</span>
                </article>
              ))
            ) : (
              <p>No quotation yet. Use Create quotation.</p>
            )}
          </div>
        )}{" "}
        {tab === "Attachments" && (
          <p className="detailhint">
            Attachments uploaded for this lead are stored permanently and appear
            here. Use site visit/photo upload from the activity workflow.
          </p>
        )}{" "}
        {tab === "Conversion / Outcome" && (
          <div className="conversionbox">
            <h3>Lead conversion</h3>
            <p>
              Convert this lead into a customer, customer site and pre-filled
              quotation without retyping its details.
            </p>
            <button className="primary" onClick={convert}>
              Convert & create quotation
            </button>
            {l.status === "Lost" && (
              <button
                onClick={() => {
                  const next = prompt("Next action", "Call"),
                    date = prompt("Follow-up date/time", dt());
                  if (next && date)
                    patch({
                      action: "reactivate",
                      nextAction: next,
                      followupAt: date,
                      note: "Lead reactivated from detail page",
                    });
                }}
              >
                Reactivate lost lead
              </button>
            )}
            {role === "admin" && (
              <button
                className="danger"
                onClick={() =>
                  confirm(
                    "Archive this lead? History will remain permanent.",
                  ) && patch({ action: "archive", note: "Archived by Admin" })
                }
              >
                Archive lead
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
function Info({ k, v }: { k: string; v: any }) {
  return (
    <div className="detailinfo">
      <span>{k}</span>
      <b>{v || "—"}</b>
    </div>
  );
}
function Timeline({ rows }: { rows: R[] }) {
  return (
    <div className="leadtimeline">
      {rows.map((x) => (
        <article key={x.id}>
          <i />
          <div>
            <small>
              {new Date(x.created_at).toLocaleString("en-IN")} · {x.staff_name}
            </small>
            <b>{x.type}</b>
            <p>{x.content}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
function SimpleModal({
  title,
  values,
  fields,
  set,
  close,
  save,
}: {
  title: string;
  values: R;
  fields: any[];
  set: (x: R) => void;
  close: () => void;
  save: () => void;
}) {
  return (
    <LeadModal title={title} onClose={close}>
      <div className="simpleform">
        {fields.map(([k, t]) => (
          <label key={k}>
            <span>{k.replace(/([A-Z])/g, " $1")}</span>
            {Array.isArray(t) ? (
              <select
                value={values[k] || ""}
                onChange={(e) => set({ ...values, [k]: e.target.value })}
              >
                {t.map((x: any) => (
                  <option key={x.id || x} value={x.id || x}>
                    {x.name || x}
                  </option>
                ))}
              </select>
            ) : t === "textarea" ? (
              <textarea
                value={values[k] || ""}
                onChange={(e) => set({ ...values, [k]: e.target.value })}
              />
            ) : (
              <input
                type={t}
                value={values[k] || ""}
                onChange={(e) => set({ ...values, [k]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <Actions cancel={close} save={save} label="Save" />
    </LeadModal>
  );
}
