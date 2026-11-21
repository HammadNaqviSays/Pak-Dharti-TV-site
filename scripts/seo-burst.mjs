// Read-only: a short burst of page opens (like a crawler or Facebook's scanner) to see WHY some give 500.
const B = "https://www.pakdhartitv.com";
const UA = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
const say = (...a) => console.log("BU", ...a);
const sm = await (await fetch(`${B}/sitemap.xml`, { headers: UA })).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => /\/news\//.test(u));
for (const N of [10, 25]) {
  const pick = urls.filter((_, i) => i % Math.floor(urls.length / N) === 1).slice(0, N);
  const t0 = Date.now(), seen = {};
  const res = await Promise.all(pick.map(async (u) => {
    const t = Date.now();
    try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) }); const b = await r.text(); return { s: r.status, ms: Date.now() - t, body: r.status >= 500 ? `${(b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""} | ${(b.match(/Error code (\d+)/i) || [])[0] || ""} | ${(b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || ""} | ${b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400)}` : "", hdr: r.status >= 500 ? [...r.headers].filter(([k]) => /^(cf-ray|server|x-|content-type|retry)/i.test(k)).map(([k, v]) => `${k}=${v}`).join("; ") : "" }; }
    catch (e) { return { s: "ERR", ms: Date.now() - t, body: e.message }; }
  }));
  const by = {}; for (const r of res) by[r.s] = (by[r.s] || 0) + 1;
  say(`burst of ${N}:`, JSON.stringify(by), `in ${Date.now() - t0}ms`);
  for (const r of res.filter((r) => r.s !== 200).slice(0, 3)) say("  non-200:", r.s, `${r.ms}ms`, r.body, "|", r.hdr || "");
  await new Promise((r) => setTimeout(r, 8000));
}
// does the edge copy work? the same story twice, and with a Facebook-style tracking address
const one = urls.find((u) => /\/ur\/news\//.test(u));
for (const [label, u] of [["first", one], ["second", one], ["with utm", `${one}?utm_source=facebook&utm_medium=social`], ["home", `${B}/ur`], ["home again", `${B}/ur`]]) {
  const t = Date.now(); const r = await fetch(u, { headers: UA }); await r.text();
  say("CACHE", label, r.status, `${Date.now() - t}ms`, "x-pd-cache:", r.headers.get("x-pd-cache") || "(none)", "| cache-control:", r.headers.get("cache-control"));
}
