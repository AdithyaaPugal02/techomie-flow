"use client";
import React, { useState } from "react";

type R = Record<string, any>;

export const INDIAN_STATES = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Delhi",
  "Gujarat",
  "Goa",
  "West Bengal",
  "Rajasthan",
  "Punjab",
  "Haryana",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Bihar",
  "Odisha",
  "Assam",
  "Chandigarh",
  "Puducherry",
];

export function Field({
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

// 1. Terms and Conditions Templates
export function TermsTemplatesManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const templates: R[] = Array.isArray(value?.templates) ? value.templates : [];

  const updateTemplate = (index: number, key: string, val: any) => {
    const updated = templates.map((t, idx) =>
      idx === index ? { ...t, [key]: val } : t,
    );
    change({ ...value, templates: updated });
  };

  const deleteTemplate = (index: number) => {
    if (!confirm("Are you sure you want to remove this terms template?")) return;
    const updated = templates.filter((_, idx) => idx !== index);
    change({ ...value, templates: updated });
  };

  const addTemplate = () => {
    const newTemplate = {
      id: "terms-" + Date.now().toString(36),
      name: "New Terms Template",
      appliesTo: "Standard Product Quotation",
      content:
        "Quotation validity, scope changes, site readiness, payment milestones, stock availability, warranty exclusions and Coimbatore jurisdiction apply.",
      active: true,
    };
    change({ ...value, templates: [...templates, newTemplate] });
  };

  return (
    <div className="settingsstack">
      {templates.map((t, idx) => (
        <div className="settingstemplatecard" key={t.id || idx}>
          <div className="settingstemplatecardhead">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
              <input
                style={{ fontWeight: 700, fontSize: "14px", maxWidth: "260px" }}
                value={t.name || ""}
                onChange={(e) => updateTemplate(idx, "name", e.target.value)}
                placeholder="Template Name"
              />
              <select
                style={{ width: "auto", fontSize: "12px", padding: "6px 10px" }}
                value={t.appliesTo || "Standard Product Quotation"}
                onChange={(e) => updateTemplate(idx, "appliesTo", e.target.value)}
              >
                <option value="Standard Product Quotation">Standard Product Quotation</option>
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Service Proposal">Service Proposal</option>
                <option value="AMC Agreement">AMC Agreement</option>
                <option value="All Documents">All Documents</option>
              </select>
            </div>
            <div className="headcontrols">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={t.active !== false}
                  onChange={(e) => updateTemplate(idx, "active", e.target.checked)}
                />
                Active
              </label>
              <button
                className="btn-delete-template"
                onClick={() => deleteTemplate(idx)}
              >
                Delete
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475467" }}>
              TERMS &amp; CONDITIONS CONTENT (PRINTED ON PROPOSAL / INVOICE):
            </span>
            <textarea
              style={{
                fontFamily: "inherit",
                fontSize: "12.5px",
                lineHeight: "1.5",
                minHeight: "90px",
              }}
              value={t.content || ""}
              onChange={(e) => updateTemplate(idx, "content", e.target.value)}
              placeholder="Enter the detailed terms, jurisdiction, validity, site conditions, payment rules..."
            />
          </div>
        </div>
      ))}
      <button className="btn-add-primary" onClick={addTemplate}>
        ＋ Add Terms Template
      </button>
    </div>
  );
}

// 2. Payment Terms
export function PaymentTermsManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const templates: R[] = Array.isArray(value?.templates) ? value.templates : [];
  const defaultId = value?.default || templates[0]?.id || "20-60-20";

  const updateTemplate = (index: number, key: string, val: any) => {
    const updated = templates.map((t, idx) =>
      idx === index ? { ...t, [key]: val } : t,
    );
    change({ ...value, templates: updated });
  };

  const deleteTemplate = (index: number) => {
    if (!confirm("Remove this payment schedule?")) return;
    const updated = templates.filter((_, idx) => idx !== index);
    change({ ...value, templates: updated });
  };

  const addTemplate = () => {
    const id = "pay-" + Date.now().toString(36);
    const newTemplate = {
      id,
      name: "50% Advance + 30% Delivery + 20% Handover",
      active: true,
      milestones: [
        { name: "Advance", percent: 50, condition: "Order confirmation" },
        { name: "Material Delivery", percent: 30, condition: "Hardware arrival at site" },
        { name: "Handover", percent: 20, condition: "Testing & Handover" },
      ],
    };
    change({ ...value, templates: [...templates, newTemplate] });
  };

  const updateMilestone = (
    tIdx: number,
    mIdx: number,
    field: string,
    val: any,
  ) => {
    const target = templates[tIdx];
    const ms = (target.milestones || []).map((m: R, i: number) =>
      i === mIdx ? { ...m, [field]: val } : m,
    );
    updateTemplate(tIdx, "milestones", ms);
  };

  const addMilestone = (tIdx: number) => {
    const target = templates[tIdx];
    const ms = [...(target.milestones || []), { name: "Milestone", percent: 10, condition: "" }];
    updateTemplate(tIdx, "milestones", ms);
  };

  const deleteMilestone = (tIdx: number, mIdx: number) => {
    const target = templates[tIdx];
    const ms = (target.milestones || []).filter((_: R, i: number) => i !== mIdx);
    updateTemplate(tIdx, "milestones", ms);
  };

  return (
    <div className="settingsstack">
      {templates.map((t, tIdx) => {
        const milestones: R[] = t.milestones || [];
        const sum = milestones.reduce(
          (acc, m) => acc + (Number(m.percent) || 0),
          0,
        );
        const isDefault = defaultId === t.id;

        return (
          <div className="settingstemplatecard" key={t.id || tIdx}>
            <div className="settingstemplatecardhead">
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                <input
                  style={{ fontWeight: 700, fontSize: "14px", maxWidth: "340px" }}
                  value={t.name || ""}
                  onChange={(e) => updateTemplate(tIdx, "name", e.target.value)}
                  placeholder="Payment Schedule Name"
                />
                {isDefault ? (
                  <span className="percentagebadge valid">★ Default Scheme</span>
                ) : (
                  <button
                    type="button"
                    style={{
                      border: "1px solid #d0d5dd",
                      background: "#fff",
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                    onClick={() => change({ ...value, default: t.id })}
                  >
                    Make Default
                  </button>
                )}
              </div>
              <div className="headcontrols">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={t.active !== false}
                    onChange={(e) => updateTemplate(tIdx, "active", e.target.checked)}
                  />
                  Active
                </label>
                <button
                  className="btn-delete-template"
                  onClick={() => deleteTemplate(tIdx)}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Milestones Table */}
            <table className="milestonestable">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Milestone Stage</th>
                  <th style={{ width: "16%" }}>Percentage</th>
                  <th style={{ width: "46%" }}>Trigger / Condition</th>
                  <th style={{ width: "14%", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, mIdx) => (
                  <tr key={mIdx}>
                    <td>
                      <input
                        value={m.name || ""}
                        onChange={(e) =>
                          updateMilestone(tIdx, mIdx, "name", e.target.value)
                        }
                        placeholder="e.g. Advance"
                      />
                    </td>
                    <td>
                      <div className="milestonepercentwrap">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={m.percent ?? ""}
                          onChange={(e) =>
                            updateMilestone(
                              tIdx,
                              mIdx,
                              "percent",
                              Number(e.target.value),
                            )
                          }
                        />
                        <span>%</span>
                      </div>
                    </td>
                    <td>
                      <input
                        value={m.condition || ""}
                        onChange={(e) =>
                          updateMilestone(tIdx, mIdx, "condition", e.target.value)
                        }
                        placeholder="e.g. Order confirmation"
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        style={{
                          border: 0,
                          background: "transparent",
                          color: "#98a2b3",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                        onClick={() => deleteMilestone(tIdx, mIdx)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    {sum === 100 ? (
                      <span className="percentagebadge valid">✓ 100% Total (Balanced)</span>
                    ) : (
                      <span className="percentagebadge invalid">
                        ⚠ Total: {sum}% (Must equal 100%)
                      </span>
                    )}
                  </td>
                  <td colSpan={2} style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      style={{
                        border: "1px dashed #b2ddff",
                        background: "#eff8ff",
                        color: "#175cd3",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => addMilestone(tIdx)}
                    >
                      ＋ Add Milestone Row
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
      <button className="btn-add-primary" onClick={addTemplate}>
        ＋ Add Payment Terms Template
      </button>
    </div>
  );
}

// 3. Warranty and Service Templates
export function WarrantyTemplatesManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const templates: R[] = Array.isArray(value?.templates) ? value.templates : [];

  const updateTemplate = (index: number, key: string, val: any) => {
    const updated = templates.map((t, idx) =>
      idx === index ? { ...t, [key]: val } : t,
    );
    change({ ...value, templates: updated });
  };

  const deleteTemplate = (index: number) => {
    if (!confirm("Remove this warranty scheme?")) return;
    const updated = templates.filter((_, idx) => idx !== index);
    change({ ...value, templates: updated });
  };

  const addTemplate = () => {
    const newTemplate = {
      id: "war-" + Date.now().toString(36),
      name: "Standard Smart Devices",
      appliesTo: "All Standard Automation Hardware",
      replacement: "2 years",
      service: "4 years",
      support: "2 years",
      amc: true,
      exclusions: "Physical damage, misuse and electrical surges",
      wording:
        "Manufacturer replacement warranty with Techomie on-site service support.",
      active: true,
    };
    change({ ...value, templates: [...templates, newTemplate] });
  };

  return (
    <div className="settingsstack">
      {templates.map((t, idx) => (
        <div className="settingstemplatecard" key={t.id || idx}>
          <div className="settingstemplatecardhead">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
              <input
                style={{ fontWeight: 700, fontSize: "14px", maxWidth: "280px" }}
                value={t.name || ""}
                onChange={(e) => updateTemplate(idx, "name", e.target.value)}
                placeholder="Warranty Scheme Name"
              />
              <input
                style={{ fontSize: "12px", maxWidth: "240px" }}
                value={t.appliesTo || ""}
                onChange={(e) => updateTemplate(idx, "appliesTo", e.target.value)}
                placeholder="Applies to (e.g. Noviq Edge)"
              />
            </div>
            <div className="headcontrols">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={t.active !== false}
                  onChange={(e) => updateTemplate(idx, "active", e.target.checked)}
                />
                Active
              </label>
              <button
                className="btn-delete-template"
                onClick={() => deleteTemplate(idx)}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="settingsform" style={{ marginTop: "4px" }}>
            <Field label="Full Replacement Warranty">
              <input
                value={t.replacement || ""}
                onChange={(e) => updateTemplate(idx, "replacement", e.target.value)}
                placeholder="e.g. 5 years / 2 years"
              />
            </Field>
            <Field label="Service Support Warranty">
              <input
                value={t.service || ""}
                onChange={(e) => updateTemplate(idx, "service", e.target.value)}
                placeholder="e.g. 5 years / 4 years"
              />
            </Field>
            <Field label="Customer Support Duration">
              <input
                value={t.support || ""}
                onChange={(e) => updateTemplate(idx, "support", e.target.value)}
                placeholder="e.g. 5 years"
              />
            </Field>
            <Field label="AMC Service Availability">
              <label className="switch" style={{ marginTop: "8px" }}>
                <input
                  type="checkbox"
                  checked={t.amc !== false}
                  onChange={(e) => updateTemplate(idx, "amc", e.target.checked)}
                />
                Post-warranty AMC support eligible
              </label>
            </Field>
            <Field label="Standard Exclusions" wide>
              <input
                value={t.exclusions || ""}
                onChange={(e) => updateTemplate(idx, "exclusions", e.target.value)}
                placeholder="e.g. Physical damage, misuse, lightning surge and unauthorized repairs"
              />
            </Field>
            <Field label="Official Guarantee Wording" wide>
              <textarea
                value={t.wording || ""}
                onChange={(e) => updateTemplate(idx, "wording", e.target.value)}
                placeholder="Enter the full warranty assurance statement printed on proposals and warranty cards..."
                rows={2}
              />
            </Field>
          </div>
        </div>
      ))}
      <button className="btn-add-primary" onClick={addTemplate}>
        ＋ Add Warranty Template
      </button>
    </div>
  );
}

// 4. GST, Tax, HSN and Invoice Rules
export function TaxRulesManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const hsnList: R[] = Array.isArray(value?.hsn) ? value.hsn : [];
  const uqcList: string[] = Array.isArray(value?.uqc) ? value.uqc : [];
  const [newHsn, setNewHsn] = useState({ code: "", description: "", gst: 18, uqc: "NOS" });
  const [newUqc, setNewUqc] = useState("");

  const updateField = (key: string, val: any) => {
    change({ ...value, [key]: val });
  };

  const addHsn = () => {
    if (!newHsn.code) return;
    change({ ...value, hsn: [...hsnList, { ...newHsn }] });
    setNewHsn({ code: "", description: "", gst: 18, uqc: "NOS" });
  };

  const deleteHsn = (idx: number) => {
    change({ ...value, hsn: hsnList.filter((_, i) => i !== idx) });
  };

  const addUqc = () => {
    if (!newUqc.trim()) return;
    const tag = newUqc.trim().toUpperCase();
    if (!uqcList.includes(tag)) {
      change({ ...value, uqc: [...uqcList, tag] });
    }
    setNewUqc("");
  };

  const removeUqc = (tag: string) => {
    change({ ...value, uqc: uqcList.filter((u) => u !== tag) });
  };

  return (
    <div className="settingsstack">
      {/* Card 1: GST Profile */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>GST Profile &amp; Place of Supply</h3>
        <div className="settingsform">
          <Field label="GSTIN (15 characters)">
            <input
              value={value.gstin || ""}
              onChange={(e) => updateField("gstin", e.target.value.toUpperCase())}
              placeholder="33GIMPP4721H1Z2"
            />
          </Field>
          <Field label="Default Place of Supply">
            <select
              value={value.placeOfSupply || "Tamil Nadu"}
              onChange={(e) => updateField("placeOfSupply", e.target.value)}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default GST Pricing Mode">
            <select
              value={value.pricingMode || "exclusive"}
              onChange={(e) => updateField("pricingMode", e.target.value)}
            >
              <option value="exclusive">Exclusive of GST (Taxes added at checkout)</option>
              <option value="inclusive">Inclusive of GST (MRP prices)</option>
            </select>
          </Field>
          <Field label="Intra-State Tax Rule (Same State)">
            <input
              value={value.intraRule || "CGST + SGST"}
              onChange={(e) => updateField("intraRule", e.target.value)}
            />
          </Field>
          <Field label="Inter-State Tax Rule (Other States)">
            <input
              value={value.interRule || "IGST"}
              onChange={(e) => updateField("interRule", e.target.value)}
            />
          </Field>
          <Field label="Reverse Charge Mechanism (RCM)">
            <label className="switch" style={{ marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={!!value.reverseCharge}
                onChange={(e) => updateField("reverseCharge", e.target.checked)}
              />
              Reverse Charge Applicable
            </label>
          </Field>
        </div>
      </div>

      {/* Card 2: HSN Codes & GST Rates */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "12px" }}>HSN Codes &amp; GST Tax Rates</h3>
        <table className="milestonestable" style={{ marginBottom: "14px" }}>
          <thead>
            <tr>
              <th style={{ width: "20%" }}>HSN / SAC Code</th>
              <th style={{ width: "40%" }}>Description</th>
              <th style={{ width: "15%" }}>GST Rate (%)</th>
              <th style={{ width: "15%" }}>Unit (UQC)</th>
              <th style={{ width: "10%", textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {hsnList.map((h, i) => (
              <tr key={i}>
                <td><b>{h.code}</b></td>
                <td>{h.description}</td>
                <td><span className="percentagebadge valid">{h.gst}% GST</span></td>
                <td>{h.uqc || "NOS"}</td>
                <td style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#b42318",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                    onClick={() => deleteHsn(i)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add HSN Inline */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 100px 90px auto",
            gap: "8px",
            alignItems: "center",
            background: "#f8fafc",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <input
            placeholder="HSN (e.g. 853650)"
            value={newHsn.code}
            onChange={(e) => setNewHsn({ ...newHsn, code: e.target.value })}
          />
          <input
            placeholder="Description (e.g. Smart touch switches)"
            value={newHsn.description}
            onChange={(e) => setNewHsn({ ...newHsn, description: e.target.value })}
          />
          <select
            value={newHsn.gst}
            onChange={(e) => setNewHsn({ ...newHsn, gst: Number(e.target.value) })}
          >
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
          <select
            value={newHsn.uqc}
            onChange={(e) => setNewHsn({ ...newHsn, uqc: e.target.value })}
          >
            {uqcList.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={{
              background: "#1769ff",
              color: "#fff",
              border: 0,
              padding: "8px 14px",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "12px",
            }}
            onClick={addHsn}
          >
            ＋ Add HSN
          </button>
        </div>
      </div>

      {/* Card 3: Supported Units (UQC) */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "10px" }}>Standard Units of Measurement (UQC)</h3>
        <div className="taglistwrapper">
          <div className="tagpills">
            {uqcList.map((u) => (
              <span className="tagpill" key={u}>
                {u}
                <button type="button" onClick={() => removeUqc(u)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tagaddform">
            <input
              placeholder="New unit (e.g. SQFT, RFT, ROLL)"
              value={newUqc}
              onChange={(e) => setNewUqc(e.target.value)}
            />
            <button type="button" onClick={addUqc}>
              ＋ Add Unit
            </button>
          </div>
        </div>
      </div>

      {/* Card 4: Due Days & Rounding */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Invoice Payment &amp; Rounding</h3>
        <div className="settingsform">
          <Field label="Default Invoice Due Days">
            <input
              type="number"
              min="0"
              value={value.dueDays ?? 15}
              onChange={(e) => updateField("dueDays", Number(e.target.value))}
            />
          </Field>
          <Field label="Total Calculation Rounding">
            <select
              value={value.rounding || "Nearest rupee"}
              onChange={(e) => updateField("rounding", e.target.value)}
            >
              <option value="Nearest rupee">Nearest Rupee (Math.round)</option>
              <option value="Exact 2 decimals">Exact Two Decimals (Paisa)</option>
              <option value="Ceiling rupee">Next Higher Rupee (Math.ceil)</option>
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}

// 5. Quote and Invoice Numbering
export function NumberingRulesManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const updateField = (key: string, val: any) => {
    change({ ...value, [key]: val });
  };

  const quotePrefix = value.quotePrefix || "QT";
  const quoteStart = value.quoteStart || 1145;
  const invPrefix = value.invoicePrefix || "INV";
  const invStart = value.invoiceStart || 1;

  return (
    <div className="settingsstack">
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Quotation Numbering</h3>
        <div className="settingsform">
          <Field label="Quotation Prefix">
            <input
              value={value.quotePrefix || ""}
              onChange={(e) => updateField("quotePrefix", e.target.value)}
              placeholder="QT"
            />
          </Field>
          <Field label="Starting Sequence Number">
            <input
              type="number"
              value={value.quoteStart ?? 1145}
              onChange={(e) => updateField("quoteStart", Number(e.target.value))}
            />
          </Field>
          <Field label="Default Proposal Validity (Days)">
            <input
              type="number"
              value={value.quoteValidity ?? 30}
              onChange={(e) => updateField("quoteValidity", Number(e.target.value))}
            />
          </Field>
          <Field label="Revision Format String">
            <input
              value={value.revisionFormat || "Rev {n}"}
              onChange={(e) => updateField("revisionFormat", e.target.value)}
            />
          </Field>
        </div>
        <div
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            background: "#eff8ff",
            border: "1px solid #b2ddff",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: "#175cd3", fontWeight: 600 }}>
            Live Quotation Sequence Preview:
          </span>
          <b style={{ fontSize: "14px", color: "#175cd3", fontFamily: "monospace" }}>
            {quotePrefix}-{quoteStart} · Rev 0
          </b>
        </div>
      </div>

      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Invoice &amp; Credit / Debit Note Numbering</h3>
        <div className="settingsform">
          <Field label="Tax Invoice Prefix">
            <input
              value={value.invoicePrefix || ""}
              onChange={(e) => updateField("invoicePrefix", e.target.value)}
              placeholder="INV"
            />
          </Field>
          <Field label="Invoice Starting Number">
            <input
              type="number"
              value={value.invoiceStart ?? 1}
              onChange={(e) => updateField("invoiceStart", Number(e.target.value))}
            />
          </Field>
          <Field label="Credit Note Prefix">
            <input
              value={value.creditPrefix || "CN"}
              onChange={(e) => updateField("creditPrefix", e.target.value)}
            />
          </Field>
          <Field label="Debit Note Prefix">
            <input
              value={value.debitPrefix || "DN"}
              onChange={(e) => updateField("debitPrefix", e.target.value)}
            />
          </Field>
        </div>
        <div
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "12px", color: "#344054", fontWeight: 600 }}>
            Live Tax Invoice Sequence Preview:
          </span>
          <b style={{ fontSize: "14px", color: "#0f172a", fontFamily: "monospace" }}>
            {invPrefix}-000{invStart}
          </b>
        </div>
      </div>
    </div>
  );
}

// 6. Items, Categories, Suppliers and Price Rules (Masters)
export function MastersSettingsManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const categories: string[] = Array.isArray(value?.categories) ? value.categories : [];
  const brands: string[] = Array.isArray(value?.brands) ? value.brands : [];
  const expenseCategories: string[] = Array.isArray(value?.expenseCategories) ? value.expenseCategories : [];
  const [newCat, setNewCat] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newExp, setNewExp] = useState("");

  const updateField = (key: string, val: any) => {
    change({ ...value, [key]: val });
  };

  const addCategory = () => {
    if (!newCat.trim() || categories.includes(newCat.trim())) return;
    change({ ...value, categories: [...categories, newCat.trim()] });
    setNewCat("");
  };
  const removeCategory = (c: string) => {
    change({ ...value, categories: categories.filter((x) => x !== c) });
  };

  const addBrand = () => {
    if (!newBrand.trim() || brands.includes(newBrand.trim())) return;
    change({ ...value, brands: [...brands, newBrand.trim()] });
    setNewBrand("");
  };
  const removeBrand = (b: string) => {
    change({ ...value, brands: brands.filter((x) => x !== b) });
  };

  const addExpense = () => {
    if (!newExp.trim() || expenseCategories.includes(newExp.trim())) return;
    change({ ...value, expenseCategories: [...expenseCategories, newExp.trim()] });
    setNewExp("");
  };
  const removeExpense = (e: string) => {
    change({ ...value, expenseCategories: expenseCategories.filter((x) => x !== e) });
  };

  return (
    <div className="settingsstack">
      {/* Product Categories */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "6px" }}>Canonical Product Categories</h3>
        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#667085" }}>
          Products in the quotation and catalog modules are organized into these categories.
        </p>
        <div className="taglistwrapper">
          <div className="tagpills">
            {categories.map((c) => (
              <span className="tagpill" key={c}>
                {c}
                <button type="button" onClick={() => removeCategory(c)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tagaddform">
            <input
              placeholder="New category name"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <button type="button" onClick={addCategory}>
              ＋ Add Category
            </button>
          </div>
        </div>
      </div>

      {/* Brands */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "6px" }}>Brands &amp; Manufacturers</h3>
        <div className="taglistwrapper">
          <div className="tagpills">
            {brands.map((b) => (
              <span className="tagpill" key={b}>
                {b}
                <button type="button" onClick={() => removeBrand(b)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tagaddform">
            <input
              placeholder="New brand (e.g. Noviq, Autozon)"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
            />
            <button type="button" onClick={addBrand}>
              ＋ Add Brand
            </button>
          </div>
        </div>
      </div>

      {/* Discount & Margin Safeguards */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Discount Limits &amp; Pricing Safeguards</h3>
        <div className="settingsform">
          <Field label="Sales Employee Max Discount (%)">
            <input
              type="number"
              min="0"
              max="100"
              value={value.employeeDiscountLimit ?? 10}
              onChange={(e) => updateField("employeeDiscountLimit", Number(e.target.value))}
            />
          </Field>
          <Field label="Manager Approval-Required Discount (%)">
            <input
              type="number"
              min="0"
              max="100"
              value={value.approvalDiscountLimit ?? 15}
              onChange={(e) => updateField("approvalDiscountLimit", Number(e.target.value))}
            />
          </Field>
          <Field label="Minimum Margin Safeguard Rule" wide>
            <input
              value={value.marginRule || ""}
              onChange={(e) => updateField("marginRule", e.target.value)}
              placeholder="e.g. Selling price must remain strictly above minimum landing cost"
            />
          </Field>
          <Field label="Supplier Import Safeguard">
            <label className="switch" style={{ marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={value.supplierImportReview !== false}
                onChange={(e) => updateField("supplierImportReview", e.target.checked)}
              />
              Require administrator review before importing external vendor price lists
            </label>
          </Field>
        </div>
      </div>

      {/* Expense Categories & Threshold */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Expense Claim Categories &amp; Policies</h3>
        <div className="settingsform" style={{ marginBottom: "14px" }}>
          <Field label="Mandatory Receipt Proof Threshold (₹)">
            <input
              type="number"
              value={value.expenseReceiptThreshold ?? 1000}
              onChange={(e) => updateField("expenseReceiptThreshold", Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="taglistwrapper">
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#475467" }}>
            ALLOWED EXPENSE CATEGORIES:
          </span>
          <div className="tagpills">
            {expenseCategories.map((ec) => (
              <span className="tagpill" key={ec}>
                {ec}
                <button type="button" onClick={() => removeExpense(ec)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="tagaddform">
            <input
              placeholder="Add expense category"
              value={newExp}
              onChange={(e) => setNewExp(e.target.value)}
            />
            <button type="button" onClick={addExpense}>
              ＋ Add Expense Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 7. Workflow and Status Settings
export function WorkflowSettingsManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const leadStages: string[] = Array.isArray(value?.lead) ? value.lead : [];
  const quoteStages: string[] = Array.isArray(value?.quotation) ? value.quotation : [];
  const projectStages: string[] = Array.isArray(value?.project) ? value.project : [];
  const serviceStages: string[] = Array.isArray(value?.service) ? value.service : [];

  const [newLead, setNewLead] = useState("");
  const [newQuote, setNewQuote] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newService, setNewService] = useState("");

  const updateList = (pipe: string, list: string[]) => {
    change({ ...value, [pipe]: list });
  };

  return (
    <div className="settingsstack">
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Workflow Rules</h3>
        <div className="settingsform">
          <Field label="Stage Progression Enforcement">
            <label className="switch" style={{ marginTop: "8px" }}>
              <input
                type="checkbox"
                checked={value.requireStageChecks !== false}
                onChange={(e) => change({ ...value, requireStageChecks: e.target.checked })}
              />
              Require prerequisites check before advancing to next stage
            </label>
          </Field>
          <Field label="Default Follow-Up Reminder (Days)">
            <input
              type="number"
              value={value.defaultFollowupDays ?? 2}
              onChange={(e) => change({ ...value, defaultFollowupDays: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      {/* 4 Pipeline Stage Columns */}
      <div className="pipelinegrid">
        {/* Lead */}
        <div className="pipelinecard">
          <div className="pipelinecardhead">
            <span>◎ Leads Pipeline</span>
            <small style={{ color: "#667085" }}>{leadStages.length} stages</small>
          </div>
          <div className="pipelinelist">
            {leadStages.map((st, i) => (
              <div className="pipelinestage" key={i}>
                <span>{i + 1}. {st}</span>
                <button
                  type="button"
                  onClick={() => updateList("lead", leadStages.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <input
              style={{ fontSize: "11px", padding: "5px 8px" }}
              placeholder="New stage"
              value={newLead}
              onChange={(e) => setNewLead(e.target.value)}
            />
            <button
              type="button"
              style={{ padding: "5px 9px", fontSize: "11px" }}
              onClick={() => {
                if (newLead.trim()) {
                  updateList("lead", [...leadStages, newLead.trim()]);
                  setNewLead("");
                }
              }}
            >
              ＋
            </button>
          </div>
        </div>

        {/* Quotation */}
        <div className="pipelinecard">
          <div className="pipelinecardhead">
            <span>📄 Quotation Stages</span>
            <small style={{ color: "#667085" }}>{quoteStages.length} stages</small>
          </div>
          <div className="pipelinelist">
            {quoteStages.map((st, i) => (
              <div className="pipelinestage" key={i}>
                <span>{i + 1}. {st}</span>
                <button
                  type="button"
                  onClick={() => updateList("quotation", quoteStages.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <input
              style={{ fontSize: "11px", padding: "5px 8px" }}
              placeholder="New stage"
              value={newQuote}
              onChange={(e) => setNewQuote(e.target.value)}
            />
            <button
              type="button"
              style={{ padding: "5px 9px", fontSize: "11px" }}
              onClick={() => {
                if (newQuote.trim()) {
                  updateList("quotation", [...quoteStages, newQuote.trim()]);
                  setNewQuote("");
                }
              }}
            >
              ＋
            </button>
          </div>
        </div>

        {/* Project */}
        <div className="pipelinecard">
          <div className="pipelinecardhead">
            <span>🏗️ Project Execution</span>
            <small style={{ color: "#667085" }}>{projectStages.length} stages</small>
          </div>
          <div className="pipelinelist">
            {projectStages.map((st, i) => (
              <div className="pipelinestage" key={i}>
                <span>{i + 1}. {st}</span>
                <button
                  type="button"
                  onClick={() => updateList("project", projectStages.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <input
              style={{ fontSize: "11px", padding: "5px 8px" }}
              placeholder="New stage"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
            />
            <button
              type="button"
              style={{ padding: "5px 9px", fontSize: "11px" }}
              onClick={() => {
                if (newProject.trim()) {
                  updateList("project", [...projectStages, newProject.trim()]);
                  setNewProject("");
                }
              }}
            >
              ＋
            </button>
          </div>
        </div>

        {/* Service */}
        <div className="pipelinecard">
          <div className="pipelinecardhead">
            <span>⚒️ Service &amp; AMC</span>
            <small style={{ color: "#667085" }}>{serviceStages.length} stages</small>
          </div>
          <div className="pipelinelist">
            {serviceStages.map((st, i) => (
              <div className="pipelinestage" key={i}>
                <span>{i + 1}. {st}</span>
                <button
                  type="button"
                  onClick={() => updateList("service", serviceStages.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            <input
              style={{ fontSize: "11px", padding: "5px 8px" }}
              placeholder="New stage"
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
            />
            <button
              type="button"
              style={{ padding: "5px 9px", fontSize: "11px" }}
              onClick={() => {
                if (newService.trim()) {
                  updateList("service", [...serviceStages, newService.trim()]);
                  setNewService("");
                }
              }}
            >
              ＋
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 8. Notifications and Reminders
export function NotificationSettingsManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const updateToggle = (key: string, checked: boolean) => {
    change({ ...value, [key]: checked });
  };

  const alertItems = [
    { key: "followupDue", icon: "🔔", label: "Lead Follow-Up Due", desc: "Notify sales rep when scheduled contact time arrives" },
    { key: "overdueFollowup", icon: "⏳", label: "Overdue Lead Follow-Up", desc: "Escalate leads that haven't been updated in 48 hours" },
    { key: "quoteExpiry", icon: "📄", label: "Quotation Expiry Warning", desc: "Alert sales rep before a proposal hits validity expiration" },
    { key: "paymentDue", icon: "💰", label: "Payment Milestone Due", desc: "Remind project lead when site condition triggers a payment" },
    { key: "invoiceOverdue", icon: "⚠️", label: "Invoice Payment Overdue", desc: "Flag unpaid invoices exceeding default credit terms" },
    { key: "materialDelivery", icon: "🚚", label: "Material Procurement & Delivery", desc: "Notify site engineer when automation components arrive" },
    { key: "installationDue", icon: "🛠️", label: "Installation Scheduled & Due", desc: "Remind assigned technician on day of site deployment" },
    { key: "projectDelayed", icon: "🚨", label: "Project Milestone Delay", desc: "Alert admin if a project remains stalled in a stage" },
    { key: "taskOverdue", icon: "📋", label: "Task Overdue Notice", desc: "Remind staff of pending sub-tasks and site checks" },
    { key: "warrantyExpiry", icon: "🛡️", label: "Warranty Expiration Alert", desc: "Notify client and service desk 30 days before warranty ends" },
    { key: "amcRenewal", icon: "🔄", label: "AMC Contract Renewal", desc: "Prompt sales team for annual maintenance contract renewals" },
    { key: "serviceOverdue", icon: "🎫", label: "Service Ticket SLA Alert", desc: "Escalate open service complaints exceeding 24 hours" },
  ];

  return (
    <div className="settingsstack">
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Delivery Channel &amp; Target Audience</h3>
        <div className="settingsform">
          <Field label="Notification Channel">
            <select
              value={value.channel || "In-app"}
              onChange={(e) => change({ ...value, channel: e.target.value })}
            >
              <option value="In-app">In-App Notification Center Only</option>
              <option value="Email + In-app">Email + In-App Alerts</option>
              <option value="WhatsApp + In-app">WhatsApp + In-App Alerts</option>
              <option value="All Channels">All Channels (In-App, Email, WhatsApp)</option>
            </select>
          </Field>
          <Field label="Target Audience">
            <select
              value={value.audience || "Assigned staff and Admin"}
              onChange={(e) => change({ ...value, audience: e.target.value })}
            >
              <option value="Assigned staff and Admin">Assigned Staff and Administrators</option>
              <option value="Admin only">Administrators Only</option>
              <option value="All company users">All Active Company Users</option>
            </select>
          </Field>
          <Field label="Quotation Expiry Warning Threshold (Days)">
            <input
              type="number"
              value={value.quoteExpiryDays ?? 3}
              onChange={(e) => change({ ...value, quoteExpiryDays: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="settingscard">
        <h3 style={{ marginBottom: "12px" }}>Automated System Triggers</h3>
        <div className="notificationgrid">
          {alertItems.map((item) => (
            <div className="notificationswitchcard" key={item.key}>
              <span className="notificon">{item.icon}</span>
              <div className="notifdetails">
                <b>{item.label}</b>
                <small>{item.desc}</small>
                <label className="switch" style={{ marginTop: "6px" }}>
                  <input
                    type="checkbox"
                    checked={value[item.key] !== false}
                    onChange={(e) => updateToggle(item.key, e.target.checked)}
                  />
                  {value[item.key] !== false ? "Enabled" : "Disabled"}
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 9. Integrations
export function IntegrationSettingsManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  const zoho = value.zoho || { enabled: false, status: "Not connected" };
  const whatsapp = value.whatsapp || { enabled: false, status: "Not configured" };
  const email = value.email || { enabled: false, status: "Not configured" };
  const maps = value.maps || { enabled: true, status: "Link mode" };
  const storage = value.storage || { enabled: true, status: "Local R2 ready" };
  const backup = value.backup || { enabled: true, status: "Local database" };

  const updateService = (svc: string, field: string, val: any) => {
    change({
      ...value,
      [svc]: { ...(value[svc] || {}), [field]: val },
    });
  };

  return (
    <div className="settingsstack">
      <div className="integrationgrid">
        {/* Zoho */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#fef3f2", color: "#d92d20" }}>
                Z
              </span>
              <div>
                <b>Zoho Books / CRM</b>
                <div style={{ marginTop: "2px" }}>
                  <span className={`statuspill ${zoho.enabled ? "connected" : "idle"}`}>
                    {zoho.enabled ? "Enabled" : "Not connected"}
                  </span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!zoho.enabled}
                onChange={(e) => updateService("zoho", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <input
              placeholder="Zoho Organization ID"
              value={zoho.orgId || ""}
              onChange={(e) => updateService("zoho", "orgId", e.target.value)}
              disabled={!zoho.enabled}
            />
            <input
              placeholder="Client ID"
              value={zoho.clientId || ""}
              onChange={(e) => updateService("zoho", "clientId", e.target.value)}
              disabled={!zoho.enabled}
            />
          </div>
        </div>

        {/* WhatsApp */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#ecfdf3", color: "#027a48" }}>
                W
              </span>
              <div>
                <b>WhatsApp Business API</b>
                <div style={{ marginTop: "2px" }}>
                  <span className={`statuspill ${whatsapp.enabled ? "connected" : "idle"}`}>
                    {whatsapp.enabled ? "Configured" : "Not configured"}
                  </span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!whatsapp.enabled}
                onChange={(e) => updateService("whatsapp", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <input
              placeholder="Phone Number ID"
              value={whatsapp.phoneId || ""}
              onChange={(e) => updateService("whatsapp", "phoneId", e.target.value)}
              disabled={!whatsapp.enabled}
            />
            <input
              type="password"
              placeholder="Meta System Access Token"
              value={whatsapp.token || ""}
              onChange={(e) => updateService("whatsapp", "token", e.target.value)}
              disabled={!whatsapp.enabled}
            />
          </div>
        </div>

        {/* SMTP Email */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#eff8ff", color: "#175cd3" }}>
                ✉
              </span>
              <div>
                <b>SMTP Outgoing Mail</b>
                <div style={{ marginTop: "2px" }}>
                  <span className={`statuspill ${email.enabled ? "connected" : "idle"}`}>
                    {email.enabled ? "Active" : "Not configured"}
                  </span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={!!email.enabled}
                onChange={(e) => updateService("email", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <input
              placeholder="SMTP Host (e.g. smtp.gmail.com)"
              value={email.host || ""}
              onChange={(e) => updateService("email", "host", e.target.value)}
              disabled={!email.enabled}
            />
            <input
              placeholder="From Email (e.g. info@techomie.com)"
              value={email.from || ""}
              onChange={(e) => updateService("email", "from", e.target.value)}
              disabled={!email.enabled}
            />
          </div>
        </div>

        {/* Google Maps */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#fef6ee", color: "#b54708" }}>
                🗺
              </span>
              <div>
                <b>Google Maps Navigation</b>
                <div style={{ marginTop: "2px" }}>
                  <span className="statuspill connected">Link mode active</span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={maps.enabled !== false}
                onChange={(e) => updateService("maps", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <input
              placeholder="Optional Maps JavaScript API Key"
              value={maps.apiKey || ""}
              onChange={(e) => updateService("maps", "apiKey", e.target.value)}
            />
            <small style={{ color: "#667085", fontSize: "11px" }}>
              Direct deep links to Google Maps navigation for site technicians are enabled.
            </small>
          </div>
        </div>

        {/* Cloudflare Storage */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#f8f9fc", color: "#363f72" }}>
                ☁
              </span>
              <div>
                <b>Cloudflare R2 Object Storage</b>
                <div style={{ marginTop: "2px" }}>
                  <span className="statuspill connected">Connected</span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={storage.enabled !== false}
                onChange={(e) => updateService("storage", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <input
              placeholder="Bucket Name"
              value={storage.bucket || "techomie-uploads"}
              onChange={(e) => updateService("storage", "bucket", e.target.value)}
            />
            <small style={{ color: "#667085", fontSize: "11px" }}>
              Quotation PDFs, proposal photos, and site inspection receipts are archived here.
            </small>
          </div>
        </div>

        {/* Database Backup */}
        <div className="integrationcard">
          <div className="integrationcardhead">
            <div className="serviceidentity">
              <span className="serviceicon" style={{ background: "#fdf2fa", color: "#c11574" }}>
                🗄
              </span>
              <div>
                <b>Automated Database Backup</b>
                <div style={{ marginTop: "2px" }}>
                  <span className="statuspill connected">Automated Daily</span>
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={backup.enabled !== false}
                onChange={(e) => updateService("backup", "enabled", e.target.checked)}
              />
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <span style={{ fontSize: "12px", color: "#344054" }}>
              Daily automated snapshots of quotes, products, invoices and clients.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 10. Company Profile
export function CompanyProfileManager({
  value,
  change,
  upload,
}: {
  value: R;
  change: (k: string, v: any) => void;
  upload: (k: string, f?: File) => void;
}) {
  return (
    <div className="settingsstack">
      {/* 1. Identity & Visual Assets */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Company Identity &amp; Branding Assets</h3>
        <div className="settingsform">
          <Field label="Company Legal Name">
            <input
              value={value.legalName || ""}
              onChange={(e) => change("legalName", e.target.value)}
              placeholder="Techomie Smart Devices Private Limited"
            />
          </Field>
          <Field label="Display / Trade Name">
            <input
              value={value.displayName || ""}
              onChange={(e) => change("displayName", e.target.value)}
              placeholder="Techomie Smart Devices"
            />
          </Field>
          <Field label="Brand Name">
            <input
              value={value.brandName || ""}
              onChange={(e) => change("brandName", e.target.value)}
              placeholder="Techomie"
            />
          </Field>
          <Field label="Official Website URL">
            <input
              value={value.website || ""}
              onChange={(e) => change("website", e.target.value)}
              placeholder="https://www.techomie.com"
            />
          </Field>
          <Field label="Company Logo">
            <div className="assetfield">
              <input
                value={value.logo || ""}
                onChange={(e) => change("logo", e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload("logo", e.target.files?.[0])}
              />
            </div>
            {value.logo && (
              <img
                src={value.logo}
                alt="Logo"
                style={{
                  height: "42px",
                  objectFit: "contain",
                  marginTop: "6px",
                  background: "#f8fafc",
                  padding: "4px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
              />
            )}
          </Field>
          <Field label="Authorized Signature">
            <div className="assetfield">
              <input
                value={value.signature || ""}
                onChange={(e) => change("signature", e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload("signature", e.target.files?.[0])}
              />
            </div>
            {value.signature && (
              <img
                src={value.signature}
                alt="Signature"
                style={{
                  height: "36px",
                  objectFit: "contain",
                  marginTop: "6px",
                  background: "#f8fafc",
                  padding: "4px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
              />
            )}
          </Field>
          <Field label="Official Seal / Stamp">
            <div className="assetfield">
              <input
                value={value.seal || ""}
                onChange={(e) => change("seal", e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => upload("seal", e.target.files?.[0])}
              />
            </div>
          </Field>
        </div>
      </div>

      {/* 2. Tax & Legal Identifiers */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Tax &amp; Legal Identifiers</h3>
        <div className="settingsform">
          <Field label="GSTIN (Goods and Services Tax Number)">
            <input
              value={value.gstin || ""}
              onChange={(e) => change("gstin", e.target.value.toUpperCase())}
              placeholder="33GIMPP4721H1Z2"
            />
          </Field>
          <Field label="Permanent Account Number (PAN)">
            <input
              value={value.pan || ""}
              onChange={(e) => change("pan", e.target.value.toUpperCase())}
              placeholder="GIMPP4721H"
            />
          </Field>
          <Field label="Default Place of Supply">
            <select
              value={value.placeOfSupply || "Tamil Nadu"}
              onChange={(e) => change("placeOfSupply", e.target.value)}
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* 3. Address & Communication */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Registered Address &amp; Communication</h3>
        <div className="settingsform">
          <Field label="Registered Office Address" wide>
            <input
              value={value.address || ""}
              onChange={(e) => change("address", e.target.value)}
              placeholder="356/2, Church Road, Sri Murugan Nagar..."
            />
          </Field>
          <Field label="City">
            <input
              value={value.city || ""}
              onChange={(e) => change("city", e.target.value)}
              placeholder="Coimbatore"
            />
          </Field>
          <Field label="State">
            <input
              value={value.state || ""}
              onChange={(e) => change("state", e.target.value)}
              placeholder="Tamil Nadu"
            />
          </Field>
          <Field label="PIN / Postal Code">
            <input
              value={value.pincode || ""}
              onChange={(e) => change("pincode", e.target.value)}
              placeholder="641048"
            />
          </Field>
          <Field label="Country">
            <input
              value={value.country || "India"}
              onChange={(e) => change("country", e.target.value)}
            />
          </Field>
          <Field label="Official Phone Helpline">
            <input
              value={value.phone || ""}
              onChange={(e) => change("phone", e.target.value)}
              placeholder="07598883121"
            />
          </Field>
          <Field label="WhatsApp Business Number">
            <input
              value={value.whatsapp || ""}
              onChange={(e) => change("whatsapp", e.target.value)}
              placeholder="07598883121"
            />
          </Field>
          <Field label="Official Contact / Support Email">
            <input
              value={value.email || ""}
              onChange={(e) => change("email", e.target.value)}
              placeholder="info.techomie@gmail.com"
            />
          </Field>
        </div>
      </div>

      {/* 4. Financial Year & Localization */}
      <div className="settingscard">
        <h3 style={{ marginBottom: "14px" }}>Financial Year &amp; Localization</h3>
        <div className="settingsform">
          <Field label="Financial Year Begins">
            <select
              value={value.financialYearStart || "April"}
              onChange={(e) => change("financialYearStart", e.target.value)}
            >
              <option value="April">April (Standard Indian FY)</option>
              <option value="January">January (Calendar Year)</option>
            </select>
          </Field>
          <Field label="Financial Year Ends">
            <select
              value={value.financialYearEnd || "March"}
              onChange={(e) => change("financialYearEnd", e.target.value)}
            >
              <option value="March">March</option>
              <option value="December">December</option>
            </select>
          </Field>
          <Field label="Primary Currency">
            <input
              value={value.currency || "INR"}
              onChange={(e) => change("currency", e.target.value)}
            />
          </Field>
          <Field label="Time Zone">
            <input
              value={value.timeZone || "Asia/Kolkata"}
              onChange={(e) => change("timeZone", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// 11. Danger Zone
export function DangerZoneManager({
  value,
  change,
}: {
  value: R;
  change: (v: R) => void;
}) {
  return (
    <div className="settingsstack">
      <div className="settingscard" style={{ borderColor: "#fee4e2" }}>
        <h3 style={{ color: "#d92d20", marginBottom: "8px" }}>Data Retention &amp; Safety</h3>
        <p style={{ fontSize: "12px", color: "#667085", margin: "0 0 14px" }}>
          Configure document archival and production safeguard policies.
        </p>
        <div className="settingsform">
          <Field label="Archive Records Older Than">
            <select
              value={value.archiveAfterYears || 7}
              onChange={(e) => change({ ...value, archiveAfterYears: Number(e.target.value) })}
            >
              <option value={3}>3 Years</option>
              <option value={5}>5 Years</option>
              <option value={7}>7 Years (Standard Statutory Requirement)</option>
              <option value={10}>10 Years</option>
              <option value={99}>Permanent (Never purge)</option>
            </select>
          </Field>
          <Field label="Production Database Reset">
            <label className="switch" style={{ marginTop: "8px" }}>
              <input type="checkbox" disabled checked={false} />
              Reset Locked (Production Protected)
            </label>
          </Field>
        </div>
      </div>
    </div>
  );
}
