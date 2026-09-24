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
  "Projects",
  "Activity Timeline",
  "Leads",
  "Quotations",
  "Invoices",
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
    [createBusy, setCreateBusy] = useState(false),
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
    try {
      const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
      const r = await fetch(`/api/customers?${p}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to load customers (${r.status})`);
        return;
      }
      const d = await r.json();
      setRows(Array.isArray(d.customers) ? d.customers : []);
      setUsers(Array.isArray(d.users) ? d.users : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to connect to server. Please check your connection or restart the dev server.");
    }
  };
  useEffect(() => {
    load();
  }, [filter]);
  const open = async (id: any) => {
    try {
      const r = await fetch(`/api/customers?id=${id}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || `Failed to load customer (${r.status})`);
        return;
      }
      const d = await r.json();
      setDetail(d);
      setTab("Overview");
    } catch (e: any) {
      setMsg(e?.message || "Unable to reach server");
    }
  };
  const create = async (force = false) => {
    setCreateBusy(true);
    try {
      const r = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, allowDuplicate: force }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 409 && confirm(`${d.error}. Create anyway?`)) {
        setCreateBusy(false);
        return create(true);
      }
      if (!r.ok) {
        setMsg(d.error || "Failed to create customer");
        return;
      }
      setShow(false);
      setForm(blank);
      setMsg(`${d.customer?.customerCode || d.customer?.customer_code || "Customer"} created successfully`);
      if (d.detail) {
        setDetail(d.detail);
        setTab("Overview");
      }
      if (d.customer) {
        setRows((prev) => [d.customer, ...prev.filter((x) => x.id !== d.customer.id)]);
      }
      load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to create customer");
    } finally {
      setCreateBusy(false);
    }
  };
  const action = async (p: R) => {
    if (!detail?.customer?.id) return false;
    const customerId = detail.customer.id;
    try {
      const r = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: customerId, ...p }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.error || "Failed to update customer");
        return false;
      }
      setMsg("Customer record updated");
      await open(customerId);
      await load();
      return true;
    } catch (e: any) {
      setMsg(e?.message || "Network error while updating customer");
      return false;
    }
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
    if (!detail?.customer?.id) return;
    const customerId = detail.customer.id;
    try {
      const f = new FormData();
      f.set("customerId", customerId);
      f.set("file", file);
      f.set("kind", "Customer document");
      const r = await fetch("/api/customers/attachments", {
        method: "POST",
        body: f,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(d.error || "Upload failed");
      setMsg("Document uploaded permanently");
      open(customerId);
    } catch (e: any) {
      setMsg(e?.message || "Network error while uploading document");
    }
  };
  const deleteCustomer = async (id: number | string) => {
    if (!confirm(`Permanently delete customer "${detail?.customer?.name || id}" and all associated data? This action cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.error || "Unable to delete customer");
        return;
      }
      setMsg("Customer permanently deleted");
      setDetail(null);
      load();
    } catch (e: any) {
      setMsg(e?.message || "Network error while deleting customer");
    }
  };
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
          <small>Active projects</small>
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
      </div>
      <div className="customertable">
        <div className={`customerrow customerhead ${role === "admin" ? "admin" : ""}`}>
          <span>Customer</span>
          <span>Contact</span>
          <span>City / Projects</span>
          <span>Status / Owner</span>
          <span>Invoiced</span>
          <span>Balance</span>
          {role === "admin" && <span className="headeractions">Actions</span>}
        </div>
        {rows.map((c) => (
          <div
            className={`customerrow ${role === "admin" ? "admin" : ""}`}
            key={c.id}
            onClick={() => open(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(c.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span>
              <b>{c.display_name || c.name || c.primary_contact || `Customer #${c.id}`}</b>
              <small>
                {c.customer_code || (c.id ? `TCM-CUS-${String(c.id).padStart(6, "0")}` : `CUS-${c.id}`)} · {c.customer_type}
              </small>
            </span>
            <span>
              <b>{c.phone || "—"}</b>
              <small>{c.email || c.whatsapp || "No contact info"}</small>
            </span>
            <span>
              <b>{c.city || "—"}</b>
              <small>{c.site_count} projects</small>
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
            {role === "admin" && (
              <span className="custactioncell">
                <button
                  type="button"
                  className="custopenbtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    open(c.id);
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="custdelbtn"
                  title="Permanently delete customer"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustomer(c.id);
                  }}
                >
                  🗑 Delete
                </button>
              </span>
            )}
          </div>
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
              <button type="button" disabled={createBusy} onClick={() => setShow(false)}>Cancel</button>
              <button
                type="button"
                className="primary"
                disabled={createBusy || !form.name.trim()}
                onClick={() => create()}
              >
                {createBusy ? "Creating customer…" : "Create permanent customer"}
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
                <small>NEW PROJECT</small>
                <h2>Add project for {detail.customer.display_name || detail.customer.name}</h2>
              </div>
              <button onClick={() => setShowSite(false)}>×</button>
            </header>
            <SiteForm v={siteForm} set={setSiteForm} />
            <div className="customeractions">
              <button onClick={() => setShowSite(false)}>Cancel</button>
              <button
                className="primary"
                disabled={siteBusy || !siteForm.name.trim() || !siteForm.address.trim()}
                onClick={saveSite}
              >
                {siteBusy ? "Saving project…" : "Save project"}
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
            <button onClick={addSite}>Add project</button>
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
            {role === "admin" && (
              <button
                style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
                onClick={() => deleteCustomer(detail.customer.id)}
              >
                🗑 Delete customer
              </button>
            )}
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
      {input("name", "Project name", true)}
      {input("address", "Project address", true)}
      {input("city", "City", true)}
      {input("state", "State", true)}
      {input("pincode", "Pincode")}
      {input("mapsUrl", "Google Maps link", false, "url")}
      {input("contactName", "Project contact person")}
      {input("contactPhone", "Project contact phone", false, "tel")}
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
      {f("phone", "Primary phone")}
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
      "Activity Timeline": d.activity,
      Leads: d.leads,
      Quotations: d.quotations,
      Invoices: d.invoices,
      Projects: (d.projects && d.projects.length) ? d.projects : (d.sites || []),
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
                  x.address ||
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
            : tab === "Projects"
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
