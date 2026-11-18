// People library, fed by the GitHub Actions builder (scripts/people/build.py) with the scheduler token.
//   POST ?op=upsert        { people: [...] }            merge people (by wikidata id / key), keep cutouts and tags
//   GET  ?op=needs-cutout  &limit=20                    photos still without a cut-out, most important people first
//   POST ?op=cutout        { person, url, data, type }  store a cut-out (base64 webp/png); { failed: true } marks it tried
//   GET  ?op=queue                                      names found in the news that are not in the library yet
//   POST ?op=scenes        { scenes: {...} }            background photos of places (UN, parliament, ...)
//   GET  ?op=fill-urdu                                  Urdu name + role for 25 people that lack them (AI)
//   GET  ?op=stats
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Person, PersonCutout, Setting } from "@/models";
import { isCron } from "@/lib/util";
import { callAI, parseJSON } from "@/lib/ai";
import { cleanUrdu } from "@/lib/urdu";
import { putCutout } from "@/lib/cutoutBlob";


export const runtime = "nodejs";
export const maxDuration = 60;

const uniq = (a) => [...new Set((a || []).filter(Boolean))];
const norm = (s = "") => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

async function upsert(list) {
  let created = 0, updated = 0;
  for (const p of list.slice(0, 250)) {
    if (!p?.name) continue;
    const key = p.qid || p.key || norm(p.name).replace(/\s/g, "-");
    const cur = await Person.findOne(p.qid ? { $or: [{ qid: p.qid }, { key }] } : { key }).lean();
    const aliases = uniq([...(cur?.aliases || []), norm(p.name), ...(p.aliases || []).map(norm), p.nameUr && p.nameUr.trim()]);
    // Handouts / own photos stay first; the free photos are replaced by the builder's latest list (sharpest first).
    // Photos that drop out lose their cut-out (cut-outs are re-made from the new, larger files).
    const own = (cur?.photos || []).filter((x) => x.provider && x.provider !== "wikimedia");
    const oldFree = (cur?.photos || []).filter((x) => !x.provider || x.provider === "wikimedia");
    let free = oldFree;
    if (Array.isArray(p.photos) && p.photos.length) {
      free = p.photos.filter((ph) => ph?.url).map((ph) => {
        const same = oldFree.find((x) => x.url === ph.url);
        return same ? { ...ph, cutout: same.cutout, cutoutTried: same.cutoutTried, tags: same.tags } : { ...ph, cutout: undefined, cutoutTried: false };
      });
      const gone = oldFree.filter((x) => x.cutout && !free.some((y) => y.url === x.url)).map((x) => x.cutout);
      if (gone.length) await PersonCutout.deleteMany({ _id: { $in: gone } });
    }
    const photos = [...own, ...free].map((x, i) => ({ ...x, primary: i === 0 }));
    const doc = {
      key: cur?.key || key, qid: p.qid || cur?.qid, name: p.name || cur?.name,
      nameUr: cur?.nameUr || p.nameUr,   // an Urdu name set once (or fixed by the editor) is kept
      aliases, photos,
      role: p.role || cur?.role, roleUr: p.roleUr || cur?.roleUr, party: p.party || cur?.party,
      constituency: p.constituency || cur?.constituency, description: p.description || cur?.description, wiki: p.wiki || cur?.wiki,
      groups: uniq([...(cur?.groups || []), ...(p.groups || [])]),
      priority: Math.max(cur?.priority || 0, p.priority || 0),
    };
    if (cur) { await Person.updateOne({ _id: cur._id }, { $set: doc }); updated++; }
    else { await Person.create(doc); created++; }
  }
  return { created, updated };
}

export async function GET(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const u = new URL(req.url), op = u.searchParams.get("op");
  if (op === "needs-cutout") {
    const limit = Math.min(Number(u.searchParams.get("limit")) || 20, 60);
    const list = await Person.find({ "photos.0": { $exists: true } }, { name: 1, priority: 1, photos: 1 }).sort({ priority: -1, mentions: -1 }).limit(400).lean();
    const out = [];
    for (const p of list) {
      const max = p.priority >= 80 ? 4 : p.priority >= 40 ? 2 : 1;
      p.photos.filter((ph) => !ph.width || ph.width >= 700 || ph.provider !== "wikimedia").slice(0, max)
        .forEach((ph) => { if (!ph.cutout && !ph.cutoutTried && out.length < limit) out.push({ person: String(p._id), name: p.name, url: ph.url }); });
      if (out.length >= limit) break;
    }
    return NextResponse.json({ ok: true, items: out });
  }
  if (op === "queue") {
    const q = (await Setting.findOne({ key: "peopleQueue" }).lean())?.value || [];
    await Setting.updateOne({ key: "peopleQueue" }, { $set: { value: [] } }, { upsert: true });
    return NextResponse.json({ ok: true, names: q });
  }
  if (op === "fill-urdu") return NextResponse.json({ ok: true, ...(await fillUrdu()) });
  if (op === "names") {
    const list = await Person.find({}, { name: 1, qid: 1 }).lean();
    return NextResponse.json({ ok: true, names: list.map((p) => p.name), qids: list.map((p) => p.qid).filter(Boolean) });
  }
  if (op === "sample-cutouts") {
    const n = Math.min(Number(u.searchParams.get("n")) || 24, 60);
    const list = await Person.find({ "photos.cutout": { $exists: true, $ne: null } }, { name: 1, photos: 1 }).sort({ priority: -1, mentions: -1 }).limit(n).lean();
    return NextResponse.json({ ok: true, items: list.map((p) => { const ph = p.photos.find((x) => x.cutout); return { person: String(p._id), name: p.name, url: ph.url, cutout: `/api/people/cutout/${ph.cutout}` }; }) });
  }
  const [people, withPhoto, cutouts, groups, sizes, cutSizes] = await Promise.all([
    Person.countDocuments(), Person.countDocuments({ "photos.0": { $exists: true } }), PersonCutout.countDocuments(),
    Person.aggregate([{ $unwind: "$groups" }, { $group: { _id: "$groups", n: { $sum: 1 }, photo: { $sum: { $cond: [{ $gt: [{ $size: "$photos" }, 0] }, 1, 0] } } } }, { $sort: { n: -1 } }]),
    Person.aggregate([{ $unwind: "$photos" }, { $group: { _id: null, all: { $sum: 1 },
      hd: { $sum: { $cond: [{ $gte: ["$photos.width", 1200] }, 1, 0] } }, mid: { $sum: { $cond: [{ $and: [{ $gte: ["$photos.width", 800] }, { $lt: ["$photos.width", 1200] }] }, 1, 0] } } } }]),
    PersonCutout.aggregate([{ $group: { _id: null, big: { $sum: { $cond: [{ $gte: ["$height", 1000] }, 1, 0] } }, mid: { $sum: { $cond: [{ $and: [{ $gte: ["$height", 600] }, { $lt: ["$height", 1000] }] }, 1, 0] } } } }]),
  ]);
  const z = sizes[0] || {}, c = cutSizes[0] || {};
  return NextResponse.json({ ok: true, people, withPhoto, cutouts,
    photos: { all: z.all || 0, hd1200: z.hd || 0, mid800: z.mid || 0, small: (z.all || 0) - (z.hd || 0) - (z.mid || 0) },
    cutoutHeights: { over1000: c.big || 0, h600to1000: c.mid || 0, under600: cutouts - (c.big || 0) - (c.mid || 0) },
    groups: Object.fromEntries(groups.map((g) => [g._id, `${g.photo}/${g.n}`])) });
}

export async function POST(req) {
  if (!isCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const op = new URL(req.url).searchParams.get("op");
  const body = await req.json().catch(() => ({}));
  if (op === "upsert") return NextResponse.json({ ok: true, ...(await upsert(body.people || [])) });
  if (op === "cutout") {
    const p = await Person.findById(body.person);
    if (!p) return NextResponse.json({ error: "no person" }, { status: 404 });
    const ph = p.photos.find((x) => x.url === body.url);
    if (!ph) return NextResponse.json({ error: "no photo" }, { status: 404 });
    ph.cutoutTried = true;
    if (body.noface && ph.provider !== "handout") {
      // not a portrait (a building, a crowd ...): drop it, the next photo becomes the main one
      p.photos = p.photos.filter((x) => x.url !== body.url);
      p.photos.forEach((x, i) => { x.primary = i === 0; });
      await p.save();
      return NextResponse.json({ ok: true, removed: true });
    }
    if (!body.failed && body.data) {
      // cut-outs live in Vercel Blob (the database only keeps a small record with the link)
      const buf = Buffer.from(body.data, "base64");
      const c = new PersonCutout({ person: p._id, photoUrl: body.url, type: body.type || "image/webp", width: body.width, height: body.height });
      try { c.blobUrl = await putCutout(String(c._id), buf, c.type); }
      catch (e) { return NextResponse.json({ error: `blob upload failed: ${e.message}` }, { status: 502 }); }
      await c.save();
      ph.cutout = c._id;
    }
    await p.save();
    return NextResponse.json({ ok: true, cutout: ph.cutout ? String(ph.cutout) : null });
  }
  if (op === "drop") {
    // only people that came from the seed list (never assembly members) — wrong matches of a seed name
    const SEED = ["pti", "federal", "military", "police", "judiciary", "news"];
    const qids = (body.qids || []).slice(0, 200);
    const list = await Person.find({ qid: { $in: qids } }, { groups: 1, name: 1 }).lean();
    const del = list.filter((p) => (p.groups || []).every((g) => SEED.includes(g)));
    await Person.deleteMany({ _id: { $in: del.map((p) => p._id) } });
    await PersonCutout.deleteMany({ person: { $in: del.map((p) => p._id) } });
    return NextResponse.json({ ok: true, removed: del.map((p) => p.name) });
  }
  if (op === "reset-cutouts") {
    // make every cut-out again (after the cut-out method changed)
    const r = await PersonCutout.deleteMany({});
    await Person.updateMany({ "photos.0": { $exists: true } }, { $set: { "photos.$[].cutoutTried": false }, $unset: { "photos.$[].cutout": "" } });
    return NextResponse.json({ ok: true, deleted: r.deletedCount });
  }
  if (op === "scenes") {
    const cur = (await Setting.findOne({ key: "scenes" }).lean())?.value || {};
    await Setting.updateOne({ key: "scenes" }, { $set: { value: { ...cur, ...(body.scenes || {}) } } }, { upsert: true });
    return NextResponse.json({ ok: true, scenes: Object.keys({ ...cur, ...(body.scenes || {}) }).length });
  }
  return NextResponse.json({ error: "unknown op" }, { status: 400 });
}

const GROUP_ROLE = {
  mna: "رکن قومی اسمبلی", senator: "سینیٹر", "mpa-punjab": "رکن پنجاب اسمبلی", "mpa-kp": "رکن خیبر پختونخوا اسمبلی",
  "mpa-sindh": "رکن سندھ اسمبلی", "mpa-balochistan": "رکن بلوچستان اسمبلی",
};

/** Urdu name and a short Urdu role for people that do not have them yet (most important first). */
async function fillUrdu() {
  const list = await Person.find({ $or: [{ nameUr: { $in: [null, ""] } }, { roleUr: { $in: [null, ""] } }], urduTried: { $ne: true } },
    { name: 1, nameUr: 1, roleUr: 1, description: 1, groups: 1, party: 1, constituency: 1 }).sort({ priority: -1 }).limit(25).lean();
  if (!list.length) return { done: 0, left: 0 };
  let j = [];
  try {
    const r = await callAI({
      system: "You are an Urdu news editor in Pakistan. Reply with JSON only. Use the spelling Pakistani Urdu newspapers use.",
      prompt: `For each person give the Urdu spelling of the name and a SHORT Urdu role (max 6 words) as Pakistani newspapers write it.
Use the description given; for assembly members include the constituency if given (e.g. "رکن قومی اسمبلی، این اے 122").
For people who held an office in the past write "سابق ...". If unsure of the role, use the general one (e.g. "سیاستدان").
${list.map((p, i) => `[${i}] ${p.name} — ${p.description || ""}${p.party ? ` — party: ${p.party}` : ""}${p.constituency ? ` — ${p.constituency}` : ""} — groups: ${(p.groups || []).join(",")}`).join("\n")}
Return {"people":[{"i":0,"nameUr":"...","roleUr":"..."}]}`,
      maxTokens: 4000,
    });
    const o = parseJSON(r.text) || {};
    j = o.people || o.items || [];
  } catch (e) { return { error: e.message, done: 0 }; }
  let done = 0;
  for (const [i, p] of list.entries()) {
    const x = j.find((y) => Number(y.i) === i) || {};
    const fallback = (p.groups || []).map((g) => GROUP_ROLE[g]).find(Boolean);
    const set = { urduTried: true };
    if (!p.nameUr && x.nameUr) set.nameUr = cleanUrdu(String(x.nameUr).trim());
    if (!p.roleUr && (x.roleUr || fallback)) set.roleUr = cleanUrdu(String(x.roleUr || fallback).trim());
    await Person.updateOne({ _id: p._id }, set.nameUr ? { $set: set, $addToSet: { aliases: set.nameUr } } : { $set: set });
    done++;
  }
  const left = await Person.countDocuments({ $or: [{ nameUr: { $in: [null, ""] } }, { roleUr: { $in: [null, ""] } }], urduTried: { $ne: true } });
  return { done, left };
}
