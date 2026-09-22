"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
type R = Record<string, any>;
const money = (n: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));
const wholeQty = (value: any) => Math.max(1, Math.round(Number(value) || 1));
const normalizeQuantities = (snapshot: R) => {
  const normalized = structuredClone(snapshot);
  for (const floor of normalized.floors || [])
    for (const room of floor.rooms || [])
      for (const item of room.items || []) item.qty = wholeQty(item.qty);
  for (const item of normalized.projectItems || []) item.qty = wholeQty(item.qty);
  return normalized;
};
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

export default function QuotationsModule({ role }: { role: string }) {
  const [view, setView] = useState<"list" | "quote">("list"),
    [rows, setRows] = useState<R[]>([]),
    [filters, setFilters] = useState<R>({}),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [selected, setSelected] = useState<number | null>(null),
    [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(
        `/api/quotations?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&page=${page}`,
      ),
      d = await r.json();
    if (r.ok) {
      setRows(d.quotations || []);
      setFilters(d.filters || {});
      setPages(d.pagination?.pages || 1);
    } else setMsg(d.error);
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
      warranty: "Standard Products: 2 Years Full Replacement + 4 Years Service Warranty\nRoyal Edge & Touch Series: 10 Years Full Replacement + 10 Years Service Warranty",
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
    [pdfGenerating, setPdfGenerating] = useState(false);
  const timer = useRef<any>(null);
  const customers = filters.customers || [],
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
    if (!nextCustomerId || !nextSiteId) return;
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
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
            imageTimeout: 10000,
            windowWidth: section.scrollWidth || 794,
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
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
        setCustomerId={(x) => {
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
      <nav>
        {workflowSteps.map((x, index) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            <><b>{index + 1}</b> {x}</>
          </button>
        ))}
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
          <button disabled={stepIndex === 0} onClick={() => moveStep(-1)}>Previous</button>
          <span>Step {stepIndex + 1} of 5</span>
          <button className="primary" disabled={stepIndex === 4} onClick={() => moveStep(1)}>Next</button>
        </div>
      )}
      {picker && (
        <ItemPicker
          target={picker}
          role={role}
          taxMode={snap.taxMode || "GST"}
          close={() => setPicker(null)}
          add={(item) => {
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
          <button onClick={() => setPicker({ floor: 0, room: 0 })}>Add Item</button>
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
}: R) {
  return (
    <div className="newquote">
      <header>
        <button onClick={close}>← Back</button>
        <div>
          <small>NEW QUOTATION</small>
          <h1>Start a persistent draft</h1>
          <p>Customer → Site → Details → Rooms → Items → Payment → Preview</p>
        </div>
      </header>
      <div className="newquotecard">
        <label>
          <span>Customer *</span>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((c: R) => (
              <option value={c.id} key={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </select>
        </label>
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
}: R) {
  const d = snap.details || {},
    change = (k: string, v: any) => set({ ...snap, details: { ...d, [k]: v } }),
    customerSites = (allSites || []).filter(
      (site: R) => String(site.customer_id) === String(customerId),
    );
  return (
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
        <label>
          <span>Customer</span>
          <select
            disabled={locked}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer</option>
            {(customers || []).map((customer: R) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} · {customer.phone}
              </option>
            ))}
          </select>
        </label>
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
      const n = structuredClone(snap);
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
                        onClick={() => openPicker({ floor: fi, room: ri })}
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
                    return <article className="qitemcard" key={itemKey}>
                    <div className="qitem">
                      <img src={x.image || "/techomie-logo.jpg"} alt="" />
                      <span>
                        <b>
                          {x.name}
                          {x.technology && <span className="item-pill-badge tech">{x.technology}</span>}
                          {x.material && <span className="item-pill-badge mat">{x.material}</span>}
                          {x.module && <span className="item-pill-badge mod">{x.module}M</span>}
                        </b>
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
                        Rate
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
                          <button title="Edit item" onClick={() => setEditingItem(editingItem === itemKey ? "" : itemKey)}>Edit</button>
                          <button className="danger" title="Remove item" onClick={() => mut((n) => n.floors[fi].rooms[ri].items.splice(ii, 1))}>×</button>
                        </div>
                      )}
                    </div>
                    {editingItem === itemKey && <div className="qitemedit">
                      {Array.isArray(x.availableVariants) && x.availableVariants.length > 1 && (
                        <div className="qitemeditvariantbox">
                          <h4>Switch Variant Selection (Technology & Material)</h4>
                          <div className="qitemeditvariantrows">
                            <div className="variantgroup">
                              <span className="variantgrouplabel">Technology</span>
                              <div className="variantpills">
                                {SMART_SWITCH_TECHNOLOGIES.map(t => {
                                  const isAvail = x.availableVariants.some((v: R) => v.technology === t.id);
                                  const isSelected = x.technology === t.id;
                                  return (
                                    <button
                                      key={t.id}
                                      type="button"
                                      className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                      disabled={!isAvail}
                                      onClick={() => {
                                        const match = x.availableVariants.find((v: R) => v.technology === t.id && v.material === x.material)
                                                   || x.availableVariants.find((v: R) => v.technology === t.id);
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
                                            it.variantSummary = `${match.technology} · ${match.material}${it.module ? ` · ${it.module} Module` : ""}`;
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
                                  const isAvail = x.availableVariants.some((v: R) => v.material === m.id);
                                  const isSelected = x.material === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className={`variantpill ${isSelected ? "active" : ""} ${!isAvail ? "disabled" : ""}`}
                                      disabled={!isAvail}
                                      onClick={() => {
                                        const match = x.availableVariants.find((v: R) => v.material === m.id && v.technology === x.technology)
                                                   || x.availableVariants.find((v: R) => v.material === m.id);
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
                                            it.variantSummary = `${match.technology} · ${match.material}${it.module ? ` · ${it.module} Module` : ""}`;
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
                          </div>
                        </div>
                      )}
                      <label><span>Item title</span><input value={x.name || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].name = e.target.value)} /></label>
                      <label><span>Unit</span><input value={x.unit || "Nos"} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].unit = e.target.value)} /></label>
                      <label><span>GST rate %</span><input type="number" disabled={(snap.taxMode || "GST") === "Non-GST"} value={x.gst || 0} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].gst = Number(e.target.value))} /></label>
                      <label><span>Warranty</span><input value={x.warranty || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].warranty = e.target.value)} /></label>
                      <label className="wide"><span>Description</span><textarea value={x.description || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].description = e.target.value)} /></label>
                      <label className="wide"><span>Line note / exclusions</span><textarea value={x.note || ""} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].note = e.target.value)} /></label>
                      <label className="qitemcheck"><input type="checkbox" checked={!!x.optional} onChange={(e) => mut((n) => n.floors[fi].rooms[ri].items[ii].optional = e.target.checked)} /><span>Optional item</span></label>
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
                mut((n) =>
                  n.floors[adding.floor!].rooms.push({
                    name,
                    note: "",
                    items: [],
                  }),
                );
              else
                mut((n) =>
                  n.floors.push({
                    name,
                    rooms: [{ name: "Room", note: "", items: [] }],
                  }),
                );
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
    [model, setModel] = useState(""),
    [technology, setTechnology] = useState(""),
    [material, setMaterial] = useState(""),
    [added, setAdded] = useState(0),
    [showCustom, setShowCustom] = useState(false),
    [custom, setCustom] = useState<R>({ name: "", description: "", qty: 1, unit: "Nos", price: 0, discount: 0, gst: 18, warranty: "", note: "" }),
    [modelSelections, setModelSelections] = useState<Record<string, { technology?: string; material?: string; qty?: number }>>({});

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const query = encodeURIComponent(q);
      const catParam = category ? `&category=${encodeURIComponent(category)}` : "";
      const limitParam = category === "Smart switches" ? 1000 : 500;
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
    return {
      ...item,
      parsedAttributes: attrs,
      normTech,
      normMat,
    };
  });

  const categories = [
    "Smart switches",
    "Smart doorlocks",
    "Security system",
    "Gate automation",
    "Smart curtains",
    "Others",
  ];

  const switchModelsMap = new Map<string, R>();
  const regularItems: R[] = [];

  for (const item of parsed) {
    const isSwitch = item.category === "Smart switches";
    if (!isSwitch) {
      regularItems.push(item);
      continue;
    }
    const mod = item.parsedAttributes.module || "std";
    const key = `${item.name}__${item.series || ""}__${mod}`;
    if (!switchModelsMap.has(key)) {
      const displayName = /^noviq\s/i.test(item.name)
        ? item.name
        : (item.brand === "Noviq" || item.brand === "Noviq OEM" ? `Noviq ${item.name}` : item.name);
      switchModelsMap.set(key, {
        key,
        productId: item.product_id,
        name: displayName,
        rawName: item.name,
        brand: item.brand,
        category: item.category,
        series: item.series,
        module: item.parsedAttributes.module || "",
        shortDescription: item.short_description || item.description,
        description: item.description,
        unit: item.unit || "Nos",
        defaultTax: item.tax_rate || item.default_tax || 18,
        defaultWarranty: item.warranty || item.default_warranty || "",
        image: item.image_key,
        variants: [],
      });
    }
    const m = switchModelsMap.get(key)!;
    if (!m.image && item.image_key) m.image = item.image_key;
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

  const filteredSwitchModels = allSwitchModels.filter((m) => {
    if (category && category !== "Smart switches") return false;
    if (model && m.key !== model && String(m.productId) !== model) return false;
    if (technology) {
      const hasTech = m.variants.some((v: R) => v.normTech === technology);
      if (!hasTech) return false;
    }
    if (material) {
      const hasMat = m.variants.some((v: R) => v.normMat === material);
      if (!hasMat) return false;
    }
    return true;
  });

  const filteredRegularItems = regularItems.filter((item) => {
    if (category && item.category !== category) return false;
    if (model && String(item.product_id) !== model) return false;
    if (technology && item.normTech !== technology && item.parsedAttributes.technology !== technology) return false;
    if (material && item.normMat !== material && item.parsedAttributes.material !== material && item.parsedAttributes.finish !== material) return false;
    return true;
  });

  const addAndContinue = (item: R) => { add(item); setAdded((count) => count + 1); };

  return (
    <div className="modalback">
      <div className="itemdrawer">
        <header>
          <div>
            <small>ITEMS MASTER</small>
            <h2>Add item to selected room</h2>
          </div>
          <div className="itemdrawerclose">
            <span>{added ? `${added} item${added === 1 ? "" : "s"} added` : "Add multiple items, then close"}</span>
            <button onClick={close}>Done ×</button>
          </div>
        </header>

        <input
          className="itemsearch"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search switch model, gang size, brand, SKU or category..."
        />

        <div className="itempickerfilters">
          <select value={category} onChange={(e) => { setCategory(e.target.value); setModel(""); setTechnology(""); setMaterial(""); }}>
            <option value="">All categories</option>
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
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
              {/* Render Smart Switch models with interactive Technology & Material option pills */}
              {filteredSwitchModels.map((m) => {
                const curSel = modelSelections[m.key] || {};
                const chosenTech = curSel.technology || technology || "Wi-Fi";
                const chosenMat = curSel.material || material || "Acrylic";

                const availableTechs = new Set(m.variants.map((v: R) => v.normTech));
                const availableMats = new Set(m.variants.map((v: R) => v.normMat));

                let activeVariant = m.variants.find((v: R) => v.normTech === chosenTech && v.normMat === chosenMat);
                if (!activeVariant) activeVariant = m.variants.find((v: R) => v.normTech === chosenTech);
                if (!activeVariant) activeVariant = m.variants.find((v: R) => v.normMat === chosenMat);
                if (!activeVariant) activeVariant = m.variants[0];

                const qty = curSel.qty || 1;
                const currentPrice = Number(activeVariant.selling_price || 0);
                const currentCost = Number(activeVariant.purchase_cost || 0);

                return (
                  <article key={m.key} className="switchmodelcard">
                    <div className="switchmodelhead">
                      <img src={activeVariant.image_key || m.image || "/techomie-logo.jpg"} alt={m.name} />
                      <div className="switchmodeldetails">
                        <small>{m.brand} · {m.category}{m.series ? ` · ${m.series}` : ""}</small>
                        <b>{m.name || activeVariant.name || activeVariant.sku || "Smart Switch"}</b>
                        {m.module && <span className="modulebadge">{m.module} Module Panel</span>}
                        {m.shortDescription && <p>{m.shortDescription}</p>}
                      </div>
                    </div>

                    <div className="variantoptionscontainer">
                      <div className="variantgroup">
                        <span className="variantgrouplabel">Technology Option</span>
                        <div className="variantpills">
                          {SMART_SWITCH_TECHNOLOGIES.map((t) => {
                            const isAvail = availableTechs.has(t.id);
                            const isSelected = activeVariant.normTech === t.id;
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
                            const isAvail = availableMats.has(mat.id);
                            const isSelected = activeVariant.normMat === mat.id;
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
                              sku: activeVariant.sku,
                              image: activeVariant.image_key || m.image,
                              description: m.shortDescription || m.description || m.name,
                              technicalNotes: "",
                              technology: activeVariant.normTech,
                              material: activeVariant.normMat,
                              module: m.module,
                              variantSummary: `${activeVariant.normTech} · ${activeVariant.normMat}${m.module ? ` · ${m.module} Module` : ""}`,
                              availableVariants: m.variants.map((v: R) => ({
                                variantId: v.variant_id,
                                productId: v.product_id,
                                sku: v.sku,
                                technology: v.normTech,
                                material: v.normMat,
                                price: Number(v.selling_price),
                                purchaseCost: Number(v.purchase_cost || 0),
                                taxRate: Number(v.tax_rate || 18),
                                warranty: v.warranty || "",
                                image: v.image_key,
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
                    <img src={x.image_key || "/techomie-logo.jpg"} alt="" />
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
                            image: x.image_key,
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
                  <img src={x.image || "/techomie-logo.jpg"} alt="" />
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
        <p>{snap.warranty}</p>
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
    detailed = pdfFormat === "detailed",
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

  const paginateFloor = (floor: R) => {
    const pages: R[] = [];
    let currentPageRooms: R[] = [];
    let currentUsed = 0;
    // Guaranteed room budget: 192mm accommodates up to 10 items + floor summary on a single A4 page
    const getBudget = (isFirst: boolean) => 192;

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
        const cost = 24;
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
        // Room header (12mm) + table thead (8mm) + subtotal (6mm) = 26mm (chunk 0)
        // Continued chunk: banner (10mm) + thead (8mm) + subtotal (6mm) = 24mm
        const overhead = chunkIdx === 0 ? 26 : 24;
        const itemHeight = 14; // Compact product photo + single-line title & specs

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

    const floorSummaryCost = 28;
    const finalBudget = getBudget(pages.length === 0);
    if (currentPageRooms.length && currentUsed + floorSummaryCost <= finalBudget) {
      pages.push({ rooms: currentPageRooms, hasFloorSummary: true });
    } else {
      if (currentPageRooms.length) {
        pages.push({ rooms: currentPageRooms, hasFloorSummary: false });
      }
      pages.push({ rooms: [], hasFloorSummary: true });
    }

    return pages.length ? pages : [{ rooms: [], hasFloorSummary: true }];
  };

  const scopePages = floors.flatMap((floor: R, floorIndex: number) => {
    const pages = paginateFloor(floor);
    return pages.map((page: R, pageIndex: number) => ({
      floor,
      floorIndex,
      pageIndex,
      pageCount: pages.length,
      rooms: page.rooms,
      hasFloorSummary: page.hasFloorSummary,
    }));
  });

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
            <small>SMART DEVICES. BETTER LIVING.</small>
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
            <small>PROJECT / SITE LOCATION</small>
            <b>
              {siteName}, {quote.city || "Tamil Nadu"}
            </b>
          </span>
          <span>
            <small>PROPOSAL VALIDITY</small>
            <b>{validity}</b>
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
          <span>TECHOMIE</span>
          <small>SMART HOME | SECURITY | AUTOMATION</small>
        </footer>
      </section>

      {/* PAGE 2: PROJECT OVERVIEW + SYSTEM SUMMARY */}
      {detailed && (
        <section className="qintro">
          {head("PROPOSAL OVERVIEW")}
          <div className="qintrohero">
            <small>DESIGNED AROUND YOUR SPACE</small>
            <h2>
              A smarter property,
              <br />
              <span>thoughtfully designed.</span>
            </h2>
            <p>
              {snap.details?.introduction ||
                "Techomie delivers premium modular automation engineered for seamless control, elegance, and peace of mind. Every room is custom-configured with dedicated touch interfaces, scene logic, and responsive lighting control."}
            </p>
          </div>
          <div className="qpdfcards">
            <article>
              <small>CLIENT DETAILS</small>
              <b>{customerName}</b>
              <span>
                {snap.details?.contactName || quote.phone || quote.contact_phone || "Contact on record"}
              </span>
            </article>
            <article>
              <small>PROJECT / SITE ADDRESS</small>
              <b>{siteName}</b>
              <span>
                {snap.details?.installationAddress ||
                  [quote.site_address, quote.city, quote.state, quote.pincode]
                    .filter(Boolean)
                    .join(", ")}
              </span>
            </article>
            <article>
              <small>SYSTEM HIGHLIGHTS</small>
              <b>{snap.details?.quoteType || "Complete Home Automation"}</b>
              <span>
                {floors.length} Floors · {rooms.length} Automated Areas
              </span>
            </article>
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
          <div className="qnextstep">
            <b>Proposed Automation Scope Summary</b>
            <span>
              {floors
                .map(
                  (f: R) =>
                    `${f.name} (${(f.rooms || []).map((r: R) => r.name).join(", ")})`,
                )
                .join(" · ")}
            </span>
          </div>
          {foot("Proposal overview")}
        </section>
      )}

      {/* PAGE 3: SMART LIVING EXPERIENCE & WHAT YOU CAN DO */}
      {detailed && (
        <section className="qpaperexperience">
          {head("SMART LIVING EXPERIENCE")}
          <div className="qsectiontitle">
            <small>LIFESTYLE &amp; SYSTEM CAPABILITIES</small>
            <h2>What You Can Do With Your Techomie Smart Home</h2>
            <span>Everyday convenience, intelligent automation &amp; effortless control</span>
          </div>

          <div className="qexperiencegrid">
            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">01</span>
                <div>
                  <b>Worldwide Mobile App Control</b>
                  <small>Techomie Smart Life (iOS &amp; Android)</small>
                </div>
              </div>
              <p>
                Control any light, fan, curtain, or appliance from anywhere in the world. Turn on the bedroom AC or geyser 15 minutes before reaching home, or verify all lights are off from bed or while traveling.
              </p>
              <div className="qexpactions">
                <span>Multi-user family sharing</span>
                <span>•</span>
                <span>Real-time feedback</span>
                <span>•</span>
                <span>Anywhere cloud access</span>
              </div>
            </article>

            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">02</span>
                <div>
                  <b>Hands-Free Voice Automation</b>
                  <small>Amazon Alexa &amp; Google Assistant</small>
                </div>
              </div>
              <p>
                Control rooms without lifting a finger: <i>&ldquo;Alexa, turn on Movie Mode&rdquo;</i> dims lights and closes curtains. <i>&ldquo;Hey Google, Good Night&rdquo;</i> turns off all floor lights without leaving bed.
              </p>
              <div className="qexpactions">
                <span>Echo &amp; Nest compatible</span>
                <span>•</span>
                <span>Natural speech recognition</span>
                <span>•</span>
                <span>Hands-free comfort</span>
              </div>
            </article>

            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">03</span>
                <div>
                  <b>Personalized Mood Scenes</b>
                  <small>Capacitive Wall Panels &amp; Mobile Presets</small>
                </div>
              </div>
              <p>
                Switch between tailored lighting ambiances with a single touch on the wall panel or mobile app. Create predefined scenes for Dinner, Party, Reading, Focus, or Relaxing evenings with smooth dimming.
              </p>
              <div className="qexpactions">
                <span>4 custom scene buttons per room</span>
                <span>•</span>
                <span>Warm cove &amp; chandelier dimming</span>
              </div>
            </article>

            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">04</span>
                <div>
                  <b>Astronomical Timers &amp; Schedules</b>
                  <small>Automated Astronomical Clock</small>
                </div>
              </div>
              <p>
                Outdoor gate, façade, and garden lights automatically illuminate at sunset and switch off at dawn. Geysers automatically shut off after 20 minutes to conserve power and prevent burnout.
              </p>
              <div className="qexpactions">
                <span>Dusk-to-dawn exterior automation</span>
                <span>•</span>
                <span>Scheduled morning wake-up curtains</span>
              </div>
            </article>

            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">05</span>
                <div>
                  <b>Central Master &ldquo;All-Off&rdquo; &amp; Away</b>
                  <small>Whole-Home Central Efficiency</small>
                </div>
              </div>
              <p>
                A single tap on the exit switch near the main entrance powers down all non-essential lights, fans, and ACs across all floors. Bedside master switch lets you put the home to sleep without walking around.
              </p>
              <div className="qexpactions">
                <span>Main entrance one-touch exit</span>
                <span>•</span>
                <span>Bedside master all-off switch</span>
              </div>
            </article>

            <article className="qexpcard">
              <div className="qexphead">
                <span className="qexpnum">06</span>
                <div>
                  <b>Offline Reliability &amp; Zero Rewiring</b>
                  <small>Local Wireless Mesh &amp; Retrofit</small>
                </div>
              </div>
              <p>
                Directly retrofits into standard backboxes without cutting walls or repainting. If home Wi-Fi or broadband is temporarily down, physical touch panels and local scenes continue functioning 100% locally.
              </p>
              <div className="qexpactions">
                <span>100% manual touch fallback</span>
                <span>•</span>
                <span>Zero plaster cutting or rewiring</span>
              </div>
            </article>
          </div>

          <div className="qscenesbanner">
            <div className="qsceneshead">
              <b>DAY IN THE LIFE: PRE-CONFIGURED LIFESTYLE AUTOMATIONS INCLUDED</b>
              <span>Tailored and programmed by Techomie during commissioning</span>
            </div>
            <div className="qscenesgrid">
              <div className="qscenecol">
                <b>07:00 AM · Good Morning</b>
                <p>Curtains glide open to natural sunlight, water heater powers on, and warm kitchen lights turn on automatically.</p>
              </div>
              <div className="qscenecol">
                <b>09:30 AM · Departure / Away</b>
                <p>One touch on the main entrance panel shuts off all lights, fans, and ACs across all floors and locks gates securely.</p>
              </div>
              <div className="qscenecol">
                <b>07:30 PM · Evening / Relax</b>
                <p>Living room lights dim to warm cove, motorized curtains close, and television media socket turns on.</p>
              </div>
              <div className="qscenecol">
                <b>11:00 PM · Goodnight</b>
                <p>Bedside switch turns off all interior lights while keeping exterior security lights and boundary radars active.</p>
              </div>
            </div>
          </div>

          {foot("Smart Living Experience & Capabilities")}
        </section>
      )}

      {/* PAGES 3+: FLOOR-WISE & ROOM-WISE BOQ */}
      {scopePages.map((scope: R, pIdx: number) => {
        const floorTotal = (scope.floor.rooms || []).reduce(
          (fAcc: number, r: R) =>
            fAcc +
            (r.items || []).reduce(
              (rAcc: number, it: R) => rAcc + (it.optional ? 0 : line(it).total),
              0,
            ),
          0,
        );

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
              const roomSubtotal = (room.items || []).reduce(
                (acc: number, it: R) => acc + (it.optional ? 0 : line(it).total),
                0,
              );

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
                    <thead>
                      <tr>
                        <th style={{ width: "28px", textAlign: "center" }}>S.NO</th>
                        <th style={{ width: "76px", textAlign: "center" }}>PHOTO</th>
                        <th style={{ textAlign: "left" }}>PRODUCT / MODULE &amp; SPECIFICATIONS</th>
                        <th style={{ width: "36px", textAlign: "center" }}>QTY</th>
                        <th style={{ width: "38px", textAlign: "center" }}>UNIT</th>
                        <th style={{ width: "72px", textAlign: "right" }}>RATE</th>
                        <th style={{ width: "42px", textAlign: "center" }}>DISC.</th>
                        <th style={{ width: "82px", textAlign: "right" }}>AMOUNT</th>
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
                                <img src={item.image || logo} alt="" />
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
                                {item.technology && (
                                  <span className="item-pill-badge tech">
                                    {item.technology}
                                  </span>
                                )}
                                {item.material && (
                                  <span className="item-pill-badge mat">
                                    {item.material}
                                  </span>
                                )}
                                {item.module && (
                                  <span className="item-pill-badge mod">
                                    {item.module}
                                  </span>
                                )}
                                {getItemFeatureTag(item) && (
                                  <span className="item-pill-badge feature">
                                    ✦ {getItemFeatureTag(item)}
                                  </span>
                                )}
                                {item.sku && <span className="qitemsku">{item.sku}</span>}
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
                      {room.isChunkEnd && (
                        <tr className="qboqsubtotalrow">
                          <td
                            colSpan={7}
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#334155",
                              paddingRight: "8px",
                            }}
                          >
                            {room.name} Total:
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 800 }}>
                            <strong>{money(roomSubtotal)}</strong>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Floor Summary Card placed on the final page of this floor */}
            {scope.hasFloorSummary && (
              <div className="qfloorsummarybox">
                <div className="qfloorsummaryhead">
                  <span>{scope.floor.name.toUpperCase()} AREA / ROOM BREAKDOWN</span>
                  <span>AMOUNT (INR)</span>
                </div>
                {(scope.floor.rooms || []).map((r: R, rIdx: number) => {
                  const rTot = (r.items || []).reduce(
                    (acc: number, it: R) => acc + (it.optional ? 0 : line(it).total),
                    0,
                  );
                  return (
                    <div className="qfloorsummaryrow" key={rIdx}>
                      <span>
                        {r.name} ({(r.items || []).length} configured items)
                      </span>
                      <b>{money(rTot)}</b>
                    </div>
                  );
                })}
                <div className="qfloorsummarytotal">
                  <span>{scope.floor.name} Total</span>
                  <strong>{money(floorTotal)}</strong>
                </div>
              </div>
            )}

            {foot(
              `${scope.floor.name} scope${scope.pageCount > 1 ? ` · Page ${scope.pageIndex + 1}/${scope.pageCount}` : ""}`,
            )}
          </section>
        );
      })}

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
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Area / Scope Description</th>
                <th style={{ width: "60px", textAlign: "center" }}>Rooms</th>
                <th style={{ width: "60px", textAlign: "center" }}>Items</th>
                <th style={{ width: "110px", textAlign: "right" }}>Investment</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((f: R, fIdx: number) => {
                const fTotal = (f.rooms || []).reduce(
                  (fAcc: number, r: R) =>
                    fAcc +
                    (r.items || []).reduce(
                      (rAcc: number, it: R) => rAcc + (it.optional ? 0 : line(it).total),
                      0,
                    ),
                  0,
                );
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
                    <td style={{ textAlign: "right" }}>
                      <b>{money(fTotal)}</b>
                    </td>
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
                  <td style={{ textAlign: "right" }}>
                    <b>
                      {money(
                        snap.projectItems.reduce(
                          (acc: number, it: R) => acc + (it.optional ? 0 : line(it).total),
                          0,
                        ),
                      )}
                    </b>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="qcommercialbreakdown">
          <div className="qcalcrows">
            <div className="qcalcrow">
              <span>Product &amp; System Subtotal</span>
              <b>{money(totals.subtotal)}</b>
            </div>
            {totals.discount > 0 && (
              <div className="qcalcrow qdiscountrow">
                <span>Special Project Discount</span>
                <b>- {money(totals.discount)}</b>
              </div>
            )}
            <div className="qcalcrow qtaxablerow">
              <span>Net Taxable Value</span>
              <b>{money(totals.taxable)}</b>
            </div>
            {snap.taxMode !== "Non-GST" && (
              <>
                <div className="qcalcrow">
                  <span>CGST (9%)</span>
                  <b>{money(totals.tax / 2)}</b>
                </div>
                <div className="qcalcrow">
                  <span>SGST (9%)</span>
                  <b>{money(totals.tax / 2)}</b>
                </div>
              </>
            )}
            <div className="qcalcrow qgrandtotalrow">
              <div>
                <span>Grand Total (All Inclusive)</span>
                <small>
                  {snap.taxMode === "Non-GST"
                    ? "Non-GST Commercial Total"
                    : "Includes 18% GST"}
                </small>
              </div>
              <strong>{money(totals.grand)}</strong>
            </div>
            <div className="qwordsamount">
              <span>AMOUNT IN WORDS: </span>
              {inWords(totals.grand)}
            </div>
          </div>

          <aside className="qcommercialnotes">
            <small>COMMERCIAL ASSURANCES</small>
            <ul>
              <li>Prices apply to the exact configurations, modules, and quantities listed in this proposal.</li>
              <li>GST input tax credit is claimable against valid GSTIN invoice provided prior to dispatch.</li>
              <li>Changes to scope, finishes, technology, or site conditions will be formalized in a revised quotation.</li>
              <li>Execution commences upon written confirmation and receipt of the applicable project advance.</li>
            </ul>
          </aside>
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
                  { name: "Advance", percent: 20, condition: "Order confirmation & procurement" },
                  { name: "Procurement", percent: 60, condition: "On arrival of hardware / dispatch" },
                  { name: "Handover", percent: 20, condition: "Testing, commissioning & handover" },
                ]
            ).map((m: R, index: number) => (
              <article key={m.name || index}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <small>{m.percent}% MILESTONE</small>
                  <b>{m.name}</b>
                  <em>{m.condition}</em>
                </span>
                <strong>
                  {money((totals.grand * Number(m.percent || 0)) / 100)}
                </strong>
              </article>
            ))}
          </div>
        </div>

        {/* COMMERCIAL TERMS */}
        <div className="qcommercialtermsbox">
          <small>TERMS &amp; CONDITIONS</small>
          <p>
            {snap.terms ||
              "1. Quotation validity is 30 calendar days from the date of issue. 2. Delivery lead time is 2 to 3 weeks upon receipt of confirmed advance. 3. Taxes are charged in accordance with Indian GST regulations. 4. Techomie reserves the right to revise commercial quotes if the floor plan or room switchboard point count changes during execution."}
          </p>
        </div>

        {foot("Commercial & Payment Terms")}
      </section>

      {/* EXECUTION STANDARDS, WARRANTY & SIGN-OFF PAGE */}
      <section className="qpaperterms qpaperclosing">
        {head("EXECUTION & SIGN-OFF")}
        <div className="qsectiontitle">
          <small>STANDARDS, WARRANTY &amp; ACCEPTANCE</small>
          <h2>Installation Scope, Warranty &amp; Customer Sign-Off</h2>
          <span>Standard Operating Procedures &amp; Official Authorization</span>
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

        {/* Scope of Work & Prerequisites */}
        <div className="qscopetwocol">
          <article className="qscopebox">
            <small>TECHOMIE SCOPE OF WORK</small>
            <ul>
              <li>Supply of genuine smart touch switches, gateways, sensors, and controllers.</li>
              <li>Precision retrofitting and termination in existing or new switch backboxes.</li>
              <li>Wireless mesh (Zigbee / Wi-Fi) pairing for zero-latency point response.</li>
              <li>Setup of Techomie Mobile App on client smartphones (iOS &amp; Android).</li>
              <li>Integration with voice assistants (Amazon Alexa &amp; Google Home).</li>
              <li>Programming smart routines: Morning Wakeup, Cinema Mode, All-Off &amp; Away.</li>
              <li>Full system live demonstration, handover, and user guidance.</li>
            </ul>
          </article>

          <article className="qscopebox">
            <small>CLIENT SITE PREREQUISITES</small>
            <ul>
              <li>Standard metal or PVC switch backboxes with adequate depth.</li>
              <li><b>Mandatory Neutral Line:</b> Neutral wire must be present in every switchboard.</li>
              <li>Continuous, stable 2.4 GHz Wi-Fi broadband router powered on at the premises.</li>
              <li>Carpenter coordination for wooden door mortise preparation for smart locks.</li>
              <li>Welding / fabricator support on site for gate motor bracket mounting and alignment.</li>
              <li>Uninterrupted AC power supply during installation and testing phases.</li>
            </ul>
          </article>
        </div>

        <div className="qexclusionbar">
          <small>EXCLUSIONS:</small>
          <span>Civil masonry, conduit chasing, repainting, structural wall cutting, or main electrical meter wiring.</span>
        </div>

        {/* Warranty Assurance Cards */}
        <div className="qwarrantygrid">
          <article className="qwarrantycard">
            <div className="qwarrantybadge">2Y + 4Y</div>
            <div>
              <small>STANDARD SMART PRODUCTS</small>
              <b>2 Years Full Replacement + 4 Years Service Warranty</b>
              <p>
                Covers smart touch switches, dimmers, fan controllers, curtain modules, and gateway hubs against manufacturing and electronic defects.
              </p>
            </div>
          </article>

          <article className="qwarrantycard gold">
            <div className="qwarrantybadge">10Y + 10Y</div>
            <div>
              <small>ROYAL EDGE &amp; TOUCH SERIES</small>
              <b>10 Years Full Replacement + 10 Years Service Warranty</b>
              <p>
                Exclusive 10+10 warranty for Royal Edge CNC panels and touch series glass switches with complimentary priority onsite service visits.
              </p>
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
          <span><b>Consultant:</b> {snap.details?.quotationByName || quote.sales_name || quote.created_name || "Techomie Sales Team"}</span>
          <span><b>Helpline:</b> +91 90470 12345 · <b>Web:</b> www.techomie.com</span>
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
          <p>{address || company.registeredAddress || "Coimbatore, Tamil Nadu"}</p>
          <p>{[company.gstin && `GSTIN ${company.gstin}`, company.phone, company.email, company.website].filter(Boolean).join(" | ")}</p>
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
  if (manual === "detailed" || manual === "compact") return manual;
  const rooms = (snap?.floors || []).flatMap((f: R) => f.rooms || []);
  const items = rooms.flatMap((r: R) => r.items || []);
  // Small quotes with few items (<= 10 items and <= 2 rooms) auto-select clean compact quotation
  if (rooms.length <= 2 && items.length <= 10) return "compact";
  return ["Full Smart Home Proposal", "Detailed Smart Home Proposal"].includes(snap?.details?.quoteType) || rooms.length > 2 || items.length > 10
    ? "detailed"
    : "compact";
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
  const items = (s.floors || [])
      .flatMap((f: R) => f.rooms.flatMap((r: R) => r.items || []))
      .concat(s.projectItems || []),
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
