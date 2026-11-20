// Re-opens the official pages of the soft-note ads and prints the lines around the closing date.
// Also sets two non-job ads (a training programme and a corrigendum) back to draft.
import mongoose from "mongoose";
import { Job } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
for (const j of await Job.find({ status: "published", soft: true }).lean()) {
  try {
    const r = await fetch(j.url || j.applyUrl, { headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36" } });
    const t = strip(await r.text());
    const k = String(j.lastDateText).slice(0, 12);
    const i = t.indexOf(k);
    console.log("XC", j.org.en, "| http", r.status, "| len", t.length, "| found:", i >= 0);
    if (i >= 0) console.log("XC   >>", t.slice(Math.max(0, i - 220), i + 120));
  } catch (e) { console.log("XC", j.org.en, "ERR", e.message); }
}
const r = await Job.updateMany({ slug: { $in: ["skillup-freelance-excellence-program-batch-i-m9-highway-campus-342d16", "combined-competitive-examination-cce-2026-corrigendum-57281b"] } }, { $set: { status: "draft" } });
console.log("XC set to draft:", r.modifiedCount);
await mongoose.disconnect();
