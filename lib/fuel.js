// Petrol and diesel prices in Pakistan. OGRA announces new prices every working day (Friday's hold over the
// weekend). There is no free official feed, so the prices are read from the news: our RSS feeds plus a
// business-news feed that reports each daily notification. The AI pulls out the per-litre prices, which must
// be stated in the item itself. Checked at most every 2 hours.
import { connectDB } from "./db";
import { Setting, SourceItem } from "@/models";
import { callAI, parseJSON } from "./ai";

const RE = /(petrol|diesel|hsd|fuel price|pol price|petroleum price|پیٹرول|ڈیزل|پٹرول)/i;
const ok = (n) => typeof n === "number" && n > 150 && n < 900;

export async function getFuel() {
  try {
    await connectDB();
    const s = await Setting.findOne({ key: "fuel" }).lean();
    return s?.value?.petrol ? s.value : null;
  } catch { return null; }
}

export async function updateFuelFromNews({ force = false } = {}) {
  await connectDB();
  const cur = (await Setting.findOne({ key: "fuel" }).lean())?.value || {};
  if (!force && cur.checkedAt && Date.now() - new Date(cur.checkedAt).getTime() < 2 * 3600e3) return cur;

  const since = new Date(Date.now() - 5 * 86400e3);
  let extra = [];
  try {
    const Parser = (await import("rss-parser")).default;
    const feed = await new Parser({ timeout: 8000, headers: { "User-Agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)" } }).parseURL("https://pkrevenue.com/feed/");
    extra = (feed.items || []).slice(0, 30).map((i) => ({ title: i.title, snippet: (i.contentSnippet || "").slice(0, 600), sourceName: "PkRevenue", url: i.link, publishedAt: new Date(i.isoDate || i.pubDate || Date.now()) }));
  } catch {}
  const items = [...extra, ...(await SourceItem.find({ publishedAt: { $gte: since } }, { title: 1, snippet: 1, sourceName: 1, url: 1, publishedAt: 1 })
    .sort({ publishedAt: -1 }).limit(400).lean())].filter((i) => RE.test(`${i.title} ${i.snippet}`) && new Date(i.publishedAt) >= since)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 6);

  const value = { ...cur, checkedAt: new Date() };
  const newest = items[0]?.publishedAt;
  if (items.length && (!cur.sourceAt || new Date(newest) > new Date(cur.sourceAt))) {
    try {
      const list = items.map((i, n) => `[${n}] ${i.sourceName} (${new Date(i.publishedAt).toISOString().slice(0, 10)}): ${i.title}. ${i.snippet || ""}`).join("\n");
      const r = await callAI({
        system: "You extract official fuel prices for Pakistan from news text. Reply with JSON only. Never guess: use only numbers written in the text.",
        prompt: `News items:\n${list}\n\nItems are listed newest first; use the NEWEST item that states the official per-litre price. If one of these items states the NEW official per-litre price of petrol and/or high-speed diesel in Pakistan (in rupees), return {"item": <index>, "petrol": <number or null>, "diesel": <number or null>, "effective": "<YYYY-MM-DD or null>"}. If no item states the actual new price, return {"item": null}.`,
        maxTokens: 300,
      });
      const j = parseJSON(r?.text || "") || {};
      const src = items[j.item];
      if (src && (ok(j.petrol) || ok(j.diesel))) {
        Object.assign(value, {
          petrol: ok(j.petrol) ? j.petrol : cur.petrol || null,
          diesel: ok(j.diesel) ? j.diesel : cur.diesel || null,
          effective: j.effective || null, source: src.sourceName, url: src.url, sourceAt: src.publishedAt,
        });
      }
    } catch {}
  }
  await Setting.findOneAndUpdate({ key: "fuel" }, { value }, { upsert: true });
  return value;
}
