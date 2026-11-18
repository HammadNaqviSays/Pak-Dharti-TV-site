import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { getVoice, VOICES } from "@/lib/tts";
import VoiceForm from "./VoiceForm";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  if (!(await isLoggedIn())) redirect("/admin");
  const v = await getVoice(true);
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <h2>Reel voice</h2>
        <p className="hint">The voice that reads the news in reels. It uses the same Google keys as the news writing (the free Gemini voice model). Pick a voice and a style, press Listen, and Save when it sounds right.</p>
        <VoiceForm initial={v} voices={VOICES} />
      </div>
    </>
  );
}
