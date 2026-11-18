// World crude oil prices in US dollars per barrel (Brent and WTI), for the petrol page.
// Sources, tried in order: Stooq (CSV) then Yahoo Finance (chart JSON). Cached in Settings for 30 minutes;
// if both are unreachable the last good value is shown with its own timestamp, and nothing is invented.
import { connectDB } from "./db";
import { Setting } from "@/models";

const HEAD = { "User-Agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)", Accept: "*/*" };
const SYMBOLS = { brent: { stooq: "cb.f", yahoo: "BZ=F" }, wti: { stooq: "cl.f", yahoo: "CL=F" } };
const okPrice = (n) => Number.isFinite(n) && n > 15 && n < 300;

async function fromStooq(sym) {
  const r = await fetch(`https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`, { headers: HEAD, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`stooq ${r.status}`);
  const lines = (await r.text()).trim().split(/\r?\n/);
  const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const row = (lines[1] || "").split(",");
  const close = Number(row[cols.indexOf("close")]), open = Number(row[cols.indexOf("open")]);
  if (!okPrice(close)) throw new Error("stooq: no price");
  return { price: close, prev: okPrice(open) ? open : null, date: row[cols.indexOf("date")] || null };
}

async function fromYahoo(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, { headers: HEAD, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!r.ok) throw new Error(`yahoo ${r.status}`);
  const m = (await r.json())?.chart?.result?.[0]?.meta;
  const price = Number(m?.regularMarketPrice);
  if (!okPrice(price)) throw new Error("yahoo: no price");
  const prev = Number(m?.chartPreviousClose ?? m?.previousClose);
  return { price, prev: okPrice(prev) ? prev : null, date: m?.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString().slice(0, 10) : null };
}

async function one(key) {
  const s = SYMBOLS[key];
  try { return { ...(await fromStooq(s.stooq)), source: "Stooq" }; } catch {}
  try { return { ...(await fromYahoo(s.yahoo)), source: "Yahoo Finance" }; } catch {}
  return null;
}

/** { brent: {price, prev, date, source}, wti: {...}, fetchedAt } or the last good value, or null */
export async function getOil() {
  try {
    await connectDB();
    const cur = (await Setting.findOne({ key: "oil" }).lean())?.value || null;
    if (cur?.fetchedAt && Date.now() - new Date(cur.fetchedAt).getTime() < 30 * 60e3) return cur;
    const [brent, wti] = await Promise.all([one("brent"), one("wti")]);
    if (!brent && !wti) return cur;
    const value = { brent: brent || cur?.brent || null, wti: wti || cur?.wti || null, fetchedAt: new Date() };
    await Setting.updateOne({ key: "oil" }, { $set: { value } }, { upsert: true });
    return value;
  } catch { return null; }
}

/** The last saved value without calling the data sources (homepage). */
export async function peekOil() {
  try { await connectDB(); return (await Setting.findOne({ key: "oil" }).lean())?.value || null; } catch { return null; }
}
