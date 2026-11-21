// Moves the video of every APPROVED reel from the database to R2 storage (full + light 720p web copy + poster), then frees the database copy.
import mongoose from "mongoose";
import fs from "fs";
import { execFileSync } from "child_process";
import { Reel, ReelFile } from "../models/index.js";
const SITE = "https://www.pakdhartitv.com";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const asBuf = (x) => (Buffer.isBuffer(x) ? x : Buffer.from(x?.buffer || x));
const put = (key, file, ct) => execFileSync("npx", ["--yes", "wrangler@4", "r2", "object", "put", `pak-dharti-reels/${key}`, "--file", file, "--content-type", ct, "--remote"], { stdio: "pipe" });
// APPROVE=slug1,slug2: the owner pressed Approve on these but it did not save: mark the READY ones approved
for (const sl of String(process.env.APPROVE || "").split(",").map((x) => x.trim()).filter(Boolean)) {
  const r = await Reel.updateOne({ slug: { $regex: "^" + sl.replace(/[^a-z0-9-]/gi, "") }, status: "ready" }, { $set: { status: "approved" } });
  console.log("approve", sl.slice(0, 50), r.modifiedCount);
}
const rows = await Reel.find({ status: { $in: ["approved", "ready"] }, r2: { $ne: true } }).select("title").lean();   // approved and ready (waiting for your check): both leave the database
console.log("approved reels still in the database:", rows.length);
console.log("COUNT total reels:", await Reel.countDocuments({}));
for (const g of await Reel.aggregate([{ $group: { _id: { s: "$status", r2: { $ifNull: ["$r2", false] } }, n: { $sum: 1 } } }, { $sort: { "_id.s": 1 } }])) console.log("COUNT", g._id.s, "r2=" + g._id.r2, g.n);
try { for (const g of await ReelFile.aggregate([{ $group: { _id: "$kind", n: { $sum: 1 }, bytes: { $sum: { $bsonSize: "$$ROOT" } } } }])) console.log("DBFILES", g._id, "parts=" + g.n, (g.bytes / 1048576).toFixed(1) + " MB"); } catch (e) { console.log("DBFILES unavailable", String(e.message).slice(0, 80)); }
for (const x of await Reel.find({ status: "approved" }).sort({ updatedAt: -1 }).select("title status r2 slug").lean()) console.log("APPROVED", "r2=" + !!x.r2, "|", String(x.title).slice(0, 40), "|", x.slug);
for (const x of await Reel.find({}).sort({ updatedAt: -1 }).limit(1).select("title status r2 slug").lean()) console.log("REEL", x.status, "r2=" + !!x.r2, String(x.slug), "|", String(x.title).slice(0, 30));
for (const r of rows) {
  const id = String(r._id);
  try {
    const parts = await ReelFile.find({ reel: id, kind: "video" }).sort({ part: 1 }).lean();
    if (!parts.length) { console.log("no video parts:", id); continue; }
    const dir = `/tmp/mig-${id}`; fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/video.mp4`, Buffer.concat(parts.map((p) => asBuf(p.data))));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${dir}/video.mp4`, "-vf", "scale=720:1280", "-c:v", "libx264", "-preset", "veryfast", "-crf", "29", "-maxrate", "1600k", "-bufsize", "3200k", "-profile:v", "main", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", `${dir}/web.mp4`]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "3", "-i", `${dir}/video.mp4`, "-frames:v", "1", "-vf", "scale=360:640", "-q:v", "6", `${dir}/poster.jpg`]);
    put(`${id}/video.mp4`, `${dir}/video.mp4`, "video/mp4");
    put(`${id}/web.mp4`, `${dir}/web.mp4`, "video/mp4");
    put(`${id}/poster.jpg`, `${dir}/poster.jpg`, "image/jpeg");
    await Reel.updateOne({ _id: id }, { $set: { r2: true } });
    await ReelFile.deleteMany({ reel: id, kind: "video" });
    const mb = (f) => (fs.statSync(f).size / 1048576).toFixed(1);
    console.log(`::notice title=moved::${String(r.title).slice(0, 40)} full ${mb(`${dir}/video.mp4`)} MB, web ${mb(`${dir}/web.mp4`)} MB | ${SITE}/api/reels/${id}/video`);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) { console.log("failed", id, String(e.message).slice(0, 200)); }
}
await mongoose.disconnect();
