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
if (process.env.PUBLISH === "1") { fields.status = "published"; fields.publishedAt = existing?.publishedAt || new Date(); }
let a;
if (existing) { Object.assign(existing, fields); a = await existing.save(); }
else a = await Article.create({ slug: d.slug, origin: "manual", status: "draft", placement: { slot: "standard", priority: 60 }, ...fields });
console.log(`::notice title=guest draft::id=${a._id} status=${a.status} slug=${a.slug}`);
await mongoose.disconnect();
