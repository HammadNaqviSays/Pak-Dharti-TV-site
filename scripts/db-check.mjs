// Read-only: how full is the database, and what takes the room (no secrets printed).
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const db = mongoose.connection.db;
const st = await db.stats();
const mb = (n) => (n / 1048576).toFixed(1) + " MB";
console.log(`::notice title=db::data=${mb(st.dataSize)} storage=${mb(st.storageSize)} index=${mb(st.indexSize)} objects=${st.objects}`);
const cols = await db.listCollections().toArray();
const rows = [];
for (const c of cols) { try { const s = await db.command({ collStats: c.name }); rows.push([c.name, s.storageSize, s.count]); } catch {} }
rows.sort((a, b) => b[1] - a[1]);
for (const [n, sz, cnt] of rows.slice(0, 10)) console.log(`${n}: ${mb(sz)} (${cnt} docs)`);
const rf = await db.collection("reelfiles").aggregate([{ $group: { _id: "$kind", n: { $sum: 1 } } }]).toArray();
console.log("reelfiles by kind:", JSON.stringify(rf));
const rs = await db.collection("reels").aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray();
console.log("reels by status:", JSON.stringify(rs));
await mongoose.disconnect();
