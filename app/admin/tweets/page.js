import { redirect } from "next/navigation";
import AdminInstall from "../AdminInstall";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Setting } from "@/models";
import TweetCardMaker from "../TweetCardMaker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TweetsPage() {
  if (!(await isLoggedIn())) redirect("/admin");
  freshDB(); await connectDB();
  const list = (await Setting.findOne({ key: "tweetSuggestions" }).lean())?.value || [];
  const suggestions = list.map((s) => ({ url: s.url, story: s.story || "", at: s.at ? new Date(s.at).toISOString() : null }));
  return (
    <>
      <div className="admin-top"><div className="wrap">
        <a className="admin-brand" href="/admin"><img src="/brand/logo.png" alt="" width="48" height="48" /><strong>Mission Control</strong></a>
        <AdminInstall />
        <a className="btn secondary" href="/admin">Back</a>
      </div></div>
      <div className="wrap">
        <TweetCardMaker suggestions={suggestions} />
      </div>
    </>
  );
}
