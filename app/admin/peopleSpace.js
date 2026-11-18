"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import { PersonCutout } from "@/models";
import { putCutout } from "@/lib/cutoutBlob";

/** Move up to `batch` cut-outs from the database to Blob. Call again until `left` is 0. */
export async function moveCutoutsAction(batch = 30) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const n = Math.max(1, Math.min(60, Number(batch) || 30));
  const docs = await PersonCutout.find({ data: { $exists: true }, blobUrl: { $exists: false } }).limit(n); // hydrated: data is a Buffer
  let moved = 0, failed = "";
  for (let i = 0; i < docs.length; i += 5) {
    await Promise.all(docs.slice(i, i + 5).map(async (c) => {
      try {
        const url = await putCutout(String(c._id), Buffer.from(c.data), c.type);
        await PersonCutout.updateOne({ _id: c._id }, { $set: { blobUrl: url }, $unset: { data: "" } });
        moved++;
      } catch (e) { failed = failed || e.message; }
    }));
    if (failed) break; // stop at the first problem and show it
  }
  const left = await PersonCutout.countDocuments({ data: { $exists: true }, blobUrl: { $exists: false } });
  return { moved, left, error: failed ? `Upload problem: ${failed}` : undefined };
}

/** Give the disk space back. After the pictures moved out, the cut-out collection is tiny but its file is still big:
 *  copy the small records to a temporary collection, drop the big one (that frees the file), put the records back, drop the copy. */
export async function reclaimCutoutDiskAction() {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const db = mongoose.connection.db;
  const coll = db.collection("personcutouts");
  const docs = await coll.find({}).toArray();
  if (docs.some((d) => d.data)) return { error: "Some cut-outs are still in the database. Move them first." };
  if (!docs.length) return { error: "Nothing to copy." };
  const tmp = db.collection("personcutouts_tmp");
  await tmp.drop().catch(() => {});
  await tmp.insertMany(docs, { ordered: false });
  if ((await tmp.countDocuments()) !== docs.length) return { error: "Copy check failed, nothing was dropped." };
  await coll.drop();
  await db.collection("personcutouts").insertMany(docs, { ordered: false });
  await PersonCutout.createIndexes();
  const back = await db.collection("personcutouts").countDocuments();
  if (back !== docs.length) return { error: `Restore check failed (${back} of ${docs.length}). A safe copy is in personcutouts_tmp.` };
  await tmp.drop().catch(() => {});
  return { count: back };
}
