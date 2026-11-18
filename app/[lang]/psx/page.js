import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { getKse } from "@/lib/psx";
import { money } from "@/lib/rates";
import { alt, todayLabel } from "@/lib/utilPage";
import UtilShell from "@/components/UtilShell";
import Faq, { QuickAnswer } from "@/components/Faq";
import AdSlot from "@/components/Ads";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  const d = todayLabel(lang);
  return {
    title: lang === "ur" ? `اسٹاک ایکسچینج KSE-100 انڈیکس آج — ${d}` : `PSX KSE-100 index today — ${d}`,
    description: lang === "ur"
      ? `${d}: پاکستان اسٹاک ایکسچینج کا KSE-100 انڈیکس، اوپن، ہائی، لو اور پچھلا کلوز۔`
      : `Pakistan Stock Exchange KSE-100 index on ${d}: latest value, change, open, high, low and previous close.`,
    alternates: alt(lang, "/psx"),
  };
}

export default async function PsxPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  const k = await getKse();
  const d = todayLabel(lang);
  const dir = k?.change > 0 ? "up" : k?.change < 0 ? "down" : "";
  const qa = k?.close ? (ur
    ? `KSE-100 انڈیکس ${k.live ? "اس وقت" : `آخری کاروباری دن (${k.day})`} ${money(k.close, 2)} پر ہے${k.change != null ? `، ${money(Math.abs(k.change), 2)} پوائنٹس ${k.change >= 0 ? "اضافہ" : "کمی"}` : ""}۔`
    : `The KSE-100 index ${k.live ? "is at" : `closed at`} ${money(k.close, 2)}${k.day && !k.live ? ` on ${k.day}` : ""}${k.change != null ? `, ${k.change >= 0 ? "up" : "down"} ${money(Math.abs(k.change), 2)} points (${k.pct >= 0 ? "+" : ""}${Number(k.pct).toFixed(2)}%)` : ""}.`) : null;
  const faq = k?.close ? (ur ? [
    { q: "آج KSE-100 انڈیکس کتنا ہے؟", a: qa },
    { q: "پاکستان اسٹاک ایکسچینج کب کھلتا ہے؟", a: "پیر سے جمعہ، صبح 9:30 سے سہ پہر 3:30 تک۔" },
  ] : [
    { q: "What is the KSE-100 index today?", a: qa },
    { q: "When is the Pakistan Stock Exchange open?", a: "Monday to Friday, 9:30 am to 3:30 pm Pakistan time." },
  ]) : [];
  const row = (label, v) => v != null && <tr key={label}><th scope="row">{label}</th><td dir="ltr">{money(v, 2)}</td></tr>;
  return (
    <UtilShell lang={lang} current="psx" h1={ur ? `KSE-100 انڈیکس — ${d}` : `PSX KSE-100 index — ${d}`}
      lede={ur ? "پاکستان اسٹاک ایکسچینج کا بنیادی انڈیکس۔ کاروبار پیر سے جمعہ، صبح 9:30 سے سہ پہر 3:30 تک ہوتا ہے؛ تعطیل پر آخری کاروباری دن کے اعداد دکھائے جاتے ہیں۔" : "The main index of the Pakistan Stock Exchange. Trading runs Monday to Friday, 9:30 am to 3:30 pm; on holidays the last session's figures are shown."}>
      <QuickAnswer>{qa}</QuickAnswer>
      {!k?.close ? <p className="empty">{ur ? "اعداد اس وقت دستیاب نہیں۔" : "Figures are temporarily unavailable."}</p> : (
        <>
          <div className="stat-row">
            <div className={`stat ${dir}`}>
              <span className="st-k">KSE-100</span><strong dir="ltr">{money(k.close, 2)}</strong>
              {k.change != null && <span className="st-s" dir="ltr">{k.change >= 0 ? "▲" : "▼"} {money(Math.abs(k.change), 2)} ({k.pct >= 0 ? "+" : ""}{Number(k.pct).toFixed(2)}%)</span>}
            </div>
          </div>
          <div className="table-scroll">
            <table className="util-table">
              <tbody>{[row(ur ? "اوپن" : "Open", k.open), row(ur ? "ہائی" : "High", k.high), row(ur ? "لو" : "Low", k.low), row(ur ? "پچھلا کلوز" : "Previous close", k.prevClose)]}</tbody>
            </table>
          </div>
          <p className="rates-note">
            {k.live ? (ur ? "کاروبار جاری ہے — اعداد بدل سکتے ہیں۔" : "Market is open — figures change during the session.") : (ur ? "مارکیٹ بند — آخری کاروباری دن کے اعداد۔" : "Market closed — figures from the last session.")}
            {" "}{ur ? "ماخذ: پاکستان اسٹاک ایکسچینج (PSX)۔" : "Source: Pakistan Stock Exchange (PSX)."}
          </p>
        </>
      )}
      <Faq lang={lang} items={faq} />
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
