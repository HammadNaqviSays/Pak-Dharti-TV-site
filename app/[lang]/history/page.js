import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { HISTORY } from "@/lib/history";
import { UrduOnly } from "@/components/PoetryGate";

export const revalidate = 86400;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (lang !== "ur") return { robots: { index: false } };
  return {
    title: "تاریخِ پاکستان",
    description: "خطبۂ الہ آباد، قراردادِ لاہور، قیامِ پاکستان، قائدِ اعظم، قراردادِ مقاصد، قومی ترانہ، 1973 کا آئین اور یومِ تکبیر — پاکستان کی تاریخ کے اہم سنگِ میل۔",
    alternates: { canonical: "/ur/history" },
  };
}

export default async function HistoryHome({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <UrduOnly lang={lang} href="/ur/history" title={{ en: "History of Pakistan", ar: "تاريخ باكستان", de: "Geschichte Pakistans" }} />;
  return (
    <div className="poetry history">
      <section className="poetry-hero">
        <div className="wrap">
          <p className="poetry-kicker">تاریخِ پاکستان</p>
          <h1>سنگِ میل</h1>
          <p className="poetry-lede">وہ لمحات جنہوں نے پاکستان کو بنایا اور سنوارا — مختصر، مستند اور آسان زبان میں۔</p>
        </div>
      </section>
      <div className="wrap">
        <ol className="timeline">
          {HISTORY.map((h) => (
            <li key={h.slug}>
              <a href={`/ur/history/${h.slug}`} className="tl-card">
                <span className="tl-date">{h.date}</span>
                <strong className="tl-title">{h.title}</strong>
                <span className="tl-sum">{h.summary}</span>
                <span className="vod-cta">پوری تحریر پڑھیں</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
