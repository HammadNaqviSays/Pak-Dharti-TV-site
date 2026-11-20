// Read-and-fix: is "Advt. I10409PROBE" really in the official Hazara University page? If not, the job goes back to draft.
import mongoose from "mongoose";
import { Job } from "../models/index.js";
import { execFileSync } from "child_process";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const j = await Job.findOne({ "org.en": /Hazara/i, status: "published", soft: true });
if (!j) { console.log("no such job"); process.exit(0); }
console.log("SRC", j.sourceUrl, "| AD", j.adUrl || "-");
let found = false;
for (const u of [j.sourceUrl, j.adUrl].filter(Boolean)) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (compatible; PakDhartiTV-jobs/1.0)" }, signal: AbortSignal.timeout(25000) });
    const buf = Buffer.from(await r.arrayBuffer()); let t = buf.toString("latin1");
    const i = t.indexOf("PROBE");
    console.log("FETCH", u.slice(0, 80), r.status, (r.headers.get("content-type") || "").slice(0, 30), "bytes", buf.length, "PROBE at", i);
    if (i >= 0) { found = true; console.log("CONTEXT", JSON.stringify(t.slice(Math.max(0, i - 120), i + 80))); }
  } catch (e) { console.log("fetch failed", u.slice(0, 60), String(e.message).slice(0, 60)); }
}
console.log("evidence:", j.evidence);
// the id says PROBE and the title is only "Faculty": it looks like a test entry on the portal, so it must not be shown to readers
await Job.updateOne({ _id: j._id }, { $set: { status: "draft" } });
console.log("Hazara job set back to draft (looks like a test entry on the portal)");
await mongoose.disconnect();
