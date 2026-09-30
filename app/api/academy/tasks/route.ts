import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const taskId = url.searchParams.get("id");
    const category = url.searchParams.get("category");
    const difficulty = url.searchParams.get("difficulty");
    const search = url.searchParams.get("q")?.trim();

    if (taskId) {
      const task = await env.DB.prepare(
        "SELECT * FROM training_tasks WHERE id = ?"
      ).bind(taskId).first<P>();

      if (!task) {
        return Response.json({ error: "Task not found" }, { status: 404 });
      }

      const checklist = (await env.DB.prepare(
        "SELECT * FROM training_checklist_items WHERE task_id = ? ORDER BY step_number ASC"
      ).bind(taskId).all<P>()).results;

      // If user is employee, fetch their assignment for this task
      let myAssignment = null;
      let myProgress: P[] = [];
      if (user.role !== "admin") {
        myAssignment = await env.DB.prepare(
          "SELECT * FROM training_assignments WHERE task_id = ? AND user_id = ?"
        ).bind(taskId, user.id).first<P>();

        if (myAssignment) {
          myProgress = (await env.DB.prepare(
            "SELECT * FROM training_checklist_progress WHERE assignment_id = ?"
          ).bind(myAssignment.id).all<P>()).results;
        }
      }

      return Response.json({
        task: {
          ...task,
          submission_requirements: safeJson(task.submission_requirements),
          checklist,
          myAssignment,
          myProgress,
        }
      });
    }

    // List all tasks
    let sql = "SELECT * FROM training_tasks WHERE active = 1";
    const args: unknown[] = [];

    if (category) {
      sql += " AND category = ?";
      args.push(category);
    }
    if (difficulty) {
      sql += " AND difficulty = ?";
      args.push(difficulty);
    }
    if (search) {
      sql += " AND (title LIKE ? OR description LIKE ? OR category LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY sort_order ASC, id ASC";

    const tasks = (await env.DB.prepare(sql).bind(...args).all<P>()).results;

    // Attach checklist count and (for employees) their assignment status
    const taskIds = tasks.map(t => t.id as string);
    let myAssignmentsMap = new Map<string, P>();

    if (user.role !== "admin" && taskIds.length > 0) {
      const myAsns = (await env.DB.prepare(
        "SELECT * FROM training_assignments WHERE user_id = ?"
      ).bind(user.id).all<P>()).results;
      myAsns.forEach(a => myAssignmentsMap.set(a.task_id as string, a));
    }

    const tasksWithDetails = await Promise.all(tasks.map(async (t) => {
      const checklistItems = (await env.DB.prepare(
        "SELECT id, title, is_mandatory FROM training_checklist_items WHERE task_id = ? ORDER BY step_number ASC"
      ).bind(t.id).all<P>()).results;

      const myAsn = myAssignmentsMap.get(t.id as string);

      return {
        ...t,
        submission_requirements: safeJson(t.submission_requirements),
        total_steps: checklistItems.length,
        checklist: checklistItems,
        myAssignment: myAsn || null,
      };
    }));

    return Response.json({ tasks: tasksWithDetails });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to load training tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const body = await req.json() as Record<string, any>;
    const now = new Date().toISOString();

    const title = String(body.title || "").trim();
    if (!title) {
      return Response.json({ error: "Task title is required" }, { status: 400 });
    }

    const id = body.id || `TASK-${Date.now().toString().slice(-4)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const category = body.category || "App Configuration";
    const difficulty = body.difficulty || "Intermediate";
    const estimatedHours = Number(body.estimatedHours || 4);
    const objective = body.objective || title;
    const description = body.description || title;
    const instructions = body.instructions || "";
    const submissionReqs = JSON.stringify(body.submissionRequirements || ["Screenshots / Photo evidence", "Demonstration notes"]);
    const isMandatory = body.isMandatory !== false ? 1 : 0;
    const sortOrder = Number(body.sortOrder || 99);

    await env.DB.prepare(`
      INSERT INTO training_tasks (id, title, slug, category, difficulty, estimated_hours, objective, description, instructions, submission_requirements, is_mandatory, sort_order, version, active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
    `).bind(
      id, title, slug, category, difficulty, estimatedHours, objective,
      description, instructions, submissionReqs, isMandatory, sortOrder,
      user.id, now, now
    ).run();

    // Insert checklist items if provided
    if (Array.isArray(body.checklist) && body.checklist.length > 0) {
      for (let i = 0; i < body.checklist.length; i++) {
        const item = body.checklist[i];
        const stepTitle = typeof item === "string" ? item : item.title;
        const stepId = `${id}-S${String(i + 1).padStart(2, "0")}`;
        await env.DB.prepare(`
          INSERT INTO training_checklist_items (id, task_id, step_number, title, is_mandatory)
          VALUES (?, ?, ?, ?, ?)
        `).bind(stepId, id, i + 1, stepTitle, 1).run();
      }
    }

    return Response.json({ ok: true, taskId: id }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const body = await req.json() as Record<string, any>;
    const id = body.id;
    if (!id) return Response.json({ error: "Task ID is required" }, { status: 400 });

    const now = new Date().toISOString();
    const existing = await env.DB.prepare("SELECT * FROM training_tasks WHERE id = ?").bind(id).first<P>();
    if (!existing) return Response.json({ error: "Task not found" }, { status: 404 });

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const category = body.category !== undefined ? body.category : existing.category;
    const difficulty = body.difficulty !== undefined ? body.difficulty : existing.difficulty;
    const estimatedHours = body.estimatedHours !== undefined ? Number(body.estimatedHours) : existing.estimated_hours;
    const objective = body.objective !== undefined ? body.objective : existing.objective;
    const description = body.description !== undefined ? body.description : existing.description;
    const instructions = body.instructions !== undefined ? body.instructions : existing.instructions;
    const submissionReqs = body.submissionRequirements !== undefined
      ? JSON.stringify(body.submissionRequirements)
      : existing.submission_requirements;
    const isMandatory = body.isMandatory !== undefined ? (body.isMandatory ? 1 : 0) : existing.is_mandatory;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;

    await env.DB.prepare(`
      UPDATE training_tasks SET
        title = ?, category = ?, difficulty = ?, estimated_hours = ?,
        objective = ?, description = ?, instructions = ?, submission_requirements = ?,
        is_mandatory = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      title, category, difficulty, estimatedHours, objective,
      description, instructions, submissionReqs, isMandatory, active, now, id
    ).run();

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to update task" }, { status: 500 });
  }
}

function safeJson(val: unknown) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch {}
  }
  return [String(val)];
}
