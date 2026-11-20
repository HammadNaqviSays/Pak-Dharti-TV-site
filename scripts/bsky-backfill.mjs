// Marks stories that are already on Bluesky (read from the account's own public posts). Only sets social.<lang>.bsky = true.
import mongoose from "mongoose";
import { Article } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const handle = process.env.BSKY_HANDLE || "pakdhartitv.bsky.social";
const found = new Map();
let cursor = "", pages = 0, posts = 0;
do {
  const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=100&filter=posts_no_replies${cursor ? `&cursor=${cursor}` : ""}`);
  if (!r.ok) { console.log("BF feed error", r.status); break; }
  const j = await r.json();
  for (const it of j.feed || []) {
    posts++;
    const rec = it.post?.record || {};
    const blob = JSON.stringify([rec.text, rec.facets, rec.embed, it.post?.embed]);
    for (const m of blob.matchAll(/pakdhartitv\.com\/(ur|en)\/news\/([a-z0-9-]+)/gi)) found.set(`${m[1].toLowerCase()}|${m[2]}`, true);
  }
  cursor = j.cursor || ""; pages++;
} while (cursor && pages < 20);
console.log("BF posts read:", posts, "| stories found:", found.size);
let marked = 0, missing = 0;
for (const k of found.keys()) {
  const [lang, slug] = k.split("|");
  const r = await Article.updateOne({ slug }, { $set: { [`social.${lang}.bsky`]: true } });
  if (r.matchedCount) marked++; else { missing++; console.log("BF no story for", k); }
}
console.log("BF marked:", marked, "| not found in db:", missing);
await mongoose.disconnect();
