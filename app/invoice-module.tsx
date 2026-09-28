"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

type QuoteLine = {
  id: string | number;
  name: string;
  sku?: string;
  variant?: string;
  price: number;
  qty: number;
  discount?: number;
  taxMode?: "GST" | "Non-GST";
  gstRate?: number;
  gst?: number;
  hsn?: string;
};
type Room = { name: string; floor: string; items: QuoteLine[] };
type Customer = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
  billingAddress?: string;
};
type Invoice = Record<string, unknown> & {
  id: string;
  number?: string;
  status: string;
  customer_name?: string;
  invoice_date?: string;
  due_date?: string;
  billing_address?: string;
  shipping_address?: string;
  customer_gstin?: string;
  place_of_supply?: string;
  place_of_supply_code?: string;
  supply_type?: string;
  pricing_mode?: string;
  grand_total: number;
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  amount_words?: string;
  paid?: number;
  balance?: number;
  pdf_key?: string;
  items?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  snapshot?: string | Record<string, unknown>;
};
type Props = {
  rooms: Room[];
  details: {
    customer: string;
    site: string;
    sales: string;
    validity: string;
    type: string;
  };
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  focusId?: string;
  role?: string;
};
const money = (n: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));
const today = () => new Date().toISOString().slice(0, 10);
const later = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const states = [
  ["33", "Tamil Nadu"],
  ["29", "Karnataka"],
  ["32", "Kerala"],
  ["36", "Telangana"],
  ["37", "Andhra Pradesh"],
  ["27", "Maharashtra"],
  ["07", "Delhi"],
  ["24", "Gujarat"],
  ["09", "Uttar Pradesh"],
  ["19", "West Bengal"],
  ["06", "Haryana"],
  ["03", "Punjab"],
  ["08", "Rajasthan"],
  ["21", "Odisha"],
  ["10", "Bihar"],
  ["23", "Madhya Pradesh"],
];

function QuickCreateCustomer({
  onCreated,
  onClose,
}: {
  onCreated: (c: Customer) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ customerType: "Individual", name: "", phone: "", email: "", city: "", state: "Tamil Nadu" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!form.name.trim()) { setErr("Customer name is required"); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Failed to create customer"); setBusy(false); return; }
      onCreated(d.customer as Customer);
    } catch (e: any) { setErr(e?.message || "Network error"); } finally { setBusy(false); }
  };
  const f = (k: keyof typeof form, label: string) => (
    <label className="qcc-field"><span>{label}</span>
      <input value={form[k]} autoFocus={k === "name"} onChange={(e) => setForm({ ...form, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} />
    </label>
  );
  return (
    <div className="qcc-backdrop" onClick={onClose}>
      <div className="qcc-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="qcc-header"><div><small>QUICK ADD</small><h3>New Customer</h3></div><button className="qcc-close" onClick={onClose}>×</button></header>
        <div className="qcc-body">
          <p className="qcc-hint">Only the customer name is required. Other details can be filled later.</p>
          {err && <div className="qcc-err">{err}</div>}
          <div className="qcc-form">
            <label className="qcc-field"><span>Customer type</span>
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
          <button type="button" className="primary" disabled={busy || !form.name.trim()} onClick={submit}>{busy ? "Creating…" : "Create customer"}</button>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceModule({ rooms, details, focusId, role }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [quotations, setQuotations] = useState<Record<string, any>[]>([]),
    [selectedQuoteId, setSelectedQuoteId] = useState<string>(""),
    [selected, setSelected] = useState<Invoice | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [showDraft, setShowDraft] = useState(false),
    [showPayment, setShowPayment] = useState(false),
    [showNote, setShowNote] = useState(false),
    [showFinalise, setShowFinalise] = useState(false),
    [branding, setBranding] = useState<Record<string, any>>({}),
    [showList, setShowList] = useState(true),
    [zoom, setZoom] = useState<"fit" | "100" | "85" | "75">("fit"),
    [showQCC, setShowQCC] = useState(false),
    [invoiceRooms, setInvoiceRooms] = useState<Room[]>([]),
    [draggedInvoiceItem, setDraggedInvoiceItem] = useState<{ roomIndex: number; itemIndex: number } | null>(null),
    [dragOverInvoiceRoom, setDragOverInvoiceRoom] = useState<number | null>(null),
    [dragOverInvoiceItem, setDragOverInvoiceItem] = useState<{ roomIndex: number; itemIndex: number; position: "before" | "after" } | null>(null);

  useEffect(() => {
    if (rooms && rooms.length) {
      setInvoiceRooms(structuredClone(rooms));
    }
  }, [rooms]);

  const [draft, setDraft] = useState({
    customerId: "",
    invoiceDate: today(),
    dueDate: later(15),
    billingAddress: "",
    shippingAddress: "",
    customerGstin: "",
    placeOfSupply: "Tamil Nadu",
    placeOfSupplyCode: "33",
    pricingMode: "exclusive",
    paymentTerms: "Payment due within 15 days",
    bankDetails: "Bank transfer / UPI as shown below",
    templateId: "executive",
  });
  const [payment, setPayment] = useState({
    date: today(),
    amount: "",
    mode: "Bank Transfer",
    reference: "",
    notes: "",
  });
  const [note, setNote] = useState({
    type: "Credit",
    date: today(),
    reason: "",
    taxableValue: "",
    cgst: "",
    sgst: "",
    igst: "",
    total: "",
  });

  const currentRooms = invoiceRooms.length ? invoiceRooms : rooms;

  const quoteItems = useMemo(
    () =>
      currentRooms.flatMap((r) =>
        (r.items || []).map((i) => ({
          description: `${i.name}${i.variant ? ` — ${i.variant}` : ""} (${r.name})`,
          sku: i.sku || "",
          hsnSac: i.hsn || "8536",
          uqc: "NOS",
          quantity: i.qty,
          rate: i.price,
          discountRate: i.discount || 0,
          gstRate: i.taxMode === "Non-GST" ? 0 : (i.gstRate ?? i.gst ?? 18),
        })),
      ),
    [currentRooms],
  );

  const handleInvoiceItemMove = (
    fromRoom: number,
    fromItem: number,
    toRoom: number,
    toItem?: number,
    position?: "before" | "after",
  ) => {
    setInvoiceRooms((prev) => {
      const next = structuredClone(prev.length ? prev : rooms);
      const srcItems = next[fromRoom]?.items;
      const destItems = next[toRoom]?.items;
      if (!srcItems || !destItems || !srcItems[fromItem]) return prev;

      const [item] = srcItems.splice(fromItem, 1);

      if (fromRoom === toRoom) {
        let insertIndex = toItem !== undefined ? toItem : destItems.length;
        if (position === "after") {
          insertIndex = fromItem < insertIndex ? insertIndex : insertIndex + 1;
        } else if (position === "before") {
          insertIndex = fromItem < insertIndex ? Math.max(0, insertIndex) : insertIndex;
        }
        destItems.splice(Math.max(0, Math.min(insertIndex, destItems.length)), 0, item);
      } else {
        if (toItem === undefined) {
          destItems.push(item);
        } else {
          const insertIndex = position === "after" ? toItem + 1 : toItem;
          destItems.splice(Math.max(0, Math.min(insertIndex, destItems.length)), 0, item);
        }
      }
      return next;
    });
  };

  const addInvoiceRoom = () => {
    const name = window.prompt("Enter new room name for invoice (e.g. Master Bedroom, Outer Lounge):");
    if (!name || !name.trim()) return;
    setInvoiceRooms((prev) => [
      ...(prev.length ? prev : structuredClone(rooms)),
      { name: name.trim(), floor: "Ground Floor", items: [] },
    ]);
  };

  const chooseQuotation = async (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    if (!quoteId) {
      setInvoiceRooms(structuredClone(rooms));
      return;
    }
    try {
      const res = await fetch(`/api/quotations?id=${encodeURIComponent(quoteId)}`);
      const dat = await res.json();
      if (res.ok && dat.quotation) {
        const q = dat.quotation;
        if (q.customer_id) {
          chooseCustomer(String(q.customer_id));
        }
        if (q.snapshot?.floors) {
          const extractedRooms: Room[] = [];
          q.snapshot.floors.forEach((fl: any) => {
            (fl.rooms || []).forEach((rm: any) => {
              extractedRooms.push({
                name: rm.name || "Room",
                floor: fl.name || "Ground Floor",
                items: (rm.items || []).map((it: any) => ({
                  id: it.id || String(it.productId || it.variantId || Math.random()),
                  name: it.name,
                  variant: it.variantSummary || it.variant || "",
                  sku: it.sku || "",
                  hsn: it.hsn || "8536",
                  qty: Number(it.qty || 1),
                  price: Number(it.price || 0),
                  discount: Number(it.discount || 0),
                  taxMode: it.taxMode || q.snapshot.taxMode || "GST",
                  gstRate: Number(it.gst || it.gstRate || 18),
                  image: it.image || "",
                })),
              });
            });
          });
          if (extractedRooms.length) {
            setInvoiceRooms(extractedRooms);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load quotation for invoice", err);
    }
  };

  const load = async () => {
    const [ir, cr, qr] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/customers"),
      fetch("/api/quotations?limit=100").catch(() => null),
    ]);
    if (ir.ok) {
      const d = await ir.json();
      setInvoices(d.invoices || []);
    }
    if (cr.ok) {
      const d = await cr.json();
      setCustomers(d.customers || []);
    }
    if (qr && qr.ok) {
      const d = await qr.json().catch(() => null);
      if (d?.quotations) setQuotations(d.quotations);
    }
  };
  useEffect(() => {
    load();
    if (focusId) openInvoice(focusId);
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("create") === "1" || p.get("quoteId")) {
        setShowDraft(true);
        if (p.get("quoteId")) {
          chooseQuotation(p.get("quoteId")!);
        }
      }
    }
  }, [focusId]);
  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => {
      const b = d?.settings?.branding;
      if (b) {
        setBranding(b);
        setDraft(x => ({ ...x, templateId: x.templateId === "executive" ? (b.defaultInvoiceTemplate || "executive") : x.templateId }));
      }
    }).catch(() => undefined);
  }, []);
  const chooseCustomer = (id: string) => {
    const c = customers.find((x) => String(x.id) === id);
    setDraft((d) => ({
      ...d,
      customerId: id,
      billingAddress: c?.billingAddress || "",
      shippingAddress: c?.billingAddress || details.site || "",
      customerGstin: c?.gstin || "",
    }));
  };
  const openInvoice = async (id: string) => {
    setBusy(true);
    const r = await fetch(`/api/invoices?id=${encodeURIComponent(id)}`),
      d = await r.json();
    setBusy(false);
    if (r.ok) setSelected(d.invoice);
    else setMessage(d.error || "Unable to open invoice");
  };
  const createDraft = async () => {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          customerId: Number(draft.customerId),
          items: quoteItems,
          bankDetails: { display: draft.bankDetails },
          company: {
            name: "Techomie Smart Devices",
            gstin: "33GIMPP4721H1Z2",
            state: "Tamil Nadu",
            stateCode: "33",
            address:
              "356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar, COIMBATORE Tamil Nadu 641048, India",
          },
        }),
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error || "Unable to create draft");
      return;
    }
    setShowDraft(false);
    setMessage("Draft invoice created");
    await load();
    await openInvoice(d.invoice.id);
  };
  const selectTemplate = async (templateId: string) => {
    if (!selected || selected.status !== "Draft") return;
    const r = await fetch("/api/invoices", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: selected.id, action: "template", templateId }) });
    if (!r.ok) { const d = await r.json(); setMessage(d.error || "Unable to change template"); return; }
    await openInvoice(selected.id);
    setMessage("Invoice design updated");
  };
  const generatePdf = async (save = false) => {
    if (!selected) return null;
    const el = document.getElementById("tax-invoice-paper");
    if (!el) return null;
    el.classList.add("pdfexporting");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const worker = html2pdf()
        .set({
          margin: 0,
          filename: `${selected.number || "Draft-Invoice"}.pdf`.replaceAll(
            "/",
            "-",
          ),
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", imageTimeout: 10000, logging: false, scrollY: 0, scrollX: 0 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: {
            mode: ["css", "legacy"],
            avoid: [".paperrow", ".papertotals", ".paperhistory", "footer"],
          },
        })
        .from(el);
      if (save) {
        await worker.save();
        return null;
      }
      return (await worker.outputPdf("blob")) as Blob;
    } finally {
      el?.classList.remove("pdfexporting");
    }
  };
  const finalise = async () => {
    if (!selected) return;
    setShowFinalise(false);
    setBusy(true);
    const id = selected.id,
      r = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "finalise" }),
      }),
      d = await r.json();
    if (!r.ok) {
      setBusy(false);
      setMessage(d.error);
      return;
    }
    const detailResponse = await fetch(
        `/api/invoices?id=${encodeURIComponent(id)}`,
      ),
      detail = await detailResponse.json();
    if (detailResponse.ok) setSelected(detail.invoice);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const blob = await generatePdf(false);
    if (blob) {
      const form = new FormData();
      form.set("id", id);
      form.set("pdf", blob, "invoice.pdf");
      await fetch("/api/invoices/pdf", { method: "POST", body: form });
    }
    setBusy(false);
    setMessage(`Invoice ${d.number} finalised, locked and archived as PDF`);
    await load();
    await openInvoice(id);
  };
  const recordPayment = async () => {
    if (!selected) return;
    setBusy(true);
    const r = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          action: "payment",
          ...payment,
          amount: Number(payment.amount),
        }),
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setShowPayment(false);
    setPayment({ ...payment, amount: "", reference: "", notes: "" });
    setMessage("Payment recorded and balance updated");
    await load();
    await openInvoice(selected.id);
  };
  const createNote = async () => {
    if (!selected) return;
    setBusy(true);
    const values = Object.fromEntries(
      Object.entries(note).map(([k, v]) =>
        ["taxableValue", "cgst", "sgst", "igst", "total"].includes(k)
          ? [k, Number(v || 0)]
          : [k, v],
      ),
    );
    const r = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "note", ...values }),
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setShowNote(false);
    setMessage(`${d.number} created and linked to the original invoice`);
    await openInvoice(selected.id);
  };
  const cancelInvoice = async () => {
    if (!selected) return;
    const reason = prompt(
      "Cancellation reason (the invoice will remain permanently in the register):",
    );
    if (!reason) return;
    setBusy(true);
    const r = await fetch("/api/invoices/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: selected.id, reason }),
      }),
      d = await r.json();
    setBusy(false);
    setMessage(
      r.ok
        ? "Invoice cancelled; its number and archived record remain permanent"
        : d.error,
    );
    await load();
    await openInvoice(selected.id);
  };
  const download = (format: string) => {
    window.location.href = `/api/invoices?format=${format}`;
  };
  const deleteInvoice = async (id?: string) => {
    const targetId = id || selected?.id;
    if (!targetId) return;
    if (!confirm(`Permanently delete invoice ${selected?.number || targetId}? This action cannot be undone.`)) return;
    setBusy(true);
    const r = await fetch(`/api/invoices?id=${targetId}`, { method: "DELETE" });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error || "Unable to delete invoice");
      return;
    }
    setMessage("Invoice permanently deleted");
    if (selected?.id === targetId) setSelected(null);
    load();
  };
  const totalOutstanding = invoices.reduce(
      (s, i) => s + Number(i.balance || 0),
      0,
    ),
    overdue = invoices
      .filter(
        (i) =>
          i.status !== "Paid" && i.due_date && String(i.due_date) < today(),
      )
      .reduce((s, i) => s + Number(i.balance || 0), 0);
  return (
    <div className="modulepage gstinvoicepage">
      <div className="modulehero">
        <div>
          <small>GST BILLING & RECEIVABLES</small>
          <h1>Tax Invoices</h1>
          <p>
            Final invoices, payments, statutory correction notes and GST-ready
            reports in one permanent register.
          </p>
        </div>
        <div className="heroactions">
          <button onClick={() => download("hsn")}>HSN summary</button>
          <button onClick={() => download("gstr1")}>GSTR-1 export</button>
          <button className="primary" onClick={() => setShowDraft(true)}>
            + Convert quote to invoice
          </button>
        </div>
      </div>
      <div className="statgrid">
        <article>
          <small>TOTAL INVOICES</small>
          <b>{invoices.length}</b>
        </article>
        <article>
          <small>RECEIVABLES</small>
          <b>{money(totalOutstanding)}</b>
        </article>
        <article>
          <small>OVERDUE</small>
          <b>{money(overdue)}</b>
        </article>
        <article>
          <small>CURRENT QUOTE LINES</small>
          <b>{quoteItems.length}</b>
        </article>
      </div>
      {message && (
        <div className="invoicealert">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <div className={`invoiceworkspace ${!showList ? "register-collapsed" : ""}`}>
        <aside className="invoiceregister">
          <div className="registerhead">
            <b>Invoice register</b>
            <span>{busy ? "Updating…" : "Live records"}</span>
          </div>
          {invoices.length === 0 ? (
            <div className="emptyinvoice">
              No invoices yet. Convert the accepted quotation to begin.
            </div>
          ) : (
            invoices.map((i) => (
              <div
                key={i.id}
                role="button"
                tabIndex={0}
                className={`invoiceregistercard ${selected?.id === i.id ? "active" : ""}`}
                onClick={() => openInvoice(i.id)}
              >
                <div className="invoicemain">
                  <span>
                    <b>{i.number || "DRAFT"}</b>
                    <small>
                      {i.customer_name as string} · {i.invoice_date as string}
                    </small>
                  </span>
                  <span>
                    <strong>{money(i.grand_total)}</strong>
                    <em
                      className={`invstatus ${String(i.status).toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {i.status}
                    </em>
                  </span>
                </div>
                {role === "admin" && (
                  <div className="invoicecardactions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="invdelbtn"
                      title="Permanently delete invoice"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInvoice(i.id);
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </aside>
        <section className="invoiceviewer">
          {selected ? (
            <>
              <div className="invoiceactionbar">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    className="togglelistbtn"
                    onClick={() => setShowList(!showList)}
                    title={showList ? "Collapse register to expand invoice preview" : "Show invoice register"}
                  >
                    {showList ? "◧ Hide list" : `☰ Invoices (${invoices.length})`}
                  </button>
                  <div>
                    <b>{selected.number || "Draft invoice"}</b>
                    <span>
                      {selected.status}
                      {selected.pdf_key ? " · Permanent PDF stored" : ""}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="documenttemplateselect">
                    <span>Zoom</span>
                    <select value={zoom} onChange={e => setZoom(e.target.value as any)}>
                      <option value="fit">Fit width</option>
                      <option value="100">100% (A4)</option>
                      <option value="85">85%</option>
                      <option value="75">75%</option>
                    </select>
                  </label>
                  <label className="documenttemplateselect">
                    <span>PDF design</span>
                    <select disabled={selected.status !== "Draft"} value={invoiceTemplate(selected, branding)} onChange={e => selectTemplate(e.target.value)}>
                      {(branding.invoiceTemplates || [{id:"executive",name:"Executive Tax Invoice"},{id:"technical",name:"Technical Blue"},{id:"classic",name:"Classic GST"}]).filter((x:Record<string,any>) => x.active !== false).map((x:Record<string,any>) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>
                  {selected.status === "Draft" && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => setShowFinalise(true)}
                    >
                      Finalise & lock
                    </button>
                  )}
                  {selected.status !== "Draft" &&
                    selected.status !== "Cancelled" && (
                      <>
                        <button onClick={() => setShowPayment(true)}>
                          Record payment
                        </button>
                        <button onClick={() => setShowNote(true)}>
                          Credit / Debit note
                        </button>
                        {selected.status !== "Paid" && (
                          <button onClick={cancelInvoice}>
                            Cancel invoice
                          </button>
                        )}
                      </>
                    )}
                  <button onClick={() => window.print()}>Print</button>
                  <button onClick={() => generatePdf(true)}>
                    Download PDF
                  </button>
                    {selected.pdf_key && (
                      <button
                        onClick={() =>
                          window.open(
                            `/api/invoices/pdf?id=${selected.id}`,
                            "_blank",
                          )
                        }
                      >
                        Open archived PDF
                      </button>
                    )}
                    {role === "admin" && (
                      <button
                        style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
                        onClick={() => deleteInvoice()}
                      >
                        🗑 Delete invoice
                      </button>
                    )}
                  </div>
              </div>
              <InvoicePaper invoice={selected} branding={branding} zoom={zoom} />
            </>
          ) : (
            <div className="invoiceplaceholder">
              <b>Select an invoice</b>
              <p>
                Open a record to preview, print, download, collect payment or
                issue a correction note.
              </p>
            </div>
          )}
        </section>
      </div>
      {showQCC && (
        <QuickCreateCustomer
          onCreated={(c) => {
            setCustomers((prev) => [...prev.filter((x) => x.id !== c.id), c as Customer]);
            chooseCustomer(String(c.id));
            setShowQCC(false);
          }}
          onClose={() => setShowQCC(false)}
        />
      )}
      {showDraft && (
        <Modal
          title="Convert accepted quotation to draft invoice"
          onClose={() => setShowDraft(false)}
        >
          <div className="invoiceform">
            <label>
              <span>Invoice design</span>
              <select value={draft.templateId} onChange={e => setDraft({ ...draft, templateId: e.target.value })}>
                {(branding.invoiceTemplates || [{id:"executive",name:"Executive Tax Invoice"},{id:"technical",name:"Technical Blue"},{id:"classic",name:"Classic GST"}]).filter((x:Record<string,any>) => x.active !== false).map((x:Record<string,any>) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            {quotations.length > 0 && (
              <label className="wide" style={{ background: "#f0f9ff", padding: "10px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                <span style={{ color: "#0369a1", fontWeight: 700 }}>Import from Quotation (optional)</span>
                <select
                  value={selectedQuoteId}
                  onChange={(e) => chooseQuotation(e.target.value)}
                  style={{ background: "#ffffff", borderColor: "#7dd3fc" }}
                >
                  <option value="">Use current active quotation</option>
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.number || `Quote #${q.id}`} — {q.customer_name || "Customer"} · {q.site_name || "Site"} ({money(q.total || 0)})
                    </option>
                  ))}
                </select>
              </label>
            )}
          <div className="qcc-row">
            <label style={{ flex: 1 }}>
              <span>Customer *</span>
              <select
                value={draft.customerId}
                onChange={(e) => chooseCustomer(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
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
              <span>Invoice date</span>
              <input
                type="date"
                value={draft.invoiceDate}
                onChange={(e) =>
                  setDraft({ ...draft, invoiceDate: e.target.value })
                }
              />
            </label>
            <label>
              <span>Due date</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) =>
                  setDraft({ ...draft, dueDate: e.target.value })
                }
              />
            </label>
            <label>
              <span>Customer GSTIN</span>
              <input
                value={draft.customerGstin}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    customerGstin: e.target.value.toUpperCase(),
                  })
                }
              />
            </label>
            <label>
              <span>Place of supply</span>
              <select
                value={draft.placeOfSupplyCode}
                onChange={(e) => {
                  const x = states.find((s) => s[0] === e.target.value)!;
                  setDraft({
                    ...draft,
                    placeOfSupplyCode: x[0],
                    placeOfSupply: x[1],
                  });
                }}
              >
                {states.map((s) => (
                  <option value={s[0]} key={s[0]}>
                    {s[0]} — {s[1]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Price treatment</span>
              <select
                value={draft.pricingMode}
                onChange={(e) =>
                  setDraft({ ...draft, pricingMode: e.target.value })
                }
              >
                <option value="exclusive">GST exclusive</option>
                <option value="inclusive">GST inclusive</option>
              </select>
            </label>
            <label className="wide">
              <span>Billing address *</span>
              <textarea
                value={draft.billingAddress}
                onChange={(e) =>
                  setDraft({ ...draft, billingAddress: e.target.value })
                }
              />
            </label>
            <label className="wide">
              <span>Shipping address</span>
              <textarea
                value={draft.shippingAddress}
                onChange={(e) =>
                  setDraft({ ...draft, shippingAddress: e.target.value })
                }
              />
            </label>
            <label className="wide">
              <span>Payment terms</span>
              <input
                value={draft.paymentTerms}
                onChange={(e) =>
                  setDraft({ ...draft, paymentTerms: e.target.value })
                }
              />
            </label>
            <div className="invoice-rooms-section wide">
              <div className="invoice-rooms-header">
                <div>
                  <b>Room-by-Room Item Allocation (Drag &amp; Drop)</b>
                  <span>Drag items between rooms to customize line attribution on the tax invoice</span>
                </div>
                <button type="button" className="invoice-add-room-btn" onClick={addInvoiceRoom}>
                  ＋ Add room
                </button>
              </div>

              <div className="invoice-rooms-grid">
                {currentRooms.map((r, rIdx) => {
                  const isTarget = dragOverInvoiceRoom === rIdx;
                  const roomTotal = (r.items || []).reduce(
                    (sum, item) => sum + item.qty * item.price * (1 - (item.discount || 0) / 100),
                    0,
                  );
                  return (
                    <div
                      key={rIdx}
                      className={`invoice-room-card ${isTarget ? "drop-active" : ""}`}
                      onDragOver={(e) => {
                        if (!draggedInvoiceItem) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverInvoiceRoom(rIdx);
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (
                          e.clientX < rect.left ||
                          e.clientX > rect.right ||
                          e.clientY < rect.top ||
                          e.clientY > rect.bottom
                        ) {
                          if (dragOverInvoiceRoom === rIdx) setDragOverInvoiceRoom(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (!draggedInvoiceItem) return;
                        e.preventDefault();
                        e.stopPropagation();
                        handleInvoiceItemMove(
                          draggedInvoiceItem.roomIndex,
                          draggedInvoiceItem.itemIndex,
                          rIdx,
                          undefined,
                          undefined,
                        );
                        setDraggedInvoiceItem(null);
                        setDragOverInvoiceRoom(null);
                        setDragOverInvoiceItem(null);
                      }}
                    >
                      <div className="invoice-room-head">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                            <select
                              value={r.floor || "Ground Floor"}
                              className="invoice-floor-select"
                              title="Change floor for this room"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "new_floor") {
                                  const custom = prompt("Enter new floor name:", `Floor ${currentRooms.length + 1}`);
                                  if (!custom?.trim()) return;
                                  setInvoiceRooms((prev) => {
                                    const next = structuredClone(prev.length ? prev : rooms);
                                    if (next[rIdx]) next[rIdx].floor = custom.trim();
                                    return next;
                                  });
                                } else {
                                  setInvoiceRooms((prev) => {
                                    const next = structuredClone(prev.length ? prev : rooms);
                                    if (next[rIdx]) next[rIdx].floor = val;
                                    return next;
                                  });
                                }
                              }}
                            >
                              {Array.from(
                                new Set([
                                  "Ground Floor",
                                  "First Floor",
                                  "Second Floor",
                                  "Third Floor",
                                  "Terrace",
                                  ...currentRooms.map((rm) => rm.floor).filter(Boolean),
                                ]),
                              ).map((fl) => (
                                <option key={fl} value={fl}>
                                  Floor: {fl}
                                </option>
                              ))}
                              <option value="new_floor">＋ New floor…</option>
                            </select>
                          </div>
                          <h4>{r.name}</h4>
                        </div>
                        <div className="invoice-room-meta">
                          <span className="count">{(r.items || []).length} items</span>
                          <span className="total">{money(roomTotal)}</span>
                        </div>
                      </div>

                      <div className="invoice-room-items">
                        {isTarget && (!r.items || !r.items.length || !dragOverInvoiceItem) && (
                          <div className="invoice-drop-indicator">
                            <span>⇩ Drop item here into {r.name}</span>
                          </div>
                        )}
                        {(!r.items || r.items.length === 0) && (
                          <div className="invoice-empty-room">
                            <span>No items in this room yet. Drag items here from other rooms.</span>
                          </div>
                        )}
                        {(r.items || []).map((item, iIdx) => {
                          const isDragging =
                            draggedInvoiceItem?.roomIndex === rIdx &&
                            draggedInvoiceItem?.itemIndex === iIdx;
                          const isOver =
                            dragOverInvoiceItem?.roomIndex === rIdx &&
                            dragOverInvoiceItem?.itemIndex === iIdx;
                          const itemTotal =
                            item.qty * item.price * (1 - (item.discount || 0) / 100);
                          return (
                            <div
                              key={iIdx}
                              className={`invoice-item-row ${isDragging ? "is-dragging" : ""} ${
                                isOver ? `drop-${dragOverInvoiceItem.position}` : ""
                              }`}
                              draggable
                              onDragStart={(e) => {
                                setDraggedInvoiceItem({ roomIndex: rIdx, itemIndex: iIdx });
                                e.dataTransfer.setData(
                                  "application/json",
                                  JSON.stringify({ roomIndex: rIdx, itemIndex: iIdx }),
                                );
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => {
                                setDraggedInvoiceItem(null);
                                setDragOverInvoiceRoom(null);
                                setDragOverInvoiceItem(null);
                              }}
                              onDragOver={(e) => {
                                if (!draggedInvoiceItem) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relY = e.clientY - rect.top;
                                const position = relY < rect.height / 2 ? "before" : "after";
                                setDragOverInvoiceRoom(rIdx);
                                setDragOverInvoiceItem({ roomIndex: rIdx, itemIndex: iIdx, position });
                              }}
                              onDragLeave={(e) => {
                                e.stopPropagation();
                                if (
                                  dragOverInvoiceItem?.roomIndex === rIdx &&
                                  dragOverInvoiceItem?.itemIndex === iIdx
                                ) {
                                  setDragOverInvoiceItem(null);
                                }
                              }}
                              onDrop={(e) => {
                                if (!draggedInvoiceItem) return;
                                e.preventDefault();
                                e.stopPropagation();
                                handleInvoiceItemMove(
                                  draggedInvoiceItem.roomIndex,
                                  draggedInvoiceItem.itemIndex,
                                  rIdx,
                                  iIdx,
                                  dragOverInvoiceItem?.position || "after",
                                );
                                setDraggedInvoiceItem(null);
                                setDragOverInvoiceRoom(null);
                                setDragOverInvoiceItem(null);
                              }}
                            >
                              <span className="invoice-drag-handle" title="Drag to move between rooms">
                                ⋮⋮
                              </span>
                              <div className="invoice-item-info">
                                <b>{item.name}</b>
                                <small>
                                  {item.variant || item.sku || ""} · Qty {item.qty} × {money(item.price)}
                                </small>
                              </div>
                              <strong className="invoice-item-total">{money(itemTotal)}</strong>
                              {currentRooms.length > 1 && (
                                <select
                                  className="invoice-move-select"
                                  title="Move to room"
                                  value=""
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    handleInvoiceItemMove(rIdx, iIdx, Number(e.target.value));
                                  }}
                                >
                                  <option value="" disabled>
                                    Move ↷
                                  </option>
                                  {currentRooms.map((targetR, targetIdx) => (
                                    <option
                                      key={targetIdx}
                                      value={targetIdx}
                                      disabled={targetIdx === rIdx}
                                    >
                                      {targetR.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="draftcheck wide">
              <b>{quoteItems.length} lines allocated across {currentRooms.filter(r => (r.items || []).length > 0).length} room{currentRooms.filter(r => (r.items || []).length > 0).length === 1 ? "" : "s"}</b>
              <span>
                Each item's room is automatically appended to its description on the final invoice. Tax is calculated by the server.
              </span>
            </div>
          </div>
          <div className="modalactions">
            <button onClick={() => setShowDraft(false)}>Cancel</button>
            <button
              className="primary"
              disabled={
                busy ||
                !draft.customerId ||
                !draft.billingAddress ||
                !quoteItems.length
              }
              onClick={createDraft}
            >
              {busy ? "Creating…" : "Create draft invoice"}
            </button>
          </div>
        </Modal>
      )}
      {showPayment && (
        <Modal
          title="Record customer payment"
          onClose={() => setShowPayment(false)}
        >
          <div className="invoiceform">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={payment.date}
                onChange={(e) =>
                  setPayment({ ...payment, date: e.target.value })
                }
              />
            </label>
            <label>
              <span>Amount *</span>
              <input
                type="number"
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
              />
            </label>
            <label>
              <span>Payment mode</span>
              <select
                value={payment.mode}
                onChange={(e) =>
                  setPayment({ ...payment, mode: e.target.value })
                }
              >
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Cheque</option>
                <option>Cash</option>
                <option>Card</option>
              </select>
            </label>
            <label>
              <span>Reference *</span>
              <input
                value={payment.reference}
                onChange={(e) =>
                  setPayment({ ...payment, reference: e.target.value })
                }
              />
            </label>
            <label className="wide">
              <span>Notes</span>
              <input
                value={payment.notes}
                onChange={(e) =>
                  setPayment({ ...payment, notes: e.target.value })
                }
              />
            </label>
          </div>
          <div className="modalactions">
            <button onClick={() => setShowPayment(false)}>Cancel</button>
            <button className="primary" disabled={busy} onClick={recordPayment}>
              Save payment
            </button>
          </div>
        </Modal>
      )}
      {showNote && (
        <Modal
          title="Create statutory correction note"
          onClose={() => setShowNote(false)}
        >
          <div className="invoiceform">
            <label>
              <span>Note type</span>
              <select
                value={note.type}
                onChange={(e) => setNote({ ...note, type: e.target.value })}
              >
                <option>Credit</option>
                <option>Debit</option>
              </select>
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={note.date}
                onChange={(e) => setNote({ ...note, date: e.target.value })}
              />
            </label>
            <label className="wide">
              <span>Reason *</span>
              <input
                value={note.reason}
                onChange={(e) => setNote({ ...note, reason: e.target.value })}
              />
            </label>
            {(["taxableValue", "cgst", "sgst", "igst", "total"] as const).map(
              (k) => (
                <label key={k}>
                  <span>
                    {k === "taxableValue" ? "Taxable value" : k.toUpperCase()}{" "}
                    {k === "total" ? "*" : ""}
                  </span>
                  <input
                    type="number"
                    value={note[k]}
                    onChange={(e) => setNote({ ...note, [k]: e.target.value })}
                  />
                </label>
              ),
            )}
          </div>
          <div className="lockednotice">
            The original invoice remains unchanged. This note receives its own
            number and permanent audit link.
          </div>
          <div className="modalactions">
            <button onClick={() => setShowNote(false)}>Cancel</button>
            <button className="primary" disabled={busy} onClick={createNote}>
              Create linked note
            </button>
          </div>
        </Modal>
      )}
      {showFinalise && selected && (
        <Modal
          title="Finalise and permanently lock invoice"
          onClose={() => setShowFinalise(false)}
        >
          <div className="invoicefinaliseconfirm">
            <div className="lockicon">&#128274;</div>
            <div>
              <b>This action cannot be undone</b>
              <p>
                Techomie OS will assign the next consecutive tax invoice number
                and permanently lock the customer, items, tax values and total.
              </p>
            </div>
            <dl>
              <div>
                <dt>Customer</dt>
                <dd>{selected.customer_name}</dd>
              </div>
              <div>
                <dt>Invoice value</dt>
                <dd>{money(selected.grand_total)}</dd>
              </div>
              <div>
                <dt>Invoice date</dt>
                <dd>{selected.invoice_date}</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>Draft</dd>
              </div>
            </dl>
            <div className="lockednotice">
              After finalisation, corrections must be issued through a linked
              credit note or debit note. The original invoice can never be
              edited or deleted.
            </div>
          </div>
          <div className="modalactions">
            <button onClick={() => setShowFinalise(false)}>
              Keep as draft
            </button>
            <button className="primary" disabled={busy} onClick={finalise}>
              {busy ? "Finalising…" : "Finalise & permanently lock"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modalback">
      <div className="modal invoice-modal">
        <div className="modalhead">
          <div>
            <small>TECHOMIE OS</small>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function invoiceSnapshot(invoice: Invoice) {
  try { return typeof invoice.snapshot === "string" ? JSON.parse(invoice.snapshot) : (invoice.snapshot || {}); } catch { return {}; }
}
function invoiceTemplate(invoice: Invoice, branding: Record<string, any>) {
  return String(invoiceSnapshot(invoice).templateId || branding.defaultInvoiceTemplate || "executive");
}
function InvoicePaper({ invoice: i, branding, zoom = "fit" }: { invoice: Invoice; branding: Record<string, any>; zoom?: string }) {
  const items = i.items || [],
    payments = i.payments || [],
    notes = i.notes || [],
    templateId = invoiceTemplate(i, branding),
    paperStyle = {
      "--doc-primary": branding.primaryColour || "#0aa9e8",
      "--doc-secondary": branding.secondaryColour || "#071522",
      "--doc-accent": branding.accentColour || "#c8aa72",
      fontFamily: branding.pdfFont || "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    } as CSSProperties;

  const isPaid = Number(i.balance || 0) <= 0 && Number(i.paid || 0) > 0;
  const isPartial = Number(i.paid || 0) > 0 && Number(i.balance || 0) > 0;
  const statusLabel =
    i.status === "Draft"
      ? "DRAFT"
      : isPaid
        ? "PAID IN FULL"
        : isPartial
          ? "PARTIALLY PAID"
          : "PAYMENT DUE";
  const statusClass =
    i.status === "Draft"
      ? "draft"
      : isPaid
        ? "paid"
        : isPartial
          ? "partial"
          : "due";

  return (
    <article
      className={`taxinvoicepaper invoicetemplate-${templateId} zoom-${zoom}`}
      id="tax-invoice-paper"
      style={paperStyle}
    >
      {/* Top Brand & Title Bar */}
      <div className="invpaperhead">
        <div className="paperbrand">
          <img src="/techomie-logo.jpg" alt="Techomie" />
          <div>
            <b>{branding.header || "TECHOMIE SMART DEVICES"}</b>
            <span>
              356/2, Church Rd, Sri Murugan Nagar, Phase II, Cheran ma Nagar,
              COIMBATORE Tamil Nadu 641048, India
            </span>
            <span style={{ display: "block", fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
              Ph: 07598883121 · info.techomie@gmail.com · https://www.techomie.com/
            </span>
            <div className="gstinbadge">
              <small>GSTIN:</small> <strong>33GIMPP4721H1Z2</strong>
              <small style={{ marginLeft: "10px" }}>STATE CODE:</small>{" "}
              <strong>33 (Tamil Nadu)</strong>
            </div>
          </div>
        </div>
        <div className="papertitle">
          <div className="doctitlebadge">ORIGINAL FOR RECIPIENT</div>
          <h2>TAX INVOICE</h2>
          <b>{i.number || "DRAFT — NOT A TAX INVOICE"}</b>
          <span className={`invstatuspill ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* 3-Column Party & Supply Info */}
      <div className="paperinfogrid">
        <div className="infocard">
          <small>BILL TO (BUYER / RECIPIENT)</small>
          <b>{i.customer_name as string}</b>
          <p>{(i.billing_address as string) || "Address on record"}</p>
          <div className="infometa">
            <span>GSTIN:</span>{" "}
            <strong>
              {(i.customer_gstin as string) || "Unregistered (B2C)"}
            </strong>
          </div>
        </div>

        <div className="infocard">
          <small>SHIP TO (INSTALLATION SITE)</small>
          <b>{i.customer_name as string}</b>
          <p>
            {(i.shipping_address as string) ||
              (i.billing_address as string) ||
              "Site address on record"}
          </p>
        </div>

        <div className="infocard meta">
          <small>INVOICE &amp; SUPPLY METADATA</small>
          <div className="metarow">
            <span>Invoice Date:</span> <b>{i.invoice_date as string}</b>
          </div>
          <div className="metarow">
            <span>Due Date:</span> <b>{(i.due_date as string) || "—"}</b>
          </div>
          <div className="metarow">
            <span>Place of Supply:</span>{" "}
            <b>
              {(i.place_of_supply as string) || "Tamil Nadu"} (
              {(i.place_of_supply_code as string) || "33"})
            </b>
          </div>
          <div className="metarow">
            <span>Supply Type:</span>{" "}
            <b>{i.supply_type as string || "Intra-State (CGST + SGST)"}</b>
          </div>
          <div className="metarow">
            <span>Reverse Charge:</span> <b>No</b>
          </div>
        </div>
      </div>

      {/* Fixed Mathematical HTML Line Items Table */}
      <div className="invtablewrap">
        <table className="invoicetable">
          <thead>
            <tr>
              <th style={{ width: "24px", textAlign: "center" }}>#</th>
              <th style={{ textAlign: "left" }}>ITEM &amp; DESCRIPTION</th>
              <th style={{ width: "52px", textAlign: "center" }}>HSN/SAC</th>
              <th style={{ width: "36px", textAlign: "center" }}>UQC</th>
              <th style={{ width: "34px", textAlign: "center" }}>QTY</th>
              <th style={{ width: "66px", textAlign: "right" }}>RATE</th>
              <th style={{ width: "38px", textAlign: "center" }}>DISC.</th>
              <th style={{ width: "72px", textAlign: "right" }}>TAXABLE</th>
              <th style={{ width: "42px", textAlign: "center" }}>GST %</th>
              <th style={{ width: "78px", textAlign: "right" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x, n) => (
              <tr key={String(x.id || n)}>
                <td style={{ textAlign: "center", color: "#64748b" }}>
                  {n + 1}
                </td>
                <td>
                  <b className="itemdesc">{x.description as string}</b>
                  {x.sku && <span className="itemsku">{x.sku as string}</span>}
                </td>
                <td style={{ textAlign: "center", fontFamily: "monospace" }}>
                  {(x.hsn_sac as string) || "853650"}
                </td>
                <td style={{ textAlign: "center", color: "#64748b" }}>
                  {(x.uqc as string) || "NOS"}
                </td>
                <td style={{ textAlign: "center", fontWeight: 600 }}>
                  {Number(x.quantity)}
                </td>
                <td style={{ textAlign: "right" }}>{money(x.rate)}</td>
                <td style={{ textAlign: "center" }}>
                  {Number(x.discount_rate || 0) > 0
                    ? `${x.discount_rate}%`
                    : "—"}
                </td>
                <td style={{ textAlign: "right" }}>{money(x.taxable_value)}</td>
                <td style={{ textAlign: "center", fontWeight: 700, color: "#0369a1" }}>
                  <span className="gstpill">{Number(x.gst_rate)}%</span>
                </td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>
                  {money(x.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dual Totals Block */}
      <div className="invsummarybox">
        {/* Left: Words + Bank Account */}
        <div className="invsummaryleft">
          <div className="amountwordsbox">
            <small>AMOUNT IN WORDS (INR):</small>
            <b>{(i.amount_words as string) || "Rupees Only"}</b>
          </div>

          <div className="invbankbox">
            <div className="invbanktitle">BANK PAYMENT DETAILS</div>
            <div className="invbankgrid">
              <div>
                <span>Account Name:</span> <b>Techomie Smart Devices</b>
              </div>
              <div>
                <span>Bank:</span> <b>Bank of India</b>
              </div>
              <div>
                <span>A/C No:</span> <b>824320110000389</b>
              </div>
              <div>
                <span>IFSC:</span> <b>BKID0008243</b>
              </div>
              <div>
                <span>Branch:</span> <b>Peelamedu, Coimbatore</b>
              </div>
              <div>
                <span>Account Type:</span> <b>Current Account</b>
              </div>
              <div>
                <span>UPI ID:</span> <b>7598883121@ybl</b>
              </div>
            </div>
            <p className="invtermstext">
              Payment terms:{" "}
              {(i.payment_terms as string) ||
                "Payment due within stated period. Goods remain Techomie property until full settlement."}
            </p>
          </div>
        </div>

        {/* Right: Calculations Breakdown */}
        <div className="invsummaryright">
          <div className="invcalcrow">
            <span>Taxable Value</span>
            <b>{money(i.taxable_total)}</b>
          </div>
          {Number(i.cgst_total || 0) > 0 && (
            <div className="invcalcrow">
              <span>CGST (9%)</span>
              <b>{money(i.cgst_total)}</b>
            </div>
          )}
          {Number(i.sgst_total || 0) > 0 && (
            <div className="invcalcrow">
              <span>SGST (9%)</span>
              <b>{money(i.sgst_total)}</b>
            </div>
          )}
          {Number(i.igst_total || 0) > 0 && (
            <div className="invcalcrow">
              <span>IGST (18%)</span>
              <b>{money(i.igst_total)}</b>
            </div>
          )}
          {Number(i.round_off || 0) !== 0 && (
            <div className="invcalcrow">
              <span>Round Off</span>
              <b>{money(i.round_off)}</b>
            </div>
          )}
          <div className="invgrandtotalrow">
            <span>Grand Total</span>
            <strong>{money(i.grand_total)}</strong>
          </div>
          <div className="invcalcrow paid">
            <span>Amount Paid</span>
            <b>{money(i.paid)}</b>
          </div>
          <div className="invcalcrow balance">
            <span>Balance Due</span>
            <b>{money(i.balance)}</b>
          </div>
        </div>
      </div>

      {/* Linked Payments or Credit Notes if any */}
      {(payments.length > 0 || notes.length > 0) && (
        <div className="paperhistory">
          <b>Linked Transactions:</b>
          {payments.map((p) => (
            <span key={String(p.id)}>
              ✓ Payment Received: {money(p.amount)} on {p.date as string} (
              {p.mode as string}) · Ref: {(p.reference as string) || "N/A"}
            </span>
          ))}
          {notes.map((n) => (
            <span key={String(n.id)}>
              Credit Note {n.number as string}: {money(n.total)} ·{" "}
              {n.reason as string}
            </span>
          ))}
        </div>
      )}

      {/* Signature & Declaration Footer */}
      <div className="invpaperfooter">
        <div className="invdeclaration">
          <b>DECLARATION:</b>
          <span>
            We declare that this invoice shows the actual price of the goods and
            services described and that all particulars are true and correct.
          </span>
        </div>
        <div className="invsignbox">
          <span>For Techomie Smart Devices</span>
          <div className="invsignspace">
            {branding.signature && (
              <img
                src={branding.signature}
                alt="Sign"
                style={{ maxHeight: "36px" }}
              />
            )}
          </div>
          <div className="invsignline">Authorised Signatory</div>
        </div>
      </div>

      <div className="paperlock">
        {i.status === "Draft"
          ? "DRAFT PREVIEW — VERIFY GST & QUANTITY DETAILS BEFORE FINALISATION"
          : "Digitally Locked Business Record · Generated by Techomie Flow"}
      </div>
    </article>
  );
}
