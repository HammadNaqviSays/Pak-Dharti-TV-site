import { redirect, notFound } from "next/navigation";
import AdminInstall from "../../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB } from "@/lib/db";
import { Reel } from "@/models";
import { prefillPictures } from "@/lib/reelMedia";
import { VOICES } from "@/lib/tts";
import { getVoice } from "@/lib/tts";
import ReelEditor from "./ReelEditor";

export const dynamic = "force-dynamic";

export default async function ReelEditPage({ params }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  await connectDB();
  let r = await Reel.findById(id).lean();
  if (!r) notFound();
  // a draft whose lines have no picture yet gets them now, so the editor always shows pictures
  if (r.status === "draft" || r.status === "scripted") {
    if (r.scenes.some((s) => !s.img && !s.pic && !s.clip)) { await prefillPictures(id).catch(() => {}); r = await Reel.findById(id).lean(); }
  }
  const defVoice = (await getVoice()).voice;
  const data = { id, voice: r.voice || "", defVoice, voices: VOICES, title: r.title, font: r.style?.font || "jameel", stroke: r.style?.stroke || "r", grade: r.style?.grade || "", badge: r.style?.badge || "", noise: r.style?.noise || "none", noiseAmt: r.style?.noiseAmt || "mid", mirror: !!r.style?.mirror, bgAlpha: r.style?.bgAlpha || 100, status: r.status,
    scenes: r.scenes.map((s) => ({ text: s.text, kw: s.kw || "", edited: !!s.edited, marks: (s.marks || []).map((m) => ({ i: m.i, c: m.c })), anim: s.anim || "right", size: s.size || 0, pic: s.pic || "", alt: s.alt || 0, extra: s.extra || [], extraAt: s.extraAt || [], clip: s.clip || "", mirror: !!s.mirror, img: s.img || "" })) };
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin/reels">Back to reels</a>
      </div></div>
      <div className="wrap">
        <ReelEditor data={data} />
      </div>
    </>
  );
}
