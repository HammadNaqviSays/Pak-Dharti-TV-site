import { connectDB } from "@/lib/db";
import { Article, Job, LANGS } from "@/models";
import { SITE } from "@/lib/site";
import { NAV_CATEGORIES } from "@/lib/i18n";
import { POETS } from "@/lib/poetry";
import { PAGE_SLUGS } from "@/lib/pages";
import { HISTORY } from "@/lib/history";
import { CITIES, citySlug } from "@/lib/prayTimes";
import { writerSlug } from "@/lib/writerSlug";
import { isThinForSearch } from "@/lib/indexGate";

// Only titles are read (not the article bodies), so 2,000 stories stay a small query.
export const revalidate = 3600; // stored copy, rebuilt hourly in the background

export default async function sitemap() {
  const u = (p) => `${SITE.url}${p}`;
  const out = [];
  for (const l of LANGS) {
    out.push({ url: u(`/${l}`), changeFrequency: "hourly", priority: 1 });
    for (const c of NAV_CATEGORIES) if (c !== "poetry") out.push({ url: u(`/${l}/category/${c}`), changeFrequency: "hourly", priority: 0.7 });
    for (const p of [...PAGE_SLUGS]) out.push({ url: u(`/${l}/${p}`), changeFrequency: "monthly", priority: 0.4 });
    for (const p of ["prayer-times", "rates", "gold-rate", "dollar-rate", "petrol-price", "psx", "crypto", "mandi-rates", "jobs", "columns"]) out.push({ url: u(`/${l}/${p}`), changeFrequency: "daily", priority: 0.9 });
    for (const c of CITIES) out.push({ url: u(`/${l}/prayer-times/${citySlug(c)}`), changeFrequency: "daily", priority: 0.7 });
  }
  out.push({ url: u("/ur/poetry"), changeFrequency: "weekly", priority: 0.7 });
  out.push({ url: u("/ur/aqwal"), changeFrequency: "weekly", priority: 0.6 });
  out.push({ url: u("/ur/daily"), changeFrequency: "daily", priority: 0.6 });
  out.push({ url: u("/ur/history"), changeFrequency: "monthly", priority: 0.6 });
  for (const h of HISTORY) out.push({ url: u(`/ur/history/${h.slug}`), changeFrequency: "yearly", priority: 0.6 });
  for (const p of POETS) {
    out.push({ url: u(`/ur/poetry/${p.slug}`), changeFrequency: "monthly", priority: 0.6 });
    for (const q of p.poems) out.push({ url: u(`/ur/poetry/${p.slug}/${q.slug}`), changeFrequency: "yearly", priority: 0.5 });
  }
  try {
    await connectDB();
    const arts = await Article.find({ status: "published" }, { slug: 1, category: 1, updatedAt: 1, publishedAt: 1, "translations.en.title": 1, "translations.en.summary": 1, "translations.ur.title": 1 })
      .sort({ publishedAt: -1 }).limit(2000).lean();
    const writers = await Article.find({ status: "published", "author.name": { $exists: true, $ne: "" } }, { "author.name": 1 }).limit(500).lean();
    for (const n of new Set(writers.map((x) => writerSlug(x.author.name)).filter(Boolean))) for (const l of LANGS) out.push({ url: u(`/${l}/writers/${n}`), changeFrequency: "weekly", priority: 0.5 });
    for (const a of arts) {
      if (isThinForSearch(a)) continue;
      for (const l of LANGS) {
        if (!a.translations?.[l]) continue;
        if (a.category === "poetry" && l !== "ur") continue;
        const langs = Object.fromEntries(LANGS.filter((x) => a.translations?.[x] && !(a.category === "poetry" && x !== "ur")).map((x) => [x, u(`/${x}/news/${a.slug}`)]));
        out.push({ url: u(`/${l}/news/${a.slug}`), lastModified: a.updatedAt || a.publishedAt, changeFrequency: "daily", priority: 0.8, alternates: { languages: langs } });
      }
    }
    const jobs = await Job.find({ status: "published" }).select("slug updatedAt lastDate").sort({ publishedAt: -1 }).limit(500).lean();
    for (const j of jobs) { if (!j.slug || (j.lastDate && j.lastDate < new Date(Date.now() - 14 * 864e5))) continue; for (const l of LANGS) out.push({ url: u(`/${l}/jobs/${j.slug}`), lastModified: j.updatedAt, changeFrequency: "daily", priority: 0.7 }); }
  } catch {}
  return out;
}
