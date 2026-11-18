import RichText from "@/components/RichText";
import { UTIL_PAGES, UTIL_TITLES } from "@/lib/utilPage";

/** Page frame for the daily-utility pages: title, short intro, content, links to the other tools. */
export default function UtilShell({ lang, h1, lede, current, children }) {
  const T = UTIL_TITLES[lang];
  return (
    <div className="wrap util-page">
      <h1 className="page-title"><RichText text={h1} /></h1>
      {lede && <p className="util-lede"><RichText text={lede} /></p>}
      {children}
      <nav className="util-tools" aria-label={lang === "ur" ? "روزانہ کے نرخ اور اوقات" : "Daily rates and timings"}>
        {[...UTIL_PAGES, "rates"].filter((p) => p !== current).map((p) => <a key={p} href={`/${lang}/${p}`}>{T[p]}</a>)}
        <a href={`/${lang}/category/economy`}>{lang === "ur" ? "کاروباری خبریں" : "Business news"}</a>
      </nav>
    </div>
  );
}
