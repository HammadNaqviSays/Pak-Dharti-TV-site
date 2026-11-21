// Read-only security check of the live site from the outside. Sends only ordinary GET/POST-without-data requests.
const B = "https://www.pakdhartitv.com";
const say = (...a) => console.log("SC", ...a);
const get = async (p, o = {}) => { try { return await fetch(B + p, { redirect: "manual", signal: AbortSignal.timeout(20000), ...o }); } catch (e) { return { status: "ERR " + e.message, headers: new Headers() }; } };
const h = await get("/ur");
say("HEADERS (home):");
for (const k of ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-resource-policy", "server", "x-powered-by"]) say("  ", k, "=", h.headers.get(k) || "(none)");
say("COOKIES on home:", h.headers.get("set-cookie") ? "sets a cookie: " + h.headers.get("set-cookie").split(";")[0].replace(/=.*/, "=***") : "none");
say("SENSITIVE PATHS (all should be 404/401/403/redirect, never 200 with content):");
for (const p of ["/.env", "/.git/config", "/.git/HEAD", "/wrangler.jsonc", "/package.json", "/next.config.js", "/private/fonts.tgz.enc", "/api/admin/export", "/api/admin/inject", "/api/cron/process", "/api/cron/social", "/api/cron/jobs", "/api/img?u=https://example.com/a.png", "/api/admin/card-preview", "/.well-known/security.txt"]) {
  const r = await get(p); const ct = r.headers.get("content-type") || ""; say("  ", p, "->", r.status, ct.split(";")[0]);
}
say("ADMIN page (should show only a login form, no data):");
const a = await get("/admin"); const t = typeof a.text === "function" ? await a.text() : ""; say("  /admin ->", a.status, "| has password field:", /type=["']password/.test(t), "| mentions 'Unpublish':", /Unpublish/.test(t), "| length", t.length);
say("CORS: does the API allow any website to read it?");
const c = await get("/api/geo", { headers: { origin: "https://evil.example" } }); say("  /api/geo ->", c.status, "access-control-allow-origin:", c.headers.get("access-control-allow-origin") || "(none)");
say("METHODS: write routes must refuse strangers");
for (const [m, p] of [["POST", "/api/hit"], ["POST", "/api/track"], ["POST", "/api/cron/process"], ["POST", "/api/admin/inject"]]) { const r = await get(p, { method: m, headers: { "content-type": "application/json" }, body: "{}" }); say("  ", m, p, "->", r.status); }
say("404 page leaks?");
const n = await get("/ur/zzz-not-here"); const nt = await n.text().catch(() => ""); say("  status", n.status, "| mentions stack/trace/mongo:", /stack|trace|mongo|node_modules|at .*\(/i.test(nt));
say("HTTP -> HTTPS:", (await fetch("http://www.pakdhartitv.com/ur", { redirect: "manual" })).status);
