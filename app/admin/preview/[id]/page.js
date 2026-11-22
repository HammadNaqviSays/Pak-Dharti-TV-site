import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { isLoggedIn } from "@/lib/session";
import { connectDB, freshDB } from "@/lib/db";
import { Article } from "@/models";
import { isRTL, LANG_NAMES, DICT } from "@/lib/i18n";
import { ArticleView } from "@/components/Stories";
import { approveAction, rejectAction, unpublishAction } from "../../actions";
import PhotoChanger from "../../PhotoChanger";
import ShareRow from "../../ShareRow";
import MakeReelButton from "../../MakeReelButton";
import NewsCardMaker from "../../NewsCardMaker";
import AdminInstall from "../../AdminInstall";
import { StoryMarks, ReelAction, reelMap } from "../../StoryMarks";
import { cleanUrdu } from "@/lib/urdu";
import { saneCategory } from "@/lib/categoryFix";
import { resolveVisual } from "@/lib/visual";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const LANGS = ["ur", "en"];

export default async function PreviewPage({ params, searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin");
  const { id } = await params;
  const { lang: q, redo } = await searchParams;
  if (!mongoose.isValidObjectId(id)) notFound();
  freshDB(); await connectDB();
  const a = await Article.findById(id).lean();
  if (!a) notFound();
  const lang = LANGS.includes(q) ? q : "ur";
  const reel = (await reelMap([a.slug]))[a.slug];
  const idField = <input type="hidden" name="id" value={String(a._id)} />;
  let visual = null;
  try { const v = await resolveVisual(a, { redo: redo === "1" }); visual = { people: v.people, flags: v.flags, scene: v.scene }; } catch {}

  return (
    <>
      <div className="preview-bar">
        <div className="wrap">
          <a className="btn secondary" href="/admin">← Mission Control</a>
          <AdminInstall />
          <nav className="preview-tabs" aria-label="Language">
            {LANGS.map((l) => (
              <a key={l} href={`?lang=${l}`} lang={l} className={`lang-${l}${a.translations?.[l] ? "" : " missing"}`}
                aria-current={l === lang ? "true" : undefined}>{LANG_NAMES[l]}</a>
            ))}
          </nav>
          <div className="queue">
            <div className="actions" style={{ padding: ".3rem" }}>
              <span className={`status-pill ${a.status}`}>{a.status.replace("_", " ")}</span>
              {(a.status === "pending_review" || a.status === "draft") && (
                <>
                  <form action={approveAction}>{idField}<button className="btn publish">Publish</button></form>
                  {a.status === "pending_review" && <form action={rejectAction}>{idField}<button className="btn secondary">Reject</button></form>}
                </>
              )}
              {a.status === "published" && (
                <>
                  <a className="btn secondary" href={`/${lang}/news/${a.slug}`} target="_blank" rel="noopener">View live</a>
                  <ReelAction a={a} reel={reel} />
                  <form action={unpublishAction}>{idField}<button className="btn secondary">Unpublish</button></form>
                  <StoryMarks a={a} reel={reel} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: "1rem" }}>
        {a.status === "published" && <p className="hint"><strong>Video:</strong> <MakeReelButton slug={a.slug} label={a.reel?.at ? "Make reel again" : "Make reel (video)"} className="btn publish" /> <a className="btn secondary" href="/admin/reels">All reels</a></p>}
        {a.status === "published" && <ShareRow a={a} lang={lang} />}
        <PhotoChanger id={String(a._id)} current={a.image?.url} />
        <p className="hint"><a className="btn secondary" href={`?lang=${lang}&redo=1`}>Re-pick the people and place photo for this story</a> (use this if the card shows the wrong person)</p>
        <p className="hint"><a className="btn publish" href={`/admin/bayan?text=${encodeURIComponent(a.translations?.ur?.title ? cleanUrdu(a.translations.ur.title) : "")}&who=${encodeURIComponent(visual?.people?.[0]?.name || "")}`}>Make a Bayan card from this story</a></p>
        <NewsCardMaker slug={a.slug} image={a.image?.url || ""} postedCards={{ ur: a.social?.ur?.card ? String(a.social.ur.card) : "", en: a.social?.en?.card ? String(a.social.en.card) : "" }}
          titles={{ ur: a.translations?.ur?.title ? cleanUrdu(a.translations.ur.title) : "", en: a.translations?.en?.title || "" }}
          summaries={{ ur: a.translations?.ur?.summary ? cleanUrdu(a.translations.ur.summary) : "", en: a.translations?.en?.summary || "" }}
          categories={{ ur: DICT.ur.cats[saneCategory(a.category, a.translations?.en?.title, a.translations?.en?.summary)] || "", en: DICT.en.cats[saneCategory(a.category, a.translations?.en?.title, a.translations?.en?.summary)] || "" }}
          sources={[...new Set((a.sources || []).map((s) => s.name).filter(Boolean))].slice(0, 3).join(", ")}
          visual={visual} />
      </div>
      <div className={`preview-page lang-${lang}`} dir={isRTL(lang) ? "rtl" : "ltr"} lang={lang}>
        <div className="wrap">
          <ArticleView a={a} lang={lang} />
        </div>
      </div>
    </>
  );
}
