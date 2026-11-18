// Wholesale market (mandi) prices from AMIS Punjab (Agriculture Marketing Information Service,
// Punjab Agriculture Department): average wholesale prices in Rs per 100 kg for many Punjab cities.
// Fetched on the server at most every 6 hours; the last good result is kept in the database.
import { connectDB } from "./db";
import { Setting } from "@/models";
import { MANDI_CITIES, MANDI_ITEMS } from "./mandiItems";

const URL_AMIS = "http://www.amis.pk/";



// Every city heading on the page, used to cut the page into one block per city
const ALL_CITIES = ["Lahore", "Faisalabad", "Gujranwala", "Okara", "Sargodha", "Rawalpindi", "Multan", "RahimYarKhan", "Bhakhar", "Bhalwal",
  "Kasur", "Sahiwal", "Vehari", "Burewala", "Layyah", "Gujrat", "Khanewal", "MuzafarGhar", "BahawalPur", "TTSingh", "ArifWala", "Jaranwala",
  "PakPattan", "BahawalNagar", "Lodhran", "HaroonAbad", "Chistian", "GujarKhan", "Mailsi", "Kahrorpacca", "Chichawatni", "DunyaPur", "DGKHAN",
  "Chunian", "PhoolNagar", "MandiBahaudin", "JalalPurJattan", "Daska", "Kamalia", "PirMahal", "jalalpurpirwala", "MianChannu", "AhmadPurEast",
  "Sialkot", "Narowal", "Chakwal", "Jhelum", "Mianwali", "RajanPur", "Jhang", "SadiqAbad", "KotAdu", "RenalaKhurd", "Nankana", "LiaqatPur",
  "ChackJhumra", "Summandri", "Tandlianwala", "Mamunkanjan", "Sheikhupura", "Chiniot", "Shorkot", "Muridke", "Fortabas", "TALAGANG",
  "Sillanwali", "Abdulhakim", "Sanglahill", "Havelilakha", "Hafizabad", "Wazirabad", "MultanRoadLahore", "Kotradhakishan", "Kanganpur",
  "Dinga", "Sambrial"];



function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/tr|\/p|\/div|\/li|\/h\d|\/table)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ");
}

/** Cuts the page text into { cityName: text } blocks. */
function blocks(text) {
  const hits = [];
  for (const c of ALL_CITIES) {
    const re = new RegExp(`\\b${c}\\b`, "g");
    let m;
    while ((m = re.exec(text))) hits.push({ c, i: m.index });
  }
  hits.sort((a, b) => a.i - b.i);
  const out = {};
  hits.forEach((h, n) => {
    if (out[h.c]) return; // first heading only
    out[h.c] = text.slice(h.i + h.c.length, hits[n + 1]?.i ?? text.length);
  });
  return out;
}

/** Tries every place the item name appears in the city block and returns the first price (per 100 kg) that is plausible. */
function priceIn(block, re, ok) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m;
  while ((m = g.exec(block))) {
    const after = block.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const n = /([\d][\d,]*(?:\.\d+)?)/.exec(after);
    if (!n) continue;
    const v = Number(n[1].replace(/,/g, ""));
    if (v > 0 && v < 1e6 && (!ok || ok(v))) return v;
  }
  return null;
}

/** Removes values outside the item's plausible range, and values far from what the other cities report (a wrong row on the source page). */
export function sanitizeMandi(prices) {
  const out = {};
  for (const it of MANDI_ITEMS) {
    const vals = Object.entries(prices || {}).map(([c, p]) => [c, p?.[it.key]]).filter(([, v]) => Number.isFinite(v) && v >= it.range[0] && v <= it.range[1]);
    const sorted = vals.map(([, v]) => v).sort((a, b) => a - b);
    const med = sorted.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : null;
    for (const [c, v] of vals) {
      if (med && (v < med * 0.6 || v > med * 1.6)) continue;
      (out[c] ||= {})[it.key] = v;
    }
  }
  return out;
}

async function fetchAmis() {
  const r = await fetch(URL_AMIS, { headers: { "user-agent": "Mozilla/5.0 (PakDhartiTV)" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
  if (!r.ok) throw new Error(`AMIS ${r.status}`);
  const b = blocks(htmlToText(await r.text()));
  const prices = {};
  let found = 0;
  for (const city of MANDI_CITIES) {
    const block = b[city.key];
    if (!block) continue;
    prices[city.key] = {};
    for (const it of MANDI_ITEMS) {
      const per100 = priceIn(block, it.re, (v) => { const x = v * it.unit / 100; return x >= it.range[0] && x <= it.range[1]; });
      if (per100) { prices[city.key][it.key] = per100 * it.unit / 100; found++; }
    }
  }
  if (found < 8) throw new Error("AMIS page not understood");
  return sanitizeMandi(prices);
}

/** { prices: { Lahore: { potato: 87.5, ... } }, fetchedAt, source } or null */
export async function getMandi() {
  await connectDB();
  const cur = (await Setting.findOne({ key: "mandi" }).lean())?.value || null;
  if (cur?.prices) cur.prices = sanitizeMandi(cur.prices);
  if (cur?.fetchedAt && Date.now() - new Date(cur.fetchedAt).getTime() < 6 * 3600e3) return cur;
  try {
    const prices = await fetchAmis();
    // The page has no date: remember when the prices last changed, and show that as "rates as of"
    const changed = !cur?.prices || JSON.stringify(cur.prices) !== JSON.stringify(prices);
    const value = { prices, fetchedAt: new Date(), changedAt: changed ? new Date() : (cur.changedAt || cur.fetchedAt), source: "AMIS Punjab (amis.pk)" };
    await Setting.findOneAndUpdate({ key: "mandi" }, { value }, { upsert: true });
    return value;
  } catch {
    return cur; // keep showing the last good prices
  }
}

/** Reads AMIS right now (no 6-hour wait) and says whether the prices differ from the ones last posted. */
export async function mandiNow() {
  await connectDB();
  const prices = await fetchAmis();
  const cur = (await Setting.findOne({ key: "mandi" }).lean())?.value || null;
  const changed = !cur?.prices || JSON.stringify(sanitizeMandi(cur.prices)) !== JSON.stringify(prices);
  const value = { prices, fetchedAt: new Date(), changedAt: changed ? new Date() : (cur.changedAt || cur.fetchedAt), source: "AMIS Punjab (amis.pk)" };
  await Setting.findOneAndUpdate({ key: "mandi" }, { value }, { upsert: true });
  return value;
}
