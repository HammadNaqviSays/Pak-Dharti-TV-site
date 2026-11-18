// Clean up Urdu text from the AI so it renders correctly in Jameel Noori Nastaleeq:
// Western digits (as Pakistani Urdu news sites use), standard Urdu letters instead of
// Arabic/Persian/Kurdish look-alikes, and no stray invisible characters.
const MAP = {
  "ي": "ی", // ي → ی
  "ى": "ی", // ى → ی
  "ك": "ک", // ك → ک
  "ۄ": "و", "ۅ": "و", "ۆ": "و", "ۇ": "و", "ۈ": "و", "ۋ": "و", "ۏ": "و", // و variants
  "ە": "ہ", // ە → ہ
};

export function cleanUrdu(s) {
  if (typeof s !== "string" || !s) return s;
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[يىكۄ-ۈۋۏە]/g, (c) => MAP[c] || c)
    .replace(/ـ/g, "")                                   // tatweel
    .replace(/[​﻿‪-‮⁦-⁩]/g, "") // invisible direction marks
    .replace(/\u200C+/g, " ").replace(/ {2,}/g, " ")     // ZWNJ: the Noori font draws it as a box; Urdu writes a space
    .replace(/[\u200D\u2060\u00AD]/g, "")              // other joiners / soft hyphens
    .replace(/[\uFB50-\uFDF9\uFE70-\uFEFC]/g, (c) => c.normalize("NFKC")); // Arabic presentation forms → normal letters
}

// Scripts that must never appear in Urdu text: Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu,
// Kannada, Malayalam, Sinhala (U+0900-0DFF), Thai/Lao/Tibetan, Georgian, Hangul, Cyrillic, Greek, Hebrew,
// Armenian and CJK. (Latin is allowed: brand names and acronyms like "KSE-100" are written in Latin.)
const FOREIGN_SCRIPT = /[Ͱ-ϿЀ-ԯ԰-֏֐-׿ऀ-෿฀-࿿Ⴀ-ჿᄀ-ᇿ぀-ヿ㐀-䶿一-鿿가-힯]/;

/** True when a string contains a script that does not belong in Urdu (e.g. Bengali "রিয়েল মাদ্রিদ"). */
export function hasForeignScript(s) {
  return typeof s === "string" && FOREIGN_SCRIPT.test(s);
}

/** A short piece of text around the first foreign-script character (for the audit report), or "". */
export function foreignSnippet(s) {
  if (typeof s !== "string") return "";
  const m = FOREIGN_SCRIPT.exec(s);
  return m ? s.slice(Math.max(0, m.index - 15), m.index + 25).replace(/\s+/g, " ") : "";
}

const CLS = FOREIGN_SCRIPT.source; // the character class
const FOREIGN_RUN = new RegExp(`${CLS}+(?:[\\s\\u200c-]+${CLS}+)*`, "g");

/** Every run of foreign-script words in a text, e.g. ["রিয়েল মাদ্রিদ"]. */
export function foreignRuns(s) {
  return typeof s === "string" ? s.match(FOREIGN_RUN) || [] : [];
}

/** Replaces foreign-script runs using a map { run: urduText }. Runs not in the map are left as they are. */
export function replaceForeignRuns(s, map) {
  return typeof s === "string" ? s.replace(FOREIGN_RUN, (m) => (map[m] ? map[m] : m)) : s;
}

// A "token" is the whole word that contains a foreign letter, e.g. "ফوجی" (one wrong letter inside an Urdu word).
const SEP = "\\s،۔؟!؛:;\"'()\\[\\]{}«»";
const FOREIGN_TOKEN = new RegExp(`[^${SEP}]*${CLS}[^${SEP}]*`, "g");

/** Every whole word that contains a foreign-script letter. */
export function foreignTokens(s) {
  return typeof s === "string" ? s.match(FOREIGN_TOKEN) || [] : [];
}

/** Replaces whole words using a map { word: correctedWord }. Words not in the map are left as they are. */
export function replaceForeignTokens(s, map) {
  return typeof s === "string" ? s.replace(FOREIGN_TOKEN, (m) => (map[m] ? map[m] : m)) : s;
}

/** Name of the script of the first foreign character, for the audit report. */
export function foreignScriptName(s) {
  const m = typeof s === "string" ? FOREIGN_SCRIPT.exec(s) : null;
  if (!m) return "";
  const c = m[0].codePointAt(0);
  if (c >= 0x0980 && c <= 0x09FF) return "Bengali";
  if (c >= 0x0900 && c <= 0x097F) return "Hindi (Devanagari)";
  if (c >= 0x0A00 && c <= 0x0A7F) return "Gurmukhi";
  if (c >= 0x0400 && c <= 0x052F) return "Cyrillic";
  if (c >= 0x0590 && c <= 0x05FF) return "Hebrew";
  if (c >= 0x0370 && c <= 0x03FF) return "Greek";
  if (c >= 0x4E00 && c <= 0x9FFF) return "Chinese";
  return "other script";
}

/** True when any visible text field of an Urdu translation contains a foreign script. */
export function urduHasForeignScript(t) {
  return !!t && ["title", "summary", "body", "metaDescription"].some((k) => hasForeignScript(t[k]));
}

/** Clean every text field of an Urdu translation object. */
export function cleanUrduFields(t) {
  if (!t) return t;
  const out = { ...t };
  for (const k of ["title", "summary", "body", "metaDescription"]) out[k] = cleanUrdu(out[k]);
  return out;
}
