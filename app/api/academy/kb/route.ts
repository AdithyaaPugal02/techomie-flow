import { env } from "cloudflare:workers";
import { requireUser } from "@/lib/auth";

type P = Record<string, unknown>;

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const category = url.searchParams.get("category");
    const product = url.searchParams.get("product");
    const search = url.searchParams.get("q")?.trim();

    if (id) {
      const article = await env.DB.prepare(`
        SELECT k.*, u.name as author_name
        FROM training_kb_articles k
        JOIN users u ON u.id = k.created_by
        WHERE k.id = ?
      `).bind(id).first<P>();

      if (!article) {
        return Response.json({ error: "Article not found" }, { status: 404 });
      }

      // Increment view count
      await env.DB.prepare(`
        UPDATE training_kb_articles SET views = views + 1 WHERE id = ?
      `).bind(id).run();

      return Response.json({ article });
    }

    let sql = `
      SELECT k.*, u.name as author_name
      FROM training_kb_articles k
      JOIN users u ON u.id = k.created_by
      WHERE 1=1
    `;
    const args: unknown[] = [];

    if (category) {
      sql += " AND k.category = ?";
      args.push(category);
    }
    if (product) {
      sql += " AND k.product_model LIKE ?";
      args.push(`%${product}%`);
    }
    if (search) {
      sql += " AND (k.title LIKE ? OR k.symptom LIKE ? OR k.root_cause LIKE ? OR k.solution LIKE ? OR k.product_model LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY k.views DESC, k.created_at DESC";

    const rows = (await env.DB.prepare(sql).bind(...args).all<P>()).results;
    return Response.json({ articles: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to load Knowledge Base" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const body = await req.json() as Record<string, any>;
    const now = new Date().toISOString();

    const title = String(body.title || "").trim();
    const category = body.category || "General Troubleshooting";
    const productModel = String(body.productModel || body.product_model || "").trim();
    const symptom = String(body.symptom || "").trim();
    const rootCause = String(body.rootCause || body.root_cause || "").trim();
    const solution = String(body.solution || "").trim();
    const prevention = String(body.prevention || "").trim();
    const tags = Array.isArray(body.tags) ? body.tags.join(", ") : (body.tags || "");
    const challengeId = body.challengeId || body.challenge_id || null;

    if (!title || !symptom || !rootCause || !solution || !prevention) {
      return Response.json({
        error: "All fields are required: Title, symptom, root cause, solution, and prevention SOP."
      }, { status: 400 });
    }

    const articleId = `KB-${Date.now().toString().slice(-6)}`;

    await env.DB.prepare(`
      INSERT INTO training_kb_articles (
        id, challenge_id, title, category, product_model, symptom, root_cause, solution, prevention, tags, views, helpful_count, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `).bind(
      articleId, challengeId, title, category, productModel, symptom, rootCause, solution, prevention, tags,
      user.id, now, now
    ).run();

    if (challengeId) {
      await env.DB.prepare(`
        UPDATE training_challenges SET kb_article_id = ?, updated_at = ? WHERE id = ?
      `).bind(articleId, now, challengeId).run();
    }

    return Response.json({ ok: true, articleId, article_id: articleId }, { status: 201 });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return Response.json({ error: e?.message || "Failed to create Knowledge Base article" }, { status: 500 });
  }
}
