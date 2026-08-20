"use client";
import { useEffect, useMemo, useState } from "react";
type R = Record<string, any>;
const sections = [
  ["company", "Company Profile"],
  ["branding", "Branding and PDF Design"],
  ["banks", "Bank and Payment Details"],
  ["tax", "GST, Tax, HSN and Invoice Rules"],
  ["numbering", "Quote and Invoice Numbering"],
  ["paymentTerms", "Payment Terms"],
  ["warranty", "Warranty and Service Templates"],
  ["terms", "Terms and Conditions Templates"],
  ["users", "Manage Employees"],
  ["masters", "Items, Categories, Suppliers and Price Rules"],
  ["workflows", "Workflow and Status Settings"],
  ["notifications", "Notifications and Reminders"],
  ["integrations", "Integrations"],
  ["security", "Data Backup, Security and Audit Logs"],
  ["production", "Domain and Production Settings"],
  ["danger", "Advanced / Danger Zone"],
] as const;
const labels: R = {
  legalName: "Company legal name",
  displayName: "Display name",
  brandName: "Brand name",
  gstin: "GSTIN",
  pan: "PAN",
  address: "Registered address",
  placeOfSupply: "Default place of supply",
  financialYearStart: "Financial year starts",
  financialYearEnd: "Financial year ends",
  timeZone: "Time zone",
  primaryColour: "Primary colour",
  secondaryColour: "Secondary colour",
  pdfFont: "PDF font",
  showBank: "Show bank details",
  showStandardImages: "Show product images",
  quotePrefix: "Quotation prefix",
  invoicePrefix: "Invoice prefix",
  creditPrefix: "Credit note prefix",
  debitPrefix: "Debit note prefix",
  quoteStart: "Quotation starting number",
  invoiceStart: "Invoice starting number",
  quoteValidity: "Default quote validity (days)",
  pricingMode: "Default GST pricing",
  dueDays: "Default invoice due days",
  rounding: "Rounding rule",
  employeeDiscountLimit: "Employee discount limit (%)",
  approvalDiscountLimit: "Approval-required discount (%)",
  defaultFollowupDays: "Default follow-up days",
  url: "Production URL",
  sslStatus: "SSL status",
  lastBackup: "Last successful backup",
  lastRestoreTest: "Last restore test",
  applicationVersion: "Application version",
  databaseStatus: "Database status",
  storageStatus: "File storage status",
  backupFrequency: "Backup frequency",
};
const title = (key: string) =>
  labels[key] ||
  key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
export default function SettingsModule({
  role,
  currentEmail,
}: {
  role: string;
  currentEmail: string;
}) {
  const [active, setActive] = useState(
      role === "admin" ? "company" : "profile",
    ),
    [settings, setSettings] = useState<R>({}),
    [profile, setProfile] = useState<R>({}),
    [audit, setAudit] = useState<R[]>([]),
    [system, setSystem] = useState<R>({}),
    [users, setUsers] = useState<R[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = async () => {
    const r = await fetch(
        `/api/settings?audit=${active === "security" ? 1 : 0}`,
      ),
      d = await r.json();
    if (!r.ok) {
      setNotice(d.error);
      return;
    }
    setSettings(d.settings || {});
    setProfile(d.profile || {});
    setAudit(d.audit || []);
    setSystem(d.system || {});
    if (role === "admin") {
      const ur = await fetch("/api/users"),
        ud = await ur.json();
      if (ur.ok) setUsers(ud.users || []);
    }
  };
  useEffect(() => {
    load();
  }, [active]);
  const save = async () => {
    setBusy(true);
    const body =
        role === "admin"
          ? { action: "save", key: active, value: settings[active] }
          : {
              action: "profile",
              profile,
              password: profile.password || undefined,
            },
      r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await r.json();
    setBusy(false);
    setNotice(
      r.ok ? "Settings saved and applied" : d.error || "Unable to save",
    );
    if (r.ok) load();
  };
  const setValue = (key: string, value: any) =>
    setSettings({
      ...settings,
      [active]: { ...settings[active], [key]: value },
    });
  const upload = async (key: string, file?: File) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch("/api/uploads", { method: "POST", body: fd }),
      d = await r.json();
    if (r.ok) setValue(key, d.url);
    else setNotice(d.error || "Upload failed");
  };
  if (role !== "admin")
    return (
      <div className="settingspage profile-settings">
        <header>
          <div>
            <small>MY ACCOUNT</small>
            <h1>Profile settings</h1>
            <p>
              Update your own profile, password and notification preference.
            </p>
          </div>
          <button className="primary" onClick={save}>
            Save profile
          </button>
        </header>
        <div className="settingscard settingsform">
          <Field label="Name">
            <input
              value={profile.name || ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input disabled value={profile.email || currentEmail} />
          </Field>
          <Field label="Phone">
            <input
              value={profile.phone || ""}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              minLength={10}
              value={profile.password || ""}
              onChange={(e) =>
                setProfile({ ...profile, password: e.target.value })
              }
              placeholder="Leave blank to keep current password"
            />
          </Field>
          <Field label="Profile image">
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append("image", f);
                const r = await fetch("/api/uploads", {
                    method: "POST",
                    body: fd,
                  }),
                  d = await r.json();
                if (r.ok) setProfile({ ...profile, profile_image: d.url });
              }}
            />
          </Field>
          <Field label="Notifications">
            <label className="switch">
              <input
                type="checkbox"
                checked={profile.notification_preferences?.inApp !== false}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    notification_preferences: {
                      ...profile.notification_preferences,
                      inApp: e.target.checked,
                    },
                  })
                }
              />{" "}
              In-app reminders
            </label>
          </Field>
          {notice && <p className="settingsnotice">{notice}</p>}
        </div>
      </div>
    );
  const value = settings[active] || {};
  return (
    <div className="settingspage">
      <header>
        <div>
          <small>ADMIN CONTROL CENTRE</small>
          <h1>Settings</h1>
          <p>
            Company-wide rules, templates, access, security and production
            controls.
          </p>
        </div>
        {active !== "users" &&
          active !== "security" &&
          active !== "production" && (
            <button className="primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          )}
        {active !== "users" && <button onClick={() => setActive("users")}>Manage employees</button>}
      </header>
      {notice && <div className="settingsnotice">{notice}</div>}
      <div className="settingslayout">
        <nav>
          {sections.map(([k, n]) => (
            <button
              key={k}
              className={active === k ? "active" : ""}
              onClick={() => setActive(k)}
            >
              <span>{sections.findIndex((x) => x[0] === k) + 1}</span>
              {n}
            </button>
          ))}
        </nav>
        <main>
          <div className="settingssectionhead">
            <h2>{sections.find((x) => x[0] === active)?.[1]}</h2>
            <span>
              {active === "integrations"
                ? "Credentials are stored only in server environment variables"
                : "Database-backed · audited"}
            </span>
          </div>
          {active === "users" ? (
            <Users
              users={users}
              currentEmail={currentEmail}
              reload={load}
              notice={setNotice}
            />
          ) : active === "security" ? (
            <Security
              value={value}
              audit={audit}
              system={system}
              notice={setNotice}
            />
          ) : active === "production" ? (
            <Production value={value} />
          ) : active === "banks" ? (
            <Banks
              value={value}
              change={(v) => setSettings({ ...settings, banks: v })}
              upload={upload}
            />
          ) : active === "branding" ? (
            <DocumentTemplates value={value} change={setValue} />
          ) : (
            <Editor value={value} change={setValue} upload={upload} />
          )}
        </main>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Editor({
  value,
  change,
  upload,
}: {
  value: R;
  change: (k: string, v: any) => void;
  upload: (k: string, f?: File) => void;
}) {
  return (
    <div className="settingscard settingsform">
      {Object.entries(value).map(([k, v]) => (
        <Field key={k} label={title(k)} wide={typeof v === "object"}>
          {typeof v === "boolean" ? (
            <label className="switch">
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => change(k, e.target.checked)}
              />{" "}
              Enabled
            </label>
          ) : typeof v === "object" ? (
            <textarea
              value={JSON.stringify(v, null, 2)}
              onChange={(e) => {
                try {
                  change(k, JSON.parse(e.target.value));
                } catch {}
              }}
              rows={Math.min(
                16,
                Math.max(5, JSON.stringify(v, null, 2).split("\n").length),
              )}
            />
          ) : String(k).toLowerCase().includes("colour") ? (
            <input
              type="color"
              value={String(v)}
              onChange={(e) => change(k, e.target.value)}
            />
          ) : String(k).match(/logo|signature|seal|image/i) ? (
            <div className="assetfield">
              <input
                value={String(v || "")}
                onChange={(e) => change(k, e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload(k, e.target.files?.[0])}
              />
            </div>
          ) : typeof v === "number" ? (
            <input
              type="number"
              value={v}
              onChange={(e) => change(k, Number(e.target.value))}
            />
          ) : (
            <input
              value={String(v ?? "")}
              onChange={(e) => change(k, e.target.value)}
            />
          )}
        </Field>
      ))}
    </div>
  );
}

function DocumentTemplates({ value, change }: { value: R; change: (k: string, v: any) => void }) {
  const quote = value.quoteTemplates || [], invoice = value.invoiceTemplates || [];
  const toggle = (kind: "quoteTemplates" | "invoiceTemplates", id: string) =>
    change(kind, (value[kind] || []).map((x: R) => x.id === id ? { ...x, active: !x.active } : x));
  return <div className="settingsstack documenttemplates">
    <div className="settingscard templateeditgrid">
      <Field label="Primary colour"><input type="color" value={value.primaryColour || "#0aa9e8"} onChange={e => change("primaryColour", e.target.value)} /></Field>
      <Field label="Secondary colour"><input type="color" value={value.secondaryColour || "#071522"} onChange={e => change("secondaryColour", e.target.value)} /></Field>
      <Field label="Luxury accent"><input type="color" value={value.accentColour || "#c8aa72"} onChange={e => change("accentColour", e.target.value)} /></Field>
      <Field label="PDF font"><select value={value.pdfFont || "Arial"} onChange={e => change("pdfFont", e.target.value)}><option>Arial</option><option>Inter</option><option>Georgia</option><option>Helvetica</option></select></Field>
      <Field label="Document header"><input value={value.header || ""} onChange={e => change("header", e.target.value)} /></Field>
      <Field label="Footer text"><input value={value.footer || ""} onChange={e => change("footer", e.target.value)} /></Field>
    </div>
    <div className="settingscard templateoptions">
      <label className="switch"><input type="checkbox" checked={value.showStandardImages !== false} onChange={e => change("showStandardImages", e.target.checked)} /> Show product images</label>
      <label className="switch"><input type="checkbox" checked={value.showBank !== false} onChange={e => change("showBank", e.target.checked)} /> Show bank details</label>
      <label className="switch"><input type="checkbox" checked={value.contactFooter !== false} onChange={e => change("contactFooter", e.target.checked)} /> Show contact footer</label>
    </div>
    <TemplateGroup heading="Quotation templates" rows={quote} selected={value.defaultQuoteTemplate || "luxury"} select={id => change("defaultQuoteTemplate", id)} toggle={id => toggle("quoteTemplates", id)} />
    <TemplateGroup heading="Invoice templates" rows={invoice} selected={value.defaultInvoiceTemplate || "executive"} select={id => change("defaultInvoiceTemplate", id)} toggle={id => toggle("invoiceTemplates", id)} />
    <p className="templatehint">A quotation remembers its selected design. A finalised invoice keeps the chosen design in its locked snapshot and permanent PDF.</p>
  </div>;
}

function TemplateGroup({ heading, rows, selected, select, toggle }: { heading: string; rows: R[]; selected: string; select: (id: string) => void; toggle: (id: string) => void }) {
  return <section className="settingscard templategroup"><div><h3>{heading}</h3><span>Select the company default. Individual documents can use another active design.</span></div><div className="templatecards">{rows.map(x => <article key={x.id} className={`${x.id} ${selected === x.id ? "selected" : ""} ${x.active === false ? "inactive" : ""}`}><div className="templatemock"><i /><i /><i /></div><b>{x.name}</b><p>{x.description}</p><div><button onClick={() => select(x.id)} disabled={x.active === false}>{selected === x.id ? "Default" : "Make default"}</button><label className="switch"><input type="checkbox" checked={x.active !== false} onChange={() => toggle(x.id)} /> Active</label></div></article>)}</div></section>;
}
function Banks({
  value,
  change,
  upload,
}: {
  value: R;
  change: (v: R) => void;
  upload: (k: string, f?: File) => void;
}) {
  const accounts = value.accounts || [],
    set = (i: number, k: string, v: any) =>
      change({
        ...value,
        accounts: accounts.map((a: R, n: number) =>
          n === i
            ? { ...a, [k]: v, ...(k === "default" && v ? {} : {}) }
            : k === "default" && v
              ? { ...a, default: false }
              : a,
        ),
      });
  return (
    <div className="settingsstack">
      {accounts.map((a: R, i: number) => (
        <div className="settingscard bankcard" key={a.id || i}>
          <div className="bankhead">
            <h3>{a.bankName || `Bank account ${i + 1}`}</h3>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!a.active}
                onChange={(e) => set(i, "active", e.target.checked)}
              />{" "}
              Active
            </label>
            <label className="switch">
              <input
                type="radio"
                checked={!!a.default}
                onChange={() => set(i, "default", true)}
              />{" "}
              Default
            </label>
          </div>
          <div className="settingsform">
            {[
              "accountName",
              "bankName",
              "accountNumber",
              "ifsc",
              "branch",
              "accountType",
              "upi",
            ].map((k) => (
              <Field key={k} label={title(k)}>
                <input
                  value={a[k] || ""}
                  onChange={(e) => set(i, k, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() =>
          change({
            ...value,
            accounts: [
              ...accounts,
              {
                id: crypto.randomUUID(),
                accountName: "",
                bankName: "",
                accountNumber: "",
                ifsc: "",
                branch: "",
                accountType: "Current",
                upi: "",
                active: true,
                default: !accounts.length,
              },
            ],
          })
        }
      >
        ＋ Add bank account
      </button>
    </div>
  );
}
function Users({
  users,
  currentEmail,
  reload,
  notice,
}: {
  users: R[];
  currentEmail: string;
  reload: () => void;
  notice: (s: string) => void;
}) {
  const add = async () => {
    const name = prompt("Employee full name");
    if (!name) return;
    const email = prompt("Work email");
    const role = prompt("Role: crm, sales or technician", "sales");
    const password = prompt("Temporary password (minimum 10 characters)");
    if (!email || !role || !password) return;
    const r = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      }),
      d = await r.json();
    notice(r.ok ? "Employee account created" : d.error);
    if (r.ok) reload();
  };
  const toggle = async (u: R) => {
    const r = await fetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: u.id, active: !u.active }),
      }),
      d = await r.json();
    notice(r.ok ? "User access updated" : d.error);
    if (r.ok) reload();
  };
  return (
    <div className="settingscard">
      <div className="settingsactions">
        <div>
          <b>{users.length} accounts</b>
          <span>Backend-enforced roles and status</span>
        </div>
        <button className="primary" onClick={add}>
          ＋ Add employee
        </button>
      </div>
      <div className="settingstable">
        <div className="settingsrow head">
          <span>User</span>
          <span>Role</span>
          <span>Last login</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {users.map((u) => (
          <div className="settingsrow" key={u.id}>
            <span>
              <b>{u.name}</b>
              <small>{u.email}</small>
            </span>
            <span>{u.role}</span>
            <span>
              {u.lastLogin
                ? new Date(u.lastLogin).toLocaleString("en-IN")
                : "Never"}
            </span>
            <span>{u.active ? "Active" : "Inactive"}</span>
            <button
              disabled={u.email === currentEmail}
              onClick={() => toggle(u)}
            >
              {u.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function Security({
  value,
  audit,
  system,
  notice,
}: {
  value: R;
  audit: R[];
  system: R;
  notice: (s: string) => void;
}) {
  const backup = async () => {
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "backup" }),
    });
    if (!r.ok) {
      notice("Backup failed");
      return;
    }
    const b = await r.blob(),
      a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `Techomie-Backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notice("Encrypted workspace export prepared");
  };
  return (
    <div className="settingsstack">
      <div className="healthgrid">
        {[
          ["Database", system.database],
          ["File storage", system.storage],
          ["Last backup", value.lastBackup],
          ["Restore test", value.lastRestoreTest],
        ].map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <b>{x[1] || "—"}</b>
          </article>
        ))}
      </div>
      <div className="settingscard settingsactions">
        <div>
          <b>Data backup</b>
          <span>
            Exports customers, leads, quotes, invoices, projects, payments,
            expenses and Items.
          </span>
        </div>
        <button className="primary" onClick={backup}>
          Create export
        </button>
      </div>
      <div className="settingscard">
        <h3>Permanent audit log</h3>
        <div className="auditlist">
          {audit.map((a) => (
            <div key={a.id}>
              <b>{a.action.replaceAll("_", " ")}</b>
              <span>
                {a.user_name || "System"} · {a.entity_type} {a.entity_id}
              </span>
              <time>{new Date(a.created_at).toLocaleString("en-IN")}</time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Production({ value }: { value: R }) {
  return (
    <div className="healthgrid productiongrid">
      {Object.entries(value).map(([k, v]) => (
        <article key={k}>
          <small>{title(k)}</small>
          <b>{String(v)}</b>
        </article>
      ))}
    </div>
  );
}
