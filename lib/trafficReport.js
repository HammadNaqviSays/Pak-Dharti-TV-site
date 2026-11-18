import { connectDB } from "./db";
import { Traffic, Article } from "@/models";
import { pkDay } from "./traffic";

export const RANGES = { today: ["Today", 1], "7": ["Last 7 days", 7], "30": ["Last 30 days", 30], "90": ["Last 90 days", 90] };

const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
export const daysBetween = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

export const PK_REGIONS = { PB: "Punjab", SD: "Sindh", KP: "Khyber Pakhtunkhwa", BA: "Balochistan", IS: "Islamabad", GB: "Gilgit-Baltistan", JK: "Azad Kashmir" };
const SOURCE_NAMES = { "google-news": "Google News", x: "X (Twitter)", direct: "Direct / app / typed", whatsapp: "WhatsApp", facebook: "Facebook", google: "Google Search", youtube: "YouTube", instagram: "Instagram", telegram: "Telegram", tiktok: "TikTok", bing: "Bing", other: "Other websites" };
export const sourceName = (k) => SOURCE_NAMES[k] || k.charAt(0).toUpperCase() + k.slice(1);

let dn; // country code -> name
export function countryName(cc) {
  if (cc === "XX") return "Unknown";
  try { dn ||= new Intl.DisplayNames(["en"], { type: "region" }); return dn.of(cc) || cc; } catch { return cc; }
}
export function regionName(key) {
  const [cc, r] = key.split("-");
  return cc === "PK" ? `${PK_REGIONS[r] || r}` : `${countryName(cc)} · ${r}`;
}

function sumBy(rows, dim) {
  const m = new Map();
  for (const r of rows) if (r.dim === dim) {
    const x = m.get(r.key) || { key: r.key, views: 0, sessions: 0 };
    x.views += r.views; x.sessions += r.sessions; m.set(r.key, x);
  }
  return [...m.values()].sort((a, b) => b.views - a.views);
}
const total = (rows) => rows.filter((r) => r.dim === "total").reduce((a, r) => ({ views: a.views + r.views, sessions: a.sessions + r.sessions }), { views: 0, sessions: 0 });

/** range: "today" | "7" | "30" | "90". Returns everything the traffic page shows. */
export async function trafficReport(range = "7", story = "") {
  await connectDB();
  const n = (RANGES[range] || RANGES["7"])[1];
  const to = pkDay(), from = addDays(to, -(n - 1));
  const prevTo = addDays(from, -1), prevFrom = addDays(prevTo, -(n - 1));
  const base = { dim: { $nin: ["story-src", "story-geo"] } };
  const [rows, prevRows, allTime] = await Promise.all([
    Traffic.find({ day: { $gte: from, $lte: to }, ...base }).lean(),
    Traffic.find({ day: { $gte: prevFrom, $lte: prevTo }, dim: "total" }).lean(),
    Traffic.aggregate([{ $match: { dim: "total" } }, { $group: { _id: null, views: { $sum: "$views" }, first: { $min: "$day" } } }]),
  ]);
  const cur = total(rows), prev = total(prevRows);
  const perDay = Object.fromEntries(daysBetween(from, to).map((d) => [d, 0]));
  const perHour = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [String(i).padStart(2, "0"), 0]));
  for (const r of rows) { if (r.dim === "total") perDay[r.day] += r.views; if (r.dim === "hour") perHour[r.key] += r.views; }

  const stories = sumBy(rows, "story");
  const arts = await Article.find({ slug: { $in: stories.slice(0, 40).map((s) => s.key) } }, { slug: 1, category: 1, publishedAt: 1, "translations.en.title": 1 }).lean();
  const bySlug = Object.fromEntries(arts.map((a) => [a.slug, a]));
  const topStories = stories.slice(0, 40).map((s) => ({ ...s, title: bySlug[s.key]?.translations?.en?.title || s.key, category: bySlug[s.key]?.category || "", publishedAt: bySlug[s.key]?.publishedAt }));

  const out = {
    range, from, to, totals: cur, prev, allTime: allTime[0] || { views: 0, first: "" },
    perDay, perHour, topStories,
    sources: sumBy(rows, "src"), refhosts: sumBy(rows, "refhost").slice(0, 15),
    countries: sumBy(rows, "country"), regions: sumBy(rows, "region").slice(0, 20), cities: sumBy(rows, "city").slice(0, 20),
    devices: sumBy(rows, "device"), os: sumBy(rows, "os"), modes: sumBy(rows, "mode"), langs: sumBy(rows, "lang"),
    categories: sumBy(rows, "category"), pages: sumBy(rows, "page").slice(0, 20),
    detail: null,
  };
  if (story) {
    const [r2, a] = await Promise.all([
      Traffic.find({ day: { $gte: from, $lte: to }, $or: [{ dim: "story", key: story }, { dim: { $in: ["story-src", "story-geo"] }, key: { $regex: "^" + story.replace(/[^a-z0-9-]/gi, "") + "\\|" } }] }).lean(),
      Article.findOne({ slug: story }, { "translations.en.title": 1, "translations.ur.title": 1, category: 1, publishedAt: 1 }).lean(),
    ]);
    const strip = (rr, dim) => rr.filter((r) => r.dim === dim).map((r) => ({ ...r, key: r.key.split("|")[1] })).reduce((m, r) => { const x = m.get(r.key) || { key: r.key, views: 0, sessions: 0 }; x.views += r.views; x.sessions += r.sessions; m.set(r.key, x); return m; }, new Map());
    const dd = Object.fromEntries(daysBetween(from, to).map((d) => [d, 0]));
    for (const r of r2) if (r.dim === "story") dd[r.day] += r.views;
    out.detail = {
      slug: story, title: a?.translations?.en?.title || story, titleUr: a?.translations?.ur?.title || "", category: a?.category || "", publishedAt: a?.publishedAt,
      views: Object.values(dd).reduce((x, y) => x + y, 0), perDay: dd,
      sources: [...strip(r2, "story-src").values()].sort((x, y) => y.views - x.views),
      countries: [...strip(r2, "story-geo").values()].sort((x, y) => y.views - x.views),
    };
  }
  return out;
}
