import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";
import { pkDay } from "@/lib/traffic";
import { StoryMarks, ReelAction, QuickShare, reelMap } from "../StoryMarks";

export const dynamic = "force-dynamic";

// Same rule the autopilot uses to count a story as "Pakistan"
const PK_CATS = ["pakistan", "politics", "economy"];
const PK_OUTLETS = ["Dawn", "Express Tribune", "Geo News"];
const isPk = (a) => PK_CATS.includes(a.category) || (a.category === "sports" && (a.sources || []).some((s) => PK_OUTLETS.includes(s.name)));

const dayStart = (day) => new Date(Date.parse(day + "T00:00:00Z") - 5 * 3600e3); // Pakistan midnight
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const fmtTime = (d) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(d));

export default async function PublishedPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const sp = await searchParams;
  const today = pkDay();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day || "") ? sp.day : today;
  const cat = sp.cat || "";
  freshDB(); await connectDB();
  const from = dayStart(day), to = dayStart(addDays(day, 1));
  const fields = { slug: 1, category: 1, contentType: 1, origin: 1, publishedAt: 1, "translations.en.title": 1, "translations.ur.title": 1, "sources.name": 1, "image.url": 1, social: 1, reel: 1 };
  const [rows, recent] = await Promise.all([
    Article.find({ status: "published", publishedAt: { $gte: from, $lt: to } }, fields).sort({ publishedAt: -1 }).lean(),
    Article.find({ status: "published", publishedAt: { $gte: dayStart(addDays(today, -13)) } }, { publishedAt: 1, category: 1, sources: 1 }).lean(),
  ]);
  const rmap = await reelMap(rows.map((a) => a.slug));
  const news = rows.filter((a) => a.contentType === "news");
  const pk = news.filter(isPk).length;
  const byCat = {};
  for (const a of rows) byCat[a.category] = (byCat[a.category] || 0) + 1;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const list = cat ? rows.filter((a) => a.category === cat) : rows;
  const auto = rows.filter((a) => a.origin === "auto").length;

  const perDay = {};
  for (const a of recent) {
    const d = new Date(new Date(a.publishedAt).getTime() + 5 * 3600e3).toISOString().slice(0, 10);
    perDay[d] = (perDay[d] || 0) + 1;
  }
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const q = (o) => `/admin/published?${new URLSearchParams({ day, ...o })}`;

  return (
    <div className="wrap" style={{ padding: "1.2rem 0 3rem" }}>
      <p><a href="/admin">← Mission Control</a></p>
      <h1>Published stories</h1>
      <p className="hint">Pakistan time. Pick a day to see how many stories went live and in which sections.</p>

      <div className="table-scroll"><table className="stats">
        <thead><tr><th>Day</th><th className="num">Stories</th></tr></thead>
        <tbody>{days.map((d) => (
          <tr key={d} style={d === day ? { fontWeight: 800 } : undefined}><td><a href={`/admin/published?day=${d}`}>{d}{d === today ? " (today)" : ""}</a></td><td className="num">{perDay[d] || 0}</td></tr>
        ))}</tbody>
      </table></div>

      <h2>{day}{day === today ? " (today)" : ""}</h2>
      <div className="kpis">
        <div className="kpi"><span>Total published</span><strong style={{ fontSize: "1.6rem" }}>{rows.length}</strong></div>
        <div className="kpi"><span>News: Pakistan</span><strong style={{ fontSize: "1.6rem" }}>{pk}</strong></div>
        <div className="kpi"><span>News: world</span><strong style={{ fontSize: "1.6rem" }}>{news.length - pk}</strong></div>
        <div className="kpi"><span>By autopilot</span><strong style={{ fontSize: "1.6rem" }}>{auto}</strong></div>
        <div className="kpi"><span>By hand</span><strong style={{ fontSize: "1.6rem" }}>{rows.length - auto}</strong></div>
      </div>

      <h2>By section</h2>
      <div className="table-scroll"><table className="stats">
        <thead><tr><th>Section</th><th className="num">Stories</th></tr></thead>
        <tbody>
          {cats.map(([c, n]) => <tr key={c} style={c === cat ? { fontWeight: 800 } : undefined}><td><a href={q({ cat: c })}>{c}</a></td><td className="num">{n}</td></tr>)}
          {!cats.length && <tr><td colSpan="2" className="muted">Nothing published on this day.</td></tr>}
        </tbody>
      </table></div>
      {cat && <p><a href={q({})}>Show all sections</a></p>}

      <h2>{cat ? `Stories in "${cat}"` : "All stories of the day"} ({list.length})</h2>
      <div className="table-scroll"><table className="stats">
        <thead><tr><th>Time</th><th>Headline</th><th>Section</th><th>Source</th><th>By</th><th>Reel</th></tr></thead>
        <tbody>{list.map((a) => (
          <tr key={a.slug}>
            <td>{fmtTime(a.publishedAt)}</td>
            <td>
              {a.translations?.ur?.title && <div><a href={`/ur/news/${a.slug}`} target="_blank" rel="noopener" lang="ur" dir="rtl" style={{ fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1.25rem", lineHeight: 1.9, display: "block" }}>{a.translations.ur.title}</a></div>}
              <a href={`/en/news/${a.slug}`} target="_blank" rel="noopener" className="muted">{a.translations?.en?.title || a.slug}</a>
            </td>
            <td>{a.category}</td>
            <td>{[...new Set((a.sources || []).map((s) => s.name))].slice(0, 2).join(", ")}</td>
            <td>{a.origin === "auto" ? "auto" : "hand"}</td>
            <td><StoryMarks a={a} reel={rmap[a.slug]} /> <ReelAction a={a} reel={rmap[a.slug]} /> <QuickShare a={a} lang="ur" /></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
