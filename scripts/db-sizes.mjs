import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const db = mongoose.connection.db;
const s = await db.stats();
console.log("::notice title=SZ::db dataSize", (s.dataSize / 1048576).toFixed(1), "MB storage", (s.storageSize / 1048576).toFixed(1), "MB index", (s.indexSize / 1048576).toFixed(1), "MB");
for (const c of await db.listCollections().toArray()) {
  const st = await db.command({ collStats: c.name }).catch(() => null);
  if (st) console.log("::notice title=SZ::", c.name, "docs", st.count, "data", (st.size / 1048576).toFixed(1), "MB storage", (st.storageSize / 1048576).toFixed(1), "MB");
}
await mongoose.disconnect();
