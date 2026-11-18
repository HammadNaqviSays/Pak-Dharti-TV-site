import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { W } from "@/lib/widgetText";
import PrayerTimes from "@/components/PrayerTimes";
import { CITIES, citySlug } from "@/lib/prayTimes";
import { todayLabel } from "@/lib/utilPage";

export const revalidate = 86400;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!W[lang]) return {};
  return {
    title: W[lang].prayer,
    description: lang === "ur"
      ? "آپ کے شہر کے مطابق آج کے نماز کے اوقات: فجر، ظہر، عصر، مغرب اور عشاء۔ پاکستان اور دنیا بھر کے شہروں کے لیے۔"
      : "Today's prayer times for your city: Fajr, Dhuhr, Asr, Maghrib and Isha, for Pakistan and cities worldwide.",
    alternates: { canonical: `/${lang}/prayer-times`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/prayer-times`])) },
  };
}

export default async function PrayerPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  return (
    <div className="wrap prayer-page">
      <h1 className="page-title">{W[lang].prayer}</h1>
      <PrayerTimes lang={lang} t={W[lang]} variant="full" />
      <section className="rates-section">
        <h2 className="sec-title">{W[lang].cities} — {todayLabel(lang)}</h2>
        <div className="util-city-links">
          {CITIES.map((x) => <a key={x.n} href={`/${lang}/prayer-times/${citySlug(x)}`}>{lang === "ur" ? x.ur : x.n}</a>)}
        </div>
      </section>
    </div>
  );
}
