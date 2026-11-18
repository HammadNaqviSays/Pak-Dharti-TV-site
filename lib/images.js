// Images.
// 1. If the story is about a well-known person, a real, freely licensed photo of them from
//    Wikimedia Commons (credit + licence shown under the photo).
// 2. Otherwise an Unsplash photo; for Pakistan stories we search with "Pakistan" first so the
//    scene looks local. Only for admin-started runs (Unsplash's terms forbid fully automated use).
// 3. Automatic runs: a freely licensed photo (CC licences that allow commercial use) from Openverse
//    (Flickr, Wikimedia and other open collections) or Wikimedia Commons, or Pexels when a key is set.
// 4. Otherwise a fixed banner per category.
// The editor can always replace the photo from the preview page (own upload or link).
import { callAI } from "./ai";
const UTM = "utm_source=pak_dharti_tv&utm_medium=referral";
const CATEGORIES = ["world", "pakistan", "politics", "economy", "sports", "disaster",
  "entertainment", "inspirational", "folklore", "religion", "poetry", "quotes", "books"];
const PAKISTAN_SECTIONS = ["pakistan", "politics", "economy"];

// A stock photo of random people (above all children, families, poor villagers) under a news story that has
// nothing to do with them is wrong and can be harmful. Searches for such subjects are skipped, and photos whose
// title or description mention them are rejected, so the story gets a place/object photo or the category banner.
const PEOPLE_RE = /\b(child|children|kid|kids|baby|babies|infant|toddler|boy|boys|girl|girls|orphan|orphans|family|families|mother|mothers|woman|women|lady|ladies|man|men|people|villager|villagers|poor|poverty|beggar|beggars|refugee|refugees|victim|victims|portrait|selfie)\b/i;
// old engravings, drawings, maps and scans never make a good news photo
const OLD_RE = /\b(engraving|engraved|illustration|drawing|sketch|lithograph|woodcut|painting|print|poster|map|diagram|vintage|historic|historical|postcard|scan|antique|18\d\d|17\d\d|19[0-4]\d)\b/i;
export const unsafeQuery = (q) => PEOPLE_RE.test(q || "");
const unsafePhoto = (img) => PEOPLE_RE.test(`${img?.alt || ""}`);

export function categoryImage(category) {
  const c = CATEGORIES.includes(category) ? category : null;
  const url = c ? `/images/categories/${c}.svg` : "/images/fallback/default.svg";
  return { url, thumb: url, alt: "", provider: "local" };
}

async function fromUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${key}` } }
  );
  if (!res.ok) return null;
  const { results } = await res.json();
  const p = (results || []).find((r) => !PEOPLE_RE.test(r.alt_description || r.description || ""));
  if (!p) return null;
  // Required by Unsplash guidelines: register that the photo was used
  fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
  return {
    url: p.urls.regular, thumb: p.urls.small, alt: p.alt_description || query,
    credit: p.user?.name, creditUrl: `${p.user?.links?.html}?${UTM}`, provider: "unsplash",
  };
}

const stripTags = (s = "") => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// Files that are about a place, a shrine, a book or a symbol and not a portrait of a living / modern person.
const NOT_PORTRAIT_RE = /\b(shrine|tomb|tombs|mazar|mazaar|mausoleum|dargah|darbar|mosque|masjid|grave|cemetery|calligraphy|manuscript|book|cover|map|logo|flag|stamp|coin|banknote|statue|monument|mural|painting|illustration)\b/i;

/** Asks the AI whether this Commons file really shows the person the story is about (not a namesake, saint, shrine or building). */
async function isRightPerson(person, context, fileTitle, desc) {
  const { text } = await callAI({
    system: "You check photos for a news site. Answer with one word: yes or no.",
    prompt: `Story: ${context}\nPerson the story is about: ${person}\nPhoto file name: ${fileTitle}\nPhoto description: ${desc || "(none)"}\n\nIs this photo a portrait or press photo of THE SAME person the story is about? Answer no if it shows a namesake (a different person with a similar name, for example a saint, a historical figure or a shrine / tomb / building named after someone), or if it is not clearly that person. Answer yes only when it clearly fits.`,
    maxTokens: 20, prefer: ["gemini-3-flash-preview", "gemini-2.5-flash"],
  });
  return /^\s*yes/i.test(text || "");
}

/** A freely licensed photo of a named public figure from Wikimedia Commons. `context` (headline + summary) lets the AI reject namesakes. */
export async function fromCommons(person, context = "", skip = []) {
  if (String(person || "").trim().split(/\s+/).length < 2) return null;
  const q = `"${person}" filetype:bitmap filemime:image/jpeg`;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(q)}` +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1280";
  const res = await fetch(url, { headers: { "User-Agent": "PakDhartiTV/1.0 (news site; contact via site)" } });
  if (!res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages || {}).sort((a, b) => a.index - b.index);
  const nameParts = person.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (nameParts.length < 2) return null; // one word ("Nehal") matches strangers: a full name is required
  let checked = 0;
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || info.mime !== "image/jpeg" || info.width < 700 || info.width < info.height * 0.75) continue;
    if (skip.includes(info.thumburl || info.url)) continue;
    const title = (p.title || "").toLowerCase();
    if (!nameParts.every((w) => title.includes(w))) continue; // the file must be about this person
    const meta = info.extmetadata || {};
    const license = meta.LicenseShortName?.value || "";
    if (!license) continue;
    const desc = stripTags(meta.ImageDescription?.value || "").slice(0, 300);
    if (NOT_PORTRAIT_RE.test(`${p.title || ""} ${desc}`)) continue;
    if (context) {
      if (++checked > 3) break;
      let ok = false;
      try { ok = await isRightPerson(person, context, p.title, desc); } catch { ok = false; } // if unsure, no photo is better than the wrong one
      if (!ok) continue;
    }
    return {
      url: info.thumburl || info.url, thumb: info.thumburl || info.url, alt: person,
      credit: stripTags(meta.Artist?.value || "Wikimedia Commons").slice(0, 80),
      creditUrl: info.descriptionurl, license, provider: "wikimedia",
    };
  }
  return null;
}

/** A freely licensed photo that shows TWO named people together (a meeting, a summit photo) from Wikimedia Commons. */
export async function fromCommonsJoint(a, b) {
  const norm = (x) => String(x || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const key = (n) => norm(n).split(/[^a-z]+/).filter((w) => w.length > 3);
  const ka = key(a), kb = key(b);
  if (!ka.length || !kb.length) return null;
  const q = `${a} ${b} filetype:bitmap filemime:image/jpeg`;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    `&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q)}` +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1280";
  const res = await fetch(url, { headers: { "User-Agent": "PakDhartiTV/1.0 (news site; contact via site)" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages || {}).sort((x, y) => x.index - y.index);
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || info.mime !== "image/jpeg" || info.width < 900 || info.height < 500) continue;
    const t = norm(p.title);
    // both people must be named in the file title, so it really is a photo of the two of them
    if (!ka.some((w) => t.includes(w)) || !kb.some((w) => t.includes(w))) continue;
    const meta = info.extmetadata || {};
    const license = meta.LicenseShortName?.value || "";
    if (!license) continue;
    return { url: info.thumburl || info.url, credit: stripTags(meta.Artist?.value || "Wikimedia Commons").slice(0, 80), license };
  }
  return null;
}


const UA = { "User-Agent": "PakDhartiTV/1.0 (news site; contact via site)" };

/** Openverse: open-licensed photos (no key needed). Only licences that allow commercial use. */
async function fromOpenverse(query) {
  const u = "https://api.openverse.org/v1/images/?page_size=12&license_type=commercial&mature=false&aspect_ratio=wide" +
    `&q=${encodeURIComponent(query)}`;
  const res = await fetch(u, { headers: UA, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return null;
  const { results = [] } = await res.json();
  const p = results.find((r) => r.url && /^https:/.test(r.url) && r.width >= 1200 && r.height >= 700 && !/\.(gif|svg)$/i.test(r.url) && !PEOPLE_RE.test(r.title || "") && !OLD_RE.test(`${r.title || ""} ${(r.tags || []).map((t) => t.name).join(" ")}`));
  if (!p) return null;
  const lic = `${(p.license || "").toUpperCase() === "CC0" ? "CC0" : `CC ${(p.license || "").toUpperCase()}`} ${p.license_version || ""}`.trim();
  return {
    url: p.url, thumb: p.thumbnail || p.url, alt: p.title || query,
    credit: String(p.creator || p.source || "Openverse").slice(0, 80), creditUrl: p.foreign_landing_url || p.creator_url,
    license: lic, provider: "openverse",
  };
}

/** Pexels (free API key in PEXELS_API_KEY; automated use allowed with credit). */
async function fromPexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.pexels.com/v1/search?per_page=5&orientation=landscape&query=${encodeURIComponent(query)}`,
    { headers: { Authorization: key }, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return null;
  const p = ((await res.json()).photos || []).find((x) => !PEOPLE_RE.test(x.alt || ""));
  if (!p) return null;
  return { url: p.src.large2x || p.src.large, thumb: p.src.medium, alt: p.alt || query, credit: p.photographer, creditUrl: p.url, license: "Pexels", provider: "pexels" };
}

/** Wikimedia Commons, any topic (landscape JPEG, licence required). */
async function fromCommonsTopic(query) {
  const q = `${query} filetype:bitmap filemime:image/jpeg`;
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    `&generator=search&gsrnamespace=6&gsrlimit=10&gsrsearch=${encodeURIComponent(q)}` +
    "&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1280";
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(7000) });
  if (!res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages || {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const license = info?.extmetadata?.LicenseShortName?.value || "";
    if (!info || info.mime !== "image/jpeg" || info.width < 1400 || info.width < info.height * 1.2 || !license) continue;
    if (PEOPLE_RE.test(`${p.title || ""} ${stripTags(info.extmetadata?.ImageDescription?.value || "")}`) || OLD_RE.test(`${p.title || ""} ${stripTags(info.extmetadata?.ImageDescription?.value || "")}`)) continue;
    return {
      url: info.thumburl || info.url, thumb: info.thumburl || info.url, alt: query,
      credit: stripTags(info.extmetadata?.Artist?.value || "Wikimedia Commons").slice(0, 80),
      creditUrl: info.descriptionurl, license, provider: "wikimedia",
    };
  }
  return null;
}

/** Free, automated-use photo for a story; tries Pakistan-flavoured search first for Pakistan sections. */
export async function findFreePhoto(query, category) {
  if (!query || unsafeQuery(query)) return null;
  const qs = PAKISTAN_SECTIONS.includes(category) ? [`${query} Pakistan`, query] : [query];
  for (const q of qs) {
    for (const fn of [fromPexels, fromOpenverse, fromCommonsTopic]) {
      try { const img = await fn(q); if (img) return img; } catch {}
    }
  }
  return null;
}

/** For admin-started articles. Falls back to the category banner. */
export async function findImage(query, category, { person, context = "" } = {}) {
  if (person && person.trim().length > 3) {
    try { const img = await fromCommons(person.trim(), context); if (img) return img; } catch {}
  }
  if (query && !unsafeQuery(query) && process.env.UNSPLASH_ACCESS_KEY) {
    try {
      let img = null;
      if (PAKISTAN_SECTIONS.includes(category)) img = await fromUnsplash(`${query} Pakistan`);
      if (!img) img = await fromUnsplash(query);
      if (img) return img;
    } catch {}
  }
  return categoryImage(category);
}
