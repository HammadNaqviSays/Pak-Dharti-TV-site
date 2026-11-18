"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article, Setting } from "@/models";
import { scanSite, IMAGE_CODES, URDU_CODES, DUP_SURE } from "@/lib/audit";
import { categoryImage } from "@/lib/images";
import { pickPhoto } from "@/lib/photoPick";
import { translate } from "@/lib/generate";
import { callAI } from "@/lib/ai";
import { cleanUrduFields, urduHasForeignScript } from "@/lib/urdu";
import { repairForeignTokens } from "@/lib/urduFix";

/** Replaces every flagged photo with the category banner (instant, no AI). */
export async function fixPhotosAction() {
  if (!(await isLoggedIn())) redirect("/admin");
  const { issues } = await scanSite();
  const bySlug = new Map();
  for (const i of issues) if (IMAGE_CODES.includes(i.code)) bySlug.set(i.slug, i.category);
  if (bySlug.size) {
    await Article.bulkWrite([...bySlug].map(([slug, category]) => ({
      updateOne: { filter: { slug }, update: { $set: { image: categoryImage(category) } } },
    })));
    revalidatePath("/", "layout");
  }
  redirect(`/admin/audit?done=${encodeURIComponent(`Photos replaced with the category banner on ${bySlug.size} stories.`)}`);
}

/** Rewrites the Urdu of the next few flagged stories (uses the AI; slow, so only a few per click). */
export async function fixUrduAction() {
  if (!(await isLoggedIn())) redirect("/admin");
  const { issues } = await scanSite();
  const slugs = [...new Set(issues.filter((i) => URDU_CODES.includes(i.code)).map((i) => i.slug))].slice(0, 2);
  await connectDB();
  let fixed = 0, failed = 0, lastErr = "";
  for (const slug of slugs) {
    try {
      const a = await Article.findOne({ slug }, { "translations.en": 1 }).lean();
      const { data } = await translate(a.translations.en, "ur");
      const ur = cleanUrduFields(data);
      if (urduHasForeignScript(ur)) throw new Error("still foreign");
      await Article.updateOne({ slug }, { $set: { "translations.ur": ur } });
      fixed++;
    } catch (e) { failed++; lastErr = String(e.message || e).slice(0, 180); }
  }
  if (fixed) revalidatePath("/", "layout");
  redirect(`/admin/audit?done=${encodeURIComponent(`Urdu rewritten: ${fixed} fixed, ${failed} failed (of ${slugs.length} tried).${lastErr ? ` Last error: ${lastErr}` : " Click again for the next ones."}`)}`);
}

/**
 * Fast repair for Urdu with foreign letters inside words: takes the next 40 flagged stories, collects the distinct broken
 * words, asks the AI once for the correct Urdu spelling of each and replaces them. Repeat until the count is zero.
 */
export async function fixForeignWordsAction() {
  if (!(await isLoggedIn())) redirect("/admin");
  const { issues } = await scanSite();
  const slugs = [...new Set(issues.filter((i) => i.code === "ur-foreign-script").map((i) => i.slug))].slice(0, 40);
  await connectDB();
  const arts = await Article.find({ slug: { $in: slugs } }, { slug: 1, "translations.ur": 1 }).lean();
  const { objs, stats } = await repairForeignTokens(arts.map((a) => a.translations.ur));
  let changed = 0;
  for (let i = 0; i < arts.length; i++) {
    const before = arts[i].translations.ur, after = objs[i];
    if (["title", "summary", "body", "metaDescription"].some((k) => before[k] !== after[k])) {
      await Article.updateOne({ slug: arts[i].slug }, { $set: { "translations.ur": after } });
      changed++;
    }
  }
  if (changed) revalidatePath("/", "layout");
  const msg = stats.error
    ? `AI call failed: ${stats.error}`
    : `Stories checked: ${arts.length}. Broken words found: ${stats.found}, corrected: ${stats.fixed}, rejected: ${stats.rejected}. Stories updated: ${changed}. Click again for the next ones.${stats.rejected ? ` Why rejected: ${JSON.stringify(stats.why)}. Examples: ${stats.samples.join(" | ")}` : ""}`;
  redirect(`/admin/audit?done=${encodeURIComponent(msg)}`);
}

/** Hides (archives) the newer copy of one duplicate pair. The story stays in the database. */
export async function hideDuplicateAction(formData) {
  if (!(await isLoggedIn())) redirect("/admin");
  const slug = String(formData.get("slug") || "");
  await connectDB();
  const r = await Article.updateOne({ slug, status: "published" }, { $set: { status: "archived" } });
  if (r.modifiedCount) revalidatePath("/", "layout");
  redirect(`/admin/audit?done=${encodeURIComponent(r.modifiedCount ? "Duplicate hidden (archived)." : "Nothing changed.")}`);
}

/** Hides the newer copy of every pair that is almost certainly identical (match of 70% or more). */
export async function hideSureDuplicatesAction() {
  if (!(await isLoggedIn())) redirect("/admin");
  const { dups } = await scanSite();
  const slugs = [...new Set(dups.filter((d) => d.score >= DUP_SURE).map((d) => d.hide.slug))];
  await connectDB();
  let n = 0;
  if (slugs.length) {
    const r = await Article.updateMany({ slug: { $in: slugs }, status: "published" }, { $set: { status: "archived" } });
    n = r.modifiedCount || 0;
    if (n) revalidatePath("/", "layout");
  }
  redirect(`/admin/audit?done=${encodeURIComponent(`Hid ${n} near-identical duplicate stories (the older copy of each stays).`)}`);
}

/** AI reads each candidate pair (headline + summary) and hides the newer copy only when both report the very same event. */
export async function sortDuplicatesAction() {
  if (!(await isLoggedIn())) redirect("/admin");
  const { dups } = await scanSite();
  const pairs = dups.slice(0, 40);
  if (!pairs.length) redirect(`/admin/audit?done=${encodeURIComponent("No candidate duplicates to check.")}`);
  await connectDB();
  const slugs = [...new Set(pairs.flatMap((p) => [p.keep.slug, p.hide.slug]))];
  const arts = await Article.find({ slug: { $in: slugs } }, { slug: 1, publishedAt: 1, "translations.en": 1 }).lean();
  const by = Object.fromEntries(arts.map((a) => [a.slug, a]));
  const show = (s) => { const a = by[s]; const t = a?.translations?.en; return `"${t?.title || s}" (${a?.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : "?"}) — ${(t?.summary || "").slice(0, 260)}`; };
  let verdict;
  try {
    const { text } = await callAI({
      system: "You are a careful news desk editor. You reply with JSON only.",
      prompt: `For each numbered pair decide whether story A and story B report the SAME single news event, so that publishing both is a pointless duplicate. Answer "same" ONLY when it is the same event in the same place with no important new fact in either. Answer "different" for: a different country, city, person or match; a follow-up (new verdict, new number, a later stage); or the same topic on different days. When in doubt answer "different".
Return ONLY JSON like {"1":"same","2":"different"}.

${pairs.map((p, i) => `${i + 1}.\nA: ${show(p.keep.slug)}\nB: ${show(p.hide.slug)}`).join("\n\n")}`,
      maxTokens: 2000, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
    });
    // Read the answers with a pattern instead of strict JSON: the model sometimes adds stray text after the closing brace
    verdict = {};
    for (const m of String(text).matchAll(/"(\d+)"\s*:\s*"(same|different)"/gi)) if (!(m[1] in verdict)) verdict[m[1]] = m[2];
    if (!Object.keys(verdict).length) throw new Error("no answers in the AI reply");
  } catch (e) {
    redirect(`/admin/audit?done=${encodeURIComponent(`AI call failed: ${String(e.message || e).slice(0, 160)}`)}`);
  }
  const said = (i) => String(verdict?.[String(i + 1)] || "").toLowerCase();
  const hide = pairs.filter((_, i) => said(i) === "same").map((p) => p.hide.slug);
  // remember the pairs judged "different" so they disappear from the list (and the next click moves on to new pairs)
  const different = pairs.filter((_, i) => said(i) === "different").map((p) => `${p.keep.slug}|${p.hide.slug}`);
  const unanswered = pairs.length - hide.length - different.length;
  if (different.length) {
    const old = (await Setting.findOne({ key: "dup-reviewed" }).lean())?.value || [];
    await Setting.findOneAndUpdate({ key: "dup-reviewed" }, { value: [...new Set([...old, ...different])].slice(-2000) }, { upsert: true });
  }
  let n = 0;
  if (hide.length) {
    const r = await Article.updateMany({ slug: { $in: hide }, status: "published" }, { $set: { status: "archived" } });
    n = r.modifiedCount || 0;
    if (n) revalidatePath("/", "layout");
  }
  redirect(`/admin/audit?done=${encodeURIComponent(`AI checked ${pairs.length} pairs: ${n} real duplicates hidden (newer copy archived), ${different.length} judged different events or follow-ups (removed from the list)${unanswered ? `, ${unanswered} got no answer (click again)` : ""}.`)}`);
}

const slugFromInput = (v) => {
  const s = String(v || "").trim().split(/[?#]/)[0].replace(/\/+$/, "");
  return decodeURIComponent(s.split("/").pop() || "");
};

/** Replaces the photo of ONE story (slug or full link pasted) with its category banner. */
export async function replacePhotoAction(formData) {
  if (!(await isLoggedIn())) redirect("/admin");
  const slug = slugFromInput(formData.get("link"));
  await connectDB();
  const a = slug ? await Article.findOne({ slug }, { category: 1, "translations.en": 1 }).lean() : null;
  if (!a) redirect(`/admin/audit?done=${encodeURIComponent("Story not found: paste the story link or its last part.")}`);
  const img = await pickPhoto(a);
  await Article.updateOne({ slug }, { $set: { image: img } });
  revalidatePath("/", "layout");
  redirect(`/admin/audit?done=${encodeURIComponent(`Photo replaced (${img.provider === "local" ? "section banner, no good free photo found" : `${img.provider}: ${img.alt || img.credit || "new photo"}`}): ${slug}`)}`);
}

const STOCK = ["unsplash", "pexels", "openverse", "wikimedia"];

/** One batch for the progress popup: the AI looks at 6 stock photos and swaps those showing people for a fitting photo. */
async function checkPhotosBatch() {
  if (!(await isLoggedIn())) return { error: "Not logged in", left: 0, checked: 0, swapped: 0, errors: 0 };
  await connectDB();
  const done = new Set((await Setting.findOne({ key: "photo-checked" }).lean())?.value || []);
  const cands = await Article.find({ status: "published", "image.provider": { $in: STOCK } }, { slug: 1, category: 1, image: 1, "translations.en": 1 })
    .sort({ publishedAt: -1 }).limit(600).lean();
  const todo = cands.filter((a) => !done.has(a.slug) && /^https?:/.test(a.image?.thumb || a.image?.url || "")).slice(0, 4);
  let swapped = 0, errors = 0, lastErr = "";
  const doOne = async (a) => {
    try {
      const res = await fetch(a.image.thumb || a.image.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`photo download ${res.status}`);
      const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
      const data = Buffer.from(await res.arrayBuffer()).toString("base64");
      const { text } = await callAI({
        system: "You review photos for a news site. Answer with one word.",
        prompt: "Do people (faces, children, a family, a crowd, a portrait) make up the main subject of this photo? Answer exactly YES or NO.",
        maxTokens: 50, images: [{ data, mime }], prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
      });
      if (/yes/i.test(text)) { await Article.updateOne({ slug: a.slug }, { $set: { image: await pickPhoto(a) } }); swapped++; }
      done.add(a.slug);
    } catch (e) { errors++; lastErr = String(e.message || e).slice(0, 160); }
  };
  for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map(doOne)); // two at a time: gentler on the free per-minute limit
  await Setting.findOneAndUpdate({ key: "photo-checked" }, { value: [...done].slice(-5000) }, { upsert: true });
  if (swapped) revalidatePath("/", "layout");
  const left = cands.filter((a) => !done.has(a.slug) && /^https?:/.test(a.image?.thumb || a.image?.url || "")).length;
  return { checked: todo.length - errors, swapped, errors, left, error: errors && errors >= todo.length ? lastErr : "" };
}

/** Same as above, but a failure comes back as a readable message instead of a generic crash. */
export async function checkPhotosBatchAction() {
  try { return await checkPhotosBatch(); }
  catch (e) { return { checked: 0, swapped: 0, errors: 1, left: null, error: String(e?.message || e).slice(0, 200) }; }
}
