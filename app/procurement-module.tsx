"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./procurement-module.css";

type R = Record<string, any>;

const money = (n: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

/**
 * Strips the customer-facing brand name "Noviq" from product and model names
 * so OEM suppliers (Varni Digital, Phlipton, etc.) receive clean hardware model names.
 */
export function cleanModelName(name: string): string {
  if (!name) return "";
  let s = String(name);
  // Strip "Noviq " prefix (with optional separators like '-', ':', etc.)
  s = s.replace(/^noviq\s*[-–—·:/]?\s*/i, "");
  // Strip standalone "Noviq" anywhere else in the string
  s = s.replace(/\bnoviq\b/gi, "");
  // Collapse whitespace and trim stray leading punctuation
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/^[-–—·:/,]\s*/, "").trim();
  return s || name;
}

/**
 * Categorizes an item by its manufacturing supplier / OEM.
 */
export function detectSupplier(item: {
  name?: string;
  series?: string;
  brand?: string;
  sku?: string;
  category?: string;
  variantSummary?: string;
}): "Varni" | "Phlipton" | "Other" {
  const name = (item.name || "").toLowerCase();
  const series = (item.series || "").toLowerCase();
  const brand = (item.brand || "").toLowerCase();
  const sku = (item.sku || "").toUpperCase();
  const summary = (item.variantSummary || "").toLowerCase();
  const text = `${name} ${series} ${brand} ${sku} ${summary}`;

  // 1. Phlipton detection (Titan Zigbee, Luxeray, PN-TN, PN-LX, etc.)
  if (
    text.includes("phlipton") ||
    series.includes("titan") ||
    name.includes("titan") ||
    series.includes("luxeray") ||
    name.includes("luxeray") ||
    sku.startsWith("PN-") ||
    sku.startsWith("PH-") ||
    sku.includes("-TT-") ||
    sku.includes("-LX-")
  ) {
    return "Phlipton";
  }

  // 2. Varni Digital detection (Royal Edge, Edge, Touch Panel, Touch Plus, Color Touch Panel, etc.)
  if (
    text.includes("varni") ||
    series.includes("royal edge") ||
    series.includes("edge") ||
    series.includes("touch") ||
    text.includes("royal edge") ||
    text.includes("touch panel") ||
    text.includes("color touch panel") ||
    text.includes("edge color") ||
    text.includes("touch plus") ||
    sku.includes("-RE-") ||
    sku.includes("-EDG-") ||
    sku.includes("-TP-") ||
    item.category === "Smart switches" ||
    item.category === "Smart Switches"
  ) {
    return "Varni";
  }

  return "Other";
}

export default function ProcurementModule({
  role,
  initialFilter = {},
}: {
  role: string;
  initialFilter?: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<"quotation_list" | "tracker">("quotation_list");
  const [quotations, setQuotations] = useState<R[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
  const [currentQuotation, setCurrentQuotation] = useState<R | null>(null);
  const [materials, setMaterials] = useState<R[]>([]);
  const [projects, setProjects] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<"all" | "Varni" | "Phlipton" | "Other">("all");
  const [viewMode, setViewMode] = useState<"consolidated" | "roomwise">("consolidated");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncProjectId, setSyncProjectId] = useState<string>("");

  const isAdmin = role === "admin";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Load procurement data and quotation list
  const loadData = useCallback(async (quoteId?: number | null) => {
    setLoading(true);
    try {
      const qParam = quoteId ? `?quotationId=${quoteId}` : "";
      const res = await fetch(`/api/procurement${qParam}`);
      const data = await res.json();
      if (res.ok) {
        setQuotations(data.quotations || []);
        setProjects(data.projects || []);
        setMaterials(data.materials || []);
        if (data.currentQuotation) {
          setCurrentQuotation(data.currentQuotation);
          setSelectedQuoteId(data.currentQuotation.id);
        } else if (!quoteId && data.quotations?.length > 0) {
          // If none explicitly requested, fetch first
          setSelectedQuoteId(data.quotations[0].id);
          const firstRes = await fetch(`/api/procurement?quotationId=${data.quotations[0].id}`);
          const firstData = await firstRes.json();
          if (firstRes.ok && firstData.currentQuotation) {
            setCurrentQuotation(firstData.currentQuotation);
          }
        }
      }
    } catch (e: any) {
      console.error("Procurement load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(initialFilter.id ? Number(initialFilter.id) : null);
  }, [loadData, initialFilter.id]);

  const handleQuoteChange = async (id: number) => {
    setSelectedQuoteId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement?quotationId=${id}`);
      const data = await res.json();
      if (res.ok && data.currentQuotation) {
        setCurrentQuotation(data.currentQuotation);
      }
    } finally {
      setLoading(false);
    }
  };

  // Extract all items from current quotation snapshot
  const rawItems = useMemo(() => {
    if (!currentQuotation?.snapshot) return [];
    const snap = currentQuotation.snapshot;
    const items: (R & { floorName: string; roomName: string; locationKey: string })[] = [];

    (snap.floors || []).forEach((fl: R) => {
      const fName = fl.name || "Ground Floor";
      (fl.rooms || []).forEach((rm: R) => {
        const rName = rm.name || "Room";
        (rm.items || []).forEach((it: R) => {
          if (it.optional && it.excluded) return;
          items.push({
            ...it,
            floorName: fName,
            roomName: rName,
            locationKey: `${fName} - ${rName}`,
          });
        });
      });
    });

    (snap.projectItems || []).forEach((it: R) => {
      if (it.optional && it.excluded) return;
      items.push({
        ...it,
        floorName: "Project General",
        roomName: "Common Items",
        locationKey: "Project General",
      });
    });

    return items;
  }, [currentQuotation]);

  // Process and decorate each item with cleaned model name and supplier
  const processedItems = useMemo(() => {
    return rawItems.map((it: any) => {
      const supplier = detectSupplier(it);
      const cleanName = cleanModelName(it.name || "Switch Model");
      const cleanSeries = cleanModelName(it.series || "");
      const cleanSpecs = cleanModelName(it.variantSummary || "");
      const cleanDesc = cleanModelName(it.description || "");
      const unitCost = Number(it.purchaseCost ?? it.purchase_cost ?? it.buyingPrice ?? 0);
      const unitPrice = Number(it.price || 0);
      const qty = Number(it.qty || 1);
      const totalCost = unitCost * qty;
      const totalSelling = unitPrice * qty;
      const profit = totalSelling > 0 ? totalSelling - totalCost : 0;
      const margin = totalSelling > 0 ? Math.round((profit / totalSelling) * 100) : 0;
      return {
        ...it,
        supplier,
        cleanName,
        series: cleanSeries,
        variantSummary: cleanSpecs,
        description: cleanDesc,
        unitCost,
        unitPrice,
        totalCost,
        totalSelling,
        profit,
        margin,
      };
    });
  }, [rawItems]);

  // Filter items by selected supplier
  const filteredBySupplier = useMemo(() => {
    return processedItems.filter((it) => {
      if (supplierFilter !== "all" && it.supplier !== supplierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = it.cleanName.toLowerCase().includes(q);
        const matchesSku = (it.sku || "").toLowerCase().includes(q);
        const matchesLoc = (it.locationKey || "").toLowerCase().includes(q);
        const matchesSpecs = (it.variantSummary || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesLoc && !matchesSpecs) return false;
      }
      return true;
    });
  }, [processedItems, supplierFilter, search]);

  // Group into consolidated BOM for supplier purchase order
  const consolidatedBOM = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        cleanName: string;
        supplier: "Varni" | "Phlipton" | "Other";
        sku: string;
        series: string;
        technology: string;
        material: string;
        edgeColor: string;
        panelColor: string;
        module: string | number;
        variantSummary: string;
        unit: string;
        qty: number;
        unitCost: number;
        totalCost: number;
        unitPrice: number;
        totalSelling: number;
        rooms: Record<string, number>;
      }
    >();

    filteredBySupplier.forEach((it) => {
      // Group key based on model + series + tech + mat + edge + panel
      const groupKey = [
        it.cleanName.toLowerCase(),
        it.series || "",
        it.technology || "",
        it.material || "",
        it.edgeColor || "",
        it.panelColor || "",
        it.module || "",
      ].join("::");

      const existing = map.get(groupKey);
      const qty = Number(it.qty || 1);
      const loc = `${it.roomName}`;

      if (existing) {
        existing.qty += qty;
        existing.totalCost += it.unitCost * qty;
        existing.totalSelling += (it.unitPrice || 0) * qty;
        existing.rooms[loc] = (existing.rooms[loc] || 0) + qty;
      } else {
        map.set(groupKey, {
          key: groupKey,
          cleanName: it.cleanName,
          supplier: it.supplier,
          sku: it.sku || "",
          series: it.series || "",
          technology: it.technology || "",
          material: it.material || "",
          edgeColor: it.edgeColor || "",
          panelColor: it.panelColor || "",
          module: it.module || "",
          variantSummary: it.variantSummary || "",
          unit: it.unit || "Nos",
          qty,
          unitCost: it.unitCost,
          totalCost: it.unitCost * qty,
          unitPrice: it.unitPrice || 0,
          totalSelling: (it.unitPrice || 0) * qty,
          rooms: { [loc]: qty },
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.cleanName.localeCompare(b.cleanName));
  }, [filteredBySupplier]);

  // Supplier count badges
  const supplierCounts = useMemo(() => {
    const counts = { all: processedItems.length, Varni: 0, Phlipton: 0, Other: 0 };
    processedItems.forEach((it) => {
      counts[it.supplier] = (counts[it.supplier] || 0) + 1;
    });
    return counts;
  }, [processedItems]);

  // Total quantity, cost, selling price & profit
  const totalStats = useMemo(() => {
    const totalQty = consolidatedBOM.reduce((a, b) => a + b.qty, 0);
    const totalCost = consolidatedBOM.reduce((a, b) => a + b.totalCost, 0);
    const totalSelling = consolidatedBOM.reduce((a, b) => a + (b.totalSelling || 0), 0);
    const totalProfit = totalSelling - totalCost;
    const margin = totalSelling > 0 ? Math.round((totalProfit / totalSelling) * 100) : 0;
    return { totalQty, totalCost, totalSelling, totalProfit, margin };
  }, [consolidatedBOM]);

  // Generate text format for WhatsApp / Email purchase order
  const orderCopyText = useMemo(() => {
    const supplierTitle =
      supplierFilter === "Varni"
        ? "VARNI DIGITAL"
        : supplierFilter === "Phlipton"
          ? "PHLIPTON SMART PRODUCTS"
          : "OEM PROCUREMENT";

    const lines = [
      `========================================`,
      `PURCHASE ORDER: ${supplierTitle}`,
      `Ref Quotation: ${currentQuotation?.number || "—"}`,
      `Customer / Site: ${currentQuotation?.customer_name || "Techomie Project"} (${currentQuotation?.site_name || "Site"})`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Total Required Quantity: ${totalStats.totalQty} Units`,
      `========================================`,
      ``,
    ];

    consolidatedBOM.forEach((it, idx) => {
      const specs = [
        it.series,
        it.module ? `${it.module}M` : null,
        it.technology,
        it.material,
        it.edgeColor ? `${it.edgeColor}` : null,
        it.panelColor ? `${it.panelColor}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      lines.push(`${idx + 1}. ${it.cleanName}`);
      if (specs) lines.push(`   Specs: ${specs}`);
      if (it.sku) lines.push(`   SKU: ${it.sku}`);
      lines.push(`   Quantity: ${it.qty} ${it.unit}`);
      lines.push(
        `   Locations: ${Object.entries(it.rooms)
          .map(([r, q]) => `${r} (${q})`)
          .join(", ")}`,
      );
      lines.push(``);
    });

    lines.push(`========================================`);
    lines.push(`Total Line Items: ${consolidatedBOM.length}`);
    lines.push(`Total Quantity: ${totalStats.totalQty} Nos`);
    lines.push(`Please confirm manufacturing & delivery schedule.`);
    lines.push(`Techomie Operations Team`);

    return lines.join("\n");
  }, [supplierFilter, currentQuotation, totalStats, consolidatedBOM]);

  // CSV Export for Supplier
  const exportSupplierCSV = () => {
    const supplierTitle = supplierFilter === "all" ? "All-Suppliers" : supplierFilter;
    const filename = `Techomie-Procurement-${supplierTitle}-${currentQuotation?.number || "Quote"}.csv`;

    const headers = [
      "Sl No",
      "Model Name (OEM)",
      "Supplier",
      "Series",
      "Module",
      "Technology",
      "Material",
      "Edge Colour",
      "Panel Colour",
      "SKU",
      "Quantity",
      "Unit",
      "Room Allocations",
      ...(isAdmin ? ["Unit Cost", "Total Cost"] : []),
    ];

    const rows = consolidatedBOM.map((it, idx) => [
      idx + 1,
      `"${it.cleanName.replaceAll('"', '""')}"`,
      `"${it.supplier}"`,
      `"${it.series || ""}"`,
      `"${it.module || ""}"`,
      `"${it.technology || ""}"`,
      `"${it.material || ""}"`,
      `"${it.edgeColor || ""}"`,
      `"${it.panelColor || ""}"`,
      `"${it.sku || ""}"`,
      it.qty,
      `"${it.unit}"`,
      `"${Object.entries(it.rooms)
        .map(([r, q]) => `${r}: ${q}`)
        .join("; ")}"`,
      ...(isAdmin ? [it.unitCost, it.totalCost] : []),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showToast(`Exported ${filename}`);
  };

  // Sync / Push to Project Materials
  const handleSyncToProject = async () => {
    const targetProjId = syncProjectId || currentQuotation?.linked_project_id;
    if (!targetProjId) {
      alert("Please select a target Project to receive these procurement items.");
      return;
    }

    try {
      const itemsToSync = consolidatedBOM.map((it) => ({
        name: it.cleanName,
        sku: it.sku,
        requiredQty: it.qty,
        purchaseCost: it.unitCost,
      }));

      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_to_materials",
          projectId: targetProjId,
          items: itemsToSync,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Synced ${data.count} items into Project ${targetProjId}!`);
        setSyncModalOpen(false);
        loadData(selectedQuoteId);
      } else {
        alert(data.error || "Failed to sync materials");
      }
    } catch (e: any) {
      alert(e.message || "Network error");
    }
  };

  return (
    <div className="procurement-page">
      {/* Top Hero */}
      <div className="procurement-hero">
        <div>
          <small>TECHOMIE OPERATIONS</small>
          <h1>Procurement &amp; Material Management</h1>
          <p>
            Generate quotation-based procurement lists, filter by OEM suppliers (Varni &amp; Phlipton),
            and manage hardware ordering without customer-facing branding.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {activeTab === "quotation_list" && (
            <button className="btn-procurement-action primary" onClick={() => setCopyModalOpen(true)}>
              📋 Copy Order for WhatsApp / Email
            </button>
          )}
        </div>
      </div>

      {toast && <div className="toast">✓ {toast}</div>}

      {/* Main Tabs */}
      <div className="procurement-tabs">
        <button
          className={`procurement-tab-btn ${activeTab === "quotation_list" ? "active" : ""}`}
          onClick={() => setActiveTab("quotation_list")}
        >
          <span>📋</span> Quotation Procurement List
        </button>
        <button
          className={`procurement-tab-btn ${activeTab === "tracker" ? "active" : ""}`}
          onClick={() => setActiveTab("tracker")}
        >
          <span>🚚</span> Material Delivery Tracker ({materials.length})
        </button>
      </div>

      {activeTab === "quotation_list" ? (
        <>
          {/* Quotation Selection Bar */}
          <div className="procurement-quote-bar">
            <div className="procurement-quote-controls">
              <div className="procurement-quote-select-wrap">
                <label>Select Quotation to Auto-Generate Procurement List</label>
                <select
                  className="procurement-quote-select"
                  value={selectedQuoteId || ""}
                  onChange={(e) => handleQuoteChange(Number(e.target.value))}
                >
                  {quotations.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.number} (Rev {q.revision || 0}) — {q.customer_name || "Customer"} ·{" "}
                      {q.site_name || "Site"} · {q.status}
                    </option>
                  ))}
                </select>
              </div>

              {currentQuotation && (
                <div className="procurement-quote-summary-tags">
                  <div className="quote-tag">
                    <small>Customer &amp; Site</small>
                    <b>
                      {currentQuotation.customer_name} · {currentQuotation.site_name}
                    </b>
                  </div>
                  <div className="quote-tag">
                    <small>Quote Date</small>
                    <b>{currentQuotation.quote_date || "—"}</b>
                  </div>
                  <div className="quote-tag">
                    <small>Total Raw Items</small>
                    <b>{processedItems.length} units</b>
                  </div>
                  {isAdmin && (
                    <>
                      <div className="quote-tag highlight">
                        <small>Est. Buying Cost</small>
                        <b>{money(totalStats.totalCost)}</b>
                      </div>
                      <div className="quote-tag highlight" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                        <small style={{ color: "#065f46" }}>Est. Gross Profit</small>
                        <b style={{ color: totalStats.totalProfit >= 0 ? "#059669" : "#dc2626" }}>
                          {money(totalStats.totalProfit)} ({totalStats.margin}%)
                        </b>
                      </div>
                    </>
                  )}
                  {currentQuotation.linked_project_id && (
                    <div className="quote-tag">
                      <small>Linked Project</small>
                      <b>{currentQuotation.linked_project_id}</b>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Supplier Filters & Action Buttons */}
          <div className="procurement-filter-bar">
            <div className="supplier-pills">
              <button
                className={`supplier-pill ${supplierFilter === "all" ? "active" : ""}`}
                onClick={() => setSupplierFilter("all")}
              >
                All Suppliers
                <span className="pill-count">{supplierCounts.all}</span>
              </button>

              <button
                className={`supplier-pill varni ${supplierFilter === "Varni" ? "active" : ""}`}
                onClick={() => setSupplierFilter("Varni")}
                title="Varni Digital: Smart switches, Royal Edge, Edge, Touch panels"
              >
                🟣 Varni Digital
                <span className="pill-count">{supplierCounts.Varni}</span>
              </button>

              <button
                className={`supplier-pill phlipton ${supplierFilter === "Phlipton" ? "active" : ""}`}
                onClick={() => setSupplierFilter("Phlipton")}
                title="Phlipton: Titan series, Luxeray, Zigbee touch models"
              >
                🔵 Phlipton
                <span className="pill-count">{supplierCounts.Phlipton}</span>
              </button>

              <button
                className={`supplier-pill other ${supplierFilter === "Other" ? "active" : ""}`}
                onClick={() => setSupplierFilter("Other")}
                title="Other hardware: Smart door locks, sensors, sirens, gate automation"
              >
                ⚪ Other Hardware
                <span className="pill-count">{supplierCounts.Other}</span>
              </button>
            </div>

            <div className="procurement-actions">
              <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: "8px", padding: "2px" }}>
                <button
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: viewMode === "consolidated" ? "#ffffff" : "transparent",
                    color: viewMode === "consolidated" ? "#0f172a" : "#64748b",
                    boxShadow: viewMode === "consolidated" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                  onClick={() => setViewMode("consolidated")}
                >
                  Consolidated BOM
                </button>
                <button
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: viewMode === "roomwise" ? "#ffffff" : "transparent",
                    color: viewMode === "roomwise" ? "#0f172a" : "#64748b",
                    boxShadow: viewMode === "roomwise" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                  onClick={() => setViewMode("roomwise")}
                >
                  Room-wise View
                </button>
              </div>

              <button className="btn-procurement-action" onClick={exportSupplierCSV} title="Download CSV for Supplier">
                📥 Export CSV
              </button>

              <button
                className="btn-procurement-action"
                onClick={() => setSyncModalOpen(true)}
                title="Push items into Project Materials tracker"
              >
                ⚡ Sync to Materials Tracker
              </button>
            </div>
          </div>

          {/* Supplier Notice Banner */}
          <div className="procurement-notice-banner">
            <div>
              <b>🔒 OEM Confidential View:</b> Notice that <b>Noviq</b> branding has been automatically omitted from all
              model descriptions below, ensuring this list is ready to send directly to{" "}
              {supplierFilter === "Varni"
                ? "Varni Digital"
                : supplierFilter === "Phlipton"
                  ? "Phlipton"
                  : "OEM suppliers"}
              .
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d" }}>
              Showing {consolidatedBOM.length} Models ({totalStats.totalQty} Units)
            </span>
          </div>

          {/* Procurement Table */}
          <div className="procurement-table-card">
            {loading ? (
              <div className="empty-procurement">
                <p>Loading quotation procurement items…</p>
              </div>
            ) : consolidatedBOM.length === 0 ? (
              <div className="empty-procurement">
                <h3>No items match the selected supplier filter</h3>
                <p>
                  No items found for <b>{supplierFilter === "all" ? "this quotation" : supplierFilter}</b>. Try selecting
                  another supplier tab or clearing your search.
                </p>
              </div>
            ) : viewMode === "consolidated" ? (
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Model / Item (OEM Name)</th>
                    <th>Supplier</th>
                    <th>Specifications &amp; Configuration</th>
                    <th>Rooms &amp; Allocations</th>
                    <th style={{ textAlign: "right" }}>Total Required</th>
                    {isAdmin && <th style={{ textAlign: "right" }}>Buying Cost</th>}
                    {isAdmin && <th style={{ textAlign: "right" }}>Quoted Price</th>}
                    {isAdmin && <th style={{ textAlign: "right" }}>Est. Profit</th>}
                  </tr>
                </thead>
                <tbody>
                  {consolidatedBOM.map((it, idx) => {
                    const itProfit = (it.totalSelling || 0) - it.totalCost;
                    const itMargin = (it.totalSelling || 0) > 0 ? Math.round((itProfit / it.totalSelling) * 100) : 0;
                    return (
                      <tr key={it.key}>
                        <td style={{ color: "#94a3b8", fontWeight: 600 }}>{idx + 1}</td>
                        <td className="model-name-cell">
                          <b>{it.cleanName}</b>
                          {it.sku && <small>{it.sku}</small>}
                        </td>
                        <td>
                          <span className={`supplier-badge ${it.supplier.toLowerCase()}`}>
                            {it.supplier === "Varni"
                              ? "Varni Digital"
                              : it.supplier === "Phlipton"
                                ? "Phlipton"
                                : "Other Hardware"}
                          </span>
                        </td>
                        <td>
                          <div>
                            {it.series && <span className="spec-pill">{it.series}</span>}
                            {it.module && <span className="spec-pill module">{it.module}M Panel</span>}
                            {it.technology && <span className="spec-pill">{it.technology}</span>}
                            {it.material && <span className="spec-pill">{it.material}</span>}
                            {it.edgeColor && <span className="spec-pill">{it.edgeColor}</span>}
                            {it.panelColor && <span className="spec-pill">{it.panelColor}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="room-chips">
                            {Object.entries(it.rooms).map(([rm, q]) => (
                              <span key={rm} className="room-chip">
                                {rm}: <b>{q}</b>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="qty-cell" style={{ textAlign: "right" }}>
                          {it.qty} <small>{it.unit}</small>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: "right", color: "#475569" }}>
                            {money(it.totalCost)}
                            <small style={{ display: "block", color: "#94a3b8", fontSize: "10px" }}>{money(it.unitCost)}/u</small>
                          </td>
                        )}
                        {isAdmin && (
                          <td style={{ textAlign: "right", color: "#1e293b", fontWeight: 600 }}>
                            {money(it.totalSelling)}
                            <small style={{ display: "block", color: "#94a3b8", fontSize: "10px" }}>{money(it.unitPrice)}/u</small>
                          </td>
                        )}
                        {isAdmin && (
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontWeight: 800, color: itProfit >= 0 ? "#059669" : "#dc2626" }}>
                              {money(itProfit)}
                            </span>
                            <small style={{ display: "block", color: itProfit >= 0 ? "#16a34a" : "#ef4444", fontSize: "10px", fontWeight: 700 }}>
                              {itMargin}% margin
                            </small>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: "14px", textAlign: "right" }}>
                      TOTALS FOR {supplierFilter.toUpperCase()}:
                    </td>
                    <td className="qty-cell" style={{ textAlign: "right" }}>
                      {totalStats.totalQty} Nos
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: "right", color: "#475569" }}>
                        {money(totalStats.totalCost)}
                      </td>
                    )}
                    {isAdmin && (
                      <td style={{ textAlign: "right", color: "#1e293b" }}>
                        {money(totalStats.totalSelling)}
                      </td>
                    )}
                    {isAdmin && (
                      <td style={{ textAlign: "right", color: totalStats.totalProfit >= 0 ? "#059669" : "#dc2626", fontSize: "14px" }}>
                        {money(totalStats.totalProfit)} ({totalStats.margin}%)
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            ) : (
              // Room-wise View
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Floor &amp; Room</th>
                    <th>Model / Item (OEM Name)</th>
                    <th>Supplier</th>
                    <th>Specifications</th>
                    <th style={{ textAlign: "right" }}>Room Qty</th>
                    {isAdmin && <th style={{ textAlign: "right" }}>Total Cost</th>}
                    {isAdmin && <th style={{ textAlign: "right" }}>Quoted Price</th>}
                    {isAdmin && <th style={{ textAlign: "right" }}>Est. Profit</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredBySupplier.map((it, idx) => {
                    const rowProfit = (it.totalSelling || 0) - it.totalCost;
                    const rowMargin = (it.totalSelling || 0) > 0 ? Math.round((rowProfit / it.totalSelling) * 100) : 0;
                    return (
                      <tr key={`${it.locationKey}-${idx}`}>
                        <td>
                          <b>{it.roomName}</b>
                          <small style={{ display: "block", color: "#64748b" }}>{it.floorName}</small>
                        </td>
                        <td className="model-name-cell">
                          <b>{it.cleanName}</b>
                          {it.sku && <small>{it.sku}</small>}
                        </td>
                        <td>
                          <span className={`supplier-badge ${it.supplier.toLowerCase()}`}>
                            {it.supplier}
                          </span>
                        </td>
                        <td>
                          {it.series && <span className="spec-pill">{it.series}</span>}
                          {it.module && <span className="spec-pill module">{it.module}M</span>}
                          {it.technology && <span className="spec-pill">{it.technology}</span>}
                          {it.material && <span className="spec-pill">{it.material}</span>}
                        </td>
                        <td className="qty-cell" style={{ textAlign: "right" }}>
                          {it.qty} <small>{it.unit || "Nos"}</small>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: "right", color: "#475569" }}>
                            {money(it.totalCost)}
                            <small style={{ display: "block", color: "#94a3b8", fontSize: "10px" }}>{money(it.unitCost)}/u</small>
                          </td>
                        )}
                        {isAdmin && (
                          <td style={{ textAlign: "right", color: "#1e293b", fontWeight: 600 }}>
                            {money(it.totalSelling)}
                            <small style={{ display: "block", color: "#94a3b8", fontSize: "10px" }}>{money(it.unitPrice)}/u</small>
                          </td>
                        )}
                        {isAdmin && (
                          <td style={{ textAlign: "right" }}>
                            <span style={{ fontWeight: 800, color: rowProfit >= 0 ? "#059669" : "#dc2626" }}>
                              {money(rowProfit)}
                            </span>
                            <small style={{ display: "block", color: rowProfit >= 0 ? "#16a34a" : "#ef4444", fontSize: "10px", fontWeight: 700 }}>
                              {rowMargin}% margin
                            </small>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        // Tab 2: Material Delivery Tracker
        <div className="procurement-table-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700 }}>Project Material Fulfillment Tracker</h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Track required, ordered, received, and at-site quantities for all ongoing automation projects.
              </p>
            </div>
            <button className="btn-procurement-action primary" onClick={() => loadData()}>
              ↻ Refresh Live Status
            </button>
          </div>

          {materials.length === 0 ? (
            <div className="empty-procurement">
              <h3>No materials tracked yet</h3>
              <p>
                Use the <b>&quot;Quotation Procurement List&quot;</b> tab above and click <b>&quot;Sync to Materials Tracker&quot;</b> to push items into this execution tracker.
              </p>
            </div>
          ) : (
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Material / Product</th>
                  <th>Project / Customer</th>
                  <th style={{ textAlign: "center" }}>Required</th>
                  <th style={{ textAlign: "center" }}>Ordered</th>
                  <th style={{ textAlign: "center" }}>Received</th>
                  <th style={{ textAlign: "center" }}>At Site</th>
                  <th style={{ textAlign: "center" }}>Installed</th>
                  <th>Status</th>
                  <th>Expected Delivery</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Cost</th>}
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className="model-name-cell">
                      <b>{cleanModelName(m.name)}</b>
                      <small>{m.sku || "Hardware Item"}</small>
                    </td>
                    <td>
                      <b>{m.project_title || m.project_id}</b>
                      <small style={{ display: "block", color: "#64748b" }}>
                        {m.customer_name} · {m.site_name}
                      </small>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{m.required_qty}</td>
                    <td style={{ textAlign: "center" }}>{m.ordered_qty || 0}</td>
                    <td style={{ textAlign: "center" }}>{m.received_qty || 0}</td>
                    <td style={{ textAlign: "center" }}>{m.at_site_qty || 0}</td>
                    <td style={{ textAlign: "center" }}>{m.installed_qty || 0}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: m.status === "Installed" ? "#ecfdf5" : m.status === "Received" ? "#f0f9ff" : "#fffbeb",
                          color: m.status === "Installed" ? "#059669" : m.status === "Received" ? "#0284c7" : "#b45309",
                        }}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "#64748b" }}>{m.expected_delivery || "—"}</td>
                    {isAdmin && (
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {m.buying_price ? money(m.buying_price) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Copy for WhatsApp / Email Modal */}
      {copyModalOpen && (
        <div className="procurement-modal-backdrop" onClick={() => setCopyModalOpen(false)}>
          <div className="procurement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-modal-header">
              <h3>Supplier Purchase Order Text (Ready for WhatsApp / Email)</h3>
              <button
                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}
                onClick={() => setCopyModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="procurement-modal-body">
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#64748b" }}>
                Formatted specifically for <b>{supplierFilter === "all" ? "All Suppliers" : supplierFilter}</b> without
                &quot;Noviq&quot; branding. Click copy to send directly to the supplier:
              </p>
              <textarea className="procurement-copy-textarea" readOnly value={orderCopyText} />
            </div>
            <div className="procurement-modal-footer">
              <button className="btn-procurement-action" onClick={() => setCopyModalOpen(false)}>
                Close
              </button>
              <button
                className="btn-procurement-action primary"
                onClick={() => {
                  navigator.clipboard.writeText(orderCopyText);
                  showToast("Order text copied to clipboard!");
                  setCopyModalOpen(false);
                }}
              >
                📋 Copy Text to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync to Project Materials Modal */}
      {syncModalOpen && (
        <div className="procurement-modal-backdrop" onClick={() => setSyncModalOpen(false)}>
          <div className="procurement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="procurement-modal-header">
              <h3>Push Items into Project Materials Tracker</h3>
              <button
                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}
                onClick={() => setSyncModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="procurement-modal-body">
              <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#475467" }}>
                This will push all <b>{consolidatedBOM.length} models ({totalStats.totalQty} units)</b> into the Project
                Material Tracker so operations and technicians can record dispatch, arrival, and installation.
              </p>

              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                Select Target Project
              </label>
              <select
                className="procurement-quote-select"
                value={syncProjectId || currentQuotation?.linked_project_id || ""}
                onChange={(e) => setSyncProjectId(e.target.value)}
              >
                <option value="">-- Choose a Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.title} ({p.customer_name || "Customer"} · {p.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="procurement-modal-footer">
              <button className="btn-procurement-action" onClick={() => setSyncModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-procurement-action primary" onClick={handleSyncToProject}>
                ⚡ Confirm &amp; Push to Tracker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
