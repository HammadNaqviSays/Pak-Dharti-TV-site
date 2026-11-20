// Read-only: today's and yesterday's traffic counters as stored.
import mongoose from "mongoose";
import { Traffic } from "../models/index.js";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const pk = (d) => new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
const days = [pk(new Date()), pk(new Date(Date.now() - 864e5))];
console.log("TT now PK:", new Date(Date.now() + 5 * 3600e3).toISOString());
for (const day of days) {
  const rows = await Traffic.find({ day, dim: { $in: ["total", "hour", "country", "city", "src", "bot-dc"] } }).lean();
  for (const r of rows.sort((a, b) => (a.dim + a.key).localeCompare(b.dim + b.key))) console.log("TT", day, r.dim, r.key, "views", r.views, "visits", r.sessions || 0);
}
await mongoose.disconnect();
