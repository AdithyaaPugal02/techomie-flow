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

export default function InvoiceModule({ rooms, details, focusId }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]),
    [customers, setCustomers] = useState<Customer[]>([]),
    [selected, setSelected] = useState<Invoice | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [showDraft, setShowDraft] = useState(false),
    [showPayment, setShowPayment] = useState(false),
    [showNote, setShowNote] = useState(false),
    [showFinalise, setShowFinalise] = useState(false),
    [branding, setBranding] = useState<Record<string, any>>({});
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
  const quoteItems = useMemo(
    () =>
      rooms.flatMap((r) =>
        r.items.map((i) => ({
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
    [rooms],
  );
  const load = async () => {
    const [ir, cr] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/customers"),
    ]);
    if (ir.ok) {
      const d = await ir.json();
      setInvoices(d.invoices || []);
    }
    if (cr.ok) {
      const d = await cr.json();
      setCustomers(d.customers || []);
    }
  };
  useEffect(() => {
    load();
    if (focusId) openInvoice(focusId);
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
              "356/2, Church Road, Sri Murugan Nagar, Phase II, Cheran Maa Nagar, Coimbatore, Tamil Nadu 641048",
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
    const html2pdf = (await import("html2pdf.js")).default;
    const worker = html2pdf()
      .set({
        margin: [7, 7, 7, 7],
        filename: `${selected.number || "Draft-Invoice"}.pdf`.replaceAll(
          "/",
          "-",
        ),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#fff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(el);
    if (save) {
      await worker.save();
      return null;
    }
    return (await worker.outputPdf("blob")) as Blob;
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
      <div className="invoiceworkspace">
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
              <button
                key={i.id}
                className={selected?.id === i.id ? "active" : ""}
                onClick={() => openInvoice(i.id)}
              >
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
              </button>
            ))
          )}
        </aside>
        <section className="invoiceviewer">
          {selected ? (
            <>
              <div className="invoiceactionbar">
                <div>
                  <label className="documenttemplateselect">
                    <span>PDF design</span>
                    <select disabled={selected.status !== "Draft"} value={invoiceTemplate(selected, branding)} onChange={e => selectTemplate(e.target.value)}>
                      {(branding.invoiceTemplates || [{id:"executive",name:"Executive Tax Invoice"},{id:"technical",name:"Technical Blue"},{id:"classic",name:"Classic GST"}]).filter((x:Record<string,any>) => x.active !== false).map((x:Record<string,any>) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>
                  <b>{selected.number || "Draft invoice"}</b>
                  <span>
                    {selected.status}
                    {selected.pdf_key ? " · Permanent PDF stored" : ""}
                  </span>
                </div>
                <div>
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
                </div>
              </div>
              <InvoicePaper invoice={selected} branding={branding} />
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
            <label>
              <span>Customer *</span>
              <select
                value={draft.customerId}
                onChange={(e) => chooseCustomer(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </label>
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
            <div className="draftcheck wide">
              <b>{quoteItems.length} quotation lines will be copied</b>
              <span>
                Tax is calculated by the server. Tamil Nadu uses CGST + SGST;
                other states use IGST.
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
function InvoicePaper({ invoice: i, branding }: { invoice: Invoice; branding: Record<string, any> }) {
  const items = i.items || [],
    payments = i.payments || [],
    notes = i.notes || [],
    templateId = invoiceTemplate(i, branding),
    paperStyle = { "--doc-primary": branding.primaryColour || "#0aa9e8", "--doc-secondary": branding.secondaryColour || "#071522", "--doc-accent": branding.accentColour || "#c8aa72", fontFamily: branding.pdfFont || "Arial" } as CSSProperties;
  return (
    <article className={`taxinvoicepaper invoicetemplate-${templateId}`} id="tax-invoice-paper" style={paperStyle}>
      <header>
        <div className="paperbrand">
          <img src="/techomie-logo.jpg" alt="Techomie" />
          <div>
            <b>{branding.header || "TECHOMIE SMART DEVICES"}</b>
            <span>
              356/2, Church Road, Sri Murugan Nagar, Phase II,
              <br />
              Cheran Maa Nagar, Coimbatore, Tamil Nadu 641048
            </span>
            <strong>GSTIN: 33GIMPP4721H1Z2</strong>
          </div>
        </div>
        <div className="papertitle">
          <small>ORIGINAL FOR RECIPIENT</small>
          <h2>TAX INVOICE</h2>
          <b>{i.number || "DRAFT — NOT A TAX INVOICE"}</b>
        </div>
      </header>
      <div className="paperinfo">
        <div>
          <small>BILL TO</small>
          <b>{i.customer_name as string}</b>
          <span>{i.billing_address as string}</span>
          <span>
            GSTIN: {(i.customer_gstin as string) || "Unregistered (B2C)"}
          </span>
        </div>
        <div>
          <small>SHIP TO</small>
          <span>{i.shipping_address as string}</span>
        </div>
        <div>
          <small>INVOICE DETAILS</small>
          <span>Date: {i.invoice_date as string}</span>
          <span>Due: {(i.due_date as string) || "—"}</span>
          <span>
            Place of supply: {i.place_of_supply as string} (
            {i.place_of_supply_code as string})
          </span>
          <span>Supply: {i.supply_type as string}</span>
        </div>
      </div>
      <div className="paperlines">
        <div className="paperrow paperhead">
          <span>#</span>
          <span>Item & description</span>
          <span>HSN/SAC</span>
          <span>UQC</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Disc.</span>
          <span>Taxable</span>
          <span>GST</span>
          <span>Amount</span>
        </div>
        {items.map((x, n) => (
          <div className="paperrow" key={String(x.id)}>
            <span>{n + 1}</span>
            <span>
              <b>{x.description as string}</b>
              <small>{x.sku as string}</small>
            </span>
            <span>{x.hsn_sac as string}</span>
            <span>{x.uqc as string}</span>
            <span>{Number(x.quantity)}</span>
            <span>{money(x.rate)}</span>
            <span>{Number(x.discount_rate || 0)}%</span>
            <span>{money(x.taxable_value)}</span>
            <span>{Number(x.gst_rate)}%</span>
            <strong>{money(x.total)}</strong>
          </div>
        ))}
      </div>
      <div className="papertotals">
        <div>
          <b>Amount in words</b>
          <span>{i.amount_words as string}</span>
          <small>
            Payment terms: {(i.payment_terms as string) || "As agreed"}
          </small>
        </div>
        <div>
          {[
            ["Taxable value", i.taxable_total],
            ["CGST", i.cgst_total],
            ["SGST", i.sgst_total],
            ["IGST", i.igst_total],
            ["Round off", i.round_off],
          ].map((x) => (
            <p key={String(x[0])}>
              <span>{x[0]}</span>
              <b>{money(x[1])}</b>
            </p>
          ))}
          <p className="papergrand">
            <span>Grand total</span>
            <b>{money(i.grand_total)}</b>
          </p>
          <p>
            <span>Paid</span>
            <b>{money(i.paid)}</b>
          </p>
          <p>
            <span>Balance due</span>
            <b>{money(i.balance)}</b>
          </p>
        </div>
      </div>
      {(payments.length > 0 || notes.length > 0) && (
        <div className="paperhistory">
          <b>Linked records</b>
          {payments.map((p) => (
            <span key={String(p.id)}>
              Payment · {p.date as string} · {p.mode as string} ·{" "}
              {p.reference as string} · {money(p.amount)}
            </span>
          ))}
          {notes.map((n) => (
            <span key={String(n.id)}>
              {n.type as string} note {n.number as string} ·{" "}
              {n.reason as string} · {money(n.total)}
            </span>
          ))}
        </div>
      )}
      <footer>
        <div>
          <b>Bank & payment details</b>
          <span>
            As specified in the accepted quotation / company bank instruction.
          </span>
        </div>
        <div>
          <span>For Techomie Smart Devices</span>
          <div className="signatureline">Authorised Signatory</div>
        </div>
      </footer>
      <div className="paperlock">
        {i.status === "Draft"
          ? "DRAFT — VERIFY BEFORE FINALISATION"
          : "Digitally locked business record · Original invoice cannot be altered"}
      </div>
    </article>
  );
}
