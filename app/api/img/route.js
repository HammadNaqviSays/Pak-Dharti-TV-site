// GET /api/img?u=<https url> — fetches a news photo on the server so the admin's card maker can draw it
// on a canvas and still download the result (browsers block saving canvases with foreign images).
import { isLoggedIn } from "@/lib/session";

export const runtime = "nodejs";
const MAX = 10 * 1024 * 1024;

export async function GET(req) {
  if (!(await isLoggedIn())) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url).searchParams.get("u") || "";
  let url;
  try { url = new URL(u); } catch { return new Response("Bad url", { status: 400 }); }
  if (url.protocol !== "https:") return new Response("https only", { status: 400 });
  // No internal addresses
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(url.hostname)) {
    return new Response("Forbidden", { status: 403 });
  }
  const r = await fetch(url, { headers: { "user-agent": "PakDhartiTV/1.0 (news card maker)" }, redirect: "follow" });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) return new Response("Not an image", { status: 415 });
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX) return new Response("Too large", { status: 413 });
  return new Response(buf, { headers: { "content-type": type, "cache-control": "private, max-age=3600" } });
}
