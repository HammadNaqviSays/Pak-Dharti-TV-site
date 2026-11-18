// Picks the card's people and place photo from the words of the headline itself (English and Urdu), without AI.
// Used first by resolveVisual, so cards still get the right photo when Gemini is busy or out of quota.
import { connectDB } from "./db";
import { Person } from "@/models";
import { normName } from "./people";

// scene key → words (English words are matched on the normalized text, Urdu words as they are written)
const PLACES = [
  ["faisal-mosque", "faisal mosque|فیصل مسجد"],
  ["parliament-pk", "parliament house|national assembly|قومی اسمبلی|پارلیمنٹ|پارلیمان"],
  ["senate-pk", "senate|سینیٹ|ایوان بالا"],
  ["supreme-court-pk", "supreme court|سپریم کورٹ|عدالت عظمی"],
  ["islamabad-high-court", "islamabad high court|اسلام آباد ہائیکورٹ|اسلام آباد ہائی کورٹ"],
  ["lahore-high-court", "lahore high court|لاہور ہائیکورٹ|لاہور ہائی کورٹ"],
  ["pm-house-pk", "prime minister house|pm house|وزیراعظم ہاؤس|وزیر اعظم ہاؤس|وزیراعظم سیکرٹریٹ"],
  ["aiwan-e-sadr", "aiwan e sadr|aiwan-e-sadr|ایوان صدر"],
  ["election-commission-pk", "election commission|الیکشن کمیشن"],
  ["adiala", "adiala|اڈیالہ"],
  ["punjab-assembly", "punjab assembly|پنجاب اسمبلی"],
  ["kp-assembly", "kp assembly|khyber pakhtunkhwa assembly|خیبرپختونخوا اسمبلی|کے پی اسمبلی"],
  ["sindh-assembly", "sindh assembly|سندھ اسمبلی"],
  ["minar-e-pakistan", "minar e pakistan|minar-e-pakistan|مینار پاکستان"],
  ["badshahi-mosque", "badshahi mosque|بادشاہی مسجد"],
  ["mazar-e-quaid", "mazar e quaid|مزار قائد"],
  ["psx", "stock exchange|psx|kse|kse 100|kse100|اسٹاک ایکسچینج|پی ایس ایکس|کے ایس ای|حصص"],
  ["state-bank-pk", "state bank|اسٹیٹ بینک|سٹیٹ بینک"],
  ["imf", "imf|آئی ایم ایف"],
  ["world-bank", "world bank|ورلڈ بینک|عالمی بینک"],
  ["cricket-stadium", "gaddafi stadium|قذافی اسٹیڈیم"],
  ["national-stadium-karachi", "national stadium|نیشنل اسٹیڈیم"],
  ["wagah", "wagah|واہگہ"],
  ["torkham", "torkham|طورخم"],
  ["loc", "line of control|لائن آف کنٹرول"],
  ["gwadar", "gwadar|گوادر"],
  ["quetta", "quetta|کوئٹہ"],
  ["peshawar", "peshawar|پشاور"],
  ["karachi", "karachi|کراچی"],
  ["lahore", "lahore|لاہور"],
  ["islamabad", "islamabad|rawalpindi|اسلام آباد|راولپنڈی"],
  ["kashmir", "kashmir|کشمیر"],
  ["flood", "flood|floods|سیلاب|سیلابی"],
  ["earthquake", "earthquake|زلزلہ"],
  ["white-house", "white house|وائٹ ہاؤس"],
  ["capitol-us", "us congress|capitol hill|امریکی کانگریس"],
  ["pentagon", "pentagon|پینٹاگون"],
  ["kremlin", "kremlin|کریملن"],
  ["downing-street", "downing street|ڈاؤننگ اسٹریٹ"],
  ["un-security-council", "security council|سلامتی کونسل"],
  ["un", "united nations|general assembly|اقوام متحدہ"],
  ["icc-hague", "international criminal court|icc hague|عالمی فوجداری عدالت"],
  ["nato", "nato|نیٹو"],
  ["brussels-eu", "european union|brussels|یورپی یونین|برسلز"],
  ["gaza", "gaza|غزہ"],
  ["jerusalem", "jerusalem|یروشلم|بیت المقدس"],
  ["kyiv", "kyiv|kiev|کیف"],
  ["kabul", "kabul|کابل"],
  ["tehran", "tehran|تہران"],
  ["riyadh", "riyadh|ریاض"],
  ["makkah", "makkah|mecca|مکہ"],
  ["madinah", "madinah|medina|مدینہ"],
  ["doha", "doha|دوحہ"],
  ["dubai", "dubai|دبئی"],
  ["ankara", "ankara|انقرہ"],
  ["beijing", "beijing|بیجنگ"],
  ["new-delhi", "new delhi|نئی دہلی"],
  ["london", "london|لندن"],
  ["gold", "gold price|gold rate|سونے کی قیمت|سونے کے نرخ"],
  ["oil", "oil price|crude oil|خام تیل|تیل کی قیمت"],
  ["wheat", "wheat|گندم"],
  ["protest", "protest|دھرنا|احتجاج"],
];
const RX = PLACES.map(([key, words]) => [key, new RegExp(`(?:^| )(?:${words.split("|").map((w) => /[a-z]/i.test(w) ? normName(w) : w).join("|")})(?: |$)`, /[a-z]/i.test(words) ? "i" : "")]);

/** Scene key of the first (most specific) place named in the text, or "". */
export function sceneFromText(text = "") {
  const t = ` ${normName(text)} `.replace(/\s+/g, " ");
  const urdu = ` ${String(text).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ")} `;
  for (const [key, rx] of RX) if (rx.test(t) || rx.test(urdu)) return key;
  return "";
}

let cache = { at: 0, list: [] };
async function libraryAliases() {
  if (Date.now() - cache.at < 10 * 60e3 && cache.list.length) return cache.list;
  await connectDB();
  const rows = await Person.find({ "photos.0": { $exists: true } }, { name: 1, nameUr: 1, aliases: 1, priority: 1 }).lean();
  const list = [];
  for (const p of rows) {
    const al = new Set([normName(p.name), p.nameUr && normName(p.nameUr), ...(p.aliases || []).map(normName)].filter(Boolean));
    for (const a of al) if (a.split(" ").length >= 2 && a.length >= 7) list.push([a, p.name, p.priority || 0]);
  }
  cache = { at: Date.now(), list };
  return list;
}

/** Names of library people who are named in the text (English or Urdu spelling), in order of appearance, at most 3. */
export async function peopleFromText(text = "") {
  const t = ` ${normName(text)} `;
  const hits = [];
  for (const [alias, name, pr] of await libraryAliases()) {
    const i = t.indexOf(` ${alias} `);
    if (i >= 0) hits.push({ name, i, len: alias.length, pr });
  }
  hits.sort((a, b) => a.i - b.i || b.len - a.len);
  const out = [];
  for (const h of hits) if (!out.includes(h.name)) out.push(h.name);
  return out.slice(0, 3);
}

/** { people, scene } from the headline texts (any language), no AI. */
export async function localPlan(texts = []) {
  const text = texts.filter(Boolean).join(" . ");
  let people = [];
  try { people = await peopleFromText(text); } catch {}
  return { people, countries: [], orgs: [], scene: sceneFromText(texts.filter(Boolean).slice(0, 2).join(" . ")) };
}
