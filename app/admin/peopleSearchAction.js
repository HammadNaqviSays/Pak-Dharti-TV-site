"use server";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Person } from "@/models";
import { normName } from "@/lib/people";
import { fromCommons } from "@/lib/images";

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Looks people up in the people library (English or Urdu name) for the card editor: the same fields the card uses. */
export async function searchPeopleAction(q) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  const text = String(q || "").trim().slice(0, 60);
  if (text.length < 2) return { people: [] };
  await connectDB();
  const rx = new RegExp(esc(normName(text)) || esc(text), "i");
  const rxRaw = new RegExp(esc(text), "i");
  const found = await Person.find(
    { $or: [{ aliases: rx }, { name: rxRaw }, { nameUr: rxRaw }], "photos.0": { $exists: true } },
    { name: 1, nameUr: 1, roleUr: 1, photos: 1, priority: 1 },
  ).sort({ priority: -1, mentions: -1 }).limit(8).lean();
  return {
    people: found.map((lib) => {
      const withCut = (lib.photos || []).find((ph) => ph.cutout);
      const ph = withCut || (lib.photos || []).find((x) => x.primary) || lib.photos[0];
      return {
        name: lib.name, nameUr: lib.nameUr || "", roleUr: lib.roleUr || "", photo: ph.url,
        cutout: withCut ? `/api/people/cutout/${withCut.cutout}` : "",
        credit: `${ph.credit || ""}${ph.license ? ` (${ph.license})` : ""}`,
      };
    }),
  };
}

/** "Find with AI": a freely licensed Wikimedia Commons photo of a named person (full name needed), for the card editor. */
export async function findPersonPhotoAction(name, skip = []) {
  if (!(await isLoggedIn())) return { error: "Not logged in" };
  const n = String(name || "").trim().slice(0, 80);
  if (n.split(/\s+/).length < 2) return { error: "Type the person's full name first (first and last name)." };
  try {
    const c = await fromCommons(n, "", skip);
    if (!c) return { error: "No free photo found for that name. Try the library or upload your own." };
    return { photo: { name: n, photo: c.url, cutout: "", credit: `${c.credit || ""}${c.license ? ` (${c.license})` : ""}` } };
  } catch { return { error: "Search failed, try again." }; }
}
