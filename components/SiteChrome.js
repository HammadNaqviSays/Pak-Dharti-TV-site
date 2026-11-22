import { DICT, NAV_CATEGORIES, LOCALES } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import LangSwitcher from "./LangSwitcher";
import SectionNav from "./SectionNav";
import AdSlot from "./Ads";
import { pickText } from "@/lib/queries";
import { PAGE_SLUGS, PAGE_TITLES } from "@/lib/pages";
import { W } from "@/lib/widgetText";
import { getRates } from "@/lib/rates";
import { RatesMini } from "./RatesBox";
import PrayerTimes from "./PrayerTimes";

const MAIN_COUNT = 6; // sections shown directly in the bar; the rest go under "More"

// Poetry (Urdu/Punjabi/Saraiki verse) lives only on the Urdu site, at its own hub.
export const navFor = (lang) => NAV_CATEGORIES.filter((c) => c !== "poetry" || lang === "ur");
export const sectionHref = (c, lang) => (c === "poetry" ? "/ur/poetry" : c === "quotes" && lang === "ur" ? "/ur/aqwal" : `/${lang}/category/${c}`);

export function SiteHeader({ lang }) {
  const t = DICT[lang];
  const today = new Intl.DateTimeFormat(LOCALES[lang], {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi",
  }).format(new Date());
  const cats = navFor(lang);
  const toItem = (c) => ({ key: c, href: sectionHref(c, lang), label: t.cats[c] });

  return (
    <header className="site-header">
      <SectionNav lang={lang} home={t.home} label={t.menu} moreLabel={t.more}
        items={[...cats.slice(0, 3).map(toItem), { key: "columns", href: `/${lang}/columns`, label: lang === "ur" ? "کالم" : "Columns" }, ...cats.slice(3, MAIN_COUNT).map(toItem)]}
        more={[...cats.slice(MAIN_COUNT).map(toItem),
          { key: "prayer-times", href: `/${lang}/prayer-times`, label: W[lang].prayer },
          { key: "help", href: `/${lang}/help`, label: lang === "ur" ? "مفید معلومات" : "Useful info" },
          { key: "rates", href: `/${lang}/rates`, label: W[lang].rates },
          { key: "gold-rate", href: `/${lang}/gold-rate`, label: W[lang].gold2 },
          { key: "dollar-rate", href: `/${lang}/dollar-rate`, label: W[lang].dollar },
          { key: "petrol-price", href: `/${lang}/petrol-price`, label: W[lang].petrol },
          { key: "psx", href: `/${lang}/psx`, label: W[lang].psx },
          { key: "crypto", href: `/${lang}/crypto`, label: W[lang].crypto },
          { key: "mandi-rates", href: `/${lang}/mandi-rates`, label: W[lang].mandi },
          ...(lang === "ur" ? [{ key: "history", href: "/ur/history", label: "تاریخِ پاکستان" }, { key: "daily", href: "/ur/daily", label: "روزانہ کارڈز" }] : [])]}>
        <LangSwitcher current={lang} label={t.language} />
      </SectionNav>
      <div className="masthead">
        <div className="wrap masthead-inner">
          <a className="brand" href={`/${lang}`} aria-label={t.site}>
            <img src="/brand/logo.png" alt="" width="110" height="110" />
            <span className="brand-meta">
              <span className="brand-tag">{t.tagline}</span>
              <span className="brand-date">{today}</span>
            </span>
          </a>
          <AdSlot name="header" />
        </div>
      </div>
    </header>
  );
}

const SOCIAL_LABELS = {
  facebook: "Facebook", youtube: "YouTube", x: "X", instagram: "Instagram", tiktok: "TikTok", whatsapp: "WhatsApp",
};

export function SiteFooter({ lang }) {
  const t = DICT[lang];
  const social = Object.entries(SITE.social).filter(([, url]) => url);
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src="/brand/logo.png" alt={t.site} width="96" height="96" loading="lazy" />
          <p className="footer-tag">{t.tagline}</p>
        </div>
        <nav aria-label={t.menu}>
          <h2>{t.menu}</h2>
          <ul className="footer-links">
            {navFor(lang).map((c) => <li key={c}><a href={sectionHref(c, lang)}>{t.cats[c]}</a></li>)}
            <li><a href={`/${lang}/columns`}>{lang === "ur" ? "کالم" : "Columns"}</a></li>
          </ul>
        </nav>
        {social.length > 0 && (
          <div>
            <h2>{t.followUs}</h2>
            <ul className="footer-links">
              {social.map(([k, url]) => (
                <li key={k}><a href={url} rel="noopener noreferrer" target="_blank">{SOCIAL_LABELS[k]}</a></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="footer-base">
        <div className="wrap">
          <nav className="footer-legal" aria-label="Site information">
            {PAGE_SLUGS.map((p) => <a key={p} href={`/${lang}/${p}`}>{PAGE_TITLES[lang][p]}</a>)}
            <a href={`/${lang}/help`}>{lang === "ur" ? "مفید معلومات" : "Useful information"}</a>
            <a href={`/${lang}/team`}>{lang === "ur" ? "ہماری ٹیم" : "Our team"}</a>
          </nav>
          © {new Date().getFullYear()} {t.site}. {t.rights}
        </div>
      </div>
    </footer>
  );
}

export function Ticker({ lang, items }) {
  const t = DICT[lang];
  if (!items?.length) return null;
  const list = items.map((a) => {
    const x = pickText(a, lang);
    // A ticker headline in the wrong language looks broken: on the Urdu/Arabic/German site skip stories that only have English
    return { slug: a.slug, title: x?.fallback && lang !== "en" ? "" : x?.title };
  }).filter((x) => x.title);
  if (!list.length) return null;

  // The list is rendered twice so the scrolling loop is seamless; the copy is hidden from screen readers.
  const row = (hidden) => (
    <ul className="ticker-row" aria-hidden={hidden || undefined}>
      {list.map((x) => (
        <li key={x.slug}><a href={`/${lang}/news/${x.slug}`} tabIndex={hidden ? -1 : undefined}>{x.title}</a></li>
      ))}
    </ul>
  );
  return (
    <div className="wrap">
      <section className="ticker" aria-label={t.latest}>
        <div className="ticker-label">{t.latest}</div>
        <div className="ticker-viewport">
          <div className="ticker-track">{row(false)}{row(true)}</div>
        </div>
      </section>
    </div>
  );
}

/** Sidebar: most-read list (a real ranking, so it is numbered) and an ad slot. */
export async function Sidebar({ lang, mostRead }) {
  const t = DICT[lang];
  const rates = await getRates().catch(() => null);
  return (
    <aside className="sidebar">
      <PrayerTimes lang={lang} t={W[lang]} />
      {mostRead?.length > 0 && (
        <section className="side-box">
          <h2 className="side-title">{t.mostRead}</h2>
          <ol className="most-read">
            {mostRead.map((a) => {
              const x = pickText(a, lang);
              return <li key={a.slug}><a href={`/${lang}/news/${a.slug}`}>{x?.title}</a></li>;
            })}
          </ol>
        </section>
      )}
      <AdSlot name="sidebar" className="side-ad" />
      <RatesMini lang={lang} rates={rates} />
    </aside>
  );
}
