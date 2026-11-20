import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import { SITE } from "@/lib/site";
import UtilShell from "@/components/UtilShell";
import AdSlot from "@/components/Ads";
import { alt } from "@/lib/utilPage";
import { jobBySlug, fmtDate, daysLeft, pick } from "@/lib/jobView";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  if (!LANGS.includes(lang)) return {};
  const j = await jobBySlug(slug).catch(() => null);
  if (!j) return {};
  const closed = daysLeft(j.lastDate) < -14;
  return {
    title: `${pick(j.title, lang)} — ${pick(j.org, lang)}`,
    description: pick(j.summary, lang).slice(0, 300),
    alternates: alt(lang, `/jobs/${slug}`),
    ...(closed ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function JobPage({ params }) {
  const { lang, slug } = await params;
  if (!LANGS.includes(lang)) notFound();
  const j = await jobBySlug(slug).catch(() => null);
  if (!j) notFound();
  const ur = lang === "ur", dl = daysLeft(j.lastDate), closed = dl < 0;
  const url = `${SITE.url}/${lang}/jobs/${slug}`;
  const ld = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: pick(j.title, lang), description: [pick(j.summary, lang), pick(j.qualification, lang), pick(j.howTo, lang)].filter(Boolean).join(" "),
    datePosted: new Date(j.publishedAt || j.createdAt).toISOString().slice(0, 10), validThrough: new Date(j.lastDate).toISOString(),
    hiringOrganization: { "@type": "Organization", name: pick(j.org, "en") },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "PK", ...(j.location ? { addressLocality: j.location } : {}) } },
    directApply: false, url, inLanguage: lang,
  };
  const row = (k, v) => v ? <tr><th scope="row">{k}</th><td>{v}</td></tr> : null;
  return (
    <UtilShell lang={lang} current="jobs" h1={pick(j.title, lang)} lede={pick(j.org, lang)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      {closed && <p className="job-closed">{ur ? "اس اشتہار کی آخری تاریخ گزر چکی ہے۔" : "The closing date of this ad has passed."}</p>}
      <p>{pick(j.summary, lang)}</p>
      <div className="table-scroll">
        <table className="util-table job-table"><tbody>
          {row(ur ? "ادارہ" : "Organisation", pick(j.org, lang))}
          {row(ur ? "آخری تاریخ" : "Last date", `${fmtDate(j.lastDate, lang)}${!closed && dl <= 7 ? ` · ${ur ? `${dl} دن باقی` : `${dl} day${dl === 1 ? "" : "s"} left`}` : ""}`)}
          {row(ur ? "آسامیاں" : "Posts", j.positions)}
          {row(ur ? "اہلیت" : "Qualification", pick(j.qualification, lang))}
          {row(ur ? "مقام" : "Location", j.location)}
          {row(ur ? "درخواست کیسے دیں" : "How to apply", pick(j.howTo, lang))}
        </tbody></table>
      </div>
      {j.soft && <p className="rates-note"><b>{ur ? "نوٹ:" : "Note:"}</b> {ur ? "آخری تاریخ اشتہار سے لی گئی ہے مگر اشتہار میں اسے واضح لفظوں میں نہیں لکھا گیا۔ درخواست سے پہلے اصل اشتہار میں آخری تاریخ ضرور دیکھ لیں۔" : "The closing date was read from the advertisement, which does not label it clearly. Please confirm it in the original advertisement before applying."}</p>}
      <p className="job-links">
        <a className="job-btn" href={j.sourceUrl} target="_blank" rel="noopener nofollow">{ur ? "ادارے کا اصل اشتہار" : "Original ad on the official site"}</a>{" "}
        {j.adUrl && j.adUrl !== j.sourceUrl && <a className="job-btn alt" href={j.adUrl} target="_blank" rel="noopener nofollow">{ur ? "اشتہار (PDF)" : "Advertisement (PDF)"}</a>}{" "}
        {j.applyUrl && <a className="job-btn alt" href={j.applyUrl} target="_blank" rel="noopener nofollow">{ur ? "درخواست کا لنک" : "Apply link"}</a>}
      </p>
      <p className="rates-note">{ur ? `ماخذ: ${j.sourceName} کی سرکاری ویب سائٹ۔ تفصیلات اشتہار سے لی گئی ہیں؛ درخواست دینے سے پہلے اصل اشتہار ضرور دیکھیں۔ کسی کو درخواست کے لیے رقم نہ دیں۔`
        : `Source: the official website of ${j.sourceName}. Details are taken from the advertisement; check the original before applying. Never pay anyone to apply.`}</p>
      <p><a href={`/${lang}/jobs`}>{ur ? "← تمام ملازمتیں" : "← All jobs"}</a></p>
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
