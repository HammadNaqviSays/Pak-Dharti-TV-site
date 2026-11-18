"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Setting } from "@/models";
import { normLook } from "@/lib/cardLook";

/** Save how people are drawn on the cards. New cards use it within a minute. */
export async function saveCardLookAction(values) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  await connectDB();
  const value = normLook(values || {});
  await Setting.findOneAndUpdate({ key: "cardlook" }, { key: "cardlook", value }, { upsert: true });
  return { ok: true, ...value };
}
