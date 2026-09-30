"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./academy.css";

type R = Record<string, any>;

interface AcademyProps {
  role: string;
  user: {
    id?: string;
    name: string;
    email: string;
    role: string;
  };
  initialFilter?: Record<string, string>;
  onNavigate?: (module: string, filter?: Record<string, string>) => void;
}

export default function AcademyModule({ role, user, initialFilter = {}, onNavigate }: AcademyProps) {
  const isAdmin = role === "admin";

  // Tab State
  const [activeTab, setActiveTab] = useState<string>(
    initialFilter.tab || (isAdmin ? "overview" : "my-tasks")
  );

  // Core Data
  const [stats, setStats] = useState<R | null>(null);
  const [tasks, setTasks] = useState<R[]>([]);
  const [assignments, setAssignments] = useState<R[]>([]);
  const [challenges, setChallenges] = useState<R[]>([]);
  const [kbArticles, setKbArticles] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState(initialFilter.employeeId || "");

  // Modals & Drawers
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(initialFilter.assignmentId || null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(initialFilter.challengeId || null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showConvertToKbModal, setShowConvertToKbModal] = useState<R | null>(null);
  const [inspectEmployee, setInspectEmployee] = useState<R | null>(null);

  // Load Academy Statistics
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/academy/stats");
      if (res.ok) {
        const d = await res.json();
        setStats(d);
      }
    } catch {}
  }, []);

  // Load Assignments
  const loadAssignments = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      if (employeeFilter) p.set("employeeId", employeeFilter);
      if (search) p.set("q", search);
      const res = await fetch(`/api/academy/assignments?${p.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setAssignments(d.assignments || []);
      }
    } catch {}
  }, [statusFilter, employeeFilter, search]);

  // Load Tasks
  const loadTasks = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (categoryFilter) p.set("category", categoryFilter);
      if (search) p.set("q", search);
      const res = await fetch(`/api/academy/tasks?${p.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks || []);
      }
    } catch {}
  }, [categoryFilter, search]);

  // Load Challenges
  const loadChallenges = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      if (statusFilter) p.set("status", statusFilter);
      const res = await fetch(`/api/academy/challenges?${p.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setChallenges(d.challenges || []);
      }
    } catch {}
  }, [search, statusFilter]);

  // Load Knowledge Base
  const loadKb = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      const res = await fetch(`/api/academy/kb?${p.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setKbArticles(d.articles || []);
      }
    } catch {}
  }, [search]);

  // Primary loader based on tab
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadAssignments(),
      loadTasks(),
      loadChallenges(),
      loadKb(),
    ]);
    setLoading(false);
  }, [loadStats, loadAssignments, loadTasks, loadChallenges, loadKb]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Toast notice helper
  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  // Auto-assign tasks to all non-admin employees (Admin only)
  const handleAutoAssign = async () => {
    if (!window.confirm("Auto-assign all published mandatory tasks to all active non-admin employees?")) return;
    try {
      const res = await fetch("/api/academy/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "auto-assign-all" }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`✓ ${d.message}`);
        refreshAll();
      } else {
        alert(d.error || "Auto-assignment failed");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to auto-assign");
    }
  };

  // Export Training Report as CSV (Admin only)
  const handleExportReport = () => {
    if (!assignments.length) {
      alert("No assignment data available to export.");
      return;
    }
    const headers = ["Employee", "Email", "Role", "Task ID", "Task Title", "Category", "Status", "Progress %", "Due Date", "Completed Date"];
    const rows = assignments.map(a => [
      `"${a.employee_name || ""}"`,
      `"${a.employee_email || ""}"`,
      `"${a.employee_role || ""}"`,
      `"${a.task_id || ""}"`,
      `"${a.task_title || ""}"`,
      `"${a.task_category || ""}"`,
      `"${a.computed_status || a.status || ""}"`,
      `"${a.progress_percent || 0}%"`,
      `"${a.due_at || ""}"`,
      `"${a.completed_at || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Techomie-Academy-Report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("✓ Academy training report downloaded.");
  };

  return (
    <div className="acad-container">
      {/* Academy Top Header */}
      <header className="acad-header">
        <div className="acad-header-top">
          <div className="acad-title-group">
            <small>
              <span>🎓</span> Technical Academy & Training Experiments
            </small>
            <h1>{isAdmin ? "Academy Operations & Progress Hub" : "My Technical Training & Experiments"}</h1>
            <p>
              {isAdmin
                ? "Monitor employee training experiments, evaluate submission evidence, and resolve technical hardware challenges."
                : "Complete hands-on smart home experiments, submit test evidence, and report technical challenges."}
            </p>
          </div>

          <div className="acad-header-actions">
            {notice && (
              <span style={{ fontSize: "12px", background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0", padding: "6px 12px", borderRadius: "8px", fontWeight: 600 }}>
                {notice}
              </span>
            )}

            {!isAdmin && (
              <button
                className="acad-btn acad-btn-amber"
                onClick={() => setShowChallengeModal(true)}
              >
                <span>⚡</span> Report Challenge
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  className="acad-btn acad-btn-primary"
                  onClick={handleAutoAssign}
                  title="Assign active tasks to all eligible staff"
                >
                  <span>＋</span> Auto-Assign All
                </button>

                <button
                  className="acad-btn acad-btn-secondary"
                  onClick={() => setShowCreateTaskModal(true)}
                >
                  <span>＋</span> Create Task
                </button>

                <button
                  className="acad-btn acad-btn-secondary"
                  onClick={handleExportReport}
                  title="Download CSV training progress matrix"
                >
                  <span>▤</span> Export Report
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="acad-nav-tabs">
          {isAdmin ? (
            <>
              <button
                className={`acad-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                <span>📊</span> Executive Overview
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "assignments" ? "active" : ""}`}
                onClick={() => setActiveTab("assignments")}
              >
                <span>📋</span> All Assignments
                {stats?.kpis?.awaitingReview > 0 && (
                  <span className="acad-tab-badge alert">{stats.kpis.awaitingReview} review</span>
                )}
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "tasks" ? "active" : ""}`}
                onClick={() => setActiveTab("tasks")}
              >
                <span>🎯</span> Task Master ({tasks.length})
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "challenges" ? "active" : ""}`}
                onClick={() => setActiveTab("challenges")}
              >
                <span>⚡</span> Challenges & Issues Hub
                {stats?.kpis?.openChallenges > 0 && (
                  <span className="acad-tab-badge alert">{stats.kpis.openChallenges} open</span>
                )}
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "kb" ? "active" : ""}`}
                onClick={() => setActiveTab("kb")}
              >
                <span>📚</span> Knowledge Base ({kbArticles.length})
              </button>
            </>
          ) : (
            <>
              <button
                className={`acad-tab-btn ${activeTab === "my-tasks" ? "active" : ""}`}
                onClick={() => setActiveTab("my-tasks")}
              >
                <span>📋</span> My Tasks ({assignments.length})
                {stats?.kpis?.overdue > 0 && (
                  <span className="acad-tab-badge alert">{stats.kpis.overdue} overdue</span>
                )}
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "challenges" ? "active" : ""}`}
                onClick={() => setActiveTab("challenges")}
              >
                <span>⚡</span> Technical Challenges
                {stats?.kpis?.openChallenges > 0 && (
                  <span className="acad-tab-badge">{stats.kpis.openChallenges}</span>
                )}
              </button>

              <button
                className={`acad-tab-btn ${activeTab === "kb" ? "active" : ""}`}
                onClick={() => setActiveTab("kb")}
              >
                <span>📚</span> Knowledge Base ({kbArticles.length})
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Main Tab Content */}
      <main className="acad-main">
        {/* ===================== ADMIN OVERVIEW TAB ===================== */}
        {isAdmin && activeTab === "overview" && (
          <>
            {/* KPI Cards */}
            <div className="acad-kpi-grid">
              <div className="acad-kpi-card acad-blue">
                <div className="acad-kpi-head">
                  <small>Eligible Employees</small>
                  <div className="acad-kpi-icon">👥</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.totalEmployees ?? 0}</div>
                <div className="acad-kpi-footer">Active non-admin staff</div>
              </div>

              <div className="acad-kpi-card acad-purple">
                <div className="acad-kpi-head">
                  <small>Total Assignments</small>
                  <div className="acad-kpi-icon">📋</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.totalAssignments ?? 0}</div>
                <div className="acad-kpi-footer">Across all employees</div>
              </div>

              <div className="acad-kpi-card acad-green">
                <div className="acad-kpi-head">
                  <small>Completed Tasks</small>
                  <div className="acad-kpi-icon">✓</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.completedTasks ?? 0}</div>
                <div className="acad-kpi-footer">
                  {stats?.kpis?.totalAssignments
                    ? Math.round((stats.kpis.completedTasks / stats.kpis.totalAssignments) * 100)
                    : 0}% completion rate
                </div>
              </div>

              <div
                className="acad-kpi-card acad-amber clickable"
                onClick={() => {
                  setStatusFilter("Submitted for Review");
                  setActiveTab("assignments");
                }}
              >
                <div className="acad-kpi-head">
                  <small>Awaiting Review</small>
                  <div className="acad-kpi-icon">⏳</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.awaitingReview ?? 0}</div>
                <div className="acad-kpi-footer">Click to review submissions →</div>
              </div>

              <div
                className="acad-kpi-card acad-red clickable"
                onClick={() => {
                  setStatusFilter("Overdue");
                  setActiveTab("assignments");
                }}
              >
                <div className="acad-kpi-head">
                  <small>Overdue Tasks</small>
                  <div className="acad-kpi-icon">⚠</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.overdueTasks ?? 0}</div>
                <div className="acad-kpi-footer">Past deadline</div>
              </div>

              <div
                className="acad-kpi-card acad-amber clickable"
                onClick={() => setActiveTab("challenges")}
              >
                <div className="acad-kpi-head">
                  <small>Open Challenges</small>
                  <div className="acad-kpi-icon">⚡</div>
                </div>
                <div className="acad-kpi-val">{stats?.kpis?.openChallenges ?? 0}</div>
                <div className="acad-kpi-footer">
                  {stats?.kpis?.criticalChallenges ?? 0} critical/high
                </div>
              </div>
            </div>

            {/* Employee Progress Table */}
            <div className="acad-table-card">
              <div className="acad-table-header">
                <div>
                  <h3>Employee Progress Matrix</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Track completion rates, pending submissions, and open challenges per employee
                  </p>
                </div>
                <button
                  className="acad-btn acad-btn-secondary"
                  onClick={handleAutoAssign}
                >
                  <span>＋</span> Sync Assignments
                </button>
              </div>

              <div className="acad-table-wrap">
                <table className="acad-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>In Progress</th>
                      <th>Review</th>
                      <th>Overdue</th>
                      <th>Challenges</th>
                      <th>Completion %</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.employees || []).map((emp: R) => (
                      <tr key={emp.id}>
                        <td>
                          <b>{emp.name}</b>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{emp.email}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", fontWeight: 600 }}>
                            {emp.role}
                          </span>
                        </td>
                        <td>{emp.total_assigned}</td>
                        <td>
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>{emp.completed}</span>
                        </td>
                        <td>{emp.in_progress}</td>
                        <td>
                          {emp.awaiting_review > 0 ? (
                            <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                              {emp.awaiting_review}
                            </span>
                          ) : (
                            0
                          )}
                        </td>
                        <td>
                          {emp.overdue > 0 ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>{emp.overdue}</span>
                          ) : (
                            0
                          )}
                        </td>
                        <td>
                          {emp.open_challenges > 0 ? (
                            <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                              {emp.open_challenges}
                            </span>
                          ) : (
                            0
                          )}
                        </td>
                        <td style={{ minWidth: "120px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div className="acad-progress-track" style={{ flex: 1 }}>
                              <div
                                className={`acad-progress-fill ${emp.completion_percent === 100 ? "completed" : ""}`}
                                style={{ width: `${emp.completion_percent}%` }}
                              />
                            </div>
                            <span style={{ fontSize: "11.5px", fontWeight: 700 }}>{emp.completion_percent}%</span>
                          </div>
                        </td>
                        <td>
                          <button
                            className="acad-btn acad-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => setInspectEmployee(emp)}
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Task Performance Table */}
            <div className="acad-table-card">
              <div className="acad-table-header">
                <div>
                  <h3>Task Performance & Challenge Rates</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Identify difficult experiments and recurring hardware challenges
                  </p>
                </div>
              </div>

              <div className="acad-table-wrap">
                <table className="acad-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Avg Progress</th>
                      <th>Reported Challenges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.tasks || []).map((t: R) => (
                      <tr key={t.id}>
                        <td>
                          <b>{t.id}: {t.title}</b>
                        </td>
                        <td>
                          <span className="acad-task-cat-badge">{t.category}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: t.difficulty === "Mastery" ? "#9333ea" : t.difficulty === "Advanced" ? "#dc2626" : "#0284c7"
                          }}>
                            {t.difficulty}
                          </span>
                        </td>
                        <td>{t.total_assigned}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: "#16a34a" }}>{t.completed}</span>
                        </td>
                        <td style={{ minWidth: "120px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div className="acad-progress-track" style={{ flex: 1 }}>
                              <div
                                className="acad-progress-fill"
                                style={{ width: `${t.avg_progress}%` }}
                              />
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: 600 }}>{t.avg_progress}%</span>
                          </div>
                        </td>
                        <td>
                          {t.challenges_count > 0 ? (
                            <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: "6px", fontWeight: 700, fontSize: "11.5px" }}>
                              ⚡ {t.challenges_count} challenges
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===================== MY TASKS / ALL ASSIGNMENTS TAB ===================== */}
        {(activeTab === "my-tasks" || activeTab === "assignments") && (
          <>
            {/* Filter Bar */}
            <div className="acad-filter-bar">
              <div className="acad-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search task title, category, or employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    style={{ border: "none", background: "transparent", cursor: "pointer", color: "#94a3b8" }}
                    onClick={() => setSearch("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="acad-select-group">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Submitted for Review">Submitted for Review</option>
                  <option value="Changes Requested">Changes Requested</option>
                  <option value="Completed">Completed</option>
                  <option value="Overdue">Overdue</option>
                </select>

                {isAdmin && (
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                  >
                    <option value="">All Employees</option>
                    {(stats?.employees || []).map((e: R) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                )}

                <button
                  className="acad-btn acad-btn-secondary"
                  onClick={refreshAll}
                  title="Reload data"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {/* Task Cards Grid */}
            {assignments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📋</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>No task assignments found</h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
                  {isAdmin
                    ? "Click 'Auto-Assign All' to assign the 12 technical training tasks to your employees."
                    : "No tasks currently match your filter criteria."}
                </p>
                {isAdmin && (
                  <button className="acad-btn acad-btn-primary" onClick={handleAutoAssign}>
                    ＋ Auto-Assign to All Employees
                  </button>
                )}
              </div>
            ) : (
              <div className="acad-tasks-grid">
                {assignments.map((asn) => {
                  const statusClass = `acad-status-${(asn.computed_status || asn.status).toLowerCase().replace(/\s+/g, "-")}`;
                  return (
                    <div
                      key={asn.id}
                      className="acad-task-card"
                      onClick={() => setSelectedAssignmentId(asn.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="acad-task-card-header">
                        <span className="acad-task-cat-badge">{asn.task_category}</span>
                        <span className={`acad-status ${statusClass}`}>
                          {asn.computed_status || asn.status}
                        </span>
                      </div>

                      <div>
                        <h3 title={asn.task_title}>{asn.task_id}: {asn.task_title}</h3>
                        {isAdmin && (
                          <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "4px" }}>
                            Assigned to: {asn.employee_name} ({asn.employee_role})
                          </div>
                        )}
                        <p>{asn.task_objective || asn.task_description}</p>
                      </div>

                      {/* Progress bar */}
                      <div className="acad-progress-wrap">
                        <div className="acad-progress-label">
                          <span>Progress ({asn.completed_steps || 0}/{asn.total_steps || 10} steps)</span>
                          <span>{asn.progress_percent || 0}%</span>
                        </div>
                        <div className="acad-progress-track">
                          <div
                            className={`acad-progress-fill ${asn.status === "Completed" ? "completed" : ""}`}
                            style={{ width: `${asn.progress_percent || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="acad-task-card-meta">
                        <span>
                          ⏱ Due: {String(asn.due_at).slice(0, 10)}
                        </span>
                        <span>
                          {asn.challenges_count > 0 && (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>
                              ⚡ {asn.challenges_count}
                            </span>
                          )}
                          {asn.submissions_count > 0 && (
                            <span style={{ color: "#0284c7", marginLeft: "6px" }}>
                              📥 {asn.submissions_count}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="acad-task-card-footer">
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          Difficulty: <b>{asn.task_difficulty}</b>
                        </span>
                        <button
                          className={`acad-btn ${asn.status === "Submitted for Review" && isAdmin ? "acad-btn-amber" : "acad-btn-primary"}`}
                          style={{ padding: "5px 12px", fontSize: "11.5px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssignmentId(asn.id);
                          }}
                        >
                          {isAdmin
                            ? asn.status === "Submitted for Review"
                              ? "Review Submission →"
                              : "Inspect Assignment →"
                            : asn.status === "Completed"
                            ? "View Evidence ✓"
                            : asn.status === "In Progress"
                            ? "Continue Task →"
                            : "Start Experiment →"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===================== TASK MASTER TAB (ADMIN ONLY) ===================== */}
        {isAdmin && activeTab === "tasks" && (
          <>
            <div className="acad-filter-bar">
              <div className="acad-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search task title, category, or instructions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="acad-select-group">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  <option value="App Configuration">App Configuration</option>
                  <option value="Switches & Wiring">Switches & Wiring</option>
                  <option value="Automation Logic">Automation Logic</option>
                  <option value="Sensors & Security">Sensors & Security</option>
                  <option value="Access Control">Access Control</option>
                  <option value="Gate Automation">Gate Automation</option>
                  <option value="Zigbee & Networking">Zigbee & Networking</option>
                  <option value="Lighting & Curtains">Lighting & Curtains</option>
                  <option value="CCTV & Surveillance">CCTV & Surveillance</option>
                  <option value="System Integration">System Integration</option>
                  <option value="Troubleshooting">Troubleshooting</option>
                  <option value="Sales & Demonstration">Sales & Demonstration</option>
                </select>

                <button
                  className="acad-btn acad-btn-primary"
                  onClick={() => setShowCreateTaskModal(true)}
                >
                  <span>＋</span> New Task Definition
                </button>
              </div>
            </div>

            <div className="acad-table-card">
              <div className="acad-table-header">
                <div>
                  <h3>Master Training Curriculums ({tasks.length} tasks)</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                    Authoritative technical experiments assigned to non-admin staff
                  </p>
                </div>
                <button className="acad-btn acad-btn-primary" onClick={handleAutoAssign}>
                  ＋ Auto-Assign to All Employees
                </button>
              </div>

              <div className="acad-table-wrap">
                <table className="acad-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Task Title</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Hours</th>
                      <th>Steps</th>
                      <th>Mandatory</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td><b>{t.id}</b></td>
                        <td>
                          <b>{t.title}</b>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{t.objective}</div>
                        </td>
                        <td>
                          <span className="acad-task-cat-badge">{t.category}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: t.difficulty === "Mastery" ? "#9333ea" : t.difficulty === "Advanced" ? "#dc2626" : "#0284c7"
                          }}>
                            {t.difficulty}
                          </span>
                        </td>
                        <td>{t.estimated_hours}h</td>
                        <td>{t.total_steps || t.checklist?.length || 0} items</td>
                        <td>
                          {t.is_mandatory ? (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Yes</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>Optional</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="acad-btn acad-btn-secondary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => {
                              alert(`Task ${t.id} - ${t.title}\n\nChecklist Items:\n${(t.checklist || []).map((c: any, i: number) => `${i + 1}. ${c.title || c}`).join("\n")}`);
                            }}
                          >
                            View Checklist
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ===================== CHALLENGES & ISSUES HUB TAB ===================== */}
        {activeTab === "challenges" && (
          <>
            <div className="acad-filter-bar">
              <div className="acad-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search challenges by product, issue title, symptom or employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="acad-select-group">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Challenge Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Solution Provided">Solution Provided</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Reopened">Reopened</option>
                </select>

                <button
                  className="acad-btn acad-btn-amber"
                  onClick={() => setShowChallengeModal(true)}
                >
                  <span>⚡</span> Report Challenge
                </button>
              </div>
            </div>

            {challenges.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚡</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>No technical challenges reported</h3>
                <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
                  Encounter an issue during smart switch wiring, Zigbee pairing, or NVR setup? Report it here!
                </p>
                <button className="acad-btn acad-btn-amber" onClick={() => setShowChallengeModal(true)}>
                  ＋ Report a Technical Challenge
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {challenges.map((c) => {
                  const sevColor = c.severity === "Critical" ? "#dc2626" : c.severity === "High" ? "#ea580c" : c.severity === "Medium" ? "#d97706" : "#0284c7";
                  const sevBg = c.severity === "Critical" ? "#fee2e2" : c.severity === "High" ? "#ffedd5" : c.severity === "Medium" ? "#fef3c7" : "#e0f2fe";

                  return (
                    <div
                      key={c.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setSelectedChallengeId(c.id)}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: sevBg, color: sevColor }}>
                            {c.severity}
                          </span>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                            {c.category} · {c.product_model}
                          </span>
                          {c.task_title && (
                            <span style={{ fontSize: "11px", color: "#0284c7" }}>
                              · {c.task_title}
                            </span>
                          )}
                        </div>

                        <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                          {c.title}
                        </h4>

                        <div style={{ fontSize: "12px", color: "#64748b", display: "flex", gap: "16px" }}>
                          <span>Reported by: <b>{c.reporter_name}</b></span>
                          <span>Date: {String(c.created_at).slice(0, 10)}</span>
                          {c.comments_count > 0 && <span>💬 {c.comments_count} replies</span>}
                          {c.attachments_count > 0 && <span>📎 {c.attachments_count} files</span>}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className={`acad-status acad-status-${c.status.toLowerCase().replace(/\s+/g, "-")}`}>
                          {c.status}
                        </span>

                        <button
                          className="acad-btn acad-btn-secondary"
                          style={{ padding: "6px 12px", fontSize: "11.5px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChallengeId(c.id);
                          }}
                        >
                          View & Solve →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===================== KNOWLEDGE BASE TAB ===================== */}
        {activeTab === "kb" && (
          <>
            <div className="acad-filter-bar">
              <div className="acad-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder="Search troubleshooting knowledge base by symptom, solution or product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="acad-select-group">
                <button
                  className="acad-btn acad-btn-secondary"
                  onClick={refreshAll}
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {kbArticles.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", borderRadius: "14px", border: "1px dashed #cbd5e1" }}>
                <div style={{ fontSize: "36px", marginBottom: "10px" }}>📚</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>Knowledge Base is being compiled</h3>
                <p style={{ margin: "0", fontSize: "13px", color: "#64748b" }}>
                  When Admin resolves a reported technical challenge, they can convert it into a reusable troubleshooting article here.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
                {kbArticles.map((kb) => (
                  <div
                    key={kb.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="acad-task-cat-badge">{kb.category}</span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>👁 {kb.views || 0} views</span>
                    </div>

                    <h3 style={{ margin: "0", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      {kb.title}
                    </h3>
                    <div style={{ fontSize: "11.5px", color: "#0284c7", fontWeight: 600 }}>
                      Product: {kb.product_model}
                    </div>

                    <div style={{ background: "#fef2f2", borderLeft: "3px solid #ef4444", padding: "8px 10px", borderRadius: "4px", fontSize: "12px" }}>
                      <b>Symptom:</b> {kb.symptom}
                    </div>

                    <div style={{ background: "#f0fdf4", borderLeft: "3px solid #10b981", padding: "8px 10px", borderRadius: "4px", fontSize: "12px" }}>
                      <b>Solution:</b> {kb.solution}
                    </div>

                    <div style={{ background: "#eff6ff", borderLeft: "3px solid #3b82f6", padding: "8px 10px", borderRadius: "4px", fontSize: "12px" }}>
                      <b>Prevention SOP:</b> {kb.prevention}
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                      <span>Author: {kb.author_name}</span>
                      <span>{String(kb.created_at).slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ===================== DRAWERS & MODALS ===================== */}

      {/* 1. Task Detail / Submission Drawer */}
      {selectedAssignmentId && (
        <AssignmentDetailDrawer
          assignmentId={selectedAssignmentId}
          isAdmin={isAdmin}
          user={user}
          onClose={() => setSelectedAssignmentId(null)}
          onUpdate={() => {
            refreshAll();
          }}
          onReportChallenge={(taskData) => {
            setShowChallengeModal(true);
          }}
        />
      )}

      {/* 2. Challenge Detail / Solution Modal */}
      {selectedChallengeId && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          isAdmin={isAdmin}
          user={user}
          onClose={() => setSelectedChallengeId(null)}
          onUpdate={refreshAll}
          onConvertToKb={(challengeData) => {
            setSelectedChallengeId(null);
            setShowConvertToKbModal(challengeData);
          }}
        />
      )}

      {/* 3. Report Challenge Modal */}
      {showChallengeModal && (
        <ReportChallengeModal
          user={user}
          tasks={tasks}
          onClose={() => setShowChallengeModal(false)}
          onSuccess={(chlId) => {
            setShowChallengeModal(false);
            showToast("✓ Challenge reported successfully. Admins have been notified.");
            refreshAll();
            setSelectedChallengeId(chlId);
          }}
        />
      )}

      {/* 4. Convert Challenge to Knowledge Base Modal (Admin only) */}
      {showConvertToKbModal && (
        <ConvertToKbModal
          challenge={showConvertToKbModal}
          onClose={() => setShowConvertToKbModal(null)}
          onSuccess={() => {
            setShowConvertToKbModal(null);
            showToast("✓ Challenge successfully converted into Knowledge Base troubleshooting guide!");
            refreshAll();
            setActiveTab("kb");
          }}
        />
      )}

      {/* 5. Create Task Modal (Admin only) */}
      {showCreateTaskModal && (
        <CreateTaskModal
          onClose={() => setShowCreateTaskModal(false)}
          onSuccess={() => {
            setShowCreateTaskModal(false);
            showToast("✓ New technical task created successfully.");
            refreshAll();
          }}
        />
      )}

      {/* 6. Employee Details Portfolio Modal (Admin only) */}
      {inspectEmployee && (
        <EmployeePortfolioModal
          employee={inspectEmployee}
          onClose={() => setInspectEmployee(null)}
          onSelectAssignment={(aid) => {
            setInspectEmployee(null);
            setSelectedAssignmentId(aid);
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Assignment Detail & Submission Drawer
// =========================================================================

function AssignmentDetailDrawer({
  assignmentId,
  isAdmin,
  user,
  onClose,
  onUpdate,
  onReportChallenge,
}: {
  assignmentId: string;
  isAdmin: boolean;
  user: any;
  onClose: () => void;
  onUpdate: () => void;
  onReportChallenge: (t: any) => void;
}) {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/academy/assignments?id=${assignmentId}`);
      if (res.ok) {
        const d = await res.json();
        setData(d.assignment);
        setNotes(d.assignment?.employee_notes || "");
      }
    } catch {}
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Toggle checklist item
  const handleChecklistToggle = async (itemId: string, currentCompleted: boolean) => {
    try {
      const res = await fetch("/api/academy/assignments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          action: "update-checklist",
          checklistItemId: itemId,
          completed: !currentCompleted,
        }),
      });
      if (res.ok) {
        loadDetail();
        onUpdate();
      }
    } catch {}
  };

  // Save notes
  const handleSaveNotes = async () => {
    try {
      await fetch("/api/academy/assignments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          action: "save-notes",
          notes,
        }),
      });
      alert("Notes saved successfully!");
    } catch {}
  };

  // Evidence upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("targetType", "submission");
      fd.append("assignmentId", assignmentId);
      fd.append("kind", file.type.startsWith("video/") ? "Video" : file.type === "application/pdf" ? "Document" : "Screenshot");

      const res = await fetch("/api/academy/upload", {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "File upload failed");
      } else {
        loadDetail();
      }
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Submit task for review
  const handleSubmitTask = async () => {
    if (!window.confirm("Submit this technical task for Admin review?")) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/academy/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          notes,
          demoUrl,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        alert("✓ Task submitted for review! Admins will assess your evidence.");
        loadDetail();
        onUpdate();
      } else {
        alert(d.error || "Submission failed");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // Admin Review Decision
  const handleAdminDecision = async (decision: "approve" | "request_changes") => {
    if (decision === "request_changes" && !adminFeedback.trim()) {
      alert("Please enter feedback for the employee explaining what changes are required.");
      return;
    }

    setReviewing(true);
    try {
      const latestSub = data?.submissions?.[0];
      const res = await fetch("/api/academy/submissions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          submissionId: latestSub?.id,
          decision,
          feedback: adminFeedback,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        alert(decision === "approve" ? "✓ Task marked Completed!" : "Changes requested.");
        loadDetail();
        onUpdate();
      } else {
        alert(d.error || "Decision failed");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to submit decision");
    } finally {
      setReviewing(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="acad-drawer-back" onClick={onClose}>
        <div className="acad-drawer" onClick={(e) => e.stopPropagation()} style={{ padding: "40px", textAlign: "center" }}>
          Loading task assignment details...
        </div>
      </div>
    );
  }

  const isCompleted = data.status === "Completed";
  const isAwaitingReview = data.status === "Submitted for Review";
  const isChangesRequested = data.status === "Changes Requested";

  return (
    <div className="acad-drawer-back" onClick={onClose}>
      <div className="acad-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="acad-drawer-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="acad-task-cat-badge">{data.task_category}</span>
              <span className={`acad-status acad-status-${(data.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                {data.status}
              </span>
              {data.is_overdue && (
                <span className="acad-status acad-status-overdue">Overdue</span>
              )}
            </div>

            <h2>{data.task_id}: {data.task_title}</h2>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              Assigned to: <b>{data.employee_name}</b> ({data.employee_role}) · Due: <b>{String(data.due_at).slice(0, 10)}</b>
            </div>
          </div>

          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Drawer Body */}
        <div className="acad-drawer-body">
          {/* Changes Requested Notice */}
          {isChangesRequested && data.admin_feedback && (
            <div className="acad-alert acad-alert-warning">
              <span style={{ fontSize: "18px" }}>⚠</span>
              <div>
                <b>Changes Requested by Admin:</b>
                <p style={{ margin: "4px 0 0", color: "#78350f" }}>{data.admin_feedback}</p>
              </div>
            </div>
          )}

          {/* Completed Notice */}
          {isCompleted && (
            <div className="acad-alert acad-alert-success">
              <span style={{ fontSize: "18px" }}>✓</span>
              <div>
                <b>Task Completed & Approved!</b>
                <p style={{ margin: "2px 0 0", color: "#166534" }}>
                  Verified by {data.approved_by_name || "Admin"} on {String(data.approved_at).slice(0, 10)}. {data.admin_feedback}
                </p>
              </div>
            </div>
          )}

          {/* Objective & Description */}
          <div>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#0f172a" }}>Objective</h4>
            <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
              {data.task_objective}
            </p>

            <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#0f172a" }}>Instructions & Methodology</h4>
            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
              {data.task_instructions}
            </div>
          </div>

          {/* Interactive Checklist */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>
                Interactive Checklist ({data.checklist?.filter((c: any) => c.completed).length} of {data.checklist?.length} complete)
              </h4>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0284c7" }}>
                {data.progress_percent}%
              </span>
            </div>

            <div className="acad-checklist">
              {(data.checklist || []).map((item: R) => (
                <div
                  key={item.id}
                  className={`acad-checklist-item ${item.completed ? "checked" : ""}`}
                  onClick={() => {
                    if (!isAdmin) {
                      handleChecklistToggle(item.id, Boolean(item.completed));
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(item.completed)}
                    disabled={isAdmin || isCompleted}
                    onChange={() => handleChecklistToggle(item.id, Boolean(item.completed))}
                  />
                  <span>
                    <b>Step {item.step_number}:</b> {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Submission Evidence Attachments */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>
                Experiment Evidence & Documentation ({data.attachments?.length || 0})
              </h4>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Photos, Screenshots, Video demos, Wiring diagrams
              </span>
            </div>

            {/* Upload Area for Employee */}
            {!isAdmin && !isCompleted && (
              <label className="acad-evidence-dropzone" style={{ display: "block" }}>
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <div style={{ fontSize: "24px", marginBottom: "4px" }}>📷</div>
                <b style={{ color: "#0284c7", fontSize: "13px" }}>
                  {uploading ? "Uploading media..." : "Click or tap to upload evidence photo/video/PDF"}
                </b>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Supports camera capture on mobile, MP4 videos, circuit photos (Max 50MB)
                </div>
              </label>
            )}

            {/* Evidence Grid */}
            {data.attachments?.length > 0 && (
              <div className="acad-evidence-grid">
                {data.attachments.map((att: R) => {
                  const isImage = att.file_type?.startsWith("image/");
                  const isVideo = att.file_type?.startsWith("video/");
                  const fileUrl = `/api/uploads/${att.file_key}`;

                  return (
                    <div key={att.id} className="acad-evidence-card">
                      {isImage ? (
                        <a href={fileUrl} target="_blank" rel="noreferrer">
                          <img src={fileUrl} alt={att.file_name} />
                        </a>
                      ) : isVideo ? (
                        <video src={fileUrl} controls />
                      ) : (
                        <div style={{ height: "100px", background: "#f1f5f9", display: "grid", placeItems: "center", borderRadius: "6px", fontSize: "28px" }}>
                          📄
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.file_name}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {Math.round(att.file_size / 1024)} KB · {att.kind}
                      </div>
                      <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: "10.5px", color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                        Open in new tab ↗
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes & Video Link */}
          <div>
            <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", color: "#0f172a" }}>
              Technical Learnings & Completion Notes
            </h4>
            <textarea
              rows={3}
              value={notes}
              disabled={isAdmin || isCompleted}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe your wiring tests, findings, configuration details, and observations..."
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
            {!isAdmin && !isCompleted && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                <button className="acad-btn acad-btn-secondary" onClick={handleSaveNotes} style={{ fontSize: "11px", padding: "4px 10px" }}>
                  Save Notes
                </button>
              </div>
            )}
          </div>

          {/* Submissions History */}
          {data.submissions?.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#0f172a" }}>
                Submission History ({data.submissions.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.submissions.map((sub: R) => (
                  <div key={sub.id} style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12.5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <b>Submission #{sub.submission_number}</b>
                      <span className={`acad-status acad-status-${(sub.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                        {sub.status}
                      </span>
                    </div>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>
                      Submitted at: {new Date(sub.submitted_at).toLocaleString()}
                    </div>
                    {sub.notes && (
                      <p style={{ margin: "6px 0 0", color: "#334155" }}>
                        <b>Notes:</b> {sub.notes}
                      </p>
                    )}
                    {sub.admin_feedback && (
                      <div style={{ marginTop: "6px", background: "#fef3c7", padding: "6px 8px", borderRadius: "6px", color: "#92400e" }}>
                        <b>Feedback from {sub.reviewer_name || "Admin"}:</b> {sub.admin_feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Review Form */}
          {isAdmin && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "16px", borderRadius: "12px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#0369a1", fontSize: "14px" }}>
                Admin Evaluation & Review
              </h4>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Admin Feedback / Required Modifications:
              </label>
              <textarea
                rows={2}
                value={adminFeedback}
                onChange={(e) => setAdminFeedback(e.target.value)}
                placeholder="Enter technical comments or explain required adjustments..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  className="acad-btn acad-btn-amber"
                  disabled={reviewing}
                  onClick={() => handleAdminDecision("request_changes")}
                >
                  ⚠ Request Changes
                </button>
                <button
                  className="acad-btn acad-btn-success"
                  disabled={reviewing}
                  onClick={() => handleAdminDecision("approve")}
                >
                  ✓ Approve Completion
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="acad-drawer-footer">
          <div>
            {!isAdmin && (
              <button
                className="acad-btn acad-btn-amber"
                onClick={() => onReportChallenge(data)}
              >
                <span>⚡</span> Report Challenge on this Task
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="acad-btn acad-btn-secondary" onClick={onClose}>
              Close
            </button>

            {!isAdmin && !isCompleted && (
              <button
                className="acad-btn acad-btn-primary"
                disabled={submitting || data.progress_percent < 100}
                onClick={handleSubmitTask}
                title={data.progress_percent < 100 ? "Complete all checklist steps first" : "Submit task for review"}
              >
                {submitting ? "Submitting..." : isChangesRequested ? "Resubmit for Review →" : "Submit for Review →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Report Challenge Modal
// =========================================================================

function ReportChallengeModal({
  user,
  tasks,
  onClose,
  onSuccess,
}: {
  user: any;
  tasks: R[];
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [productModel, setProductModel] = useState("");
  const [category, setCategory] = useState("Wiring");
  const [severity, setSeverity] = useState("Medium");
  const [description, setDescription] = useState("");
  const [stepsAttempted, setStepsAttempted] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !productModel || !stepsAttempted || !expectedBehavior || !actualBehavior) {
      alert("Please fill in all mandatory challenge details.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/academy/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: taskId || null,
          title,
          productModel,
          category,
          severity,
          description,
          stepsAttempted,
          expectedBehavior,
          actualBehavior,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        onSuccess(d.challengeId);
      } else {
        alert(d.error || "Failed to report challenge");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to report challenge");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="acad-modal-back" onClick={onClose}>
      <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 95vw)" }}>
        <header>
          <div>
            <small style={{ color: "#d97706", fontWeight: 700, textTransform: "uppercase", fontSize: "10.5px" }}>
              Technical Experiment Trouble Report
            </small>
            <h3>Report Technical Challenge</h3>
          </div>
          <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={onClose}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="acad-modal-body" style={{ maxHeight: "70vh" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Related Task / Experiment
                <select value={taskId} onChange={(e) => setTaskId(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <option value="">General Hardware / Test Rig (No specific task)</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id}: {t.title}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Product / Hardware Model *
                <input
                  type="text"
                  required
                  placeholder="e.g. Noviq 4-Gang Touch Switch, Zigbee Gateway v3"
                  value={productModel}
                  onChange={(e) => setProductModel(e.target.value)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Category *
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  {["Installation", "Wiring", "App Configuration", "Automation Logic", "Connectivity", "Device Compatibility", "Hardware Fault", "Software Issue", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Severity Level *
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <option value="Low">Low - Minor cosmetic / non-blocking</option>
                  <option value="Medium">Medium - Feature failure with workaround</option>
                  <option value="High">High - Serious hardware/pairing blocker</option>
                  <option value="Critical">Critical - Safety risk / total system failure</option>
                </select>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Challenge Summary / Title *
              <input
                type="text"
                required
                placeholder="e.g. Switch capacitive touch doesn't trigger relay when neutral disconnected"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Detailed Description *
              <textarea
                rows={3}
                required
                placeholder="Explain the setup, environment, wiring configuration, and what failed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Steps Already Attempted *
              <textarea
                rows={2}
                required
                placeholder="What troubleshooting steps did you try? (e.g. power cycle, channel reboot, factory reset)"
                value={stepsAttempted}
                onChange={(e) => setStepsAttempted(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Expected Behaviour *
                <textarea
                  rows={2}
                  required
                  placeholder="What was supposed to happen?"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Actual Behaviour *
                <textarea
                  rows={2}
                  required
                  placeholder="What actually occurred?"
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>
            </div>
          </div>

          <footer>
            <button type="button" className="acad-btn acad-btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="acad-btn acad-btn-amber" disabled={submitting}>
              {submitting ? "Submitting..." : "Report Challenge & Notify Admin"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Challenge Detail & Discussion Modal
// =========================================================================

function ChallengeDetailModal({
  challengeId,
  isAdmin,
  user,
  onClose,
  onUpdate,
  onConvertToKb,
}: {
  challengeId: string;
  isAdmin: boolean;
  user: any;
  onClose: () => void;
  onUpdate: () => void;
  onConvertToKb: (chl: R) => void;
}) {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [solutionText, setSolutionText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [resolving, setResolving] = useState(false);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/academy/challenges?id=${challengeId}`);
      if (res.ok) {
        const d = await res.json();
        setData(d.challenge);
      }
    } catch {}
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  // Post comment
  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch("/api/academy/challenges/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId,
          content: commentText.trim(),
        }),
      });
      if (res.ok) {
        setCommentText("");
        loadChallenge();
        onUpdate();
      }
    } catch {}
    setPostingComment(false);
  };

  // Resolve challenge (Admin only)
  const handleResolve = async () => {
    if (!solutionText.trim()) {
      alert("Please provide the technical explanation and solution.");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/academy/challenges", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: challengeId,
          action: "resolve",
          solution: solutionText.trim(),
        }),
      });
      if (res.ok) {
        alert("✓ Challenge marked as Resolved.");
        loadChallenge();
        onUpdate();
      }
    } catch {}
    setResolving(false);
  };

  // Reopen challenge
  const handleReopen = async () => {
    const reason = window.prompt("Why are you reopening this challenge? Explain what didn't work:");
    if (!reason) return;
    try {
      const res = await fetch("/api/academy/challenges", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: challengeId,
          action: "reopen",
          reason,
        }),
      });
      if (res.ok) {
        alert("Challenge reopened for further investigation.");
        loadChallenge();
        onUpdate();
      }
    } catch {}
  };

  if (loading || !data) {
    return (
      <div className="acad-modal-back" onClick={onClose}>
        <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ padding: "40px", textAlign: "center" }}>
          Loading challenge details...
        </div>
      </div>
    );
  }

  const isResolved = data.status === "Resolved";

  return (
    <div className="acad-modal-back" onClick={onClose}>
      <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 95vw)" }}>
        <header>
          <div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span className={`acad-status acad-status-${(data.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                {data.status}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                {data.severity} Severity · {data.category}
              </span>
            </div>
            <h3>{data.title}</h3>
          </div>
          <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="acad-modal-body" style={{ maxHeight: "70vh" }}>
          {/* Hardware & Task Info */}
          <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12.5px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div><b>Product / Model:</b> {data.product_model}</div>
            <div><b>Reported by:</b> {data.reporter_name}</div>
            {data.task_title && <div style={{ gridColumn: "1 / -1" }}><b>Linked Task:</b> {data.task_title}</div>}
          </div>

          {/* Description */}
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#0f172a" }}>Description</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>{data.description}</p>
          </div>

          {/* Attempted steps */}
          <div>
            <h4 style={{ margin: "0 0 4px 0", fontSize: "13px", color: "#0f172a" }}>Steps Attempted by Employee</h4>
            <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", fontSize: "12.5px", color: "#334155" }}>
              {data.steps_attempted}
            </div>
          </div>

          {/* Expected vs Actual */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ background: "#f0fdf4", padding: "10px", borderRadius: "8px", border: "1px solid #bbf7d0", fontSize: "12px" }}>
              <b style={{ color: "#166534" }}>Expected Behaviour:</b>
              <div style={{ marginTop: "4px", color: "#1e293b" }}>{data.expected_behavior}</div>
            </div>
            <div style={{ background: "#fef2f2", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca", fontSize: "12px" }}>
              <b style={{ color: "#991b1b" }}>Actual Behaviour:</b>
              <div style={{ marginTop: "4px", color: "#1e293b" }}>{data.actual_behavior}</div>
            </div>
          </div>

          {/* Solution Banner if resolved */}
          {data.resolution_summary && (
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "14px", borderRadius: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <b style={{ color: "#059669", fontSize: "13px" }}>✓ Technical Solution & Resolution:</b>
                <span style={{ fontSize: "11px", color: "#059669" }}>Resolved by {data.resolved_by_name || "Admin"}</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#065f46", lineHeight: "1.5" }}>
                {data.resolution_summary}
              </p>
            </div>
          )}

          {/* Discussion Thread */}
          <div>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#0f172a" }}>
              Technical Discussion & Comments ({(data.comments || []).length})
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {(data.comments || []).map((cm: R) => (
                <div key={cm.id} style={{ background: cm.comment_type === "Solution" ? "#ecfdf5" : "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                    <b>{cm.author_name} ({cm.author_role})</b>
                    <span>{new Date(cm.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p style={{ margin: 0, color: "#1e293b" }}>{cm.content}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Add a comment, diagnostic question, or test suggestion..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              />
              <button
                className="acad-btn acad-btn-secondary"
                disabled={postingComment || !commentText.trim()}
                onClick={handlePostComment}
              >
                Comment
              </button>
            </div>
          </div>

          {/* Admin Resolution Form */}
          {isAdmin && !isResolved && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "14px", borderRadius: "10px" }}>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#166534" }}>
                Provide Technical Solution & Resolve
              </h4>
              <textarea
                rows={2}
                placeholder="Explain the root cause, fix, and step-by-step solution for the employee..."
                value={solutionText}
                onChange={(e) => setSolutionText(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  className="acad-btn acad-btn-success"
                  disabled={resolving || !solutionText.trim()}
                  onClick={handleResolve}
                >
                  ✓ Mark Challenge as Resolved
                </button>
              </div>
            </div>
          )}
        </div>

        <footer>
          <div style={{ display: "flex", gap: "8px", marginRight: "auto" }}>
            {isAdmin && isResolved && (
              <button
                className="acad-btn acad-btn-primary"
                onClick={() => onConvertToKb(data)}
              >
                📚 Convert to Knowledge Base Article
              </button>
            )}

            {isResolved && (
              <button className="acad-btn acad-btn-amber" onClick={handleReopen}>
                ✕ Solution Failed (Reopen Issue)
              </button>
            )}
          </div>

          <button className="acad-btn acad-btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Convert Challenge to Knowledge Base Modal (Admin only)
// =========================================================================

function ConvertToKbModal({
  challenge,
  onClose,
  onSuccess,
}: {
  challenge: R;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState(`SOP: ${challenge.title}`);
  const [productModel, setProductModel] = useState(challenge.product_model || "");
  const [category, setCategory] = useState(challenge.category || "Troubleshooting");
  const [symptom, setSymptom] = useState(challenge.actual_behavior || challenge.description || "");
  const [rootCause, setRootCause] = useState("");
  const [solution, setSolution] = useState(challenge.resolution_summary || "");
  const [prevention, setPrevention] = useState("");
  const [tags, setTags] = useState(`${challenge.category}, ${challenge.product_model}`);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !symptom || !rootCause || !solution || !prevention) {
      alert("Please fill in all troubleshooting fields (Symptom, Root Cause, Solution, Prevention).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/academy/kb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          title,
          productModel,
          category,
          symptom,
          rootCause,
          solution,
          prevention,
          tags,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create Knowledge Base article");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acad-modal-back" onClick={onClose}>
      <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 95vw)" }}>
        <header>
          <div>
            <small style={{ color: "#0284c7", fontWeight: 700, textTransform: "uppercase", fontSize: "10.5px" }}>
              Publish Reusable SOP
            </small>
            <h3>Convert Challenge to Knowledge Base</h3>
          </div>
          <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={onClose}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="acad-modal-body" style={{ maxHeight: "70vh" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Article Title *
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Product / Model *
                <input
                  type="text"
                  required
                  value={productModel}
                  onChange={(e) => setProductModel(e.target.value)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Category *
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Symptom Description *
              <textarea
                rows={2}
                required
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Root Cause *
              <textarea
                rows={2}
                required
                placeholder="What was the fundamental technical failure? (e.g. 5GHz AP band steering drop, reverse neutral polarity)"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Step-by-Step Solution *
              <textarea
                rows={3}
                required
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Prevention SOP for Future Installations *
              <textarea
                rows={2}
                required
                placeholder="How to prevent this issue from happening on future client sites..."
                value={prevention}
                onChange={(e) => setPrevention(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          </div>

          <footer>
            <button type="button" className="acad-btn acad-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="acad-btn acad-btn-primary" disabled={saving}>
              {saving ? "Publishing..." : "Publish to Knowledge Base"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Create New Task Definition Modal (Admin only)
// =========================================================================

function CreateTaskModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Switches & Wiring");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [objective, setObjective] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !objective || !instructions) {
      alert("Please provide title, objective, and instructions.");
      return;
    }

    const checklistItems = checklistText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch("/api/academy/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          difficulty,
          estimatedHours,
          objective,
          description: description || objective,
          instructions,
          checklist: checklistItems,
          isMandatory: true,
        }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create task");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acad-modal-back" onClick={onClose}>
      <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 95vw)" }}>
        <header>
          <div>
            <small style={{ color: "#0284c7", fontWeight: 700, textTransform: "uppercase", fontSize: "10.5px" }}>
              Curriculum Builder
            </small>
            <h3>Create New Technical Task</h3>
          </div>
          <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={onClose}>
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="acad-modal-body" style={{ maxHeight: "70vh" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Task Title *
              <input
                type="text"
                required
                placeholder="e.g. Multi-Way Switch Virtual 2-Way Pairing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Category *
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  {["App Configuration", "Switches & Wiring", "Automation Logic", "Sensors & Security", "Access Control", "Gate Automation", "Zigbee & Networking", "Lighting & Curtains", "CCTV & Surveillance", "System Integration", "Troubleshooting", "Sales & Demonstration"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
                Difficulty & Hours
                <div style={{ display: "flex", gap: "8px" }}>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Mastery">Mastery</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    style={{ width: "60px", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </label>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Primary Objective *
              <input
                type="text"
                required
                placeholder="What will the employee master upon completion?"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Instructions & Test Steps *
              <textarea
                rows={4}
                required
                placeholder="Step-by-step instructions for the test board setup..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
              Checklist Steps (One per line)
              <textarea
                rows={4}
                placeholder="Mount switch on test board&#10;Pair in Smart Life&#10;Test physical switching&#10;Submit wiring diagram and video"
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                style={{ padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          </div>

          <footer>
            <button type="button" className="acad-btn acad-btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="acad-btn acad-btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Save & Publish Task"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// SUB-COMPONENT: Employee Details Portfolio Modal (Admin only)
// =========================================================================

function EmployeePortfolioModal({
  employee,
  onClose,
  onSelectAssignment,
}: {
  employee: R;
  onClose: () => void;
  onSelectAssignment: (id: string) => void;
}) {
  const [employeeAssignments, setEmployeeAssignments] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/academy/assignments?employeeId=${employee.id}`)
      .then((r) => r.json())
      .then((d) => setEmployeeAssignments(d.assignments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employee.id]);

  return (
    <div className="acad-modal-back" onClick={onClose}>
      <div className="acad-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(780px, 95vw)" }}>
        <header>
          <div>
            <small style={{ color: "#0284c7", fontWeight: 700, textTransform: "uppercase", fontSize: "10.5px" }}>
              Employee Training Portfolio
            </small>
            <h3>{employee.name} ({employee.role})</h3>
            <div style={{ fontSize: "12px", color: "#64748b" }}>{employee.email}</div>
          </div>
          <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="acad-modal-body" style={{ maxHeight: "70vh" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px" }}>Loading employee records...</div>
          ) : employeeAssignments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
              No task assignments found for this employee.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {employeeAssignments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{a.task_category}</div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
                      {a.task_id}: {a.task_title}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "2px" }}>
                      Progress: <b>{a.progress_percent || 0}%</b> · Due: {String(a.due_at).slice(0, 10)}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className={`acad-status acad-status-${(a.computed_status || a.status).toLowerCase().replace(/\s+/g, "-")}`}>
                      {a.computed_status || a.status}
                    </span>
                    <button
                      className="acad-btn acad-btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "11px" }}
                      onClick={() => onSelectAssignment(a.id)}
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer>
          <button className="acad-btn acad-btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
