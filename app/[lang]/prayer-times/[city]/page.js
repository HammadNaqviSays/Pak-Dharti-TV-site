import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { W } from "@/lib/widgetText";
import { CITIES, prayerTimes, todayIn, methodFor, asrFor, METHODS, citySlug, cityBySlug } from "@/lib/prayTimes";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { lang, city } = await params;
  const c = cityBySlug(city);
  if (!LANGS.includes(lang) || !c) return {};
  const name = lang === "ur" ? c.ur : c.n, d = todayLabel(lang);
  return {
    title: lang === "ur" ? `${name} میں آج نماز کے اوقات — ${d}` : `Prayer times in ${name} today — ${d}`,
    description: lang === "ur"
      ? `${d}: ${name} میں فجر، ظہر، عصر، مغرب اور عشاء کے اوقات، سحری، افطار، اشراق، چاشت اور تہجد کا وقت — حنفی اور جعفری۔`
      : `Namaz timings in ${name} on ${d}: Fajr, Dhuhr, Asr, Maghrib and Isha, plus Sehri, Iftar, Ishraq, Chasht and Tahajjud — Hanafi and Jafari.`,
    alternates: alt(lang, `/prayer-times/${city}`),
  };
}

export default async function CityPrayerPage({ params }) {
  const { lang, city } = await params;
  const c = cityBySlug(city);
  if (!LANGS.includes(lang) || !c) notFound();
  const w = W[lang], ur = lang === "ur";
  const day = todayIn(c.tz);
  const school = asrFor(c.c);
  const s = prayerTimes(day, c.lat, c.lng, { method: methodFor(c.c), asr: school });
  const j = prayerTimes(day, c.lat, c.lng, { asr: "jafari" });
  const fmt = (d) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: c.tz }).format(d);
  const name = ur ? c.ur : c.n, d = todayLabel(lang);
  const sunniLabel = school === "hanafi" ? w.hanafi : w.shafi;
  const farz = [
    [w.names.fajr, s.fajr, j.fajr],
    [w.sunriseRow, s.sunrise, j.sunrise, true],
    [w.names.dhuhr, s.dhuhr, j.dhuhr],
    [w.names.asr, s.asr, j.asr],
    [w.names.maghrib, s.maghrib, j.maghrib],
    [w.names.isha, s.isha, j.isha],
  ];
  const nafl = [
    [w.tahajjud, s.tahajjud],
    [w.ishraq, s.ishraq],
    [w.chasht, s.chasht],
    [w.zawal, s.zawal, true],
  ];
  const roza = [
    [w.sehri, s.fajr, j.imsak],
    [w.iftar, s.maghrib, j.maghrib],
  ];
  const dash = "—";
  const qa = ur
    ? `${d} کو ${name} میں فجر ${fmt(s.fajr)}، ظہر ${fmt(s.dhuhr)}، عصر ${fmt(s.asr)}، مغرب ${fmt(s.maghrib)} اور عشاء ${fmt(s.isha)} بجے ہے۔`
    : `On ${d} in ${name}: Fajr ${fmt(s.fajr)}, Dhuhr ${fmt(s.dhuhr)}, Asr ${fmt(s.asr)}, Maghrib ${fmt(s.maghrib)} and Isha ${fmt(s.isha)}.`;
  const faq = ur ? [
    { q: `${name} میں آج نماز کے اوقات کیا ہیں؟`, a: qa },
    { q: `${name} میں آج سحری اور افطار کا وقت کیا ہے؟`, a: `سحری ${fmt(s.fajr)} پر ختم ہوتی ہے اور افطار ${fmt(s.maghrib)} پر ہے۔` },
    { q: `${name} میں تہجد کا وقت کیا ہے؟`, a: `تہجد کا بہترین وقت رات کے آخری تہائی میں، تقریباً ${fmt(s.tahajjud)} سے فجر تک ہے۔` },
  ] : [
    { q: `What are the prayer times in ${name} today?`, a: qa },
    { q: `What time is Sehri and Iftar in ${name} today?`, a: `Sehri ends at ${fmt(s.fajr)} and Iftar is at ${fmt(s.maghrib)}.` },
    { q: `What is the Tahajjud time in ${name}?`, a: `The best time for Tahajjud is the last third of the night, from about ${fmt(s.tahajjud)} until Fajr.` },
  ];
  return (
    <UtilShell lang={lang} current="prayer-times" h1={ur ? `${name} میں نماز کے اوقات — ${d}` : `Prayer times in ${name} — ${d}`}
      lede={ur ? `${name} کے لیے آج کے نماز، سحری اور افطار کے اوقات، اشراق، چاشت اور تہجد کے ساتھ۔` : `Today's namaz, Sehri and Iftar timings for ${name}, with Ishraq, Chasht and Tahajjud.`}>
      <QuickAnswer>{qa}</QuickAnswer>
      <section className="rates-section">
        <h2 className="sec-title">{w.farzHead}</h2>
        <div className="table-scroll">
          <table className="util-table">
            <thead><tr><th>{ur ? "نماز" : "Prayer"}</th><th>{sunniLabel}</th><th>{w.jafari}</th></tr></thead>
            <tbody>
              {farz.map(([label, a, b, dim]) => (
                <tr key={label} className={dim ? "dim-row" : undefined}><th scope="row">{label}</th><td dir="ltr">{fmt(a)}</td><td dir="ltr">{fmt(b)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rates-section">
        <h2 className="sec-title">{w.naflHead}</h2>
        <div className="table-scroll">
          <table className="util-table">
            <thead><tr><th>{ur ? "نفل" : "Prayer"}</th><th>{w.time}</th></tr></thead>
            <tbody>
              {nafl.map(([label, a, dim]) => (
                <tr key={label} className={dim ? "dim-row" : undefined}><th scope="row">{label}</th><td dir="ltr">{fmt(a)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rates-section">
        <h2 className="sec-title">{w.rozaHead}</h2>
        <div className="table-scroll">
          <table className="util-table">
            <thead><tr><th>{ur ? "روزہ" : "Fast"}</th><th>{sunniLabel}</th><th>{w.jafari}</th></tr></thead>
            <tbody>
              {roza.map(([label, a, b]) => (
                <tr key={label}><th scope="row">{label}</th><td dir="ltr">{fmt(a)}</td><td dir="ltr">{fmt(b)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="rates-note">{w.naflNote}</p>
      <p className="rates-note">{w.method}: {METHODS[methodFor(c.c)].name}. {w.approx}</p>
      <section className="rates-section">
        <h2 className="sec-title">{w.cities}</h2>
        <div className="util-city-links">
          {CITIES.filter((x) => citySlug(x) !== city).map((x) => <a key={x.n} href={`/${lang}/prayer-times/${citySlug(x)}`}>{ur ? x.ur : x.n}</a>)}
        </div>
      </section>
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
