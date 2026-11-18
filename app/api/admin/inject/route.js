// POST /api/admin/inject — Narrative Force Injector (server-to-server / scripts).
// The admin panel at /admin calls the same logic through a server action.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runInjection, ValidationError } from "@/lib/inject";
import { isAdmin } from "@/lib/util";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const result = await runInjection(body, "api");
    if (result.status === "published") revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    return NextResponse.json({ error: "Generation failed", detail: String(err.message).slice(0, 300) }, { status: 502 });
  }
}
