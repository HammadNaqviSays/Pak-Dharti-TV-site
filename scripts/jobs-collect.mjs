// Collects job-looking pages/PDFs from the OFFICIAL sources in data/job-sources.json and sends their text to the site,
// which reads and checks them. Runs in GitHub Actions (the Worker cannot reach most of these sites).
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";

const SITE = process.env.SITE || "https://www.pakdhartitv.com", TOKEN = process.env.TOKEN || "";
const MAX_PER_SOURCE = Number(process.env.MAX_PER_SOURCE) || 6, ONLY = process.env.ONLY || "";
const UA = "Mozilla/5.0 (compatible; PakDhartiTV-jobs/1.0; +https://www.pakdhartitv.com)";
const SRC = JSON.parse(readFileSync("data/job-sources.json", "utf8")).sources.filter((s) => !ONLY || ONLY.split(",").includes(s.key));
const WORD = /(advert|vacanc|recruit|apply|appointment|post(s)?\b|jobs?\b|career|hiring|invit|اشتہار|آسام)/i;
const NOISE = /(login|sign[- ]?up|committee|portal|apply\/?$|result|date[- ]?sheet|syllabus|admit|roll[- ]?number|answer[- ]?key|merit|interview[- ]?schedule|facebook|twitter|instagram|youtube|linkedin|whatsapp|mailto:|tel:|javascript:|#$)/i;
const hdr = { "x-cron-token": TOKEN, "content-type": "application/json" };

const get = (u, ms = 20000) => fetch(u, { headers: { "user-agent": UA, accept: "text/html,application/pdf,*/*" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
const text = (h) => h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
function pdfText(buf) {
  let d, f; try { d = mkdtempSync(join(tmpdir(), "j-")); f = join(d, "a.pdf"); writeFileSync(f, buf); } catch { return ""; }
  let t = ""; try { t = execFileSync("pdftotext", ["-layout", "-l", "6", f, "-"], { encoding: "utf8", timeout: 30000, maxBuffer: 8e6 }); } catch {}
  if (t.replace(/\s+/g, "").length >= 300) return t;
  // a scanned PDF has no text layer: read the first pages with OCR (the text is then checked as strictly as any other)
  try {
    execFileSync("pdftoppm", ["-r", "170", "-l", "3", "-png", f, join(d, "pg")], { timeout: 60000 });
    let o = ""; for (const n of ["pg-1.png", "pg-2.png", "pg-3.png", "pg-01.png", "pg-02.png", "pg-03.png"]) { try { o += "\n" + execFileSync("tesseract", [join(d, n), "-", "-l", "eng", "--psm", "4"], { encoding: "utf8", timeout: 60000, maxBuffer: 8e6 }); } catch {} }
    return o;
  } catch { return t; }
}

let known = new Set();
try { known = new Set((await (await fetch(`${SITE}/api/cron/jobs`, { headers: hdr, signal: AbortSignal.timeout(25000) })).json()).keys || []); } catch (e) { console.log("could not read known keys:", e.message); }
const { createHash } = await import("crypto");
const keyOf = (u) => createHash("sha1").update(u).digest("hex");

const queue = [], report = [];
async function scan(s) {
  const rep = { key: s.key, pages: 0, candidates: 0, fresh: 0, note: "" };
  for (const page of s.pages) {
    try {
      const r = await get(page, 12000); if (!r.ok) { rep.note += `${page} -> HTTP ${r.status}; `; continue; }
      const html = await r.text(); rep.pages++;
      const seen = new Set(); const cands = [];
      for (const m of html.matchAll(/<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        let href; try { href = new URL(m[1].replace(/&amp;/g, "&"), r.url).href; } catch { continue; }
        const label = text(m[2]).slice(0, 160);
        if (seen.has(href) || NOISE.test(href + " " + label)) continue;
        if (!(WORD.test(href) || WORD.test(label)) || label.length < 6 && !/\.pdf/i.test(href)) continue;
        if (href.replace(/\/+$/, "") === page.replace(/\/+$/, "")) continue;
        seen.add(href); cands.push({ href, label });
      }
      rep.candidates += cands.length;
      for (const c of cands) { if (known.has(keyOf(c.href))) continue; rep.fresh++; if (rep.fresh <= MAX_PER_SOURCE) queue.push({ s, ...c }); }
    } catch (e) { rep.note += `${page} -> ${String(e.cause?.code || e.message).slice(0, 40)}; `; }
  }
  report.push(rep);
}
// many sources: scan 16 at a time (each page has a short timeout) so the run stays short
{ let i = 0; await Promise.all(Array.from({ length: 16 }, async () => { while (i < SRC.length) await scan(SRC[i++]); })); }

// cap one run: take candidates round-robin across sources (fair), at most MAX_TOTAL per run; the rest wait for the next run
const MAX_TOTAL = Number(process.env.MAX_TOTAL) || 120;
{ const cnt = new Map(); queue.forEach((q) => { const n = cnt.get(q.s.key) || 0; cnt.set(q.s.key, n + 1); q.rank = n; });
  queue.sort((a, b) => a.rank - b.rank); queue.length = Math.min(queue.length, MAX_TOTAL); console.log(`queue: ${queue.length} pages to read this run`); }

let sent = 0, tot = { published: 0, draft: 0, skipped: 0, errors: 0 };
const batch = [];
async function flush() {
  if (!batch.length) return;
  try {
    const r = await fetch(`${SITE}/api/cron/jobs`, { method: "POST", headers: hdr, body: JSON.stringify({ items: batch.splice(0) }), signal: AbortSignal.timeout(75000) });
    const j = await r.json(); for (const k of Object.keys(tot)) tot[k] += j[k] || 0; if (j.error) console.log("server:", j.error); if (j.capped) console.log("daily cap reached");
  } catch (e) { console.log("send failed:", e.message); }
}
for (const q of queue) {
  try {
    const r = await get(q.href, 25000); if (!r.ok) continue;
    const ct = r.headers.get("content-type") || ""; let body = "", adUrl = "";
    if (/pdf/i.test(ct) || /\.pdf(\?|$)/i.test(q.href)) { body = pdfText(Buffer.from(await r.arrayBuffer())); adUrl = q.href; }
    else {
      const html = await r.text(); body = text(html);
      const pdf = [...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)][0]; if (pdf) { try { adUrl = new URL(pdf[1], r.url).href; } catch {} }
      if (body.length < 500 && adUrl) { try { const pr = await get(adUrl, 25000); if (pr.ok) body = pdfText(Buffer.from(await pr.arrayBuffer())); } catch {} }
    }
    if (body.length < 300) { console.log(`skip (no text): ${q.href.slice(0, 100)}`); continue; }
    batch.push({ source: q.s.key, sourceName: q.s.name, url: q.href, adUrl, text: body.slice(0, 12000) }); sent++;
    if (batch.length >= 4) await flush();
  } catch (e) { console.log(`fetch failed: ${q.href.slice(0, 80)} ${String(e.cause?.code || e.message).slice(0, 40)}`); }
}
await flush();
for (const r of report) console.log(`SOURCE ${r.key}: pages=${r.pages} candidates=${r.candidates} new=${r.fresh} ${r.note}`);
console.log(`::notice title=jobs::sent=${sent} published=${tot.published} draft=${tot.draft} skipped=${tot.skipped} errors=${tot.errors}`);

try {
  const j = await (await fetch(`${SITE}/api/cron/jobs?recent=1`, { headers: hdr, signal: AbortSignal.timeout(25000) })).json();
  for (const x of j.rows || []) console.log(`JOB [${x.status}] ${x.source} | ${x.title?.en} | ${x.org?.en} | last=${x.lastDate ? new Date(x.lastDate).toISOString().slice(0, 10) : "-"} "${x.lastDateText || ""}" | posts=${x.positions || "-"} | issues=${(x.issues || []).join("; ")} | ev="${(x.evidence || "").slice(0, 140)}" | ${x.sourceUrl}`);
} catch (e) { console.log("could not list recent:", e.message); }
