import mongoose from "mongoose";
import { ReelFile, Reel } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const id = process.env.RID;
const rows = await ReelFile.aggregate([{ $match: { reel: new mongoose.Types.ObjectId(id) } }, { $group: { _id: "$kind", parts: { $sum: 1 }, bytes: { $sum: { $bsonSize: "$$ROOT" } } } }]);
for (const r of rows) console.log(`::notice title=RF::${r._id} parts=${r.parts} bytes=${r.bytes}`);
const ix = await ReelFile.collection.indexes().catch((e) => String(e.message));
console.log("::notice title=RF::indexes", JSON.stringify(Array.isArray(ix) ? ix.map((x) => x.name) : ix));
const st = await ReelFile.aggregate([{ $group: { _id: "$kind", docs: { $sum: 1 }, mb: { $sum: { $divide: [{ $bsonSize: "$$ROOT" }, 1048576] } } } }]).catch(() => []);
console.log("::notice title=RF::all files", JSON.stringify(st.map((x) => [x._id, x.docs, Math.round(x.mb)])));
const t0 = Date.now(); const got = await ReelFile.find({ reel: id, kind: "audio" }).sort({ part: 1 }).lean(); console.log("::notice title=RF::audio read", got.length, "docs", Date.now() - t0, "ms");
if (process.env.FIX === "3") { await ReelFile.collection.createIndex({ reel: 1, kind: 1, part: 1 }); console.log("::notice title=RF::index created"); const t1 = Date.now(); await ReelFile.find({ reel: id, kind: "audio" }).sort({ part: 1 }).lean(); console.log("::notice title=RF::audio read after index", Date.now() - t1, "ms"); }
const rd = await Reel.findById(id).select("status tries audioKey error").lean();
console.log("::notice title=RF::reel", JSON.stringify(rd));
if (process.env.FIX === "2") {
  await Reel.updateOne({ _id: id }, { $set: { status: "scripted", tries: 0, error: "" } });
  console.log("::notice title=RF::reel set to scripted (voice kept)");
}
if (process.env.FIX === "1") {
  const d = await ReelFile.deleteMany({ reel: id, kind: "audio" });
  await Reel.updateOne({ _id: id }, { $set: { audioKey: "", status: "scripted", tries: 0, error: "" } });
  console.log("::notice title=RF::audio deleted", d.deletedCount, "and reel set to scripted");
}
await mongoose.disconnect();
