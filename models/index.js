import mongoose from "mongoose";
const { Schema } = mongoose;

// Arabic and German were switched off in October 2026 (old ar/de texts stay in the database; /ar and /de redirect)
export const LANGS = ["en", "ur"];
export const RTL_LANGS = ["ur", "ar"];
export const CATEGORIES = [
  "world", "pakistan", "politics", "economy", "sports", "disaster",
  "entertainment", "inspirational", "folklore", "religion",
  "poetry", "quotes", "books",
];
export const CONTENT_TYPES = ["news", "feature", "opinion", "story"];
export const SLOTS = ["breaking", "featured", "top", "standard"];

/* ---------- One language version of an article ---------- */
const Localized = new Schema(
  {
    title: { type: String, required: true },
    summary: String,
    body: { type: String, required: true }, // Markdown
    metaDescription: String,
  },
  { _id: false }
);

/* ---------- ARTICLE: shared by automated + manual pipelines ---------- */
const ArticleSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true }, // /{lang}/news/{slug}
    origin: { type: String, enum: ["auto", "manual"], required: true, index: true },
    contentType: { type: String, enum: CONTENT_TYPES, default: "news" }, // shown as a badge on the site
    category: { type: String, enum: CATEGORIES, required: true, index: true },

    translations: {
      en: { type: Localized, required: true },
      ur: Localized,
      ar: Localized,
      de: Localized,
    },
    tags: [String],
    faq: Schema.Types.Mixed, // { v, at, en:[{q,a}], ur:[...], roman:[...], keywords:{en:[],ur:[]} } quick answers for search and AI answer engines
    visual: { people: [String], countries: [String], orgs: [String], scene: String }, // for the card designs (people library, flags)

    image: {
      url: String, thumb: String, alt: String,
      credit: String, creditUrl: String, license: String,
      provider: String, // unsplash | wikimedia | own | link | local
      searchedAt: Date, // when "find photos" last looked for this story
      focusX: Number, focusY: Number, focusDone: Boolean, focusTries: Number, // where the face is (percent), found by lib/faceFocus.js
    },

    sources: [{ _id: false, name: String, url: String, publishedAt: Date }],
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign" }, // set for manual injections
    clusterKey: { type: String, index: true }, // de-duplication of the same story

    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "rejected", "archived"],
      default: "pending_review",
      index: true,
    },
    placement: {
      slot: { type: String, enum: SLOTS, default: "standard" },
      priority: { type: Number, default: 0 }, // higher = closer to the top
      pinnedUntil: Date, // after this, falls back to normal chronological order
    },

    quality: { type: Schema.Types.Mixed }, // { score, flags, unsupported, reason, decision, sourceChars, checkedAt }
    disclosure: {
      aiGenerated: { type: Boolean, default: true },
      humanReviewed: { type: Boolean, default: false },
      reviewedBy: String,
    },
    ai: { model: String, promptVersion: String, inputTokens: Number, outputTokens: Number },
    author: Schema.Types.Mixed, // guest / columnist: { name, nameUr, role, roleUr, bio, bioUr, photo, photoCredit, url }

    stats: {
      views: { type: Number, default: 0 },
      byLang: { en: { type: Number, default: 0 }, ur: { type: Number, default: 0 },
                ar: { type: Number, default: 0 }, de: { type: Number, default: 0 } },
    },

    reel: Schema.Types.Mixed, // { id, at (script made), doneAt (video finished), dlAt (downloaded) } stays even if the reel is deleted
    social: Schema.Types.Mixed, // { ur: { done, at, fb, ig, tries }, en: {...} } automatic Facebook/Instagram posting

    publishedAt: Date,
    socialTags: Schema.Types.Mixed, // { en: [..], ur: [..] } hand-picked hashtags for the automatic posts
    autoSocial: Boolean, // a hand-made column that the automatic Facebook / Instagram posting may send when it is published
    scheduledAt: { type: Date, index: true }, // a draft with this set is published by the cron when the time comes
  },
  { timestamps: true }
);

// Homepage query: published items, by slot, then priority, then recency
ArticleSchema.index({ status: 1, "placement.slot": 1, "placement.priority": -1, publishedAt: -1 });
ArticleSchema.index({ status: 1, category: 1, publishedAt: -1 });
// the homepage, ticker and most-read lists sort every published story by date: without this the database scans them all
ArticleSchema.index({ status: 1, publishedAt: -1 });

/* ---------- CAMPAIGN: each "Narrative Force Injector" submission ---------- */
const CampaignSchema = new Schema(
  {
    brief: { type: String, required: true, maxlength: 2000 }, // admin's angle/topic
    headline: String,
    sourceMaterial: { type: String, maxlength: 8000 }, // optional facts the admin pastes in
    category: { type: String, enum: CATEGORIES },
    contentType: { type: String, enum: CONTENT_TYPES },
    requestedSlot: { type: String, enum: SLOTS },
    publishMode: { type: String, enum: ["review", "instant"], default: "review" },
    status: {
      type: String,
      enum: ["queued", "generating", "ready", "published", "failed"],
      default: "queued",
      index: true,
    },
    article: { type: Schema.Types.ObjectId, ref: "Article" },
    failedLangs: [String],
    error: String,
    createdBy: String,
  },
  { timestamps: true }
);

/* ---------- SOURCE ITEM: raw RSS items for the automated engine ---------- */
const SourceItemSchema = new Schema({
  url: { type: String, required: true, unique: true },
  feed: String,
  sourceName: String,
  category: { type: String, enum: CATEGORIES },
  title: String,
  snippet: String,
  publishedAt: { type: Date, index: true },
  clusterKey: { type: String, index: true },
  state: { type: String, enum: ["new", "used", "skipped"], default: "new", index: true },
  fetchedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // TTL 7 days, keeps M0 small
});

/* ---------- DAILY STAT: one row per article per language per day (analytics) ---------- */
const DailyStatSchema = new Schema({
  day: { type: String, required: true },        // "2026-10-06" (UTC)
  article: { type: Schema.Types.ObjectId, ref: "Article", required: true },
  lang: { type: String, enum: LANGS, required: true },
  category: String,
  origin: String,
  views: { type: Number, default: 0 },
});
DailyStatSchema.index({ day: 1, article: 1, lang: 1 }, { unique: true });

/* ---------- TRAFFIC: anonymous counters per day and dimension (see /api/hit, /admin/traffic) ---------- */
const TrafficSchema = new Schema({
  day: { type: String, required: true },   // "2026-11-05" in Pakistan time
  dim: { type: String, required: true },   // total | hour | page | lang | src | refhost | country | region | city | device | os | mode | category | story | story-src | story-geo
  key: { type: String, required: true },   // e.g. "facebook", "PK", "PK-PB", "some-story-slug|google"
  views: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 },  // visits that started here (first page of a browser session)
});
TrafficSchema.index({ day: 1, dim: 1, key: 1 }, { unique: true });
TrafficSchema.index({ dim: 1, key: 1, day: 1 });

/* ---------- MEDIA: the editor's own uploaded photos ---------- */
const MediaSchema = new Schema({
  data: { type: Buffer, required: true },
  type: { type: String, required: true },
  size: Number,
  credit: String,
}, { timestamps: true });

/* ---------- MESSAGE: contact form ---------- */
const MessageSchema = new Schema({
  name: { type: String, maxlength: 120 },
  email: { type: String, maxlength: 200 },
  subject: { type: String, maxlength: 200 },
  body: { type: String, maxlength: 5000, required: true },
  lang: String,
  read: { type: Boolean, default: false },
}, { timestamps: true });

/* ---------- SETTING: small key/value store (e.g. today's sarafa gold rate) ---------- */
const SettingSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
}, { timestamps: true });


/* ---------- PERSON: photo library of public figures (politicians, officials, international leaders) ---------- */
const PersonPhotoSchema = new Schema({
  url: String, thumb: String, width: Number, height: Number,
  license: String, credit: String, source: String,          // source = file page (Commons) or handout origin
  provider: { type: String, default: "wikimedia" },          // wikimedia | handout | own
  tags: [String],                                            // serious | smiling | speaking | portrait | ...
  cutout: { type: Schema.Types.ObjectId, ref: "PersonCutout" },
  cutoutTried: { type: Boolean, default: false },
  primary: { type: Boolean, default: false },
}, { _id: false });

const PersonSchema = new Schema({
  key: { type: String, required: true, unique: true },       // wikidata id, or a slug of the English name
  qid: { type: String, index: true },
  name: { type: String, required: true }, nameUr: String,
  aliases: { type: [String], index: true },                  // lower-case English + Urdu spellings for matching
  role: String, roleUr: String, party: String, constituency: String, description: String, wiki: String,
  groups: { type: [String], index: true },                   // mna | senator | mpa-punjab | cabinet | military | pti-detained | historical | international | ...
  priority: { type: Number, default: 0, index: true },
  photos: [PersonPhotoSchema],
  mentions: { type: Number, default: 0 }, lastMentionAt: Date,
  urduTried: Boolean,
}, { timestamps: true });

const PersonCutoutSchema = new Schema({
  person: { type: Schema.Types.ObjectId, ref: "Person", index: true },
  photoUrl: String, data: Buffer, blobUrl: String, type: { type: String, default: "image/webp" }, width: Number, height: Number,
}, { timestamps: true });

const ReelSchema = new Schema({
  slug: { type: String, index: true },                       // the story this reel is about
  lang: { type: String, default: "ur" },
  audioKey: String,                                          // fingerprint of the words + voice the saved voice-over was made from (same words: the voice is reused, no new quota)
  status: { type: String, default: "scripted", index: true }, // scripted → rendering → ready → approved → posted | failed | rejected
  title: String, caption: String,
  scenes: [{ _id: false, text: String, kw: String, who: String, src: String, img: String, credit: String,
    marks: [{ _id: false, i: Number, c: String }], anim: String, size: Number, edited: Boolean,
    pic: String, alt: Number, clip: String, mirror: Boolean, imgFixed: Boolean, extra: [String], extraAt: [Number] }],
  style: { font: String, stroke: String, grade: String, badge: String, noise: String, noiseAmt: String, mirror: Boolean, bgAlpha: Number },
  voice: String, voiceBlob: String, videoUrl: String, durationSec: Number, voiceSec: Number, voiceModel: String, sources: String, imageCredits: String,
  fb: String, ig: String, postedAt: Date, error: String, tries: { type: Number, default: 0 },
}, { timestamps: true });


// Job advertisements taken from official sources only. status: published | draft (needs the editor) | skipped (not a job / failed checks) | rejected
const JobSchema = new Schema({
  key: { type: String, required: true, unique: true },        // sha1 of the source page address: the same ad is never processed twice
  slug: { type: String, index: true },
  source: String, sourceName: String, sourceUrl: String, adUrl: String, applyUrl: String,
  org: { en: String, ur: String },
  title: { en: String, ur: String },
  summary: { en: String, ur: String },
  qualification: { en: String, ur: String },
  howTo: { en: String, ur: String },
  positions: String, location: String,
  lastDate: { type: Date, index: true }, lastDateText: String, evidence: String,
  verified: { type: Boolean, default: false }, issues: [String],
  status: { type: String, enum: ["published", "draft", "skipped", "rejected"], default: "draft", index: true },
  publishedAt: Date,
}, { timestamps: true });
JobSchema.index({ status: 1, lastDate: 1 });

export const Article = mongoose.models.Article || mongoose.model("Article", ArticleSchema);
export const Job = mongoose.models.Job || mongoose.model("Job", JobSchema);
export const Campaign = mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
export const SourceItem = mongoose.models.SourceItem || mongoose.model("SourceItem", SourceItemSchema);
export const DailyStat = mongoose.models.DailyStat || mongoose.model("DailyStat", DailyStatSchema);
export const Traffic = mongoose.models.Traffic || mongoose.model("Traffic", TrafficSchema);
export const Media = mongoose.models.Media || mongoose.model("Media", MediaSchema);
export const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);
const SocialQueueSchema = new Schema({
  lang: { type: String, default: "ur" }, slug: String, wantFb: Boolean, wantIg: Boolean,
  media: String, fbText: String, fbComment: String, igText: String,
  status: { type: String, enum: ["queued", "posting", "done", "failed", "cancelled"], default: "queued", index: true },
  claimAt: Date, error: String, result: Schema.Types.Mixed, postedAt: Date,
}, { timestamps: true });
export const SocialQueue = mongoose.models.SocialQueue || mongoose.model("SocialQueue", SocialQueueSchema);
export const Setting = mongoose.models.Setting || mongoose.model("Setting", SettingSchema);
export const Person = mongoose.models.Person || mongoose.model("Person", PersonSchema);
export const PersonCutout = mongoose.models.PersonCutout || mongoose.model("PersonCutout", PersonCutoutSchema);

// Reel audio/video are kept here in pieces (not in Blob, whose free limit is used up) only until the reel is posted.
const ReelFileSchema = new Schema({ reel: { type: Schema.Types.ObjectId, index: true }, kind: String, part: Number, data: Buffer });
ReelFileSchema.index({ reel: 1, kind: 1, part: 1 });
// What the editor changed in a reel (words, pictures, lines): kept as history; the script writer reads the latest ones to learn the house style
const ReelEditSchema = new Schema({
  reel: { type: Schema.Types.ObjectId, index: true }, scene: Number, kind: String, // text | picture | clip | extra | suggest | addLine | deleteLine
  before: String, after: String, note: String,
}, { timestamps: true });
export const ReelEdit = mongoose.models.ReelEdit || mongoose.model("ReelEdit", ReelEditSchema);
export const ReelFile = mongoose.models.ReelFile || mongoose.model("ReelFile", ReelFileSchema);
export const Reel = mongoose.models.Reel || mongoose.model("Reel", ReelSchema);
