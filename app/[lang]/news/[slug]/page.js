import { PoetryUrduOnly } from "@/components/PoetryGate";
import { isThinForSearch } from "@/lib/indexGate";
import { notFound } from "next/navigation";
import { getArticle, getRelated, getMostRead, pickText, getReelFor } from "@/lib/queries";
import { Sidebar } from "@/components/SiteChrome";
import AdSlot from "@/components/Ads";
import { DICT } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { LANGS } from "@/models";
import ViewTracker from "@/components/ViewTracker";
import { resolveVisual } from "@/lib/visual";
import { ArticleView, ShareBar, Story } from "@/components/Stories";
import StoryFaq, { faqJsonLd } from "@/components/StoryFaq";

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  if (!DICT[lang]) return {};
  const a = await getArticle(slug);
  if (!a) return {};
  const x = pickText(a, lang);
  const desc = x.metaDescription || x.summary;
  const url = `${SITE.url}/${lang}/news/${slug}`;
  return {
    title: x.title,
    description: desc,
    ...(a.faq?.keywords?.[lang === "ur" ? "ur" : "en"]?.length ? { keywords: a.faq.keywords[lang === "ur" ? "ur" : "en"] } : {}),
    ...(isThinForSearch(a) ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: `/${lang}/news/${slug}`,
      languages: Object.fromEntries(Object.keys(a.translations || {}).filter((l) => LANGS.includes(l)).map((l) => [l, `/${l}/news/${slug}`])),
    },
    // The share image comes from ./opengraph-image.js (photo + Pak Dharti TV logo)
    openGraph: {
      type: "article", title: x.title, description: x.summary || desc, url,
      siteName: DICT[lang].site, locale: lang === "ur" ? "ur_PK" : "en_US",
      publishedTime: a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined,
      modifiedTime: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
      section: DICT[lang].cats?.[a.category],
    },
    twitter: { card: "summary_large_image", title: x.title, description: x.summary || desc },
  };
}

export default async function ArticlePage({ params }) {
  const { lang, slug } = await params;
  if (!DICT[lang]) notFound();
  const a = await getArticle(slug);
  if (!a) notFound();
  if (a.category === "poetry" && lang !== "ur") return <PoetryUrduOnly lang={lang} />;
  const t = DICT[lang];
  const x = pickText(a, lang);
  const [related, mostRead, reel] = await Promise.all([getRelated(a, 3), getMostRead(), lang === "ur" ? getReelFor(slug) : null]);   // the video speaks Urdu: shown on the Urdu page
  // A story about 2-3 public figures gets a collage of their licensed library photos instead of a stock photo
  let collage = [];
  if ((a.visual?.people?.length || 0) >= 2) {
    try { collage = (await resolveVisual(a)).people.filter((p) => p.photo).slice(0, 3); } catch { collage = []; }
    if (collage.length < 2) collage = [];
  }

  const pageUrl = `${SITE.url}/${lang}/news/${slug}`;
  const absImg = (u) => (u ? (/^https?:/i.test(u) ? u : `${SITE.url}${u.startsWith("/") ? "" : "/"}${u}`) : undefined);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": a.contentType === "opinion" ? "OpinionNewsArticle" : "NewsArticle",
    headline: (x.title || "").slice(0, 110), description: x.metaDescription || x.summary || undefined,
    inLanguage: lang, url: pageUrl, mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    articleSection: DICT[lang].cats?.[a.category] || a.category,
    datePublished: a.publishedAt, dateModified: a.updatedAt || a.publishedAt,
    image: [absImg(a.image?.url) || `${SITE.url}/brand/og-default.jpg`],
    author: a.author?.name
      ? { "@type": "Person", name: a.author.name, ...(a.author.url ? { url: a.author.url } : {}), ...(a.author.photo ? { image: absImg(a.author.photo) } : {}), ...(a.author.role ? { jobTitle: a.author.role } : {}) }
      : { "@type": "Organization", name: t.desk },
    publisher: { "@type": "Organization", name: "Pak Dharti TV", logo: { "@type": "ImageObject", url: `${SITE.url}/brand/icon-512.png` } },
  };

  const crumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.home, item: `${SITE.url}/${lang}` },
      { "@type": "ListItem", position: 2, name: t.cats?.[a.category] || a.category, item: `${SITE.url}/${lang}/category/${a.category}` },
      { "@type": "ListItem", position: 3, name: x.title, item: pageUrl },
    ],
  };

  return (
    <div className="wrap with-sidebar article-wrap">
      <div className="main-col">
        <ViewTracker slug={slug} lang={lang} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs).replace(/</g, "\\u003c") }} />
        {faqJsonLd(a.faq, lang, pageUrl) && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(a.faq, lang, pageUrl)).replace(/</g, "\\u003c") }} />}
        <ArticleView a={a} lang={lang} collage={collage} reel={reel}>
          <ShareBar lang={lang} url={`${SITE.url}/${lang}/news/${slug}`} title={x.title} />
        </ArticleView>
        <StoryFaq faq={a.faq} lang={lang} />
        <AdSlot name="inArticle" />

        {related.length > 0 && (
          <aside className="related" aria-labelledby="related-h">
            <h2 className="sec-title" id="related-h">{t.related}</h2>
            <div className="grid-3">
              {related.map((r) => <Story key={r.slug} a={r} lang={lang} variant="card" showCategory={false} />)}
            </div>
          </aside>
        )}
      </div>
      <Sidebar lang={lang} mostRead={mostRead.filter((m) => m.slug !== slug).slice(0, 5)} />
    </div>
  );
}
