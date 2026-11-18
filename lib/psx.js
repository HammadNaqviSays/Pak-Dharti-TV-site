// KSE-100 index from the Pakistan Stock Exchange's own data portal (dps.psx.com.pk).
// Intraday points give today's open, high, low and latest value; the end-of-day series gives the
// previous close, which is what "up / down today" is measured against. Cached in Settings for 20 minutes,
// so the last good value is shown if PSX is unreachable (weekends and holidays show the last session).
import { connectDB } from "./db";
import { Setting } from "@/models";

const BASE = "https://dps.psx.com.pk/timeseries";
const HEAD = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36", Accept: "application/json, */*", Referer: "https://dps.psx.com.pk/" };
const pkDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(ms));
const toMs = (t) => (t > 1e12 ? t : t * 1000);

async function series(kind, symbol) {
  const r = await fetch(`${BASE}/${kind}/${symbol}`, { headers: HEAD, signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (!r.ok) throw new Error(`PSX ${kind} ${r.status}`);
  const j = await r.json();
  const rows = (Array.isArray(j) ? j : j.data || []).filter((x) => Array.isArray(x) && x.length >= 2 && Number(x[1]) > 0);
  return rows.map((x) => ({ t: toMs(Number(x[0])), v: Number(x[1]), open: x.length >= 4 ? Number(x[3]) || null : null })).sort((a, b) => a.t - b.t);
}

/** KSE-100 from dps.psx.com.pk/indices. The ticker reads "KSE100 167,089.27 -352.63 (-0.21%)";
 *  the table row (when present) adds high and low: "KSE100 high low current change (pct%)". */
async function indicesRow(symbol) {
  const r = await fetch("https://dps.psx.com.pk/indices", { headers: { ...HEAD, Accept: "text/html" }, signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (!r.ok) throw new Error(`PSX indices ${r.status}`);
  const text = (await r.text()).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const N = "(-?[\\d,]+(?:\\.\\d+)?)", P = "\\(?\\s*(-?[\\d.]+)\\s*%\\s*\\)?";
  const num = (x) => Number(String(x).replace(/,/g, ""));
  const out = {};
  const table = text.match(new RegExp(`\\b${symbol}\\s+${N}\\s+${N}\\s+${N}\\s+${N}\\s+${P}`));
  if (table) Object.assign(out, { high: num(table[1]), low: num(table[2]), close: num(table[3]), change: num(table[4]), pct: num(table[5]) });
  const tick = text.match(new RegExp(`\\b${symbol}\\s+${N}\\s+${N}\\s+${P}`));
  if (tick && !out.close) Object.assign(out, { close: num(tick[1]), change: num(tick[2]), pct: num(tick[3]) });
  const i = text.indexOf(symbol);
  return { ...out, raw: i >= 0 ? text.slice(i, i + 160) : "" };
}

/** { day, open, high, low, close, prevClose, change, pct, live, fetchedAt } */
export async function fetchIndex(symbol = "KSE100") {
  const [intra, row] = await Promise.all([
    series("int", symbol).catch(() => []),
    indicesRow(symbol).catch((e) => ({ error: e.message })),
  ]);
  let { high = null, low = null, close = null, change = null, pct = null } = row;
  // Without intraday points (weekend / holiday) the table shows the last session: Friday when it is Sat/Sun
  const lastWeekday = () => { let t = Date.now(); if (Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Karachi" }).format(new Date())) % 24 < 9) t -= 86400e3; for (let k = 0; k < 4; k++, t -= 86400e3) { const w = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Karachi" }).format(new Date(t)); if (w !== "Sat" && w !== "Sun") return pkDay(t); } return pkDay(Date.now()); };
  const day = intra.length ? pkDay(intra[intra.length - 1].t) : lastWeekday();
  const today = intra.filter((p) => pkDay(p.t) === day);
  const open = today.length ? today[0].v : null;
  if (!close && today.length) {
    close = today[today.length - 1].v;
    high = Math.max(...today.map((p) => p.v)); low = Math.min(...today.map((p) => p.v));
  }
  if (!close || close < 1000) throw new Error(`PSX: no index value (${row.error || row.raw || "empty"}; intraday ${intra.length})`);
  // sanity: high >= close >= low, and the % agrees with the change
  if (!(high >= close && close >= low)) { high = today.length ? Math.max(...today.map((p) => p.v)) : null; low = today.length ? Math.min(...today.map((p) => p.v)) : null; }
  const prevClose = change != null ? close - change : null;
  if (change != null && (pct == null || Math.abs(pct - (change / prevClose) * 100) > 0.05)) pct = (change / prevClose) * 100;
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Karachi" }).format(new Date()));
  const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Karachi" }).format(new Date());
  return {
    symbol, day, open, high, low, close, prevClose, change, pct,
    live: day === pkDay(Date.now()) && !["Sat", "Sun"].includes(wd) && h >= 9 && h < 16,   // PSX: 09:30-15:30 PKT, Mon-Fri
    fetchedAt: new Date().toISOString(), raw: row.raw,
  };
}

export async function getKse() {
  try {
    await connectDB();
    const s = (await Setting.findOne({ key: "kse100" }).lean())?.value;
    if (s?.fetchedAt && Date.now() - new Date(s.fetchedAt).getTime() < 20 * 60e3) return s;
    try {
      const v = await fetchIndex();
      await Setting.updateOne({ key: "kse100" }, { $set: { value: v } }, { upsert: true });
      return v;
    } catch (e) {
      console.error("KSE-100:", e.message);
      return s || null;
    }
  } catch { return null; }
}

/** The last saved KSE-100 value, without calling PSX (for the homepage, which must stay fast). */
export async function peekKse() {
  try { await connectDB(); return (await Setting.findOne({ key: "kse100" }).lean())?.value || null; } catch { return null; }
}
