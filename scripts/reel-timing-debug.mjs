// Read-only: for the newest reels, prints where the pauses in the voice are and where each scene is expected to start (no secrets).
import mongoose from "mongoose";
import fs from "fs";
import { Reel, ReelFile } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const reels = await Reel.find({ status: { $in: ["ready", "approved"] } }).sort({ updatedAt: -1 }).limit(3).lean();
fs.mkdirSync("dbg", { recursive: true });
const meta = [];
for (const r of reels) {
  const parts = await ReelFile.find({ reel: r._id, kind: "audio" }).sort({ part: 1 }).lean();
  if (!parts.length) continue;
  const buf = Buffer.concat(parts.map((p) => Buffer.from(p.data.buffer ? p.data.buffer : p.data)));
  fs.writeFileSync(`dbg/${r._id}.wav`, buf);
  meta.push({ id: String(r._id), title: r.title, texts: r.scenes.map((s) => s.text), speed: 1 });
}
fs.writeFileSync("dbg/meta.json", JSON.stringify(meta));
console.log("reels with audio:", meta.length);
await mongoose.disconnect();
