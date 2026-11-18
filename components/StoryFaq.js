// "Quick answers" under a story: the page's own language first, then Roman Urdu, then the third language (folded).
const HEAD = {
  ur: "اکثر پوچھے جانے والے سوالات", en: "Quick answers", roman: "Aham sawalaat aur jawabaat (Roman Urdu)",
};

function Block({ code, items, htmlLang, dir, open = true }) {
  if (!items?.length) return null;
  const inner = (
    <div lang={htmlLang} dir={dir}>
      {items.map((x, i) => (
        <div className="faq-item" key={i}>
          <h3 className="faq-q">{x.q}</h3>
          <p className="faq-a">{x.a}</p>
        </div>
      ))}
    </div>
  );
  return open ? (
    <section className="faq-block" aria-label={HEAD[code]}>
      <h2 className="sec-title" lang={htmlLang} dir={dir}>{HEAD[code]}</h2>
      {inner}
    </section>
  ) : (
    <details className="faq-block">
      <summary lang={htmlLang} dir={dir}>{HEAD[code]}</summary>
      {inner}
    </details>
  );
}

export default function Faq({ faq, lang }) {
  if (!faq || faq.none || !faq.en?.length) return null;
  // English page: English only (international readers). Urdu page: Urdu, then Roman Urdu, then English folded.
  if (lang !== "ur") return <div className="faq"><Block code="en" items={faq.en} htmlLang="en" dir="ltr" /></div>;
  return (
    <div className="faq">
      <Block code="ur" items={faq.ur} htmlLang="ur" dir="rtl" />
      <Block code="roman" items={faq.roman} htmlLang="ur-Latn" dir="ltr" />
      <Block code="en" items={faq.en} htmlLang="en" dir="ltr" open={false} />
    </div>
  );
}

/** schema.org FAQPage for the page's own language. */
export function faqJsonLd(faq, lang, url) {
  const items = lang === "ur" ? faq?.ur : faq?.en;
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org", "@type": "FAQPage", url, inLanguage: lang,
    mainEntity: items.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
  };
}
