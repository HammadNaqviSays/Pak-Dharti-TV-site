// Search engines should only see stories that add something for Pakistani readers.
// Foreign stories that are not big news and have no Pakistan link, and foreign sport outside the major events,
// stay on the site (and on social) but are marked noindex and left out of the sitemaps, so Google judges the site by its best pages.
import { isMajorWorld, touchesPakistan } from "@/lib/worldGate";

const BIG_SPORT = /\b(world cup|olympics?|asia cup|t20|psl|pakistan super league|champions trophy|icc|fifa|commonwealth games|asian games|cricket\w*|pcb|babar azam|rizwan|shaheen afridi|fakhar zaman|naseem shah|shadab|haris rauf|arshad nadeem|hockey|kabaddi|squash|olympian)\b/i;

export function isThinForSearch(a) {
  if (!a || (a.category !== "world" && a.category !== "sports")) return false;
  const en = a.translations?.en;
  const title = en?.title || "";
  if (!title) return false; // no English text to judge: keep it indexable
  const text = `${title} ${en?.summary || ""}`;
  if (a.category === "sports") return !(touchesPakistan(text) || BIG_SPORT.test(text));
  return !isMajorWorld({ title, snippet: en?.summary || "" });
}
