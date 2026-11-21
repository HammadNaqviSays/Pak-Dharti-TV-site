// Reads tail.log (wrangler tail --format json, pretty printed) and prints the errors that happened.
const fs = require("fs");
const raw = fs.readFileSync("tail.log", "utf8");
const events = [];
let d = 0, st = -1, ins = false, esc = false;
for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if (ins) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') ins = false; continue; }
  if (c === '"') ins = true; else if (c === "{") { if (d === 0) st = i; d++; } else if (c === "}") { d--; if (d === 0 && st >= 0) { try { events.push(JSON.parse(raw.slice(st, i + 1))); } catch {} } }
}
const out = {}, err = {}; let shown = 0, n5 = 0;
for (const j of events) {
  out[j.outcome] = (out[j.outcome] || 0) + 1;
  const status = j.event?.response?.status; if (status >= 500) n5++;
  const ex = (j.exceptions || []).map((e) => `${e.name}: ${e.message}`);
  const bad = j.outcome && j.outcome !== "ok" && j.outcome !== "canceled";
  if (bad || ex.length || status >= 500) { const k = (ex[0] || `outcome ${j.outcome} status ${status}`).slice(0, 300); err[k] = (err[k] || 0) + 1; if (shown < 3) { shown++; console.log("TAIL SAMPLE", JSON.stringify(j).slice(0, 1200)); } }
  for (const m of j.logs || []) { const t = (m.message || []).map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "); if (/error|fail|limit|exceed|429|timeout|ECONN|pool|Mongo/i.test(t)) { const k = "LOG " + t.slice(0, 300); err[k] = (err[k] || 0) + 1; } }
}
console.log("TAIL events", events.length, "outcomes", JSON.stringify(out), "5xx", n5);
for (const [k, v] of Object.entries(err).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log("TAIL", v, "x", k);
