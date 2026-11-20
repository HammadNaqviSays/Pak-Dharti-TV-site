// Read-only: how many job ads are in the database and why drafts are drafts.
import mongoose from "mongoose";
import { Job } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const today = new Date();
console.log("JOBS total:", await Job.countDocuments({}));
for (const g of await Job.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])) console.log("JOBS", g._id, g.n);
console.log("JOBS published and still open:", await Job.countDocuments({ status: "published", lastDate: { $gte: today } }));
console.log("JOBS published but closed:", await Job.countDocuments({ status: "published", lastDate: { $lt: today } }));
const reasons = {};
for (const j of await Job.find({ status: "draft" }).select("issues").lean()) for (const i of j.issues || []) reasons[i] = (reasons[i] || 0) + 1;
for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log("DRAFT-WHY", v, k);
const bySrc = await Job.aggregate([{ $group: { _id: { s: "$source", st: "$status" }, n: { $sum: 1 } } }, { $sort: { "_id.s": 1 } }]);
console.log("BYSOURCE", bySrc.map((x) => `${x._id.s}:${x._id.st}=${x.n}`).join("  "));
for (const j of await Job.find({ status: "published", lastDate: { $gte: today } }).sort({ lastDate: 1 }).limit(25).select("title org lastDate slug").lean())
  console.log("OPEN", j.lastDate?.toISOString().slice(0, 10), "|", j.org?.en, "|", String(j.title?.en).slice(0, 60));
await mongoose.disconnect();
