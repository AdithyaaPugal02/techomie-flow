"use client";
import { useEffect, useState } from "react";
type R = Record<string, any>;
const money = (v: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const blank = {
  customerType: "Individual",
  name: "",
  displayName: "",
  primaryContact: "",
  phone: "",
  whatsapp: "",
  email: "",
  alternatePhone: "",
  gstin: "",
  pan: "",
  billingAddress: "",
  city: "",
  state: "Tamil Nadu",
  pincode: "",
  country: "India",
  leadSource: "",
  assignedTo: "",
  status: "Prospect",
  notes: "",
  tags: [] as string[],
};
const tabs = [
  "Overview",
  "Contacts",
  "Sites",
  "Activity Timeline",
  "Leads",
  "Quotations",
  "Invoices",
  "Projects",
  "Payments",
  "Warranty & Service",
  "Documents",
  "Notes",
];
export default function CustomersModule({
  role,
  initialFilter,
  onNavigate,
}: {
  role: string;
  initialFilter: R;
  onNavigate: (x: string) => void;
}) {
  const [rows, setRows] = useState<R[]>([]),
    [users, setUsers] = useState<R[]>([]),
    [filter, setFilter] = useState({
      q: initialFilter.id || "",
      status: "",
      city: "",
      assigned: "",
    }),
    [detail, setDetail] = useState<R | null>(null),
    [tab, setTab] = useState("Overview"),
    [show, setShow] = useState(false),
    [showSite, setShowSite] = useState(false),
    [showNote, setShowNote] = useState(false),
    [noteContent, setNoteContent] = useState(""),
    [noteBusy, setNoteBusy] = useState(false),
    [siteBusy, setSiteBusy] = useState(false),
    [siteForm, setSiteForm] = useState<R>({
      name: "",
      address: "",
      city: "Coimbatore",
      state: "Tamil Nadu",
      pincode: "",
      mapsUrl: "",
      contactName: "",
      contactPhone: "",
      propertyType: "Villa",
      constructionStage: "Planning",
      floors: "",
      neutralWire: "Unknown",
      electricalReadiness: "Not checked",
      networkDetails: "",
      accessRequirements: "",
      surveyNotes: "",
    }),
    [form, setForm] = useState<R>(blank),
    [msg, setMsg] = useState("");
  const load = async () => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
    const r = await fetch(`/api/customers?${p}`),
      d = await r.json();
    if (r.ok) {
      setRows(d.customers);
      setUsers(d.users || []);
    } else setMsg(d.error);
  };
  useEffect(() => {
    load();
  }, [filter]);
  const open = async (id: any) => {
    const r = await fetch(`/api/customers?id=${id}`),
      d = await r.json();
    if (r.ok) {
      setDetail(d);
      setTab("Overview");
    } else setMsg(d.error);
  };
  const create = async (force = false) => {
    const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, allowDuplicate: force }),
      }),
      d = await r.json();
    if (r.status === 409 && confirm(`${d.error}. Create anyway?`))
      return create(true);
    if (!r.ok) return setMsg(d.error);
    setShow(false);
    setForm(blank);
    setMsg(`${d.customer.customerCode} created`);
    load();
    open(d.customer.id);
  };
  const action = async (p: R) => {
    const r = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: detail.customer.id, ...p }),
      }),
      d = await r.json();
    if (!r.ok) {
      setMsg(d.error);
      return false;
    }
    setMsg("Customer record updated");
    await open(detail.customer.id);
    await load();
    return true;
  };
  const addContact = () => {
    const name = prompt("Contact name"),
      phone = name && prompt("Phone number"),
      designation = name && prompt("Role / designation", "Site contact");
    if (name && phone)
      action({ action: "contact", name, phone, designation, primary: false });
  };
  const addSite = () => setShowSite(true);
  const saveSite = async () => {
    if (!siteForm.name.trim() || !siteForm.address.trim()) {
      setMsg("Site name and full address are required");
      return;
    }
    setSiteBusy(true);
    const ok = await action({
      action: "site",
      ...siteForm,
      floors: siteForm.floors
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean),
    });
    setSiteBusy(false);
    if (ok) {
      setShowSite(false);
      setTab("Sites");
      setSiteForm({
        name: "",
        address: "",
        city: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "",
        mapsUrl: "",
        contactName: "",
        contactPhone: "",
        propertyType: "Villa",
        constructionStage: "Planning",
        floors: "",
        neutralWire: "Unknown",
        electricalReadiness: "Not checked",
        networkDetails: "",
        accessRequirements: "",
        surveyNotes: "",
      });
      setMsg("Site added successfully");
    }
  };
  const addNote = () => {
    setNoteContent("");
    setShowNote(true);
  };
  const saveNote = async () => {
    const content = noteContent.trim();
    if (!content) return setMsg("Enter a note before saving");
    setNoteBusy(true);
    const ok = await action({ action: "note", content });
    setNoteBusy(false);
    if (ok) {
      setShowNote(false);
      setNoteContent("");
      setTab("Notes");
      setMsg("Private customer note saved");
    }
  };
  const upload = async (file: File) => {
    const f = new FormData();
    f.set("customerId", detail.customer.id);
    f.set("file", file);
    f.set("kind", "Customer document");
    const r = await fetch("/api/customers/attachments", {
        method: "POST",
        body: f,
      }),
      d = await r.json();
    if (!r.ok) return setMsg(d.error);
    setMsg("Document uploaded permanently");
    open(detail.customer.id);
  };
  if (role === "technician" && !detail)
    return (
      <div className="modulepage">
        <h1>Customers</h1>
        <p>
          Customer contact details appear only through your assigned projects
          and service tickets.
        </p>
      </div>
    );
  return (
    <div className="customersmaster">
      <div className="customerhero">
        <div>
          <small>PERMANENT CUSTOMER MASTER</small>
          <h1>Customers</h1>
          <p>
            One profile for every site, contact, quote, invoice, project,
            payment and service record.
          </p>
        </div>
        {role !== "technician" && (
          <button className="primary" onClick={() => setShow(true)}>
            ＋ Add Customer
          </button>
        )}
      </div>
      {msg && (
        <div className="customermsg">
          {msg}
          <button onClick={() => setMsg("")}>×</button>
        </div>
      )}
      <div className="customerstats">
        <button>
          <small>Customers</small>
          <b>{rows.length}</b>
        </button>
        <button>
          <small>Active sites</small>
          <b>{rows.reduce((a, x) => a + Number(x.site_count), 0)}</b>
        </button>
        <button>
          <small>Total invoiced</small>
          <b>{money(rows.reduce((a, x) => a + Number(x.invoiced), 0))}</b>
        </button>
        <button>
          <small>Receivables</small>
          <b>{money(rows.reduce((a, x) => a + Number(x.balance), 0))}</b>
        </button>
      </div>
      <div className="customertools">
        <input
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Customer ID, name, phone, WhatsApp, email or GSTIN"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {["Prospect", "Active", "Inactive", "Archived"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          placeholder="City"
          value={filter.city}
          onChange={(e) => setFilter({ ...filter, city: e.target.value })}
        />
        {role === "admin" && (
          <select
            value={filter.assigned}
            onChange={(e) => setFilter({ ...filter, assigned: e.target.value })}
          >
            <option value="">All employees</option>
            {users.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="customertable">
        <div className="customerrow customerhead">
          <span>Customer</span>
          <span>Contact</span>
          <span>City / Sites</span>
          <span>Status / Owner</span>
          <span>Invoiced</span>
          <span>Balance</span>
        </div>
        {rows.map((c) => (
          <button className="customerrow" key={c.id} onClick={() => open(c.id)}>
            <span>
              <b>{c.display_name || c.name}</b>
              <small>
                {c.customer_code || `CUS-${c.id}`} · {c.customer_type}
              </small>
            </span>
            <span>
              <b>{c.phone}</b>
              <small>{c.email || c.whatsapp}</small>
            </span>
            <span>
              <b>{c.city || "—"}</b>
              <small>{c.site_count} sites</small>
            </span>
            <span>
              <em>{c.status}</em>
              <small>{c.assigned_name || "Unassigned"}</small>
            </span>
            <span>
              <b>{money(c.invoiced)}</b>
            </span>
            <span>
              <b>{money(c.balance)}</b>
            </span>
          </button>
        ))}
      </div>
      {show && (
        <div className="modalback">
          <div className="customermodal">
            <header>
              <h2>Add Customer</h2>
              <button onClick={() => setShow(false)}>×</button>
            </header>
            <CustomerForm v={form} set={setForm} users={users} />
            <div className="customeractions">
              <button onClick={() => setShow(false)}>Cancel</button>
              <button className="primary" onClick={() => create()}>
                Create permanent customer
              </button>
            </div>
          </div>
        </div>
      )}
      {showSite && detail && (
        <div className="modalback">
          <div className="customermodal sitemodal">
            <header>
              <div>
                <small>NEW CUSTOMER SITE</small>
                <h2>Add site for {detail.customer.display_name || detail.customer.name}</h2>
              </div>
              <button onClick={() => setShowSite(false)}>Ã—</button>
            </header>
            <SiteForm v={siteForm} set={setSiteForm} />
            <div className="customeractions">
              <button onClick={() => setShowSite(false)}>Cancel</button>
              <button
                className="primary"
                disabled={siteBusy || !siteForm.name.trim() || !siteForm.address.trim()}
                onClick={saveSite}
              >
                {siteBusy ? "Saving siteâ€¦" : "Save permanent site"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showNote && detail && (
        <div className="modalback">
          <form
            className="customermodal notemodal"
            onSubmit={(e) => {
              e.preventDefault();
              saveNote();
            }}
          >
            <header>
              <div>
                <small>PRIVATE CUSTOMER NOTE</small>
                <h2>Add note for {detail.customer.display_name || detail.customer.name}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowNote(false)}>&times;</button>
            </header>
            <label className="noteeditor">
              <span>Note *</span>
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write the discussion, decision, requirement or internal follow-up note"
              />
              <small>This note is internal and appears in the customer's Notes and Activity Timeline.</small>
            </label>
            <div className="customeractions">
              <button type="button" onClick={() => setShowNote(false)}>Cancel</button>
              <button type="submit" className="primary" disabled={noteBusy || !noteContent.trim()}>
                {noteBusy ? "Saving…" : "Save private note"}
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && (
        <div className="customerdrawer">
          <header>
            <div>
              <small>{detail.customer.customer_code}</small>
              <h2>{detail.customer.display_name || detail.customer.name}</h2>
              <p>
                {detail.customer.phone} · {detail.customer.city} ·{" "}
                {detail.customer.status}
              </p>
            </div>
            <button onClick={() => setDetail(null)}>×</button>
          </header>
          <div className="customerquick">
            <button onClick={addContact}>Add contact</button>
            <button onClick={addSite}>Add site</button>
            <button onClick={() => onNavigate("Leads")}>Add lead</button>
            <button onClick={() => onNavigate("Quotations")}>
              Create quote
            </button>
            <button onClick={() => onNavigate("Invoices")}>
              Create invoice
            </button>
            <button onClick={() => onNavigate("Payments")}>
              Record payment
            </button>
            <button onClick={addNote}>Add note</button>
            <label>
              Upload document
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
            </label>
          </div>
          <nav>
            {tabs.map((x) => (
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
            <CustomerTab
              tab={tab}
              d={detail}
              openModule={onNavigate}
              addContact={addContact}
              addSite={addSite}
              addNote={addNote}
            />
          </main>
        </div>
      )}
    </div>
  );
}
function SiteForm({ v, set }: { v: R; set: (v: R) => void }) {
  const input = (key: string, label: string, required = false, type = "text") => (
    <label className={["address", "surveyNotes", "networkDetails", "accessRequirements"].includes(key) ? "wide" : ""}>
      <span>{label}{required ? " *" : ""}</span>
      {key === "address" || key === "surveyNotes" || key === "networkDetails" || key === "accessRequirements" ? (
        <textarea required={required} value={v[key] || ""} onChange={(e) => set({ ...v, [key]: e.target.value })} />
      ) : (
        <input type={type} required={required} value={v[key] || ""} onChange={(e) => set({ ...v, [key]: e.target.value })} />
      )}
    </label>
  );
  return (
    <div className="customerform siteform">
      {input("name", "Site name", true)}
      {input("address", "Full site address", true)}
      {input("city", "City", true)}
      {input("state", "State", true)}
      {input("pincode", "Pincode")}
      {input("mapsUrl", "Google Maps link", false, "url")}
      {input("contactName", "Site contact person")}
      {input("contactPhone", "Site contact phone", false, "tel")}
      <label><span>Property type</span><select value={v.propertyType} onChange={e=>set({...v,propertyType:e.target.value})}>{["Villa","Apartment","Office","Commercial","Hotel","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label><span>Construction stage</span><select value={v.constructionStage} onChange={e=>set({...v,constructionStage:e.target.value})}>{["Planning","Under construction","Wiring stage","Finishing","Ready for installation","Occupied"].map(x=><option key={x}>{x}</option>)}</select></label>
      {input("floors", "Floors (comma separated)")}
      <label><span>Neutral wire</span><select value={v.neutralWire} onChange={e=>set({...v,neutralWire:e.target.value})}><option>Unknown</option><option>Available</option><option>Not available</option><option>Partial</option></select></label>
      <label><span>Electrical readiness</span><select value={v.electricalReadiness} onChange={e=>set({...v,electricalReadiness:e.target.value})}><option>Not checked</option><option>Ready</option><option>Partially ready</option><option>Not ready</option></select></label>
      {input("networkDetails", "Wi-Fi / network details")}
      {input("accessRequirements", "Site access requirements")}
      {input("surveyNotes", "Survey notes")}
    </div>
  );
}

function CustomerForm({
  v,
  set,
  users,
}: {
  v: R;
  set: (x: R) => void;
  users: R[];
}) {
  const f = (k: string, l: string) => (
    <label>
      <span>{l}</span>
      <input
        value={v[k] || ""}
        onChange={(e) => set({ ...v, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="customerform">
      <label>
        <span>Customer type</span>
        <select
          value={v.customerType}
          onChange={(e) => set({ ...v, customerType: e.target.value })}
        >
          {[
            "Individual",
            "Company",
            "Builder",
            "Architect",
            "Contractor",
            "Dealer",
            "Other",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {f("name", "Customer / company name *")}
      {f("displayName", "Display name")}
      {f("primaryContact", "Primary contact person")}
      {f("phone", "Primary phone *")}
      {f("whatsapp", "WhatsApp")}
      {f("email", "Email")}
      {f("alternatePhone", "Alternate phone")}
      {f("gstin", "GSTIN")}
      {f("pan", "PAN")}
      <label className="wide">
        <span>Billing address</span>
        <textarea
          value={v.billingAddress}
          onChange={(e) => set({ ...v, billingAddress: e.target.value })}
        />
      </label>
      {f("city", "City")}
      {f("state", "State")}
      {f("pincode", "Pincode")}
      {f("country", "Country")}
      {f("leadSource", "Lead source")}
      <label>
        <span>Assigned sales person</span>
        <select
          value={v.assignedTo}
          onChange={(e) => set({ ...v, assignedTo: e.target.value })}
        >
          <option value="">Assign to me</option>
          {users.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Status</span>
        <select
          value={v.status}
          onChange={(e) => set({ ...v, status: e.target.value })}
        >
          {["Prospect", "Active", "Inactive"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      {f("notes", "Notes")}
    </div>
  );
}
function CustomerTab({
  tab,
  d,
  openModule,
  addContact,
  addSite,
  addNote,
}: {
  tab: string;
  d: R;
  openModule: (x: string) => void;
  addContact: () => void;
  addSite: () => void;
  addNote: () => void;
}) {
  if (tab === "Overview")
    return (
      <>
        <div className="summarycards">
          {Object.entries(d.summary).map(([k, v]) => (
            <button
              key={k}
              onClick={() =>
                openModule(
                  k.includes("Project")
                    ? "Projects"
                    : k.includes("Service")
                      ? "Service"
                      : k.includes("site")
                        ? "Customers"
                        : k.includes("quoted") || k.includes("accepted")
                          ? "Quotations"
                          : "Invoices",
                )
              }
            >
              <small>{k.replace(/([A-Z])/g, " $1")}</small>
              <b>
                {[
                  "quoted",
                  "accepted",
                  "invoiced",
                  "received",
                  "pending",
                  "overdue",
                ].includes(k)
                  ? money(v)
                  : String(v)}
              </b>
            </button>
          ))}
        </div>
        <div className="overviewinfo">
          <section>
            <h3>Customer</h3>
            <p>{d.customer.billing_address}</p>
            <p>
              {d.customer.email} · {d.customer.whatsapp}
            </p>
            <p>GSTIN: {d.customer.gstin || "Unregistered"}</p>
          </section>
          <section>
            <h3>Ownership</h3>
            <p>{d.customer.assigned_name || "Unassigned"}</p>
            <p>Source: {d.customer.lead_source || "—"}</p>
            <p>Status: {d.customer.status}</p>
          </section>
        </div>
      </>
    );
  const map: R = {
      Contacts: d.contacts,
      Sites: d.sites,
      "Activity Timeline": d.activity,
      Leads: d.leads,
      Quotations: d.quotations,
      Invoices: d.invoices,
      Projects: d.projects,
      Payments: d.payments,
      "Warranty & Service": [...d.warranties, ...d.service, ...d.amc],
      Documents: d.documents,
      Notes: d.notes,
    },
    rows = map[tab] || [];
  return (
    <div className="customerrecords">
      {rows.length ? (
        rows.map((x: R, i: number) => (
          <article key={x.id || i}>
            <div>
              <em>{x.status || x.kind || x.type || tab}</em>
              <b>
                {x.name ||
                  x.customer_name ||
                  x.number ||
                  x.title ||
                  x.problem ||
                  x.content ||
                  x.file_name ||
                  x.action}
              </b>
              <span>
                {x.phone ||
                  x.site_name ||
                  x.date ||
                  x.created_at ||
                  x.invoice_date ||
                  ""}
              </span>
            </div>
            <strong>
              {x.grand_total
                ? money(x.grand_total)
                : x.total
                  ? money(x.total)
                  : x.amount
                    ? money(x.amount)
                    : "Open →"}
            </strong>
          </article>
        ))
      ) : (
        <div className="emptycustomer">No {tab.toLowerCase()} yet.</div>
      )}
      <button
        className="addinline"
        onClick={
          tab === "Contacts"
            ? addContact
            : tab === "Sites"
              ? addSite
              : tab === "Notes"
                ? addNote
                : () =>
                    openModule(tab === "Warranty & Service" ? "Service" : tab)
        }
      >
        ＋ Add / open {tab}
      </button>
    </div>
  );
}
