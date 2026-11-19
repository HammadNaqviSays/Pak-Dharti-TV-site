import { writerSlug } from "@/lib/writerSlug";
import { focusStyle } from "@/lib/focus";
import WriterLinks from "@/components/WriterLinks";
import ReactMarkdown from "react-markdown";
import { DICT, LOCALES } from "@/lib/i18n";
import { pickText } from "@/lib/queries";

export function timeAgo(date, lang) {
  if (!date) return null;
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

/** "Oct 07, 2026 | 11:53 PM", Pakistan time. Urdu and English use the Latin style Urdu dailies use;
 *  Arabic and German get their own date format. */
export function stamp(date, lang) {
  if (!date) return null;
  const d = new Date(date);
  const loc = lang === "ar" || lang === "de" ? LOCALES[lang] : "en-US";
  const day = new Intl.DateTimeFormat(loc, { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
  const time = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(d);
  return `${day} | ${time}`;
}

// Openverse "thumbnails" are small previews: show the full photo instead
const thumbOf = (a) => (a.image?.provider === "openverse" ? a.image?.url : a.image?.thumb || a.image?.url);

/** A story teaser. variant: "lead" | "card" | "row" | "text" */
export function Story({ a, lang, variant = "card", showCategory = true }) {
  const t = DICT[lang];
  const x = pickText(a, lang);
  const href = `/${lang}/news/${a.slug}`;
  const img = variant === "lead" ? a.image?.url : thumbOf(a);
  const heading = variant === "lead"
    ? <h2 className="story-title">{x.title}</h2>
    : <h3 className="story-title">{x.title}</h3>;

  return (
    <article className={`story story-${variant}`} lang={x.fallback ? "en" : undefined}>
      <a href={href} className="story-link">
        {variant !== "text" && img && (
          <div className="story-img"><img src={img} alt="" loading={variant === "lead" ? "eager" : "lazy"} style={focusStyle(a)} /></div>
        )}
        <div className="story-body">
          <div className="kicker">
            {showCategory && <span className="kicker-cat">{t.cats[a.category]}</span>}
            {a.contentType !== "news" && <span className="kicker-type">{t.types[a.contentType]}</span>}
          </div>
          {heading}
          {(variant === "lead" || variant === "row") && x.summary && <p className="story-summary">{x.summary}</p>}
          {a.publishedAt && (
            <time className="story-time" dir={lang === "ar" ? "rtl" : "ltr"} dateTime={new Date(a.publishedAt).toISOString()}>{stamp(a.publishedAt, lang)}</time>
          )}
        </div>
      </a>
    </article>
  );
}

/** Full article view, shared by the public page and the admin preview. */
export function ArticleView({ a, lang, children, collage = [] }) {
  const t = DICT[lang];
  const x = pickText(a, lang);
  const textLang = x.fallback ? "en" : lang;
  const date = stamp(a.publishedAt, lang);
  const reviewed = !!a.disclosure?.humanReviewed;
  // a guest writer / columnist: the writer's own name, photo and bio, and a note that the views are theirs
  const au = a.author?.name ? a.author : null;
  const urdu = lang === "ur";
  const auName = au ? (urdu && au.nameUr ? au.nameUr : au.name) : "";
  const auRole = au ? (urdu && au.roleUr ? au.roleUr : au.role) : "";
  const auBio = au ? (urdu && au.bioUr ? au.bioUr : au.bio) : "";

  return (
    <article className="article">
      {x.fallback && t.pending && <p className="notice">{t.pending}</p>}
      <div className="kicker">
        <a className="kicker-cat" href={`/${lang}/category/${a.category}`}>{t.cats[a.category]}</a>
        {a.contentType !== "news" && <span className="kicker-type">{t.types[a.contentType]}</span>}
      </div>
      <h1 lang={textLang} dir={x.fallback ? "ltr" : undefined}>{x.title}</h1>
      {x.summary && <p className="article-summary" lang={textLang} dir={x.fallback ? "ltr" : undefined}>{x.summary}</p>}

      <div className="byline">
        {au ? (
          <span className="byline-author">
            {au.photo && <img className="byline-photo" src={au.photo} alt={auName} width="44" height="44" />}
            <span><b><a href={`/${lang}/writers/${writerSlug(au.name)}`}>{auName}</a></b>{auRole && <small>{auRole}</small>}</span>
          </span>
        ) : reviewed && <span className="byline-desk">{t.desk}</span>}
        {date && <time className="byline-time" dir={lang === "ar" ? "rtl" : "ltr"} dateTime={new Date(a.publishedAt).toISOString()}>{date}</time>}
      </div>
      {children /* share bar slot */}

      {collage.length >= 2 && (
        <figure className="article-figure">
          <div className={`people-collage n${collage.length}`}>
            {collage.map((p) => (
              <span key={p.name} className="pc-tile"><img src={p.photo} alt={p.name} loading="eager" /><b>{lang === "ur" && p.nameUr ? p.nameUr : p.name}</b></span>
            ))}
          </div>
          <figcaption>{t.photo}: {collage.map((p) => `${p.name}${p.credit ? ` — ${p.credit}` : ""}`).join("; ")}</figcaption>
        </figure>
      )}
      {!collage.length && a.image?.url && (
        <figure className="article-figure">
          <span className="figure-frame"><img src={a.image.url} alt={a.image.alt || ""} style={focusStyle(a)} /></span>
          {a.image.credit && (
            <figcaption>
              {t.photo}: {a.image.creditUrl ? <a href={a.image.creditUrl} rel="noopener noreferrer">{a.image.credit}</a> : a.image.credit}
              {a.image.provider === "unsplash" && (
                <> / <a href="https://unsplash.com/?utm_source=pak_dharti_tv&utm_medium=referral" rel="noopener noreferrer">Unsplash</a></>
              )}
              {a.image.provider === "wikimedia" && <> / Wikimedia Commons{a.image.license ? ` (${a.image.license})` : ""}</>}
              {a.image.provider === "openverse" && <> / Openverse{a.image.license ? ` (${a.image.license})` : ""}</>}
              {a.image.provider === "pexels" && <> / <a href="https://www.pexels.com" rel="noopener noreferrer">Pexels</a></>}
            </figcaption>
          )}
        </figure>
      )}

      {/* react-markdown does not render raw HTML, so AI output cannot inject scripts */}
      <div className="article-body" lang={textLang} dir={x.fallback ? "ltr" : undefined}>
        <ReactMarkdown>{x.body}</ReactMarkdown>
      </div>

      {au && (
        <aside className="author-card">
          {au.photo && <img src={au.photo} alt={auName} width="84" height="84" loading="lazy" />}
          <div>
            <p className="author-card-label">{urdu ? "مصنف کے بارے میں" : "About the writer"}</p>
            <h2><a href={`/${lang}/writers/${writerSlug(au.name)}`}>{auName}</a></h2>
            {auRole && <p className="author-card-role">{auRole}</p>}
            {auBio && <p>{auBio}</p>}
            <WriterLinks au={au} ur={urdu} />
            {au.photoCredit && <small>{urdu ? "تصویر" : "Photo"}: {au.photoCredit}</small>}
          </div>
          <p className="author-card-note">{urdu
            ? "اس تحریر میں بیان کردہ خیالات مصنف کے اپنے ہیں اور ضروری نہیں کہ پاک دھرتی ٹی وی کی ادارتی پالیسی کی نمائندگی کریں۔"
            : "The views in this piece are the writer’s own and do not necessarily reflect the editorial policy of Pak Dharti TV."}</p>
        </aside>
      )}

      {(!reviewed || a.sources?.length > 0) && (
        <footer className="article-notes">
          {a.sources?.length > 0 && (
            <div>
              <h2>{t.sources}</h2>
              <ul>{a.sources.map((s) => <li key={s.url}><a href={s.url} rel="noopener noreferrer nofollow">{s.name}</a></li>)}</ul>
            </div>
          )}
          {!reviewed && <p className="ai-note">{t.ai}</p>}
        </footer>
      )}
    </article>
  );
}

export function ShareBar({ lang, url, title }) {
  const t = DICT[lang];
  // utm_source lets the traffic report tell which platform a shared link brought readers from
  const u = (src) => encodeURIComponent(`${url}?utm_source=${src}&utm_medium=share`);
  const text = encodeURIComponent(title);
  const links = [
    { k: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${text}%20${u("whatsapp")}` },
    { k: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u("facebook")}` },
    { k: "x", label: "X", href: `https://x.com/intent/post?text=${text}&url=${u("x")}` },
  ];
  return (
    <div className="share">
      <span className="share-label">{t.share}</span>
      {links.map((l) => (
        <a key={l.k} className={`share-${l.k}`} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
      ))}
    </div>
  );
}
