// GET /api/geo — the visitor's approximate city, from the location headers Vercel adds to each request.
// Used only to show local prayer times; nothing is stored.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const h = req.headers;
  const lat = parseFloat(h.get("x-vercel-ip-latitude"));
  const lng = parseFloat(h.get("x-vercel-ip-longitude"));
  let city = h.get("x-vercel-ip-city") || "";
  try { city = decodeURIComponent(city); } catch {}
  const body = Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng, city, country: h.get("x-vercel-ip-country") || "", tz: h.get("x-vercel-ip-timezone") || "" }
    : null;
  return Response.json(body, { headers: { "cache-control": "private, no-store" } });
}
