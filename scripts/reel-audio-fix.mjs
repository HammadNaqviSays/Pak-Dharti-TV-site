import mongoose from "mongoose";
import { ReelFile, Reel } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const id = process.env.RID;
const rows = await ReelFile.aggregate([{ $match: { reel: new mongoose.Types.ObjectId(id) } }, { $group: { _id: "$kind", parts: { $sum: 1 }, bytes: { $sum: { $bsonSize: "$$ROOT" } } } }]);
for (const r of rows) console.log(`::notice title=RF::${r._id} parts=${r.parts} bytes=${r.bytes}`);
const rd = await Reel.findById(id).select("status tries audioKey error").lean();
console.log("::notice title=RF::reel", JSON.stringify(rd));
if (process.env.FIX === "1") {
  const d = await ReelFile.deleteMany({ reel: id, kind: "audio" });
  await Reel.updateOne({ _id: id }, { $set: { audioKey: "", status: "scripted", tries: 0, error: "" } });
  console.log("::notice title=RF::audio deleted", d.deletedCount, "and reel set to scripted");
}
await mongoose.disconnect();
