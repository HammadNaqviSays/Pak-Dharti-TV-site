import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Reel } from "@/models";
import { SceneLine } from "./SceneMedia";
import { makeReelScriptAction, setReelStatusAction, saveReelConfigAction, deleteRejectedReelsAction } from "../reelsAction";
import DeleteReel from "./DeleteReel";
import { BusyButton, ToastHost } from "../Busy";
import { getReelConfig, REEL_SECTIONS } from "@/lib/reelConfig";

const SECTION_NAME = { pakistan: "Pakistan", politics: "Politics", world: "World", economy: "Economy", sports: "Sports", disaster: "Disasters", entertainment: "Showbiz" };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME = { draft: "Script ready — change the words if you like, then press Make video now (it goes on by itself after 3 hours)", scripted: "⏳ In the queue — the video maker picks it up at its next run (within about an hour). You can leave this page.", rendering: "⚙️ Video is being made right now (about 5–10 minutes). Refresh the page to see it", ready: "Video ready — please check", approved: "Approved", posted: "Posted", failed: "Failed", rejected: "Rejected" };

export default async function ReelsPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  await connectDB();
  const cfg = await getReelConfig();
  const list = await Reel.find({}).sort({ createdAt: -1 }).limit(30).lean();
  return (
    <>
      <ToastHost />
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <h2>Reels</h2>
        <p className="hint">Each day the best fresh story gets a short reel script (6 to 8 scenes). Then the voice, pictures and video are made, and you check the finished reel here before it goes to Facebook and Instagram. Nothing is posted by itself until the auto-post switch is turned on.</p>
        <form action={saveReelConfigAction} style={{ border: "1px solid #ddd", borderRadius: 10, padding: "1rem", margin: "1rem 0", display: "grid", gap: ".7rem" }}>
          <strong>Where reels are made from</strong>
          <label><input type="checkbox" name="auto" defaultChecked={cfg.auto} /> Write reel scripts automatically</label>
          <label>Reels per day: <input type="number" name="perDay" min="1" max="10" defaultValue={cfg.perDay} style={{ width: 70 }} /> &nbsp; at least <input type="number" name="minGapHours" min="1" max="12" defaultValue={cfg.minGapHours} style={{ width: 60 }} /> hours apart</label>
          <div>Sections a reel may come from:{" "}
            {REEL_SECTIONS.map((c) => <label key={c} style={{ marginInlineEnd: "1rem", whiteSpace: "nowrap" }}><input type="checkbox" name={`cat_${c}`} defaultChecked={cfg.cats.includes(c)} /> {SECTION_NAME[c]}</label>)}
          </div>
          <label><input type="checkbox" name="ptiFirst" defaultChecked={cfg.ptiFirst} /> Imran Khan / PTI stories first, from any section</label>
          <div><BusyButton className="btn publish" text="Saving…">Save reel settings</BusyButton></div>
          <small className="hint">The best fresh story (last 24 hours) of the allowed sections is picked: Imran Khan / PTI first, then the most read. Every new script waits as a draft so you can change the words.</small>
        </form>
        <form action={makeReelScriptAction}><BusyButton className="btn publish" text="Writing a script. This takes up to a minute — please wait.">Write a script for the best fresh story now</BusyButton> <a className="btn secondary" href="/admin/voice">Reel voice</a></form>
        {list.some((r) => ["rejected", "failed"].includes(r.status)) && <form action={deleteRejectedReelsAction} style={{ marginTop: ".6rem" }}><button className="btn secondary">Delete all rejected and failed reels</button></form>}
        {list.length === 0 ? <p className="muted">No reels yet.</p> : (
          <ul className="queue">
            {list.map((r) => (
              <li key={String(r._id)}>
                <div>
                  <div className="title" lang="ur" dir="rtl" style={{ fontFamily: "\"Jameel Noori Nastaleeq\", var(--f-urdu)", fontSize: "1.3rem", lineHeight: 1.9 }}>{r.title}</div>
                  <div className="meta"><span>{NAME[r.status] || r.status}</span><span>{r.scenes?.length || 0} scenes</span><span>{new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })}</span>{r.error && <span style={{ color: "#a00" }}>{r.error}</span>}</div>
                  <details open={["draft", "scripted"].includes(r.status) && String(r._id) === String(list.find((x) => x.status === "draft")?._id)}><summary>Script</summary>
                    <ol dir="rtl" style={{ fontFamily: "\"Jameel Noori Nastaleeq\", var(--f-urdu)", fontSize: "1.15rem", lineHeight: 2 }}>
                      {r.scenes.map((s, i) => <li key={`${i}-${r.scenes.length}`}><SceneLine id={String(r._id)} n={i} extraAt={s.extraAt || []} text={s.text} kw={s.kw} who={s.who} pic={s.pic || ""} clip={s.clip || ""} extra={s.extra || []} canEdit={["draft", "scripted", "ready", "failed"].includes(r.status)} /></li>)}
                    </ol>
                    {["draft", "ready", "failed"].includes(r.status) && <form action={setReelStatusAction} style={{ margin: ".8rem 0" }}><input type="hidden" name="id" value={String(r._id)} /><input type="hidden" name="status" value="scripted" /><BusyButton className="btn publish" text="Sending to the video maker. Please wait…" done="✅ Ho gaya — reel video banne ki line mein chala gaya. Neeche us ka status \"In the queue\" ho jaye ga.">Make video again (new voice from these words)</BusyButton></form>}
                    {r.caption && <p dir="rtl" className="hint">{r.caption}</p>}
                  </details>
                  {r.videoUrl && <video src={r.videoUrl} controls playsInline style={{ maxWidth: 240, borderRadius: 8, marginTop: ".5rem" }} />}
                  {r.videoUrl && <div><a className="btn secondary" href={`${r.videoUrl}?download=1`}>Download video</a></div>}
                </div>
                <div className="actions">
                  <a className={r.status === "draft" ? "btn publish" : "btn secondary"} href={`/admin/reels/${String(r._id)}`}>{r.status === "draft" ? "Edit script" : "Edit look"}</a>
                  {r.status === "draft" && <form action={setReelStatusAction}><input type="hidden" name="id" value={String(r._id)} /><input type="hidden" name="status" value="scripted" /><BusyButton text="Sending to the video maker. Please wait…" done="✅ Ho gaya — reel video banne ki line mein chala gaya. Neeche us ka status \"In the queue\" ho jaye ga.">Make video now</BusyButton></form>}
                  <a className="btn secondary" href={`/ur/news/${r.slug}`} target="_blank" rel="noopener">Story</a>
                  {!["rendering", "posted"].includes(r.status) && <DeleteReel id={String(r._id)} />}
                  {r.status !== "rejected" && <form action={setReelStatusAction}><input type="hidden" name="id" value={String(r._id)} /><input type="hidden" name="status" value="rejected" /><BusyButton text="Rejecting…" done="✅ Reject ho gaya">Reject</BusyButton></form>}
                  {["ready", "failed"].includes(r.status) && <form action={setReelStatusAction}><input type="hidden" name="id" value={String(r._id)} /><input type="hidden" name="status" value="scripted" /><BusyButton text="Sending to the video maker. Please wait…" done="✅ Ho gaya — reel video banne ki line mein chala gaya. Neeche us ka status \"In the queue\" ho jaye ga.">Make video again</BusyButton></form>}
                  {r.status === "ready" && <form action={setReelStatusAction}><input type="hidden" name="id" value={String(r._id)} /><input type="hidden" name="status" value="approved" /><BusyButton className="btn publish" text="Approving…" done="✅ Approve ho gaya (is se kuch post nahi hota, video khud download karni hai)">Approve</BusyButton></form>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
