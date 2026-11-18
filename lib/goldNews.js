// Pakistan's local (sarafa) gold rate, read from published news reports when the editor has not entered one.
// Reports are taken from our own news feeds plus ARY News and ProPakistani, which publish the daily rate.
// The AI only copies a per-tola 24-carat price that is written in the text; the number is then checked against the
// international price (a local rate far from it is rejected), and the source is shown on the page.
import { connectDB } from "./db";
import { Setting, SourceItem } from "@/models";
import { callAI, parseJSON } from "./ai";

const RE = /(gold|tola|bullion|sarafa|سونا|سونے|تولہ)/i;
const FEEDS = [
  { url: "https://arynews.tv/feed/", name: "ARY News" },
  { url: "https://propakistani.pk/feed/", name: "ProPakistani" },
];
const ok = (n) => typeof n === "number" && n > 100000 && n < 2000000;

export async function updateGoldFromNews({ intlTola24 = null, force = false } = {}) {
  await connectDB();
  const cur = (await Setting.findOne({ key: "goldTola24" }).lean()) || null;
  // The editor's own entry always wins for 36 hours
  if (cur?.value?.tola24 && !cur.value.auto && Date.now() - new Date(cur.updatedAt).getTime() < 36 * 3600e3) return cur.value;
  const meta = (await Setting.findOne({ key: "goldNewsCheck" }).lean())?.value || {};
  if (!force && meta.checkedAt && Date.now() - new Date(meta.checkedAt).getTime() < 3 * 3600e3) return cur?.value || null;
  await Setting.updateOne({ key: "goldNewsCheck" }, { $set: { value: { checkedAt: new Date() } } }, { upsert: true });

  const since = new Date(Date.now() - 3 * 86400e3);
  let extra = [];
  try {
    const Parser = (await import("rss-parser")).default;
    const parser = new Parser({ timeout: 8000, headers: { "User-Agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)" } });
    for (const f of FEEDS) {
      try {
        const feed = await parser.parseURL(f.url);
        extra.push(...(feed.items || []).slice(0, 40).map((i) => ({ title: i.title, snippet: (i.contentSnippet || "").slice(0, 700), sourceName: f.name, url: i.link, publishedAt: new Date(i.isoDate || i.pubDate || Date.now()) })));
      } catch {}
    }
  } catch {}
  const items = [...extra, ...(await SourceItem.find({ publishedAt: { $gte: since } }, { title: 1, snippet: 1, sourceName: 1, url: 1, publishedAt: 1 }).sort({ publishedAt: -1 }).limit(400).lean())]
    .filter((i) => /gold|tola|سونے|تولہ/i.test(`${i.title} ${i.snippet}`) && RE.test(i.title) && new Date(i.publishedAt) >= since)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 6);
  if (!items.length) return cur?.value || null;
  if (cur?.value?.auto && cur.value.sourceAt && new Date(items[0].publishedAt) <= new Date(cur.value.sourceAt)) return cur.value;

  try {
    const list = items.map((i, n) => `[${n}] ${i.sourceName} (${new Date(i.publishedAt).toISOString().slice(0, 10)}): ${i.title}. ${i.snippet || ""}`).join("\n");
    const r = await callAI({
      system: "You extract gold prices in Pakistan from news text. Reply with JSON only. Never guess or calculate: use only numbers written in the text.",
      prompt: `News items (newest first):\n${list}\n\nIf an item states the price of 24-carat gold per tola in Pakistan (in rupees), return {"item": <index of the newest such item>, "tola24": <number>, "silver": <silver per tola in rupees or null>}. If no item states that price (a price change alone does not count), return {"item": null}.`,
      maxTokens: 200,
    });
    const j = parseJSON(r?.text || "") || {};
    const src = items[j.item];
    if (!src || !ok(j.tola24)) return cur?.value || null;
    // Sanity check against the international price: Pakistani rates sit within about 12% of it
    if (intlTola24 && Math.abs(j.tola24 - intlTola24) / intlTola24 > 0.12) return cur?.value || null;
    const value = { tola24: j.tola24, silver: j.silver > 500 && j.silver < 20000 ? j.silver : null, auto: true, source: src.sourceName, url: src.url, sourceAt: src.publishedAt };
    await Setting.findOneAndUpdate({ key: "goldTola24" }, { value }, { upsert: true });
    return value;
  } catch { return cur?.value || null; }
}
