import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { LANGS } from "@/models";
import { PAGE_SLUGS, PAGE_TITLES, pageText } from "@/lib/pages";
import ContactForm from "@/components/ContactForm";

export const revalidate = 86400;
export function generateStaticParams() {
  return LANGS.flatMap((lang) => PAGE_SLUGS.map((page) => ({ lang, page })));
}

export async function generateMetadata({ params }) {
  const { lang, page } = await params;
  if (!PAGE_SLUGS.includes(page) || !LANGS.includes(lang)) return {};
  return {
    title: PAGE_TITLES[lang][page],
    alternates: { canonical: `/${lang}/${page}`, languages: Object.fromEntries(LANGS.map((l) => [l, `/${l}/${page}`])) },
  };
}

export default async function InfoPage({ params }) {
  const { lang, page } = await params;
  if (!LANGS.includes(lang) || !PAGE_SLUGS.includes(page)) notFound();
  const textLang = lang === "ur" ? "ur" : "en";
  const email = process.env.CONTACT_EMAIL || "";
  return (
    <div className="wrap info-page">
      <h1 className="page-title">{PAGE_TITLES[lang][page]}</h1>
      <div className="article-body info-body" lang={textLang} dir={textLang === "ur" ? "rtl" : "ltr"}>
        <ReactMarkdown>{pageText(page, textLang, email)}</ReactMarkdown>
      </div>
      {page === "contact" && <ContactForm lang={textLang} />}
    </div>
  );
}
