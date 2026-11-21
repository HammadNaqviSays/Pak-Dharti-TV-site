import mongoose from "mongoose";
import { Reel, Article } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const rows = await Reel.find({}, { slug: 1, status: 1, title: 1, error: 1, createdAt: 1, tries: 1 }).sort({ createdAt: -1 }).limit(8).lean();
for (const r of rows) console.log("::notice title=RL::", String(r._id), r.status, r.createdAt?.toISOString(), "tries=" + (r.tries || 0), "slug=" + r.slug, "err=" + (r.error || ""));
const a = await Article.findById("6b01e1015e7ad444749d14e7").select("slug status category contentType").lean();
console.log("::notice title=RL::article", JSON.stringify(a));
await mongoose.disconnect();
