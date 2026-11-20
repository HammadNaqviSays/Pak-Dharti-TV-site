// One-off: drafts whose ONLY doubt is "sentence does not look like a closing date" are published with a soft note,
// if the date is in the future (within 200 days). Everything else stays a draft.
import mongoose from "mongoose";
import { Job } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const now = new Date(), max = new Date(Date.now() + 200 * 864e5);
const rows = await Job.find({ status: "draft", lastDate: { $gte: now, $lte: max } }).lean();
let n = 0;
for (const j of rows) {
  const only = (j.issues || []).length > 0 && (j.issues || []).every((x) => /does not look like a closing date/.test(x));
  if (!only || !j.title?.en || !j.org?.en || !j.lastDateText || !String(j.evidence || "").includes(String(j.lastDateText).slice(0, 12))) continue;
  await Job.updateOne({ _id: j._id }, { $set: { status: "published", soft: true, publishedAt: new Date() } });
  console.log("::notice title=published::", j.org.en, "|", String(j.title.en).slice(0, 50), "| last", j.lastDate.toISOString().slice(0, 10), "|", j.lastDateText, "| ev:", String(j.evidence).slice(0, 90));
  n++;
}
console.log("published softly:", n, "of", rows.length, "future drafts");
await mongoose.disconnect();
