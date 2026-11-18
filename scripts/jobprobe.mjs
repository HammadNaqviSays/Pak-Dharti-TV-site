// Read-only probe: for each official jobs page, report status, type, size, job-looking links and robots.txt rules.
const SRC = [
  ["FPSC", "https://www.fpsc.gov.pk/category/advertisements"],
  ["PPSC", "https://ppsc.gop.pk/"],
  ["SPSC", "https://spsc.gos.pk/"],
  ["KPPSC", "https://www.kppsc.gov.pk/"],
  ["BPSC", "https://bpsc.gob.pk/"],
  ["NTS", "https://www.nts.org.pk/"],
  ["OTS", "https://www.ots.org.pk/"],
  ["PTS", "https://pts.org.pk/"],
  ["ETEA", "https://www.etea.edu.pk/"],
  ["UTS", "https://uts.org.pk/"],
  ["State Bank", "https://www.sbp.org.pk/careers/index.htm"],
  ["NBP", "https://www.nbp.com.pk/careers/index.aspx"],
  ["WAPDA", "https://www.wapda.gov.pk/"],
  ["Punjab Police", "https://punjabpolice.gov.pk/"],
  ["Establishment Div", "https://establishment.gov.pk/"],
];
const UA = "Mozilla/5.0 (compatible; PakDhartiTV-jobprobe/1.0; +https://www.pakdhartitv.com)";
const get = async (u) => { const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) }); return r; };
for (const [name, url] of SRC) {
  const o = { name, url };
  try {
    const r = await get(url); const t = await r.text();
    o.status = r.status; o.type = (r.headers.get("content-type") || "").split(";")[0]; o.bytes = t.length; o.final = r.url !== url ? r.url : undefined;
    const links = [...t.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()]);
    const job = links.filter(([h, x]) => /job|career|vacanc|recruit|advert|apply|appoint/i.test(h + " " + x));
    o.links = links.length; o.pdfLinks = links.filter(([h]) => /\.pdf(\?|$)/i.test(h)).length; o.jobLinks = job.length;
    o.sample = job.slice(0, 6).map(([h, x]) => `${x.slice(0, 70)} -> ${h.slice(0, 110)}`);
    o.title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, " ").trim().slice(0, 90);
    o.blocked = /cloudflare|attention required|access denied|captcha/i.test(t.slice(0, 4000)) && t.length < 20000;
  } catch (e) { o.error = String(e.cause?.code || e.message).slice(0, 80); }
  try { const base = new URL(url).origin; const r = await get(base + "/robots.txt"); const t = await r.text(); o.robots = r.status === 200 ? t.split("\n").filter((l) => /^(user-agent|disallow)/i.test(l)).slice(0, 8).join(" | ").slice(0, 220) : `status ${r.status}`; } catch (e) { o.robots = "n/a"; }
  console.log("::group::" + name); console.log(JSON.stringify(o, null, 1)); console.log("::endgroup::");
  console.log(`SUMMARY ${name}: status=${o.status ?? o.error} type=${o.type ?? "-"} jobLinks=${o.jobLinks ?? "-"} pdf=${o.pdfLinks ?? "-"} blocked=${o.blocked ?? "-"} robots=${(o.robots || "").slice(0, 60)}`);
}
