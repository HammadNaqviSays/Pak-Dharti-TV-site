// Reel settings from Mission Control (Setting "reels:config"): is the automatic script on, how many reels a day,
// and which sections of the site a reel may be made from.
import { connectDB } from "./db";
import { Setting } from "@/models";

export const REEL_SECTIONS = ["pakistan", "politics", "world", "economy", "sports", "disaster", "entertainment"];
export const REEL_DEFAULT = { auto: true, perDay: 3, cats: ["pakistan", "politics", "economy", "sports", "disaster"], minGapHours: 2, ptiFirst: true };

export async function getReelConfig() {
  await connectDB();
  const c = (await Setting.findOne({ key: "reels:config" }).lean())?.value || {};
  const perDay = Math.min(10, Math.max(1, Math.round(Number(c.perDay)) || REEL_DEFAULT.perDay));
  const cats = Array.isArray(c.cats) ? c.cats.filter((x) => REEL_SECTIONS.includes(x)) : REEL_DEFAULT.cats;
  return {
    auto: typeof c.auto === "boolean" ? c.auto : REEL_DEFAULT.auto,
    perDay, cats: cats.length ? cats : REEL_DEFAULT.cats,
    minGapHours: Math.min(12, Math.max(1, Number(c.minGapHours) || REEL_DEFAULT.minGapHours)),
    ptiFirst: c.ptiFirst !== false,
  };
}
export async function saveReelConfig(c) {
  await connectDB();
  await Setting.findOneAndUpdate({ key: "reels:config" }, { key: "reels:config", value: c }, { upsert: true });
}
