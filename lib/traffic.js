// Shared by the browser (to describe a visit) and the server (to count it). No Node-only code in here.
// Pakistan time (UTC+5) is used for days and hours so "today" means the editor's today.
export const pkDay = (d = new Date()) => new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
export const pkHour = (d = new Date()) => String(new Date(d.getTime() + 5 * 3600e3).getUTCHours()).padStart(2, "0");

const HOSTS = [
  [/^news\.google\./, "google-news"], [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/, "facebook"], [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"], [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, "telegram"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "x"], [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"], [/(^|\.)bing\.com$/, "bing"], [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\.com$/, "yahoo"], [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"], [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"], [/(^|\.)snapchat\.com$/, "snapchat"],
];
const APPS = {
  "com.google.android.googlequicksearchbox": "google", "com.facebook.katana": "facebook", "com.facebook.lite": "facebook",
  "com.facebook.orca": "facebook", "com.whatsapp": "whatsapp", "com.whatsapp.w4b": "whatsapp", "org.telegram.messenger": "telegram",
  "com.twitter.android": "x", "com.instagram.android": "instagram", "com.zhiliaoapp.musically": "tiktok", "com.google.android.gm": "email",
};
const ALIAS = { fb: "facebook", wa: "whatsapp", ig: "instagram", tw: "x", twitter: "x", tg: "telegram", yt: "youtube", gnews: "google-news" };

/** Where did this visit come from? → { src, host }. src is a short lowercase name; host is set for "other" websites. */
export function classifySource({ ref = "", search = "", ua = "", selfHost = "" }) {
  const utm = (/[?&]utm_source=([^&#]+)/i.exec(search) || [])[1];
  if (utm) {
    let u = ""; try { u = decodeURIComponent(utm); } catch { u = utm; }
    u = u.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
    if (u) return { src: ALIAS[u] || u, host: "" };
  }
  if (ref.startsWith("android-app://")) {
    const pkg = ref.slice("android-app://".length).split("/")[0];
    return { src: APPS[pkg] || "other", host: APPS[pkg] ? "" : pkg.slice(0, 60) };
  }
  let host = "";
  try { host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  if (host && host !== selfHost.replace(/^www\./, "")) {
    for (const [re, name] of HOSTS) if (re.test(host)) return { src: name, host: "" };
    return { src: "other", host: host.slice(0, 60) };
  }
  // no usable referrer: the in-app browsers of some apps still give themselves away
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return { src: "facebook", host: "" };
  if (/Instagram/.test(ua)) return { src: "instagram", host: "" };
  if (/musical_ly|TikTok|Bytedance/i.test(ua)) return { src: "tiktok", host: "" };
  return { src: "direct", host: "" };
}

export function deviceFrom(ua = "") {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

export function osFrom(ua = "") {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "mac";
  if (/Linux|X11|CrOS/i.test(ua)) return "linux";
  return "other";
}

/** "/ur/news/some-slug" → { lang: "ur", key: "story", slug: "some-slug" }; null when the path is not a site page. */
export function pageKey(path = "") {
  const m = /^\/(en|ur)(\/.*)?$/.exec(path.split("?")[0]);
  if (!m) return null;
  const seg = (m[2] || "").split("/").filter(Boolean);
  if (!seg.length) return { lang: m[1], key: "home" };
  if (seg[0] === "news" && seg[1]) return { lang: m[1], key: "story", slug: seg[1].slice(0, 120) };
  if (seg[0] === "category" && /^[a-z-]{1,30}$/.test(seg[1] || "")) return { lang: m[1], key: `category:${seg[1]}` };
  return { lang: m[1], key: /^[a-z-]{1,30}$/.test(seg[0]) ? seg[0] : "other" };
}
