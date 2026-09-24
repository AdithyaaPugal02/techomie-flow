"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
type R = Record<string, any>;
const money = (n: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));
const blank = (type = "Claim") => ({
  expense_type: type,
  date: new Date().toISOString().slice(0, 10),
  category: "Local travel",
  amount: "",
  paid_by: type === "Company" ? "Company UPI" : "Employee Personal Money",
  description: "",
  project_id: "",
  vendor: "",
  bill_number: "",
  gstin: "",
  tax: "",
  mode: "UPI",
  distance_km: "",
  vehicle_mileage: "",
  petrol_price: "101.40",
  notes: "",
});
const statuses = [
  "Draft",
  "Submitted",
  "Under Review",
  "Returned for Correction",
  "Approved",
  "Rejected",
  "Reimbursement Pending",
  "Reimbursed",
  "Cancelled",
];
export default function ExpensesModule({
  role,
  initialFilter = {},
}: {
  role: string;
  initialFilter?: R;
}) {
  const isAdmin = role === "admin",
    [tab, setTab] = useState(isAdmin ? "Claims" : "Mine"),
    [rows, setRows] = useState<R[]>([]),
    [summary, setSummary] = useState<R>({}),
    [lookups, setLookups] = useState<R>({ categories: [], projects: [] }),
    [pagination, setPagination] = useState<R>({ page: 1, pages: 1, total: 0 }),
    [filters, setFilters] = useState<R>({
      q: "",
      status: "",
      category: initialFilter.category || "",
      employee: "",
      project: "",
      from: "",
      to: "",
    }),
    [selected, setSelected] = useState<R | null>(null),
    [detail, setDetail] = useState<R | null>(null),
    [history, setHistory] = useState<R[]>([]),
    [receipts, setReceipts] = useState<R[]>([]),
    [showForm, setShowForm] = useState(false),
    [form, setForm] = useState<R>(blank()),
    [saving, setSaving] = useState("Saved"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const timer = useRef<any>(null);
  const load = useCallback(
    async (page = 1) => {
      setBusy(true);
      const p = new URLSearchParams({
        page: String(page),
        limit: "25",
        ...Object.fromEntries(
          Object.entries(filters)
            .filter(([, v]) => v)
            .map(([k, v]) => [k, String(v)]),
        ),
      });
      if (isAdmin) p.set("type", tab === "Company" ? "Company" : "Claim");
      const r = await fetch(`/api/expenses?${p}`),
        d = await r.json();
      setBusy(false);
      if (!r.ok) {
        setMessage(d.error);
        return;
      }
      setRows(d.expenses || []);
      setSummary(d.summary || {});
      setLookups(d.lookups || {});
      setPagination(d.pagination || {});
    },
    [JSON.stringify(filters), tab, isAdmin],
  );
  useEffect(() => {
    load(1);
  }, [load]);
  const open = async (id: string) => {
    setBusy(true);
    const r = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setSelected(d.expense);
    setDetail(d.expense);
    setForm({
      ...d.expense,
      amount: String(d.expense.amount || ""),
      tax: String(d.expense.tax || ""),
      distance_km: String(d.expense.distance_km || ""),
      vehicle_mileage: String(d.expense.vehicle_mileage || ""),
      petrol_price: String(d.expense.petrol_price != null ? d.expense.petrol_price : "101.40"),
    });
    setReceipts(d.receipts || []);
    setHistory(d.history || []);
  };
  const create = () => {
    setSelected(null);
    setDetail(null);
    setReceipts([]);
    setHistory([]);
    setForm(blank(isAdmin && tab === "Company" ? "Company" : "Claim"));
    setShowForm(true);
    setSaving("Not saved");
  };
  const save = async (submit = false) => {
    let currentAmount = form.amount ? Number(form.amount) : 0;
    let desc = form.description || "";
    let vend = form.vendor || "";

    // Auto-calculate amount if empty but distance and vehicle mileage are provided
    if ((!currentAmount || currentAmount <= 0) && form.distance_km && form.vehicle_mileage) {
      const dist = Number(form.distance_km);
      const mil = Number(form.vehicle_mileage);
      const rate = Number(form.petrol_price || 101.40);
      if (dist > 0 && mil > 0) {
        currentAmount = Math.round((dist / mil) * rate * 100) / 100;
        if (!desc) {
          desc = `Petrol expense: ${dist} km @ ${mil} km/L (Coimbatore rate ₹${rate.toFixed(2)}/L)`;
        }
        if (!vend) {
          vend = "Petrol Bunk (Coimbatore)";
        }
        setForm((prev: R) => ({
          ...prev,
          amount: String(currentAmount),
          description: desc,
          vendor: vend,
        }));
      }
    }

    if (submit) {
      if (!form.date) {
        setMessage("Please select the expense date");
        return;
      }
      if (!form.category) {
        setMessage("Please select an expense category");
        return;
      }
      if (!currentAmount || currentAmount <= 0) {
        setMessage("Please enter an expense amount (or fill distance & mileage to calculate)");
        return;
      }
    }

    setBusy(true);
    setSaving("Saving…");
    const payload = {
      ...form,
      project_id: form.project_id && String(form.project_id).trim() ? String(form.project_id).trim() : null,
      amount: currentAmount,
      description: desc,
      vendor: vend,
      tax: Number(form.tax || 0),
      distance_km: form.distance_km ? Number(form.distance_km) : null,
      vehicle_mileage: form.vehicle_mileage ? Number(form.vehicle_mileage) : null,
      petrol_price: form.petrol_price ? Number(form.petrol_price) : null,
    };
    const r = await fetch("/api/expenses", {
        method: selected ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          selected
            ? {
                ...payload,
                id: selected.id,
                action: submit ? "submit" : "save",
              }
            : { ...payload, status: submit ? "Submitted" : "Draft" },
        ),
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setSaving("Save failed");
      setMessage(d.error);
      return;
    }
    setSaving("Saved");
    const id = selected?.id || d.expense.id;
    if (!selected) {
      setSelected({ id, status: d.expense.status });
      setForm((x: R) => ({ ...x, id }));
      if (d.expense.duplicateWarning)
        setMessage(
          "Possible duplicate: same date, amount and supplier already exists",
        );
    }
    if (submit) {
      setShowForm(false);
      setSelected(null);
      await load();
    } else await open(id);
  };
  useEffect(() => {
    if (
      !showForm ||
      !selected ||
      saving !== "Unsaved changes" ||
      !["Draft", "Returned for Correction"].includes(String(selected.status))
    )
      return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(false), 1000);
    return () => clearTimeout(timer.current);
  }, [form, showForm, saving, selected?.id]);
  const change = (key: string, value: any) => {
    setForm((x: R) => ({ ...x, [key]: value }));
    setSaving("Unsaved changes");
  };
  const upload = async (files: FileList | null) => {
    if (!selected?.id) {
      setMessage("Save the draft once before uploading receipts");
      return;
    }
    if (!files?.length) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("expenseId", selected.id);
    Array.from(files).forEach((f) => fd.append("receipts", f));
    const r = await fetch("/api/expenses/receipts", {
        method: "POST",
        body: fd,
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(`${d.receipts.length} receipt file(s) uploaded`);
    await open(selected.id);
  };
  const action = async (action: string, extra: R = {}) => {
    if (!detail) return;
    setBusy(true);
    const r = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: detail.id, action, ...extra }),
      }),
      d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error);
      return;
    }
    setMessage(`Expense moved to ${d.status}`);
    await open(detail.id);
    await load(pagination.page);
  };
  const adminAction = (action: string) => {
    if (action === "approve") {
      const amount = prompt("Approved amount", String(detail?.amount || ""));
      if (amount === null) return;
      const comment =
        Number(amount) < Number(detail?.amount)
          ? prompt("Reason for lower approved amount") || ""
          : prompt("Approval comment (optional)") || "";
      actionExpense(action, { approvedAmount: Number(amount), comment });
    } else if (action === "reimburse") {
      const paymentDate = prompt(
        "Payment date",
        new Date().toISOString().slice(0, 10),
      );
      const paymentMode = prompt("Payment method", "UPI");
      const reference = prompt("Bank / UPI reference");
      if (paymentDate && paymentMode && reference)
        actionExpense(action, { paymentDate, paymentMode, reference });
    } else {
      const comment = prompt(
        action === "return" ? "Correction required" : "Reason / comment",
      );
      if (comment) actionExpense(action, { comment });
    }
  };
  const actionExpense = action;
  const deleteExpense = async (id?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetId = id || detail?.id;
    if (!targetId) return;
    if (!confirm(`Permanently delete expense ${targetId}? This action cannot be undone.`)) return;
    setBusy(true);
    const r = await fetch(`/api/expenses?id=${encodeURIComponent(targetId)}`, { method: "DELETE" });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error || "Unable to delete expense");
      return;
    }
    setMessage("Expense permanently deleted");
    if (detail?.id === targetId || selected?.id === targetId) {
      setDetail(null);
      setSelected(null);
      setShowForm(false);
    }
    load(pagination.page);
  };
  const exportCsv = () => {
    const p = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v)
          .map(([k, v]) => [k, String(v)]),
      ),
      format: "csv",
    });
    window.location.href = `/api/expenses?${p}`;
  };
  const editable =
    detail &&
    ["Draft", "Returned for Correction"].includes(detail.status) &&
    (isAdmin || detail.created_by);
  return (
    <div className="modulepage expensespage">
      <div className="modulehero">
        <div>
          <small>
            {isAdmin ? "FINANCE & REIMBURSEMENTS" : "EMPLOYEE CLAIMS"}
          </small>
          <h1>{isAdmin ? "Expense Management" : "My Expenses"}</h1>
          <p>
            {isAdmin
              ? "Employee claims, company spending, approvals and reimbursements."
              : "Submit site expenses, receipts and track reimbursement securely."}
          </p>
        </div>
        <div className="expenseheroactions">
          {isAdmin && <button onClick={exportCsv}>Export to Excel</button>}
          <button className="primary" onClick={create}>
            ＋ Submit expense
          </button>
        </div>
      </div>
      {isAdmin && (
        <div className="expensetabs">
          <button
            className={tab === "Claims" ? "active" : ""}
            onClick={() => setTab("Claims")}
          >
            Employee Claims
          </button>
          <button
            className={tab === "Company" ? "active" : ""}
            onClick={() => setTab("Company")}
          >
            Company Expenses
          </button>
          <button
            className={tab === "Reports" ? "active" : ""}
            onClick={() => setTab("Reports")}
          >
            Reports
          </button>
        </div>
      )}
      {message && (
        <div className="invoicealert">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      <div className="statgrid">
        <article>
          <small>SUBMITTED THIS MONTH</small>
          <b>{money(summary.submitted)}</b>
        </article>
        <article>
          <small>PENDING APPROVAL</small>
          <b>{money(summary.pending)}</b>
        </article>
        <article>
          <small>APPROVED, UNPAID</small>
          <b>{money(summary.unpaid)}</b>
        </article>
        <article>
          <small>REIMBURSED THIS MONTH</small>
          <b>{money(summary.reimbursed)}</b>
        </article>
      </div>
      {tab === "Reports" ? (
        <ExpenseReports rows={rows} />
      ) : (
        <>
          <div className="expensefilters">
            <input
              placeholder="Search description, supplier, bill or project"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All statuses</option>
              {statuses.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
            >
              <option value="">All categories</option>
              {(lookups.categories || []).map((x: string) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              value={filters.project}
              onChange={(e) =>
                setFilters({ ...filters, project: e.target.value })
              }
            >
              <option value="">All projects</option>
              {(lookups.projects || []).map((x: R) => (
                <option value={x.id} key={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
            {isAdmin && (
              <select
                value={filters.employee}
                onChange={(e) =>
                  setFilters({ ...filters, employee: e.target.value })
                }
              >
                <option value="">All employees</option>
                {(lookups.users || []).map((x: R) => (
                  <option value={x.id} key={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
            <button
              onClick={() =>
                setFilters({
                  q: "",
                  status: "",
                  category: "",
                  employee: "",
                  project: "",
                  from: "",
                  to: "",
                })
              }
            >
              Clear
            </button>
          </div>
          <div className="expensetable">
            <div className={`expensehead ${isAdmin ? "admin" : ""}`}>
              <span>Date</span>
              <span>Category / Vendor</span>
              <span>Project</span>
              {isAdmin && <span>Staff</span>}
              <span>Amount</span>
              <span>Paid by</span>
              <span>Receipt</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {rows.map((x) => (
              <div
                className={`expenserow ${isAdmin ? "admin" : ""}`}
                key={x.id}
                role="button"
                tabIndex={0}
                onClick={() => open(x.id)}
              >
                <span>{x.date}</span>
                <span>
                  <b>{x.category}</b>
                  <small>{x.description || x.vendor || "No description"}</small>
                  {Boolean(x.distance_km || x.vehicle_mileage) && (
                    <small style={{ color: "#0284c7", fontWeight: 650, marginTop: 2, display: "block" }}>
                      ⛽ {x.distance_km ? `${x.distance_km} km` : ""}{x.vehicle_mileage ? ` @ ${x.vehicle_mileage} km/L` : ""}{x.petrol_price ? ` (₹${x.petrol_price}/L)` : ""}
                    </small>
                  )}
                </span>
                <span>{x.project_title || "Not linked"}</span>
                {isAdmin && <span>{x.employee_name || "Company"}</span>}
                <strong>{money(x.amount)}</strong>
                <span>{x.paid_by}</span>
                <span>
                  {x.receipt_count ? `📎 ${x.receipt_count}` : "Missing"}
                </span>
                <span>
                  <em
                    className={`expensepill ${String(x.status).toLowerCase().replaceAll(" ", "-")}`}
                  >
                    {x.status}
                  </em>
                </span>
                <span className="expenseactions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="expenseopenbtn" onClick={() => open(x.id)}>Open</button>
                  {isAdmin && (
                    <button
                      type="button"
                      className="expensedelbtn"
                      title="Permanently delete expense"
                      onClick={(e) => deleteExpense(x.id, e)}
                    >
                      🗑 Delete
                    </button>
                  )}
                </span>
              </div>
            ))}
            {!rows.length && !busy && (
              <div className="expenseempty">
                No expense records match these filters.
              </div>
            )}
          </div>
          <div className="expensepagination">
            <span>{pagination.total || 0} records</span>
            <button
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              Previous
            </button>
            <b>
              Page {pagination.page || 1} of {pagination.pages || 1}
            </b>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => load(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      {(showForm || detail) && (
        <div className="modalback">
          <div className="modal expensemodal">
            <header>
              <div>
                <small>
                  {form.expense_type === "Company"
                    ? "COMPANY EXPENSE"
                    : "MY EXPENSE"}
                </small>
                <h2>{selected?.id || "Add expense"}</h2>
                <span className="autosavestatus">{saving}</span>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setDetail(null);
                  setSelected(null);
                }}
              >
                ×
              </button>
            </header>
            {message && (
              <div className="expensemodalalert">
                <span>⚠️ {message}</span>
                <button type="button" onClick={() => setMessage("")}>×</button>
              </div>
            )}
            {detail && !showForm ? (
              <ExpenseDetail
                x={detail}
                receipts={receipts}
                history={history}
                isAdmin={isAdmin}
                edit={() => setShowForm(true)}
                adminAction={adminAction}
                action={action}
                deleteExpense={deleteExpense}
              />
            ) : (
              <ExpenseForm
                value={form}
                change={change}
                lookups={lookups}
                isAdmin={isAdmin}
                upload={upload}
                receipts={receipts}
              />
            )}
            <div className="modalactions">
              {showForm ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setDetail(null);
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(false)}
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => save(true)}
                  >
                    {busy ? "Submitting…" : "Submit expense"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    setSelected(null);
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function ExpenseForm({
  value: x,
  change,
  lookups,
  isAdmin,
  upload,
  receipts,
}: R) {
  return (
    <div className="expenseform">
      <label>
        <span>Expense date *</span>
        <input
          type="date"
          value={x.date || ""}
          onChange={(e) => change("date", e.target.value)}
        />
      </label>
      <label>
        <span>Category *</span>
        <select
          value={x.category || ""}
          onChange={(e) => change("category", e.target.value)}
        >
          {(lookups.categories || []).map((v: string) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Amount ₹ *</span>
        <input
          inputMode="decimal"
          type="number"
          value={x.amount || ""}
          onChange={(e) => change("amount", e.target.value)}
        />
      </label>
      <label>
        <span>Paid by *</span>
        <select
          value={x.paid_by || ""}
          onChange={(e) => change("paid_by", e.target.value)}
        >
          {[
            "Employee Personal Money",
            "Company Cash",
            "Company UPI",
            "Company Card",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="wide">
        <span>Description *</span>
        <textarea
          value={x.description || ""}
          onChange={(e) => change("description", e.target.value)}
          placeholder="What was purchased and why?"
        />
      </label>
      <label>
        <span>Related project</span>
        <select
          value={x.project_id || ""}
          onChange={(e) => change("project_id", e.target.value)}
        >
          <option value="">Not linked</option>
          {(lookups.projects || []).map((v: R) => (
            <option value={v.id} key={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Supplier / shop</span>
        <input
          value={x.vendor || ""}
          onChange={(e) => change("vendor", e.target.value)}
        />
      </label>
      <label>
        <span>Bill / invoice number</span>
        <input
          value={x.bill_number || ""}
          onChange={(e) => change("bill_number", e.target.value)}
        />
      </label>
      <label>
        <span>GSTIN</span>
        <input
          value={x.gstin || ""}
          onChange={(e) => change("gstin", e.target.value.toUpperCase())}
        />
      </label>
      <label>
        <span>GST amount ₹</span>
        <input
          type="number"
          value={x.tax || ""}
          onChange={(e) => change("tax", e.target.value)}
        />
      </label>
      <label>
        <span>Payment method *</span>
        <select
          value={x.mode || ""}
          onChange={(e) => change("mode", e.target.value)}
        >
          {["Cash", "UPI", "Card", "Bank Transfer"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {/* ⛽ Petrol Expense & Vehicle Mileage Calculator */}
      <div className="petrolcalcbox">
        <div className="petrolcalcheader">
          <div className="petrolcalctitle">
            <span>⛽</span>
            <span>Petrol Expense &amp; Vehicle Mileage Calculator</span>
          </div>
          <span className="petrolcitybadge">📍 Coimbatore, TN Petrol Rate</span>
        </div>

        <div className="petrolcalcgrid">
          <div className="petrolcalcfield">
            <span>
              Kilometers Travelled (km)
              {Boolean(x.distance_km) && <small>{x.distance_km} km</small>}
            </span>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 45"
              value={x.distance_km || ""}
              onChange={(e) => change("distance_km", e.target.value)}
            />
            <small style={{ marginTop: 2, color: "#64748b", fontSize: 10.5 }}>
              Total trip or site-visit distance
            </small>
          </div>

          <div className="petrolcalcfield">
            <span>
              Vehicle Mileage (km/L) *
              {Boolean(x.vehicle_mileage) && <small>{x.vehicle_mileage} km/L</small>}
            </span>
            <input
              type="number"
              step="0.5"
              min="1"
              placeholder="e.g. 40"
              value={x.vehicle_mileage || ""}
              onChange={(e) => change("vehicle_mileage", e.target.value)}
            />
            <div className="mileagepresets">
              {[
                { label: "🏍️ Bike (40)", val: "40" },
                { label: "🛵 Scooter (35)", val: "35" },
                { label: "🚗 Car (14)", val: "14" },
                { label: "🚙 SUV (11)", val: "11" },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  className={`mileagepresetbtn ${String(x.vehicle_mileage) === p.val ? "active" : ""}`}
                  onClick={() => change("vehicle_mileage", p.val)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="petrolcalcfield">
            <span>
              Current Coimbatore Petrol Price (₹/L) *
              <small>Editable</small>
            </span>
            <input
              type="number"
              step="0.05"
              min="1"
              placeholder="101.40"
              value={x.petrol_price !== undefined && x.petrol_price !== null && x.petrol_price !== "" ? x.petrol_price : "101.40"}
              onChange={(e) => change("petrol_price", e.target.value)}
            />
            <small style={{ marginTop: 2, color: "#64748b", fontSize: 10.5 }}>
              Coimbatore, TN retail rate (editable)
            </small>
          </div>
        </div>

        {(() => {
          const dist = Number(x.distance_km || 0);
          const mil = Number(x.vehicle_mileage || 0);
          const rate = Number(x.petrol_price || 101.40);
          if (dist > 0 && mil > 0 && rate > 0) {
            const litres = dist / mil;
            const calcTotal = Math.round(litres * rate * 100) / 100;
            const costPerKm = (rate / mil).toFixed(2);
            return (
              <div className="petrolresultbanner">
                <div className="petrolresultformula">
                  <b>{dist} km ÷ {mil} km/L = {litres.toFixed(2)} Litres</b> × ₹{rate.toFixed(2)}/L = <strong>₹{calcTotal.toFixed(2)}</strong>
                  <span>Running cost: ₹{costPerKm} / km · Calculated fuel cost for Coimbatore</span>
                </div>
                <button
                  type="button"
                  className="petrolapplybtn"
                  onClick={() => {
                    change("amount", String(calcTotal));
                    if (!x.description || x.description.startsWith("Petrol expense:")) {
                      change("description", `Petrol expense: ${dist} km @ ${mil} km/L (Coimbatore rate ₹${rate.toFixed(2)}/L)`);
                    }
                    if (!x.vendor) {
                      change("vendor", "Petrol Bunk (Coimbatore)");
                    }
                  }}
                >
                  ⚡ Apply ₹{calcTotal.toFixed(2)} to Amount
                </button>
              </div>
            );
          }
          return null;
        })()}
      </div>
      <label className="wide">
        <span>Internal note</span>
        <textarea
          value={x.notes || ""}
          onChange={(e) => change("notes", e.target.value)}
        />
      </label>
      <label className="wide receiptupload">
        <span>Receipt photos or PDFs</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          multiple
          onChange={(e) => upload(e.target.files)}
        />
        <small>
          {receipts.length
            ? `${receipts.length} file(s) attached`
            : "Save the draft, then take a photo or choose files."}
        </small>
      </label>
      {isAdmin && (
        <label>
          <span>Cost centre</span>
          <input
            value={x.cost_centre || ""}
            onChange={(e) => change("cost_centre", e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
function ExpenseDetail({
  x,
  receipts,
  history,
  isAdmin,
  edit,
  adminAction,
  action,
  deleteExpense,
}: R) {
  return (
    <div className="expensedetail">
      <div className="detailhero">
        <div>
          <small>{x.category}</small>
          <h3>{x.description || x.vendor}</h3>
          <span>
            {x.employee_name} · {x.date} · {x.project_title || "Not linked"}
          </span>
        </div>
        <strong>{money(x.amount)}</strong>
      </div>
      {x.duplicate_warning ? (
        <div className="duplicatewarn">
          Possible duplicate expense detected. Review date, amount and supplier.
        </div>
      ) : null}
      {Boolean(x.distance_km || x.vehicle_mileage) && (
        <div className="petrolbreakdowncard">
          <div className="petrolbreakdownhead">
            <b>⛽ Petrol &amp; Vehicle Mileage Details</b>
            <span className="petrolcitybadge">📍 Coimbatore Rate</span>
          </div>
          <div className="petrolbreakdowngrid">
            <div>
              <small>Distance</small>
              <b>{x.distance_km ? `${x.distance_km} km` : "—"}</b>
            </div>
            <div>
              <small>Vehicle Mileage</small>
              <b>{x.vehicle_mileage ? `${x.vehicle_mileage} km/L` : "—"}</b>
            </div>
            <div>
              <small>Coimbatore Petrol Rate</small>
              <b>{x.petrol_price ? `₹${Number(x.petrol_price).toFixed(2)} / L` : "₹101.40 / L"}</b>
            </div>
            {Number(x.distance_km) > 0 && Number(x.vehicle_mileage) > 0 && (
              <>
                <div>
                  <small>Fuel Consumed</small>
                  <b>{(Number(x.distance_km) / Number(x.vehicle_mileage)).toFixed(2)} Litres</b>
                </div>
                <div>
                  <small>Running Cost</small>
                  <b>₹{(Number(x.petrol_price || 101.40) / Number(x.vehicle_mileage)).toFixed(2)} / km</b>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <dl>
        {[
          ["Paid by", x.paid_by],
          ["Payment method", x.mode],
          ["Supplier", x.vendor],
          ["Bill number", x.bill_number],
          ["GSTIN", x.gstin],
          ["GST amount", money(x.tax)],
          [
            "Approved amount",
            x.approved_amount != null ? money(x.approved_amount) : "Pending",
          ],
          ["Status", x.status],
          ["Approver comment", x.approver_comment || x.rejection_reason],
          [
            "Reimbursement",
            x.reimbursement_date
              ? `${x.reimbursement_date} · ${x.reimbursement_reference}`
              : "Not paid",
          ],
        ].map((v) => (
          <div key={v[0]}>
            <dt>{v[0]}</dt>
            <dd>{v[1] || "—"}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h4>Receipts</h4>
        <div className="receiptlist">
          {receipts.map((r: R) => (
            <a
              key={r.id}
              target="_blank"
              href={`/api/expenses/receipts?key=${encodeURIComponent(r.file_key)}`}
            >
              📎 {r.file_name}
            </a>
          ))}
          {!receipts.length && <span>No receipt attached</span>}
        </div>
      </section>
      <section>
        <h4>Audit history</h4>
        <div className="expensehistory">
          {history.map((h: R) => (
            <div key={h.id}>
              <b>{h.action}</b>
              <span>
                {h.user_name} · {new Date(h.created_at).toLocaleString("en-IN")}
              </span>
              <small>{h.comment}</small>
            </div>
          ))}
        </div>
      </section>
      <div className="expenseactions">
        {["Draft", "Returned for Correction"].includes(x.status) && (
          <>
            <button onClick={edit}>Edit</button>
            <button className="primary" onClick={() => action("submit")}>
              Submit
            </button>
          </>
        )}
        {isAdmin && ["Submitted", "Under Review"].includes(x.status) && (
          <>
            <button onClick={() => action("review")}>Start review</button>
            <button onClick={() => adminAction("return")}>Return</button>
            <button onClick={() => adminAction("reject")}>Reject</button>
            <button className="primary" onClick={() => adminAction("approve")}>
              Approve
            </button>
          </>
        )}
        {isAdmin && x.status === "Reimbursement Pending" && (
          <button className="primary" onClick={() => adminAction("reimburse")}>
            Record reimbursement
          </button>
        )}
        {isAdmin && (
          <button
            style={{ background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
            onClick={() => deleteExpense?.(x.id)}
          >
            🗑 Delete expense
          </button>
        )}
      </div>
    </div>
  );
}
function ExpenseReports({ rows }: { rows: R[] }) {
  const byCat = useMemo(
    () =>
      Object.entries(
        rows.reduce(
          (a: R, x: R) => ({
            ...a,
            [x.category]: (a[x.category] || 0) + Number(x.amount || 0),
          }),
          {},
        ),
      ).sort((a: any, b: any) => b[1] - a[1]),
    [rows],
  );
  return (
    <div className="expensereports">
      <section>
        <h2>Category summary</h2>
        {byCat.map(([k, v]: any) => (
          <div key={k}>
            <span>{k}</span>
            <b>{money(v)}</b>
          </div>
        ))}
        {!byCat.length && (
          <p>Open Employee Claims or Company Expenses to load report data.</p>
        )}
      </section>
      <section>
        <h2>Expense controls</h2>
        <p>
          Approved project-linked expenses feed project profitability through
          their project ID. Employee-personal payments remain reimbursement
          payables until recorded as reimbursed.
        </p>
      </section>
    </div>
  );
}
