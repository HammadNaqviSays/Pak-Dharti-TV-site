// Shared automation used by the cron routes and the Mission Control "Autopilot" button.
import { pickPhoto } from "./photoPick";
import Parser from "rss-parser";
import { connectDB } from "./db";
import { Article, SourceItem } from "@/models";
import { FEEDS } from "./feeds";
import { generateMultilingual, translate, PROMPT_VERSION } from "./generate";
import { cleanUrduFields } from "./urdu";
import { saneCategory } from "./categoryFix";
import { categoryImage, findImage, findFreePhoto } from "./images";
import { clusterKey, stripHtml, makeSlug } from "./util";
import { fullText, targetWords, STRUCTURE, review, decide, revise, FIXABLE_FLAGS, MIN_SCORE } from "./quality";
import { sameStoryAs } from "./dedupe";
import { rememberTweetLinks } from "./tweets";
import { isMajorWorld, isWantedSport } from "./worldGate";
import { PRIORITY_SOURCE, isPriority, isAdverseAllegationOnly, PTI_BRIEF } from "./priority";
import { keywords, overlap } from "./dedupe";
import { notePeople, findPeople, libraryImage, dedupeNames } from "./people";

// Sections the AI may file an automated story under (it picks the best fit)
// Which feeds count as "Pakistan" vs "world" news for the Autopilot's scope option
export const PK_FEEDS = ["dawn", "tribune", "geo", "dawn-biz", "tribune-biz", "tribune-sports", "thenews", "pakistantoday", "brecorder", "dawn-pakistan", "dawn-latest", "dawn-sport", "bbc-southasia", "guardian-pk", "ary", "samaa", "92news", "gnews-imran"];
export const FEED_SCOPES = {
  pakistan: PK_FEEDS,
  // every foreign outlet; only the big stories pass the gate in lib/worldGate.js
  world: ["bloomberg", "nyt-world", "cnn-world", "france24", "sky", "guardian-world", "independent", "npr", "wapo", "abc-au", "smh", "rnz", "arabnews", "dw", "straitstimes", "france24-all", "euronews", "cbc", "anadolu", "trt", "nhk", "japantimes", "thehindu", "ndtv", "gulfnews", "khaleej", "dailystar-bd", "tolo", "xinhua", "cgtn", "chinadaily", "scmp", "tass", "moscowtimes", "trend", "apa", "azernews", "bbc-world", "bbc-asia", "aljazeera", "dawn-world", "gdacs", "positive", "cricinfo", "bbc-sport"],
};
const scopeFilter = (scope) => (FEED_SCOPES[scope] ? { feed: { $in: FEED_SCOPES[scope] } } : {});

export const MIN_OUTLETS = Math.max(1, Number(process.env.MIN_SOURCES || 2));
const NO_CORRO_FEEDS = ["gdacs", "positive"];
/** Other outlets reporting the same event (title word overlap, last 36 h): { others, outlets } where outlets counts the item's own outlet. */
async function corroborate(item, pool) {
  const k = keywords(item.title);
  const seen = new Set([item.sourceName]); const others = [];
  for (const o of pool) {
    if (String(o.url) === String(item.url) || seen.has(o.sourceName)) continue;
    const ok = o.kw; let shared = 0;
    for (const w of k) if (ok.has(w)) shared++;
    if (shared >= 3 && overlap(k, ok) >= 0.5) { seen.add(o.sourceName); others.push(o); }
  }
  return { others, outlets: seen.size };
}

export const AUTO_SECTIONS = ["pakistan", "politics", "economy", "world", "sports", "disaster", "entertainment", "inspirational"];

/** Pull the RSS feeds into the SourceItem queue. Cheap; safe to call often. */
export async function ingestFeeds() {
  await connectDB();
  const parser = new Parser({ timeout: 8000, headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
  } });
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const feed = await parser.parseURL(f.url);
      const ops = feed.items.filter((it) => it.link && it.title && (!f.match || f.match.test(`${it.title} ${it.contentSnippet || it.summary || ""}`))).slice(0, 15).map((it) => ({
        updateOne: {
          filter: { url: it.link },
          update: {
            $setOnInsert: {
              url: it.link, feed: f.id, sourceName: f.name, category: f.category,
              title: it.title.trim(),
              snippet: stripHtml(it.contentSnippet || it.content || it.summary || "").slice(0, 1500),
              publishedAt: it.isoDate ? new Date(it.isoDate) : new Date(),
              clusterKey: clusterKey(it.title),
              state: "new",
            },
          },
          upsert: true,
        },
      }));
      if (!ops.length) return { feed: f.id, inserted: 0 };
      const r = await SourceItem.bulkWrite(ops, { ordered: false });
      return { feed: f.id, inserted: r.upsertedCount };
    })
  );
  return results.map((r, i) => (r.status === "fulfilled" ? r.value : { feed: FEEDS[i].id, error: r.reason?.message }));
}

/**
 * Turn ONE fresh source item into a 4-language article.
 * publish: function(category) → boolean. useStockPhoto: only when a person started the run
 * (Unsplash's terms do not allow fully automated use).
 */
export async function processOne({ publish, useStockPhoto = false, maxAgeHours = 24, scope = "all", automatic = false, priorityOnly = false }) {
  await connectDB();
  const since = new Date(Date.now() - maxAgeHours * 3600e3);
  const candidates = priorityOnly
    ? await SourceItem.find({ state: "new", publishedAt: { $gte: new Date(Date.now() - 48 * 3600e3) }, $or: [{ title: { $regex: PRIORITY_SOURCE, $options: "i" } }, { snippet: { $regex: PRIORITY_SOURCE, $options: "i" } }] })
      .sort({ publishedAt: -1 }).limit(20).lean()
    : await SourceItem.find({ state: "new", publishedAt: { $gte: since }, ...scopeFilter(scope) })
      .sort({ publishedAt: -1 }).limit(80).lean();

  let dupChecks = 0;
  const pool = await SourceItem.find({ publishedAt: { $gte: new Date(Date.now() - 36 * 3600e3) } }).select("title sourceName feed url snippet publishedAt").limit(800).lean();
  for (const o of pool) o.kw = keywords(o.title);
  for (const item of candidates) {
    // Three-source rule: a story goes up only when at least 3 different outlets carry it (Imran Khan / PTI stories and official
    // disaster alerts are exempt). Not enough yet: it stays in the queue and is tried again on the next run.
    // (Checked first: it is cheap, and it must not use up the slow AI duplicate checks below on stories that will wait anyway.)
    const corro = await corroborate(item, pool);
    if (!isPriority(item) && !NO_CORRO_FEEDS.includes(item.feed) && corro.outlets < MIN_OUTLETS) continue;
    const covered = item.clusterKey && await Article.exists({
      clusterKey: item.clusterKey, createdAt: { $gte: new Date(Date.now() - 24 * 3600e3) },
    });
    if (covered) { await SourceItem.updateOne({ _id: item._id }, { state: "skipped" }); continue; }
    // Sport: only Pakistan, international cricket and the big world events (no F1, club football, foreign leagues); see lib/worldGate.js
    if (!isPriority(item) && !isWantedSport(item)) { await SourceItem.updateOne({ _id: item._id }, { state: "skipped" }); continue; }
    // International news only when it is a big story or touches Pakistan (75% of the site is Pakistani news)
    if (!PK_FEEDS.includes(item.feed) && !isPriority(item) && !isMajorWorld(item)) { await SourceItem.updateOne({ _id: item._id }, { state: "skipped" }); continue; }
    // Same event already on the site under another headline? (a real follow-up is still written)
    if (dupChecks < 4) {
      dupChecks++;
      const dup = await sameStoryAs(item);
      if (dup.same) { await SourceItem.updateOne({ _id: item._id }, { state: "skipped" }); continue; }
    }

    // Atomically claim it so two overlapping runs never process the same item
    const claimed = await SourceItem.findOneAndUpdate({ _id: item._id, state: "new" }, { state: "used" });
    if (!claimed) continue;

    const related = corro.others.slice(0, 3);
    const all = [item, ...related];
    const startedAt = Date.now();
    // Read the source articles themselves, so the story has substance (and its length matches the material)
    const { text: sourceMaterial, chars, tweets } = await fullText(all);
    if (tweets?.length) await rememberTweetLinks(tweets, item.title).catch(() => {});

    try {
      let quality = null;
      const { master, translations, failedLangs, usage, model, gate } = await generateMultilingual({
        brief: "Write an original news report that synthesises the source material. Neutral, factual tone with a gripping but honest opening. Attribute every claim to its outlet. Do not speculate beyond the sources." + (isPriority(item) ? PTI_BRIEF : ""),
        category: item.category,
        contentType: "news",
        sourceMaterial,
        sections: AUTO_SECTIONS,
        words: targetWords(chars),
        startedAt,
        structure: STRUCTURE,
        // Strict second opinion before spending time on translations
        gate: async (m) => {
          let r;
          try { r = await review(m, sourceMaterial); } catch (e) { r = { score: 0, unsupported: [], flags: ["reviewFailed"], reason: e.message }; }
          const pkMidnight = new Date(Math.floor((Date.now() + 5 * 3600e3) / 86400e3) * 86400e3 - 5 * 3600e3);
          const publishedToday = await Article.countDocuments({ origin: "auto", status: "published", publishedAt: { $gte: pkMidnight } });
          const d = decide(r, { chars, minChars: isPriority(item) ? 100 : 300, publishedToday: isPriority(item) ? 0 : publishedToday });   // Imran Khan / PTI stories are never held by the daily cap
          quality = { ...r, decision: d.why, sourceChars: chars, sources: all.length, checkedAt: new Date() };
          return { pass: d.publish };
        },
      });
      let category = AUTO_SECTIONS.includes(master.category) ? master.category : item.category;
      // Safety net: crime / police / accident stories are not politics or economy, whatever the AI picked
      const crimeRe = /\b(murder\w*|kill\w*|shot|shooting|gunfire|firing|police|arrest\w*|custody|robbery|theft|rape|kidnap\w*|abduct\w*|crash\w*|accident|blast|stabb\w*|body found|suspect)\b/i;
      const bizRe = /\b(minister|parliament|assembly|election|budget|imf|inflation|rupee|psx|stock|petrol|tax|tariff|economy|economic|trade|bank)\b/i;
      if (["politics", "economy"].includes(category) && crimeRe.test(`${master.title} ${master.summary}`) && !bizRe.test(`${master.title}`)) {
        category = ["pakistan", "world"].includes(item.category) ? item.category : "pakistan";
      }
      category = saneCategory(category, master.title, master.summary);
      // People: free Wikimedia Commons photos are fine automatically; Unsplash only when a person runs it
      // People in the story: count mentions, queue unknown names for the photo library
      try { await notePeople([master.person, ...(master.people || [])]); } catch {}
      const libPerson = master.person ? (await findPeople([master.person]).catch(() => []))[0] : null;
      let image = libPerson && libraryImage(libPerson) ? libraryImage(libPerson) : master.person || useStockPhoto
        ? await findImage(useStockPhoto ? master.imageQuery : "", category, { person: master.person, context: `${master.title}. ${master.summary || ""}` })
        : categoryImage(category);
      if (image.provider === "local") image = (await findFreePhoto(master.imageQuery, category)) || image;
      // still only the section banner: let the AI name the person or place that fits the story best
      if (image.provider === "local") { try { image = await pickPhoto({ category, translations: { en: { title: master.title, summary: master.summary } } }); } catch {} }
      // Only stories that pass the quality gate can go live. On the schedule they publish by themselves
      // (AUTO_PUBLISH=off stops that; AUTO_PUBLISH=manual limits it to AUTO_PUBLISH_CATEGORIES);
      // from Mission Control the editor's publishing mode decides.
      const passed = !!gate?.pass;
      const mode = process.env.AUTO_PUBLISH;
      const hot = isPriority(item);
      const adverse = hot && isAdverseAllegationOnly(`${master.title} ${master.summary} ${item.title} ${item.snippet || ""}`);
      if (adverse && quality) quality.flags = [...(quality.flags || []), "pti-adverse"];
      const live = passed && !adverse && (hot ? mode !== "off" : automatic ? mode !== "off" && (mode !== "manual" || publish(category)) : publish(category));

      const article = await Article.create({
        slug: makeSlug(master.title),
        origin: "auto",
        contentType: "news",
        category,
        translations,
        tags: master.tags || [],
        visual: { people: dedupeNames([master.person, ...(master.people || [])].filter(Boolean)).slice(0, 6), countries: (master.countries || []).slice(0, 4), orgs: (master.orgs || []).slice(0, 3), scene: master.scene || "" },
        image,
        sources: all.map((s) => ({ name: s.sourceName, url: s.url, publishedAt: s.publishedAt })),
        clusterKey: item.clusterKey,
        status: live ? "published" : "pending_review",
        placement: { slot: hot ? "breaking" : category === "disaster" ? "top" : "standard", priority: hot ? 5 : 0 },
        ai: { model, promptVersion: PROMPT_VERSION, ...usage },
        quality,
        publishedAt: live ? new Date() : undefined,
        disclosure: { aiGenerated: true, humanReviewed: false },
      });
      if (related.length) await SourceItem.updateMany({ _id: { $in: related.map((r) => r._id) } }, { state: "used" });
      return { ok: true, published: live, title: master.title, titleUr: translations.ur?.title, category, failedLangs, id: String(article._id), quality: quality && { score: quality.score, decision: quality.decision, ...(quality.score ? {} : { reason: quality.reason }) } };
    } catch (err) {
      await SourceItem.updateOne({ _id: item._id }, { state: "new" }); // release for retry
      const e = new Error(err.message); e.status = err.status; throw e;
    }
  }
  return { ok: true, idle: true };
}

/** One traditional tale (قصہ), clearly labelled as a story. */
export async function writeFolkTale({ publish, useStockPhoto = false }) {
  await connectDB();
  const { master, translations, failedLangs, usage, model } = await generateMultilingual({
    brief: "Retell a traditional South Asian or Islamic-world folk tale or moral story (حکایت/قصہ) — e.g. from Punjabi, Sindhi, Saraiki, Pashto, Balochi or Persian tradition — with its moral at the end. Name the tradition it comes from. Make clear it is a traditional tale, not a news event. Choose a different tale each time.",
    category: "folklore",
    contentType: "story",
  });
  const live = publish("folklore");
  const image = useStockPhoto ? await findImage(master.imageQuery, "folklore") : categoryImage("folklore");
  const article = await Article.create({
    slug: makeSlug(master.title), origin: "auto", contentType: "story", category: "folklore",
    translations, tags: master.tags || [], image,
    status: live ? "published" : "pending_review",
    ai: { model, promptVersion: PROMPT_VERSION, ...usage },
    publishedAt: live ? new Date() : undefined,
    disclosure: { aiGenerated: true, humanReviewed: false },
  });
  return { ok: true, published: live, title: master.title, titleUr: translations.ur?.title, category: "folklore", failedLangs, id: String(article._id) };
}

export async function pendingSourceCount(maxAgeHours = 24, scope = "all") {
  await connectDB();
  return SourceItem.countDocuments({ state: "new", publishedAt: { $gte: new Date(Date.now() - maxAgeHours * 3600e3) }, ...scopeFilter(scope) });
}

/** Adds languages that were skipped for time to one recent published story. Used when the queue is idle. */
export async function fillMissingTranslations() {
  await connectDB();
  const a = await Article.findOne({
    status: "published", origin: "auto", publishedAt: { $gte: new Date(Date.now() - 3 * 86400e3) },
    $or: [{ "translations.ur": null }, { "translations.ar": null }, { "translations.de": null }],
  }).sort({ publishedAt: -1 }).lean();
  if (!a) return { ok: true, idle: true };
  const missing = ["ur"].filter((l) => !a.translations?.[l]);
  const results = await Promise.allSettled(missing.map((l) => translate(a.translations.en, l)));
  const set = {};
  results.forEach((r, i) => { if (r.status === "fulfilled") set[`translations.${missing[i]}`] = missing[i] === "ur" ? cleanUrduFields(r.value.data) : r.value.data; });
  if (Object.keys(set).length) await Article.updateOne({ _id: a._id }, { $set: set });
  return { ok: true, translated: Object.keys(set), slug: a.slug };
}

const pkMidnight = () => new Date(Math.floor((Date.now() + 5 * 3600e3) / 86400e3) * 86400e3 - 5 * 3600e3);

/**
 * Takes ONE story the quality check held back for fixable reasons (claims not in the sources, loaded wording,
 * a failed check), lets the AI remove those claims, checks it again and, if it passes now, translates and
 * publishes it. Each story gets one attempt; the rest stay in the review queue (archived after 48 hours).
 */
export async function repairHeld({ automatic = true } = {}) {
  await connectDB();
  const a = await Article.findOneAndUpdate(
    {
      origin: "auto", status: "pending_review", "quality.repairTried": { $ne: true },
      createdAt: { $gte: new Date(Date.now() - 36 * 3600e3) },
      $or: [{ "quality.score": { $gte: MIN_SCORE } }, { "quality.flags": "reviewFailed" }],
      "quality.flags": { $not: { $elemMatch: { $nin: FIXABLE_FLAGS } } },
    },
    { $set: { "quality.repairTried": true } },
    { sort: { createdAt: -1 }, new: true },
  ).lean();
  if (!a) return { ok: true, idle: true };

  const items = await SourceItem.find({ url: { $in: (a.sources || []).map((s) => s.url) } }).limit(4).lean();
  const { text: sourceMaterial, chars } = await fullText(items.length ? items : (a.sources || []).map((s) => ({ ...s, sourceName: s.name, title: "" })));
  let master = { ...a.translations.en };
  const before = a.quality || {};
  if (!(before.flags || []).includes("reviewFailed")) master = await revise(master, sourceMaterial, before);
  const r = await review(master, sourceMaterial);
  const publishedToday = await Article.countDocuments({ origin: "auto", status: "published", publishedAt: { $gte: pkMidnight() } });
  const hotA = isPriority({ title: a.translations?.en?.title, snippet: a.translations?.en?.summary });
  const d = decide(r, { chars: Math.max(chars, before.sourceChars || 0), minChars: hotA ? 100 : 300, publishedToday: hotA ? 0 : publishedToday });
  const quality = { ...before, ...r, decision: d.why, repairTried: true, repaired: true, before: { score: before.score, unsupported: before.unsupported, flags: before.flags }, checkedAt: new Date() };
  const mode = process.env.AUTO_PUBLISH;
  const live = d.publish && (!automatic || mode !== "off");

  const set = { quality, "translations.en": { ...a.translations.en, title: master.title, summary: master.summary, body: master.body, metaDescription: master.metaDescription } };
  if (live) {
    const langs = ["ur"];
    const res = await Promise.allSettled(langs.map((l) => translate(master, l)));
    res.forEach((x, i) => { if (x.status === "fulfilled") set[`translations.${langs[i]}`] = langs[i] === "ur" ? cleanUrduFields(x.value.data) : x.value.data; });
    if (!set["translations.ur"]) return save(false); // never publish on the Urdu site without Urdu
    set.status = "published"; set.publishedAt = new Date();
  }
  return save(live);

  async function save(pub) {
    if (!pub) { delete set.status; delete set.publishedAt; }
    await Article.updateOne({ _id: a._id }, { $set: set });
    return { ok: true, repaired: true, published: pub, title: master.title, quality: { score: r.score, decision: d.why, before: before.score } };
  }
}

/** Recent stories still showing the plain section banner get a free licensed photo (a few per call). */
export async function backfillPhotos(limit = 3) {
  await connectDB();
  // Wikimedia refuses 1600 px thumbnails: stories saved with them go back to the standard 1280 px size
  await Article.updateMany({ "image.url": /\/1600px-/ }, [{ $set: {
    "image.url": { $replaceAll: { input: "$image.url", find: "/1600px-", replacement: "/1280px-" } },
    "image.thumb": { $replaceAll: { input: { $ifNull: ["$image.thumb", ""] }, find: "/1600px-", replacement: "/1280px-" } },
  } }], { updatePipeline: true }).catch(() => {}); // Mongoose 9 wants pipeline updates named explicitly
  const list = await Article.find({
    origin: "auto", status: { $in: ["published", "pending_review"] }, "image.provider": "local",
    "image.searchedAt": { $exists: false }, createdAt: { $gte: new Date(Date.now() - 7 * 86400e3) },
  }, { tags: 1, category: 1, visual: 1, "translations.en.title": 1 }).sort({ createdAt: -1 }).limit(limit).lean();
  let found = 0;
  for (const a of list) {
    // a person from the library named in the tags or the story's picture plan
    try {
      const [lp] = await findPeople([...(a.visual?.people || []), ...(a.tags || [])]);
      const li = lp && libraryImage(lp);
      if (li) { await Article.updateOne({ _id: a._id }, { $set: { image: { ...li, searchedAt: new Date() } } }); found++; continue; }
    } catch {}
    const tags = (a.tags || []).filter((t) => !/news|pakistan|breaking/i.test(t)).slice(0, 2).join(" ");
    const query = tags || String(a.translations?.en?.title || "").split(/\s+/).slice(0, 4).join(" ");
    const img = await findFreePhoto(query, a.category);
    await Article.updateOne({ _id: a._id }, img ? { $set: { image: { ...img, searchedAt: new Date() } } } : { $set: { "image.searchedAt": new Date() } });
    if (img) found++;
  }
  return { checked: list.length, found };
}
