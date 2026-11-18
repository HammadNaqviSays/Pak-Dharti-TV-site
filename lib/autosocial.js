// Automatic Facebook + Instagram posting for new stories, run at the end of the story cron (about every 20 minutes).
// OFF until switched on in Mission Control (or SOCIAL_AUTO=true). Uses the story's own licensed photo (no card), one post per page per 20 minutes,
// at most SOCIAL_MAX_PER_DAY (default 50) per page per Pakistan day. Each story is posted once per page.
import { connectDB } from "./db";
import { Article, Media, Setting } from "@/models";
import { buildCaptions, cardHook } from "./caption";
import { drainQueue } from "./socialQueue";
import { SocialQueue } from "@/models";
import { socialPages, postFacebook, postInstagram, igAlreadyHas } from "./social";
import { renderNewsCard } from "./serverNews";
import { cleanUrdu } from "./urdu";
import { resolveVisual } from "./visual";
import { saneCategory } from "./categoryFix";
import { DICT } from "./i18n";
import { keywords, overlap } from "./dedupe";
import { getCardLook } from "./cardLook";

const FRESH_HOURS = 6;
const OK_PROVIDERS = ["unsplash", "wikimedia", "own", "local"];
const MAX_BYTES = 8 * 1024 * 1024;

/** Width/height of a JPEG from its bytes (null if not a readable JPEG). */
export function jpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Settings from Mission Control (Setting "social:config"), falling back to env vars. */
export async function socialConfig() {
  const c = (await Setting.findOne({ key: "social:config" }).lean())?.value || {};
  const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
  // Emergency brake: while SOCIAL_PAUSED is not "false", nothing is posted automatically (news, rate cards, day counts), whatever Mission Control says.
  const paused = process.env.SOCIAL_PAUSED !== "false";
  return {
    paused,
    auto: paused ? false : typeof c.auto === "boolean" ? c.auto : process.env.SOCIAL_AUTO === "true",
    maxPerDay: clamp(c.maxPerDay ?? process.env.SOCIAL_MAX_PER_DAY, 1, 100, 50),
    fromHour: clamp(c.fromHour, 0, 23, 6),   // Pakistan time: post only from this hour…
    toHour: clamp(c.toHour, 1, 24, 23),      // …until this hour (night = quiet)
    gapMin: clamp(c.gapMin, 10, 120, 20),
  };
}

const pkDay = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

async function fetchImage(url, base) {
  const abs = url.startsWith("/") ? base + url : url;
  const r = await fetch(abs, { signal: AbortSignal.timeout(9000), headers: { "user-agent": "PakDhartiTV-social/1.0" } });
  if (!r.ok) throw new Error(`photo ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) throw new Error("photo size");
  return buf;
}

/** The Pak Dharti news card for a story, built like the "collage" card of /admin: people (cut-outs), flags and a place photo;
 *  else the story's own photo; else the maroon stage with the channel logo. */
export async function cardForArticle(a, lang, base, look = null, { avoidKind = [] } = {}) {
  let collage = null, photo = null, credits = [], kind = "plain";
  try {
    const v = await Promise.race([resolveVisual(a), new Promise((_, rej) => setTimeout(() => rej(new Error("visual timeout")), 25000))]);
    const soft = (p) => fetchImage(p, base).catch(() => null);
    const [scene, flags, people] = await Promise.all([
      v.scene?.url ? soft(v.scene.url) : null,
      Promise.all((v.flags || []).slice(0, 4).map(soft)),
      Promise.all((v.people || []).slice(0, 3).map(async (p) => {
        const cut = p.cutout ? await soft(p.cutout) : null;
        const buf = cut || (p.photo ? await soft(p.photo) : null);
        return buf ? { buf, cut: !!cut, name: lang === "ur" ? p.nameUr || p.name : p.name, credit: p.credit } : null;
      })),
    ]);
    let ppl = people.filter(Boolean);
    const fl = flags.filter(Boolean);
    // a web stock photo (a random stadium, a hospital corridor) never goes beside a person: it only misleads. Curated place photos are fine.
    let sc = scene, sceneShare = 0;
    if (ppl.length && !v.scene?.curated) sc = null;
    const lk = look || (await getCardLook()) || {}, pick = lk.pick || "auto", cap = lk.maxPics || 2;
    if (pick === "auto" && v.joint?.url && ppl.length >= 2) {
      // a real photo of the two together beats two separate portraits
      const jb = await soft(v.joint.url);
      if (jb) { ppl = [{ buf: jb, cut: false, name: ppl.slice(0, 2).map((x) => x.name).join(" • "), credit: v.joint.credit }]; sc = null; }
    } else if (pick === "main") ppl = ppl.slice(0, 1);
    else if (pick === "event" && sc) { ppl = ppl.slice(0, 1); sceneShare = 0.62; }
    // a second story on the same event must not look like the first card: use the other kind of picture when there is one
    if (avoidKind.includes("people") && sc && ppl.length) ppl = [];
    else if (avoidKind.includes("scene") && ppl.length && sc) sc = null;
    ppl = ppl.slice(0, cap);   // never more people on one card than the editor allowed
    if (sc || fl.length || ppl.length) {
      kind = ppl.length ? "people" : sc ? "scene" : "flags";
      collage = { scene: sc, flags: fl, people: ppl, sceneShare };
      credits = [sc && v.scene?.credit, ...ppl.map((p) => p.credit)].filter(Boolean);
    }
  } catch { collage = null; }
  if (!collage) {
    const own = ["own", "link"].includes(a.image?.provider);
    if (a.image?.url && own) { try { photo = await fetchImage(a.image.url, base); credits = [a.image.credit].filter(Boolean); } catch { photo = null; } }
  }
  let rawTitle = a.translations?.[lang]?.title || "";
  try {
    const lk2 = look || (await getCardLook()) || {};
    if (lk2.headline !== "news") {
      const h = await cardHook(a, lang);
      if (h) {
        rawTitle = h;
        if (!a.social?.[lang]?.cardHook) await Article.updateOne({ _id: a._id }, { $set: { [`social.${lang}.cardHook`]: h } });
      }
    }
  } catch { /* the story's own headline stays */ }
  const card = await renderNewsCard({ lang, title: lang === "ur" ? cleanUrdu(rawTitle) : rawTitle, category: DICT[lang]?.cats?.[saneCategory(a.category, a.translations?.en?.title, a.translations?.en?.summary)] || "", photo, collage, origin: base, look });
  return { card, kind, credit: [...new Set(credits)].join(" · ") };
}

export async function autoPost(opts = {}) {
  const pages = socialPages();
  await connectDB();
  // hand-made posts that were waiting for their time go first (oldest first), whatever the automatic switch says
  let queued = [];
  try { queued = await drainQueue(); } catch { /* the automatic posting goes on */ }
  const cfg = await socialConfig();
  if (!cfg.auto) return { idle: true, reason: "off" };
  if (!pages.length) return { idle: true, reason: "no pages" };
  const hourPk = new Date(Date.now() + 5 * 3600e3).getUTCHours();
  if (hourPk < cfg.fromHour || hourPk >= cfg.toHour) return { idle: true, reason: "quiet hours" };
  const base = (process.env.SITE_URL || "https://pakdhartitv.com").replace(/\/$/, "");
  const maxDay = cfg.maxPerDay, GAP_MS = cfg.gapMin * 60 * 1000;
  const cats = (process.env.SOCIAL_CATEGORIES || "").split(",").map((c) => c.trim()).filter(Boolean);
  const out = [];
  for (const page of pages) {
    const lang = page.lang;
    const lockKey = `social:lock:${lang}`; let locked = false;
    try {
      // one posting run at a time per page: a second overlapping run (cron + manual, two crons) waits for the next turn
      try { await Setting.findOneAndUpdate({ key: lockKey, $or: [{ value: { $lt: Date.now() - 240000 } }, { value: { $exists: false } }] }, { key: lockKey, value: Date.now() }, { upsert: true }); locked = true; }
      catch { out.push({ lang, idle: "another run is posting" }); continue; }
      // Facebook has it but Instagram does not: send it to Instagram only (never to Facebook again), up to 5 tries, up to 3 stories per run
      if (page.igUserId) {
        const t0 = Date.now();
        for (let q = 0; q < 3 && Date.now() - t0 < 30000; q++) {
          const pend = await Article.findOneAndUpdate(
            { [`social.${lang}.igPending`]: true, [`social.${lang}.at`]: { $gte: new Date(Date.now() - 48 * 3600e3) }, [`social.${lang}.igTries`]: { $not: { $gte: 5 } } },
            { $inc: { [`social.${lang}.igTries`]: 1 } }, { projection: { slug: 1, social: 1 } });
          if (!pend) break;
          const sc = pend.social?.[lang];
          if (!(sc?.card && sc?.igCaption)) { await Article.updateOne({ _id: pend._id }, { $set: { [`social.${lang}.igPending`]: false } }); continue; }
          try {
            if (await igAlreadyHas(page, sc.igCaption)) { await Article.updateOne({ _id: pend._id }, { $set: { [`social.${lang}.ig`]: sc.ig || "exists", [`social.${lang}.igPending`]: false, [`social.${lang}.igError`]: "" } }); out.push({ lang, slug: pend.slug, igAlreadyThere: true }); continue; }
            const r = await postInstagram(page, { imageUrl: `${base}/api/media/${sc.card}`, caption: sc.igCaption });
            await Article.updateOne({ _id: pend._id }, { $set: { [`social.${lang}.ig`]: r.mediaId || null, [`social.${lang}.igPending`]: false, [`social.${lang}.igError`]: "" } });
            out.push({ lang, slug: pend.slug, igCatchUp: r.mediaId });
          } catch (e) {
            const m = String(e.message).slice(0, 200);
            await Article.updateOne({ _id: pend._id }, { $set: { [`social.${lang}.igError`]: m, [`social.${lang}.igErrAt`]: new Date() } });
            out.push({ lang, slug: pend.slug, igCatchUpError: m.slice(0, 120) });
          }
        }
      }
      // Instagram has it but Facebook does not (Instagram went through first): send it to Facebook only, at most 3 tries
      {
        const pendF = await Article.findOneAndUpdate(
          { [`social.${lang}.fbPending`]: true, [`social.${lang}.at`]: { $gte: new Date(Date.now() - 24 * 3600e3) }, [`social.${lang}.fbTries`]: { $not: { $gte: 3 } } },
          { $inc: { [`social.${lang}.fbTries`]: 1 } }, { projection: { slug: 1, social: 1 } });
        const sf = pendF?.social?.[lang];
        if (sf?.card && sf?.fbText) {
          try {
            const r = await postFacebook(page, { imageUrl: `${base}/api/media/${sf.card}`, text: sf.fbText, comment: sf.fbComment });
            await Article.updateOne({ _id: pendF._id }, { $set: { [`social.${lang}.fb`]: r.postId || "auto", [`social.${lang}.fbPending`]: false } });
            out.push({ lang, slug: pendF.slug, fbCatchUp: r.postId });
          } catch (e) { out.push({ lang, slug: pendF.slug, fbCatchUpError: String(e.message).slice(0, 120) }); }
        }
      }
      // Safety net: on Facebook for more than 10 minutes but never reached Instagram (and not already waiting for a catch-up):
      // draw a fresh card and send it to Instagram only. One story per run, 2 tries at most, last 24 hours only.
      if (page.igUserId && !out.some((o) => o.lang === lang && (o.igCatchUp || o.fbCatchUp))) {
        const gap = await Article.findOneAndUpdate(
          { [`social.${lang}.fb`]: { $nin: [null, ""] }, [`social.${lang}.ig`]: { $in: [null, ""] }, [`social.${lang}.igPending`]: { $ne: true },
            [`social.${lang}.igSweep`]: { $not: { $gte: 3 } },
            [`social.${lang}.at`]: { $gte: new Date(Date.now() - 48 * 3600e3), $lte: new Date(Date.now() - 10 * 60e3) } },
          { $inc: { [`social.${lang}.igSweep`]: 1 } },
          { projection: { slug: 1, translations: 1, sources: 1, image: 1, category: 1, visual: 1 } });
        if (gap) {
          try {
            const { card: gc, credit: gcr } = await cardForArticle(gap, lang, base);
            const gm = await Media.create({ data: gc, type: "image/jpeg", size: gc.length, credit: `Auto social card ${gap.slug} (Instagram catch-up)` });
            const gcap = await buildCaptions(gap, lang);
            if (await igAlreadyHas(page, gcap.instagram)) { await Article.updateOne({ _id: gap._id }, { $set: { [`social.${lang}.ig`]: "exists" } }); out.push({ lang, slug: gap.slug, igAlreadyThere: true }); throw new Error("already on Instagram"); }
            const r = await postInstagram(page, { imageUrl: `${base}/api/media/${gm._id}`, caption: gcap.instagram + (gcr ? `\n\n📷 ${gcr}` : "") });
            await Article.updateOne({ _id: gap._id }, { $set: { [`social.${lang}.ig`]: r.mediaId || "auto" } });
            out.push({ lang, slug: gap.slug, igCatchUp: r.mediaId, safetyNet: true });
          } catch (e) { if (e.message !== "already on Instagram") { await Article.updateOne({ _id: gap._id }, { $set: { [`social.${lang}.igError`]: String(e.message).slice(0, 200), [`social.${lang}.igErrAt`]: new Date() } }); out.push({ lang, slug: gap.slug, igCatchUpError: String(e.message).slice(0, 120) }); } }
        }
      }
      if (await SocialQueue.exists({ lang, status: { $in: ["queued", "posting"] } })) { out.push({ lang, idle: "hand-made posts are waiting" }); continue; }
      const last = await Setting.findOne({ key: `social:last:${lang}` }).lean();
      if (!opts.burst && last?.value && Date.now() - Number(last.value) < GAP_MS) { out.push({ lang, idle: "gap" }); continue; }
      const dayKey = `social:day:${lang}:${pkDay()}`;
      const day = await Setting.findOne({ key: dayKey }).lean();
      if (Number(day?.value || 0) >= maxDay) { out.push({ lang, idle: "daily limit" }); continue; }

      const base0 = {
        status: "published", origin: "auto", contentType: "news",
        [`translations.${lang}.title`]: { $exists: true, $ne: "" },
        [`social.${lang}.done`]: { $ne: true }, [`social.${lang}.tries`]: { $not: { $gte: 2 } },
      };
      if (cats.length) base0.category = { $in: cats };
      // fresh stories first; then older ones the editor asked to send again (their first post was not seen by anyone)
      const pick = (q) => Article.findOne(q).sort({ "placement.priority": -1, publishedAt: -1 }).select("slug translations sources image category visual").lean();
      // never post the same event twice: a candidate that matches a story already posted in the last 2 days is marked done, not posted
      const seen = (await Article.find({ [`social.${lang}.done`]: true, [`social.${lang}.at`]: { $gte: new Date(Date.now() - 48 * 3600e3) } }, { "translations.en.title": 1, "translations.en.summary": 1, social: 1 }).limit(200).lean())
        .map((x) => ({ k: keywords(`${x.translations?.en?.title || ""} ${x.translations?.en?.summary || ""}`), hook: x.social?.[lang]?.hook || "", kind: x.social?.[lang]?.cardKind || "" }));
      let a = null, aK = null; const skip = [];
      for (let t = 0; t < 8 && !a; t++) {
        const nin = skip.length ? { _id: { $nin: skip } } : {};
        const c = (await pick({ ...base0, ...nin, publishedAt: { $gte: new Date(Date.now() - FRESH_HOURS * 3600e3) } })) || (await pick({ ...base0, ...nin, [`social.${lang}.again`]: true }));
        if (!c) break;
        const k = keywords(`${c.translations?.en?.title || ""} ${c.translations?.en?.summary || ""}`);
        if (k.size && seen.some((sk) => overlap(k, sk.k) >= 0.5)) {
          skip.push(c._id);
          await Article.updateOne({ _id: c._id }, { $set: { [`social.${lang}.done`]: true, [`social.${lang}.again`]: false, [`social.${lang}.skipped`]: "same story already posted" } });
          out.push({ lang, slug: c.slug, skipped: "same story already posted" });
          continue;
        }
        a = c; aK = k;
      }
      if (!a) { out.push({ lang, idle: "nothing new" }); continue; }
      await Article.updateOne({ _id: a._id }, { $inc: { [`social.${lang}.tries`]: 1 } });
      // claim the story before posting: a run that crashes or times out after Facebook accepted the post must never post it a second time
      const claimed = await Article.findOneAndUpdate(
        { _id: a._id, $or: [{ [`social.${lang}.claimAt`]: { $exists: false } }, { [`social.${lang}.claimAt`]: { $lt: new Date(Date.now() - 30 * 60e3) } }] },
        { $set: { [`social.${lang}.claimAt`]: new Date() } });
      if (!claimed) { out.push({ lang, slug: a.slug, idle: "another run has this story" }); continue; }
      // a story on the same event as one already posted gets another angle in the text and another kind of picture
      const related = aK ? seen.filter((sk) => overlap(aK, sk.k) >= 0.3) : [];

      // Every story gets a proper Pak Dharti card. The photo on it is used only when it really belongs to the story
      // (one the editor supplied, or a library photo of a person the story names); otherwise the channel-frame card is drawn.
      const { card, kind, credit: cr } = await cardForArticle(a, lang, base, null, { avoidKind: related.map((r) => r.kind).filter(Boolean) });
      const m = await Media.create({ data: card, type: "image/jpeg", size: card.length, credit: `Auto social card ${a.slug}` });
      const imageUrl = `${base}/api/media/${m._id}`;
      const wantFb = true, wantIg = !!page.igUserId, isJpeg = true;
      const cap = await buildCaptions(a, lang, { avoid: related.map((r) => r.hook).filter(Boolean).slice(0, 3) });
      const credit = cr ? `\n\n📷 ${cr}` : "";
      const res = { lang, slug: a.slug, fb: null, ig: null };
      try { res.fb = await postFacebook(page, { imageUrl, text: cap.facebook + credit, comment: cap.facebookComment }); }
      catch (e) { res.fb = { error: String(e.message).slice(0, 160) }; }
      const fbOk = !!(res.fb && !res.fb.error);
      if (fbOk) {
        // written the moment Facebook accepts it, before the slower Instagram step
        await Article.updateOne({ _id: a._id }, { $set: { [`social.${lang}.again`]: false, [`social.${lang}.done`]: true, [`social.${lang}.at`]: new Date(), [`social.${lang}.fb`]: res.fb?.postId || null, [`social.${lang}.hook`]: cap.hook || "", [`social.${lang}.style`]: cap.style || "", [`social.${lang}.cardKind`]: kind || "", [`social.${lang}.commentError`]: res.fb?.commentError || "", ...(wantIg ? { [`social.${lang}.igPending`]: true, [`social.${lang}.card`]: String(m._id), [`social.${lang}.igCaption`]: cap.instagram + credit } : {}) } });
        await Setting.findOneAndUpdate({ key: `social:last:${lang}` }, { key: `social:last:${lang}`, value: String(Date.now()) }, { upsert: true });
        await Setting.findOneAndUpdate({ key: dayKey }, { $inc: { value: 1 } }, { upsert: true });
      }
      if (wantIg && isJpeg) {
        try { res.ig = await postInstagram(page, { imageUrl, caption: cap.instagram + credit }); }
        catch (e) { res.ig = { error: String(e.message).slice(0, 160) }; }
      } else res.ig = { skipped: "no instagram" };
      const igOk = !!(res.ig && !res.ig.error && !res.ig.skipped);
      if (igOk) {
        await Article.updateOne({ _id: a._id }, { $set: { [`social.${lang}.ig`]: res.ig.mediaId || null, [`social.${lang}.igPending`]: false, [`social.${lang}.igError`]: "", [`social.${lang}.done`]: true, [`social.${lang}.at`]: new Date(), [`social.${lang}.hook`]: cap.hook || "", [`social.${lang}.style`]: cap.style || "", [`social.${lang}.cardKind`]: kind || "" } });
        if (!fbOk) {
          await Setting.findOneAndUpdate({ key: `social:last:${lang}` }, { key: `social:last:${lang}`, value: String(Date.now()) }, { upsert: true });
          await Setting.findOneAndUpdate({ key: dayKey }, { $inc: { value: 1 } }, { upsert: true });
          // on Instagram but not on Facebook: remember the card and text so a later run can send it to Facebook alone
          await Article.updateOne({ _id: a._id }, { $set: { [`social.${lang}.fbPending`]: true, [`social.${lang}.card`]: String(m._id), [`social.${lang}.fbText`]: cap.facebook + credit, [`social.${lang}.fbComment`]: cap.facebookComment || "" } });
        }
      }
      // on Facebook but not on Instagram: remember the card and text so a later run can send it to Instagram alone
      if (fbOk && wantIg && !igOk) await Article.updateOne({ _id: a._id }, { $set: { [`social.${lang}.igPending`]: true, [`social.${lang}.card`]: String(m._id), [`social.${lang}.igCaption`]: cap.instagram + credit, [`social.${lang}.igError`]: res.ig?.error || "", [`social.${lang}.igErrAt`]: new Date() } });
      // nothing went out: free the story so the next run can try again
      if (!fbOk && !igOk) await Article.updateOne({ _id: a._id }, { $unset: { [`social.${lang}.claimAt`]: "" } });
      out.push(res);
    } catch (e) { out.push({ lang, error: String(e.message).slice(0, 160) }); }
    finally { if (locked) { try { await Setting.updateOne({ key: lockKey }, { value: 0 }); } catch { /* the lock expires by itself after 4 minutes */ } } }
  }
  return { results: out };
}
