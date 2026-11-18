// How the people on the server-made news cards are drawn. Set in Mission Control > Card look (Setting "cardlook").
import { Setting } from "@/models";
import { connectDB } from "@/lib/db";

export const LOOK_DEFAULT = {
  noCut: "whole", // "whole" = the whole picture, never cropped (the story's thing, e.g. a truck, goes on the other side), "photo" = plain photo, cropped to fill, "photo" = the plain photo fills the top of the card (cleanest), "bust" = head-and-shoulders trim, a person with a photo but no cut-out: "bust" = head-and-shoulders shape with the old background trimmed away, "fade" = soft portrait, "circle" = round photo with a gold ring
  headline: "curious", // the card headline: "curious" = a question / open detail written for the card, "news" = the story's own headline
  maxPics: 3,      // the most pictures on one card (people and the story's place together): 1, 2 or 3
  pick: "auto",    // which picture: "auto" = a real photo of the two together if there is one, else the people; "people" = each person; "main" = the main person only + the story's place; "event" = the place/event big, the main person beside it
  badge: "auto",   // the section + date badge at the top: "auto" (Urdu right, English left), "left", "center", "right" or "hide"
  flagStyle: "crack", // two or more flags: "crack" = a jagged golden crack between them, "blend" = smooth colour wash
  scale: 100,      // size of the people, percent (80 to 125)
  flag: 70,        // strength of the flag colour wash behind the people, percent (20 to 100)
  glow: 35,        // golden light behind the people, percent (0 to 100)
};

const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };

export function normLook(x = {}) {
  return {
    noCut: ["circle", "fade", "bust", "photo"].includes(x.noCut) ? x.noCut : "whole",
    flagStyle: x.flagStyle === "blend" ? "blend" : "crack",
    headline: x.headline === "news" ? "news" : "curious",
    maxPics: [1, 2, 3].includes(Number(x.maxPics)) ? Number(x.maxPics) : 3,
    pick: ["people", "main", "event"].includes(x.pick) ? x.pick : "auto",
    badge: ["left", "center", "right", "hide"].includes(x.badge) ? x.badge : "auto",
    scale: clamp(x.scale, 80, 125, LOOK_DEFAULT.scale),
    flag: clamp(x.flag, 20, 100, LOOK_DEFAULT.flag),
    glow: clamp(x.glow, 0, 100, LOOK_DEFAULT.glow),
  };
}

let memo = { at: 0, v: null };
export async function getCardLook(fresh = false) {
  if (!fresh && memo.v && Date.now() - memo.at < 60000) return memo.v;
  let v = LOOK_DEFAULT;
  try { await connectDB(); v = normLook((await Setting.findOne({ key: "cardlook" }).lean())?.value || {}); } catch { /* keep defaults */ }
  memo = { at: Date.now(), v };
  return v;
}
