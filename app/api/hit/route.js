// POST /api/hit { path, src, rh, first, app } — counts one anonymous page view.
// Stores only counters per day (views, and visits = first page of a session) split by page, source, country/region/city,
// device, language and hour. No cookie, no IP address, no visitor id.
import { connectDB } from "@/lib/db";
import { Article, Traffic } from "@/models";
import { pkDay, pkHour, deviceFrom, osFrom, pageKey } from "@/lib/traffic";

export const runtime = "nodejs";
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|WhatsApp\/|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http/i;

// Meta (Facebook/Instagram) opens every shared link in a real browser from its own data centres to check it. Those visits look like readers
// but are not: they are counted apart ("bot-dc") and left out of every report. Real readers in these cities are very rare.
const DC_CITIES = new Set(["US|Boardman", "US|Prineville", "US|Forest City", "US|Altoona", "US|Fort Worth", "US|Gallatin", "US|Eagle Mountain", "US|Papillion", "US|New Albany", "US|Henrico", "US|Los Lunas", "US|DeKalb", "US|Huntsville", "US|Stanton Springs", "IE|Clonee", "SE|Luleå", "SE|Lulea", "DK|Odense"]);

export async function POST(req) {
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return new Response(null, { status: 204 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.path !== "string" || b.path.length > 300) return new Response(null, { status: 400 });
  const pk = pageKey(b.path);
  if (!pk) return new Response(null, { status: 400 });

  const h = req.headers;
  const cc = /^[A-Z]{2}$/.test(h.get("x-vercel-ip-country") || "") ? h.get("x-vercel-ip-country") : "XX";
  const region = (h.get("x-vercel-ip-country-region") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 8);
  let city = h.get("x-vercel-ip-city") || ""; try { city = decodeURIComponent(city); } catch {}
  city = city.slice(0, 50);
  if (DC_CITIES.has(`${cc}|${city}`)) {
    try { await connectDB(); await Traffic.updateOne({ day: pkDay(), dim: "bot-dc", key: `${cc}|${city}` }, { $inc: { views: 1 } }, { upsert: true }); } catch { /* not important */ }
    return new Response(null, { status: 204 });
  }
  const src = typeof b.src === "string" && /^[a-z0-9._-]{1,30}$/.test(b.src) ? b.src : "other";
  const rh = typeof b.rh === "string" ? b.rh.replace(/[^a-z0-9.-]/gi, "").toLowerCase().slice(0, 60) : "";
  const first = b.first === true;
  const day = pkDay();

  await connectDB();
  let art = null;
  if (pk.slug) art = await Article.findOne({ slug: pk.slug, status: "published" }, { category: 1 }).lean();

  const ops = [];
  const add = (dim, key) => ops.push({ updateOne: {
    filter: { day, dim, key }, update: { $inc: { views: 1, sessions: first ? 1 : 0 } }, upsert: true,
  } });
  add("total", "all");
  add("hour", pkHour());
  add("page", pk.key);
  add("lang", pk.lang);
  add("src", src);
  if (src === "other" && rh) add("refhost", rh);
  add("country", cc);
  if (region) add("region", `${cc}-${region}`);
  if (city) add("city", `${cc}|${city}`);
  add("device", deviceFrom(ua));
  add("os", osFrom(ua));
  add("mode", b.app === true ? "app" : "browser");
  if (art) {
    add("story", pk.slug);
    add("story-src", `${pk.slug}|${src}`);
    add("story-geo", `${pk.slug}|${cc}`);
    if (art.category) add("category", art.category);
  }
  try { await Traffic.bulkWrite(ops, { ordered: false }); } catch { /* a racing duplicate upsert: the rest still counted */ }
  return new Response(null, { status: 204 });
}
