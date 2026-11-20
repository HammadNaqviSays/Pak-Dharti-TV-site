import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Article, Message, Setting } from "@/models";
import GoldRateForm from "./GoldRateForm";
import FindPhotos from "./FindPhotos";
import { getRates } from "@/lib/rates";
import LoginForm from "./LoginForm";
import InjectorForm from "./InjectorForm";
import AutopilotPanel from "./AutopilotPanel";
import SocialControl from "./SocialControl";
import { socialPanelData } from "./socialAction";
import AdminInstall from "./AdminInstall";
import { cleanUrdu } from "@/lib/urdu";
import SocialQueue from "./SocialQueue";
import { StoryMarks, ReelAction, QuickShare, reelMap } from "./StoryMarks";
import { approveAction, rejectAction, unpublishAction, logout, markMessagesReadAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // applies to the server actions on this page

const LIST = { slug: 1, origin: 1, contentType: 1, category: 1, "translations.en.title": 1, "translations.ur.title": 1, createdAt: 1, publishedAt: 1, "stats.views": 1, "quality.score": 1, "quality.decision": 1, "image.url": 1, social: 1, reel: 1 };
const fmt = (d) => d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(d)) : "";

function TopBar({ loggedIn }) {
  return (
    <div className="admin-top">
      <div className="wrap">
        <a className="admin-brand" href="/admin">
          <img src="/brand/logo.png" alt="" width="48" height="48" />
          <strong>Mission Control</strong>
        </a>
        <AdminInstall />
        {loggedIn && (
          <div style={{ display: "flex", gap: ".5rem" }}>
            <a className="btn secondary" href="/ur" target="_blank" rel="noopener">View site</a>
            <form action={logout}><button className="btn secondary">Log out</button></form>
          </div>
        )}
      </div>
    </div>
  );
}

const Title = ({ a }) => (
  <div>
    {a.translations?.ur?.title && <div className="title" lang="ur" dir="rtl" style={{ fontFamily: "\"Jameel Noori Nastaleeq\", var(--f-urdu)", fontWeight: 400, fontSize: "1.3rem", lineHeight: 1.9 }}>{cleanUrdu(a.translations.ur.title)}</div>}
    {a.translations?.en?.title && <div className="title" style={a.translations?.ur?.title ? { fontSize: ".85rem", opacity: .75 } : undefined}>{a.translations.en.title}</div>}
    <div className="meta">
      <span>{a.translations?.ur?.title ? (a.translations?.en?.title ? "Urdu + English" : "Urdu only") : "English only"}</span>
      <span>{a.origin === "manual" ? "Injected" : "Automated"}</span><span>{a.contentType}</span><span>{a.category}</span>
      <span>{fmt(a.publishedAt || a.createdAt)}</span>
      {a.stats?.views > 0 && <span>{a.stats.views} views</span>}
      {a.quality?.score != null && <span title={a.quality.decision}>Quality {a.quality.score}{a.quality.decision && !a.quality.decision.startsWith("score") ? ` · ${a.quality.decision}` : ""}</span>}
    </div>
  </div>
);

export default async function AdminPage() {
  if (!(await isLoggedIn())) {
    return <><TopBar /><div className="wrap"><LoginForm /></div></>;
  }

  await connectDB();
  // Start of today in Pakistan time (UTC+5)
  const pk = new Date(Date.now() + 5 * 3600e3);
  const todayStart = new Date(Date.UTC(pk.getUTCFullYear(), pk.getUTCMonth(), pk.getUTCDate()) - 5 * 3600e3);
  const day = new Date(Date.now() - 24 * 3600e3);
  const has = (l) => ({ [`translations.${l}.title`]: { $exists: true, $nin: ["", null] } });
  const hasNot = (l) => ({ $or: [{ [`translations.${l}.title`]: { $exists: false } }, { [`translations.${l}.title`]: { $in: ["", null] } }] });
  const pub = { status: "published" };
  const [enLive, urLive, enToday, urToday, enOnly, urOnly, both, enSocial, urSocial, enSocialToday, urSocialToday] = await Promise.all([
    Article.countDocuments({ ...pub, ...has("en") }), Article.countDocuments({ ...pub, ...has("ur") }),
    Article.countDocuments({ ...pub, ...has("en"), publishedAt: { $gte: todayStart } }), Article.countDocuments({ ...pub, ...has("ur"), publishedAt: { $gte: todayStart } }),
    Article.countDocuments({ ...pub, ...has("en"), ...hasNot("ur") }), Article.countDocuments({ ...pub, ...has("ur"), ...hasNot("en") }),
    Article.countDocuments({ ...pub, ...has("en"), "translations.ur.title": { $exists: true, $nin: ["", null] } }),
    Article.countDocuments({ "social.en.done": true }), Article.countDocuments({ "social.ur.done": true }),
    Article.countDocuments({ "social.en.at": { $gte: todayStart } }), Article.countDocuments({ "social.ur.at": { $gte: todayStart } }),
  ]);
  const [liveToday, liveTotal, autoDay, pendingCount] = await Promise.all([
    Article.countDocuments({ status: "published", publishedAt: { $gte: todayStart } }),
    Article.countDocuments({ status: "published" }),
    Article.countDocuments({ origin: "auto", createdAt: { $gte: day } }),
    Article.countDocuments({ status: "pending_review" }),
  ]);
  const [urOnlyList, enOnlyList] = await Promise.all([
    Article.find({ ...pub, ...has("ur"), ...hasNot("en") }, LIST).sort({ publishedAt: -1 }).limit(15).lean(),
    Article.find({ ...pub, ...has("en"), ...hasNot("ur") }, LIST).sort({ publishedAt: -1 }).limit(15).lean(),
  ]);
  const [pending, published, enPublished, byCategory] = await Promise.all([
    Article.find({ status: "pending_review" }, LIST).sort({ createdAt: -1 }).limit(30).lean(),
    Article.find({ status: "published", ...has("ur") }, LIST).sort({ publishedAt: -1 }).limit(30).lean(),
    Article.find({ status: "published", ...has("en") }, LIST).sort({ publishedAt: -1 }).limit(30).lean(),
    Article.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: "$category", articles: { $sum: 1 }, views: { $sum: "$stats.views" } } },
      { $sort: { views: -1 } },
    ]),
  ]);
  const [newsroomLog, noPhoto, messages, unread, goldSetting, rates] = await Promise.all([
    Setting.findOne({ key: "newsroomLog" }).lean(),
    Article.countDocuments({ status: { $in: ["published", "pending_review"] }, "image.provider": { $in: ["local", null] }, "image.searchedAt": null }),
    Message.find({}).sort({ createdAt: -1 }).limit(15).lean(),
    Message.countDocuments({ read: false }),
    Setting.findOne({ key: "goldTola24" }).lean(),
    getRates().catch(() => null),
  ]);
  const rmap = await reelMap([...new Set([...published, ...enPublished].map((a) => a.slug))]);
  const id = (a) => <input type="hidden" name="id" value={String(a._id)} />;

  return (
    <>
      <TopBar loggedIn />
      <div className="wrap" style={{ paddingBottom: "3rem" }}>
        <div className="kpis">
          <div className="kpi"><span>Published today</span><strong>{liveToday}</strong></div>
          <div className="kpi"><span>Live on the site</span><strong>{liveTotal}</strong></div>
          <div className="kpi"><span>Autopilot, last 24 h</span><strong>{autoDay}</strong></div>
          <div className="kpi"><span>Waiting for review</span><strong>{pendingCount}</strong></div>
        </div>
        <p className="hint" style={{ margin: "0 0 1rem" }}><a className="btn publish" href="/admin/bayan">Bayan card — statement post</a>{" "}<a className="btn publish" href="/admin/tweets">Tweet cards — posts on X as Pak Dharti cards</a>{" "}<a className="btn publish" href="/admin/article">Guest article (writer’s own text)</a>{" "}<a className="btn secondary" href="/admin/people">People library (photos)</a>{" "}<a className="btn secondary" href="/admin/hooks">Hook report (which opening brings readers)</a>{" "}<a className="btn secondary" href="/admin/cardlook">Card look (how people are drawn)</a>{" "}<a className="btn publish" href="/admin/oldcards">Earlier cards (posted ones)</a>{" "}<a className="btn publish" href="/admin/jobs">Jobs (review)</a>{" "}<a className="btn publish" href="/admin/reels">Reels</a>{" "}<a className="btn secondary" href="/admin/voice">Reel voice</a>{" "}<a className="btn publish" href="/admin/traffic">Traffic (views, platforms, regions)</a>{" "}
          <a className="btn publish" href="/admin/published">Published stories (per day, per section)</a>{" "}<a className="btn publish" href="/admin/review">Desk review (10 minutes a day)</a>{" "}<a className="btn secondary" href="/admin/audit">Site check (find and fix mistakes)</a></p>
        <h2>Urdu and English</h2>
        <div className="kpis">
          <div className="kpi"><span>Urdu live</span><strong>{urLive}</strong></div>
          <div className="kpi"><span>English live</span><strong>{enLive}</strong></div>
          <div className="kpi"><span>Urdu only (no English)</span><strong>{urOnly}</strong></div>
          <div className="kpi"><span>English only (no Urdu)</span><strong>{enOnly}</strong></div>
        </div>

        <div className="table-scroll">
          <table className="stats">
            <thead><tr><th>Language</th><th className="num">Live on the site</th><th className="num">Live today</th><th className="num">Posted to Facebook/Instagram</th><th className="num">Posted today</th></tr></thead>
            <tbody>
              <tr><td>Urdu</td><td className="num">{urLive}</td><td className="num">{urToday}</td><td className="num">{urSocial}</td><td className="num">{urSocialToday}</td></tr>
              <tr><td>English</td><td className="num">{enLive}</td><td className="num">{enToday}</td><td className="num">{enSocial}</td><td className="num">{enSocialToday}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="hint">In both languages: <b>{both}</b> &nbsp;|&nbsp; English only (no Urdu version): <b>{enOnly}</b> &nbsp;|&nbsp; Urdu only (no English version): <b>{urOnly}</b></p>

        <SocialQueue />
        <h2>Urdu stories <span className="count">{urLive}</span> <small className="muted">(newest 30)</small></h2>
        {published.length === 0 ? <p className="muted">No published articles yet.</p> : (
          <ul className="queue">
            {published.map((a) => (
              <li key={String(a._id)}>
                <div><Title a={a} /><StoryMarks a={a} reel={rmap[a.slug]} /></div>
                <div className="actions">
                  <a className="btn secondary" href={`/ur/news/${a.slug}`} target="_blank" rel="noopener">View</a>
                  <a className="btn secondary" href={`/admin/preview/${a._id}`}>Read / Card</a>
                  <ReelAction a={a} reel={rmap[a.slug]} />
                  <QuickShare a={a} lang="ur" />
                  <form action={unpublishAction}>{id(a)}<button className="btn secondary">Unpublish</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details style={{ margin: ".5rem 0" }}><summary><b>Urdu only</b> (no English version) · newest {urOnlyList.length} of {urOnly}</summary>
          {urOnlyList.length === 0 ? <p className="muted">None. Every Urdu story also has English.</p> : (
            <ul className="queue">{urOnlyList.map((a) => (<li key={String(a._id)}><Title a={a} /><div className="actions"><a className="btn secondary" href={`/ur/news/${a.slug}`} target="_blank" rel="noopener">View</a><a className="btn secondary" href={`/admin/preview/${a._id}`}>Read / Card</a></div></li>))}</ul>
          )}
        </details>
        <details style={{ margin: ".5rem 0 1rem" }}><summary><b>English only</b> (no Urdu version) · newest {enOnlyList.length} of {enOnly}</summary>
          {enOnlyList.length === 0 ? <p className="muted">None. Every English story also has Urdu.</p> : (
            <ul className="queue">{enOnlyList.map((a) => (<li key={String(a._id)}><Title a={a} /><div className="actions"><a className="btn secondary" href={`/en/news/${a.slug}`} target="_blank" rel="noopener">View</a><a className="btn secondary" href={`/admin/preview/${a._id}`}>Read / Card</a></div></li>))}</ul>
          )}
        </details>

        <h2>Autopilot: fill the site with the latest news</h2>
        <AutopilotPanel />
        <SocialControl initial={await socialPanelData()} />

        <h2>Narrative Force Injector</h2>
        <InjectorForm />

        <h2>Review queue <span className="count">{pending.length}</span></h2>
        {pending.length === 0 ? <p className="muted">Nothing waiting. New automated and injected articles appear here before going live.</p> : (
          <ul className="queue">
            {pending.map((a) => (
              <li key={String(a._id)}>
                <Title a={a} />
                <div className="actions">
                  <a className="btn secondary" href={`/admin/preview/${a._id}`}>Read</a>
                  <form action={approveAction}>{id(a)}<button className="btn publish">Publish</button></form>
                  <form action={rejectAction}>{id(a)}<button className="btn secondary">Reject</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2>Newsroom log <small className="muted">(automatic runs, newest first)</small></h2>
        {!(newsroomLog?.value?.length) ? <p className="muted">No automatic runs yet. They start every hour.</p> : (
          <div className="table-scroll">
            <table className="stats">
              <thead><tr><th>Time (PKT)</th><th>Result</th><th>Story</th><th>Quality</th></tr></thead>
              <tbody>
                {[...newsroomLog.value].reverse().slice(0, 15).map((r, k) => (
                  <tr key={k}>
                    <td>{fmt(r.at)}</td>
                    <td>{!r.ok ? `Error: ${r.error}` : r.repaired ? (r.published ? "Fixed and published" : "Fix tried, still held") : r.published ? "Published" : r.idle ? "Nothing new" : "Held for review"}{r.dedupe ? " · removed a duplicate" : ""}</td>
                    <td>{r.title || ""}</td>
                    <td>{r.quality ? `${r.quality.score} — ${r.quality.decision}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Photos</h2>
        <FindPhotos missing={noPhoto} />

        <h2>Today's gold rate</h2>
        <GoldRateForm current={goldSetting?.value} intl={rates?.gold?.source === "international" ? rates.gold.tola24 : null} />

        <h2>Messages <span className="count">{unread}</span> <small className="muted">from the contact page</small></h2>
        {messages.length === 0 ? <p className="muted">No messages yet.</p> : (
          <>
            <ul className="messages">
              {messages.map((m) => (
                <li key={String(m._id)} className={m.read ? "" : "unread"}>
                  <div className="msg-head"><strong>{m.subject || "Message"}</strong> · {m.name || "Anonymous"}
                    {m.email && <> · <a href={`mailto:${m.email}`}>{m.email}</a></>}
                    <span className="muted"> · {new Date(m.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })}</span></div>
                  <p dir="auto">{m.body}</p>
                </li>
              ))}
            </ul>
            {unread > 0 && <form action={markMessagesReadAction}><button className="btn secondary">Mark all as read</button></form>}
          </>
        )}

        <h2>Readership by category</h2>
        <div className="table-scroll">
          <table className="stats">
            <thead><tr><th>Category</th><th className="num">Articles</th><th className="num">Views</th><th className="num">Views per article</th></tr></thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c._id}><td>{c._id}</td><td className="num">{c.articles}</td><td className="num">{c.views}</td>
                  <td className="num">{c.articles ? (c.views / c.articles).toFixed(1) : "0"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>English stories <span className="count">{enLive}</span> <small className="muted">(newest 30)</small></h2>
        {enPublished.length === 0 ? <p className="muted">No published articles yet.</p> : (
          <ul className="queue">
            {enPublished.map((a) => (
              <li key={String(a._id)}>
                <div><Title a={a} /><StoryMarks a={a} reel={rmap[a.slug]} /></div>
                <div className="actions">
                  <a className="btn secondary" href={`/en/news/${a.slug}`} target="_blank" rel="noopener">View</a>
                  <a className="btn secondary" href={`/admin/preview/${a._id}`}>Read / Card</a>
                  <ReelAction a={a} reel={rmap[a.slug]} />
                  <QuickShare a={a} lang="en" />
                  <form action={unpublishAction}>{id(a)}<button className="btn secondary">Unpublish</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p><a href="/api/admin/export?type=articles">Download articles CSV</a> &nbsp;|&nbsp; <a href="/api/admin/export?type=daily">Download daily views CSV</a></p>
      </div>
    </>
  );
}
