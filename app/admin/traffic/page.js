import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { trafficReport, RANGES, sourceName, countryName, regionName } from "@/lib/trafficReport";

export const dynamic = "force-dynamic";
const nf = (n) => new Intl.NumberFormat("en").format(n);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function Delta({ cur, prev }) {
  if (!prev) return <small className="muted">no earlier data</small>;
  const d = Math.round(((cur - prev) / prev) * 100);
  return <small style={{ color: d >= 0 ? "#126B3A" : "#B3261E", fontWeight: 700 }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}% vs previous period</small>;
}

function Bars({ data, labelEvery = 1, height = 120 }) {
  const e = Object.entries(data), max = Math.max(1, ...e.map(([, v]) => v));
  const w = 100 / e.length;
  return (
    <svg viewBox={`0 0 100 ${height / 4 + 8}`} preserveAspectRatio="none" style={{ width: "100%", height: height + 28 }} role="img" aria-label="Bar chart">
      {e.map(([k, v], i) => {
        const h = (v / max) * (height / 4);
        return (
          <g key={k}>
            <rect x={i * w + w * 0.12} y={height / 4 - h} width={w * 0.76} height={Math.max(h, v ? 0.4 : 0)} fill="#C8102E"><title>{k}: {nf(v)} views</title></rect>
            {i % labelEvery === 0 && <text x={i * w + w / 2} y={height / 4 + 5} fontSize="2.6" textAnchor="middle" fill="#666">{k.slice(-2)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Table({ title, rows, label, total, hint }) {
  if (!rows?.length) return null;
  return (
    <div>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
      <div className="table-scroll"><table className="stats">
        <thead><tr><th>{label}</th><th className="num">Views</th><th className="num">Visits</th><th className="num">Share</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key}><td>{r.name ?? r.key}</td><td className="num">{nf(r.views)}</td><td className="num">{nf(r.sessions)}</td>
            <td className="num"><span style={{ display: "inline-block", width: 60, height: 8, background: "#eee", borderRadius: 4, marginInlineEnd: 6, verticalAlign: "middle" }}><span style={{ display: "block", width: `${pct(r.views, total)}%`, height: 8, background: "#C8102E", borderRadius: 4 }} /></span>{pct(r.views, total)}%</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

export default async function TrafficPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const sp = await searchParams;
  const range = RANGES[sp.range] ? sp.range : "7";
  const story = /^[a-z0-9-]{1,120}$/i.test(sp.story || "") ? sp.story : "";
  const r = await trafficReport(range, story);
  const T = r.totals.views;
  const named = (rows, fn) => rows.map((x) => ({ ...x, name: fn(x.key) }));
  const labelEvery = Object.keys(r.perDay).length > 40 ? 7 : Object.keys(r.perDay).length > 14 ? 3 : 1;
  const link = (q) => `/admin/traffic?${new URLSearchParams({ range, ...q })}`;
  const d = r.detail;

  return (
    <div className="wrap" style={{ padding: "1.2rem 0 3rem" }}>
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Traffic</h1>
      <p className="hint">Anonymous counts only: no names, no IP addresses, no cookies. Times are Pakistan time. Counting started {r.allTime.first || "today"}; {nf(r.allTime.views)} views in total so far. Bots and crawlers are not counted. A "visit" is one browser session; a "view" is one page opened.</p>

      <div className="preview-tabs" style={{ display: "inline-flex", margin: ".5rem 0" }}>
        {Object.entries(RANGES).map(([k, [label]]) => <a key={k} href={`/admin/traffic?range=${k}${story ? `&story=${story}` : ""}`} aria-current={k === range}>{label}</a>)}
      </div>
      <p className="muted">{r.from === r.to ? r.from : `${r.from} to ${r.to}`}</p>

      {d && (
        <div className="panel">
          <p><a href={link({})}>← All stories</a></p>
          <h2 style={{ marginTop: 0 }}>{d.title}</h2>
          {d.titleUr && <p lang="ur" dir="rtl" style={{ fontFamily: "var(--f-urdu), serif", fontSize: "1.2rem" }}>{d.titleUr}</p>}
          <p className="muted">{d.category}{d.publishedAt ? ` · published ${new Date(d.publishedAt).toISOString().slice(0, 16).replace("T", " ")} UTC` : ""} · <a href={`/en/news/${d.slug}`} target="_blank" rel="noopener">open story</a></p>
          <div className="kpis"><div className="kpi"><span>Views of this story</span><strong style={{ fontSize: "1.6rem" }}>{nf(d.views)}</strong></div></div>
          <Bars data={d.perDay} labelEvery={labelEvery} />
          <div className="row">
            <Table title="Where its readers came from" rows={named(d.sources, sourceName)} label="Platform" total={d.views} />
            <Table title="Readers by country" rows={named(d.countries, countryName)} label="Country" total={d.views} />
          </div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><span>Page views</span><strong style={{ fontSize: "1.6rem" }}>{nf(T)}</strong><Delta cur={T} prev={r.prev.views} /></div>
        <div className="kpi"><span>Visits</span><strong style={{ fontSize: "1.6rem" }}>{nf(r.totals.sessions)}</strong><Delta cur={r.totals.sessions} prev={r.prev.sessions} /></div>
        <div className="kpi"><span>Pages per visit</span><strong style={{ fontSize: "1.6rem" }}>{r.totals.sessions ? (T / r.totals.sessions).toFixed(1) : "–"}</strong></div>
        <div className="kpi"><span>Top platform</span><strong style={{ fontSize: "1.3rem" }}>{r.sources[0] ? sourceName(r.sources[0].key) : "–"}</strong></div>
        <div className="kpi"><span>Top region</span><strong style={{ fontSize: "1.3rem" }}>{r.regions[0] ? regionName(r.regions[0].key) : "–"}</strong></div>
      </div>

      <h2>Views per day</h2>
      <div className="panel"><Bars data={r.perDay} labelEvery={labelEvery} /></div>
      <h2>Busiest hours (Pakistan time)</h2>
      <div className="panel"><Bars data={r.perHour} labelEvery={2} /></div>

      <h2>Stories — views per story</h2>
      <p className="hint">Click a story to see which platforms and countries its readers came from.</p>
      <div className="table-scroll"><table className="stats">
        <thead><tr><th>Story</th><th>Section</th><th className="num">Views</th><th className="num">Visits</th></tr></thead>
        <tbody>
          {r.topStories.map((s) => <tr key={s.key}><td><a href={link({ story: s.key })}>{s.title}</a></td><td>{s.category}</td><td className="num">{nf(s.views)}</td><td className="num">{nf(s.sessions)}</td></tr>)}
          {!r.topStories.length && <tr><td colSpan="4" className="muted">No story views yet in this period.</td></tr>}
        </tbody>
      </table></div>

      <div className="row" style={{ alignItems: "start" }}>
        <Table title="Platforms (where readers came from)" rows={named(r.sources, sourceName)} label="Platform" total={T} hint="Shared links carry the platform name; otherwise it comes from the referring site or app." />
        <Table title="Other websites sending readers" rows={r.refhosts} label="Website" total={T} />
      </div>
      <div className="row" style={{ alignItems: "start" }}>
        <Table title="Countries" rows={named(r.countries, countryName)} label="Country" total={T} />
        <Table title="Regions / provinces" rows={named(r.regions, regionName)} label="Region" total={T} />
      </div>
      <Table title="Cities" rows={named(r.cities, (k) => { const [cc, c] = k.split("|"); return `${c}, ${countryName(cc)}`; })} label="City" total={T} />
      <div className="row" style={{ alignItems: "start" }}>
        <Table title="Devices" rows={r.devices} label="Device" total={T} />
        <Table title="Operating systems" rows={r.os} label="System" total={T} />
        <Table title="Installed app vs browser" rows={r.modes} label="Mode" total={T} />
      </div>
      <div className="row" style={{ alignItems: "start" }}>
        <Table title="Language" rows={named(r.langs, (k) => (k === "ur" ? "Urdu" : "English"))} label="Language" total={T} />
        <Table title="Sections read" rows={r.categories} label="Section" total={T} />
      </div>
      <Table title="Pages (home, sections, other pages)" rows={r.pages} label="Page" total={T} />
    </div>
  );
}
