import { DICT, isRTL } from "@/lib/i18n";
import { LANGS } from "@/models";
import { fontVars } from "@/lib/fonts";
import { ICONS, SITE } from "@/lib/site";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import Script from "next/script";
import PwaInstall from "@/components/PwaInstall";
import Analytics from "@/components/Analytics";
import "../globals.css";

const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

const orgLd = (lang) => ({
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": `${SITE.url}/#organization`,
  name: "Pak Dharti TV", alternateName: ["Pak Dharti", "PakDhartiTV", "pakdhartitv.com", "پاک دھرتی ٹی وی"],
  description: "Pak Dharti TV (pakdhartitv.com) is an independent Pakistani news website publishing news from Pakistan and the world in English and Urdu.",
  url: SITE.url, logo: { "@type": "ImageObject", url: `${SITE.url}/brand/icon-512.png` },
  sameAs: Object.values(SITE.social).filter(Boolean),
  areaServed: "PK", knowsLanguage: ["en", "ur"],
  publishingPrinciples: `${SITE.url}/${lang}/editorial-policy`,
  ethicsPolicy: `${SITE.url}/${lang}/editorial-policy`,
  correctionsPolicy: `${SITE.url}/${lang}/corrections-policy`,
});

// Tells Google the name of the site (and the other spellings people type), so a search for "Pak Dharti TV" can find this website.
const siteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  name: "Pak Dharti TV", alternateName: ["PakDhartiTV", "Pak Dharti", "pakdhartitv.com", "پاک دھرتی ٹی وی"],
  url: `${SITE.url}/`, publisher: { "@id": `${SITE.url}/#organization` }, inLanguage: ["en", "ur"],
};

export function generateStaticParams() { return LANGS.map((lang) => ({ lang })); }

export async function generateMetadata({ params }) {
  const { lang: raw } = await params;
  const lang = LANGS.includes(raw) ? raw : "en";
  return {
    metadataBase: new URL(SITE.url),
    title: { default: DICT[lang].site, template: `%s | ${DICT[lang].site}` },
    icons: ICONS,
    appleWebApp: { capable: true, title: "Pak Dharti", statusBarStyle: "default" },
    openGraph: { siteName: DICT[lang].site, images: ["/brand/og-default.jpg"] },
  };
}

export const viewport = { themeColor: "#7A0000" };

export default async function LangLayout({ children, params }) {
  const { lang: raw } = await params;
  const lang = LANGS.includes(raw) ? raw : "en"; // invalid langs 404 inside the page, not here
  return (
    <html lang={lang} dir={isRTL(lang) ? "rtl" : "ltr"} className={`${fontVars} lang-${lang}`}>
      <body>
        <a className="skip" href="#main">{lang === "ur" ? "مواد پر جائیں" : lang === "ar" ? "انتقل إلى المحتوى" : lang === "de" ? "Zum Inhalt" : "Skip to content"}</a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd(lang)).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd).replace(/</g, "\\u003c") }} />
        <SiteHeader lang={lang} />
        <main id="main">{children}</main>
        <SiteFooter lang={lang} />
        <PwaInstall lang={lang} />
        <Analytics />
        {ADSENSE && (
          <Script async strategy="afterInteractive" crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} />
        )}
      </body>
    </html>
  );
}
