// GET /api/cron/process            — turn ONE fresh story into a 4-language article
// GET /api/cron/process?mode=repair  — fix and re-check ONE story the quality check held back
// GET /api/cron/process?mode=folklore — write one traditional tale (قصہ), labelled as a story
// One item per call keeps each invocation inside the serverless time limit.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { processOne, writeFolkTale, fillMissingTranslations, repairHeld, backfillPhotos } from "@/lib/autopilot";
import { sweepDuplicates } from "@/lib/dedupe";
import { autoPost } from "@/lib/autosocial";
import { fixRecentCategories } from "@/lib/categoryFix";
import { connectDB } from "@/lib/db";
import { Article, Setting } from "@/models";
import { isCron } from "@/lib/util";
import { pingRecent } from "@/lib/indexnow";
import { fillFaq } from "@/lib/faq";

export const runtime = "nodejs";
export const maxDuration = 60;

// AUTO_PUBLISH=true publishes everything automatically. AUTO_PUBLISH_CATEGORIES (e.g. "world,economy,folklore")
// publishes only those sections automatically; everything else waits in the review queue.
const AUTO_PUBLISH = process.env.AUTO_PUBLISH === "true";
const AUTO_CATS = (process.env.AUTO_PUBLISH_CATEGORIES || "").split(",").map((c) => c.trim()).filter(Boolean);
const publish = (category) => AUTO_PUBLISH || AUTO_CATS.includes(category);

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t0 = Date.now();
  try {
    const mode = new URL(req.url).searchParams.get("mode");
    if (mode === "repair") {
      const r = await repairHeld();
      // Also give a few recent stories without a photo a free licensed one
      try { r.photos = await backfillPhotos(r.idle ? 6 : 2); } catch (e) { r.photos = { error: e.message }; }
      if (r.published || r.photos?.found) revalidatePath("/", "layout");
      if (!r.idle) await logRun({ ok: true, published: !!r.published, title: r.title, quality: r.quality, repaired: true });
      return NextResponse.json(r);
    }
    try { await pingRecent(); } catch { /* telling Bing is a bonus, never a reason to fail the run */ }
    let result;
    if (mode === "folklore") result = await writeFolkTale({ publish });
    else {
      // Daily mix: 75% Pakistani (60) + 25% international (20) = 80 a day, the international ones only when big or Pakistan-related (lib/worldGate.js). ?scope=pakistan|world asks for one side;
      // if that side is full for today (or has nothing new) the other side gets the slot.
      // Emergency desk first: Imran Khan / PTI / its leadership are written at once, whatever the daily quota says
      let hot = { idle: true };
      try { hot = await processOne({ publish, maxAgeHours: 48, automatic: true, priorityOnly: true }); } catch (e) { hot = { idle: true, aiError: String(e.message).slice(0, 160) }; }
      const counts = await todayCounts();
      if (!hot.idle) { result = { ...hot, scope: "priority" }; }
      else {
        const asked = new URL(req.url).searchParams.get("scope");
        const first = ["pakistan", "world"].includes(asked) ? asked : ((counts.world < (counts.pakistan + counts.world) * 0.25 && counts.pakistan >= 3 && counts.world < QUOTA.world) ? "world" : counts.pakistan < QUOTA.pakistan ? "pakistan" : "world");
        const order = [first, first === "pakistan" ? "world" : "pakistan"].filter((s) => counts[s] < QUOTA[s]);
        result = { ok: true, idle: true, quotaReached: order.length === 0 };
        for (const scope of order) {
          // an AI failure (quota, busy) must not stop the rest of the run: the posting below needs no new story
          try { result = await processOne({ publish, maxAgeHours: 6, automatic: true, scope }); }
          catch (e) { result = { ok: false, idle: true, aiError: String(e.message).slice(0, 160) }; }
          result.scope = scope;
          if (!result.idle) break;
        }
      }
      result.today = counts;
    }
    // Nothing new to write: use the run to add languages that were skipped for time
    if (result.idle && !result.aiError) { try { result.fill = await fillMissingTranslations(); } catch (e) { result.fill = { error: String(e.message).slice(0, 120) }; } }
    // Quick answers (Urdu / English / Roman Urdu) for the newest stories that have none yet
    if (Date.now() - t0 < 28000) { try { result.faq = await fillFaq(1, 20000); } catch (e) { result.faq = { error: String(e.message).slice(0, 120) }; } }
    // Clean up: archive the newer copy if two published stories cover the same event
    try { result.dedupe = await sweepDuplicates(); if (result.dedupe.archived) revalidatePath("/", "layout"); } catch {}
    // Share a fresh story on the Facebook page and Instagram (off unless SOCIAL_AUTO=true; ignored when this run was long)
    if (Date.now() - t0 < 35000) { try { result.social = await autoPost(); } catch (e) { result.social = { error: String(e.message).slice(0, 120) }; } }
    if (Date.now() - t0 < 50000) { try { result.cats = await fixRecentCategories(); if (result.cats.moved) revalidatePath("/", "layout"); } catch (e) { result.cats = { error: String(e.message).slice(0, 120) }; } }
    // Held stories nobody reviewed are archived after 48 hours, so the queue stays clean
    await archiveStaleHeld();
    if (result.published) revalidatePath("/", "layout");
    await logRun({ ok: true, published: !!result.published, idle: !!result.idle, title: result.title, quality: result.quality, dedupe: result.dedupe?.archived || null });
    return NextResponse.json(result);
  } catch (err) {
    await logRun({ ok: false, error: String(err.message).slice(0, 200) }).catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

const QUOTA = {
  pakistan: Number(process.env.SCOPE_QUOTA_PAKISTAN || 110),
  world: Number(process.env.SCOPE_QUOTA_WORLD || 20),
};
// Economy stories count as Pakistani only when they are about Pakistan (China stocks from Business Recorder are international)
const PK_ECON = "pakistan|rupee|\\bRs\\b|psx|kse|sbp|state bank|fbr|karachi|lahore|islamabad|peshawar|quetta|sukuk|ogra|nepra|secp|\\bimf\\b|punjab|sindh|balochistan|khyber|shehbaz|zardari|aurangzeb";
const PK_OUTLETS = ["Dawn", "Express Tribune", "Geo News"];

/** Stories published since Pakistan midnight, split into Pakistani and international. */
async function todayCounts() {
  await connectDB();
  const pkMidnight = new Date(Math.floor((Date.now() + 5 * 3600e3) / 86400e3) * 86400e3 - 5 * 3600e3);
  const base = { origin: "auto", status: "published", publishedAt: { $gte: pkMidnight }, contentType: "news" };
  const [total, pakistan] = await Promise.all([
    Article.countDocuments(base),
    Article.countDocuments({ ...base, $or: [{ category: { $in: ["pakistan", "politics"] } }, { category: "economy", "translations.en.title": { $regex: PK_ECON, $options: "i" } }, { category: "sports", "sources.name": { $in: PK_OUTLETS } }] }),
  ]);
  return { pakistan, world: total - pakistan };
}

/** Last 40 runs, shown in Mission Control as the newsroom log. */
async function logRun(entry) {
  await connectDB();
  await Setting.updateOne({ key: "newsroomLog" }, { $push: { value: { $each: [{ at: new Date(), ...entry }], $slice: -40 } } }, { upsert: true });
}

async function archiveStaleHeld() {
  await connectDB();
  await Article.updateMany(
    { origin: "auto", status: "pending_review", createdAt: { $lt: new Date(Date.now() - 48 * 3600e3) } },
    { status: "archived" },
  );
}
