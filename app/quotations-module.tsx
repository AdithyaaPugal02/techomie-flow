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
        <div className="qrow qhead">
          <span>Quote</span>
          <span>Customer / Site</span>
          <span>Date / Validity</span>
          <span>Salesperson</span>
          <span>Total</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {rows.map((x) => (
          <div className="qrow" key={x.id} onClick={() => open(x.id)}>
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
function QuoteWorkspace({
  id,
  role,
  filters,
  close,
  notify,
  onCreated,
}: {
  id: number | null;
  role: string;
  filters: R;
  close: () => void;
  notify: (s: string) => void;
  onCreated: (id: number) => void;
}) {
  const [quote, setQuote] = useState<R | null>(null),
    [snap, setSnap] = useState<R>({
      details: {
        title: "",
        quoteType: "Full Smart Home Proposal",
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
        { name: "Advance", percent: 20, condition: "Order confirmation" },
        { name: "Procurement", percent: 60, condition: "Before procurement" },
        { name: "Handover", percent: 20, condition: "Customer handover" },
      ],
      terms: "",
      warranty: "",
      taxMode: "GST",
    }),
    [tab, setTab] = useState("Details"),
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
    [branding, setBranding] = useState<R>({});
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
      setSnap(d.quotation.snapshot);
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
    clearTimeout(timer.current);
    await persist();
    setTab("Preview");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const el = document.querySelector(".qpaper") as HTMLElement | null;
    if (!el) return notify("PDF preview could not be prepared");
    await document.fonts?.ready;
    await Promise.all(
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
    if (download) {
        const html2pdf = (await import("html2pdf.js")).default;
        const filename =
          `${quote?.number || "Quotation"}-Rev-${quote?.revision || 0}-${quote?.customer_name || "Customer"}.pdf`.replace(
            /[^a-z0-9.-]+/gi,
            "-",
          );
        const blob = await html2pdf()
          .set({
            filename,
            margin: 0,
            image: { type: "png", quality: 1 },
            html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff", imageTimeout: 20000 },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"] },
          })
          .from(el)
          .outputPdf("blob");
        const form = new FormData();
        form.set("quotationId", String(quote.id));
        form.set("revision", String(quote.revision || 0));
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
        const saved = await fetch("/api/quotations/files", {
          method: "POST",
          body: form,
        });
        if (!saved.ok)
          notify("PDF downloaded, but permanent file storage failed");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        await load();
    } else window.print();
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
          <button onClick={() => pdf(false)}>Preview</button>
          <button onClick={() => pdf(true)}>Download PDF</button>
          {!locked && <button onClick={persist}>Save draft</button>}
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
          {role === "admin" &&
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
          {role === "admin" && quote.status === "Accepted" && (
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
        </div>
      </header>
      <nav>
        {[
          "Details",
          "Scope & Items",
          "Payment & Terms",
          "Preview",
          "Activity",
          "Files",
        ].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </nav>
      <main>
        {tab === "Details" ? (
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
        ) : tab === "Scope & Items" ? (
          <Builder
            snap={snap}
            set={change}
            locked={locked}
            openPicker={setPicker}
          />
        ) : tab === "Payment & Terms" ? (
          <Payment
            snap={snap}
            set={change}
            total={totals.grand}
            locked={locked}
          />
        ) : tab === "Preview" ? (
          <QuotePaperPremium
            quote={quote}
            snap={snap}
            totals={totals}
            branding={branding}
          />
        ) : tab === "Activity" ? (
          <Activity rows={activity} revisions={revisions} />
        ) : (
          <Files rows={files} />
        )}
      </main>
      {tab !== "Preview" && (
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
        <button onClick={() => pdf(false)}>Preview PDF</button>
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
            {[
              "Full Smart Home Proposal",
              "Standard Product Quotation",
              "CCTV / Networking Quotation",
              "Gate Automation Quotation",
              "Service Estimate",
            ].map((x) => (
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
          <select disabled={locked} value={d.quoteType || quote.quote_type || "Standard Product Quotation"} onChange={(e) => change("quoteType", e.target.value)}>
            {["Full Smart Home Proposal","Standard Product Quotation","CCTV / Networking Quotation","Gate Automation Quotation","Service Estimate","Custom Quotation"].map((value) => <option key={value}>{value}</option>)}
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
                        <b>{x.name}</b>
                        <small>
                          {x.brand} · {x.sku} · {x.variantSummary || ""}
                        </small>
                      </span>
                      <label>
                        Qty
                        <input
                          disabled={locked}
                          type="number"
                          min=".01"
                          value={x.qty}
                          onChange={(e) =>
                            mut(
                              (n) =>
                                (n.floors[fi].rooms[ri].items[ii].qty = Number(
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
    [category, setCategory] = useState(""),
    [model, setModel] = useState(""),
    [technology, setTechnology] = useState(""),
    [material, setMaterial] = useState(""),
    [added, setAdded] = useState(0),
    [showCustom, setShowCustom] = useState(false),
    [custom, setCustom] = useState<R>({ name: "", description: "", qty: 1, unit: "Nos", price: 0, discount: 0, gst: 18, warranty: "", note: "" });
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(
          `/api/products?q=${encodeURIComponent(q)}&page=1&limit=100&active=active`,
        ),
        d = await r.json();
      if (r.ok) setItems(d.items || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  const parsed = items.map((item) => ({
      ...item,
      parsedAttributes: typeof item.attributes === "string" ? JSON.parse(item.attributes || "{}") : item.attributes || {},
    })),
    categories = [...new Set(parsed.map((item) => item.category).filter(Boolean))].sort(),
    categoryItems = parsed.filter((item) => !category || item.category === category),
    models = [...new Map(categoryItems.map((item) => [String(item.product_id), { id: String(item.product_id), name: item.name }])).values()].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    modelItems = categoryItems.filter((item) => !model || String(item.product_id) === model),
    technologies = [...new Set(modelItems.map((item) => item.parsedAttributes.technology).filter(Boolean))].sort(),
    materials = [...new Set(modelItems.flatMap((item) => [item.parsedAttributes.material, item.parsedAttributes.finish]).filter(Boolean))].sort(),
    visibleItems = parsed.filter((item) =>
      (!category || item.category === category) &&
      (!model || String(item.product_id) === model) &&
      (!technology || item.parsedAttributes.technology === technology) &&
      (!material || item.parsedAttributes.material === material || item.parsedAttributes.finish === material),
    );
  const addAndContinue = (item: R) => { add(item); setAdded((count) => count + 1); };
  return (
    <div className="modalback">
      <div className="itemdrawer">
        <header>
          <div>
            <small>ITEMS MASTER</small>
            <h2>Add item to selected room</h2>
          </div>
          <div className="itemdrawerclose"><span>{added ? `${added} item${added === 1 ? "" : "s"} added` : "Add multiple items, then close"}</span><button onClick={close}>Done ×</button></div>
        </header>
        <input
          className="itemsearch"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product, brand, model, SKU, category or technology"
        />
        <div className="itempickerfilters">
          <select value={category} onChange={(e) => {setCategory(e.target.value);setModel("");setTechnology("");setMaterial("")}}><option value="">1. Select category</option>{categories.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={model} disabled={!category} onChange={(e) => {setModel(e.target.value);setTechnology("");setMaterial("")}}><option value="">2. All models</option>{models.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select>
          <select value={technology} disabled={!category} onChange={(e) => setTechnology(e.target.value)}><option value="">3. All technologies</option>{technologies.map((value) => <option key={value}>{value}</option>)}</select>
          <select value={material} disabled={!category} onChange={(e) => setMaterial(e.target.value)}><option value="">4. All materials / finishes</option>{materials.map((value) => <option key={value}>{value}</option>)}</select>
          <button className="primary" onClick={() => setShowCustom((value) => !value)}>＋ Custom item</button>
        </div>
        {showCustom && <div className="customquoteitem">
          <h3>Add an item not in Items Master</h3>
          <label><span>Item name *</span><input value={custom.name} onChange={(e) => setCustom({...custom,name:e.target.value})} /></label>
          <label><span>Quantity</span><input type="number" min=".01" value={custom.qty} onChange={(e) => setCustom({...custom,qty:Number(e.target.value)})} /></label>
          <label><span>Unit</span><input value={custom.unit} onChange={(e) => setCustom({...custom,unit:e.target.value})} /></label>
          <label><span>Rate</span><input type="number" min="0" value={custom.price} onChange={(e) => setCustom({...custom,price:Number(e.target.value)})} /></label>
          <label><span>Discount %</span><input type="number" min="0" max="100" value={custom.discount} onChange={(e) => setCustom({...custom,discount:Number(e.target.value)})} /></label>
          <label><span>GST %</span><input type="number" disabled={taxMode === "Non-GST"} value={custom.gst} onChange={(e) => setCustom({...custom,gst:Number(e.target.value)})} /></label>
          <label className="wide"><span>Description / specification</span><textarea value={custom.description} onChange={(e) => setCustom({...custom,description:e.target.value})} /></label>
          <label><span>Warranty</span><input value={custom.warranty} onChange={(e) => setCustom({...custom,warranty:e.target.value})} /></label>
          <label><span>Line note</span><input value={custom.note} onChange={(e) => setCustom({...custom,note:e.target.value})} /></label>
          <button className="primary" disabled={!custom.name.trim()} onClick={() => {addAndContinue({...custom,id:crypto.randomUUID(),custom:true,brand:"Custom",sku:"CUSTOM",taxMode});setCustom({...custom,name:"",description:"",note:""})}}>Add custom item</button>
        </div>}
        <div className="pickeritems">
          {loading ? (
            <p>Searching Items…</p>
          ) : (
            visibleItems.map((x) => {
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
function Payment({ snap, set, total, locked }: R) {
  const plan = snap.paymentPlan || [],
    mut = (fn: (n: R) => void) => {
      const n = structuredClone(snap);
      fn(n);
      set(n);
    };
  return (
    <div className="qpay">
      <section className="qcard">
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
      </section>
      <section className="qcard">
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
                    {x.qty} {x.unit}
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
  return (
    <article
      className={`qpaper qpaperpremium ${designClass} qformat-${pdfFormat} qtemplate-${templateId} ${branding.showStandardImages === false ? "qhideimages" : ""}`}
      style={templateStyle}
    >
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
            <small>PROPOSAL</small>
            <b>{quote.number}</b>
          </span>
          <span>
            <small>REVISION</small>
            <b>{quote.revision || 0}</b>
          </span>
          <span>
            <small>PROJECT / SITE</small>
            <b>
              {siteName}, {quote.city}
            </b>
          </span>
          <span>
            <small>VALID UNTIL</small>
            <b>{validity}</b>
          </span>
        </div>
        <footer>
          <span>TECHOMIE</span>
          <small>SMART HOME | SECURITY | AUTOMATION</small>
        </footer>
      </section>
      {detailed && <section className="qintro">
        {head("PROPOSAL OVERVIEW")}
        <div className="qintrohero">
          <small>DESIGNED AROUND YOUR SPACE</small>
          <h2>
            A smarter property,
            <br />
            <span>thoughtfully designed.</span>
          </h2>
          <p>{snap.details?.introduction}</p>
        </div>
        <div className="qpdfcards">
          <article>
            <small>CLIENT</small>
            <b>{customerName}</b>
            <span>
              {snap.details?.contactName || quote.phone || quote.contact_phone || "Contact on record"}
            </span>
          </article>
          <article>
            <small>PROJECT / SITE</small>
            <b>{siteName}</b>
            <span>
              {snap.details?.installationAddress || [quote.site_address, quote.city, quote.state, quote.pincode].filter(Boolean).join(", ")}
            </span>
          </article>
          <article>
            <small>PROPOSAL VALIDITY</small>
            <b>{validity}</b>
            <span>
              {snap.details?.quoteType || "Smart automation proposal"}
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
            <span>Rooms</span>
          </div>
          <div>
            <b>{items.length}</b>
            <span>Configured items</span>
          </div>
          <div>
            <b>{money(totals.grand)}</b>
            <span>Proposal value</span>
          </div>
        </div>
        <div className="qnextstep">
          <b>What happens next?</b>
          <span>
            Review the room-wise scope, confirm selections and payment
            milestones, then approve the proposal for project execution.
          </span>
        </div>
        {foot("Proposal overview")}
      </section>}
      {floors.map((floor: R, floorIndex: number) => (
        <section className="qpaperscope" key={floor.name}>
          {head("ROOM-WISE SCOPE")}
          <div className="qsectiontitle">
            <small>SCOPE {String(floorIndex + 1).padStart(2, "0")}</small>
            <h2>{floor.name}</h2>
            <span>{(floor.rooms || []).length} rooms</span>
          </div>
          {(floor.rooms || []).map((room: R) => (
            <div className="qpdfroom" key={room.name}>
              <h3>
                {room.name}
                <span>
                  {room.note || `${(room.items || []).length} configured items`}
                </span>
              </h3>
              <div className="qpapercolumns">
                <span>PRODUCT / CONFIGURATION</span>
                <span>QTY</span>
                <span>UNIT</span>
                <span>RATE</span>
                <span>DISC.</span>
                <span>AMOUNT</span>
              </div>
              {(room.items || []).map((item: R, index: number) => (
                <div className="qpaperline" key={index}>
                  <img src={item.image || logo} alt="" />
                  <span>
                    <b>
                      {item.name}
                      {item.optional ? " (Optional)" : ""}
                    </b>
                    <small>{item.description}</small>
                    <em>
                      {[item.sku, item.variantSummary, item.warranty]
                        .filter(Boolean)
                        .join(" | ")}
                    </em>
                  </span>
                  <i>
                    {item.qty}
                  </i>
                  <i>{item.unit}</i>
                  <i>{money(item.price)}</i>
                  <i>{Number(item.discount || 0)}%</i>
                  <strong>{money(line(item).total)}</strong>
                </div>
              ))}
            </div>
          ))}
          {foot(`${floor.name} scope`)}
        </section>
      ))}
      <section className="qpaperfinance">
        {head("COMMERCIALS")}
        <div className="qsectiontitle">
          <small>INVESTMENT</small>
          <h2>Commercial summary</h2>
          <span>All values in INR</span>
        </div>
        <div className="qtotalhero">
          <small>TOTAL PROPOSAL VALUE</small>
          <strong>{money(totals.grand)}</strong>
          <span>Inclusive of applicable GST</span>
        </div>
        <div className="qcommercialgrid">
          <div>
            <p>
              <span>Product and service subtotal</span>
              <b>{money(totals.subtotal)}</b>
            </p>
            <p>
              <span>Item discounts</span>
              <b>- {money(totals.discount)}</b>
            </p>
            <p className="taxable">
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
          </div>
          <aside>
            <small>COMMERCIAL NOTES</small>
            <p>
              Prices apply to the exact configurations and quantities listed in
              this proposal.
            </p>
            <p>
              Changes to scope, finish, technology or site conditions may
              require a revised quotation.
            </p>
            <p>
              Execution begins after written confirmation and receipt of the
              applicable advance.
            </p>
          </aside>
        </div>
        <div className="qgrandbar">
          <span>Grand total</span>
          <b>{money(totals.grand)}</b>
        </div>
        {foot("Commercial summary")}
      </section>
      <section className="qpaperterms">
        {head("PAYMENT & TERMS")}
        <div className="qsectiontitle">
          <small>CONFIRMATION</small>
          <h2>Payment schedule</h2>
          <span>Milestone based</span>
        </div>
        <div className="qmilestones">
          {(snap.paymentPlan || []).map((m: R, index: number) => (
            <article key={m.name}>
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
        <div className="qtermgrid">
          <article>
            <small>WARRANTY</small>
            <h3>Product assurance</h3>
            <p>
              {snap.warranty ||
                "Standard manufacturer warranty applies from the date of supply or commissioning, as applicable."}
            </p>
          </article>
          <article>
            <small>TERMS & CONDITIONS</small>
            <h3>Important terms</h3>
            <p>
              {snap.terms ||
                "Prices remain valid until the stated validity date. Site readiness, access and uninterrupted power are the customer's responsibility."}
            </p>
          </article>
        </div>
        <div className="qacceptance">
          <div>
            <span>For {company}</span>
            <b>Authorised Signatory</b>
          </div>
          <div>
            <span>Customer acceptance</span>
            <b>Name, signature and date</b>
          </div>
        </div>
        <div className="qthankyou">
          <small>THANK YOU FOR CHOOSING TECHOMIE</small>
          <b>Let's make your space smarter.</b>
        </div>
        <div className="qpreparedby"><small>QUOTATION PREPARED BY</small><b>{snap.details?.quotationByName || quote.sales_name || quote.created_name || "Techomie Sales Team"}</b></div>
        {foot("Payment and terms")}
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
          <span>{item.qty} {item.unit}</span><span>{money(item.price)}</span><span>{Number(item.discount || 0)}%</span><span>{item.taxMode === "Non-GST" ? "-" : `${Number(item.gst || 18)}%`}</span><strong>{money(line(item).total)}</strong>
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
  return snap?.details?.quoteType === "Full Smart Home Proposal" || rooms.length > 1 || items.length > 4
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
  const base = Number(x.price || 0) * Number(x.qty || 0),
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
