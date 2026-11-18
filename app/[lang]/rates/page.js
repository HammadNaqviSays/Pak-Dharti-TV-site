import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getRates } from "@/lib/rates";
import { W } from "@/lib/widgetText";
import { RatesTables } from "@/components/RatesBox";
import CurrencyCalc from "@/components/CurrencyCalc";
import AdSlot from "@/components/Ads";

export const revalidate = 1800;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!W[lang]) return {};
  const today = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date());
  return {
    title: `${W[lang].rates} — ${today}`,
    description: lang === "ur"
      ? "آج سونے کا نرخ فی تولہ (24، 22، 21 قیراط)، چاندی، ڈالر، یورو، پاؤنڈ، ریال اور درہم کے نرخ، اور کرنسی کیلکولیٹر۔"
      : "Today's gold rate per tola in Pakistan (24K, 22K, 21K), silver, and rupee exchange rates for USD, EUR, GBP, SAR, AED, with a currency calculator.",
    alternates: { canonical: `/${lang}/rates`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/rates`])) },
  };
}

export default async function RatesPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const w = W[lang];
  const rates = await getRates().catch(() => null);
  return (
    <div className="wrap rates-page">
      <h1 className="page-title">{w.rates}</h1>
      <RatesTables lang={lang} rates={rates} />
      {rates?.fx?.length > 0 && (
        <section className="rates-section">
          <h2 className="sec-title">{w.calc}</h2>
          <CurrencyCalc lang={lang} fx={rates.fx} t={w} />
        </section>
      )}
      <AdSlot name="inArticle" />
    </div>
  );
}
