// Read-only SEO health check of the live site, from the outside (like a crawler). Prints SEO lines.
const B = "https://www.pakdhartitv.com";
const UA = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
const say = (...a) => console.log("SEO", ...a);
const get = async (u, o = {}) => { const t = Date.now(); try { const r = await fetch(u, { headers: UA, redirect: o.manual ? "manual" : "follow", signal: AbortSignal.timeout(20000) }); return { r, ms: Date.now() - t, text: o.head ? "" : await r.text() }; } catch (e) { return { err: e.message, ms: Date.now() - t }; } };
const tag = (h, re) => (h.match(re) || [])[1] || "";
const all = (h, re) => [...h.matchAll(re)].map((m) => m[1]);

async function page(label, url) {
  const x = await get(url);
  if (x.err) return say(label, "ERROR", x.err);
  const h = x.text;
  const title = tag(h, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = tag(h, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || tag(h, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canon = tag(h, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i);
  const hre = all(h, /<link[^>]+hreflang=["']([^"']*)["']/gi);
  const ogi = tag(h, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i);
  const ld = all(h, /"@type"\s*:\s*"([A-Za-z]+)"/g);
  const h1 = (h.match(/<h1[\s>]/gi) || []).length;
  const robots = tag(h, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i);
  say(label, `HTTP ${x.r.status} | ${x.ms}ms | ${Math.round(h.length / 1024)}KB`);
  say(label, `title(${title.length}): ${title.trim().slice(0, 110)}`);
  say(label, `description(${desc.length}): ${desc.slice(0, 120) || "MISSING"}`);
  say(label, `canonical: ${canon || "MISSING"} | hreflang: ${[...new Set(hre)].join(",") || "none"} | h1 count: ${h1} | robots meta: ${robots || "-"}`);
  say(label, `og:image: ${ogi || "MISSING"}`);
  say(label, `structured data: ${[...new Set(ld)].join(",") || "NONE"}`);
  if (ogi) { const g = await get(ogi, { head: true }); say(label, `og:image fetch -> ${g.r ? g.r.status + " " + (g.r.headers.get("content-type") || "") : "ERR " + g.err}`); }
  return h;
}

await page("HOME-UR", `${B}/ur`);
await page("HOME-EN", `${B}/en`);
const rt = await get(`${B}/robots.txt`); say("ROBOTS", rt.r?.status, (rt.text || "").replace(/\n/g, " | ").slice(0, 400));
const sm = await get(`${B}/sitemap.xml`);
say("SITEMAP", sm.r?.status, `${(sm.text.match(/<loc>/g) || []).length} <loc> entries`);
const locs = all(sm.text, /<loc>([^<]+)<\/loc>/g);
const child = locs.filter((l) => /sitemap/i.test(l));
let urls = locs.filter((l) => !/sitemap/i.test(l));
for (const c of child.slice(0, 6)) { const s = await get(c); const l = all(s.text, /<loc>([^<]+)<\/loc>/g); say("CHILD", c, s.r?.status, l.length, "urls"); urls = urls.concat(l); }
const ns = await get(`${B}/news-sitemap.xml`); say("NEWS-SITEMAP", ns.r?.status, `${(ns.text.match(/<url>/g) || []).length} items`, tag(ns.text, /<news:publication_date>([^<]+)/));
say("URLS in sitemaps (total):", urls.length, "| http(not https):", urls.filter((u) => u.startsWith("http:")).length, "| non-www:", urls.filter((u) => !u.includes("://www.")).length);
const story = urls.find((u) => /\/ur\/news\//.test(u)) || urls.find((u) => /\/news\//.test(u));
if (story) await page("STORY", story);
// status of a spread sample of sitemap URLs
const sample = urls.filter((_, i) => i % Math.max(1, Math.floor(urls.length / 40)) === 0).slice(0, 40);
const bad = [], redir = [], slow = [];
await Promise.all(sample.map(async (u) => { const x = await get(u, { manual: true, head: true }); if (x.err) bad.push(`${u} ERR`); else if (x.r.status >= 400) bad.push(`${u} ${x.r.status}`); else if (x.r.status >= 300) redir.push(`${u} ${x.r.status}`); if (x.ms > 2500) slow.push(`${u} ${x.ms}ms`); }));
say("SAMPLE", `${sample.length} sitemap URLs checked | errors: ${bad.length} | redirects: ${redir.length} | slow(>2.5s): ${slow.length}`);
for (const b of bad.slice(0, 10)) say("BAD", b);
for (const b of redir.slice(0, 5)) say("REDIRECT", b);
for (const b of slow.slice(0, 5)) say("SLOW", b);
// the old/wrong hosts should redirect to the main site
for (const h of ["http://pakdhartitv.com/ur", "https://pakdhartitv.com/ur", "http://www.pakdhartitv.com/ur"]) { const x = await get(h, { manual: true, head: true }); say("HOSTVARIANT", h, x.r ? `${x.r.status} -> ${x.r.headers.get("location") || "-"}` : x.err); }
const nf = await get(`${B}/ur/this-page-does-not-exist-xyz`, { head: true }); say("404-TEST", nf.r?.status, "(should be 404, not 200)");
