// Read-only: opens the pages that gave 500 one at a time (like a polite crawler) and says what happens.
const B = "https://www.pakdhartitv.com";
const UA = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
const say = (...a) => console.log("RT", ...a);
const urls = [
  "/ur/news/qatar-and-germany-deepen-strategic-and-defence-ties-in-berlin-581107",
  "/en/news/sri-lankan-shares-snap-winning-streak-on-financial-losses-d7c72b",
  "/ur/news/saudi-arabia-introduces-same-day-visa-processing-for-pakistan-83af70",
  "/en/news/pakistani-national-killed-in-fresh-strike-on-riyadh-airport-c83bbf",
  "/ur/news/ecp-sets-punjab-lg-polls-for-feb-7-halts-kp-process-031674",
  "/ur/news/trump-hints-at-possible-sunday-us-attack-on-iran-or-major-deal-a1622f",
  "/en/news/dearborn-faces-ballot-shortages-in-crucial-michigan-senate-race-960149",
  "/ur", "/en", "/ur/news/nikhil-gupta-sentenced-to-19-years-in-us-plot-8d4ac1",
];
for (let round = 1; round <= 2; round++) {
  for (const u of urls) {
    const t = Date.now();
    try {
      const r = await fetch(B + u, { headers: UA, signal: AbortSignal.timeout(25000) });
      const body = await r.text();
      say(`round${round}`, r.status, `${Date.now() - t}ms`, "cache:", r.headers.get("cf-cache-status") || "-", "|", u.slice(0, 70), r.status >= 500 ? `| body: ${body.replace(/\s+/g, " ").slice(0, 160)}` : "");
    } catch (e) { say(`round${round}`, "ERR", e.message, u.slice(0, 60)); }
    await new Promise((r) => setTimeout(r, 1500));
  }
}
