// GET /api/card/currency | gold | fuel | kse | prayer | nawafil  — a card drawn on the server (JPEG; ?fmt=png for PNG). Public: it only shows public rates.
import { renderCard, CARD_KINDS } from "@/lib/serverCards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req, { params }) {
  const { kind } = await params;
  if (!CARD_KINDS[kind]) return new Response("Not found", { status: 404 });
  try {
    const { jpeg, png } = await renderCard(kind, (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, ""));
    const usePng = new URL(req.url).searchParams.get("fmt") === "png" || !jpeg;
    return new Response(new Uint8Array(usePng ? png : jpeg), { headers: { "content-type": usePng ? "image/png" : "image/jpeg", "cache-control": "no-store" } });
  } catch (e) {
    return new Response(`card failed: ${String(e.message).slice(0, 200)}`, { status: 500 });
  }
}
