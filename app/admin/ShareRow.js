// One-click manual sharing: each button opens that site's own "share" window with the story already filled in.
// You are signed in there yourself, so nothing is stored here and no keys are needed. Works for any site, free.
import { SITE } from "@/lib/site";

export default function ShareRow({ a, lang }) {
  const x = a.translations?.[lang] || a.translations?.en || {};
  const url = `${SITE.url}/${lang}/news/${a.slug}`;
  const title = (x.title || "").trim();
  const text = `${title}\n\n${url}`;
  const e = encodeURIComponent;
  const media = a.image?.url ? (a.image.url.startsWith("http") ? a.image.url : `${SITE.url}${a.image.url}`) : "";
  const links = [
    ["X (Twitter)", `https://twitter.com/intent/tweet?text=${e(title)}&url=${e(url)}`],
    ["Threads", `https://www.threads.net/intent/post?text=${e(text)}`],
    ["WhatsApp", `https://wa.me/?text=${e(text)}`],
    ["Telegram", `https://t.me/share/url?url=${e(url)}&text=${e(title)}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`],
    ["Pinterest", `https://pinterest.com/pin/create/button/?url=${e(url)}&media=${e(media)}&description=${e(title)}`],
    ["Bluesky", `https://bsky.app/intent/compose?text=${e(text)}`],
    ["Reddit", `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}`],
  ];
  return (
    <p className="hint" style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", alignItems: "center" }}>
      <strong>Share by hand ({lang === "ur" ? "Urdu" : "English"} link):</strong>
      {links.map(([n, h]) => <a key={n} className="btn secondary" href={h} target="_blank" rel="noopener noreferrer">{n}</a>)}
    </p>
  );
}
