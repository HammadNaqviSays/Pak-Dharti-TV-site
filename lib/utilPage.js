// Shared bits for the daily-utility pages (gold, dollar, petrol, PSX, mandi, prayer times).
import { LANGS } from "@/models";

export const UTIL_PAGES = ["prayer-times", "gold-rate", "dollar-rate", "petrol-price", "psx", "crypto", "mandi-rates", "jobs"];

export const UTIL_TITLES = {
  en: { "prayer-times": "Prayer times", "gold-rate": "Gold rate", "dollar-rate": "Dollar rate", "petrol-price": "Petrol & diesel price", psx: "PSX / KSE-100", crypto: "Bitcoin & crypto prices", "mandi-rates": "Mandi rates", jobs: "Government & bank jobs", rates: "All currency rates" },
  ur: { "prayer-times": "نماز کے اوقات", "gold-rate": "سونے کا نرخ", "dollar-rate": "ڈالر ریٹ", "petrol-price": "پیٹرول اور ڈیزل", psx: "اسٹاک ایکسچینج", crypto: "بٹ کوائن اور کرپٹو", "mandi-rates": "منڈی کے نرخ", jobs: "سرکاری اور بینک ملازمتیں", rates: "تمام کرنسی ریٹ" },
};

/** Today's date in Pakistan, written out for page titles: "7 November 2026" / "7 نومبر 2026". */
export function todayLabel(lang, d = new Date()) {
  return new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
}

export const alt = (lang, path) => ({
  canonical: `/${lang}${path}`,
  languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}${path}`])),
});

export const MANDI_EN = {
  wheat: "Wheat (per 40 kg)", gramWhite: "Gram, white", gramBlack: "Gram, black", gramPulse: "Gram pulse (daal chana)", moongPulse: "Moong pulse",
  mashPulse: "Mash pulse", masoorPulse: "Masoor pulse", potato: "Potato", onion: "Onion", tomato: "Tomato", garlic: "Garlic (local)",
  ginger: "Ginger", peas: "Peas", cauliflower: "Cauliflower", okra: "Okra (bhindi)", chilli: "Green chilli",
};
export const MANDI_CITY_EN = { Lahore: "Lahore", Faisalabad: "Faisalabad", Rawalpindi: "Rawalpindi", Multan: "Multan", Bhakhar: "Bhakkar" };
