import { redirect } from "next/navigation";
import { setSession } from "../../../../lib/auth";

export async function GET(req: Request) {
  // Only permit on localhost
  const host = req.headers.get("host") || "";
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return new Response("Forbidden", { status: 403 });
  }
  await setSession("1b7ca933-76a2-4760-b549-c001b16d1ffe");
  return redirect("/");
}
