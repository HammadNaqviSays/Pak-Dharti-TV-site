import RichText, { plain } from "@/components/RichText";

/** Visible "quick answer" plus a short FAQ, with matching FAQPage structured data (answer-engine friendly). */
export default function Faq({ lang, items, heading }) {
  const list = (items || []).filter((x) => x && x.q && x.a);
  if (!list.length) return null;
  const ld = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: list.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: plain(x.a) } })),
  };
  return (
    <section className="faq" aria-labelledby="faq-h">
      <h2 className="sec-title" id="faq-h">{heading || (lang === "ur" ? "اکثر پوچھے جانے والے سوالات" : "Frequently asked questions")}</h2>
      {list.map((x) => (
        <div className="faq-item" key={x.q}><h3><RichText text={x.q} /></h3><p><RichText text={x.a} /></p></div>
      ))}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </section>
  );
}

/** The one-sentence direct answer shown at the top of a utility page. */
export function QuickAnswer({ children }) {
  if (!children) return null;
  return <p className="quick-answer"><RichText text={children} /></p>;
}
