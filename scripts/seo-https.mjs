// Read-only: do plain-http addresses now go to https, and does the site still open normally?
const say = (...a) => console.log("HT", ...a);
for (const u of ["http://www.pakdhartitv.com/ur", "http://pakdhartitv.com/ur", "http://www.pakdhartitv.com/ur/news/x", "https://www.pakdhartitv.com/ur", "https://pakdhartitv.com/ur"]) {
  try { const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(20000) }); say(u, "->", r.status, r.headers.get("location") || ""); } catch (e) { say(u, "ERR", e.message); }
}
try { const r = await fetch("http://www.pakdhartitv.com/ur", { redirect: "follow" }); say("followed http ->", r.status, r.url); } catch (e) { say("follow ERR", e.message); }
