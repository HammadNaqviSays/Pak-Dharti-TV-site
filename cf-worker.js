// Cloudflare entry point: the site itself (built by OpenNext) plus the timetable that Vercel Cron used to run.
// The timetable is in wrangler.jsonc ("triggers"); each tick asks the site's own cron page to do one job.
import site from "./.open-next/worker.js";
export * from "./.open-next/worker.js";

export default {
  fetch(request, env, ctx) {
    // One address per page: bare pakdhartitv.com and the test address (*.workers.dev) send visitors and Google to www
    const u = new URL(request.url);
    const test = u.hostname.endsWith(".workers.dev");
    if ((u.hostname === "pakdhartitv.com" || test) && !u.pathname.startsWith("/api/")) {
      return Response.redirect(`https://www.pakdhartitv.com${u.pathname}${u.search}`, 301);
    }
    return site.fetch(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    // "7,37 * * * *": start the Facebook / Instagram posting job on GitHub (it needs the image library that cannot run here).
    // Every GitHub run costs minutes of a small monthly allowance, so it is started only when the site says something is due
    // (a fresh story, a rate card, hand-made posts, a catch-up), plus a fixed run every 2 hours (07:00-21:00 Pakistan) for mandi, day count and the rest.
    if (event.cron === "7,37 * * * *") {
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
