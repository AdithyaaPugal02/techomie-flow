import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("id");
    const employeeId = url.searchParams.get("employeeId") || url.searchParams.get("user_id") || url.searchParams.get("userId");
    const taskId = url.searchParams.get("taskId");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q")?.trim();
    const now = new Date().toISOString();

    // Single Assignment Deep-Dive
    if (assignmentId) {
      const assignment = await env.DB.prepare(`
        SELECT a.*,
               t.title as task_title, t.category as task_category, t.difficulty as task_difficulty,
               t.objective as task_objective, t.description as task_description,
               t.instructions as task_instructions, t.submission_requirements as task_submission_requirements,
               u.name as employee_name, u.email as employee_email, u.role as employee_role,
               admin.name as approved_by_name
        FROM training_assignments a
        JOIN training_tasks t ON t.id = a.task_id
        JOIN users u ON u.id = a.user_id
        LEFT JOIN users admin ON admin.id = a.approved_by
        WHERE a.id = ?
      `).bind(assignmentId).first<P>();

      if (!assignment) {
        return Response.json({ error: "Assignment not found" }, { status: 404 });
      }

      // Role check: Non-admin can ONLY view their own assignment
      if (user.role !== "admin" && assignment.user_id !== user.id) {
        return Response.json({ error: "Forbidden: You cannot view another employee's assignment" }, { status: 403 });
      }

      // Fetch checklist items with user's completion status
      const checklist = (await env.DB.prepare(`
        SELECT c.*, COALESCE(p.completed, 0) as completed, p.completed_at
        FROM training_checklist_items c
        LEFT JOIN training_checklist_progress p ON p.checklist_item_id = c.id AND p.assignment_id = ?
        WHERE c.task_id = ?
        ORDER BY c.step_number ASC
      `).bind(assignmentId, assignment.task_id).all<P>()).results;

      // Fetch submissions history
      const submissions = (await env.DB.prepare(`
        SELECT s.*, u.name as reviewer_name
        FROM training_submissions s
        LEFT JOIN users u ON u.id = s.reviewed_by
        WHERE s.assignment_id = ?
        ORDER BY s.submission_number DESC
      `).bind(assignmentId).all<P>()).results;

      // Fetch all evidence attachments
      const attachments = (await env.DB.prepare(`
        SELECT a.*, u.name as uploader_name
        FROM training_submission_attachments a
        LEFT JOIN users u ON u.id = a.uploaded_by
        WHERE a.assignment_id = ?
        ORDER BY a.created_at DESC
      `).bind(assignmentId).all<P>()).results;

      // Fetch challenges reported for this assignment
      const challenges = (await env.DB.prepare(`
        SELECT c.*, u.name as reporter_name
        FROM training_challenges c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.assignment_id = ?
        ORDER BY c.created_at DESC
      `).bind(assignmentId).all<P>()).results;

      const isOverdue = assignment.status !== "Completed" && (assignment.due_at as string) < now;

      return Response.json({
        assignment: {
          ...assignment,
          is_overdue: isOverdue,
          task_submission_requirements: safeJson(assignment.task_submission_requirements),
          checklist,
          submissions,
          attachments,
          challenges,
        }
      });
    }

    // List Assignments
    let sql = `
      SELECT a.*,
             t.title as task_title, t.category as task_category, t.difficulty as task_difficulty,
             t.estimated_hours, t.is_mandatory,
             u.name as employee_name, u.email as employee_email, u.role as employee_role,
             (SELECT COUNT(*) FROM training_checklist_items WHERE task_id = t.id) as total_steps,
             (SELECT COUNT(*) FROM training_checklist_progress WHERE assignment_id = a.id AND completed = 1) as completed_steps,
             (SELECT COUNT(*) FROM training_challenges WHERE assignment_id = a.id) as challenges_count,
             (SELECT COUNT(*) FROM training_submissions WHERE assignment_id = a.id) as submissions_count
      FROM training_assignments a
      JOIN training_tasks t ON t.id = a.task_id
      JOIN users u ON u.id = a.user_id
      WHERE 1=1
    `;
    const args: unknown[] = [];

    // Role-based access enforcement: Non-admins can only see their own assignments
    if (user.role !== "admin") {
      sql += " AND a.user_id = ?";
      args.push(user.id);
    } else if (employeeId) {
      sql += " AND a.user_id = ?";
      args.push(employeeId);
    }

    if (taskId) {
      sql += " AND a.task_id = ?";
      args.push(taskId);
    }

    if (status) {
      if (status === "Overdue") {
        sql += ` AND a.status != 'Completed' AND a.due_at < ?`;
        args.push(now);
      } else {
        sql += " AND a.status = ?";
        args.push(status);
      }
    }

    if (search) {
      sql += " AND (t.title LIKE ? OR t.category LIKE ? OR u.name LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY a.due_at ASC, a.created_at DESC";

    const rows = (await env.DB.prepare(sql).bind(...args).all<P>()).results;

    const formatted = rows.map((r) => {
      const isOverdue = r.status !== "Completed" && (r.due_at as string) < now;
      return {
        ...r,
        is_overdue: isOverdue,
        computed_status: isOverdue && r.status !== "Submitted for Review" ? "Overdue" : r.status,
      };
    });

    return Response.json({ assignments: formatted });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to load assignments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const body = await req.json() as Record<string, any>;
    const action = body.action || "auto-assign-all";
    const now = new Date().toISOString();

    if (action === "auto-assign-all") {
      // Find all active non-admin employees
      const employees = (await env.DB.prepare(`
        SELECT id, name, email, role FROM users WHERE active = 1 AND LOWER(role) != 'admin'
      `).all<P>()).results;

      // Find all active mandatory tasks
      const tasks = (await env.DB.prepare(`
        SELECT id, title, sort_order FROM training_tasks WHERE active = 1 AND is_mandatory = 1 ORDER BY sort_order ASC
      `).all<P>()).results;

      let createdCount = 0;

      for (const emp of employees) {
        for (let idx = 0; idx < tasks.length; idx++) {
          const task = tasks[idx];
          const asnId = `ASN-${(emp.id as string).slice(0, 6)}-${task.id}`;
          const dueDate = new Date(Date.now() + (idx + 1) * 7 * 86400000).toISOString().slice(0, 16);

          const existing = await env.DB.prepare(`
            SELECT id FROM training_assignments WHERE task_id = ? AND user_id = ?
          `).bind(task.id, emp.id).first();

          if (!existing) {
            await env.DB.prepare(`
              INSERT INTO training_assignments (id, task_id, user_id, assigned_by, assigned_at, due_at, status, progress_percent, task_version, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'Not Started', 0, 1, ?, ?)
            `).bind(asnId, task.id, emp.id, user.id, now, dueDate, now, now).run();

            // Populate checklist progress entries
            const items = (await env.DB.prepare(`
              SELECT id FROM training_checklist_items WHERE task_id = ?
            `).bind(task.id).all<{ id: string }>()).results;

            for (const item of items) {
              const progId = `CKP-${asnId}-${item.id}`;
              await env.DB.prepare(`
                INSERT INTO training_checklist_progress (id, assignment_id, checklist_item_id, completed)
                VALUES (?, ?, ?, 0)
              `).bind(progId, asnId, item.id).run();
            }

            // Create notification for employee
            await env.DB.prepare(`
              INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
              VALUES (?, ?, 'training_assigned', ?, 'training_assignment', ?, ?, ?)
            `).bind(
              crypto.randomUUID(),
              emp.id,
              `New Training Task Assigned: ${task.title}`,
              asnId,
              dueDate,
              now
            ).run();

            createdCount++;
          }
        }
      }

      return Response.json({
        ok: true,
        message: `Assigned ${createdCount} task(s) across ${employees.length} eligible employee(s).`,
        employeesCount: employees.length,
        createdCount
      });
    }

    if (action === "assign-selected") {
      const userIds = Array.isArray(body.userIds) ? body.userIds : [body.userId];
      const taskIds = Array.isArray(body.taskIds) ? body.taskIds : [body.taskId];
      const dueAt = body.dueAt || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);

      let createdCount = 0;

      for (const uid of userIds) {
        // Exclude admin
        const targetUser = await env.DB.prepare("SELECT role, name FROM users WHERE id = ?").bind(uid).first<P>();
        if (!targetUser || String(targetUser.role).toLowerCase() === "admin") continue;

        for (const tid of taskIds) {
          const asnId = `ASN-${uid.slice(0, 6)}-${tid}`;
          const existing = await env.DB.prepare(`
            SELECT id FROM training_assignments WHERE task_id = ? AND user_id = ?
          `).bind(tid, uid).first();

          if (!existing) {
            await env.DB.prepare(`
              INSERT INTO training_assignments (id, task_id, user_id, assigned_by, assigned_at, due_at, status, progress_percent, task_version, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'Not Started', 0, 1, ?, ?)
            `).bind(asnId, tid, uid, user.id, now, dueAt, now, now).run();

            const items = (await env.DB.prepare(`
              SELECT id FROM training_checklist_items WHERE task_id = ?
            `).bind(tid).all<{ id: string }>()).results;

            for (const item of items) {
              const progId = `CKP-${asnId}-${item.id}`;
              await env.DB.prepare(`
                INSERT INTO training_checklist_progress (id, assignment_id, checklist_item_id, completed)
                VALUES (?, ?, ?, 0)
              `).bind(progId, asnId, item.id).run();
            }

            createdCount++;
          }
        }
      }

      return Response.json({ ok: true, createdCount });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to create assignments" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as Record<string, any>;
    const assignmentId = body.assignmentId || body.id || body.assignment_id;
    const action = body.action || "update-checklist";
    const now = new Date().toISOString();

    if (!assignmentId) {
      return Response.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    const assignment = await env.DB.prepare(`
      SELECT * FROM training_assignments WHERE id = ?
    `).bind(assignmentId).first<P>();

    if (!assignment) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Role check: Employee can only update their own assignment
    if (user.role !== "admin" && assignment.user_id !== user.id) {
      return Response.json({ error: "Forbidden: You cannot modify another employee's assignment" }, { status: 403 });
    }

    // Action 1: Start Task
    if (action === "start") {
      if (assignment.status === "Not Started") {
        await env.DB.prepare(`
          UPDATE training_assignments
          SET status = 'In Progress', started_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(now, now, assignmentId).run();

        await logStatusChange(assignmentId, "Not Started", "In Progress", user.id, "Employee started task");
      }
      return Response.json({ ok: true, status: "In Progress" });
    }

    // Action 2: Update Checklist item
    if (action === "update-checklist" || action === "checklist-item") {
      const checklistItemId = body.checklistItemId || body.item_id || body.checklist_item_id || body.itemId;
      const completed = (body.completed !== undefined ? body.completed : body.is_completed) ? 1 : 0;
      const completedAt = completed ? now : null;

      // Upsert checklist item progress
      const existingProg = await env.DB.prepare(`
        SELECT id FROM training_checklist_progress
        WHERE assignment_id = ? AND checklist_item_id = ?
      `).bind(assignmentId, checklistItemId).first<P>();

      if (existingProg) {
        await env.DB.prepare(`
          UPDATE training_checklist_progress
          SET completed = ?, completed_at = ?
          WHERE id = ?
        `).bind(completed, completedAt, existingProg.id).run();
      } else {
        const progId = `CKP-${assignmentId}-${checklistItemId}`;
        await env.DB.prepare(`
          INSERT INTO training_checklist_progress (id, assignment_id, checklist_item_id, completed, completed_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(progId, assignmentId, checklistItemId, completed, completedAt).run();
      }

      // Recalculate progress percent
      const totalStepsRes = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM training_checklist_items WHERE task_id = ?
      `).bind(assignment.task_id).first<{ count: number }>();
      const totalSteps = totalStepsRes?.count || 1;

      const completedStepsRes = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM training_checklist_progress
        WHERE assignment_id = ? AND completed = 1
      `).bind(assignmentId).first<{ count: number }>();
      const completedSteps = completedStepsRes?.count || 0;

      const newPercent = Math.min(100, Math.round((completedSteps / totalSteps) * 100));

      let nextStatus = assignment.status;
      if (assignment.status === "Not Started" && completedSteps > 0) {
        nextStatus = "In Progress";
      }

      await env.DB.prepare(`
        UPDATE training_assignments
        SET progress_percent = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).bind(newPercent, nextStatus, now, assignmentId).run();

      return Response.json({
        ok: true,
        progressPercent: newPercent,
        completedSteps,
        totalSteps,
        status: nextStatus
      });
    }

    // Action 3: Save Employee Notes
    if (action === "save-notes") {
      const notes = body.notes || "";
      await env.DB.prepare(`
        UPDATE training_assignments
        SET employee_notes = ?, updated_at = ?
        WHERE id = ?
      `).bind(notes, now, assignmentId).run();

      return Response.json({ ok: true });
    }

    // Action 4: Update Due Date (Admin-only)
    if (action === "update-due-date") {
      if (user.role !== "admin") {
        return Response.json({ error: "Only admins can change due dates" }, { status: 403 });
      }
      const dueAt = body.dueAt;
      if (!dueAt) return Response.json({ error: "Due date is required" }, { status: 400 });

      await env.DB.prepare(`
        UPDATE training_assignments
        SET due_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(dueAt, now, assignmentId).run();

      return Response.json({ ok: true, dueAt });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to update assignment" }, { status: 500 });
  }
}

async function logStatusChange(
  assignmentId: string,
  fromStatus: string,
  toStatus: string,
  userId: string,
  notes: string
) {
  try {
    await env.DB.prepare(`
      INSERT INTO training_status_history (id, assignment_id, from_status, to_status, changed_by, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), assignmentId, fromStatus, toStatus, userId, notes, new Date().toISOString()).run();
  } catch {}
}

function safeJson(val: unknown) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch {}
  }
  return [String(val)];
}
