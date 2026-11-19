// Puts finished reels whose title contains the given text back in the video queue (same as the "Make video again" button; the saved voice is reused).
import mongoose from "mongoose";
import { Reel } from "../models/index.js";
const words = String(process.env.MATCH || "").split(",").map((x) => x.trim()).filter(Boolean);
if (!words.length) throw new Error("give MATCH words");
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const rows = await Reel.find({ status: { $in: ["ready", "approved", "failed"] } }).lean();
let n = 0;
for (const r of rows) {
  if (!words.some((w) => String(r.title || "").includes(w))) continue;
  await Reel.updateOne({ _id: r._id }, { $set: { status: "scripted", tries: 0, error: "" } });
  console.log(`::notice title=requeued::${String(r.title).slice(0, 40)} (was ${r.status})`); n++;
}
console.log("requeued:", n);
await mongoose.disconnect();
