"use client";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
type R = Record<string, any>;

export const resolveImageUrl = (v?: string | null) => {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/")) return s;
  return `/api/uploads/${s}`;
};

// ---------------------------------------------------------------------------
// Quick‑Create Customer dialog (used inline in Quotations, Invoice and Projects)
// Only "name" is mandatory; all other fields are optional.
// ---------------------------------------------------------------------------
function QuickCreateCustomer({
  onCreated,
  onClose,
}: {
  onCreated: (customer: R) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customerType: "Individual",
    name: "",
    phone: "",
    email: "",
    city: "",
    state: "Tamil Nadu",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!form.name.trim()) { setErr("Customer name is required"); return; }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Failed to create customer"); setBusy(false); return; }
      onCreated(d.customer);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };
  const f = (k: keyof typeof form, label: string) => (
    <label className="qcc-field">
      <span>{label}</span>
      <input
        value={form[k]}
        autoFocus={k === "name"}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </label>
  );
  return (
    <div className="qcc-backdrop" onClick={onClose}>
      <div className="qcc-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="qcc-header">
          <div>
            <small>QUICK ADD</small>
            <h3>New Customer</h3>
          </div>
          <button className="qcc-close" onClick={onClose} title="Close">×</button>
        </header>
        <div className="qcc-body">
          <p className="qcc-hint">Only the customer name is required. You can fill in the rest later from the Customers module.</p>
          {err && <div className="qcc-err">{err}</div>}
          <div className="qcc-form">
            <label className="qcc-field">
              <span>Customer type</span>
              <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
                {["Individual","Company","Builder","Architect","Contractor","Dealer","Other"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            {f("name", "Customer / company name ★")}
            {f("phone", "Phone")}
            {f("email", "Email")}
            {f("city", "City")}
          </div>
        </div>
        <div className="qcc-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className="primary"
            disabled={busy || !form.name.trim()}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create customer"}
          </button>
        </div>
      </div>
    </div>
  );
}
const money = (n: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
const wholeQty = (value: any) => Math.max(1, Math.round(Number(value) || 1));
const today = () => new Date().toISOString().slice(0, 10);
const later = (n: number) =>
  new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const roomNames = [
  "Living Room",
  "Dining",
  "Kitchen",
  "Master Bedroom",
  "Bedroom",
  "Bathroom",
  "Balcony",
  "Foyer",
  "Office",
  "Outdoor",
  "Other",
];
const quotationTypes = [
  "Detailed Smart Home Proposal",
  "Compact Commercial Quotation",
  "Budgetary / Mock Quotation",
  "Dealer / B2B Confidential Quotation",
  "Revision / Variation Quotation",
];
const normalizeQuantities = (snapshot: R) => {
  const normalized = structuredClone(snapshot || {});
  if (!Array.isArray(normalized.floors) || normalized.floors.length === 0) {
    normalized.floors = [
      {
        name: "Ground Floor",
        rooms: [{ name: "Living Room", note: "", items: [] }],
      },
    ];
  }
  if (!Array.isArray(normalized.projectItems)) {
    normalized.projectItems = [];
  }
  if (!Array.isArray(normalized.paymentPlan) || normalized.paymentPlan.length === 0) {
    normalized.paymentPlan = [
      { name: "Advance", percent: 50, condition: "Order confirmation & procurement" },
      { name: "Inception of Installation", percent: 20, condition: "On arrival of hardware at site" },
      { name: "On Handover", percent: 20, condition: "After system testing & commissioning" },
      { name: "One Month After Handover", percent: 10, condition: "Final sign-off & retention" },
    ];
  }
  if (!normalized.details || typeof normalized.details !== "object") {
    normalized.details = {
      title: normalized.customerName ? `${normalized.customerName} Smart Home Proposal` : "Smart Home Automation Proposal",
      quoteType: quotationTypes[0],
      projectType: "Villa",
      quoteDate: today(),
      validUntil: later(30),
      introduction: "We are pleased to present a premium smart-home automation proposal for your property.",
      internalNotes: typeof snapshot?.details === "string" ? snapshot.details : "",
    };
  } else {
    normalized.details.title = normalized.details.title || (normalized.customerName ? `${normalized.customerName} Smart Home Proposal` : "Smart Home Automation Proposal");
    normalized.details.quoteType = normalized.details.quoteType || quotationTypes[0];
    normalized.details.projectType = normalized.details.projectType || "Villa";
    normalized.details.quoteDate = normalized.details.quoteDate || today();
    normalized.details.validUntil = normalized.details.validUntil || later(30);
  }
  normalized.taxMode = normalized.taxMode || "GST";
  normalized.warranty = normalized.warranty || "All Techomie Smart Products: 10 Years Warranty (5 Years Full Replacement + 5 Years Service Warranty)\nRoyal Edge & Touch Series: 10 Years Warranty (5 Years Full Replacement + 5 Years Service Warranty)";

  for (const floor of normalized.floors) {
    if (!Array.isArray(floor.rooms)) floor.rooms = [];
    for (const room of floor.rooms) {
      if (!Array.isArray(room.items)) room.items = [];
      for (const item of room.items) item.qty = wholeQty(item.qty);
    }
  }
  for (const item of normalized.projectItems) item.qty = wholeQty(item.qty);
  return normalized;
};
const scopeSectionLabels: Record<string, string> = {
  requirementSummary: "Requirement summary",
  proposedSolution: "Proposed solution",
  supply: "Scope of supply",
  installation: "Scope of installation",
  prerequisites: "Technical prerequisites",
  assumptions: "Assumptions",
  responsibilities: "Customer responsibilities",
  exclusions: "Exclusions",
  deliveryTimeline: "Delivery timeline",
  installationTimeline: "Installation timeline",
  testing: "Testing and configuration",
  handover: "Handover and training",
  support: "After-sales support",
};

const SMART_SWITCH_SERIES = [
  { id: "Royal Edge", label: "Royal Edge", icon: "👑", match: /royal\s+edge(?!.*color)/i },
  { id: "Royal Edge Color", label: "Royal Edge Color", icon: "🌟", match: /royal\s+edge\s+color/i },
  { id: "Edge", label: "Edge", icon: "💎", match: /\bedge\b(?!.*color)/i },
  { id: "Edge Color", label: "Edge Color", icon: "🎨", match: /\bedge\s+color\b/i },
  { id: "Color Touch Panel", label: "Color Touch Panel", icon: "🌈", match: /color\s+touch/i },
  { id: "Touch Panel", label: "Touch Panel", icon: "📱", match: /touch\s+panel/i },
  { id: "Touch Plus", label: "Touch Plus", icon: "✨", match: /touch\s+plus/i },
  { id: "Noviq Titan", label: "Noviq Titan", icon: "🛡️", match: /titan/i },
  { id: "Noviq Luxeray", label: "Luxeray", icon: "🔆", match: /luxeray/i },
];

const SMART_SWITCH_EDGE_COLORS = [
  { id: "Rose Gold Edge", label: "Rose Gold Edge", icon: "🌹", colorCode: "#b76e79" },
  { id: "Gold Edge", label: "Gold Edge", icon: "🏆", colorCode: "#d4af37" },
  { id: "Black Edge", label: "Black Edge", icon: "⚫", colorCode: "#1e293b" },
  { id: "Silver Edge", label: "Silver Edge", icon: "⚪", colorCode: "#94a3b8" },
  { id: "Rimless / Matching", label: "Rimless / Matching", icon: "◻️", colorCode: "#cbd5e1" },
];

const SMART_SWITCH_PANEL_COLORS = [
  { id: "Pure Black", label: "Pure Black", icon: "⚫", colorCode: "#0f172a" },
  { id: "Pure White", label: "Pure White", icon: "⚪", colorCode: "#ffffff" },
  { id: "Space Grey", label: "Space Grey", icon: "🔘", colorCode: "#64748b" },
  { id: "Custom Colour", label: "Custom Colour", icon: "🎨", colorCode: "#8b5cf6" },
];

function normalizeSwitchSeries(raw?: string): string {
  if (!raw) return "";
  for (const s of SMART_SWITCH_SERIES) {
    if (s.id.toLowerCase() === raw.toLowerCase() || s.match.test(raw)) return s.id;
  }
  return raw;
}

function getSwitchBaseName(rawName: string): string {
  let s = (rawName || "").trim();
  s = s.replace(/^noviq\s+/i, "");
  s = s.replace(/royal\s+edge\s+color\s+(touch\s+)?/i, "");
  s = s.replace(/royal\s+edge\s+/i, "");
  s = s.replace(/edge\s+color\s+(touch\s+)?/i, "");
  s = s.replace(/\bedge\s+/i, "");
  s = s.replace(/color\s+touch\s+(panel\s+)?/i, "");
  s = s.replace(/touch\s+panel\s+/i, "");
  s = s.replace(/touch\s+plus\s+/i, "");
  s = s.trim();
  return s ? `Noviq ${s}` : rawName;
}

const SMART_SWITCH_TECHNOLOGIES = [
  { id: "Remote based", label: "Remote based", icon: "📡", match: /remote/i },
  { id: "Wi-Fi", label: "Wi-Fi", icon: "📶", match: /wifi|wi-fi/i },
  { id: "Zigbee", label: "Zigbee", icon: "⚡", match: /zig/i },
];

const SMART_SWITCH_MATERIALS = [
  { id: "Acrylic", label: "Acrylic", icon: "🪟", match: /acrylic/i },
  { id: "Glass", label: "Glass", icon: "💎", match: /glass/i },
];

function normalizeSwitchTech(raw?: string): string {
  if (!raw) return "";
  for (const t of SMART_SWITCH_TECHNOLOGIES) {
    if (t.match.test(raw)) return t.id;
  }
  return raw;
}

function normalizeSwitchMat(raw?: string): string {
  if (!raw) return "";
  for (const m of SMART_SWITCH_MATERIALS) {
    if (m.match.test(raw)) return m.id;
  }
  return raw;
}

interface SwitchSpecs {
  moduleSize: string;
  switches: string;
  fan: string;
  hasHvSwitch: boolean;
  hasAny16A: boolean;
  plugs: string;
}

function parseSwitchSpecs(name?: string, attrs: Record<string, any> = {}): SwitchSpecs {
  const normName = name || "";

  // 1. Module Size:
  let moduleSize = attrs.module || "";
  if (!moduleSize || moduleSize === "-" || moduleSize === "Per Icon") {
    const m = normName.match(/(\d+)\s*M(?:odule)?\b/i);
    if (m) moduleSize = m[1];
  }
  moduleSize = String(moduleSize || "").replace(/M$/i, "").trim();

  // 2. Switches (gang count):
  let switches = "";
  const sw = normName.match(/(\d+)\s*Switch/i);
  if (sw) {
    switches = sw[1];
  } else if (/Door\s*Bell|Bell\b/i.test(normName)) {
    switches = "Bell";
  } else if (/Curtain/i.test(normName)) {
    switches = "Curtain";
  } else if (/Scene/i.test(normName)) {
    switches = "Scene";
  } else if (/Dimmer/i.test(normName)) {
    switches = "Dimmer";
  } else {
    switches = "0";
  }

  // 3. Fan count:
  let fan = "0";
  const fn = normName.match(/(\d+)\s*Fan/i);
  if (fn) {
    fan = fn[1];
  } else if (/\bFan\b/i.test(normName)) {
    fan = "1";
  }

  // 4. HV switch (16A heavy duty switch) vs any 16A load:
  const hasHvSwitch =
    /(\d+)-16A/i.test(normName) ||
    /16A\s*Switch/i.test(normName) ||
    /\bHV\s*Switch\b/i.test(normName) ||
    /\bHeavy\b/i.test(normName);
  const hasAny16A = hasHvSwitch || /\b16A\b/i.test(normName) || /\bHV\b/i.test(normName);

  // 5. Plug / Socket count:
  let plugs = "0";
  const pl = normName.match(/(\d+)\s*Socket/i);
  if (pl) {
    plugs = pl[1];
  } else if (/Socket|Plug/i.test(normName)) {
    plugs = "1";
  }

  return { moduleSize, switches, fan, hasHvSwitch, hasAny16A, plugs };
}

export default function QuotationsModule({ role, initialFilter }: { role: string; initialFilter?: R }) {
  const [view, setView] = useState<"list" | "quote">(initialFilter?.id ? "quote" : "list"),
    [rows, setRows] = useState<R[]>([]),
    [filters, setFilters] = useState<R>({}),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [selected, setSelected] = useState<number | null>(initialFilter?.id ? Number(initialFilter.id) : null),
    [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch(
          `/api/quotations?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}`,
        );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to load quotations (${r.status})`);
        return;
      }
      const d = await r.json();
      setRows(d.quotations || []);
      setFilters(d.filters || {});
      setPages(d.pagination?.pages || 1);
    } catch (e: any) {
      setMsg(e?.message || "Failed to connect to server");
    }
  }, [q, status, page]);
  useEffect(() => {
    if (view === "list") {
      const t = setTimeout(load, 150);
      return () => clearTimeout(t);
    }
  }, [view, load]);
  const open = (id: number) => {
    setSelected(id);
    setView("quote");
  };
  return view === "list" ? (
    <div className="qmodule">
      <header>
        <div>
          <small>SALES DOCUMENTS</small>
          <h1>Quotations</h1>
          <p>
            Persistent proposals, pricing snapshots, revisions, approvals and
            project conversion.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setSelected(null);
            setView("quote");
          }}
        >
          ＋ New quotation
        </button>
      </header>
      {msg && <div className="qnotice">{msg}</div>}
      <div className="qlisttools">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search quote, customer, phone, site, salesperson, item or project"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {[
            "Draft",
            "Pending Internal Approval",
            "Sent",
            "Viewed",
            "Negotiation",
            "Revision Required",
            "Accepted",
            "Rejected",
            "Expired",
            "Cancelled",
            "Converted to Project",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setStatus("Draft");
            setQ("");
          }}
        >
          My Drafts
        </button>
        <button onClick={() => setStatus("Accepted")}>Accepted</button>
        <button
          onClick={() => {
            const csv = [
                "Quote,Revision,Customer,Site,Date,Validity,Sales,Total,Status",
                ...rows.map((x) =>
                  [
                    x.number,
                    x.revision,
                    x.customer_name,
                    x.site_name,
                    x.quote_date,
                    x.valid_until,
                    x.sales_name,
                    x.total,
                    x.status,
                  ].join(","),
                ),
              ].join("\n"),
              a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv]));
            a.download = "Techomie-Quotations.csv";
            a.click();
          }}
        >
          Export
        </button>
      </div>
      <div className="qlist">
        <div className={`qrow qhead ${role === "admin" ? "admin" : ""}`}>
          <span>Quote</span>
          <span>Customer / Site</span>
          <span>Date / Validity</span>
          <span>Salesperson</span>
          <span>Total</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {rows.map((x) => (
          <div className={`qrow ${role === "admin" ? "admin" : ""}`} key={x.id} onClick={() => open(x.id)}>
            <span>
              <b>{x.number}</b>
              <small>Revision {x.revision || 0}</small>
            </span>
            <span>
              <b>{x.customer_name}</b>
              <small>
                {x.site_name} · {x.city || ""}
              </small>
            </span>
            <span>
              {x.quote_date || "—"}
              <small>Valid {x.valid_until || "—"}</small>
            </span>
            <span>{x.sales_name || x.created_name}</span>
            <strong>{money(x.total)}</strong>
            <em className={String(x.status).toLowerCase().replaceAll(" ", "-")}>
              {x.status}
            </em>
            <span className="qquick">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  open(x.id);
                }}
              >
                Open
              </button>
              {role === "admin" && (
                <button
                  className="qdelbtn"
                  title="Permanently delete quotation"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Permanently delete quotation ${x.number || x.id}? This action cannot be undone.`)) return;
                    const r = await fetch(`/api/quotations?id=${x.id}`, { method: "DELETE" });
                    const d = await r.json();
                    if (r.ok) {
                      load();
                    } else {
                      alert(d.error || "Unable to delete quotation");
                    }
                  }}
                >
                  🗑 Delete
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="qpager">
        <button disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>
          Next
        </button>
      </div>
    </div>
  ) : (
    <QuoteWorkspace
      id={selected}
      role={role}
      filters={filters}
      close={() => {
        setView("list");
        setSelected(null);
      }}
      notify={setMsg}
      onCreated={setSelected}
    />
  );
}
export function QuotationWorkspaceRoute({
  quotationId = null,
  mode = "edit",
}: {
  quotationId?: number | null;
  mode?: "new" | "edit" | "preview" | "revisions";
}) {
  const [id, setId] = useState<number | null>(quotationId),
    [role, setRole] = useState(""),
    [filters, setFilters] = useState<R | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    Promise.all([fetch("/api/auth/me"), fetch("/api/quotations?limit=100")])
      .then(async ([authResponse, quotationResponse]) => {
        const read = async (response: Response) => {
            const body = await response.text();
            try {
              return JSON.parse(body);
            } catch {
              return { error: body || response.statusText };
            }
          },
          auth = await read(authResponse),
          quotations = await read(quotationResponse);
        if (!authResponse.ok) throw new Error(auth.error || "Sign in required");
        if (!quotationResponse.ok)
          throw new Error(quotations.error || "Unable to load quotation data");
        setRole(auth.user?.role || "sales");
        setFilters(quotations.filters || {});
      })
      .catch((error) => setMessage(error.message));
  }, []);
  if (!filters || !role)
    return (
      <div className="qloading">
        <p>{message || "Loading quotation workspace…"}</p>
        {message && <button onClick={() => window.location.href = "/"}>Return to sign in</button>}
      </div>
    );
  return (
    <div className="quotationroute">
      {message && <div className="qnotice">{message}</div>}
      <QuoteWorkspace
        id={id}
        role={role}
        filters={filters}
        initialTab={
          mode === "preview"
            ? "Preview & Send"
            : mode === "revisions"
              ? "Revisions"
              : "Customer & Site"
        }
        close={() => {
          window.location.href = "/?module=Quotations";
        }}
        notify={setMessage}
        onCreated={(createdId) => {
          setId(createdId);
          window.history.replaceState({}, "", `/quotations/${createdId}/edit`);
        }}
      />
    </div>
  );
}
function QuoteWorkspace({
  id,
  role,
  filters,
  close,
  notify,
  onCreated,
  initialTab = "Customer & Site",
}: {
  id: number | null;
  role: string;
  filters: R;
  close: () => void;
  notify: (s: string) => void;
  onCreated: (id: number) => void;
  initialTab?: string;
}) {
  const [quote, setQuote] = useState<R | null>(null),
    [snap, setSnap] = useState<R>({
      details: {
        title: "",
        quoteType: quotationTypes[0],
        projectType: "Villa",
        quoteDate: today(),
        validUntil: later(30),
        introduction:
          "We are pleased to present a premium smart-home automation proposal for your property.",
        internalNotes: "",
      },
      floors: [
        {
          name: "Ground Floor",
          rooms: [{ name: "Living Room", note: "", items: [] }],
        },
      ],
      projectItems: [],
      paymentPlan: [
        { name: "Advance", percent: 50, condition: "Order confirmation & procurement" },
        { name: "Inception of Installation", percent: 20, condition: "On arrival of hardware at site" },
        { name: "On Handover", percent: 20, condition: "After system testing & commissioning" },
        { name: "One Month After Handover", percent: 10, condition: "Final sign-off & retention" },
      ],
      terms: "",
      warranty: "All Techomie Smart Products: 10 Years Warranty (5 Years Full Replacement + 5 Years Service Warranty)\nRoyal Edge & Touch Series: 10 Years Warranty (5 Years Full Replacement + 5 Years Service Warranty)",
      taxMode: "GST",
    }),
    [tab, setTab] = useState(initialTab),
    [save, setSave] = useState("Saved"),
    [dirty, setDirty] = useState(false),
    [picker, setPicker] = useState<R | null>(null),
    [activity, setActivity] = useState<R[]>([]),
    [revisions, setRevisions] = useState<R[]>([]),
    [files, setFiles] = useState<R[]>([]),
    [newMode, setNewMode] = useState(!id),
    [customerId, setCustomerId] = useState(""),
    [siteId, setSiteId] = useState(""),
    [salesId, setSalesId] = useState(""),
    [creating, setCreating] = useState(false),
    [branding, setBranding] = useState<R>({}),
    [pdfGenerating, setPdfGenerating] = useState(false),
    [localCustomers, setLocalCustomers] = useState<R[]>([]);
  const timer = useRef<any>(null);
  const customers = [...(filters.customers || []), ...localCustomers.filter((lc: R) => !(filters.customers || []).some((fc: R) => String(fc.id) === String(lc.id)))],
    sites = (filters.sites || []).filter(
      (s: R) => String(s.customer_id) === String(customerId),
    );
  const totals = useMemo(() => calc(snap), [snap]);
  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/quotations/workspace?id=${id}`),
      d = await r.json();
    if (r.ok) {
      setQuote(d.quotation);
      setSnap(normalizeQuantities(d.quotation.snapshot));
      setCustomerId(String(d.quotation.customer_id));
      setSiteId(String(d.quotation.site_id));
      setSalesId(String(d.quotation.sales_id || d.quotation.created_by || ""));
      setActivity(d.activities || []);
      setRevisions(d.revisions || []);
      setFiles(d.files || []);
      setNewMode(false);
    } else notify(d.error);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.settings?.branding && setBranding(d.settings.branding))
      .catch(() => undefined);
  }, []);
  const change = (next: R) => {
    setSnap(next);
    setDirty(true);
    setSave("Unsaved changes");
  };
  const persist = useCallback(async () => {
    if (!quote || !dirty) return;
    setSave("Saving…");
    const r = await fetch("/api/quotations/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: quote.id,
          action: "autosave",
          snapshot: snap,
          total: totals.grand,
          title: snap.details?.title,
          validUntil: snap.details?.validUntil,
          salesId,
        }),
      }),
      d = await r.json();
    if (r.ok) {
      setDirty(false);
      setSave(
        `Saved ${new Date(d.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      );
      setQuote({ ...quote, total: totals.grand, updated_at: d.savedAt });
    } else setSave(`Save failed — ${d.error}`);
  }, [quote, dirty, snap, totals.grand, salesId]);
  useEffect(() => {
    if (!dirty || !quote) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 900);
    return () => clearTimeout(timer.current);
  }, [dirty, quote, persist]);
  const create = async () => {
    const c = customers.find((x: R) => String(x.id) === customerId),
      s = (filters.sites || []).find((x: R) => String(x.id) === siteId);
    if (!c || !s || !snap.details.title)
      return notify("Select customer, site and enter project title");
    setCreating(true);
    const r = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          siteId,
          title: snap.details.title,
          quoteType: snap.details.quoteType,
          category: "Smart Home Automation",
          quoteDate: snap.details.quoteDate,
          validUntil: snap.details.validUntil,
          floors: snap.floors,
          total: totals.grand,
          salesId: salesId || undefined,
          details: { ...snap.details, customer: c.name, site: s.name },
        }),
      }),
      d = await r.json();
    setCreating(false);
    if (!r.ok) return notify(d.error);
    onCreated(Number(d.quotation.id));
  };
  const action = async (action: string, extra: R = {}) => {
    if (!quote?.id) return;
    await persist();
    const r = await fetch("/api/quotations/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: quote.id, action, ...extra }),
      }),
      d = await r.json();
    if (!r.ok) return notify(d.error);
    notify(`Quotation ${d.status || action} updated`);
    await load();
  };
  const relink = async (nextCustomerId: string, nextSiteId: string) => {
    if (!quote?.id || !nextCustomerId || !nextSiteId) return;
    await persist();
    setSave("Updating customer and site…");
    const r = await fetch("/api/quotations/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: quote.id,
          action: "relink",
          customerId: Number(nextCustomerId),
          siteId: nextSiteId,
        }),
      }),
      d = await r.json();
    if (!r.ok) {
      setSave(`Update failed — ${d.error}`);
      return notify(d.error);
    }
    notify("Quotation customer and site updated");
    setSave("Saved");
    const customer = customers.find((x: R) => String(x.id) === nextCustomerId);
    const site = (filters.sites || []).find((x: R) => String(x.id) === nextSiteId);
    if (customer && site) {
      setQuote((current: R) => ({...current, customer_id: Number(nextCustomerId), site_id: nextSiteId, customer_name: customer.name, phone: customer.phone, site_name: site.name, site_address: site.address, city: site.city, state: site.state}));
      setSnap((current: R) => ({...current, details: {...current.details, customer: customer.name, customerName: customer.name, site: site.name, siteName: site.name}}));
    }
    await load();
  };
  const pdf = async (download = false) => {
    if (pdfGenerating) return;
    clearTimeout(timer.current);
    await persist();
    setTab("Preview & Send");
    if (download) {
      setPdfGenerating(true);
      notify("Preparing PDF proposal…");
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const el = document.querySelector(".qpaper") as HTMLElement | null;
    if (!el) {
      if (download) setPdfGenerating(false);
      return notify("PDF preview could not be prepared");
    }
    await Promise.race([
      document.fonts?.ready,
      new Promise((r) => setTimeout(r, 1000)),
    ]);
    const waitImages = Promise.all(
      Array.from(el.querySelectorAll("img")).map(
        (image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              }),
      ),
    );
    await Promise.race([waitImages, new Promise((r) => setTimeout(r, 1500))]);

    if (download) {
      try {
        notify("Rendering PDF pages…");
        const { jsPDF } = await import("jspdf");
        const html2canvas = (await import("html2canvas")).default;
        const filename =
          `${quote?.number || "Quotation"}-Rev-${quote?.revision || 0}-${quote?.customer_name || "Customer"}.pdf`.replace(
            /[^a-z0-9.-]+/gi,
            "-",
          );

        const sections = Array.from(el.querySelectorAll(":scope > section")) as HTMLElement[];
        const pdf = new jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        });

        const targetElements = sections.length ? sections : [el];
        for (let i = 0; i < targetElements.length; i++) {
          const section = targetElements[i];
          notify(`Rendering PDF page ${i + 1} of ${targetElements.length}…`);
          if (i > 0) {
            pdf.addPage("a4", "portrait");
          }
          const canvas = await html2canvas(section, {
            scale: 3,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            imageTimeout: 20000,
            width: 794,
            windowWidth: 794,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc: Document) => {
              const b = clonedDoc.body;
              if (b) {
                b.style.setProperty("-webkit-font-smoothing", "antialiased");
                b.style.textRendering = "optimizeLegibility";
              }
              const pills = clonedDoc.querySelectorAll(".item-pill-badge, .qitemsku");
              pills.forEach((p) => {
                const el = p as HTMLElement;
                el.style.display = "inline-flex";
                el.style.alignItems = "center";
                el.style.justifyContent = "center";
                el.style.height = "14px";
                el.style.padding = "0 5px";
                el.style.lineHeight = "1";
                el.style.boxSizing = "border-box";
              });
              const texts = clonedDoc.querySelectorAll(".qpilltext");
              texts.forEach((t) => {
                const el = t as HTMLElement;
                el.style.display = "inline-block";
                el.style.position = "relative";
                el.style.top = "-2.5px";
                el.style.lineHeight = "1";
              });
              const switchHeadTexts = clonedDoc.querySelectorAll(".qdecidedswitchhead small, .qdecidedswitchhead b, .qdecidedswitchhead span");
              switchHeadTexts.forEach((el) => {
                const h = el as HTMLElement;
                h.style.letterSpacing = "0px";
                h.style.fontFamily = "Arial, sans-serif";
              });
            },
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.98);
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "SLOW");
        }

        const blob = pdf.output("blob");

        // 1. Immediately trigger browser download for the user without waiting for server upload
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);

        notify("PDF downloaded successfully!");

        // 2. Perform background file archiving to server without blocking the user
        const form = new FormData();
        form.set("quotationId", String(quote?.id || ""));
        form.set("revision", String(quote?.revision || 0));
        form.set(
          "kind",
          quotePdfFormat(snap) === "detailed"
            ? "Detailed Proposal PDF"
            : "Commercial Quotation PDF",
        );
        form.set(
          "file",
          new File([blob], filename, { type: "application/pdf" }),
        );
        fetch("/api/quotations/files", {
          method: "POST",
          body: form,
        })
          .then((saved) => {
            if (saved.ok) load();
          })
          .catch((err) => console.warn("Background PDF archival error:", err));
      } catch (err: any) {
        console.error("PDF generation error:", err);
        notify("Failed to generate PDF: " + (err?.message || "Unknown error"));
      } finally {
        setPdfGenerating(false);
      }
    } else {
      window.print();
    }
  };
  if (newMode)
    return (
      <NewQuote
        snap={snap}
        set={change}
        customers={customers}
        sites={sites}
        customerId={customerId}
        setCustomerId={(x: string) => {
          setCustomerId(x);
          setSiteId("");
        }}
        siteId={siteId}
        setSiteId={setSiteId}
        create={create}
        creating={creating}
        close={close}
        users={filters.users || []}
        salesId={salesId}
        setSalesId={(value:string)=>{const employee=(filters.users||[]).find((x:R)=>String(x.id)===value);setSalesId(value);setSnap((current:R)=>({...current,details:{...current.details,quotationByName:employee?.name||""}}))}}
        onCustomerCreated={(newCust: R) => {
          setLocalCustomers((prev) => [...prev.filter((x) => String(x.id) !== String(newCust.id)), newCust]);
          setCustomerId(String(newCust.id));
          setSiteId("");
        }}
      />
    );
  if (!quote) return <div className="qloading">Loading quotation…</div>;
  const locked = [
    "Sent",
    "Viewed",
    "Negotiation",
    "Accepted",
    "Rejected",
    "Converted to Project",
  ].includes(quote.status);
  const workflowSteps = [
      "Customer & Site",
      "Floors, Rooms & Items",
      "Pricing & Payment",
      "Scope, Warranty & Terms",
      "Preview & Send",
    ],
    stepIndex = workflowSteps.indexOf(tab),
    moveStep = (direction: number) => {
      const next = Math.min(
        4,
        Math.max(0, (stepIndex < 0 ? 0 : stepIndex) + direction),
      );
      setTab(workflowSteps[next]);
    };
  return (
    <div className="qworkspace">
      <header>
        <button onClick={close}>← Quotations</button>
        <div>
          <small>
            {quote.number} · REV {quote.revision || 0}
          </small>
          <h1>{snap.details?.title || quote.title}</h1>
          <span>
            {snap.details?.customerName || snap.details?.customer || quote.customer_name} · {snap.details?.siteName || snap.details?.site || quote.site_name}
          </span>
          <span>
            Created by {quote.created_name || quote.sales_name || "Techomie team"} · Last saved {quote.updated_at ? new Date(quote.updated_at).toLocaleString("en-IN") : "—"}
          </span>
        </div>
        <div className="qsave">
          <b>{save}</b>
          <em>{quote.status}</em>
        </div>
        <div className="qactions">
          <label className="documenttemplateselect">
            <span>PDF format</span>
            <select
              disabled={locked}
              value={snap.details?.pdfFormat || "auto"}
              onChange={(e) => change({...snap,details:{...snap.details,pdfFormat:e.target.value}})}
            >
              <option value="auto">Auto</option>
              <option value="detailed">Detailed proposal</option>
              <option value="compact">Compact quotation</option>
            </select>
          </label>
          <label className="documenttemplateselect">
            <span>PDF design</span>
            <select
              disabled={locked}
              value={
                snap.details?.templateId ||
                branding.defaultQuoteTemplate ||
                "luxury"
              }
              onChange={(e) =>
                change({
                  ...snap,
                  details: { ...snap.details, templateId: e.target.value },
                })
              }
            >
              {(
                branding.quoteTemplates || [
                  { id: "luxury", name: "Luxury Smart Home" },
                  { id: "technical", name: "Technical Blueprint" },
                  { id: "minimal", name: "Clean Minimal" },
                ]
              )
                .filter((x: R) => x.active !== false)
                .map((x: R) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <button onClick={() => pdf(false)} title="Print or Save vector PDF using browser print">
            Preview / Print
          </button>
          <button
            onClick={() => pdf(true)}
            disabled={pdfGenerating}
            className={pdfGenerating ? "loading" : ""}
            title="Download formatted A4 PDF proposal directly"
          >
            {pdfGenerating ? "⏳ Generating PDF…" : "Download PDF"}
          </button>
          {!locked && <button onClick={persist}>Save draft</button>}
          <button onClick={() => window.location.href = `/quotations/${quote.id}/revisions`}>More actions</button>
          {quote.status === "Draft" && (
            <button onClick={() => action("submit-review")}>
              Submit review
            </button>
          )}
          {quote.status === "Pending Internal Approval" && role === "admin" && (
            <button className="primary" onClick={() => action("send")}>
              Send quote
            </button>
          )}
          {[
            "Sent",
            "Viewed",
            "Negotiation",
            "Revision Required",
            "Rejected",
          ].includes(quote.status) && (
            <button onClick={() => action("revision")}>Create revision</button>
          )}
          {["admin", "crm", "sales"].includes(role) &&
            ["Sent", "Viewed", "Negotiation", "Revised"].includes(
              quote.status,
            ) && (
              <button
                className="primary"
                onClick={() =>
                  action("decision", {
                    decision: "Accepted",
                    customerName: quote.customer_name,
                  })
                }
              >
                Accept
              </button>
            )}
          {["admin", "crm", "sales"].includes(role) && quote.status === "Accepted" && (
            <button
              className="primary"
              onClick={async () => {
                const r = await fetch("/api/projects", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    quotationId: quote.id,
                    customerId: quote.customer_id,
                    siteId: quote.site_id,
                    title: snap.details?.title || quote.title,
                    category: quote.category || "Smart Home Automation",
                    managerId: quote.sales_id || quote.created_by,
                  }),
                });
                const d = await r.json();
                if (!r.ok) return notify(d.error);
                await action("converted", { projectId: d.project.id });
              }}
            >
              Convert to project
            </button>
          )}
          {role === "admin" && quote?.id && (
            <button
              style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
              onClick={async () => {
                if (!confirm(`Permanently delete quotation ${quote.number || quote.id}? This action cannot be undone.`)) return;
                const r = await fetch(`/api/quotations?id=${quote.id}`, { method: "DELETE" });
                const d = await r.json();
                if (!r.ok) {
                  notify(d.error || "Unable to delete quotation");
                  return;
                }
                notify(`Quotation ${quote.number || quote.id} deleted`);
                close();
              }}
            >
              🗑 Delete quotation
            </button>
          )}
        </div>
      </header>
      <nav className="qstepwizardnav">
        {workflowSteps.map((x, index) => {
          const isCurrent = tab === x;
          const isPassed = stepIndex > index;
          return (
            <Fragment key={x}>
              <button
                type="button"
                className={`qstepnavbtn ${isCurrent ? "active" : ""} ${isPassed ? "completed" : ""}`}
                onClick={() => setTab(x)}
                title={`Go to Step ${index + 1}: ${x}`}
              >
                <span className="qstepnum">
                  {isPassed ? "✓" : index + 1}
                </span>
                <span className="qsteplabel">
                  <small>Step {index + 1}</small>
                  <b>{x}</b>
                </span>
              </button>
              {index < workflowSteps.length - 1 && (
                <div className={`qstepdivider ${stepIndex > index ? "completed" : ""}`}>
                  <span className="qsteparrow">›</span>
                </div>
              )}
            </Fragment>
          );
        })}
      </nav>
      <main>
        {tab === "Customer & Site" ? (
          <Details
            snap={snap}
            set={change}
            quote={quote}
            locked={locked}
            customers={customers}
            allSites={filters.sites || []}
            customerId={customerId}
            siteId={siteId}
            setCustomerId={(value: string) => {
              setCustomerId(value);
              setSiteId("");
            }}
            setSiteId={setSiteId}
            onRelink={relink}
            users={filters.users || []}
            salesId={salesId}
            setSalesId={(value: string) => { const employee=(filters.users||[]).find((x:R)=>String(x.id)===value);setSalesId(value);change({...snap,details:{...snap.details,quotationByName:employee?.name||""}}); }}
            localCustomers={localCustomers}
            setLocalCustomers={setLocalCustomers}
          />
        ) : tab === "Floors, Rooms & Items" ? (
          <Builder
            snap={snap}
            set={change}
            locked={locked}
            openPicker={setPicker}
          />
        ) : tab === "Pricing & Payment" ? (
          <Payment
            snap={snap}
            set={change}
            total={totals.grand}
            locked={locked}
            section="pricing"
          />
        ) : tab === "Scope, Warranty & Terms" ? (
          <ScopeTerms snap={snap} set={change} locked={locked} />
        ) : tab === "Preview & Send" ? (
          <QuotePaperPremium
            quote={quote}
            snap={snap}
            totals={totals}
            branding={branding}
          />
        ) : tab === "Revisions" ? (
          <Activity rows={activity} revisions={revisions} />
        ) : (
          <Files rows={files} />
        )}
        {/* Step-by-Step in-between navigation bar */}
        {stepIndex >= 0 && (
          <div className="qstepflow-nav">
            <div className="qstepflow-progressbar">
              <div
                className="qstepflow-progressfill"
                style={{ width: `${Math.round(((stepIndex + 1) / workflowSteps.length) * 100)}%` }}
              />
            </div>

            <div className="qstepflow-body">
              {/* Previous Step Button */}
              <div className="qstepflow-left">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    className="qstepbtn prev"
                    onClick={() => moveStep(-1)}
                  >
                    <span className="arrow">←</span>
                    <div className="btnlabel">
                      <small>Previous Step {stepIndex}</small>
                      <b>{workflowSteps[stepIndex - 1]}</b>
                    </div>
                  </button>
                ) : (
                  <div className="qstepbtn-placeholder" />
                )}
              </div>

              {/* In-between Step Indicator and Quick Jump Pills */}
              <div className="qstepflow-center">
                <div className="qstepflow-info">
                  <span className="stepcount">Step {stepIndex + 1} of 5</span>
                  <span className="steptitle">{workflowSteps[stepIndex]}</span>
                </div>
                <div className="qstepflow-pills">
                  {workflowSteps.map((s, idx) => {
                    const isCurrent = idx === stepIndex;
                    const isDone = idx < stepIndex;
                    const shortNames = ["1. Customer", "2. Items", "3. Pricing", "4. Terms", "5. Preview"];
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`qstepflow-dot ${isCurrent ? "active" : ""} ${isDone ? "done" : ""}`}
                        onClick={() => setTab(s)}
                        title={`Navigate to Step ${idx + 1}: ${s}`}
                      >
                        <span className="num">{isDone ? "✓" : idx + 1}</span>
                        <span className="pilltext">{shortNames[idx]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Next Step Button */}
              <div className="qstepflow-right">
                {stepIndex < workflowSteps.length - 1 ? (
                  <button
                    type="button"
                    className="qstepbtn next primary"
                    onClick={() => moveStep(1)}
                  >
                    <div className="btnlabel">
                      <small>Next Step {stepIndex + 2}</small>
                      <b>{workflowSteps[stepIndex + 1]}</b>
                    </div>
                    <span className="arrow">→</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="qstepbtn complete primary"
                    onClick={() => {
                      if (persist) persist();
                    }}
                  >
                    <div className="btnlabel">
                      <small>Step 5 of 5</small>
                      <b>✓ Proposal Complete</b>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {tab !== "Preview & Send" && tab !== "Revisions" && (
        <aside>
          <Totals t={totals} />
          <div className="qvalid">
            <span>Validity</span>
            <b>{snap.details?.validUntil}</b>
          </div>
          <div className="qvalid">
            <span>Payment schedule</span>
            <b>
              {(snap.paymentPlan || []).reduce(
                (a: number, x: R) => a + Number(x.percent || 0),
                0,
              )}
              %
            </b>
          </div>
        </aside>
      )}
      {stepIndex >= 0 && (
        <div className="qworkflowfooter">
          <button
            disabled={stepIndex === 0}
            onClick={() => moveStep(-1)}
            title={stepIndex > 0 ? `Back to Step ${stepIndex}: ${workflowSteps[stepIndex - 1]}` : undefined}
          >
            ← {stepIndex > 0 ? workflowSteps[stepIndex - 1] : "Previous"}
          </button>
          <div className="qworkflowfooter-stepindicator">
            <span className="stepnum">Step {stepIndex + 1} of 5</span>
            <span className="stepname">{workflowSteps[stepIndex]}</span>
          </div>
          <button
            className="primary"
            disabled={stepIndex === 4}
            onClick={() => moveStep(1)}
            title={stepIndex < 4 ? `Proceed to Step ${stepIndex + 2}: ${workflowSteps[stepIndex + 1]}` : undefined}
          >
            {stepIndex < 4 ? `${workflowSteps[stepIndex + 1]} →` : "✓ Complete"}
          </button>
        </div>
      )}
      {picker && (
        <ItemPicker
          target={picker}
          role={role}
          taxMode={snap.taxMode || "GST"}
          close={() => setPicker(null)}
          add={(item: any) => {
            const next = structuredClone(snap);
            const floor = next.floors[picker.floor],
              room = floor.rooms[picker.room];
            room.items.push(item);
            change(next);
          }}
        />
      )}
      <div className="qmobilebar">
        {tab === "Floors, Rooms & Items" && !locked && (
          <button onClick={() => setPicker({ floor: 0, room: 0, floorName: snap?.floors?.[0]?.name || "Floor 1", roomName: snap?.floors?.[0]?.rooms?.[0]?.name || "Room" })}>Add Item</button>
        )}
        <button disabled={stepIndex <= 0} onClick={() => moveStep(-1)}>Previous</button>
        <button disabled={stepIndex < 0 || stepIndex >= 4} onClick={() => moveStep(1)}>Next</button>
        <button onClick={() => setTab("Preview & Send")}>Preview</button>
        {!locked && (
          <button className="primary" onClick={persist}>
            Save Draft
          </button>
        )}
      </div>
    </div>
  );
}
function NewQuote({
  snap,
  set,
  customers,
  sites,
  customerId,
  setCustomerId,
  siteId,
  setSiteId,
  create,
  creating,
  close,
  users,
  salesId,
  setSalesId,
  onCustomerCreated,
}: R) {
  const [showQCC, setShowQCC] = useState(false);
  return (
    <div className="newquote">
      {showQCC && (
        <QuickCreateCustomer
          onCreated={(c) => {
            setShowQCC(false);
            if (onCustomerCreated) onCustomerCreated(c);
            setCustomerId(String(c.id));
          }}
          onClose={() => setShowQCC(false)}
        />
      )}
      <header>
        <button onClick={close}>← Back</button>
        <div>
          <small>NEW QUOTATION</small>
          <h1>Start a persistent draft</h1>
          <p>Customer → Site → Details → Rooms → Items → Payment → Preview</p>
        </div>
      </header>
      <div className="newquotecard">
        <div className="qcc-row">
          <label style={{ flex: 1 }}>
            <span>Customer *</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c: R) => (
                <option value={c.id} key={c.id}>
                  {c.name}{c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="qcc-add-btn"
            title="Create a new customer on the spot"
            onClick={() => setShowQCC(true)}
          >
            ＋ New
          </button>
        </div>
        <label>
          <span>Installation site *</span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Select site</option>
            {sites.map((s: R) => (
              <option value={s.id} key={s.id}>
                {s.name} · {s.city}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          <span>Project title *</span>
          <input
            value={snap.details.title}
            onChange={(e) =>
              set({
                ...snap,
                details: { ...snap.details, title: e.target.value },
              })
            }
          />
        </label>
        <label>
          <span>Quote type</span>
          <select
            value={snap.details.quoteType}
            onChange={(e) =>
              set({
                ...snap,
                details: { ...snap.details, quoteType: e.target.value },
              })
            }
          >
            {quotationTypes.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Project type</span>
          <select
            value={snap.details.projectType}
            onChange={(e) =>
              set({
                ...snap,
                details: { ...snap.details, projectType: e.target.value },
              })
            }
          >
            {[
              "Home",
              "Villa",
              "Apartment",
              "Office",
              "Hotel",
              "Commercial",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Quote date</span>
          <input
            type="date"
            value={snap.details.quoteDate}
            onChange={(e) =>
              set({
                ...snap,
                details: { ...snap.details, quoteDate: e.target.value },
              })
            }
          />
        </label>
        <label>
          <span>Quotation by</span>
          <select value={salesId} onChange={(e) => setSalesId(e.target.value)}>
            <option value="">Current user</option>
            {(users || []).map((user: R) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
          </select>
        </label>
        <label>
          <span>Valid until</span>
          <input
            type="date"
            value={snap.details.validUntil}
            onChange={(e) =>
              set({
                ...snap,
                details: { ...snap.details, validUntil: e.target.value },
              })
            }
          />
        </label>
        <div className="wide newquoteactions">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            disabled={creating || !customerId || !siteId || !snap.details.title}
            onClick={create}
          >
            {creating ? "Creating…" : "Create quotation draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Details({
  snap,
  set,
  quote,
  locked,
  customers,
  allSites,
  customerId,
  siteId,
  setCustomerId,
  setSiteId,
  onRelink,
  users,
  salesId,
  setSalesId,
  localCustomers,
  setLocalCustomers,
}: R) {
  const [showQCC, setShowQCC] = useState(false);
  const allCustomers = [...(customers || []), ...((localCustomers as R[] | undefined) || []).filter((lc: R) => !(customers || []).some((c: R) => String(c.id) === String(lc.id)))];
  const d = snap.details || {},
    change = (k: string, v: any) => set({ ...snap, details: { ...d, [k]: v } }),
    customerSites = (allSites || []).filter(
      (site: R) => String(site.customer_id) === String(customerId),
    );
  return (
    <>
    {showQCC && (
      <QuickCreateCustomer
        onCreated={(c) => {
          setShowQCC(false);
          if (setLocalCustomers) setLocalCustomers((prev: R[]) => [...prev.filter((x: R) => String(x.id) !== String(c.id)), c]);
          setCustomerId(String(c.id));
        }}
        onClose={() => setShowQCC(false)}
      />
    )}
    <section className="qcard">
      <h2>Customer and quotation details</h2>
      <div className="qform">
        <label>
          <span>Quote number</span>
          <input disabled value={quote.number} />
        </label>
        <label>
          <span>Revision</span>
          <input disabled value={`Rev ${quote.revision || 0}`} />
        </label>
        <label className="wide">
          <span>Quotation / project title</span>
          <input disabled={locked} value={d.title || quote.title || ""} onChange={(e) => change("title", e.target.value)} />
        </label>
        <label>
          <span>Quote type</span>
          <select disabled={locked} value={d.quoteType || quote.quote_type || quotationTypes[0]} onChange={(e) => change("quoteType", e.target.value)}>
            {quotationTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Project type</span>
          <select disabled={locked} value={d.projectType || "Other"} onChange={(e) => change("projectType", e.target.value)}>
            {["Home","Villa","Apartment","Office","Hotel","Commercial","Other"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>
          <span>Quote date</span>
          <input
            disabled={locked}
            type="date"
            value={d.quoteDate || quote.quote_date || ""}
            onChange={(e) => change("quoteDate", e.target.value)}
          />
        </label>
        <label>
          <span>Validity date</span>
          <input
            disabled={locked}
            type="date"
            value={d.validUntil || quote.valid_until || ""}
            onChange={(e) => change("validUntil", e.target.value)}
          />
        </label>
        <div className="qcc-row">
          <label style={{ flex: 1 }}>
            <span>Customer</span>
            <select
              disabled={locked}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer</option>
              {allCustomers.map((customer: R) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}{customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
          {!locked && (
            <button
              type="button"
              className="qcc-add-btn"
              title="Create a new customer on the spot"
              onClick={() => setShowQCC(true)}
            >
              ＋ New
            </button>
          )}
        </div>
        <label>
          <span>Installation site</span>
          <select
            disabled={locked || !customerId}
            value={siteId}
            onChange={(e) => {
              const value = e.target.value;
              setSiteId(value);
              if (value) onRelink(customerId, value);
            }}
          >
            <option value="">
              {customerId ? "Select customer site" : "Select customer first"}
            </option>
            {customerSites.map((site: R) => (
              <option key={site.id} value={site.id}>
                {site.name} · {site.city || "Address saved"}
              </option>
            ))}
          </select>
        </label>
        {!locked && (
          <p className="qrelationhint">
            Changing the customer requires selecting one of that customer's
            saved sites. The quotation updates as soon as the site is selected.
          </p>
        )}
        <label>
          <span>Contact</span>
          <input
            disabled={locked}
            value={d.contactName ?? quote.contact_name ?? quote.primary_contact ?? ""}
            onChange={(e) => change("contactName", e.target.value)}
          />
        </label>
        <label className="wide">
          <span>Installation address</span>
          <textarea
            disabled={locked}
            value={d.installationAddress ?? `${quote.site_address || ""}, ${quote.city || ""}, ${quote.state || ""} ${quote.pincode || ""}`}
            onChange={(e) => change("installationAddress", e.target.value)}
          />
        </label>
        <label>
          <span>GSTIN</span>
          <input disabled={locked} value={d.gstin ?? quote.gstin ?? "Unregistered"} onChange={(e) => change("gstin", e.target.value)} />
        </label>
        <label>
          <span>Quotation tax mode</span>
          <select
            disabled={locked}
            value={snap.taxMode || "GST"}
            onChange={(e) => {
              const taxMode = e.target.value;
              const next = structuredClone(snap);
              next.taxMode = taxMode;
              for (const floor of next.floors || [])
                for (const room of floor.rooms || [])
                  for (const item of room.items || []) item.taxMode = taxMode;
              for (const item of next.projectItems || []) item.taxMode = taxMode;
              set(next);
            }}
          >
            <option value="GST">GST Bill</option>
            <option value="Non-GST">Non-GST Bill</option>
          </select>
        </label>
        <label>
          <span>Quotation by</span>
          <select disabled={locked} value={salesId} onChange={(e) => setSalesId(e.target.value)}>
            <option value="">Select employee</option>
            {(users || []).map((user: R) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
          </select>
        </label>
        <label>
          <span>Interior / builder / architect</span>
          <input
            disabled={locked}
            value={d.reference || ""}
            onChange={(e) => change("reference", e.target.value)}
          />
        </label>
        <label>
          <span>Customer PO / reference</span>
          <input disabled={locked} value={d.customerReference || ""} onChange={(e) => change("customerReference", e.target.value)} />
        </label>
        <label>
          <span>Expected installation</span>
          <input
            disabled={locked}
            type="date"
            value={d.installationDate || ""}
            onChange={(e) => change("installationDate", e.target.value)}
          />
        </label>
        <label className="wide">
          <span>Customer proposal message</span>
          <textarea
            disabled={locked}
            value={d.introduction || ""}
            onChange={(e) => change("introduction", e.target.value)}
          />
        </label>
        <label className="wide internal">
          <span>Internal notes · never shown to customer</span>
          <textarea
            disabled={locked}
            value={d.internalNotes || ""}
            onChange={(e) => change("internalNotes", e.target.value)}
          />
        </label>
      </div>
    </section>
    </>
  );
}
function Builder({ snap, set, locked, openPicker }: R) {
  const [adding, setAdding] = useState<null | {
      kind: "room" | "floor";
      floor?: number;
      name: string;
    }>(null),
    [editingItem, setEditingItem] = useState(""),
    floors = snap.floors || [],
    mut = (fn: (n: R) => void) => {
      const n = structuredClone(snap || {});
      if (!Array.isArray(n.floors)) n.floors = [];
      if (!Array.isArray(n.projectItems)) n.projectItems = [];
      for (const floor of n.floors) {
        if (!Array.isArray(floor.rooms)) floor.rooms = [];
        for (const room of floor.rooms) {
          if (!Array.isArray(room.items)) room.items = [];
        }
      }
      fn(n);
      set(n);
    };
  return (
    <div className="qbuilder">
      <section className="qtaxmodebar">
        <div><b>Quotation billing mode</b><span>Applies to every item in this quotation</span></div>
        <select
          disabled={locked}
          value={snap.taxMode || "GST"}
          onChange={(e) => {
            const taxMode = e.target.value;
            mut((next) => {
              next.taxMode = taxMode;
              for (const floor of next.floors || [])
                for (const room of floor.rooms || [])
                  for (const item of room.items || []) item.taxMode = taxMode;
              for (const item of next.projectItems || []) item.taxMode = taxMode;
            });
          }}
        >
          <option value="GST">GST Bill</option>
          <option value="Non-GST">Non-GST Bill</option>
        </select>
      </section>
      {floors.map((f: R, fi: number) => (
        <section className="qfloor" key={fi}>
          <header>
            <input
              disabled={locked}
              value={f.name}
              onChange={(e) => mut((n) => (n.floors[fi].name = e.target.value))}
            />
            <b>
              {f.rooms.reduce(
                (a: number, r: R) => a + (r.items?.length || 0),
                0,
              )}{" "}
              items
            </b>
            {!locked && (
              <>
                <button
                  onClick={() => mut((n) => n.floors.push(structuredClone(f)))}
                >
                  Duplicate floor
                </button>
                <button
                  className="danger"
                  onClick={() => mut((n) => n.floors.splice(fi, 1))}
                >
                  Remove
                </button>
              </>
            )}
          </header>
          <div>
            {f.rooms.map((r: R, ri: number) => (
              <article className="qroom" key={ri}>
                <div className="qroomhead">
                  <input
                    disabled={locked}
                    value={r.name}
                    onChange={(e) =>
                      mut((n) => (n.floors[fi].rooms[ri].name = e.target.value))
                    }
                  />
                  <span>
                    {money(
                      (r.items || []).reduce(
                        (a: number, x: R) => a + line(x).total,
                        0,
                      ),
                    )}
                  </span>
                  {!locked && (
                    <>
                      <button
                        onClick={() => openPicker({ floor: fi, room: ri, floorName: f.name, roomName: r.name })}
                      >
                        ＋ Add item
                      </button>
                      <button
                        onClick={() =>
                          mut((n) =>
                            n.floors[fi].rooms.push(structuredClone(r)),
                          )
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm(`Remove ${r.name} and all items inside it?`))
                            mut((n) => n.floors[fi].rooms.splice(ri, 1));
                        }}
                      >
                        Remove room
                      </button>
                    </>
                  )}
                </div>
                <input
                  className="roomnote"
                  disabled={locked}
                  placeholder="Room note"
                  value={r.note || ""}
                  onChange={(e) =>
                    mut((n) => (n.floors[fi].rooms[ri].note = e.target.value))
                  }
                />
                <div className="qitems">
                  {(r.items || []).map((x: R, ii: number) => {
                    const itemKey = `${fi}-${ri}-${ii}`;
                    const showVariants = editingItem === itemKey;
                    return <article className="qitemcard" key={itemKey}>
                    {/* ── Top row: image / name / pills / qty / price / disc / total / actions ── */}
                    <div className="qitem">
                      <div className="qitem-thumb-wrapper" style={{ position: "relative", width: "46px", height: "46px", flexShrink: 0 }}>
                        <img
                          src={resolveImageUrl(x.image) || "/techomie-logo.jpg"}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0" }}
                        />
                        {!locked && (
                          <label
                            title="Upload / Change Photo"
                            style={{
                              position: "absolute",
                              bottom: "-4px",
                              right: "-4px",
                              background: "#2563eb",
                              color: "#fff",
                              borderRadius: "50%",
                              width: "18px",
                              height: "18px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              cursor: "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }}
                          >
                            📷
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const fd = new FormData();
                                fd.set("image", file);
                                const res = await fetch("/api/uploads", { method: "POST", body: fd });
                                const dat = await res.json();
                                if (res.ok && dat.url) {
                                  const key = dat.key || String(dat.url).split("/").pop();
                                  mut((n) => {
                                    n.floors[fi].rooms[ri].items[ii].image = dat.url;
                                  });
                                  if (x.variantId) {
                                    fetch("/api/products", {
                                      method: "PATCH",
                                      headers: { "content-type": "application/json" },
                                      body: JSON.stringify({ variantId: x.variantId, action: "update_image", imageKey: key }),
                                    }).catch(() => {});
                                  }
                                } else {
                                  alert(dat.error || "Unable to upload image");
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <span>
                        {locked ? (
                          <b>
                            {x.name}
                            {x.series && <span className="item-pill-badge series">{x.series}</span>}
                            {x.technology && <span className="item-pill-badge tech">{x.technology}</span>}
                            {x.material && <span className="item-pill-badge mat">{x.material}</span>}
                            {x.edgeColor && <span className="item-pill-badge edge">{x.edgeColor}</span>}
                            {x.panelColor && <span className="item-pill-badge panel">{x.panelColor}</span>}
                            {x.module && <span className="item-pill-badge mod">{x.module}M</span>}
                          </b>
                        ) : (
                          <input
                            className="qitem-name-input"
                            value={x.name || ""}
                            placeholder="Item name"
                            onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].name = e.target.value)}
                          />
                        )}
                        <small>
                          {x.brand} · {x.sku} · {x.variantSummary || ""}
                        </small>
                      </span>
                      <label>
                        Qty
                        <input
                          disabled={locked}
                          type="number"
                          min="1"
                          step="1"
                          value={wholeQty(x.qty)}
                          onChange={(e) =>
                            mut(
                              (n) =>
                                (n.floors[fi].rooms[ri].items[ii].qty = wholeQty(
                                  e.target.value,
                                )),
                            )
                          }
                        />
                      </label>
                      <label>
                        Rate ₹
                        <input
                          disabled={locked}
                          type="number"
                          value={x.price}
                          onChange={(e) =>
                            mut(
                              (n) =>
                                (n.floors[fi].rooms[ri].items[ii].price =
                                  Number(e.target.value)),
                            )
                          }
                        />
                      </label>
                      <label>
                        Disc %
                        <input
                          disabled={locked}
                          type="number"
                          min="0"
                          max="100"
                          value={x.discount || 0}
                          onChange={(e) =>
                            mut(
                              (n) =>
                                (n.floors[fi].rooms[ri].items[ii].discount =
                                  Number(e.target.value)),
                            )
                          }
                        />
                      </label>
                      <strong>{money(line(x).total)}</strong>
                      {!locked && (
                        <div className="qitemactions">
                          <button disabled={ii === 0} title="Move up" onClick={() => mut((n) => {const a=n.floors[fi].rooms[ri].items;[a[ii-1],a[ii]]=[a[ii],a[ii-1]]})}>↑</button>
                          <button disabled={ii === r.items.length - 1} title="Move down" onClick={() => mut((n) => {const a=n.floors[fi].rooms[ri].items;[a[ii],a[ii+1]]=[a[ii+1],a[ii]]})}>↓</button>
                          <button
                            title={showVariants ? "Hide variants" : "Variants / swap"}
                            className={showVariants ? "active" : ""}
                            onClick={() => setEditingItem(showVariants ? "" : itemKey)}
                          >
                            {showVariants ? "▲ Variants" : "▼ Variants"}
                          </button>
                          <button className="danger" title="Remove item" onClick={() => mut((n) => n.floors[fi].rooms[ri].items.splice(ii, 1))}>×</button>
                        </div>
                      )}
                    </div>

                    {/* ── Always-visible inline editable detail fields ── */}
                    {!locked && (
                      <div className="qiteminline">
                        <label><span>Description</span><textarea rows={2} value={x.description || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].description = e.target.value)} /></label>
                        <label><span>Line note / exclusions</span><textarea rows={2} value={x.note || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].note = e.target.value)} /></label>
                        <label><span>Unit</span><input value={x.unit || "Nos"} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].unit = e.target.value)} /></label>
                        <label><span>GST %</span><input type="number" disabled={(snap.taxMode || "GST") === "Non-GST"} value={x.gst || 0} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].gst = Number(e.target.value))} /></label>
                        <label><span>Warranty</span><input value={x.warranty || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].warranty = e.target.value)} /></label>
                        <label><span>Photo URL / key</span><input placeholder="/products/... or filename" value={x.image || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].image = e.target.value)} /></label>
                        <label className="qitemcheck"><input type="checkbox" checked={!!x.optional} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].optional = e.target.checked)} /><span>Optional item</span></label>
                      </div>
                    )}

                    {/* ── Variant selector (collapsible) ── */}
                    {showVariants && <div className="qitemedit">
                      <div className="qitemeditvariantbox">
                        <h4>Switch Variant &amp; Customization</h4>
                        <div className="qitemeditvariantrows">
                          {Array.isArray(x.availableVariants) && x.availableVariants.length > 1 && (
                            <>
                              <div className="variantgroup">
                                <span className="variantgrouplabel">Switch Variant / Series</span>
                                <div className="variantpills">
                                  {SMART_SWITCH_SERIES.map((s) => {
                                    const isAvail = x.availableVariants.some((v: R) => v.series === s.id);
                                    const isSelected = x.series === s.id;
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                        disabled={!isAvail}
                                        onClick={() => {
                                          const match = x.availableVariants.find((v: R) => v.series === s.id && v.technology === x.technology && v.material === x.material)
                                                     || x.availableVariants.find((v: R) => v.series === s.id && v.technology === x.technology)
                                                     || x.availableVariants.find((v: R) => v.series === s.id);
                                          if (match) {
                                            mut((n) => {
                                              const it = n.floors[fi].rooms[ri].items[ii];
                                              it.variantId = match.variantId;
                                              it.productId = match.productId || it.productId;
                                              it.sku = match.sku;
                                              it.price = match.price;
                                              it.purchaseCost = match.purchaseCost;
                                              it.series = match.series;
                                              it.technology = match.technology;
                                              it.material = match.material;
                                              it.variantSummary = `${match.series} · ${match.technology} · ${match.material}${it.edgeColor ? ` · ${it.edgeColor}` : ""}${it.panelColor ? ` · ${it.panelColor}` : ""}${it.module ? ` · ${it.module} Module` : ""}`;
                                            });
                                          }
                                        }}
                                      >
                                        <span className="pillicon">{s.icon}</span>
                                        <span className="pilllabel">{s.label}</span>
                                        {isSelected && <span className="pillcheck">✓</span>}
                                        {!isAvail && <small className="pillna">(N/A)</small>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="variantgroup">
                                <span className="variantgrouplabel">Technology</span>
                                <div className="variantpills">
                                  {SMART_SWITCH_TECHNOLOGIES.map(t => {
                                    const isAvail = x.availableVariants.some((v: R) => (!x.series || v.series === x.series) && v.technology === t.id);
                                    const isSelected = x.technology === t.id;
                                    return (
                                      <button
                                        key={t.id}
                                        type="button"
                                        className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                        disabled={!isAvail}
                                        onClick={() => {
                                          const match = x.availableVariants.find((v: R) => (!x.series || v.series === x.series) && v.technology === t.id && v.material === x.material)
                                                     || x.availableVariants.find((v: R) => (!x.series || v.series === x.series) && v.technology === t.id);
                                          if (match) {
                                            mut((n) => {
                                              const it = n.floors[fi].rooms[ri].items[ii];
                                              it.variantId = match.variantId;
                                              it.productId = match.productId || it.productId;
                                              it.sku = match.sku;
                                              it.price = match.price;
                                              it.purchaseCost = match.purchaseCost;
                                              it.technology = match.technology;
                                              it.material = match.material;
                                              it.variantSummary = `${it.series || ""} · ${match.technology} · ${match.material}${it.edgeColor ? ` · ${it.edgeColor}` : ""}${it.panelColor ? ` · ${it.panelColor}` : ""}${it.module ? ` · ${it.module} Module` : ""}`;
                                            });
                                          }
                                        }}
                                      >
                                        <span className="pillicon">{t.icon}</span>
                                        <span className="pilllabel">{t.label}</span>
                                        {isSelected && <span className="pillcheck">✓</span>}
                                        {!isAvail && <small className="pillna">(N/A)</small>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="variantgroup">
                                <span className="variantgrouplabel">Material</span>
                                <div className="variantpills">
                                  {SMART_SWITCH_MATERIALS.map(m => {
                                    const isAvail = x.availableVariants.some((v: R) => (!x.series || v.series === x.series) && v.material === m.id);
                                    const isSelected = x.material === m.id;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                        disabled={!isAvail}
                                        onClick={() => {
                                          const match = x.availableVariants.find((v: R) => (!x.series || v.series === x.series) && v.material === m.id && v.technology === x.technology)
                                                     || x.availableVariants.find((v: R) => (!x.series || v.series === x.series) && v.material === m.id);
                                          if (match) {
                                            mut((n) => {
                                              const it = n.floors[fi].rooms[ri].items[ii];
                                              it.variantId = match.variantId;
                                              it.productId = match.productId || it.productId;
                                              it.sku = match.sku;
                                              it.price = match.price;
                                              it.purchaseCost = match.purchaseCost;
                                              it.material = match.material;
                                              it.variantSummary = `${it.series || ""} · ${it.technology || ""} · ${match.material}${it.edgeColor ? ` · ${it.edgeColor}` : ""}${it.panelColor ? ` · ${it.panelColor}` : ""}${it.module ? ` · ${it.module} Module` : ""}`;
                                            });
                                          }
                                        }}
                                      >
                                        <span className="pillicon">{m.icon}</span>
                                        <span className="pilllabel">{m.label}</span>
                                        {isSelected && <span className="pillcheck">✓</span>}
                                        {!isAvail && <small className="pillna">(N/A)</small>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}

                          <div className="variantgroup">
                            <span className="variantgrouplabel">Edge / Bezel Colour</span>
                            <div className="variantpills">
                              {SMART_SWITCH_EDGE_COLORS.map((ec) => {
                                const isSelected = x.edgeColor === ec.id;
                                return (
                                  <button
                                    key={ec.id}
                                    type="button"
                                    className={`variantpill ${isSelected ? "active" : ""}`}
                                    onClick={() => {
                                      mut((n) => {
                                        const it = n.floors[fi].rooms[ri].items[ii];
                                        it.edgeColor = ec.id;
                                        it.variantSummary = `${it.series || ""} · ${it.technology || ""} · ${it.material || ""} · ${ec.id}${it.panelColor ? ` · ${it.panelColor}` : ""}${it.module ? ` · ${it.module} Module` : ""}`;
                                      });
                                    }}
                                  >
                                    <span className="pillcolorindicator" style={{ backgroundColor: ec.colorCode }} />
                                    <span className="pillicon">{ec.icon}</span>
                                    <span className="pilllabel">{ec.label}</span>
                                    {isSelected && <span className="pillcheck">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="variantgroup">
                            <span className="variantgrouplabel">Plate / Panel Colour</span>
                            <div className="variantpills">
                              {SMART_SWITCH_PANEL_COLORS.map((pc) => {
                                const isSelected = x.panelColor === pc.id;
                                return (
                                  <button
                                    key={pc.id}
                                    type="button"
                                    className={`variantpill ${isSelected ? "active" : ""}`}
                                    onClick={() => {
                                      mut((n) => {
                                        const it = n.floors[fi].rooms[ri].items[ii];
                                        it.panelColor = pc.id;
                                        it.variantSummary = `${it.series || ""} · ${it.technology || ""} · ${it.material || ""}${it.edgeColor ? ` · ${it.edgeColor}` : ""} · ${pc.id}${it.module ? ` · ${it.module} Module` : ""}`;
                                      });
                                    }}
                                  >
                                    <span className="pillcolorindicator" style={{ backgroundColor: pc.colorCode }} />
                                    <span className="pillicon">{pc.icon}</span>
                                    <span className="pilllabel">{pc.label}</span>
                                    {isSelected && <span className="pillcheck">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>}
                    </article>})}
                </div>
              </article>
            ))}
          </div>
          {!locked && (
            <div className="qflooractions">
              <button
                onClick={() =>
                  setAdding({ kind: "room", floor: fi, name: roomNames[0] })
                }
              >
                ＋ Add room
              </button>
            </div>
          )}
        </section>
      ))}
      {!locked && (
        <button
          className="addfloor"
          onClick={() =>
            setAdding({
              kind: "floor",
              name: floors.length
                ? `Floor ${floors.length + 1}`
                : "Ground Floor",
            })
          }
        >
          ＋ Add floor
        </button>
      )}
      {adding && (
        <div className="modalback">
          <form
            className="qnamemodal"
            onSubmit={(e) => {
              e.preventDefault();
              const name = adding.name.trim();
              if (!name) return;
              if (adding.kind === "room")
                mut((n) => {
                  if (!Array.isArray(n.floors)) n.floors = [];
                  const floorIdx = adding.floor ?? 0;
                  if (!n.floors[floorIdx]) {
                    n.floors[floorIdx] = { name: "Ground Floor", rooms: [] };
                  }
                  if (!Array.isArray(n.floors[floorIdx].rooms)) {
                    n.floors[floorIdx].rooms = [];
                  }
                  n.floors[floorIdx].rooms.push({
                    name,
                    note: "",
                    items: [],
                  });
                });
              else
                mut((n) => {
                  if (!Array.isArray(n.floors)) n.floors = [];
                  n.floors.push({
                    name,
                    rooms: [{ name: "Room", note: "", items: [] }],
                  });
                });
              setAdding(null);
            }}
          >
            <header>
              <div>
                <small>QUOTATION STRUCTURE</small>
                <h2>Add {adding.kind}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setAdding(null)}
              >
                &times;
              </button>
            </header>
            <label>
              <span>{adding.kind === "room" ? "Room name" : "Floor name"}</span>
              <input
                autoFocus
                list={
                  adding.kind === "room"
                    ? "standard-room-names"
                    : "standard-floor-names"
                }
                value={adding.name}
                onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                placeholder={
                  adding.kind === "room" ? "Living Room" : "First Floor"
                }
              />
              <datalist id="standard-room-names">
                {roomNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <datalist id="standard-floor-names">
                {[
                  "Basement",
                  "Ground Floor",
                  "First Floor",
                  "Second Floor",
                  "Third Floor",
                  "Terrace",
                  "Outdoor",
                ].map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <div>
              <button type="button" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={!adding.name.trim()}
              >
                Add {adding.kind === "room" ? "Room" : "Floor"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function ItemPicker({ target, role, taxMode, close, add }: R) {
  const [q, setQ] = useState(""),
    [items, setItems] = useState<R[]>([]),
    [loading, setLoading] = useState(false),
    [category, setCategory] = useState("Smart switches"),
    [seriesFilter, setSeriesFilter] = useState(""),
    [model, setModel] = useState(""),
    [technology, setTechnology] = useState(""),
    [material, setMaterial] = useState(""),
    [switchCount, setSwitchCount] = useState(""),
    [fanCount, setFanCount] = useState(""),
    [hvFilter, setHvFilter] = useState(""),
    [plugCount, setPlugCount] = useState(""),
    [moduleSize, setModuleSize] = useState(""),
    [added, setAdded] = useState(0),
    [showCustom, setShowCustom] = useState(false),
    [custom, setCustom] = useState<R>({ name: "", description: "", qty: 1, unit: "Nos", price: 0, discount: 0, gst: 18, warranty: "", note: "" }),
    [modelSelections, setModelSelections] = useState<Record<string, { series?: string; technology?: string; material?: string; edgeColor?: string; panelColor?: string; qty?: number }>>({});

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const query = encodeURIComponent(q.trim());
      // When a search term is entered, search across the entire catalog regardless of category
      const catParam = (q.trim() || !category) ? "" : `&category=${encodeURIComponent(category)}`;
      const limitParam = (category === "Smart switches" && !q.trim()) ? 3500 : 1500;
      try {
        const [masterResponse, legacyResponse] = await Promise.all([
          fetch(`/api/item-master?view=quotation&q=${query}`),
          fetch(`/api/products?q=${query}${catParam}&page=1&limit=${limitParam}&active=active`),
        ]);
        const [master, legacy] = await Promise.all([
          masterResponse.ok ? masterResponse.json() : { items: [] },
          legacyResponse.ok ? legacyResponse.json() : { items: [] },
        ]);
        const authoritative = master.items || [];
        const existing = legacy.items || [];
        setItems([...authoritative, ...existing.filter((item: R) => !authoritative.some((current: R) => current.sku === item.sku))]);
      } catch (err) {
        console.error("Failed to load products", err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, category]);

  const parsed: R[] = items.map((item: R): R => {
    let attrs: R = {};
    try {
      attrs = typeof item.attributes === "string" ? JSON.parse(item.attributes || "{}") : (item.attributes || {});
    } catch {
      attrs = {};
    }
    const normTech = normalizeSwitchTech(attrs.technology);
    const normMat = normalizeSwitchMat(attrs.material || attrs.finish);
    const normSeries = normalizeSwitchSeries(item.series || attrs.series || item.name);
    const switchSpecs = parseSwitchSpecs(item.name, attrs);
    return {
      ...item,
      parsedAttributes: attrs,
      normTech,
      normMat,
      normSeries,
      switchSpecs,
    };
  });

  const categories = [
    "Smart switches",
    "Door locks",
    "Security system",
    "Gate automation",
    "Smart curtains",
    "Lighting",
    "Others",
  ];

  const matchesPickerCategory = (itemCat: string, selectedCat: string): boolean => {
    if (!selectedCat) return true;
    const ic = (itemCat || "").toLowerCase();
    const sc = (selectedCat || "").toLowerCase();
    if (ic === sc) return true;
    if (sc.includes("doorlock") || sc.includes("door lock") || sc.includes("lock")) {
      return ic.includes("lock");
    }
    if (sc.includes("curtain")) {
      return ic.includes("curtain");
    }
    if (sc.includes("security")) {
      return ic.includes("security") || ic.includes("sensor") || ic.includes("doorbell") || ic.includes("vdp") || ic.includes("video") || ic.includes("panel");
    }
    if (sc.includes("gate")) {
      return ic.includes("gate") || ic.includes("barrier") || ic.includes("door automation") || ic.includes("window automation");
    }
    if (sc.includes("light")) {
      return ic.includes("light");
    }
    if (sc === "others") {
      return !["switch", "lock", "curtain", "gate", "light", "security"].some((c) => ic.includes(c));
    }
    return ic.includes(sc);
  };

  const switchModelsMap = new Map<string, R>();
  const regularItems: R[] = [];

  for (const item of parsed) {
    const isSwitch = item.category === "Smart switches";
    if (!isSwitch) {
      regularItems.push(item);
      continue;
    }
    const baseName = getSwitchBaseName(item.name);
    const mod = item.switchSpecs?.moduleSize || item.parsedAttributes.module || "std";
    const key = `${baseName}__${mod}`;
    if (!switchModelsMap.has(key)) {
      const displayName = baseName;
      const specs = parseSwitchSpecs(displayName, item.parsedAttributes);
      switchModelsMap.set(key, {
        key,
        productId: item.product_id,
        name: displayName,
        rawName: item.name,
        brand: item.brand,
        category: item.category,
        series: item.normSeries || item.series,
        module: specs.moduleSize || item.parsedAttributes.module || "",
        specs,
        shortDescription: item.short_description || item.description,
        description: item.description,
        unit: item.unit || "Nos",
        defaultTax: item.tax_rate || item.default_tax || 18,
        defaultWarranty: item.warranty || item.default_warranty || "",
        image: resolveImageUrl(item.image_key),
        variants: [],
      });
    }
    const m = switchModelsMap.get(key)!;
    if (!m.image && item.image_key) m.image = resolveImageUrl(item.image_key);
    m.variants.push(item);
  }

  const allSwitchModels = Array.from(switchModelsMap.values());

  const modelOptions = category === "Smart switches"
    ? allSwitchModels.map((m) => ({ id: m.key, name: `${m.name}${m.module ? ` (${m.module}M)` : ""}` }))
    : [...new Map(regularItems.map((item) => [String(item.product_id), { id: String(item.product_id), name: item.name }])).values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const techOptions = category === "Smart switches"
    ? SMART_SWITCH_TECHNOLOGIES.map((t) => t.id)
    : [...new Set(regularItems.map((item) => item.parsedAttributes.technology || item.normTech).filter(Boolean))].sort();

  const matOptions = category === "Smart switches"
    ? SMART_SWITCH_MATERIALS.map((m) => m.id)
    : [...new Set(regularItems.flatMap((item) => [item.parsedAttributes.material, item.parsedAttributes.finish, item.normMat]).filter(Boolean))].sort();

  const availableModules = Array.from(
    new Set(allSwitchModels.map((m) => m.module || m.specs?.moduleSize).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b));

  const availableSwitches = Array.from(
    new Set(allSwitchModels.map((m) => m.specs?.switches).filter((s) => s && s !== "0"))
  ).sort((a, b) => {
    const numA = Number(a), numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return String(a).localeCompare(String(b));
  });

  const activeSwitchFiltersCount = [
    seriesFilter,
    moduleSize,
    switchCount,
    fanCount,
    hvFilter,
    plugCount,
  ].filter(Boolean).length;

  const resetSwitchFilters = () => {
    setSeriesFilter("");
    setModuleSize("");
    setSwitchCount("");
    setFanCount("");
    setHvFilter("");
    setPlugCount("");
  };

  const filteredSwitchModels = allSwitchModels.filter((m) => {
    if (category && category !== "Smart switches") return false;
    if (seriesFilter) {
      const hasSeries = m.variants.some((v: R) => (v.normSeries || v.series) === seriesFilter);
      if (!hasSeries) return false;
    }
    if (model && m.key !== model && String(m.productId) !== model) return false;
    if (technology) {
      const hasTech = m.variants.some((v: R) => v.normTech === technology);
      if (!hasTech) return false;
    }
    if (material) {
      const hasMat = m.variants.some((v: R) => v.normMat === material);
      if (!hasMat) return false;
    }
    // Switch specifications filters:
    if (moduleSize && m.module !== moduleSize && m.specs?.moduleSize !== moduleSize) {
      return false;
    }
    if (switchCount && m.specs?.switches !== switchCount) {
      return false;
    }
    if (fanCount) {
      if (fanCount === "0" && m.specs?.fan !== "0") return false;
      if (fanCount === "with_fan" && m.specs?.fan === "0") return false;
      if (fanCount !== "0" && fanCount !== "with_fan" && m.specs?.fan !== fanCount) return false;
    }
    if (hvFilter) {
      if (hvFilter === "with_hv" && !m.specs?.hasHvSwitch) return false;
      if (hvFilter === "any_16a" && !m.specs?.hasAny16A) return false;
      if (hvFilter === "standard" && m.specs?.hasHvSwitch) return false;
    }
    if (plugCount) {
      if (plugCount === "0" && m.specs?.plugs !== "0") return false;
      if (plugCount === "with_plug" && m.specs?.plugs === "0") return false;
      if (plugCount !== "0" && plugCount !== "with_plug" && m.specs?.plugs !== plugCount) return false;
    }
    return true;
  });

  const rankModel = (name: string, series: string = "") => {
    if (!q.trim()) return 0;
    const nameLower = (name || "").toLowerCase();
    const seriesLower = (series || "").toLowerCase();
    const cleanQ = q.toLowerCase().trim();
    let score = 0;

    // 1. Exact full phrase match in product name:
    if (nameLower === cleanQ) score += 500;
    else if (nameLower.includes(cleanQ)) score += 250;

    // 2. Specific switch gang count (e.g. "8 switch", "6 switch", "10 switch"):
    const gangMatch = cleanQ.match(/(\d+)\s*switch/);
    if (gangMatch) {
      const desiredGang = gangMatch[1];
      const targetPattern = new RegExp(`\\b${desiredGang}\\s*switch\\b`, "i");
      if (targetPattern.test(nameLower)) {
        score += 200;
      } else {
        const actualGang = nameLower.match(/(\d+)\s*switch/);
        if (actualGang && actualGang[1] !== desiredGang) {
          score -= 160; // Heavily penalize wrong gang count (e.g. 10 switch when searching 8 switch)
        }
      }
    }

    // 3. Series matching:
    const userWantsColor = cleanQ.includes("color") || cleanQ.includes("colour");
    const itemHasColor = nameLower.includes("color") || seriesLower.includes("color");
    if (!userWantsColor && itemHasColor) {
      score -= 70; // Demote "Color" series if user didn't type "color"
    } else if (userWantsColor && itemHasColor) {
      score += 80;
    }

    const userWantsRoyal = cleanQ.includes("royal");
    const itemHasRoyal = nameLower.includes("royal") || seriesLower.includes("royal");
    if (!userWantsRoyal && itemHasRoyal) {
      score -= 25;
    } else if (userWantsRoyal && itemHasRoyal) {
      score += 80;
    }

    // 4. Token position & coverage in name:
    const terms = cleanQ.split(/\s+/).filter(Boolean);
    terms.forEach((term) => {
      if (nameLower.includes(term)) score += 25;
    });

    return score;
  };

  filteredSwitchModels.sort((a, b) => rankModel(b.name, b.series) - rankModel(a.name, a.series) || a.name.localeCompare(b.name));

  const filteredRegularItems = regularItems.filter((item) => {
    if (q.trim()) {
      const cleanQ = q.trim().toLowerCase();
      const name = (item.name || "").toLowerCase();
      const sku = (item.sku || "").toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      const subcat = (item.subcategory || "").toLowerCase();
      const desc = (item.description || item.short_description || "").toLowerCase();
      const terms = cleanQ.split(/\s+/).filter(Boolean);
      const matchesAllTerms = terms.every((t) =>
        name.includes(t) || sku.includes(t) || brand.includes(t) || cat.includes(t) || subcat.includes(t) || desc.includes(t)
      );
      if (!matchesAllTerms) return false;
      // If user explicitly chose a specific category other than All/Switches, respect that category
      if (category && category !== "Smart switches" && !matchesPickerCategory(item.category, category)) return false;
    } else {
      if (category && !matchesPickerCategory(item.category, category)) return false;
    }
    if (model && String(item.product_id) !== model) return false;
    if (technology && item.normTech !== technology && item.parsedAttributes.technology !== technology) return false;
    if (material && item.normMat !== material && item.parsedAttributes.material !== material && item.parsedAttributes.finish !== material) return false;
    if (item.category === "Smart switches" && activeSwitchFiltersCount > 0) {
      const specs = item.switchSpecs;
      if (moduleSize && specs?.moduleSize !== moduleSize) return false;
      if (switchCount && specs?.switches !== switchCount) return false;
      if (fanCount) {
        if (fanCount === "0" && specs?.fan !== "0") return false;
        if (fanCount === "with_fan" && specs?.fan === "0") return false;
        if (fanCount !== "0" && fanCount !== "with_fan" && specs?.fan !== fanCount) return false;
      }
      if (hvFilter) {
        if (hvFilter === "with_hv" && !specs?.hasHvSwitch) return false;
        if (hvFilter === "any_16a" && !specs?.hasAny16A) return false;
        if (hvFilter === "standard" && specs?.hasHvSwitch) return false;
      }
      if (plugCount) {
        if (plugCount === "0" && specs?.plugs !== "0") return false;
        if (plugCount === "with_plug" && specs?.plugs === "0") return false;
        if (plugCount !== "0" && plugCount !== "with_plug" && specs?.plugs !== plugCount) return false;
      }
    }
    return true;
  });

  filteredRegularItems.sort((a, b) => rankModel(b.name, b.series) - rankModel(a.name, a.series) || a.name.localeCompare(b.name));

  const addAndContinue = (item: R) => { add(item); setAdded((count) => count + 1); };

  return (
    <div className="modalback">
      <div className="itemdrawer">
        <header>
          <div>
            <small>ITEMS MASTER</small>
            <h2>
              Add item
              {target?.roomName ? (
                <> → <span className="itempicker-location">{target.floorName && <>{target.floorName} · </>}{target.roomName}</span></>
              ) : " to selected room"}
            </h2>
          </div>
          <div className="itemdrawerclose">
            <span>{added ? `${added} item${added === 1 ? "" : "s"} added` : "Add multiple items, then close"}</span>
            <button onClick={close}>Done ×</button>
          </div>
        </header>

        {/* Quick Category Navigation Bar */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", padding: "6px 0 10px 0", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "", label: "All Items", icon: "📦" },
            { id: "Door locks", label: "Door Locks", icon: "🔐" },
            { id: "Smart switches", label: "Smart Switches", icon: "🔘" },
            { id: "Security system", label: "Security & VDP", icon: "📹" },
            { id: "Smart curtains", label: "Smart Curtains", icon: "🪟" },
            { id: "Gate automation", label: "Gate Automation", icon: "🚪" },
            { id: "Lighting", label: "Lighting", icon: "💡" },
            { id: "Others", label: "Others", icon: "⚙️" },
          ].map((cat) => {
            const isSel = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  border: isSel ? "1.5px solid #2563eb" : "1px solid #cbd5e1",
                  background: isSel ? "#eff6ff" : "#ffffff",
                  color: isSel ? "#1d4ed8" : "#334155",
                  fontWeight: isSel ? 700 : 500,
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  boxShadow: isSel ? "0 1px 3px rgba(37,99,235,0.15)" : "none",
                }}
                onClick={() => {
                  setCategory(cat.id);
                  setSeriesFilter("");
                  setModel("");
                  setTechnology("");
                  setMaterial("");
                  resetSwitchFilters();
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <input
          className="itemsearch"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Series 6, door locks, switch model, gang size, brand, SKU or category..."
        />

        <div className="itempickerfilters">
          <select value={category} onChange={(e) => {
            setCategory(e.target.value);
            setSeriesFilter("");
            setModel("");
            setTechnology("");
            setMaterial("");
            resetSwitchFilters();
          }}>
            <option value="">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {(!category || category === "Smart switches") && (
            <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
              <option value="">All switch series</option>
              {SMART_SWITCH_SERIES.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
              ))}
            </select>
          )}
          <select value={model} onChange={(e) => { setModel(e.target.value); }}>
            <option value="">All models ({modelOptions.length})</option>
            {modelOptions.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select>
          <select value={technology} onChange={(e) => setTechnology(e.target.value)}>
            <option value="">All technologies</option>
            {techOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={material} onChange={(e) => setMaterial(e.target.value)}>
            <option value="">All materials</option>
            {matOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button className="primary" onClick={() => setShowCustom((value) => !value)}>＋ Custom item</button>
        </div>

        {(!category || category === "Smart switches") && (
          <div className="switchspecsfilterbar">
            <div className="switchspecsfilterheader">
              <span>
                <b>Switch Board Filters</b>
                {activeSwitchFiltersCount > 0 && (
                  <span className="filtercountbadge">{activeSwitchFiltersCount} active</span>
                )}
                <small style={{ color: "#64748b", fontWeight: "normal" }}>
                  ({filteredSwitchModels.length} models)
                </small>
              </span>
              {activeSwitchFiltersCount > 0 && (
                <button
                  type="button"
                  className="switchspecsresetbtn"
                  onClick={resetSwitchFilters}
                >
                  ✕ Reset filters
                </button>
              )}
            </div>

            <div className="switchspecsgrid">
              <div className="switchspecitem">
                <label><span>📐 Module Size</span></label>
                <select
                  className={moduleSize ? "active-filter" : ""}
                  value={moduleSize}
                  onChange={(e) => setModuleSize(e.target.value)}
                >
                  <option value="">All modules</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>{m} Module ({m}M)</option>
                  ))}
                </select>
              </div>

              <div className="switchspecitem">
                <label><span>🔘 No. of Switches</span></label>
                <select
                  className={switchCount ? "active-filter" : ""}
                  value={switchCount}
                  onChange={(e) => setSwitchCount(e.target.value)}
                >
                  <option value="">All switches</option>
                  {availableSwitches.map((sw) => {
                    const label = !isNaN(Number(sw))
                      ? `${sw} Switches`
                      : sw === "Bell"
                        ? "Door Bell"
                        : sw === "Curtain"
                          ? "Curtain Switch"
                          : sw === "Scene"
                            ? "Scene Controller"
                            : sw === "Dimmer"
                              ? "Dimmer Switch"
                              : sw;
                    return <option key={sw} value={sw}>{label}</option>;
                  })}
                  <option value="0">No Switches (0)</option>
                </select>
              </div>

              <div className="switchspecitem">
                <label><span>🌀 Fan</span></label>
                <select
                  className={fanCount ? "active-filter" : ""}
                  value={fanCount}
                  onChange={(e) => setFanCount(e.target.value)}
                >
                  <option value="">All fans</option>
                  <option value="0">Without Fan (0)</option>
                  <option value="with_fan">With Fan (Any)</option>
                  <option value="1">1 Fan</option>
                  <option value="2">2 Fans</option>
                </select>
              </div>

              <div className="switchspecitem">
                <label><span>⚡ HV Switch (16A)</span></label>
                <select
                  className={hvFilter ? "active-filter" : ""}
                  value={hvFilter}
                  onChange={(e) => setHvFilter(e.target.value)}
                >
                  <option value="">All HV options</option>
                  <option value="with_hv">⚡ 16A HV Switch</option>
                  <option value="any_16a">⚡ Any 16A (Switch/Socket)</option>
                  <option value="standard">Standard (6A only)</option>
                </select>
              </div>

              <div className="switchspecitem">
                <label><span>🔌 Plug / Socket</span></label>
                <select
                  className={plugCount ? "active-filter" : ""}
                  value={plugCount}
                  onChange={(e) => setPlugCount(e.target.value)}
                >
                  <option value="">All sockets / plugs</option>
                  <option value="0">Without Socket (0)</option>
                  <option value="with_plug">With Socket (Any)</option>
                  <option value="1">1 Socket</option>
                  <option value="2">2 Sockets</option>
                  <option value="3">3 Sockets</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {showCustom && (
          <div className="customquoteitem">
            <h3>Add an item not in Items Master</h3>
            <label><span>Item name *</span><input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /></label>
            <label><span>Quantity</span><input type="number" min="1" step="1" value={wholeQty(custom.qty)} onChange={(e) => setCustom({ ...custom, qty: wholeQty(e.target.value) })} /></label>
            <label><span>Unit</span><input value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} /></label>
            <label><span>Rate</span><input type="number" min="0" value={custom.price} onChange={(e) => setCustom({ ...custom, price: Number(e.target.value) })} /></label>
            <label><span>Discount %</span><input type="number" min="0" max="100" value={custom.discount} onChange={(e) => setCustom({ ...custom, discount: Number(e.target.value) })} /></label>
            <label><span>GST %</span><input type="number" disabled={taxMode === "Non-GST"} value={custom.gst} onChange={(e) => setCustom({ ...custom, gst: Number(e.target.value) })} /></label>
            <label className="wide"><span>Description / specification</span><textarea value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} /></label>
            <label><span>Warranty</span><input value={custom.warranty} onChange={(e) => setCustom({ ...custom, warranty: e.target.value })} /></label>
            <label><span>Line note</span><input value={custom.note} onChange={(e) => setCustom({ ...custom, note: e.target.value })} /></label>
            <button className="primary" disabled={!custom.name.trim()} onClick={() => { addAndContinue({ ...custom, id: crypto.randomUUID(), custom: true, brand: "Custom", sku: "CUSTOM", taxMode }); setCustom({ ...custom, name: "", description: "", note: "" }); }}>Add custom item</button>
          </div>
        )}

        <div className="pickeritems">
          {loading ? (
            <p style={{ padding: "20px", color: "#667085" }}>Searching Items…</p>
          ) : (
            <>
              {/* Render Smart Switch models with interactive Series, Technology, Material, Edge Colour & Panel Colour option pills */}
              {filteredSwitchModels.map((m) => {
                const curSel = modelSelections[m.key] || {};
                const availableSeries = new Set(m.variants.map((v: R) => v.normSeries || v.series).filter(Boolean));
                const availableTechs = new Set(m.variants.map((v: R) => v.normTech).filter(Boolean));
                const availableMats = new Set(m.variants.map((v: R) => v.normMat).filter(Boolean));

                // Determine active series
                const preferredSeriesOrder = ["Royal Edge", "Royal Edge Color", "Edge", "Edge Color", "Touch Panel", "Color Touch Panel", "Touch Plus", "Noviq Titan", "Noviq Luxeray"];
                let chosenSeries = curSel.series || (seriesFilter && availableSeries.has(seriesFilter) ? seriesFilter : "");
                if (!chosenSeries || !availableSeries.has(chosenSeries)) {
                  chosenSeries = ((preferredSeriesOrder.find((s) => availableSeries.has(s)) || Array.from(availableSeries)[0] || "") as unknown as string);
                }

                // Determine active tech and mat
                let chosenTech = curSel.technology || technology || "Wi-Fi";
                let chosenMat = curSel.material || material || "Acrylic";

                // Determine Edge colour and Panel colour
                const isEdgeSeries = /edge/i.test(chosenSeries);
                const chosenEdge = curSel.edgeColor || (isEdgeSeries ? "Rose Gold Edge" : "Rimless / Matching");
                const chosenPanel = curSel.panelColor || "Pure Black";

                let activeVariant = m.variants.find((v: R) =>
                  (!chosenSeries || (v.normSeries || v.series) === chosenSeries) &&
                  (!chosenTech || v.normTech === chosenTech) &&
                  (!chosenMat || v.normMat === chosenMat)
                );
                if (!activeVariant) {
                  activeVariant = m.variants.find((v: R) =>
                    (!chosenSeries || (v.normSeries || v.series) === chosenSeries) &&
                    (!chosenTech || v.normTech === chosenTech)
                  );
                }
                if (!activeVariant) {
                  activeVariant = m.variants.find((v: R) =>
                    (!chosenSeries || (v.normSeries || v.series) === chosenSeries) &&
                    (!chosenMat || v.normMat === chosenMat)
                  );
                }
                if (!activeVariant) {
                  activeVariant = m.variants.find((v: R) => (!chosenSeries || (v.normSeries || v.series) === chosenSeries));
                }
                if (!activeVariant) {
                  activeVariant = m.variants.find((v: R) => v.normTech === chosenTech && v.normMat === chosenMat);
                }
                if (!activeVariant) {
                  activeVariant = m.variants.find((v: R) => v.normTech === chosenTech);
                }
                if (!activeVariant) {
                  activeVariant = m.variants[0];
                }

                const currentSeries = activeVariant.normSeries || activeVariant.series || chosenSeries;
                const currentTech = activeVariant.normTech || chosenTech;
                const currentMat = activeVariant.normMat || chosenMat;

                const qty = curSel.qty || 1;
                const currentPrice = Number(activeVariant.selling_price || 0);
                const currentCost = Number(activeVariant.purchase_cost || 0);

                return (
                  <article key={m.key} className="switchmodelcard">
                    <div className="switchmodelhead">
                      <img src={resolveImageUrl(activeVariant.image_key || m.image) || "/techomie-logo.jpg"} alt={m.name} />
                      <div className="switchmodeldetails">
                        <small>{m.brand} · {m.category}{currentSeries ? ` · ${currentSeries}` : ""}</small>
                        <b>{m.name || activeVariant.name || activeVariant.sku || "Smart Switch"}</b>
                        <div className="switchspecstags">
                          {m.module && <span className="modulebadge">{m.module} Module Panel</span>}
                          {m.specs?.switches && m.specs.switches !== "0" && (
                            <span className="specbadge switchbadge">🔘 {m.specs.switches} Switch</span>
                          )}
                          {m.specs?.fan && m.specs.fan !== "0" && (
                            <span className="specbadge fanbadge">🌀 {m.specs.fan} Fan</span>
                          )}
                          {m.specs?.hasHvSwitch && (
                            <span className="specbadge hvbadge">⚡ 16A HV</span>
                          )}
                          {m.specs?.plugs && m.specs.plugs !== "0" && (
                            <span className="specbadge plugbadge">🔌 {m.specs.plugs} Socket</span>
                          )}
                        </div>
                        {m.shortDescription && <p>{m.shortDescription}</p>}
                      </div>
                    </div>

                    <div className="variantoptionscontainer">
                      <div className="variantgroup">
                        <span className="variantgrouplabel">Switch Variant / Series</span>
                        <div className="variantpills">
                          {SMART_SWITCH_SERIES.map((s) => {
                            const isAvail = availableSeries.has(s.id);
                            const isSelected = currentSeries === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                disabled={!isAvail}
                                onClick={() =>
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [m.key]: { ...(prev[m.key] || {}), series: s.id },
                                  }))
                                }
                              >
                                <span className="pillicon">{s.icon}</span>
                                <span className="pilllabel">{s.label}</span>
                                {isSelected && <span className="pillcheck">✓</span>}
                                {!isAvail && <small className="pillna">(N/A)</small>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="variantgroup">
                        <span className="variantgrouplabel">Technology Option</span>
                        <div className="variantpills">
                          {SMART_SWITCH_TECHNOLOGIES.map((t) => {
                            const isAvail = m.variants.some((v: R) => (!currentSeries || (v.normSeries || v.series) === currentSeries) && v.normTech === t.id);
                            const isSelected = currentTech === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                disabled={!isAvail}
                                onClick={() =>
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [m.key]: { ...(prev[m.key] || {}), technology: t.id },
                                  }))
                                }
                              >
                                <span className="pillicon">{t.icon}</span>
                                <span className="pilllabel">{t.label}</span>
                                {isSelected && <span className="pillcheck">✓</span>}
                                {!isAvail && <small className="pillna">(N/A)</small>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="variantgroup">
                        <span className="variantgrouplabel">Material Option</span>
                        <div className="variantpills">
                          {SMART_SWITCH_MATERIALS.map((mat) => {
                            const isAvail = m.variants.some((v: R) => (!currentSeries || (v.normSeries || v.series) === currentSeries) && v.normMat === mat.id);
                            const isSelected = currentMat === mat.id;
                            return (
                              <button
                                key={mat.id}
                                type="button"
                                className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                disabled={!isAvail}
                                onClick={() =>
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [m.key]: { ...(prev[m.key] || {}), material: mat.id },
                                  }))
                                }
                              >
                                <span className="pillicon">{mat.icon}</span>
                                <span className="pilllabel">{mat.label}</span>
                                {isSelected && <span className="pillcheck">✓</span>}
                                {!isAvail && <small className="pillna">(N/A)</small>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="variantgroup">
                        <span className="variantgrouplabel">Edge / Bezel Colour</span>
                        <div className="variantpills">
                          {SMART_SWITCH_EDGE_COLORS.map((ec) => {
                            const isSelected = chosenEdge === ec.id;
                            return (
                              <button
                                key={ec.id}
                                type="button"
                                className={`variantpill ${isSelected ? "active" : ""}`}
                                onClick={() =>
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [m.key]: { ...(prev[m.key] || {}), edgeColor: ec.id },
                                  }))
                                }
                              >
                                <span className="pillcolorindicator" style={{ backgroundColor: ec.colorCode }} />
                                <span className="pillicon">{ec.icon}</span>
                                <span className="pilllabel">{ec.label}</span>
                                {isSelected && <span className="pillcheck">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="variantgroup">
                        <span className="variantgrouplabel">Plate / Panel Colour</span>
                        <div className="variantpills">
                          {SMART_SWITCH_PANEL_COLORS.map((pc) => {
                            const isSelected = chosenPanel === pc.id;
                            return (
                              <button
                                key={pc.id}
                                type="button"
                                className={`variantpill ${isSelected ? "active" : ""}`}
                                onClick={() =>
                                  setModelSelections((prev) => ({
                                    ...prev,
                                    [m.key]: { ...(prev[m.key] || {}), panelColor: pc.id },
                                  }))
                                }
                              >
                                <span className="pillcolorindicator" style={{ backgroundColor: pc.colorCode }} />
                                <span className="pillicon">{pc.icon}</span>
                                <span className="pilllabel">{pc.label}</span>
                                {isSelected && <span className="pillcheck">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="switchcardfooter">
                      <div className="switchpricing">
                        <strong>{money(currentPrice)}</strong>
                        {role === "admin" && (
                          <small>
                            Cost {money(currentCost)} · Margin {money(currentPrice - currentCost)}
                          </small>
                        )}
                        <span className="skuinfo">{activeVariant.sku}</span>
                      </div>

                      <div className="switchcardcontrols">
                        <div className="switchqtywrap">
                          <span>Qty</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setModelSelections((prev) => ({
                                ...prev,
                                [m.key]: { ...(prev[m.key] || {}), qty: val },
                              }));
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="addbtn"
                          onClick={() =>
                            addAndContinue({
                              variantId: activeVariant.variant_id,
                              productId: activeVariant.product_id,
                              name: m.name,
                              brand: m.brand,
                              category: m.category,
                              series: currentSeries,
                              edgeColor: chosenEdge,
                              panelColor: chosenPanel,
                              sku: activeVariant.sku,
                              image: resolveImageUrl(activeVariant.image_key || m.image),
                              description: m.shortDescription || m.description || m.name,
                              technicalNotes: "",
                              technology: currentTech,
                              material: currentMat,
                              module: m.module,
                              variantSummary: `${currentSeries} · ${currentTech} · ${currentMat}${chosenEdge ? ` · ${chosenEdge}` : ""}${chosenPanel ? ` · ${chosenPanel}` : ""}${m.module ? ` · ${m.module} Module` : ""}`,
                              availableVariants: m.variants.map((v: R) => ({
                                variantId: v.variant_id,
                                productId: v.product_id,
                                sku: v.sku,
                                series: v.normSeries || v.series,
                                technology: v.normTech,
                                material: v.normMat,
                                price: Number(v.selling_price),
                                purchaseCost: Number(v.purchase_cost || 0),
                                taxRate: Number(v.tax_rate || 18),
                                warranty: v.warranty || "",
                                image: resolveImageUrl(v.image_key),
                              })),
                              qty,
                              unit: m.unit || "Nos",
                              price: currentPrice,
                              purchaseCost: currentCost,
                              discount: 0,
                              gst: Number(activeVariant.tax_rate || 18),
                              taxMode,
                              warranty: activeVariant.warranty || m.defaultWarranty || "",
                              optional: false,
                              note: "",
                            })
                          }
                        >
                          Add item
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              {/* Render regular non-switch items */}
              {filteredRegularItems.map((x) => {
                const attrs = x.parsedAttributes,
                  name = /^noviq\s/i.test(x.name)
                    ? x.name
                    : x.brand === "Noviq" || x.brand === "Noviq OEM"
                      ? `Noviq ${x.name}`
                      : x.name;
                return (
                  <article key={x.variant_id}>
                    <img src={resolveImageUrl(x.image_key) || "/techomie-logo.jpg"} alt="" />
                    <div>
                      <small>
                        {x.brand} · {x.category}
                      </small>
                      <b>{name}</b>
                      <span>
                        {x.variant_name} · {x.sku}
                      </span>
                      <em>
                        {Object.entries(attrs)
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </em>
                    </div>
                    <div>
                      <strong>{money(x.selling_price)}</strong>
                      {role === "admin" && (
                        <small>
                          Cost {money(x.purchase_cost)} · Margin {money(x.margin)}
                        </small>
                      )}
                      <button
                        onClick={() =>
                          addAndContinue({
                            variantId: x.variant_id,
                            productId: x.product_id,
                            name,
                            brand: x.brand,
                            sku: x.sku,
                            image: resolveImageUrl(x.image_key),
                            description:
                              x.short_description || x.description || name,
                            technicalNotes: "",
                            variantSummary: Object.values(attrs)
                              .filter(Boolean)
                              .join(" · "),
                            qty: 1,
                            unit: x.unit || "Nos",
                            price: Number(x.selling_price),
                            purchaseCost: Number(x.purchase_cost || 0),
                            discount: 0,
                            gst: Number(x.tax_rate || 18),
                            taxMode,
                            warranty: x.warranty || x.default_warranty || "",
                            optional: false,
                            note: "",
                          })
                        }
                      >
                        Add item
                      </button>
                    </div>
                  </article>
                );
              })}

              {filteredSwitchModels.length === 0 && filteredRegularItems.length === 0 && (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#667085" }}>
                  <p style={{ fontSize: "16px", fontWeight: 600 }}>No items found</p>
                  <p style={{ fontSize: "13px" }}>Try clearing your search or adjusting the technology / material filters.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function Payment({ snap, set, total, locked, section }: R) {
  const plan = snap.paymentPlan || [],
    mut = (fn: (n: R) => void) => {
      const n = structuredClone(snap);
      fn(n);
      set(n);
    };
  return (
    <div className="qpay">
      {section !== "terms" && <section className="qcard">
        <h2>Payment schedule</h2>
        {plan.map((m: R, i: number) => (
          <div className="milestone" key={i}>
            <input
              disabled={locked}
              value={m.name}
              onChange={(e) =>
                mut((n) => (n.paymentPlan[i].name = e.target.value))
              }
            />
            <input
              disabled={locked}
              type="number"
              value={m.percent || 0}
              onChange={(e) =>
                mut((n) => (n.paymentPlan[i].percent = Number(e.target.value)))
              }
            />
            <input
              disabled={locked}
              value={m.condition || ""}
              onChange={(e) =>
                mut((n) => (n.paymentPlan[i].condition = e.target.value))
              }
            />
            <b>{money((total * Number(m.percent || 0)) / 100)}</b>
            {!locked && (
              <button onClick={() => mut((n) => n.paymentPlan.splice(i, 1))}>
                ×
              </button>
            )}
          </div>
        ))}
        {!locked && (
          <button
            onClick={() =>
              mut((n) =>
                n.paymentPlan.push({
                  name: "Milestone",
                  percent: 0,
                  condition: "",
                }),
              )
            }
          >
            ＋ Add milestone
          </button>
        )}
      </section>}
      {section !== "pricing" && <section className="qcard">
        <h2>Warranty, exclusions and terms</h2>
        <label>
          <span>Warranty terms</span>
          <textarea
            disabled={locked}
            value={snap.warranty || ""}
            onChange={(e) => set({ ...snap, warranty: e.target.value })}
          />
        </label>
        <label>
          <span>Terms and conditions</span>
          <textarea
            disabled={locked}
            value={snap.terms || ""}
            onChange={(e) => set({ ...snap, terms: e.target.value })}
          />
        </label>
      </section>}
    </div>
  );
}
function ScopeTerms({ snap, set, locked }: R) {
  const mut = (fn: (next: R) => void) => {
      const next = structuredClone(snap);
      fn(next);
      set(next);
    },
    scope = snap.scope || {},
    scenes = snap.scenes || [];
  return (
    <div className="qscopeterms">
      <section className="qcard">
        <h2>Customer-facing scope</h2>
        <p className="qsectionhelp">Only include systems and categories present in this quotation.</p>
        <div className="qscopegrid">
          {Object.entries(scopeSectionLabels).map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea
                disabled={locked}
                value={scope[key] || ""}
                onChange={(event) => mut((next) => {
                  next.scope = { ...(next.scope || {}), [key]: event.target.value };
                })}
              />
            </label>
          ))}
        </div>
      </section>
      <section className="qcard">
        <h2>Smart scenes</h2>
        {scenes.map((scene: R, index: number) => (
          <div className="qscenerow" key={scene.id || index}>
            <select disabled={locked} value={scene.name || "Welcome Home"} onChange={(event) => mut((next) => next.scenes[index].name = event.target.value)}>
              {["Welcome Home", "Good Night", "Away", "Movie", "Morning", "Security", "Custom scene"].map((name) => <option key={name}>{name}</option>)}
            </select>
            <input disabled={locked} value={scene.description || ""} placeholder="Customer-facing description" onChange={(event) => mut((next) => next.scenes[index].description = event.target.value)} />
            <input disabled={locked} value={scene.rooms || ""} placeholder="Rooms / actions" onChange={(event) => mut((next) => next.scenes[index].rooms = event.target.value)} />
            {!locked && <button onClick={() => mut((next) => next.scenes.splice(index, 1))}>×</button>}
          </div>
        ))}
        {!locked && <button onClick={() => mut((next) => {
          next.scenes = next.scenes || [];
          next.scenes.push({ id: crypto.randomUUID(), name: "Welcome Home", description: "", rooms: "" });
        })}>＋ Add scene</button>}
      </section>
      <section className="qcard qpay">
        <h2>Warranty and commercial terms</h2>
        <label><span>Warranty terms</span><textarea disabled={locked} value={snap.warranty || ""} onChange={(event) => set({ ...snap, warranty: event.target.value })} /></label>
        <label><span>Terms and conditions</span><textarea disabled={locked} value={snap.terms || ""} onChange={(event) => set({ ...snap, terms: event.target.value })} /></label>
      </section>
    </div>
  );
}
function QuotePaper({ quote, snap, totals }: R) {
  return (
    <article className="qpaper">
      <section className="qcover">
        <img src={snap.company?.logo || "/techomie-logo.jpg"} alt="Techomie" />
        <small>SMART HOME AUTOMATION PROPOSAL</small>
        <h1>{snap.details?.title}</h1>
        <p>Prepared for {quote.customer_name}</p>
        <b>
          {quote.number} · Rev {quote.revision || 0}
        </b>
        <span>
          {quote.site_name}, {quote.city}
        </span>
        <em>Valid until {snap.details?.validUntil || quote.valid_until}</em>
      </section>
      <section className="qintro">
        <h2>A smarter property, thoughtfully designed.</h2>
        <p>{snap.details?.introduction}</p>
      </section>
      {(snap.floors || []).map((f: R) => (
        <section className="qpaperscope" key={f.name}>
          <h2>{f.name}</h2>
          {f.rooms.map((r: R) => (
            <div key={r.name}>
              <h3>
                {r.name}
                <span>{r.note}</span>
              </h3>
              {r.items.map((x: R, i: number) => (
                <div className="qpaperline" key={i}>
                  <img src={resolveImageUrl(x.image) || "/techomie-logo.jpg"} alt="" />
                  <span>
                    <b>
                      {x.name}
                      {x.optional ? " · Optional" : ""}
                    </b>
                    <small>{x.description}</small>
                    <em>
                      {x.sku} · {x.variantSummary}
                    </em>
                  </span>
                  <i>
                    {wholeQty(x.qty)} {x.unit}
                  </i>
                  <i>{money(x.price)}</i>
                  <strong>{money(line(x).total)}</strong>
                </div>
              ))}
            </div>
          ))}
        </section>
      ))}
      <section className="qpaperfinance">
        <h2>Commercial summary</h2>
        <p>
          <span>Subtotal</span>
          <b>{money(totals.subtotal)}</b>
        </p>
        <p>
          <span>Discount</span>
          <b>− {money(totals.discount)}</b>
        </p>
        <p>
          <span>Taxable value</span>
          <b>{money(totals.taxable)}</b>
        </p>
        <p>
          <span>CGST</span>
          <b>{money(totals.tax / 2)}</b>
        </p>
        <p>
          <span>SGST</span>
          <b>{money(totals.tax / 2)}</b>
        </p>
        <p className="grand">
          <span>Grand total</span>
          <b>{money(totals.grand)}</b>
        </p>
      </section>
      <section className="qpaperterms">
        <h2>Payment schedule</h2>
        {(snap.paymentPlan || []).map((m: R) => (
          <p key={m.name}>
            <b>
              {m.name} · {m.percent}%
            </b>
            <span>
              {m.condition} ·{" "}
              {money((totals.grand * Number(m.percent || 0)) / 100)}
            </span>
          </p>
        ))}
        <h2>Warranty</h2>
        <div style={{ whiteSpace: "pre-line" }}>
          {snap.warranty ? (
            snap.warranty.split("\n").map((line: string, i: number) => {
              const parts = line.split(/(\b\d+\s*Years?\b|\b\d+\+\d+\s*(?:Years?)?\b|\b\d+Y\s*\+\s*\d+Y\b)/gi);
              return (
                <p key={i} style={{ margin: "2px 0" }}>
                  {parts.map((p: string, j: number) =>
                    /(\b\d+\s*Years?\b|\b\d+\+\d+\s*(?:Years?)?\b|\b\d+Y\s*\+\s*\d+Y\b)/i.test(p) ? (
                      <strong key={j} className="qwarranty-years" style={{ fontWeight: 800 }}>{p}</strong>
                    ) : (
                      p
                    )
                  )}
                </p>
              );
            })
          ) : (
            <p>Standard product warranty applies.</p>
          )}
        </div>
        <h2>Terms & conditions</h2>
        <p>{snap.terms}</p>
        <footer>
          <span>{snap.company?.displayName || "Techomie Smart Devices"}</span>
          <b>Authorised Signatory</b>
        </footer>
      </section>
    </article>
  );
}
function QuotePaperPremium({ quote, snap, totals, branding = {} }: R) {
  const floors = snap.floors || [],
    rooms = floors.flatMap((floor: R) => floor.rooms || []),
    items = rooms.flatMap((room: R) => room.items || []),
    company = snap.company?.displayName || "Techomie Smart Devices",
    logo = snap.company?.logo || "/techomie-logo.jpg",
    validity = snap.details?.validUntil || quote.valid_until,
    pdfFormat = quotePdfFormat(snap),
    detailed = pdfFormat !== "compact",
    templateId =
      snap.details?.templateId || branding.defaultQuoteTemplate || "luxury",
    designClass = templateId === "minimal" ? "qproposalclean" : "",
    templateStyle = {
      "--doc-primary": branding.primaryColour || "#0aa9e8",
      "--doc-secondary": branding.secondaryColour || "#071522",
      "--doc-accent": branding.accentColour || "#c8aa72",
      fontFamily: branding.pdfFont || "Arial",
    } as CSSProperties;
  const customerName = snap.details?.customerName || snap.details?.customer || quote.customer_name;
  const siteName = snap.details?.siteName || snap.details?.site || quote.site_name;
  if (templateId === "minimal")
    return (
      <QuotePaperMinimal
        quote={quote}
        snap={snap}
        totals={totals}
        branding={branding}
      />
    );
  const head = (section: string) => (
    <header className="qpdfhead">
      <span>
        <img src={logo} alt="Techomie" />
        <b>{branding.header || company}</b>
      </span>
      <span>
        <small>{section}</small>
        <b>
          {quote.number} / REV {quote.revision || 0}
        </b>
      </span>
    </header>
  );
  const foot = (label: string) => (
    <footer className="qpdffoot">
      <span>{branding.contactFooter === false ? company : (branding.footer || company)}</span>
      <span>{label}</span>
      <span>{quote.number}</span>
    </footer>
  );
function inWords(num: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const n = Math.round(num);
  if (n === 0) return "Zero Rupees Only";
  const formatSection = (val: number): string => {
    let str = "";
    if (val >= 100) {
      str += a[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val >= 20) {
      str += b[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + a[val % 10] : "") + " ";
    } else if (val > 0) {
      str += a[val] + " ";
    }
    return str;
  };
  let crore = Math.floor(n / 10000000);
  let lakh = Math.floor((n % 10000000) / 100000);
  let thousand = Math.floor((n % 100000) / 1000);
  let remainder = n % 1000;
  let res = "";
  if (crore) res += formatSection(crore) + "Crore ";
  if (lakh) res += formatSection(lakh) + "Lakh ";
  if (thousand) res += formatSection(thousand) + "Thousand ";
  if (remainder) res += formatSection(remainder);
  return res.trim() + " Rupees Only";
}

function getRoomCapabilities(room: R): string[] {
  const items = room.items || [];
  const text = items
    .map((i: R) => `${i.name || ""} ${i.category || ""} ${i.description || ""}`)
    .join(" ")
    .toLowerCase();
  const caps: string[] = [];

  if (text.includes("curtain")) {
    caps.push("Motorized Curtain Schedules");
  }
  if (text.includes("dimmer") || text.includes("dimming")) {
    caps.push("Ambient Lighting Scenes");
  }
  if (text.includes("fan")) {
    caps.push("Step-less Fan Speed");
  }
  if (text.includes("lock")) {
    caps.push("Keyless Digital Access");
  }
  if (text.includes("gate") || text.includes("barrier")) {
    caps.push("Motorized Gate Access");
  }
  if (text.includes("switch") || items.length > 0) {
    if (!caps.includes("Ambient Lighting Scenes")) caps.push("Scene & Mood Controls");
    caps.push("App & Voice Control");
  }
  if (
    room.name?.toLowerCase().includes("bed") ||
    room.name?.toLowerCase().includes("master")
  ) {
    caps.push("Bedside Master All-Off");
  }
  return caps.slice(0, 3);
}

function getItemFeatureTag(item: R): string | null {
  const name = (item.name || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();
  const cat = (item.category || "").toLowerCase();
  const full = `${name} ${desc} ${cat}`;

  if (full.includes("dimmer") || full.includes("dimming"))
    return "Smooth Dimming & Mood Control";
  if (full.includes("curtain")) return "Auto Open/Close & Timers";
  if (full.includes("fan")) return "5-Speed Hum-Free Regulation";
  if (full.includes("lock")) return "Biometric, PIN & App Access";
  if (full.includes("gate") || full.includes("barrier"))
    return "Remote & App Gate Operation";
  if (full.includes("gateway") || full.includes("hub"))
    return "High-Speed Mesh Central Hub";
  if (
    full.includes("motion") ||
    full.includes("radar") ||
    full.includes("sensor")
  )
    return "Presence-Based Auto-Trigger";
  if (
    full.includes("vdp") ||
    full.includes("doorbell") ||
    full.includes("intercom")
  )
    return "Two-Way Video & Remote Door Release";
  if (full.includes("switch")) return "Touch, Mobile App & Voice Control";
  return null;
}

interface SubsystemFeature {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  features: string[];
}

function detectQuoteSubsystems(snap: R): SubsystemFeature[] {
  // Always include all 5 smart-home solution features to showcase the complete Techomie experience
  return [
    {
      id: "lighting",
      category: "SMART LIGHTING",
      title: "Smart Lighting & Scene Control",
      subtitle: "Effortless ambiance, mobile touch & voice automation",
      badge: "Lighting",
      icon: "💡",
      features: [
        "Control lights from mobile",
        "Individual and group control",
        "Manual switch operation",
        "ON/OFF scheduling",
        "Scene-based control",
        "Voice control where supported",
        "Remote control when away from home",
        "Automation based on sensors and routines",
      ],
    },
    {
      id: "curtains",
      category: "SMART CURTAINS",
      title: "Smart Motorized Curtains",
      subtitle: "Automated sunlight management, privacy & quiet operation",
      badge: "Curtains",
      icon: "🪟",
      features: [
        "Open/close curtains remotely",
        "Scheduled opening and closing",
        "Scene-based curtain control",
        "Manual control",
        "Integration with other automation",
      ],
    },
    {
      id: "locks",
      category: "SMART DOOR LOCKS",
      title: "Smart Digital Door Locks",
      subtitle: "Bank-grade keyless entry, audit trail & multi-modal access",
      badge: "Door Locks",
      icon: "🔐",
      features: [
        "Keyless entry",
        "Fingerprint access",
        "PIN/password access",
        "RFID/card access where applicable",
        "Mobile/app access where supported",
        "Temporary access options",
        "Door status monitoring",
        "Mechanical key backup",
      ],
    },
    {
      id: "security",
      category: "INTEGRATED SECURITY",
      title: "Smart Security & Monitoring",
      subtitle: "24/7 proactive intrusion detection & instant mobile alerts",
      badge: "Security",
      icon: "🛡️",
      features: [
        "Door/window monitoring",
        "Motion detection",
        "Intrusion alerts",
        "Siren/alarm integration",
        "Mobile notifications",
        "CCTV integration where included",
        "Security automation scenarios",
      ],
    },
    {
      id: "gate",
      category: "GATE AUTOMATION",
      title: "Automated Gates & Boom Barriers",
      subtitle: "Driveway motorized operation, obstacle safety & long-range remotes",
      badge: "Gate Automation",
      icon: "⛩️",
      features: [
        "Automated gate opening/closing",
        "Remote operation",
        "Vehicle/person access control where applicable",
        "Safety features based on the selected controller",
        "Integration with smart-home controls where supported",
      ],
    },
  ];
}

function synthesizeSmartScenes(subsystems: SubsystemFeature[]) {
  const ids = new Set(subsystems.map((s) => s.id));
  const hasLight = ids.has("lighting");
  const hasCurtain = ids.has("curtains");
  const hasLock = ids.has("locks");
  const hasGate = ids.has("gate");
  const hasSecurity = ids.has("security");

  const scenes = [];

  // 1. GOOD MORNING
  let morningSteps = "Lights ON → Curtains Open → Selected appliances ON";
  if (!hasCurtain) {
    morningSteps = "Warm Lights ON → Pathway Active → Water Heater ON";
  }
  scenes.push({
    name: "GOOD MORNING",
    time: "07:00 AM",
    icon: "🌅",
    steps: morningSteps,
    desc: "Awaken comfortably to gentle lighting and natural morning warmth automatically synchronized for your day.",
  });

  // 2. LEAVING HOME
  let awaySteps = "Lights OFF → Curtains Close → Security Mode ON";
  if (hasGate && hasLock) {
    awaySteps = "Lights OFF → Curtains Close → Doors Locked → Gate Closed → Security Mode ON";
  } else if (hasLock) {
    awaySteps = "Lights OFF → Curtains Close → Doors Checked & Locked → Security Mode ON";
  } else if (!hasCurtain && !hasSecurity) {
    awaySteps = "All Lights & Fans OFF → ACs OFF → Standby Power Saved";
  }
  scenes.push({
    name: "LEAVING HOME",
    time: "09:30 AM",
    icon: "🚪",
    steps: awaySteps,
    desc: "One touch near the main exit or on your phone puts the entire property into secure, power-saving away mode.",
  });

  // 3. MOVIE MODE
  let movieSteps = "Main Lights OFF → Accent Lights ON → Curtains Close";
  if (!hasCurtain) {
    movieSteps = "Main Lights OFF → Accent Lights Dimmed (20%) → Warm Ambiance ON";
  }
  scenes.push({
    name: "MOVIE MODE",
    time: "08:00 PM",
    icon: "🎬",
    steps: movieSteps,
    desc: "Dims the main lighting to warm cove tones and closes motorized window shades for an immersive private cinema feel.",
  });

  // 4. GOOD NIGHT
  let nightSteps = "Selected Lights OFF → Doors Checked → Security Mode ON";
  if (!hasLock && !hasSecurity) {
    nightSteps = "Selected Lights OFF → Bedside Master All-Off → Night Path Dim (10%)";
  }
  scenes.push({
    name: "GOOD NIGHT",
    time: "11:00 PM",
    icon: "🌙",
    steps: nightSteps,
    desc: "Turn off all active room switches and verify the home is safe and settled right from your bedside panel.",
  });

  // 5. WELCOME HOME (if gate or lock is present)
  if (hasGate || hasLock) {
    let welcomeSteps = "Gate Opens → Pathway Lights ON → Entrance Door Unlocked";
    if (!hasGate) {
      welcomeSteps = "Door Unlocked via Biometrics → Foyer Lights Welcome You";
    }
    scenes.push({
      name: "WELCOME HOME",
      time: "Arrival",
      icon: "🏡",
      steps: welcomeSteps,
      desc: "Drive up or walk through the entrance with automated entry and illuminated pathways welcoming you home.",
    });
  }

  return scenes.slice(0, 4);
}

const whyTechomiePoints = [
  "Professional installation",
  "Complete system configuration",
  "App setup",
  "Automation programming",
  "Customer demonstration",
  "User training",
  "Local technical support",
  "Product warranty",
  "After-sales service",
  "Integration of multiple systems",
  "Future expansion capability",
];


interface DecidedSwitchInfo {
  series: string;
  image: string;
  label: string;
  description: string;
}


interface ScopeCategoryItem {
  category: string;
  scope: string;
}

function detectScopeSummary(snap: R): ScopeCategoryItem[] {
  const subsystems = detectQuoteSubsystems(snap);
  const ids = new Set(subsystems.map((s) => s.id));
  const summary: ScopeCategoryItem[] = [];

  if (ids.has("lighting")) {
    summary.push({
      category: "Lighting Automation",
      scope: "Smart touch switches, dimmers, fan regulators and scene control",
    });
  }
  if (ids.has("curtains")) {
    summary.push({
      category: "Curtain Automation",
      scope: "Motorized curtain track, tubular motors and automated scheduling",
    });
  }
  if (ids.has("locks") || ids.has("security")) {
    summary.push({
      category: "Security & Access",
      scope: "Smart biometric door locks, sensors, radar and siren integration",
    });
  }
  const allText = JSON.stringify(snap).toLowerCase();
  if (allText.includes("cctv") || allText.includes("camera") || allText.includes("nvr")) {
    summary.push({
      category: "CCTV & Surveillance",
      scope: "High-definition cameras, NVR recording and remote mobile live view",
    });
  }
  if (ids.has("gate")) {
    summary.push({
      category: "Gate Automation",
      scope: "Heavy-duty motor operator, controller, base plate and wireless remotes",
    });
  }
  if (allText.includes("wifi") || allText.includes("zigbee") || allText.includes("gateway") || allText.includes("network") || allText.includes("poe")) {
    summary.push({
      category: "Networking & Mesh",
      scope: "Wi-Fi, Zigbee 3.0 mesh gateway and local network infrastructure",
    });
  }

  if (summary.length === 0) {
    summary.push({
      category: "Smart Home Automation",
      scope: "Supply, installation, commissioning and smart app control",
    });
  }
  return summary;
}

function getDecidedSwitchSeries(snap: R): DecidedSwitchInfo | null {
  const floors = snap.floors || [];
  const allItems: R[] = [
    ...floors.flatMap((f: R) => (f.rooms || []).flatMap((r: R) => r.items || [])),
    ...(snap.projectItems || []),
  ];

  const counts: Record<string, number> = {};
  for (const item of allItems) {
    const raw = (item.series || item.parsedAttributes?.series || item.name || "").toLowerCase();
    if (raw.includes("luxeray") || raw.includes("titan")) {
      counts["Noviq Luxeray"] = (counts["Noviq Luxeray"] || 0) + 1;
    } else if (raw.includes("royal edge color")) {
      counts["Royal Edge Color"] = (counts["Royal Edge Color"] || 0) + 1;
    } else if (raw.includes("royal edge")) {
      counts["Royal Edge"] = (counts["Royal Edge"] || 0) + 1;
    } else if (raw.includes("edge color")) {
      counts["Edge Color"] = (counts["Edge Color"] || 0) + 1;
    } else if (raw.includes("edge")) {
      counts["Edge"] = (counts["Edge"] || 0) + 1;
    } else if (raw.includes("touch plus") || raw.includes("color touch")) {
      counts["Touch Plus"] = (counts["Touch Plus"] || 0) + 1;
    } else if (raw.includes("touch panel") || raw.includes("touch")) {
      counts["Touch Panel"] = (counts["Touch Panel"] || 0) + 1;
    }
  }

  let bestSeries = "";
  let maxCount = 0;
  for (const [s, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSeries = s;
    }
  }

  if (!bestSeries) return null;

  switch (bestSeries) {
    case "Royal Edge":
      return {
        series: "Royal Edge",
        image: "/products/switches/royal-edge-series.png",
        label: "Noviq Royal Edge Collection",
        description: "Signature gold base accent bar with crystal tempered glass & multi-color icon illumination",
      };
    case "Royal Edge Color":
    case "Edge Color":
      return {
        series: "Edge Color",
        image: "/products/switches/edge-color-series.png",
        label: "Noviq Edge Color Series",
        description: "Ultra-slim metallic gold bezel with vibrant dual-color backlit touch icons & precision dimming",
      };
    case "Edge":
      return {
        series: "Edge",
        image: "/products/switches/edge-series.png",
        label: "Noviq Edge Series",
        description: "Minimalist circular ring touch sensors encased in an anodized champagne gold metallic frame",
      };
    case "Touch Plus":
    case "Touch Panel":
      return {
        series: "Touch Plus",
        image: "/products/switches/touch-plus-series.png",
        label: "Noviq Touch Plus Series",
        description: "Frameless pure black crystal glass with cyan glowing square capacitive touch points",
      };
    case "Noviq Luxeray":
    default:
      return {
        series: "Noviq Luxeray",
        image: "/products/switches/noviq-luxeray-series.png",
        label: "Noviq Luxeray Series",
        description: "Architectural luxury frameless glass with branded NOVIQ insignia & custom laser engraved icons",
      };
  }
}

  const paginateFloor = (floor: R) => {
    const pages: R[] = [];
    let currentPageRooms: R[] = [];
    let currentUsed = 0;
    // Room budget: 170mm safe height to guarantee zero row clipping on A4 pages
    const getBudget = (isFirst: boolean) => 170;

    const pushCurrentPage = () => {
      if (currentPageRooms.length) {
        pages.push({ rooms: currentPageRooms, hasFloorSummary: false });
        currentPageRooms = [];
        currentUsed = 0;
      }
    };

    const rooms = floor.rooms || [];
    for (let rIdx = 0; rIdx < rooms.length; rIdx++) {
      const room = rooms[rIdx];
      const items = room.items || [];
      const budget = getBudget(pages.length === 0);

      if (!items.length) {
        const cost = 22;
        if (currentUsed + cost > budget) pushCurrentPage();
        currentPageRooms.push({
          ...room,
          items: [],
          originalItemCount: 0,
          continued: false,
          isChunkEnd: true,
          startSno: 1,
        });
        currentUsed += cost;
        continue;
      }

      let itemIdx = 0;
      let chunkIdx = 0;
      while (itemIdx < items.length) {
        const curBudget = getBudget(pages.length === 0);
        // Room banner + capability pills (14mm) + table thead (8mm) = 22mm (chunk 0)
        // Continued chunk: banner (10mm) + thead (8mm) = 18mm
        const overhead = chunkIdx === 0 ? 22 : 18;
        const itemHeight = 26; // Realistic item row height for enlarged photos (78px img wrap + badges + padding)

        // If starting a new room and remaining space cannot hold overhead + at least 1 item,
        // break to next page immediately so the room starts cleanly at the top of the next page!
        if (chunkIdx === 0 && currentUsed > 0 && (curBudget - currentUsed < overhead + itemHeight)) {
          pushCurrentPage();
          continue;
        }

        const available = curBudget - currentUsed - overhead;
        let count = Math.floor(available / itemHeight);
        if (count < 1) {
          pushCurrentPage();
          continue;
        }
        const slice = items.slice(itemIdx, itemIdx + count);
        const isEnd = itemIdx + slice.length >= items.length;
        currentPageRooms.push({
          ...room,
          items: slice,
          originalItemCount: items.length,
          continued: chunkIdx > 0,
          chunkIndex: chunkIdx,
          isChunkEnd: isEnd,
          startSno: itemIdx + 1,
        });
        currentUsed += overhead + slice.length * itemHeight;
        itemIdx += slice.length;
        chunkIdx++;
      }
    }

    if (currentPageRooms.length) {
      pages.push({ rooms: currentPageRooms });
    }

    return pages.length ? pages : [{ rooms: [] }];
  };

  const scopePages = floors.flatMap((floor: R, floorIndex: number) => {
    const pages = paginateFloor(floor);
    return pages.map((page: R, pageIndex: number) => ({
      floor,
      floorIndex,
      pageIndex,
      pageCount: pages.length,
      rooms: page.rooms,
    }));
  });

  const subsystems = detectQuoteSubsystems(snap);
  const smartScenes = synthesizeSmartScenes(subsystems);
  const decidedSwitch = getDecidedSwitchSeries(snap);
  const scopeSummary = detectScopeSummary(snap);

  return (
    <article
      className={`qpaper qpaperpremium ${designClass} qformat-${pdfFormat} qtemplate-${templateId} ${branding.showStandardImages === false ? "qhideimages" : ""}`}
      style={templateStyle}
    >
      {/* PAGE 1: PROJECT COVER + CUSTOMER DETAILS */}
      <section className="qcover">
        <div className="qcoverglow" />
        <header>
          <img src={logo} alt="Techomie" />
          <span>
            <b>{company}</b>
            <small>Smart Homes • Security • Automation • Gate Automation</small>
          </span>
        </header>
        <div className="qcoverbody">
          <small>{detailed ? "SMART HOME AUTOMATION PROPOSAL" : "COMMERCIAL QUOTATION"}</small>
          <h1>{customerName}</h1>
          <p>
            {siteName}{quote.city ? `, ${quote.city}` : ""}
          </p>
        </div>
        <div className="qcovermeta">
          <span>
            <small>PROPOSAL NUMBER</small>
            <b>{quote.number} · REV {quote.revision || 0}</b>
          </span>
          <span>
            <small>DATE OF ISSUE</small>
            <b>{snap.details?.quoteDate || quote.quote_date || new Date().toLocaleDateString("en-IN")}</b>
          </span>
          <span>
            <small>PROPOSAL VALIDITY</small>
            <b>{validity || "30 Calendar Days"}</b>
          </span>
          <span>
            <small>PROJECT NAME</small>
            <b>{siteName}</b>
          </span>
          <span>
            <small>SITE LOCATION</small>
            <b>{quote.city || "Tamil Nadu"}</b>
          </span>
          <span>
            <small>PREPARED BY</small>
            <b>{quote.sales_name || snap.company?.displayName || "Techomie Smart Devices"}</b>
          </span>
        </div>
        <div className="qcoverproposed">
          <small>PROPOSED AUTOMATION SCOPE</small>
          <div className="qcoverscopetags">
            {floors.map((f: R, i: number) => (
              <span key={i} className="qcoverscopetag">
                ✓ {f.name}
              </span>
            ))}
            <span className="qcoverscopetag">✓ Mobile App & Voice Assistant</span>
            <span className="qcoverscopetag">✓ Testing & Commissioning</span>
          </div>
        </div>
        <footer>
          <span>TECHOMIE SMART DEVICES</span>
          <small>Smart Homes • Security • Automation • Gate Automation</small>
        </footer>
      </section>

      {/* PAGE 2: PROJECT OVERVIEW + SYSTEM SUMMARY */}
      {detailed && (
        <section className="qintro">
          {head("PROPOSAL OVERVIEW")}
          <div className="qintrohero">
            <small>PROJECT OVERVIEW</small>
            <h2>
              A smarter property,
              <br />
              <span>thoughtfully designed.</span>
            </h2>
            <p>
              {snap.details?.introduction ||
                `This quotation covers the supply, installation, configuration and commissioning of smart home automation and security solutions for the proposed residence at ${siteName}${quote.city ? `, ${quote.city}` : ""}.`}
            </p>
          </div>

          {/* SCOPE SUMMARY TABLE */}
          <div className="qscopesummarybox">
            <div className="qscopesummaryhead">
              <small>EXECUTIVE SCOPE SUMMARY</small>
              <b>Project Categories &amp; Solution Scope</b>
            </div>
            <table className="qscopesummarytable">
              <thead>
                <tr>
                  <th style={{ width: "35%", textAlign: "left" }}>Category</th>
                  <th style={{ width: "65%", textAlign: "left" }}>Scope Description</th>
                </tr>
              </thead>
              <tbody>
                {scopeSummary.map((item, idx) => (
                  <tr key={idx}>
                    <td><b>{item.category}</b></td>
                    <td>{item.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="qscopebrief">
            <div>
              <b>{floors.length}</b>
              <span>Floors</span>
            </div>
            <div>
              <b>{rooms.length}</b>
              <span>Rooms / Areas</span>
            </div>
            <div>
              <b>{items.length}</b>
              <span>Configured Points</span>
            </div>
            <div>
              <b>{money(totals.grand)}</b>
              <span>Proposal Value</span>
            </div>
          </div>
          {decidedSwitch && (
            <div className="qdecidedswitchshowcase">
              <div className="qdecidedswitchhead">
                <div>
                  <small>SELECTED HARDWARE AESTHETICS</small>
                  <b>{decidedSwitch.label}</b>
                </div>
                <span>{decidedSwitch.description}</span>
              </div>
              <div className="qdecidedswitchimgbox">
                <img src={decidedSwitch.image} alt={decidedSwitch.label} />
              </div>
            </div>
          )}
          {foot("Proposal overview")}
        </section>
      )}

      {/* PAGES 3+: FLOOR-WISE & ROOM-WISE BOQ */}
      {scopePages.map((scope: R, pIdx: number) => {
        return (
          <section
            className="qpaperscope"
            key={`${scope.floor.name}-${scope.pageIndex}-${pIdx}`}
          >
            {head("ROOM-WISE SCOPE")}
            <div className="qsectiontitle">
              <small>
                SCOPE {String(scope.floorIndex + 1).padStart(2, "0")}
                {scope.pageIndex > 0
                  ? ` · CONTINUED (PAGE ${scope.pageIndex + 1} OF ${scope.pageCount})`
                  : scope.pageCount > 1
                    ? ` · (PAGE 1 OF ${scope.pageCount})`
                    : ""}
              </small>
              <h2>{scope.floor.name}</h2>
              <span>{(scope.floor.rooms || []).length} areas configured</span>
            </div>

            {/* Room mini-map / navigation pills */}
            <div className="qfloormap">
              <small>AREAS IN THIS FLOOR:</small>
              <div className="qfloormaptext">
                {(scope.floor.rooms || [])
                  .filter((r: R) => (r.items || []).length > 0)
                  .map((r: R) => `${r.name} (${(r.items || []).length})`)
                  .join("  ·  ")}
              </div>
            </div>

            {/* Room items tables */}
            {scope.rooms.map((room: R, rIndex: number) => {
              return (
                <div
                  className="qpdfroom"
                  key={`${room.name}-${room.chunkIndex || 0}-${rIndex}`}
                >
                  <div className="qroombanner">
                    <div>
                      <b>
                        {room.name}
                        {room.continued ? " (continued)" : ""}
                      </b>
                      <div className="qroomcaps">
                        {getRoomCapabilities(room).map((cap: string, cIdx: number) => (
                          <span key={cIdx} className="qroomcap-tag">
                            ✓ {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span>
                      {room.note ||
                        `${room.originalItemCount || (room.items || []).length} configured items`}
                    </span>
                  </div>
                  <table className="qboqtable">
                    <colgroup>
                      <col className="col-sno" style={{ width: "34px" }} />
                      <col className="col-img" style={{ width: "125px" }} />
                      <col className="col-details" />
                      <col className="col-qty" style={{ width: "38px" }} />
                      <col className="col-unit" style={{ width: "40px" }} />
                      <col className="col-rate" style={{ width: "74px" }} />
                      <col className="col-disc" style={{ width: "42px" }} />
                      <col className="col-amt" style={{ width: "84px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="th-sno" style={{ width: "34px", textAlign: "center" }}>S.NO</th>
                        <th className="th-img" style={{ width: "125px", textAlign: "center" }}>PHOTO</th>
                        <th className="th-details" style={{ textAlign: "left" }}>PRODUCT / MODULE &amp; SPECIFICATIONS</th>
                        <th className="th-qty" style={{ width: "38px", textAlign: "center" }}>QTY</th>
                        <th className="th-unit" style={{ width: "40px", textAlign: "center" }}>UNIT</th>
                        <th className="th-rate" style={{ width: "74px", textAlign: "right" }}>RATE</th>
                        <th className="th-disc" style={{ width: "42px", textAlign: "center" }}>DISC.</th>
                        <th className="th-amt" style={{ width: "84px", textAlign: "right" }}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(room.items || []).map((item: R, index: number) => {
                        const sno = (room.startSno || 1) + index;
                        const isDuplicateDesc =
                          item.description &&
                          (item.description.trim() === item.name.trim() ||
                            item.name.toLowerCase().includes(item.description.trim().toLowerCase()) ||
                            item.description.toLowerCase().includes(item.name.trim().toLowerCase()));
                        return (
                          <tr key={index} className="qboqrow">
                            <td className="td-sno">{sno}</td>
                            <td className="td-img">
                              <div className="qboqimgwrap">
                                <img src={resolveImageUrl(item.image) || logo} alt="" />
                              </div>
                            </td>
                            <td className="td-details">
                              <b>
                                {item.name} {item.optional ? "(Optional)" : ""}
                              </b>
                              {item.description && !isDuplicateDesc && (
                                <small>{item.description}</small>
                              )}
                              <div className="qitem-pills">
                                {item.series && <span className="item-pill-badge series"><span className="qpilltext">{item.series}</span></span>}
                                {item.technology && <span className="item-pill-badge tech"><span className="qpilltext">{item.technology}</span></span>}
                                {item.material && <span className="item-pill-badge mat"><span className="qpilltext">{item.material}</span></span>}
                                {item.edgeColor && <span className="item-pill-badge edge"><span className="qpilltext">{item.edgeColor}</span></span>}
                                {item.panelColor && <span className="item-pill-badge panel"><span className="qpilltext">{item.panelColor}</span></span>}
                                {item.module && <span className="item-pill-badge mod"><span className="qpilltext">{item.module}</span></span>}
                                {getItemFeatureTag(item) && <span className="item-pill-badge feature"><span className="qpilltext">✦ {getItemFeatureTag(item)}</span></span>}
                                {item.sku && <span className="qitemsku"><span className="qpilltext">{item.sku}</span></span>}
                              </div>
                            </td>
                            <td className="td-qty">{wholeQty(item.qty)}</td>
                            <td className="td-unit">{item.unit || "Nos"}</td>
                            <td className="td-rate">{money(item.price)}</td>
                            <td className="td-disc">
                              {Number(item.discount || 0) > 0 ? `${item.discount}%` : "—"}
                            </td>
                            <td className="td-amt">{money(line(item).total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="qroomtotalbar">
                    <span>{room.name} Total</span>
                    <b>{money((room.items || []).reduce((acc: number, x: R) => acc + line(x).total, 0))}</b>
                  </div>
                </div>
              );
            })}

            {scope.pageIndex === scope.pageCount - 1 && (
              <div className="qfloortotalbar">
                <div>
                  <small>FLOOR SUB-TOTAL</small>
                  <b>{scope.floor.name} Subtotal</b>
                </div>
                <strong>
                  {money((scope.floor.rooms || []).flatMap((r: R) => r.items || []).reduce((acc: number, x: R) => acc + line(x).total, 0))}
                </strong>
              </div>
            )}

            {foot(
              `${scope.floor.name} scope${scope.pageCount > 1 ? ` · Page ${scope.pageIndex + 1}/${scope.pageCount}` : ""}`,
            )}
          </section>
        );
      })}

      {/* 4. FEATURES & BENEFITS — WHAT YOU GET */}
      {subsystems.length > 0 && (
        <section className="qpaperfeatures">
          {head("4. FEATURES & BENEFITS — WHAT YOU GET")}
          <div className="qsectiontitle">
            <small>SOLUTION ARCHITECTURE &amp; VALUE</small>
            <h2>What You Get With Your Techomie Smart Home</h2>
            <span>
              Personalized features &amp; everyday living experience engineered from your selected configuration
            </span>
          </div>

          <div className={`qsubsystemsgrid qcols-${Math.min(subsystems.length, 2)}`}>
            {subsystems.map((sub) => (
              <article key={sub.id} className="qsubsystemcard">

                <div className="qsubsystemhead">
                  <span className="qsubsystemicon">
                    <i className="qsubsystemicon-inner">{sub.icon}</i>
                  </span>
                  <div className="qsubsystemtitlewrap">
                    <span className="qsubsystembadge">{sub.category}</span>
                    <b>{sub.title}</b>
                    <small>{sub.subtitle}</small>
                  </div>
                </div>
                <ul className="qsubsystemfeaturelist">
                  {sub.features.map((feat, fIdx) => (
                    <li key={fIdx}>
                      <span className="qbulletcheck">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="qfeaturesfooterbar">
            <span>
              ✦ All hardware modules operate as a single unified ecosystem through the Techomie platform.
            </span>
          </div>

          {foot("4. Features & Benefits — What You Get")}
        </section>
      )}

      {/* 5. SYSTEM CAPABILITIES & THE TECHOMIE ADVANTAGE */}
      {(
        <section className="qpaperadvantage">
          {head("5. YOUR TECHOMIE ADVANTAGE")}
          <div className="qsectiontitle">
            <small>INTELLIGENT ROUTINES &amp; SERVICE ASSURANCE</small>
            <h2>Your Techomie Advantage &amp; Smart Scenes</h2>
            <span>
              Dynamic scene automations and our dedicated end-to-end service commitments
            </span>
          </div>

          {/* SMART SCENES */}
          <div className="qscenescapsblock">
            <div className="qscenescapstitle">
              <small>SYSTEM CAPABILITIES</small>
              <b>Smart Scenes (Example Automations)</b>
              <p>
                Tailored specifically for the modules in your proposal and programmed during on-site commissioning:
              </p>
            </div>
            <div className="qscenesgridnew">
              {smartScenes.map((scene, sIdx) => (
                <div key={sIdx} className="qscenecardnew">
                  <div className="qsceneheadnew">
                    <span className="qsceneicon">{scene.icon}</span>
                    <div>
                      <b>{scene.name}</b>
                      <small>{scene.time}</small>
                    </div>
                  </div>
                  <div className="qscenesteps">
                    <code>{scene.steps}</code>
                  </div>
                  <p className="qscenedesc">{scene.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* WHY TECHOMIE? */}
          <div className="qwhytechomieblock">
            <div className="qwhyhead">
              <div className="qwhybadge">THE TECHOMIE ADVANTAGE</div>
              <b>Why Techomie?</b>
              <span>11 Core Service Deliverables Included in Every Project</span>
            </div>
            <div className="qwhygrid">
              {whyTechomiePoints.map((pt, pIdx) => (
                <div key={pIdx} className="qwhyitem">
                  <span className="qwhycheck">✓</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LOCAL & RELIABLE CONTROL */}
          <div className="qlocalcontrolcard">
            <div className="qlocalicon">🛡️</div>
            <div className="qlocalcontent">
              <b>Local &amp; Reliable Control</b>
              <p>
                Selected systems can continue to provide local control even when internet connectivity is unavailable, depending on the products and architecture used.
              </p>
            </div>
          </div>

          {foot("5. Your Techomie Advantage")}
        </section>
      )}

      {/* COMMERCIAL & PAYMENT TERMS PAGE */}
      <section className="qpaperfinance">
        {head("COMMERCIAL & PAYMENT TERMS")}
        <div className="qsectiontitle">
          <small>INVESTMENT OVERVIEW &amp; PAYMENT SCHEDULE</small>
          <h2>Commercial Summary &amp; Payment Terms</h2>
          <span>All values in INR · Standard Commercial Proposal</span>
        </div>

        <div className="qfloortablebox">
          <table className="qfloortable">
            <colgroup>
              <col style={{ width: "auto" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "110px" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Area / Scope Description</th>
                <th style={{ width: "90px", textAlign: "center" }}>Rooms</th>
                <th style={{ width: "110px", textAlign: "center" }}>Configured Items</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((f: R, fIdx: number) => {
                const fItemCount = (f.rooms || []).reduce(
                  (acc: number, r: R) => acc + (r.items || []).length,
                  0,
                );
                return (
                  <tr key={fIdx}>
                    <td>
                      <b>{f.name}</b>
                      <small>
                        {(f.rooms || []).map((r: R) => r.name).join(", ")}
                      </small>
                    </td>
                    <td style={{ textAlign: "center" }}>{(f.rooms || []).length}</td>
                    <td style={{ textAlign: "center" }}>{fItemCount}</td>
                  </tr>
                );
              })}
              {snap.projectItems && snap.projectItems.length > 0 && (
                <tr>
                  <td>
                    <b>Project-Level Items &amp; Gate Automation</b>
                    <small>Shared controllers, gateways, and outdoor items</small>
                  </td>
                  <td style={{ textAlign: "center" }}>—</td>
                  <td style={{ textAlign: "center" }}>{snap.projectItems.length}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PROJECT SUMMARY TABLE */}
        <div className="qprojectsummarytablebox">
          <table className="qprojectsummarytable">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Description</th>
                <th style={{ textAlign: "right", width: "130px" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Products &amp; Hardware Supply</b>
                  <small>Smart modular touch panels, controllers, sensors and accessories</small>
                </td>
                <td style={{ textAlign: "right" }}>{money(totals.subtotal)}</td>
              </tr>
              <tr>
                <td>
                  <b>Installation &amp; Commissioning</b>
                  <small>Mounting, backbox termination, mesh pairing, testing and handover</small>
                </td>
                <td style={{ textAlign: "right" }}>
                  {snap.details?.installationFee ? money(Number(snap.details.installationFee)) : "Included in Package"}
                </td>
              </tr>
              <tr>
                <td>
                  <b>Configuration &amp; Programming</b>
                  <small>App configuration, voice assistants (Alexa/Google), smart scene routines</small>
                </td>
                <td style={{ textAlign: "right" }}>Included</td>
              </tr>
              {totals.discount > 0 && (
                <tr className="qdiscountrow">
                  <td>
                    <b>Special Project Discount</b>
                  </td>
                  <td style={{ textAlign: "right" }}>- {money(totals.discount)}</td>
                </tr>
              )}
              <tr className="qsubtotalrow">
                <td>
                  <b>Subtotal (Net Taxable Value)</b>
                </td>
                <td style={{ textAlign: "right" }}><b>{money(totals.taxable)}</b></td>
              </tr>
              {snap.taxMode !== "Non-GST" && (
                <>
                  <tr>
                    <td>CGST (9%)</td>
                    <td style={{ textAlign: "right" }}>{money(totals.tax / 2)}</td>
                  </tr>
                  <tr>
                    <td>SGST (9%)</td>
                    <td style={{ textAlign: "right" }}>{money(totals.tax / 2)}</td>
                  </tr>
                </>
              )}
              <tr className="qgrandtotalrow">
                <td>
                  <strong>Grand Total ({snap.taxMode === "Non-GST" ? "Non-GST Commercial Total" : "Inclusive of 18% GST"})</strong>
                  <small>AMOUNT IN WORDS: {inWords(totals.grand)}</small>
                </td>
                <td style={{ textAlign: "right" }}>
                  <strong>{money(totals.grand)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* INSTALLATION CHARGES & SCOPE NOTE */}
        <div className="qinstallationchargesbox">
          <div className="qinstallicon">🔧</div>
          <div>
            <b>Installation &amp; Commissioning Scope</b>
            <p>
              Installation includes mounting, wiring assistance, device configuration, system commissioning, testing and basic user handover.
              Specialized services such as gate automation motor brackets or carpenter wooden mortise alignment are coordinated with site trades.
            </p>
          </div>
        </div>

        {/* PAYMENT MILESTONES */}
        <div className="qmilestones-block">
          <div className="qsubheading">
            <small>PAYMENT SCHEDULE</small>
            <h4>Payment Milestones</h4>
          </div>
          <div className="qmilestones">
            {(snap.paymentPlan && snap.paymentPlan.length
              ? snap.paymentPlan
              : [
                  { name: "Advance", percent: 50, condition: "Order confirmation & procurement" },
                  { name: "Installation Commencement", percent: 20, condition: "At commencement of installation" },
                  { name: "Handover", percent: 20, condition: "On commissioning & client handover" },
                  { name: "Retention", percent: 10, condition: "After 1 month from handover" },
                ]
            ).map((m: R, index: number) => (
              <article key={m.name || index}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <small>{m.percent}% MILESTONE</small>
                  <b>{m.name}</b>
                  {m.condition ? <em>{m.condition}</em> : null}
                </span>
                <strong>
                  {money((totals.grand * Number(m.percent || 0)) / 100)}
                </strong>
              </article>
            ))}
          </div>
        </div>

        {/* PROJECT TIMELINE */}
        <div className="qprojecttimelinebox">
          <span className="qtimelineicon">⏱️</span>
          <div>
            <b>Project Timeline</b>
            <p>
              Estimated Installation Duration: <b>3–5 working days</b>{" "}(subject to site readiness and availability of required electrical/network infrastructure).
            </p>
          </div>
        </div>

        {/* COMMERCIAL TERMS (CONCISE) */}
        <div className="qcommercialtermsbox">
          <small>COMMERCIAL TERMS</small>
          <p>
            {snap.terms ||
              "1. Quotation validity is 30 calendar days from issue. 2. Payment follows the agreed milestone schedule. 3. GST 18% is billed in compliance with Indian tax laws. 4. Standard delivery lead time is 2 to 3 weeks upon confirmed advance."}
          </p>
        </div>

        {foot("Commercial & Payment Terms")}
      </section>

      {/* EXECUTION STANDARDS, WARRANTY & SIGN-OFF PAGE */}
      <section className="qpaperterms qpaperclosing">
        {head("INSTALLATION & ACCEPTANCE")}
        <div className="qsectiontitle">
          <small>STANDARDS, WARRANTY &amp; ACCEPTANCE</small>
          <h2>Installation Scope, Warranty &amp; Customer Sign-Off</h2>
          <span>Standard Operating Procedures, What's Included / Excluded &amp; Authorization</span>
        </div>

        {/* Installation Policy */}
        <div className="qpolicybox">
          <div className="qpolicyicon">🔧</div>
          <div>
            <b>Installation &amp; Commissioning Policy</b>
            <p>
              {snap.details?.installationScope ||
                "Installation, configuration, testing and commissioning of the quoted automation products shall be carried out by Techomie. Product-wise installation will be coordinated room-wise and floor-wise. Gate automation installation includes motor mounting and commissioning, with required welding support to be arranged at site. Smart lock installation will be coordinated with the client's carpenter."}
            </p>
          </div>
        </div>

        {/* WHAT IS INCLUDED & WHAT IS NOT INCLUDED */}
        <div className="qscopetwocol">
          <article className="qscopebox qincludedbox">
            <small>WHAT IS INCLUDED</small>
            <ul className="qchecklist">
              <li><span className="qcheck">✓</span> Supply of quoted products</li>
              <li><span className="qcheck">✓</span> Installation</li>
              <li><span className="qcheck">✓</span> Configuration</li>
              <li><span className="qcheck">✓</span> App setup</li>
              <li><span className="qcheck">✓</span> Automation programming</li>
              <li><span className="qcheck">✓</span> Testing &amp; commissioning</li>
              <li><span className="qcheck">✓</span> Customer demonstration</li>
              <li><span className="qcheck">✓</span> Basic user training</li>
              <li><span className="qcheck">✓</span> Warranty support</li>
            </ul>
          </article>

          <article className="qscopebox qexcludedbox">
            <small>WHAT IS NOT INCLUDED (EXCLUSIONS)</small>
            <ul className="qcrosslist">
              <li><span className="qcross">✕</span> Civil work</li>
              <li><span className="qcross">✕</span> Painting work</li>
              <li><span className="qcross">✕</span> False ceiling modifications</li>
              <li><span className="qcross">✕</span> Electrical wiring unless specifically mentioned</li>
              <li><span className="qcross">✕</span> Internet connection</li>
              <li><span className="qcross">✕</span> Electrical DB modifications</li>
              <li><span className="qcross">✕</span> Carpenter work unless mentioned</li>
              <li><span className="qcross">✕</span> Welding work for gate automation unless mentioned</li>
              <li><span className="qcross">✕</span> Scaffolding / lifting equipment</li>
              <li><span className="qcross">✕</span> Any additional material not mentioned in quotation</li>
            </ul>
          </article>
        </div>

        {/* SITE READINESS / CLIENT RESPONSIBILITY */}
        <div className="qsitereadinessbox">
          <div className="qsitereadinessicon">📋</div>
          <div>
            <b>Site Readiness / Client Responsibility</b>
            <p>
              All required electrical points, power supply, conduits, network points and other site infrastructure shall be completed before installation. Any additional work required due to site conditions will be charged separately.
            </p>
          </div>
        </div>

        {/* WARRANTY ASSURANCE CARDS */}
        <div className="qwarrantygrid">
          <article className="qwarrantycard">
            <div className="qwarrantybadge"><strong>10-YR</strong></div>
            <div>
              <small>ALL TECHOMIE SMART PRODUCTS</small>
              <b>10-Year Warranty</b>
              <span>5 Years Full Replacement + 5 Years Service Warranty</span>
            </div>
          </article>

          <article className="qwarrantycard gold">
            <div className="qwarrantybadge"><strong>10-YR</strong></div>
            <div>
              <small>ROYAL EDGE &amp; LUXURY TOUCH SERIES</small>
              <b>10-Year Warranty</b>
              <span>5 Years Full Replacement + 5 Years Service Warranty</span>
            </div>
          </article>
        </div>

        {/* Bank Details */}
        <div className="qbankcard">
          <div className="qbankhead">
            <b>TECHOMIE OFFICIAL BANK ACCOUNT</b>
            <span>For RTGS / NEFT / IMPS / Net Banking Remittances</span>
          </div>
          <div className="qbankgrid">
            <div>
              <small>ACCOUNT NAME</small>
              <b>{snap.company?.bankAccountName || snap.company?.displayName || "Techomie Smart Devices"}</b>
            </div>
            <div>
              <small>BANK NAME</small>
              <b>{snap.company?.bankName || "HDFC Bank"}</b>
            </div>
            <div>
              <small>ACCOUNT NUMBER</small>
              <b>{snap.company?.bankAccountNumber || "50200084928192"}</b>
            </div>
            <div>
              <small>IFSC CODE</small>
              <b>{snap.company?.bankIfsc || "HDFC0000281"}</b>
            </div>
            <div>
              <small>BRANCH</small>
              <b>{snap.company?.bankBranch || "Peelamedu, Coimbatore"}</b>
            </div>
            <div>
              <small>UPI ID</small>
              <b>{snap.company?.upiId || "techomie@hdfcbank"}</b>
            </div>
          </div>
        </div>

        {/* Acceptance & Signatures */}
        <div className="qacceptanceblock">
          <div className="qsignbox">
            <div className="qsigntitle">FOR TECHOMIE SMART DEVICES</div>
            <p className="qacceptancetext">
              Issued on behalf of Techomie Smart Devices for execution upon order confirmation and milestone schedule.
            </p>
            <div className="qsignspace">
              {branding.signature && (
                <img src={branding.signature} alt="Sign" style={{ maxHeight: "32px" }} />
              )}
            </div>
            <div className="qsignline">
              <b>Authorised Signatory</b>
              <span>Techomie Smart Devices</span>
            </div>
          </div>

          <div className="qsignbox">
            <div className="qsigntitle">CUSTOMER ACCEPTANCE &amp; APPROVAL</div>
            <p className="qacceptancetext">
              &quot;I / We hereby accept and approve Quotation <b>{quote.number}</b> (Revision {quote.revision || 0}) for <b>{money(totals.grand)}</b> and agree to the room-wise scope, payment schedule, and terms outlined above.&quot;
            </p>
            <div className="qsignspace" />
            <div className="qsignline">
              <b>{customerName}</b>
              <span>Signature &amp; Date</span>
            </div>
          </div>
        </div>

        <div className="qclosingbanner">
          <small>THANK YOU FOR CHOOSING TECHOMIE</small>
          <h2>Let&apos;s make your space smarter.</h2>
          <p>Smart Home Automation · Digital Security · Gate Automation · Motorized Shades</p>
        </div>

        <div className="qpreparedbyfoot">
          <span>
            <b>Techomie Smart Devices</b> · 356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar, COIMBATORE 641048<br />
            <b>GSTIN:</b> 33GIMPP4721H1Z2 · <b>Ph:</b> 07598883121 · <b>Email:</b> info.techomie@gmail.com · <b>Web:</b> https://www.techomie.com/
          </span>
          <span><b>Consultant:</b> {snap.details?.quotationByName || quote.sales_name || quote.created_name || "Techomie Sales Team"}</span>
        </div>

        {foot("Acceptance & Sign-off")}
      </section>
    </article>
  );
}

function QuotePaperMinimal({ quote, snap, totals, branding = {} }: R) {
  const company = snap.company || {},
    companyName = company.displayName || "Techomie Smart Devices",
    logo = company.logo || "/techomie-logo.jpg",
    customerName = snap.details?.customerName || snap.details?.customer || quote.customer_name,
    siteName = snap.details?.siteName || snap.details?.site || quote.site_name,
    address = [company.address, company.city, company.state, company.pincode]
      .filter(Boolean)
      .join(", "),
    customerAddress = snap.details?.installationAddress || [quote.billing_address, quote.site_address, quote.city, quote.state, quote.pincode].filter(Boolean).join(", "),
    items = (snap.floors || []).flatMap((floor: R) =>
      (floor.rooms || []).flatMap((room: R) =>
        (room.items || []).map((item: R) => ({ ...item, floorName: floor.name, roomName: room.name })),
      ),
    ),
    chunks: R[][] = [];
  for (let index = 0; index < items.length; index += 6)
    chunks.push(items.slice(index, index + 6));
  if (!chunks.length) chunks.push([]);
  const compactSinglePage = items.length <= 5;
  const header = (continued = false) => (
    <>
      <header className="qminimalhead">
        <span><img src={logo} alt="Techomie" /><b>{companyName}</b></span>
        <div><small>{continued ? "QUOTATION - CONTINUED" : "QUOTATION"}</small><strong>{quote.number}</strong><em>Rev {quote.revision || 0}</em></div>
      </header>
      {!continued && <>
        <div className="qminimalcompany">
          <p>{address || company.registeredAddress || "356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar, COIMBATORE Tamil Nadu 641048, India"}</p>
          <p>{[`GSTIN ${company.gstin || "33GIMPP4721H1Z2"}`, company.phone || "07598883121", company.email || "info.techomie@gmail.com", company.website || "https://www.techomie.com/"].filter(Boolean).join(" | ")}</p>
        </div>
        <div className="qminimalmeta">
          <span><small>Quote date</small><b>{snap.details?.quoteDate || quote.quote_date}</b></span>
          <span><small>Valid until</small><b>{snap.details?.validUntil || quote.valid_until}</b></span>
          <span><small>Place of supply</small><b>{snap.placeOfSupply || quote.state || "Tamil Nadu"}</b></span>
        </div>
        <div className="qminimalbill">
          <small>BILL TO</small><b>{customerName}</b><span>{customerAddress || siteName}</span>
          {(snap.details?.gstin || quote.gstin) && <em>GSTIN {snap.details?.gstin || quote.gstin}</em>}
        </div>
      </>}
    </>
  );
  const table = (rows: R[]) => (
    <div className="qminimaltable">
      <div className="qminimalrow qminimalcolumns"><span>#</span><span>Item & description</span><span>Qty</span><span>Rate</span><span>Disc.</span><span>Tax</span><span>Amount</span></div>
      {rows.map((item: R, index: number) => (
        <div className="qminimalrow" key={`${item.id || item.variantId || item.sku}-${index}`}>
          <span>{index + 1}</span>
          <span><b>{item.name}</b><small>{[item.floorName, item.roomName, item.sku, item.variantSummary].filter(Boolean).join(" | ")}</small></span>
          <span>{wholeQty(item.qty)} {item.unit}</span><span>{money(item.price)}</span><span>{Number(item.discount || 0)}%</span><span>{item.taxMode === "Non-GST" ? "-" : `${Number(item.gst || 18)}%`}</span><strong>{money(line(item).total)}</strong>
        </div>
      ))}
    </div>
  );
  const summary = () => (
    <div className="qminimalsummary">
      <section><small>TOTAL IN WORDS</small><b>{snap.details?.amountWords || "Amount payable as per the total shown"}</b><h3>Terms & conditions</h3><p>{snap.terms || "Prices are valid until the quotation validity date. Site readiness and required access are the customer's responsibility."}</p></section>
      <aside><p><span>Sub total</span><b>{money(totals.subtotal)}</b></p><p><span>Discount</span><b>- {money(totals.discount)}</b></p><p><span>Taxable value</span><b>{money(totals.taxable)}</b></p><p><span>CGST</span><b>{money(totals.tax / 2)}</b></p><p><span>SGST</span><b>{money(totals.tax / 2)}</b></p><p className="qminimaltotal"><span>Total</span><b>{money(totals.grand)}</b></p><div>Authorised Signatory</div></aside>
    </div>
  );
  const footer = (page: number, count: number) => <footer className="qminimalfoot"><span>{branding.footer || companyName}</span><span>{quote.number}</span><span>{page} / {count}</span></footer>;
  if (compactSinglePage) return (
    <article className="qpaper qminimal" style={{ "--doc-primary": branding.primaryColour || "#2b6cb0" } as CSSProperties}>
      <section>{header()}{table(items)}{summary()}{footer(1, 1)}</section>
    </article>
  );
  const pageCount = chunks.length + 1;
  return (
    <article className="qpaper qminimal" style={{ "--doc-primary": branding.primaryColour || "#2b6cb0" } as CSSProperties}>
      {chunks.map((chunk, index) => <section key={index}>{header(index > 0)}{table(chunk)}{footer(index + 1, pageCount)}</section>)}
      <section>{header(true)}<div className="qminimalsummarytitle"><small>COMMERCIAL SUMMARY</small><h2>{snap.details?.title || "Quotation summary"}</h2><p>{customerName} - {siteName}</p></div>{summary()}{footer(pageCount, pageCount)}</section>
    </article>
  );
}

function quotePdfFormat(snap: R) {
  const manual = snap?.details?.pdfFormat;
  if (manual === "compact") return "compact";
  // Always default to detailed proposal so every quotation includes the complete solution proposal structure
  return "detailed";
}

function Activity({ rows, revisions }: R) {
  return (
    <div className="qactivity">
      <section className="qcard">
        <h2>Revision history</h2>
        {revisions.map((r: R) => (
          <article key={r.id}>
            <b>Revision {r.revision}</b>
            <span>{new Date(r.created_at).toLocaleString("en-IN")}</span>
            <em>{r.pdf_key ? "Permanent PDF saved" : "Snapshot saved"}</em>
          </article>
        ))}
      </section>
      <section className="qcard">
        <h2>Activity timeline</h2>
        {rows.map((r: R) => (
          <article key={r.id}>
            <b>{r.type}</b>
            <span>{r.content}</span>
            <em>
              {r.user_name} · {new Date(r.created_at).toLocaleString("en-IN")}
            </em>
          </article>
        ))}
      </section>
    </div>
  );
}
function Files({ rows }: R) {
  return (
    <section className="qcard">
      <h2>Quote files and generated PDFs</h2>
      {rows.length ? (
        rows.map((x: R) => (
          <article className="qfile" key={x.id}>
            <b>{x.file_name}</b>
            <span>
              {x.kind} · Revision {x.revision}
            </span>
            <a
              href={`/api/quotations/files?key=${encodeURIComponent(x.file_key)}`}
              target="_blank"
            >
              Open
            </a>
          </article>
        ))
      ) : (
        <p>No files saved against this quotation yet.</p>
      )}
    </section>
  );
}
function Totals({ t }: R) {
  return (
    <div className="qtotals">
      <h3>Quotation total</h3>
      <p>
        <span>Subtotal</span>
        <b>{money(t.subtotal)}</b>
      </p>
      <p>
        <span>Discount</span>
        <b>− {money(t.discount)}</b>
      </p>
      <p>
        <span>Taxable</span>
        <b>{money(t.taxable)}</b>
      </p>
      <p>
        <span>GST</span>
        <b>{money(t.tax)}</b>
      </p>
      <p className="grand">
        <span>Grand total</span>
        <b>{money(t.grand)}</b>
      </p>
    </div>
  );
}
const line = (x: R) => {
  const base = Number(x.price || 0) * wholeQty(x.qty),
    discount = (base * Number(x.discount || 0)) / 100,
    taxable = x.optional && x.excluded ? 0 : base - discount,
    tax = x.taxMode === "Non-GST" ? 0 : (taxable * Number(x.gst || 18)) / 100;
  return { base, discount, taxable, tax, total: taxable + tax };
};
const calc = (s: R) => {
  const items = (s?.floors || [])
      .flatMap((f: R) => (f.rooms || []).flatMap((r: R) => r.items || []))
      .concat(s?.projectItems || []),
    r = items.reduce(
      (a: R, x: R) => {
        const y = line(x);
        a.subtotal += y.base;
        a.discount += y.discount;
        a.taxable += y.taxable;
        a.tax += y.tax;
        return a;
      },
      { subtotal: 0, discount: 0, taxable: 0, tax: 0 },
    );
  return { ...r, grand: Math.round((r.taxable + r.tax) * 100) / 100 };
};
