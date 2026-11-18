import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { AQWAL_SECTIONS, sayingOfTheDay } from "@/lib/aqwal";
import QuoteList from "@/components/QuoteList";
import { UrduOnly } from "@/components/PoetryGate";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (lang !== "ur") return { robots: { index: false } };
  return {
    title: "اقوالِ زریں اور اچھی باتیں",
    description: "قائدِ اعظم کے فرمودات، زندگی، علم، اخلاق، صحت اور وطن سے محبت کی اچھی باتیں اور اردو کہاوتیں — خوبصورت تصویر میں محفوظ کریں اور شیئر کریں۔",
    alternates: { canonical: "/ur/aqwal" },
  };
}

export default async function AqwalPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  if (lang !== "ur") return <UrduOnly lang={lang} href="/ur/aqwal" title={{ en: "Sayings", ar: "أقوال", de: "Weisheiten" }} />;
  const today = sayingOfTheDay();
  const sec = AQWAL_SECTIONS.find((s) => s.key === today.section);
  return (
    <div className="poetry aqwal">
      <section className="poetry-hero">
        <div className="wrap">
          <p className="poetry-kicker">اقوالِ زریں</p>
          <h1>سنہری باتیں</h1>
          <p className="poetry-lede">قائدِ اعظم کے فرمودات، زندگی، علم، اخلاق، صحت اور وطن سے محبت کی اچھی باتیں، اور ہماری کہاوتیں۔ ہر بات کو خوبصورت تصویر میں محفوظ کریں یا تحریر کاپی کر کے اپنوں تک پہنچائیں۔</p>
        </div>
      </section>
      <div className="wrap">
        <section className="verse-of-day" aria-labelledby="sod">
          <h2 id="sod" className="vod-label">آج کی بات</h2>
          <div className="vod-card">
            <div className="verse-block"><p>{today.text}</p></div>
            {today.by && <p className="vod-poet">— {today.by}</p>}
            {today.source && <p className="q-src">{today.source}</p>}
          </div>
        </section>
        <nav className="aqwal-jump" aria-label="حصے">
          {AQWAL_SECTIONS.map((s) => <a key={s.key} href={`#${s.key}`}>{s.title}</a>)}
        </nav>
        {AQWAL_SECTIONS.map((s) => (
          <section key={s.key} id={s.key} className="block aqwal-section">
            <h2 className="sec-title">{s.title}</h2>
            <p className="aqwal-intro">{s.intro}</p>
            <QuoteList section={{ title: s.title, items: s.items }} sectionKey={s.key} />
          </section>
        ))}
        <p className="poetry-note">
          کسی شخصیت سے منسوب اقوال صرف وہی ہیں جن کا ماخذ معلوم ہے: قائدِ اعظم کے فرمودات تقریر کی تاریخ اور مقام کے ساتھ۔ باقی اچھی باتیں پاک دھرتی ٹی وی کی اپنی ہیں۔
          سوشل میڈیا پر بہت سے اقوال غلط ناموں سے منسوب کیے جاتے ہیں؛ ہم ایسے اقوال شائع نہیں کرتے۔
        </p>
      </div>
    </div>
  );
}
