"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CompanyProfileManager,
  TermsTemplatesManager,
  PaymentTermsManager,
  WarrantyTemplatesManager,
  TaxRulesManager,
  NumberingRulesManager,
  MastersSettingsManager,
  WorkflowSettingsManager,
  NotificationSettingsManager,
  IntegrationSettingsManager,
  DangerZoneManager,
} from "./settings-visual-editors";
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
          ) : active === "company" ? (
            <CompanyProfileManager
              value={value}
              change={setValue}
              upload={upload}
            />
          ) : active === "terms" ? (
            <TermsTemplatesManager
              value={value}
              change={(newVal) => setSettings({ ...settings, terms: newVal })}
            />
          ) : active === "paymentTerms" ? (
            <PaymentTermsManager
              value={value}
              change={(newVal) => setSettings({ ...settings, paymentTerms: newVal })}
            />
          ) : active === "warranty" ? (
            <WarrantyTemplatesManager
              value={value}
              change={(newVal) => setSettings({ ...settings, warranty: newVal })}
            />
          ) : active === "tax" ? (
            <TaxRulesManager
              value={value}
              change={(newVal) => setSettings({ ...settings, tax: newVal })}
            />
          ) : active === "numbering" ? (
            <NumberingRulesManager
              value={value}
              change={(newVal) => setSettings({ ...settings, numbering: newVal })}
            />
          ) : active === "masters" ? (
            <MastersSettingsManager
              value={value}
              change={(newVal) => setSettings({ ...settings, masters: newVal })}
            />
          ) : active === "workflows" ? (
            <WorkflowSettingsManager
              value={value}
              change={(newVal) => setSettings({ ...settings, workflows: newVal })}
            />
          ) : active === "notifications" ? (
            <NotificationSettingsManager
              value={value}
              change={(newVal) => setSettings({ ...settings, notifications: newVal })}
            />
          ) : active === "integrations" ? (
            <IntegrationSettingsManager
              value={value}
              change={(newVal) => setSettings({ ...settings, integrations: newVal })}
            />
          ) : active === "danger" ? (
            <DangerZoneManager
              value={value}
              change={(newVal) => setSettings({ ...settings, danger: newVal })}
            />
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<R | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<R>({
    name: "",
    email: "",
    phone: "",
    role: "sales",
    password: "",
    active: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  const roleStyle: Record<string, { bg: string; color: string; border: string }> = {
    admin: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
    crm: { bg: "#f5f3ff", color: "#5b21b6", border: "#ddd6fe" },
    sales: { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    technician: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U"
    );
  };

  const openAdd = () => {
    setIsNew(true);
    setEditingUser(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      role: "sales",
      password: "",
      active: true,
    });
    setShowPassword(false);
    setModalError("");
    setModalOpen(true);
  };

  const openEdit = (u: R, focusPassword = false) => {
    setIsNew(false);
    setEditingUser(u);
    setForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || "sales",
      password: "",
      active: typeof u.active === "boolean" ? u.active : true,
    });
    setShowPassword(focusPassword);
    setModalError("");
    setModalOpen(true);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pass = "Tech@";
    for (let i = 0; i < 5; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev: R) => ({ ...prev, password: pass }));
    setShowPassword(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!form.name?.trim()) {
      setModalError("Employee full name is required");
      return;
    }
    if (!form.email?.trim() || !form.email.includes("@")) {
      setModalError("A valid work email is required");
      return;
    }
    if (isNew && (!form.password || form.password.length < 6)) {
      setModalError("Password must be at least 6 characters");
      return;
    }
    if (!isNew && form.password && form.password.length < 6) {
      setModalError("New password must be at least 6 characters");
      return;
    }

    setBusy(true);
    try {
      if (isNew) {
        const r = await fetch("/api/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.toLowerCase().trim(),
            phone: form.phone?.trim() || undefined,
            role: form.role,
            password: form.password,
            active: form.active,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to create employee");
        notice(`Employee ${form.name} created successfully`);
        setModalOpen(false);
        reload();
      } else {
        const payload: R = {
          id: editingUser?.id,
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          phone: form.phone?.trim() || "",
          role: form.role,
          active: form.active,
        };
        if (form.password) {
          payload.password = form.password;
        }
        const r = await fetch("/api/users", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to update employee");
        notice(
          `Employee details updated for ${form.name}${form.password ? " (including new password)" : ""}`,
        );
        setModalOpen(false);
        reload();
      }
    } catch (err: any) {
      setModalError(err?.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u: R) => {
    const r = await fetch("/api/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    const d = await r.json();
    notice(
      r.ok
        ? `Employee ${u.name} ${u.active ? "deactivated" : "activated"}`
        : d.error,
    );
    if (r.ok) reload();
  };

  const deleteEmployee = async (u: R) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete employee "${u.name}" (${u.email})?`,
      )
    )
      return;
    const r = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, {
      method: "DELETE",
    });
    const d = await r.json();
    notice(r.ok ? `Employee ${u.name} deleted` : d.error);
    if (r.ok) reload();
  };

  return (
    <div className="settingscard">
      <div className="settingsactions">
        <div>
          <b style={{ fontSize: "15px", color: "#0f172a" }}>
            {users.length} Employee Accounts
          </b>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Manage staff profiles, assign roles, update contact info, and set login passwords.
          </span>
        </div>
        <button className="primary" onClick={openAdd}>
          ＋ Add employee
        </button>
      </div>

      <div className="settingstable">
        <div className="settingsrow head">
          <span>Employee / Contact</span>
          <span>Role</span>
          <span>Status</span>
          <span>Last Login</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {users.map((u) => {
          const style = roleStyle[u.role] || {
            bg: "#f1f5f9",
            color: "#475569",
            border: "#cbd5e1",
          };
          const isMe = u.email === currentEmail;

          return (
            <div className="settingsrow" key={u.id} style={{ alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: style.bg,
                    color: style.color,
                    border: `1.5px solid ${style.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  {getInitials(u.name || "")}
                </div>
                <div>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>
                    {u.name} {isMe && <small style={{ color: "#0284c7" }}>(You)</small>}
                  </b>
                  <small style={{ color: "#64748b", display: "block" }}>{u.email}</small>
                  {u.phone && (
                    <small style={{ color: "#475569", display: "block", fontSize: "11px" }}>
                      📞 {u.phone}
                    </small>
                  )}
                </div>
              </span>

              <span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    background: style.bg,
                    color: style.color,
                    border: `1px solid ${style.border}`,
                  }}
                >
                  {u.role}
                </span>
              </span>

              <span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: u.active ? "#16a34a" : "#94a3b8",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: u.active ? "#16a34a" : "#cbd5e1",
                    }}
                  />
                  {u.active ? "Active" : "Inactive"}
                </span>
              </span>

              <span style={{ fontSize: "12px", color: "#64748b" }}>
                {u.lastLogin
                  ? new Date(u.lastLogin).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "Never logged in"}
              </span>

              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  title="Edit employee details and password"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    cursor: "pointer",
                  }}
                >
                  ✎ Edit Details & Password
                </button>

                <button
                  type="button"
                  disabled={isMe}
                  onClick={() => toggle(u)}
                  title={u.active ? "Deactivate employee" : "Activate employee"}
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    background: u.active ? "#fef2f2" : "#f0fdf4",
                    color: u.active ? "#dc2626" : "#16a34a",
                    cursor: isMe ? "not-allowed" : "pointer",
                  }}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </button>

                {!isMe && (
                  <button
                    type="button"
                    onClick={() => deleteEmployee(u)}
                    title="Delete employee account"
                    style={{
                      padding: "6px 8px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid #fecaca",
                      background: "#fff",
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modern Edit Details & Password Modal */}
      {modalOpen && (
        <div className="modalback">
          <div className="modal" style={{ maxWidth: "560px", width: "100%" }}>
            <div className="modalhead">
              <div>
                <small style={{ color: "#0284c7", fontWeight: 700, letterSpacing: "1px" }}>
                  {isNew ? "NEW EMPLOYEE" : "MANAGE EMPLOYEE"}
                </small>
                <h2 style={{ fontSize: "18px", margin: "4px 0 0", color: "#0f172a" }}>
                  {isNew ? "Add Employee Account" : `Edit Details: ${editingUser?.name}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  border: 0,
                  background: "#f1f5f9",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  fontSize: "18px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="formgrid" style={{ padding: "20px 24px" }}>
                {modalError && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {modalError}
                  </div>
                )}

                <label className="wide">
                  <span>Full Name *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Harish Kumar"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <label>
                  <span>Work Email *</span>
                  <input
                    type="email"
                    required
                    placeholder="name@techomie.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>

                <label>
                  <span>Phone / Mobile</span>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </label>

                <label>
                  <span>Assigned Role *</span>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="sales">Sales Executive</option>
                    <option value="crm">CRM / Customer Success</option>
                    <option value="technician">Field Technician / Engineer</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <span>Account Status</span>
                  <label className="switch" style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    <span style={{ fontSize: "12px", fontWeight: 600, color: form.active ? "#16a34a" : "#64748b" }}>
                      {form.active ? "Account is Active" : "Account is Inactive / Disabled"}
                    </span>
                  </label>
                </label>

                <div
                  className="wide"
                  style={{
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: "16px",
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                      {isNew ? "Login Password *" : "Update Login Password"}
                    </span>
                    <button
                      type="button"
                      onClick={generatePassword}
                      style={{
                        border: "1px solid #cbd5e1",
                        background: "#f8fafc",
                        borderRadius: "6px",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#0284c7",
                        cursor: "pointer",
                      }}
                    >
                      🎲 Generate Password
                    </button>
                  </div>

                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        isNew
                          ? "Enter password (min. 6 characters)"
                          : "Leave blank to keep existing password, or type new password"
                      }
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      style={{ width: "100%", paddingRight: "45px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "8px",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        fontSize: "13px",
                        color: "#64748b",
                        padding: "4px",
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>

                  <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "5px" }}>
                    {isNew
                      ? "Min. 6 characters. The employee can use this password to sign in immediately."
                      : "Leave this field empty to keep their current password unchanged. Enter at least 6 characters to set a new password."}
                  </small>
                </div>
              </div>

              <div className="modalactions">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={busy}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    borderRadius: "8px",
                    padding: "9px 18px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="primary"
                  style={{
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: "8px",
                    padding: "9px 22px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {busy ? "Saving…" : isNew ? "Create Employee" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
