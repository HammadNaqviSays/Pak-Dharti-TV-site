// Prices of a short list of large, well-known coins (information only: no advice, no links to exchanges).
// Source: CoinGecko's free price list; if it is unreachable, Yahoo Finance. Cached in Settings for 15 minutes;
// if both fail the last good value is shown with its own time, and nothing is invented.
import { connectDB } from "./db";
import { Setting } from "@/models";

export const COINS = [
  { id: "bitcoin", sym: "BTC", yahoo: "BTC-USD", en: "Bitcoin", ur: "بٹ کوائن", mark: "₿" },
  { id: "ethereum", sym: "ETH", yahoo: "ETH-USD", en: "Ethereum", ur: "ایتھیریم", mark: "Ξ" },
  { id: "tether", sym: "USDT", yahoo: "USDT-USD", en: "Tether", ur: "ٹیتھر", mark: "₮" },
  { id: "binancecoin", sym: "BNB", yahoo: "BNB-USD", en: "Binance Coin", ur: "بائنینس کوائن", mark: "◆" },
  { id: "ripple", sym: "XRP", yahoo: "XRP-USD", en: "Ripple", ur: "ریپل", mark: "✕" },
  { id: "solana", sym: "SOL", yahoo: "SOL-USD", en: "Solana", ur: "سولانا", mark: "◎" },
];
const HEAD = { "User-Agent": "Mozilla/5.0 (compatible; PakDhartiTV/1.0)", Accept: "application/json" };
const ok = (n) => Number.isFinite(n) && n > 0 && n < 1e8;

async function fromCoinGecko() {
  const ids = COINS.map((c) => c.id).join(",");
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`, { headers: HEAD, signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const list = await r.json();
  const out = {};
  for (const c of COINS) {
    const x = Array.isArray(list) ? list.find((m) => m.id === c.id) : null;
    if (x && ok(Number(x.current_price))) out[c.sym] = { usd: Number(x.current_price), pct: Number.isFinite(Number(x.price_change_percentage_24h)) ? Number(x.price_change_percentage_24h) : null };
  }
  if (!Object.keys(out).length) throw new Error("coingecko: no prices");
  return { prices: out, source: "CoinGecko" };
}

async function fromYahoo() {
  const out = {};
  await Promise.all(COINS.map(async (c) => {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${c.yahoo}?interval=1d&range=5d`, { headers: HEAD, signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!r.ok) return;
      const m = (await r.json())?.chart?.result?.[0]?.meta;
      const usd = Number(m?.regularMarketPrice), prev = Number(m?.chartPreviousClose ?? m?.previousClose);
      if (ok(usd)) out[c.sym] = { usd, pct: ok(prev) ? ((usd - prev) / prev) * 100 : null };
    } catch { /* this coin is skipped */ }
  }));
  if (!Object.keys(out).length) throw new Error("yahoo: no prices");
  return { prices: out, source: "Yahoo Finance" };
}

/** { prices: { BTC: {usd, pct}, ... }, source, fetchedAt } or the last good value, or null */
export async function getCrypto() {
  try {
    await connectDB();
    const cur = (await Setting.findOne({ key: "crypto" }).lean())?.value || null;
    if (cur?.fetchedAt && Date.now() - new Date(cur.fetchedAt).getTime() < 15 * 60e3) return cur;
    let got = null;
    try { got = await fromCoinGecko(); } catch { try { got = await fromYahoo(); } catch { /* keep the last value */ } }
    if (!got) return cur;
    const value = { ...got, prices: { ...(cur?.prices || {}), ...got.prices }, fetchedAt: new Date() };
    await Setting.updateOne({ key: "crypto" }, { $set: { value } }, { upsert: true });
    return value;
  } catch { return null; }
}

/** The last saved value without calling the data sources (homepage). */
export async function peekCrypto() {
  try { await connectDB(); return (await Setting.findOne({ key: "crypto" }).lean())?.value || null; } catch { return null; }
}
