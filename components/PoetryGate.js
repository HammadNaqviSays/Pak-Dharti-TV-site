import { DICT } from "@/lib/i18n";

// Urdu, Punjabi and Saraiki poetry is shown only on the Urdu site.
export function PoetryUrduOnly({ lang }) {
  const t = DICT[lang];
  return (
    <div className="wrap poetry-gate">
      <h1 className="page-title">{t.cats.poetry}</h1>
      <p>
        {lang === "ar" ? "قسم الشعر يضم الشعر الأردي والبنجابي، وهو متاح على موقعنا باللغة الأردية."
          : lang === "de" ? "Unsere Poesie-Rubrik enthält Urdu- und Punjabi-Dichtung und ist auf unserer Urdu-Seite verfügbar."
          : "Our poetry section features Urdu and Punjabi poetry and is available on our Urdu site."}
      </p>
      <p><a className="btn-link" href="/ur/poetry" lang="ur">شعر و ادب ← اردو</a></p>
    </div>
  );
}

// Generic: a section that exists only on the Urdu site
export function UrduOnly({ lang, href, title }) {
  const t = DICT[lang];
  return (
    <div className="wrap poetry-gate">
      <h1 className="page-title">{title?.[lang] || t.site}</h1>
      <p>
        {lang === "ar" ? "هذا القسم متاح على موقعنا باللغة الأردية."
          : lang === "de" ? "Diese Rubrik ist auf unserer Urdu-Seite verfügbar."
          : "This section is available on our Urdu site."}
      </p>
      <p><a className="btn-link" href={href} lang="ur">اردو میں دیکھیں ←</a></p>
    </div>
  );
}
