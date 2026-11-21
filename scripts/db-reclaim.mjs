// The data of moved files is gone, but MongoDB keeps the empty space inside its files. Copying a collection into a fresh one gives the space back.
import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "pakdharti" });
const db = mongoose.connection.db;
for (const name of ["media", "reelfiles"]) {
  const before = await db.command({ collStats: name });
  const idx = (await db.collection(name).indexes()).filter((i) => i.name !== "_id_");
  await db.collection(name).aggregate([{ $match: {} }, { $out: `${name}_new` }]).toArray();
  const n1 = await db.collection(name).countDocuments(), n2 = await db.collection(`${name}_new`).countDocuments();
  if (n1 !== n2) { console.log("::error::count mismatch", name, n1, n2); process.exit(1); }
  for (const i of idx) { const { key, name: iname, v, ns, ...opt } = i; await db.collection(`${name}_new`).createIndex(key, { ...opt, name: iname }); }
  await db.collection(`${name}_new`).rename(name, { dropTarget: true });
  const after = await db.command({ collStats: name });
  console.log("::notice title=RC::", name, "docs", n2, "storage", (before.storageSize / 1048576).toFixed(1), "->", (after.storageSize / 1048576).toFixed(1), "MB");
}
const s = await db.stats(); console.log("::notice title=RC::db storage", (s.storageSize / 1048576).toFixed(1), "MB");
await mongoose.disconnect();
