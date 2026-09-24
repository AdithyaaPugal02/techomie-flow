import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

const allowed: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/x-png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData(),
      file = form.get("image");
    if (!(file instanceof File))
      return Response.json({ error: "Choose an image file" }, { status: 400 });

    const mime = (file.type || "").toLowerCase();
    let ext = allowed[mime];
    if (!ext) {
      const nameExt = (file.name.split(".").pop() || "").toLowerCase();
      if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(nameExt)) {
        ext = nameExt === "jpeg" ? "jpg" : nameExt;
      }
    }
    if (!ext) {
      return Response.json({ error: "Use JPG, PNG, WebP, GIF, or SVG image" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return Response.json({ error: "Image must be smaller than 15 MB" }, { status: 400 });
    }

    const name = `${crypto.randomUUID()}.${ext}`;
    const contentType = mime || (ext === "jpg" ? "image/jpeg" : `image/${ext}`);
    await env.FILES.put(name, file.stream(), { httpMetadata: { contentType } });
    return Response.json({ url: `/api/uploads/${name}`, key: name }, { status: 201 });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: "Unable to upload image" }, { status: 500 });
  }
}

