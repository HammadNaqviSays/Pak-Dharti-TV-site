import { notFound } from "next/navigation";
import { LANGS } from "@/models";
import UtilShell from "@/components/UtilShell";
import AdSlot from "@/components/Ads";
import { alt } from "@/lib/utilPage";
import { openJobs, fmtDate, daysLeft, pick } from "@/lib/jobView";

export const revalidate = 900;

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) return {};
  return {
    title: lang === "ur" ? "سرکاری اور بینک ملازمتیں — تازہ اشتہارات" : "Government and bank jobs in Pakistan — latest official ads",
    description: lang === "ur" ? "سرکاری کمیشنوں، بینکوں اور اداروں کی اپنی ویب سائٹس سے لی گئی تازہ ملازمتیں، آخری تاریخ اور درخواست دینے کے اصل لنک کے ساتھ۔"
      : "Latest jobs taken from the official websites of public service commissions, banks and organisations, with the closing date and the original link to apply.",
    alternates: alt(lang, "/jobs"),
  };
}

export default async function JobsPage({ params }) {
  const { lang } = await params;
  if (!LANGS.includes(lang)) notFound();
  const ur = lang === "ur";
  const jobs = await openJobs().catch(() => []);
  return (
    <UtilShell lang={lang} current="jobs" h1={ur ? "سرکاری اور بینک ملازمتیں" : "Government and bank jobs"}
      lede={ur ? "یہ اشتہارات صرف اداروں کی اپنی سرکاری ویب سائٹس سے لیے جاتے ہیں۔ ہر اشتہار کے ساتھ اصل لنک ہے؛ درخواست دینے سے پہلے وہیں تصدیق کریں۔ کسی ادارے کو درخواست کے لیے رقم نہ دیں۔"
        : "Every ad here is taken from the organisation's own official website, with the original link. Check the details there before you apply, and never pay anyone to apply."}>
      {!jobs.length ? <p className="empty">{ur ? "اس وقت کوئی تصدیق شدہ اشتہار موجود نہیں۔" : "No verified ads right now."}</p> : (
        <div className="job-list">
          {jobs.map((j) => {
            const dl = daysLeft(j.lastDate);
            return (
              <a key={String(j._id)} className="job-card" href={`/${lang}/jobs/${j.slug}`}>
                <span className="job-org">{pick(j.org, lang)}</span>
                <strong className="job-title">{pick(j.title, lang)}</strong>
                {pick(j.qualification, lang) && <span className="job-line">{pick(j.qualification, lang)}</span>}
                <span className="job-meta">
                  {j.positions && <span>{j.positions}</span>}
                  <span className={dl <= 3 ? "job-soon" : ""}>{ur ? "آخری تاریخ" : "Last date"}: {fmtDate(j.lastDate, lang)}{dl <= 7 ? ` · ${ur ? `${dl} دن باقی` : `${dl} day${dl === 1 ? "" : "s"} left`}` : ""}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
      <p className="rates-note">{ur ? "فہرست روزانہ دو بار اداروں کی ویب سائٹس سے اپ ڈیٹ ہوتی ہے۔ جو اشتہار ہماری جانچ پر پورا نہ اترے وہ شائع نہیں ہوتا۔" : "The list is refreshed twice a day from the organisations' websites. An ad that does not pass our checks is not published."}</p>
      <AdSlot name="inArticle" />
    </UtilShell>
  );
}
