import { notFound } from "next/navigation";
import { getHomepage, getMostRead } from "@/lib/queries";
import { DICT } from "@/lib/i18n";
import { LANGS } from "@/models";
import { Ticker, Sidebar, navFor } from "@/components/SiteChrome";
import RateStrip from "@/components/RateStrip";
import { verseOfTheDay } from "@/lib/poetry";
import { Story, stamp } from "@/components/Stories";
import LeadSlider from "@/components/LeadSlider";
import { pickText } from "@/lib/queries";

export const revalidate = 120; // also refreshed instantly by revalidatePath() on publish

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!DICT[lang]) return {};
  return {
    title: { absolute: lang === "ur" ? "پاک دھرتی ٹی وی | پاکستان اور دنیا کی تازہ خبریں" : lang === "en" ? "Pak Dharti TV | Latest Pakistan & World News in English and Urdu" : `${DICT[lang].site} | ${DICT[lang].tagline}` },
    description: lang === "ur"
      ? "پاک دھرتی ٹی وی: پاکستان اور دنیا بھر کی تازہ ترین خبریں، سیاست، کھیل، کاروبار اور تفریح — اردو اور انگریزی میں۔"
      : "Pak Dharti TV: the latest news from Pakistan and the world — politics, sports, business and entertainment — in English and Urdu.",
    alternates: { canonical: `/${lang}`, languages: { en: "/en", ur: "/ur", "x-default": "/en" }, types: { "application/rss+xml": `/${lang}/feed.xml` } },
  };
}

export default async function Home({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const t = DICT[lang];
  const [home, mostRead] = await Promise.all([getHomepage(), getMostRead()]);
  // Poetry belongs to the Urdu site only
  const keep = (a) => lang === "ur" || a.category !== "poetry";
  const breaking = home.breaking.filter(keep), latest = home.latest.filter(keep), ticker = home.ticker.filter(keep);
  const byCategory = home.byCategory;
  const vod = lang === "ur" ? verseOfTheDay() : null;

  // Top of the page: a rotating set of the hottest stories of the last day (a fresh pin first).
  // "Hot" = reads per hour of age, so a new story with readers beats an old one.
  const now = Date.now();
  const ageH = (a) => Math.max(0, (now - new Date(a.publishedAt).getTime()) / 3600e3);
  const hot = (a) => ((a.stats?.views || 0) + 4) / Math.pow(ageH(a) + 2, 1.4);
  const withPhoto = (a) => a.image?.url && !/\/images\/categories\//.test(a.image.url);
  const recent = latest.filter((a) => ageH(a) < 24);
  const ranked = [...recent].sort((x, y) => (hot(y) + (withPhoto(y) ? 0.3 : 0)) - (hot(x) + (withPhoto(x) ? 0.3 : 0)));
  const leadSet = [];
  for (const a of [...breaking, ...ranked, ...latest]) {
    if (leadSet.length >= 6) break;
    if (!leadSet.some((b) => String(b._id) === String(a._id))) leadSet.push(a);
  }
  const lead = leadSet[0];
  if (!lead) return <div className="wrap"><p className="empty">{t.empty}</p></div>;
  const leadIds = new Set(leadSet.map((a) => String(a._id)));
  const seen = new Set();
  const fresh = latest.filter((a) => !leadIds.has(String(a._id)) && (seen.has(String(a._id)) ? false : seen.add(String(a._id)))).slice(0, 9);
  const slides = leadSet.map((a) => {
    const x = pickText(a, lang);
    return {
      href: `/${lang}/news/${a.slug}`, img: a.image?.url || "", title: x.title, summary: x.summary, fallback: x.fallback,
      titleEn: a.translations?.en?.title || "", category: a.category, cat: t.cats[a.category],
      type: a.contentType !== "news" ? t.types[a.contentType] : "", time: a.publishedAt ? stamp(a.publishedAt, lang) : "",
    };
  });

  return (
    <>
      <h1 className="sr-only">{lang === "ur" ? "پاک دھرتی ٹی وی: پاکستان اور دنیا کی تازہ خبریں" : "Pak Dharti TV: latest Pakistan and world news"}</h1>
      <Ticker lang={lang} items={ticker} />
      <RateStrip lang={lang} />
      <div className="wrap with-sidebar">
        <div className="main-col">
          <section className="front" aria-label={t.topStories}>
            <LeadSlider items={slides} lang={lang} />
          </section>

          {fresh.length > 0 && (
            <section className="block" aria-labelledby="latest-h">
              <h2 className="sec-title" id="latest-h">{t.latest}</h2>
              <div className="grid-3">
                {fresh.map((a) => <Story key={a.slug} a={a} lang={lang} variant="card" />)}
              </div>
            </section>
          )}

          {vod && (
            <section className="poetry home-verse" aria-labelledby="vod-home">
              <div className="verse-of-day">
                <h2 id="vod-home" className="vod-label">آج کا شعر</h2>
                <a href={`/ur/poetry/${vod.poet.slug}/${vod.poem.slug}`} className="vod-card">
                  <div className="verse-block">
                    {vod.poem.lines.slice(0, 2).map((c, i) => <div key={i} className="couplet">{c.filter(Boolean).map((m, j) => <p key={j}>{m}</p>)}</div>)}
                  </div>
                  <p className="vod-poet">— {vod.poet.name}</p>
                  <span className="vod-cta">شعر و ادب کا مکمل گوشہ دیکھیں</span>
                </a>
              </div>
            </section>
          )}

          {navFor(lang).filter((c) => byCategory[c]?.length).map((c) => (
            <section key={c} className="block" aria-labelledby={`h-${c}`}>
              <div className="sec-head">
                <h2 className="sec-title" id={`h-${c}`}>{t.cats[c]}</h2>
                <a className="see-all" href={`/${lang}/category/${c}`}>{t.seeAll}</a>
              </div>
              <div className="grid-3">
                {byCategory[c].slice(0, 3).map((a) => <Story key={a.slug} a={a} lang={lang} variant="card" showCategory={false} />)}
              </div>
            </section>
          ))}
        </div>
        <Sidebar lang={lang} mostRead={mostRead} />
      </div>
    </>
  );
}
