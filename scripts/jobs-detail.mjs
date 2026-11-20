// Read-only: details of every published job so they can be checked against the official page.
import mongoose from "mongoose";
import { Job } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
for (const j of await Job.find({ status: "published" }).sort({ lastDate: 1 }).lean())
  console.log("JD", JSON.stringify({ slug: j.slug, org: j.org?.en, title: j.title?.en, soft: !!j.soft, verified: j.verified, last: j.lastDate?.toISOString().slice(0,10), text: j.lastDateText, url: j.sourceUrl || j.url || j.link, applyUrl: j.applyUrl, ev: String(j.evidence||"").slice(0,160), issues: j.issues }));
await mongoose.disconnect();
