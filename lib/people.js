// People library helpers (see models Person, scripts/people/build.py).
import { connectDB } from "./db";
import { Person, Setting } from "@/models";

export const normName = (s = "") => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const toks = (n) => normName(n).split(" ").filter(Boolean);
const subset = (a, b) => a.length > 0 && a.every((t) => b.includes(t));

/** One entry per real person: "Raja Nasir Abbas" and "Raja Nasir Abbas Jafri" are the same man, so keep the longer name once. */
export function dedupeNames(names = []) {
  const out = [];
  for (const raw of names) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const t = toks(name);
    const i = out.findIndex((o) => { const u = toks(o); return subset(t, u) || subset(u, t); });
    if (i === -1) out.push(name);
    else if (t.length > toks(out[i]).length) out[i] = name;
  }
  return out;
}

/** Finds people by any of their names (English or Urdu). */
export async function findPeople(names = []) {
  const keys = [...new Set(names.filter(Boolean).flatMap((n) => [normName(n), String(n).trim()]))];
  if (!keys.length) return [];
  await connectDB();
  const found = await Person.find({ aliases: { $in: keys } }).lean();
  // keep the order of the names asked for
  return names.map((n) => found.find((p) => p.aliases?.includes(normName(n)) || p.aliases?.includes(String(n).trim()))).filter(Boolean)
    .filter((p, i, a) => a.findIndex((x) => String(x._id) === String(p._id)) === i);
}

/** Counts mentions of known people; unknown names go to the builder's queue (added on its next run). */
export async function notePeople(names = []) {
  const list = [...new Set(names.map((n) => String(n || "").trim()).filter((n) => n.length > 3 && n.split(" ").length >= 2))].slice(0, 12);
  if (!list.length) return;
  const known = await findPeople(list);
  if (known.length) await Person.updateMany({ _id: { $in: known.map((p) => p._id) } }, { $inc: { mentions: 1 }, $set: { lastMentionAt: new Date() } });
  const knownKeys = new Set(known.flatMap((p) => p.aliases || []));
  const unknown = list.filter((n) => !knownKeys.has(normName(n)));
  if (unknown.length) await Setting.updateOne({ key: "peopleQueue" }, { $addToSet: { value: { $each: unknown } } }, { upsert: true });
}

/** Best library photo for a story about this person: a free Commons / handout photo, with credit. */
export function libraryImage(p) {
  const ph = (p?.photos || []).find((x) => x.primary) || p?.photos?.[0];
  if (!ph) return null;
  return {
    url: ph.url, thumb: ph.thumb || ph.url, alt: p.name, credit: ph.credit, creditUrl: ph.source,
    license: ph.license, provider: ph.provider === "wikimedia" ? "wikimedia" : ph.provider || "own",
  };
}
