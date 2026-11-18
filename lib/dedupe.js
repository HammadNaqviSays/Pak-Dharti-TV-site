// Stops the same news event from being published twice under different headlines
// ("Nana Patekar passes away at 75" / "Bollywood mourns the death of …").
// 1. sameStoryAs(): before writing, the new source item is compared with stories from the last 48 hours —
//    a quick word-overlap filter, then a short AI check that separates "same event" from "follow-up"
//    (a real new development is allowed).
// 2. sweepDuplicates(): after the fact, finds pairs already on the site and archives the newer copy.
import { connectDB } from "./db";
import { Article } from "@/models";
import { callAI, parseJSON } from "./ai";

const STOP = new Set(("the a an and or of to in on for with at by from as is are was were be been has have had will would says said " +
  "after amid over into about than this that these those their there its it his her they them who what when where why how " +
  "new news report reports today year years first last more most also says said told amid against during while").split(" "));

export function keywords(text = "") {
  return new Set(String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, "")).filter((w) => w.length > 3 && !STOP.has(w)));
}

export function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

const recent = (hours) => Article.find(
  { createdAt: { $gte: new Date(Date.now() - hours * 3600e3) }, status: { $in: ["published", "pending_review"] } },
  { "translations.en.title": 1, "translations.en.summary": 1, status: 1, createdAt: 1, publishedAt: 1, slug: 1 },
).sort({ createdAt: -1 }).limit(150).lean();

/** { same: true, slug } when the source item is the same event as a recent story; otherwise { same: false } */
export async function sameStoryAs(item) {
  await connectDB();
  const k = keywords(`${item.title} ${item.snippet || ""}`);
  const list = (await recent(48))
    .map((a) => ({ a, score: overlap(k, keywords(`${a.translations?.en?.title} ${a.translations?.en?.summary || ""}`)) }))
    .filter((x) => x.score >= 0.3).sort((x, y) => y.score - x.score).slice(0, 6);
  if (!list.length) return { same: false };
  try {
    const { text } = await callAI({
      system: "You are a news desk editor checking for duplicate stories. Reply with JSON only.",
      prompt: `NEW ITEM: ${item.title}. ${item.snippet || ""}

ALREADY PUBLISHED:
${list.map((x, i) => `[${i}] ${x.a.translations?.en?.title}. ${x.a.translations?.en?.summary || ""}`).join("\n")}

Is the NEW ITEM about the SAME news event as one already published (same happening, even if worded differently)?
A follow-up with a genuinely new development (new numbers, a verdict, a reaction from a new party, a later stage) is NOT the same.
Return {"same": <index or null>, "followUp": <index or null>}`,
      maxTokens: 120,
    });
    const j = parseJSON(text) || {};
    if (Number.isInteger(j.same) && list[j.same]) return { same: true, slug: list[j.same].a.slug };
  } catch {
    // AI unavailable: fall back to a strict word overlap
    if (list[0].score >= 0.6) return { same: true, slug: list[0].a.slug };
  }
  return { same: false };
}

/** Archives the newer of two published stories about the same event (at most one pair per call). */
export async function sweepDuplicates() {
  await connectDB();
  const items = (await recent(48)).filter((a) => a.status === "published");
  const keys = items.map((a) => keywords(`${a.translations?.en?.title} ${a.translations?.en?.summary || ""}`));
  let best = null;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const s = overlap(keys[i], keys[j]);
      if (s >= 0.45 && (!best || s > best.s)) best = { i, j, s };
    }
  }
  if (!best) return { checked: items.length, archived: null };
  const A = items[best.i], B = items[best.j];
  try {
    const { text } = await callAI({
      system: "You are a news desk editor checking for duplicate stories. Reply with JSON only.",
      prompt: `[A] ${A.translations?.en?.title}. ${A.translations?.en?.summary || ""}
[B] ${B.translations?.en?.title}. ${B.translations?.en?.summary || ""}
Are A and B about the same news event, with no genuinely new development in either? Return {"same": true|false}`,
      maxTokens: 60,
    });
    if (!(parseJSON(text) || {}).same) return { checked: items.length, archived: null };
  } catch { if (best.s < 0.7) return { checked: items.length, archived: null }; }
  // keep the older (first published) one, archive the newer copy
  const newer = new Date(A.publishedAt || A.createdAt) > new Date(B.publishedAt || B.createdAt) ? A : B;
  await Article.updateOne({ _id: newer._id }, { status: "archived" });
  return { checked: items.length, archived: newer.slug };
}
