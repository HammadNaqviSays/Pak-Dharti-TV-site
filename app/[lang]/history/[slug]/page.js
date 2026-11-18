import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { HISTORY, findHistory } from "@/lib/history";
import { SITE } from "@/lib/site";
import { ShareBar } from "@/components/Stories";
import { UrduOnly } from "@/components/PoetryGate";

export const revalidate = 86400;
export function generateStaticParams() { return HISTORY.map((h) => ({ lang: "ur", slug: h.slug })); }

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  const h = findHistory(slug);
  if (lang !== "ur" || !h) return { robots: { index: false } };
  return { title: h.title, description: h.summary, alternates: { canonical: `/ur/history/${slug}` }, openGraph: { type: "article", title: h.title, description: h.summary } };
}

export default async function HistoryArticle({ params }) {
  const { lang, slug } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <UrduOnly lang={lang} href={`/ur/history/${slug}`} title={{ en: "History of Pakistan", ar: "تاريخ باكستان", de: "Geschichte Pakistans" }} />;
  const h = findHistory(slug);
  if (!h) notFound();
  const i = HISTORY.indexOf(h);
  const prev = HISTORY[i - 1], next = HISTORY[i + 1];
  return (
    <div className="wrap history-article">
      <article className="article">
        <div className="kicker"><a className="kicker-cat" href="/ur/history">تاریخِ پاکستان</a></div>
        <h1>{h.title}</h1>
        <p className="article-summary">{h.summary}</p>
        <p className="byline"><span className="byline-desk">{h.date}</span></p>
        <ShareBar lang="ur" url={`${SITE.url}/ur/history/${slug}`} title={h.title} />
        <div className="article-body">
          {h.body.map((b, k) => b.h ? <h2 key={k}>{b.h}</h2>
            : b.list ? <ul key={k}>{b.list.map((x, j) => <li key={j}>{x}</li>)}</ul>
            : <p key={k}>{b.p}</p>)}
        </div>
      </article>
      <nav className="history-nav" aria-label="مزید تاریخ">
        {prev && <a href={`/ur/history/${prev.slug}`}>→ {prev.title}</a>}
        {next && <a href={`/ur/history/${next.slug}`}>{next.title} ←</a>}
      </nav>
    </div>
  );
}
