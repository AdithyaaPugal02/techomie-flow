import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json() as Record<string, any>;
    const challengeId = body.challengeId;
    const content = String(body.content || "").trim();
    const commentType = body.commentType || "Comment";
    const now = new Date().toISOString();

    if (!challengeId || !content) {
      return Response.json({ error: "Challenge ID and comment content are required" }, { status: 400 });
    }

    const commentId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO training_challenge_comments (id, challenge_id, user_id, comment_type, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(commentId, challengeId, user.id, commentType, content, now).run();

    // Update challenge updated_at
    await env.DB.prepare(`
      UPDATE training_challenges SET updated_at = ? WHERE id = ?
    `).bind(now, challengeId).run();

    return Response.json({
      ok: true,
      comment: {
        id: commentId,
        challenge_id: challengeId,
        user_id: user.id,
        author_name: user.name,
        author_role: user.role,
        comment_type: commentType,
        content,
        created_at: now
      }
    }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to post comment" }, { status: 500 });
  }
}
