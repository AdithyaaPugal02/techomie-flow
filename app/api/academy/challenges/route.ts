import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const challengeId = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const severity = url.searchParams.get("severity");
    const employeeId = url.searchParams.get("employeeId");
    const taskId = url.searchParams.get("taskId");
    const search = url.searchParams.get("q")?.trim();

    if (challengeId) {
      const challenge = await env.DB.prepare(`
        SELECT c.*,
               u.name as reporter_name, u.email as reporter_email, u.role as reporter_role,
               t.title as task_title, t.category as task_category,
               inv.name as investigator_name,
               res.name as resolved_by_name
        FROM training_challenges c
        JOIN users u ON u.id = c.user_id
        LEFT JOIN training_tasks t ON t.id = c.task_id
        LEFT JOIN users inv ON inv.id = c.assigned_investigator_id
        LEFT JOIN users res ON res.id = c.resolved_by
        WHERE c.id = ?
      `).bind(challengeId).first<P>();

      if (!challenge) {
        return Response.json({ error: "Challenge not found" }, { status: 404 });
      }

      // Comments & discussions
      const comments = (await env.DB.prepare(`
        SELECT cm.*, u.name as author_name, u.role as author_role
        FROM training_challenge_comments cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.challenge_id = ?
        ORDER BY cm.created_at ASC
      `).bind(challengeId).all<P>()).results;

      // Attachments
      const attachments = (await env.DB.prepare(`
        SELECT a.*, u.name as uploader_name
        FROM training_challenge_attachments a
        LEFT JOIN users u ON u.id = a.uploaded_by
        WHERE a.challenge_id = ?
        ORDER BY a.created_at DESC
      `).bind(challengeId).all<P>()).results;

      return Response.json({
        challenge: {
          ...challenge,
          comments,
          attachments,
        }
      });
    }

    // List challenges
    let sql = `
      SELECT c.*,
             u.name as reporter_name, u.email as reporter_email, u.role as reporter_role,
             t.title as task_title,
             inv.name as investigator_name,
             (SELECT COUNT(*) FROM training_challenge_comments WHERE challenge_id = c.id) as comments_count,
             (SELECT COUNT(*) FROM training_challenge_attachments WHERE challenge_id = c.id) as attachments_count
      FROM training_challenges c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN training_tasks t ON t.id = c.task_id
      LEFT JOIN users inv ON inv.id = c.assigned_investigator_id
      WHERE 1=1
    `;
    const args: unknown[] = [];

    // For non-admin: can see their own challenges OR all resolved challenges / solutions
    if (user.role !== "admin") {
      sql += " AND (c.user_id = ? OR c.status = 'Resolved' OR c.status = 'Solution Provided')";
      args.push(user.id);
    } else if (employeeId) {
      sql += " AND c.user_id = ?";
      args.push(employeeId);
    }

    if (status) {
      sql += " AND c.status = ?";
      args.push(status);
    }
    if (category) {
      sql += " AND c.category = ?";
      args.push(category);
    }
    if (severity) {
      sql += " AND c.severity = ?";
      args.push(severity);
    }
    if (taskId) {
      sql += " AND c.task_id = ?";
      args.push(taskId);
    }
    if (search) {
      sql += " AND (c.title LIKE ? OR c.description LIKE ? OR c.product_model LIKE ? OR u.name LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY CASE c.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, c.created_at DESC";

    const rows = (await env.DB.prepare(sql).bind(...args).all<P>()).results;
    return Response.json({ challenges: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to load challenges" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as Record<string, any>;
    const now = new Date().toISOString();

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const productModel = String(body.productModel || body.product_model || "").trim();
    const category = body.category || "App Configuration";
    const severity = body.severity || "Medium";
    const stepsAttempted = String(body.stepsAttempted || body.steps_attempted || "").trim();
    const expectedBehavior = String(body.expectedBehavior || body.expected_behavior || "").trim();
    const actualBehavior = String(body.actualBehavior || body.actual_behavior || "").trim();

    if (!title || !description || !productModel || !stepsAttempted || !expectedBehavior || !actualBehavior) {
      return Response.json({
        error: "All fields are required: Title, description, product model, steps attempted, expected & actual behaviour."
      }, { status: 400 });
    }

    const challengeId = `CHL-${Date.now().toString().slice(-7)}`;
    const taskId = body.taskId || body.task_id || null;
    const assignmentId = body.assignmentId || body.assignment_id || null;

    await env.DB.prepare(`
      INSERT INTO training_challenges (
        id, task_id, assignment_id, user_id, title, description, product_model,
        category, severity, steps_attempted, expected_behavior, actual_behavior,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?)
    `).bind(
      challengeId, taskId, assignmentId, user.id, title, description, productModel,
      category, severity, stepsAttempted, expectedBehavior, actualBehavior,
      now, now
    ).run();

    // Attach any uploaded media files
    if (Array.isArray(body.attachments)) {
      for (const att of body.attachments) {
        const key = att.fileKey || att.file_key || att.key || "";
        const name = att.fileName || att.file_name || "attachment";
        const type = att.fileType || att.file_type || "image/jpeg";
        const size = att.fileSize || att.file_size || 0;
        if (key) {
          await env.DB.prepare(`
            INSERT INTO training_challenge_attachments (id, challenge_id, file_key, file_name, file_type, file_size, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(), challengeId, key, name, type, size, user.id, now
          ).run();
        }
      }
    }

    // Notify Admins
    const admins = (await env.DB.prepare(`
      SELECT id FROM users WHERE active = 1 AND LOWER(role) = 'admin'
    `).all<{ id: string }>()).results;

    for (const adm of admins) {
      await env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
        VALUES (?, ?, 'training_challenge', ?, 'training_challenge', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        adm.id,
        `[${severity}] Challenge Reported by ${user.name}: "${title}" (${productModel})`,
        challengeId,
        now,
        now
      ).run();
    }

    return Response.json({ ok: true, challengeId, challenge_id: challengeId }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to report challenge" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as Record<string, any>;
    const challengeId = body.id || body.challengeId || body.challenge_id;
    const action = body.action || "update-status";
    const now = new Date().toISOString();

    if (!challengeId) {
      return Response.json({ error: "Challenge ID is required" }, { status: 400 });
    }

    const challenge = await env.DB.prepare(`
      SELECT * FROM training_challenges WHERE id = ?
    `).bind(challengeId).first<P>();

    if (!challenge) {
      return Response.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Action 1: Provide solution / Resolve (Admin only)
    if (action === "resolve" || action === "provide-solution") {
      if (user.role !== "admin") {
        return Response.json({ error: "Only admins can resolve challenges" }, { status: 403 });
      }
      const solution = String(body.solution || body.resolutionSummary || "").trim();
      const newStatus = action === "resolve" ? "Resolved" : "Solution Provided";

      await env.DB.prepare(`
        UPDATE training_challenges
        SET status = ?, resolution_summary = ?, resolved_at = ?, resolved_by = ?, updated_at = ?
        WHERE id = ?
      `).bind(newStatus, solution, now, user.id, now, challengeId).run();

      // Add as comment
      if (solution) {
        await env.DB.prepare(`
          INSERT INTO training_challenge_comments (id, challenge_id, user_id, comment_type, content, created_at)
          VALUES (?, ?, ?, 'Solution', ?, ?)
        `).bind(crypto.randomUUID(), challengeId, user.id, solution, now).run();
      }

      // Notify the reporting employee
      await env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
        VALUES (?, ?, 'challenge_resolved', ?, 'training_challenge', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        challenge.user_id,
        `Technical Solution Provided for: "${challenge.title}"`,
        challengeId,
        now,
        now
      ).run();

      return Response.json({ ok: true, status: newStatus });
    }

    // Action 2: Reopen (if solution failed)
    if (action === "reopen") {
      const reason = String(body.reason || "Solution did not resolve the issue").trim();

      await env.DB.prepare(`
        UPDATE training_challenges
        SET status = 'Reopened', updated_at = ?
        WHERE id = ?
      `).bind(now, challengeId).run();

      await env.DB.prepare(`
        INSERT INTO training_challenge_comments (id, challenge_id, user_id, comment_type, content, created_at)
        VALUES (?, ?, ?, 'Status Change', ?, ?)
      `).bind(crypto.randomUUID(), challengeId, user.id, `Reopened issue: ${reason}`, now).run();

      return Response.json({ ok: true, status: "Reopened" });
    }

    // Action 3: Assign Investigator (Admin only)
    if (action === "assign-investigator") {
      if (user.role !== "admin") {
        return Response.json({ error: "Only admins can assign investigators" }, { status: 403 });
      }
      const investigatorId = body.investigatorId;
      await env.DB.prepare(`
        UPDATE training_challenges
        SET assigned_investigator_id = ?, status = 'Under Investigation', updated_at = ?
        WHERE id = ?
      `).bind(investigatorId, now, challengeId).run();

      return Response.json({ ok: true, status: "Under Investigation" });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to update challenge" }, { status: 500 });
  }
}
