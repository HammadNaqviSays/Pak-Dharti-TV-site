// Creates any missing database indexes (safe to run again). Used by the Cloudflare build lab,
// because the live site no longer builds indexes itself on every cold start.
import mongoose from "mongoose";
import * as models from "../models/index.js";

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
for (const [name, m] of Object.entries(models)) {
  if (!m?.createIndexes) continue;
  const t = Date.now();
  try { await m.createIndexes(); console.log(`indexes ok: ${name} (${Date.now() - t}ms)`); }
  catch (e) { console.log(`indexes FAILED: ${name}: ${e.message}`); }
}
await mongoose.disconnect();
