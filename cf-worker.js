// Cloudflare entry point: the site itself (built by OpenNext) plus the timetable that Vercel Cron used to run.
// The timetable is in wrangler.jsonc ("triggers"); each tick asks the site's own cron page to do one job.
import site from "./.open-next/worker.js";
export * from "./.open-next/worker.js";


// A short-lived copy of the public pages (home and stories) in Cloudflare's own cache, so a crowd or a crawler burst
// is answered from the copy and never has to wait for the database. If the site fails to answer, the last good copy
// (up to a day old) is shown instead of an error. Admin, the API, other addresses and anything with a login cookie are left alone.
const PAGE = /^\/(ur|en)(\/news\/[a-z0-9-]+)?\/?$/i;
const TRACK = /^(utm_[a-z]+|fbclid|igshid|gclid|ref|mc_[a-z]+)$/i;
const FRESH_MS = { home: 60e3, story: 300e3 };

async function edgeCached(request, env, ctx) {
  let key, kind;
  try {
    const u = new URL(request.url);
    if (request.method !== "GET" || !PAGE.test(u.pathname) || u.hostname !== "www.pakdhartitv.com") return site.fetch(request, env, ctx);
    if ([...u.searchParams.keys()].some((k) => !TRACK.test(k))) return site.fetch(request, env, ctx);
    if (/pd_admin=/.test(request.headers.get("cookie") || "")) return site.fetch(request, env, ctx);
    kind = /\/news\//i.test(u.pathname) ? "story" : "home";
    key = new Request(`https://www.pakdhartitv.com${u.pathname.replace(/\/+$/, "")}`, { method: "GET" });
  } catch { return site.fetch(request, env, ctx); }

  const cache = caches.default;
  let stale = null;
  try {
    const hit = await cache.match(key);
    if (hit) {
      if (Date.now() - Number(hit.headers.get("x-pd-at") || 0) < FRESH_MS[kind]) return out(hit, "HIT");
      stale = hit;
    }
  } catch { /* cache unavailable: go to the site */ }

  let res;
  try {
    res = stale
      ? await Promise.race([site.fetch(request, env, ctx), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 9000))])
      : await site.fetch(request, env, ctx);
  } catch (e) {
    if (stale) return out(stale, "STALE");
    throw e;
  }
  if (res.status >= 500 && stale) return out(stale, "STALE");
  if (res.status === 200 && /text\/html/i.test(res.headers.get("content-type") || "") && !res.headers.has("set-cookie")) {
    try {
      const copy = new Response(res.clone().body, { status: 200, headers: new Headers(res.headers) });
      copy.headers.set("x-pd-at", String(Date.now()));
      copy.headers.set("cache-control", "public, max-age=86400");
      ctx.waitUntil(cache.put(key, copy).catch(() => {}));
    } catch { /* not cached this time */ }
  }
  const h = new Headers(res.headers); h.set("x-pd-cache", "MISS");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function out(cached, state) {
  const h = new Headers(cached.headers);
  h.set("x-pd-cache", state);
  h.set("cache-control", "public, max-age=0, must-revalidate");   // browsers always ask again; only the edge copy is reused
  h.delete("x-pd-at");
  return new Response(cached.body, { status: cached.status, headers: h });
}

export default {
  fetch(request, env, ctx) {
    // One address per page: bare pakdhartitv.com and the test address (*.workers.dev) send visitors and Google to www
    const u = new URL(request.url);
    const test = u.hostname.endsWith(".workers.dev");
    if ((u.hostname === "pakdhartitv.com" || test) && !u.pathname.startsWith("/api/")) {
      return Response.redirect(`https://www.pakdhartitv.com${u.pathname}${u.search}`, 301);
    }
    return edgeCached(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    // every tick: publish any scheduled column whose time has come (cheap database look)
    ctx.waitUntil(env.WORKER_SELF_REFERENCE.fetch(new Request("https://www.pakdhartitv.com/api/cron/publish-scheduled", { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }))
      .then(async (r) => { const x = await r.text(); if (!x.includes('"published":[]')) console.log(`[cron] publish-scheduled -> ${r.status} ${x.slice(0, 200)}`); })
      .catch((e) => console.log(`[cron] publish-scheduled failed: ${e?.message}`)));
    // "7,22,37,52 * * * *": start the Facebook / Instagram posting job on GitHub (it needs the image library that cannot run here).
    // Every GitHub run costs minutes of a small monthly allowance, so it is started only when the site says something is due
    // (a fresh story, a rate card, hand-made posts, a catch-up), plus a fixed run every 2 hours (07:00-21:00 Pakistan) for mandi, day count and the rest.
    if (event.cron === "7,22,37,52 * * * *") {
      const tt = new Date(event.scheduledTime);
      const fixed = tt.getUTCMinutes() === 7 && tt.getUTCHours() % 2 === 0 && tt.getUTCHours() >= 2 && tt.getUTCHours() <= 16;
      ctx.waitUntil((async () => {
        let due = fixed, why = fixed ? "fixed run" : "";
        if (!due) {
          try {
            const r = await env.WORKER_SELF_REFERENCE.fetch(new Request("https://www.pakdhartitv.com/api/cron/social-due", { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }));
            const j = await r.json(); due = j.due !== false; why = j.why || "";
          } catch (e) { due = true; why = "check failed"; }
        }
        if (!due) { console.log(`[cron] social: nothing due (${why})`); return; }
        try {
          const r = await fetch("https://api.github.com/repos/HammadNaqviSays/Pak-Dharti-TV-site/actions/workflows/social.yml/dispatches", {
            method: "POST",
            headers: { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "pak-dharti-tv-cron", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
            body: JSON.stringify({ ref: "main" }),
          });
          console.log(`[cron] social dispatch (${why}) -> ${r.status}`);
        } catch (e) { console.log(`[cron] social dispatch failed: ${e?.message}`); }
      })());
      return;
    }
    const t = new Date(event.scheduledTime);
    let path = "/api/cron/ingest";                                   // "3 */2 * * *": pull the RSS feeds
    if (!event.cron.startsWith("3 ")) {                              // every other tick writes one story
      const turn = t.getUTCHours() * 3 + Math.floor(t.getUTCMinutes() / 20);
      path = `/api/cron/process?scope=${turn % 4 === 3 ? "world" : "pakistan"}`;   // 3 Pakistani stories to 1 international
    }
    const req = new Request(`https://www.pakdhartitv.com${path}`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch(req)
        .then(async (r) => console.log(`[cron] ${path} -> ${r.status} ${(await r.text()).slice(0, 300)}`))
        .catch((e) => console.log(`[cron] ${path} failed: ${e?.message}`)),
    );
  },
};
