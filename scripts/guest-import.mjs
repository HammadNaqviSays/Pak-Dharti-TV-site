// One-off: puts a guest article (data/guest/<name>.json + author.jpg + article.jpg next to it) into the database as a DRAFT.
// Run from the "guest-import" workflow. Safe to run again: an article with the same slug is updated, not duplicated.
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Article, Media } from "../models/index.js";

const file = process.argv[2];
if (!file) throw new Error("give the json file");
const dir = path.dirname(file);
const d = JSON.parse(fs.readFileSync(file, "utf8"));
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });

const existing = await Article.findOne({ slug: d.slug });
const mediaUrl = async (name, credit) => {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return "";
  const buf = fs.readFileSync(p);
  const m = await Media.create({ data: buf, type: "image/jpeg", size: buf.length, credit });
  return `/api/media/${m._id}`;
};
// LINKS_ONLY=1: set just the writer's website / Instagram / Facebook links on the saved article
if (process.env.LINKS_ONLY === "1") {
  if (!existing) throw new Error("no article with this slug yet");
  if (!d.author?.links) throw new Error("no author.links in the json");
  await Article.updateOne({ _id: existing._id }, { $set: { "author.links": d.author.links } });
  console.log(`::notice title=guest links::slug=${d.slug} links=${Object.keys(d.author.links).join(",")}`);
  await mongoose.disconnect();
  process.exit(0);
}
// SCHEDULE_AT=<ISO time, e.g. 2026-11-20T04:00:00Z>: keep the saved article a draft and let the site publish it then ("none" clears the schedule)
if (process.env.SCHEDULE_AT) {
  if (!existing) throw new Error("no article with this slug yet");
  if (existing.status === "published") throw new Error("already published");
  const v = process.env.SCHEDULE_AT === "none" ? null : new Date(process.env.SCHEDULE_AT);
  if (v && (isNaN(v) || v.getTime() < Date.now())) throw new Error("bad or past time");
  await Article.updateOne({ _id: existing._id }, v ? { $set: { scheduledAt: v, autoSocial: true } } : { $unset: { scheduledAt: 1 } });
  console.log(`::notice title=guest schedule::slug=${d.slug} at=${v ? v.toISOString() : "cleared"}`);
  await mongoose.disconnect();
  process.exit(0);
}
// PHOTO_ONLY=1: swap just the writer's profile photo (author.jpg) on the saved article
if (process.env.PHOTO_ONLY === "1") {
  if (!existing) throw new Error("no article with this slug yet");
  const u = await mediaUrl("author.jpg", `Writer photo: ${d.author.name}`);
  if (!u) throw new Error("author.jpg not found");
  await Article.updateOne({ _id: existing._id }, { $set: { "author.photo": u } });
  console.log(`::notice title=guest photo::slug=${d.slug} photo=${u}`);
  await mongoose.disconnect();
  process.exit(0);
}
// IMAGE_ONLY=1: swap just the article picture on the already-saved article (text, author and status stay exactly as they are)
if (process.env.IMAGE_ONLY === "1") {
  if (!existing) throw new Error("no article with this slug yet");
  const u = await mediaUrl("article.jpg", `Article picture: ${d.slug}`);
  if (!u) throw new Error("article.jpg not found");
  await Article.updateOne({ _id: existing._id }, { $set: { "image.url": u, "image.thumb": u, ...(d.image?.credit ? { "image.credit": d.image.credit } : {}), ...(d.image?.alt ? { "image.alt": d.image.alt } : {}) } });
  console.log(`::notice title=guest picture::slug=${d.slug} image=${u}`);
  await mongoose.disconnect();
  process.exit(0);
}
const photo = existing?.author?.photo || await mediaUrl("author.jpg", `Writer photo: ${d.author.name}`);
const imgUrl = existing?.image?.url || await mediaUrl("article.jpg", `Article picture: ${d.slug}`);
const plain = (b) => b.replace(/[#*_>\[\]()`]/g, " ").replace(/\s+/g, " ").trim();
const translations = {};
for (const [l, t] of Object.entries(d.translations)) translations[l] = { ...t, metaDescription: (t.summary || plain(t.body)).slice(0, 155) };
const fields = {
  contentType: d.contentType, category: d.category, translations, tags: d.tags,
  image: imgUrl ? { url: imgUrl, thumb: imgUrl, alt: d.image?.alt || "", credit: d.image?.credit || "", provider: "own" } : undefined,
  author: { ...d.author, photo }, ...(d.sources ? { sources: d.sources } : {}),
  disclosure: { aiGenerated: false, humanReviewed: true, reviewedBy: d.author.name },
};
if (process.env.PUBLISH === "1") { fields.status = "published"; fields.publishedAt = existing?.publishedAt || new Date(); fields.autoSocial = true; }
if (d.socialTags) fields.socialTags = d.socialTags;
let a;
if (existing) { Object.assign(existing, fields); a = await existing.save(); }
else a = await Article.create({ slug: d.slug, origin: "manual", status: "draft", placement: { slot: "standard", priority: 60 }, ...fields });
if (process.env.PUBLISH === "1") await Article.updateOne({ _id: a._id }, { $unset: { scheduledAt: 1 } });
// hand-made social cards (card-en.jpg / card-ur.jpg next to the json): posted as they are by the automatic posting
for (const l of ["en", "ur"]) {
  const u = await mediaUrl(`card-${l}.jpg`, `Social card ${l}: ${d.slug}`);
  if (u) await Article.updateOne({ _id: a._id }, { $set: { [`social.${l}.customCard`]: u.split("/").pop() } });
}
console.log(`::notice title=guest draft::id=${a._id} status=${a.status} slug=${a.slug}`);
await mongoose.disconnect();
