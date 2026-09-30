import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as Record<string, any>;
    const assignmentId = body.assignmentId || body.assignment_id;
    const notes = body.notes || body.report_text || body.report || "";
    const demoUrl = body.demoUrl || body.demo_url || "";
    const now = new Date().toISOString();

    if (!assignmentId) {
      return Response.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    const assignment = await env.DB.prepare(`
      SELECT a.*, t.title as task_title
      FROM training_assignments a
      JOIN training_tasks t ON t.id = a.task_id
      WHERE a.id = ?
    `).bind(assignmentId).first<P>();

    if (!assignment) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Role check: non-admin can only submit for themselves
    if (user.role !== "admin" && assignment.user_id !== user.id) {
      return Response.json({ error: "Forbidden: You cannot submit for another employee" }, { status: 403 });
    }

    // Check checklist items: all mandatory items should be checked
    const incompleteMandatory = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM training_checklist_items c
      LEFT JOIN training_checklist_progress p ON p.checklist_item_id = c.id AND p.assignment_id = ?
      WHERE c.task_id = ? AND c.is_mandatory = 1 AND COALESCE(p.completed, 0) = 0
    `).bind(assignmentId, assignment.task_id).first<{ count: number }>();

    if ((incompleteMandatory?.count || 0) > 0) {
      return Response.json({
        error: `Please complete all mandatory checklist steps before submitting (${incompleteMandatory?.count} remaining).`
      }, { status: 400 });
    }

    // Compute submission number
    const subCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM training_submissions WHERE assignment_id = ?
    `).bind(assignmentId).first<{ count: number }>();
    const nextSubNum = (subCount?.count || 0) + 1;

    const subId = `SUB-${assignmentId.replace("ASN-", "")}-${nextSubNum}`;

    // Insert submission record
    await env.DB.prepare(`
      INSERT INTO training_submissions (id, assignment_id, submission_number, notes, demo_url, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, 'Submitted', ?)
    `).bind(subId, assignmentId, nextSubNum, notes, demoUrl, now).run();

    // Link any attachments that were uploaded without submission_id
    await env.DB.prepare(`
      UPDATE training_submission_attachments
      SET submission_id = ?
      WHERE assignment_id = ? AND (submission_id IS NULL OR submission_id = '')
    `).bind(subId, assignmentId).run();

    if (Array.isArray(body.attachments)) {
      for (const att of body.attachments) {
        const key = att.fileKey || att.file_key || att.key || "";
        const name = att.fileName || att.file_name || "attachment";
        const type = att.fileType || att.file_type || "image/jpeg";
        const size = att.fileSize || att.file_size || 0;
        if (key) {
          await env.DB.prepare(`
            INSERT INTO training_submission_attachments (id, submission_id, assignment_id, file_key, file_name, file_type, file_size, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(crypto.randomUUID(), subId, assignmentId, key, name, type, size, user.id, now).run();
        }
      }
    }

    // Update assignment status
    const prevStatus = assignment.status as string;
    await env.DB.prepare(`
      UPDATE training_assignments
      SET status = 'Submitted for Review',
          last_submitted_at = ?,
          progress_percent = 100,
          employee_notes = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now, notes, now, assignmentId).run();

    // Log status history
    await env.DB.prepare(`
      INSERT INTO training_status_history (id, assignment_id, from_status, to_status, changed_by, notes, created_at)
      VALUES (?, ?, ?, 'Submitted for Review', ?, ?, ?)
    `).bind(crypto.randomUUID(), assignmentId, prevStatus, user.id, `Submission #${nextSubNum} entered`, now).run();

    // Notify Admins
    const admins = (await env.DB.prepare(`
      SELECT id FROM users WHERE active = 1 AND LOWER(role) = 'admin'
    `).all<{ id: string }>()).results;

    for (const adm of admins) {
      await env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
        VALUES (?, ?, 'training_submission', ?, 'training_submission', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        adm.id,
        `Submission #${nextSubNum}: ${user.name} submitted "${assignment.task_title}" for review`,
        assignmentId,
        now,
        now
      ).run();
    }

    return Response.json({
      ok: true,
      submissionId: subId,
      submission_id: subId,
      status: "Submitted for Review",
      submissionNumber: nextSubNum
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to submit task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const body = await req.json() as Record<string, any>;
    let assignmentId = body.assignmentId || body.assignment_id;
    const submissionId = body.submissionId || body.submission_id;
    const decision = body.decision || body.action; // 'approve' | 'request_changes'
    const feedback = String(body.feedback || body.admin_feedback || "").trim();
    const now = new Date().toISOString();

    if (!assignmentId && submissionId) {
      const sub = await env.DB.prepare("SELECT assignment_id FROM training_submissions WHERE id = ?").bind(submissionId).first<{ assignment_id: string }>();
      if (sub) assignmentId = sub.assignment_id;
    }

    if (!assignmentId || !decision) {
      return Response.json({ error: "Assignment ID and decision are required" }, { status: 400 });
    }

    const assignment = await env.DB.prepare(`
      SELECT a.*, t.title as task_title, u.id as emp_id, u.name as emp_name
      FROM training_assignments a
      JOIN training_tasks t ON t.id = a.task_id
      JOIN users u ON u.id = a.user_id
      WHERE a.id = ?
    `).bind(assignmentId).first<P>();

    if (!assignment) {
      return Response.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (decision === "approve") {
      // Approve Task Completion
      await env.DB.prepare(`
        UPDATE training_assignments
        SET status = 'Completed',
            completed_at = ?,
            approved_at = ?,
            approved_by = ?,
            admin_feedback = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(now, now, user.id, feedback || "Approved. Excellent technical work!", now, assignmentId).run();

      // Update latest submission if exists
      if (submissionId) {
        await env.DB.prepare(`
          UPDATE training_submissions
          SET status = 'Approved', admin_feedback = ?, reviewed_at = ?, reviewed_by = ?
          WHERE id = ?
        `).bind(feedback, now, user.id, submissionId).run();
      }

      // Log status history
      await env.DB.prepare(`
        INSERT INTO training_status_history (id, assignment_id, from_status, to_status, changed_by, notes, created_at)
        VALUES (?, ?, 'Submitted for Review', 'Completed', ?, ?, ?)
      `).bind(crypto.randomUUID(), assignmentId, user.id, `Approved by Admin: ${feedback}`, now).run();

      // Notify Employee
      await env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
        VALUES (?, ?, 'training_approved', ?, 'training_assignment', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        assignment.emp_id,
        `✓ Task Approved! You completed "${assignment.task_title}"`,
        assignmentId,
        now,
        now
      ).run();

      return Response.json({ ok: true, status: "Completed" });
    }

    if (decision === "request_changes") {
      if (!feedback) {
        return Response.json({ error: "Please provide feedback explaining what changes are requested." }, { status: 400 });
      }

      await env.DB.prepare(`
        UPDATE training_assignments
        SET status = 'Changes Requested',
            admin_feedback = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(feedback, now, assignmentId).run();

      if (submissionId) {
        await env.DB.prepare(`
          UPDATE training_submissions
          SET status = 'Changes Requested', admin_feedback = ?, reviewed_at = ?, reviewed_by = ?
          WHERE id = ?
        `).bind(feedback, now, user.id, submissionId).run();
      }

      // Log status history
      await env.DB.prepare(`
        INSERT INTO training_status_history (id, assignment_id, from_status, to_status, changed_by, notes, created_at)
        VALUES (?, ?, 'Submitted for Review', 'Changes Requested', ?, ?, ?)
      `).bind(crypto.randomUUID(), assignmentId, user.id, `Changes requested: ${feedback}`, now).run();

      // Notify Employee
      await env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, title, entity_type, entity_id, due_at, created_at)
        VALUES (?, ?, 'training_changes_requested', ?, 'training_assignment', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        assignment.emp_id,
        `⚠ Action Required: Changes requested on "${assignment.task_title}"`,
        assignmentId,
        now,
        now
      ).run();

      return Response.json({ ok: true, status: "Changes Requested" });
    }

    return Response.json({ error: "Invalid decision" }, { status: 400 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to review submission" }, { status: 500 });
  }
}
