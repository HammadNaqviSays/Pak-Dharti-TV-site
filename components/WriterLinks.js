// The writer's own places on the web (website, Instagram, Facebook) as small round-cornered buttons.
// Reads author.links = { website, instagram, facebook }; older articles that only have author.url (Instagram) still work.
const ICON = {
  website: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5c3 3 3 16.5 0 19M12 2.5c-3 3-3 16.5 0 19" /></g>,
  instagram: <><g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></g><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" /></>,
  facebook: <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />,
};

export function writerLinks(au) {
  const l = au?.links || {};
  const out = [];
  if (l.website) out.push({ key: "website", url: l.website, en: "Website", ur: "ویب سائٹ" });
  const ig = l.instagram || au?.url;
  if (ig) out.push({ key: "instagram", url: ig, en: "Instagram", ur: "انسٹاگرام" });
  if (l.facebook) out.push({ key: "facebook", url: l.facebook, en: "Facebook", ur: "فیس بک" });
  return out;
}

export default function WriterLinks({ au, ur, className = "" }) {
  const list = writerLinks(au);
  if (!list.length) return null;
  return (
    <ul className={`wlinks ${className}`.trim()} aria-label={ur ? "لکھاری کے آن لائن صفحات" : "The writer online"}>
      {list.map((x) => (
        <li key={x.key}>
          <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className={`wlink wlink-${x.key}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">{ICON[x.key]}</svg>
            <span>{ur ? x.ur : x.en}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
