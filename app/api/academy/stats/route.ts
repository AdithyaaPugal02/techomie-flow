import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date().toISOString();

    if (user.role === "admin") {
      // 1. KPI Summaries for Admin
      const [
        empCountRes,
        asnCountRes,
        compCountRes,
        reviewCountRes,
        overdueCountRes,
        openChalRes,
        critChalRes,
      ] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE active = 1 AND LOWER(role) != 'admin'").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_assignments").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_assignments WHERE status = 'Completed'").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_assignments WHERE status = 'Submitted for Review'").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_assignments WHERE status != 'Completed' AND due_at < ?").bind(now).first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_challenges WHERE status NOT IN ('Resolved')").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) as count FROM training_challenges WHERE status NOT IN ('Resolved') AND severity IN ('Critical', 'High')").first<{ count: number }>(),
      ]);

      const totalEmployees = empCountRes?.count || 0;
      const totalAssignments = asnCountRes?.count || 0;
      const completedTasks = compCountRes?.count || 0;
      const awaitingReview = reviewCountRes?.count || 0;
      const overdueTasks = overdueCountRes?.count || 0;
      const openChallenges = openChalRes?.count || 0;
      const criticalChallenges = critChalRes?.count || 0;
      const pendingTasks = Math.max(0, totalAssignments - completedTasks);

      // 2. Employee Progress Breakdown
      const employees = (await env.DB.prepare(`
        SELECT u.id, u.name, u.email, u.role,
               COUNT(a.id) as total_assigned,
               SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN a.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
               SUM(CASE WHEN a.status = 'Not Started' THEN 1 ELSE 0 END) as not_started,
               SUM(CASE WHEN a.status = 'Submitted for Review' THEN 1 ELSE 0 END) as awaiting_review,
               SUM(CASE WHEN a.status = 'Changes Requested' THEN 1 ELSE 0 END) as changes_requested,
               SUM(CASE WHEN a.status != 'Completed' AND a.due_at < ? THEN 1 ELSE 0 END) as overdue,
               (SELECT COUNT(*) FROM training_challenges WHERE user_id = u.id AND status != 'Resolved') as open_challenges,
               MAX(COALESCE(a.updated_at, a.created_at)) as last_activity
        FROM users u
        LEFT JOIN training_assignments a ON a.user_id = u.id
        WHERE u.active = 1 AND LOWER(u.role) != 'admin'
        GROUP BY u.id, u.name, u.email, u.role
        ORDER BY completed DESC, u.name ASC
      `).bind(now).all<P>()).results.map(e => {
        const assigned = Number(e.total_assigned || 0);
        const comp = Number(e.completed || 0);
        return {
          ...e,
          completion_percent: assigned > 0 ? Math.round((comp / assigned) * 100) : 0,
        };
      });

      // 3. Task Performance Breakdown
      const tasks = (await env.DB.prepare(`
        SELECT t.id, t.title, t.category, t.difficulty, t.sort_order,
               COUNT(a.id) as total_assigned,
               SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN a.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
               SUM(CASE WHEN a.status != 'Completed' AND a.due_at < ? THEN 1 ELSE 0 END) as overdue,
               AVG(COALESCE(a.progress_percent, 0)) as avg_progress,
               (SELECT COUNT(*) FROM training_challenges WHERE task_id = t.id) as challenges_count
        FROM training_tasks t
        LEFT JOIN training_assignments a ON a.task_id = t.id
        WHERE t.active = 1
        GROUP BY t.id, t.title, t.category, t.difficulty, t.sort_order
        ORDER BY t.sort_order ASC, t.id ASC
      `).bind(now).all<P>()).results.map(t => ({
        ...t,
        avg_progress: Math.round(Number(t.avg_progress || 0))
      }));

      // 4. Recent Challenges
      const recentChallenges = (await env.DB.prepare(`
        SELECT c.*, u.name as reporter_name, t.title as task_title
        FROM training_challenges c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN training_tasks t ON t.id = c.task_id
        ORDER BY c.created_at DESC
        LIMIT 6
      `).all<P>()).results;

      return Response.json({
        role: "admin",
        kpis: {
          totalEmployees,
          totalAssignments,
          completedTasks,
          pendingTasks,
          awaitingReview,
          overdueTasks,
          openChallenges,
          criticalChallenges,
        },
        employees,
        tasks,
        recentChallenges,
      });
    }

    // Employee Stats View
    const assignments = (await env.DB.prepare(`
      SELECT a.*, t.title as task_title, t.category as task_category
      FROM training_assignments a
      JOIN training_tasks t ON t.id = a.task_id
      WHERE a.user_id = ?
    `).bind(user.id).all<P>()).results;

    const totalAssigned = assignments.length;
    const completed = assignments.filter(a => a.status === "Completed").length;
    const notStarted = assignments.filter(a => a.status === "Not Started").length;
    const inProgress = assignments.filter(a => a.status === "In Progress").length;
    const submittedForReview = assignments.filter(a => a.status === "Submitted for Review").length;
    const changesRequested = assignments.filter(a => a.status === "Changes Requested").length;
    const overdue = assignments.filter(a => a.status !== "Completed" && (a.due_at as string) < now).length;
    const completionPercent = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

    const myOpenChallengesRes = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM training_challenges WHERE user_id = ? AND status != 'Resolved'
    `).bind(user.id).first<{ count: number }>();

    return Response.json({
      role: "employee",
      kpis: {
        totalAssigned,
        completed,
        notStarted,
        inProgress,
        submittedForReview,
        changesRequested,
        overdue,
        completionPercent,
        openChallenges: myOpenChallengesRes?.count || 0,
      }
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to load Academy statistics" }, { status: 500 });
  }
}
