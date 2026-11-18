"use client";
import { Fragment, useActionState } from "react";
import { injectAction } from "./actions";

const CATS = ["pakistan", "politics", "economy", "sports", "world", "disaster", "religion", "inspirational", "folklore", "entertainment", "poetry", "quotes", "books"];

export default function InjectorForm() {
  const [state, action, pending] = useActionState(injectAction, null);
  return (
    <form action={action} className="panel">
      <div className="field">
        <label htmlFor="brief">Topic or angle</label>
        <textarea id="brief" name="brief" rows={4} required minLength={15} maxLength={2000}
          placeholder="e.g. A special feature on Rabi-ul-Awwal and the Prophet's ﷺ teachings on mercy and honesty" />
      </div>
      <div className="field">
        <label htmlFor="headline">Headline (optional)</label>
        <input id="headline" name="headline" maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="sourceMaterial">Facts to use (optional)</label>
        <textarea id="sourceMaterial" name="sourceMaterial" rows={4} maxLength={8000}
          placeholder="Paste verified facts, figures or quotes with their source. The AI will only state specifics that appear here." />
        <small>Without facts here, the article stays general and won't mention numbers, quotes or specific events.</small>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue="pakistan">{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="contentType">Type</label>
          <select id="contentType" name="contentType" defaultValue="feature">
            <option value="feature">Feature</option><option value="opinion">Opinion</option>
            <option value="news">News</option><option value="story">Story</option></select></div>
        <div className="field"><label htmlFor="slot">Placement</label>
          <select id="slot" name="slot" defaultValue="breaking">
            <option value="breaking">Breaking band</option><option value="featured">Featured</option>
            <option value="top">Top of list</option><option value="standard">Standard</option></select></div>
        <div className="field"><label htmlFor="pinHours">Pin for (hours)</label>
          <input id="pinHours" name="pinHours" type="number" min={1} max={72} defaultValue={6} /></div>
        <div className="field"><label htmlFor="publishMode">Publishing</label>
          <select id="publishMode" name="publishMode" defaultValue="review">
            <option value="review">Send to review queue</option><option value="instant">Publish now</option></select></div>
      </div>

      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn force" disabled={pending}>
        {pending ? "Writing in English and Urdu… (about 30 seconds)" : "Generate article"}
      </button>

      {state?.ok && (
        <div className="ok" role="status" style={{ marginTop: "1rem" }}>
          <strong>{state.result.status === "published" ? "Published." : "Ready for review."}</strong>
          <dl>
            {Object.entries(state.result.titles).map(([l, title]) => (
              <Fragment key={l}><dt>{l}</dt><dd lang={l} dir={l === "ur" || l === "ar" ? "rtl" : "ltr"}>{title}</dd></Fragment>
            ))}
          </dl>
          {state.result.failedLangs.length > 0 && <p>Translation failed for: {state.result.failedLangs.join(", ")}. English will show for those languages.</p>}
          <a className="btn secondary" href={`/admin/preview/${state.result.articleId}`}>Read the full article</a>
          {state.result.status === "published" && <> <a className="btn secondary" href={`/ur/news/${state.result.slug}`} target="_blank" rel="noopener">Open on the site</a></>}
        </div>
      )}
    </form>
  );
}
