// Daily currency and gold/silver rates in Pakistani rupees.
// Source: the free, open "currency-api" (fawazahmed0, updated daily, no key needed), with a mirror as backup.
// Gold in Pakistan is traded per tola; the international price is converted, and the editor can enter
// today's local sarafa (bullion market) rate in Mission Control, which then takes priority.
import { connectDB } from "./db";
import { Setting } from "@/models";

const URLS = (date) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/pkr.min.json`,
  `https://${date}.currency-api.pages.dev/v1/currencies/pkr.min.json`,
];

export const GRAMS_PER_TOLA = 11.6638;
export const GRAMS_PER_OUNCE = 31.1035;

// Currencies shown on the site, in order. Names per language.
export const CURRENCIES = [
  { code: "USD", flag: "🇺🇸", ur: "امریکی ڈالر", en: "US Dollar", ar: "دولار أمريكي", de: "US-Dollar" },
  { code: "EUR", flag: "🇪🇺", ur: "یورو", en: "Euro", ar: "يورو", de: "Euro" },
  { code: "GBP", flag: "🇬🇧", ur: "برطانوی پاؤنڈ", en: "British Pound", ar: "جنيه إسترليني", de: "Britisches Pfund" },
  { code: "SAR", flag: "🇸🇦", ur: "سعودی ریال", en: "Saudi Riyal", ar: "ريال سعودي", de: "Saudi-Riyal" },
  { code: "AED", flag: "🇦🇪", ur: "اماراتی درہم", en: "UAE Dirham", ar: "درهم إماراتي", de: "VAE-Dirham" },
  { code: "QAR", flag: "🇶🇦", ur: "قطری ریال", en: "Qatari Riyal", ar: "ريال قطري", de: "Katar-Riyal" },
  { code: "KWD", flag: "🇰🇼", ur: "کویتی دینار", en: "Kuwaiti Dinar", ar: "دينار كويتي", de: "Kuwait-Dinar" },
  { code: "OMR", flag: "🇴🇲", ur: "عمانی ریال", en: "Omani Rial", ar: "ريال عماني", de: "Omanischer Rial" },
  { code: "BHD", flag: "🇧🇭", ur: "بحرینی دینار", en: "Bahraini Dinar", ar: "دينار بحريني", de: "Bahrain-Dinar" },
  { code: "CAD", flag: "🇨🇦", ur: "کینیڈین ڈالر", en: "Canadian Dollar", ar: "دولار كندي", de: "Kanadischer Dollar" },
  { code: "AUD", flag: "🇦🇺", ur: "آسٹریلین ڈالر", en: "Australian Dollar", ar: "دولار أسترالي", de: "Australischer Dollar" },
  { code: "CNY", flag: "🇨🇳", ur: "چینی یوآن", en: "Chinese Yuan", ar: "يوان صيني", de: "Chinesischer Yuan" },
  { code: "JPY", flag: "🇯🇵", ur: "جاپانی ین", en: "Japanese Yen", ar: "ين ياباني", de: "Japanischer Yen" },
  { code: "TRY", flag: "🇹🇷", ur: "ترک لیرا", en: "Turkish Lira", ar: "ليرة تركية", de: "Türkische Lira" },
  { code: "MYR", flag: "🇲🇾", ur: "ملائیشین رنگٹ", en: "Malaysian Ringgit", ar: "رينغيت ماليزي", de: "Malaysischer Ringgit" },
  { code: "INR", flag: "🇮🇳", ur: "بھارتی روپیہ", en: "Indian Rupee", ar: "روبية هندية", de: "Indische Rupie" },
  { code: "AFN", flag: "🇦🇫", ur: "افغانی", en: "Afghan Afghani", ar: "أفغاني", de: "Afghani" },
  { code: "GEL", flag: "🇬🇪", ur: "جارجین لاری", en: "Georgian Lari", ar: "لاري جورجي", de: "Georgischer Lari" },
];

const ymd = (d) => d.toISOString().slice(0, 10);

async function fetchDay(date) {
  for (const url of URLS(date)) {
    try {
      const r = await fetch(url, { next: { revalidate: 3 * 3600 } });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.pkr?.usd) return j;
    } catch {}
  }
  return null;
}

/** { date, pkrPer: { USD: 280.4, ..., XAU: <per troy ounce> }, prev: {...} } or null */
async function marketRates() {
  const today = await fetchDay("latest");
  if (!today) return null;
  const toPkr = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v > 0).map(([k, v]) => [k.toUpperCase(), 1 / v]));
  const pkrPer = toPkr(today.pkr);
  // The day before, for the up/down arrows
  let prev = null;
  try {
    const d = new Date(`${today.date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
    const y = await fetchDay(ymd(d));
    if (y) prev = toPkr(y.pkr);
  } catch {}
  return { date: today.date, pkrPer, prev };
}

/** The editor's sarafa rate for 24K gold per tola, if entered in the last 36 hours. */
async function sarafaRate() {
  try {
    await connectDB();
    const s = await Setting.findOne({ key: "goldTola24" }).lean();
    const v = s?.value || {};
    if (v.tola24 > 0 && Date.now() - new Date(s.updatedAt).getTime() < 36 * 3600e3) {
      return { tola24: Number(v.tola24), silverTola: Number(v.silver) || null, at: s.updatedAt, auto: !!v.auto, sourceName: v.source || null, sourceUrl: v.url || null };
    }
  } catch {}
  return null;
}

export async function getRates() {
  const [m, local] = await Promise.all([marketRates(), sarafaRate()]);
  if (!m && !local) return null;

  const fx = m ? CURRENCIES.filter((c) => m.pkrPer[c.code]).map((c) => ({
    ...c, pkr: m.pkrPer[c.code], prev: m.prev?.[c.code] || null,
  })) : [];

  // Gold: local sarafa rate if the editor entered one, otherwise the international price converted
  const xau = m?.pkrPer?.XAU, xag = m?.pkrPer?.XAG;
  const intlTola24 = xau ? (xau / GRAMS_PER_OUNCE) * GRAMS_PER_TOLA : null;
  const tola24 = local?.tola24 || intlTola24;
  const gold = tola24 ? {
    source: local ? "sarafa" : "international",
    sourceName: local?.sourceName || null, sourceUrl: local?.sourceUrl || null,
    at: local?.at || m?.date,
    tola24, tola22: tola24 * 22 / 24, tola21: tola24 * 21 / 24, tola18: tola24 * 18 / 24,
    gram24: tola24 / GRAMS_PER_TOLA, tenGram24: (tola24 / GRAMS_PER_TOLA) * 10,
    ounceUsd: xau && m.pkrPer.USD ? xau / m.pkrPer.USD : null,
    prevTola24: !local && m?.prev?.XAU ? (m.prev.XAU / GRAMS_PER_OUNCE) * GRAMS_PER_TOLA : null,
  } : null;
  const silverTola = local?.silverTola || (xag ? (xag / GRAMS_PER_OUNCE) * GRAMS_PER_TOLA : null);

  return { date: m?.date || null, fx, gold, silver: silverTola ? { tola: silverTola, gram: silverTola / GRAMS_PER_TOLA } : null };
}

export const money = (n, digits = 0) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

/** International gold price converted to rupees per tola (24K), ignoring any local rate. Used to sanity-check news-reported rates. */
export async function intlGoldTola() {
  const m = await marketRates();
  return m?.pkrPer?.XAU ? (m.pkrPer.XAU / GRAMS_PER_OUNCE) * GRAMS_PER_TOLA : null;
}
