import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "text/plain": "txt",
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const file = formData.get("file");
    const targetType = String(formData.get("targetType") || "submission"); // "submission" | "challenge"
    const assignmentId = String(formData.get("assignmentId") || "");
    const challengeId = String(formData.get("challengeId") || "");
    const kind = String(formData.get("kind") || "Evidence");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!allowedTypes[file.type]) {
      return Response.json({
        error: "Unsupported file type. Please upload JPG, PNG, WebP, PDF, or MP4/WebM video."
      }, { status: 400 });
    }

    // 50 MB limit for videos and documents
    if (file.size > 50 * 1024 * 1024) {
      return Response.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
    }

    const ext = allowedTypes[file.type] || "bin";
    const fileId = crypto.randomUUID();
    const key = `academy/${targetType}/${Date.now()}-${fileId}.${ext}`;
    const now = new Date().toISOString();

    // Store file in env.FILES
    await env.FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const fileUrl = `/api/uploads/${key}`;

    if (targetType === "submission" && assignmentId) {
      const attId = `ATT-${crypto.randomUUID().slice(0, 8)}`;
      await env.DB.prepare(`
        INSERT INTO training_submission_attachments (
          id, assignment_id, kind, file_key, file_name, file_type, file_size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        attId, assignmentId, kind, key, file.name, file.type, file.size, user.id, now
      ).run();

      return Response.json({
        ok: true,
        attachment: {
          id: attId,
          assignment_id: assignmentId,
          kind,
          file_key: key,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          url: fileUrl,
          created_at: now
        }
      }, { status: 201 });
    }

    if (targetType === "challenge" && challengeId) {
      const attId = `CAT-${crypto.randomUUID().slice(0, 8)}`;
      await env.DB.prepare(`
        INSERT INTO training_challenge_attachments (
          id, challenge_id, file_key, file_name, file_type, file_size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        attId, challengeId, key, file.name, file.type, file.size, user.id, now
      ).run();

      return Response.json({
        ok: true,
        attachment: {
          id: attId,
          challenge_id: challengeId,
          file_key: key,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          url: fileUrl,
          created_at: now
        }
      }, { status: 201 });
    }

    return Response.json({
      ok: true,
      fileKey: key,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      url: fileUrl
    }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "File upload failed" }, { status: 500 });
  }
}
