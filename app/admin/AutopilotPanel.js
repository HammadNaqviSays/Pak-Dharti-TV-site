"use client";
import { useRef, useState } from "react";
import { autopilotIngest, autopilotStep } from "./actions";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fills the site in one go: pulls the latest feeds, then writes articles one by one
// (each takes ~30–60 s) and shows progress. Every 6th article is a folk tale for variety.
export default function AutopilotPanel() {
  const [count, setCount] = useState(20);
  const [publishMode, setPublishMode] = useState("all");
  const [scope, setScope] = useState("all");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("");
  const stop = useRef(false);
  const add = (line) => setLog((l) => [line, ...l].slice(0, 60));

  async function run() {
    stop.current = false; setRunning(true); setLog([]);
    setStatus("Fetching the latest news feeds…");
    const ing = await autopilotIngest(scope);
    if (ing.error) { setStatus(`Error: ${ing.error}`); setRunning(false); return; }
    add(`Feeds checked: ${ing.pending} fresh stories waiting${ing.failedFeeds?.length ? ` (feeds not reachable: ${ing.failedFeeds.join(", ")})` : ""}.`);

    let done = 0, attempts = 0;
    while (done < count && !stop.current && attempts < count * 3) {
      attempts++;
      const mode = scope === "all" && (done + 1) % 6 === 0 ? "folklore" : "news";
      setStatus(`Writing article ${done + 1} of ${count} in English and Urdu…`);
      const r = await autopilotStep(mode, publishMode, scope);
      if (r.error) {
        const busy = r.status === 503 || r.status === 429 || /503|429|demand|quota/i.test(r.error);
        add(`⚠ ${busy ? "AI is busy, waiting 40 seconds" : r.error}`);
        if (/Session expired/.test(r.error)) break;
        await sleep(busy ? 40000 : 5000);
        continue;
      }
      if (r.idle && scope !== "all") {
        add("No more fresh stories from these sources right now. Try again in an hour.");
        break;
      }
      if (r.idle) {
        add("No more fresh stories in the feeds. Writing a folk tale instead.");
        const t = await autopilotStep("folklore", publishMode);
        if (t.error) { add(`⚠ ${t.error}`); await sleep(5000); continue; }
        done++; add(`✓ ${t.published ? "Published" : "In review"} · ${t.category} · ${t.titleUr || t.title}`);
        continue;
      }
      done++;
      add(`✓ ${r.published ? "Published" : "In review"} · ${r.category} · ${r.titleUr || r.title}${r.failedLangs?.length ? ` (missing: ${r.failedLangs.join(", ")})` : ""}`);
      await sleep(3000); // stay inside the free AI rate limit
    }
    setStatus(stop.current ? `Stopped after ${done} articles.` : `Finished: ${done} articles written.`);
    setRunning(false);
  }

  return (
    <div className="panel">
      <p className="muted" style={{ marginTop: 0 }}>
        Fetches the latest news from Dawn, Express Tribune, Geo, BBC, Al Jazeera and others, rewrites each story
        in English and Urdu with a photo, and adds it to the site. About 1 article per minute; keep this tab open.
      </p>
      <div className="row">
        <div className="field">
          <label htmlFor="ap-count">How many articles</label>
          <input id="ap-count" type="number" min={1} max={40} value={count} disabled={running}
            onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
        </div>
        <div className="field">
          <label htmlFor="ap-scope">News from</label>
          <select id="ap-scope" value={scope} disabled={running} onChange={(e) => setScope(e.target.value)}>
            <option value="all">Pakistan and world (+ folk tales)</option>
            <option value="pakistan">Pakistan only (latest)</option>
            <option value="world">World only</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-mode">Publishing</label>
          <select id="ap-mode" value={publishMode} disabled={running} onChange={(e) => setPublishMode(e.target.value)}>
            <option value="all">Publish everything directly</option>
            <option value="safe">Pakistan &amp; politics to review, rest live</option>
            <option value="none">Send everything to review queue</option>
          </select>
        </div>
      </div>
      {!running
        ? <button className="btn force" onClick={run}>Start autopilot</button>
        : <button className="btn secondary" onClick={() => { stop.current = true; setStatus("Stopping after the current article…"); }}>Stop</button>}
      {status && <p role="status" style={{ fontWeight: 700 }}>{status}</p>}
      {log.length > 0 && (
        <ul className="ap-log">{log.map((l, i) => <li key={i} dir="auto">{l}</li>)}</ul>
      )}
    </div>
  );
}
