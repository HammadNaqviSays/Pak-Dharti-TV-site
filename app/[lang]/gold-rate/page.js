import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getRates, money, GRAMS_PER_TOLA } from "@/lib/rates";
import { W } from "@/lib/widgetText";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import RichText from "@/components/RichText";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 1800;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  const g = (await getRates().catch(() => null))?.gold;
  const n = g?.tola24 ? money(g.tola24) : "";
  return {
    title: lang === "ur" ? `آج سونے کا نرخ پاکستان میں${n ? `: فی تولہ ${n} روپے` : ""} — ${d}` : `Gold rate in Pakistan today${n ? `: Rs ${n} per tola` : ""} — ${d}`,
    description: lang === "ur"
      ? `${d}: پاکستان میں آج سونے کا نرخ فی تولہ اور فی 10 گرام (24، 22، 21، 18 قیراط) اور چاندی کا نرخ۔`
      : `Gold rate in Pakistan on ${d}: price per tola and per 10 grams for 24K, 22K, 21K and 18K gold, plus silver.`,
    alternates: alt(lang, "/gold-rate"),
  };
}

export default async function GoldPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const w = W[lang], ur = lang === "ur";
  const rates = await getRates().catch(() => null);
  const g = rates?.gold;
  const d = todayLabel(lang);
  const qa = g ? (ur
    ? `${d} کو پاکستان میں 24 قیراط سونے کا نرخ **${money(g.tola24)} PKR** فی تولہ ہے، جبکہ 22 قیراط کا **${money(g.tola22)} PKR** فی تولہ۔ 10 گرام (24 قیراط) کا نرخ **${money(g.tenGram24)} PKR** ہے۔`
    : `On ${d}, the gold rate in Pakistan is **${money(g.tola24)} PKR** per tola for 24-carat gold and **${money(g.tola22)} PKR** per tola for 22-carat gold. That is **${money(g.tenGram24)} PKR** per 10 grams (24K).`) : null;
  const faq = g ? (ur ? [
    { q: "آج پاکستان میں سونے کا نرخ کیا ہے؟", a: qa },
    { q: "ایک تولہ میں کتنے گرام ہوتے ہیں؟", a: "ایک تولہ 11.664 گرام کے برابر ہوتا ہے۔" },
    { q: "دکان پر سونے کا نرخ اس سے مختلف کیوں ہوتا ہے؟", a: "زیورات کی قیمت میں بنوائی (making charges) شامل ہوتی ہے، اور مقامی صرافہ مارکیٹ کا نرخ عالمی قیمت سے کچھ مختلف ہو سکتا ہے۔" },
  ] : [
    { q: "What is the gold rate in Pakistan today?", a: qa },
    { q: "How many grams are in one tola?", a: "One tola is 11.664 grams." },
    { q: "Why is the jeweller's price different from this rate?", a: "Jewellery prices include making charges, and local sarafa market rates can differ slightly from the international price." },
  ]) : [];
  const rows = g ? [["k24", g.tola24], ["k22", g.tola22], ["k21", g.tola21], ["k18", g.tola18]] : [];
  return (
    <UtilShell lang={lang} current="gold-rate" h1={ur ? `آج سونے کا نرخ — ${d}` : `Gold rate in Pakistan today — ${d}`}
      lede={ur
        ? "پاکستان میں سونا فی تولہ بکتا ہے (1 تولہ = 11.664 گرام)۔ نیچے 24، 22، 21 اور 18 قیراط کے نرخ فی تولہ اور فی 10 گرام دیے گئے ہیں۔"
        : "Gold in Pakistan is sold per tola (1 tola = 11.664 grams). Below are 24K, 22K, 21K and 18K prices per tola and per 10 grams."}>
      <QuickAnswer>{qa}</QuickAnswer>
      {!g ? <p className="empty">{w.unavailable}</p> : (
        <>
          <div className="stat-row">
            <div className="stat"><span className="st-k"><RichText text={`${w.k24} · ${w.perTola}`} /></span><strong dir="ltr">{money(g.tola24)} PKR</strong><span className="st-s"><RichText text={ur ? "10 گرام" : "10 g"} />: <span dir="ltr">{money(g.tenGram24)} PKR</span></span></div>
            {rates.silver && <div className="stat"><span className="st-k"><RichText text={`${w.silver} · ${w.perTola}`} /></span><strong dir="ltr">{money(rates.silver.tola)} PKR</strong><span className="st-s"><RichText text={ur ? "10 گرام" : "10 g"} />: <span dir="ltr">{money(rates.silver.gram * 10)} PKR</span></span></div>}
            {g.ounceUsd && <div className="stat"><span className="st-k">{w.ounce}</span><strong dir="ltr">${money(g.ounceUsd, 2)}</strong></div>}
          </div>
          <div className="table-scroll">
            <table className="util-table">
              <thead><tr><th>{ur ? "قیراط" : "Purity"}</th><th><RichText text={w.perTola} /></th><th><RichText text={w.per10g} /></th><th><RichText text={w.perGram} /></th></tr></thead>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}><th scope="row"><RichText text={w[k]} /></th><td dir="ltr">{money(v)} PKR</td><td dir="ltr">{money((v / GRAMS_PER_TOLA) * 10)} PKR</td><td dir="ltr">{money(v / GRAMS_PER_TOLA)} PKR</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rates-note">{g.source === "sarafa" ? (g.sourceName ? (ur ? `صرافہ مارکیٹ کا نرخ، ماخذ: ${g.sourceName}` : `Local sarafa rate as reported by ${g.sourceName}`) : w.sarafa) : w.intl}. {w.updated}: <span dir="ltr">{(() => { try { return new Date(g.at || rates.date).toISOString().slice(0, 10); } catch { return ""; } })()}</span></p>
          <p className="rates-note">{ur ? "زیورات کی خریداری پر بنوائی (making charges) اور مقامی صرافہ کے فرق کی وجہ سے دکان کا نرخ مختلف ہو سکتا ہے۔" : "Jewellery prices include making charges, and local sarafa rates can differ from the figures above."}</p>
        </>
      )}
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
