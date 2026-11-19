"use client";
import { useState } from "react";
import { publishGuestArticleAction } from "../guestArticle";

const CATS = ["pakistan", "politics", "world", "economy", "sports", "religion", "entertainment", "inspirational", "books", "quotes"];

export default function GuestArticleForm() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  async function submit(e) {
    e.preventDefault();
    const mode = e.nativeEvent.submitter?.value || "draft";
    if (mode === "publish" && !window.confirm("Publish this article LIVE on the website now?")) return;
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    setBusy(true); setRes(null);
    try { setRes(await publishGuestArticleAction(fd)); } catch (err) { setRes({ error: `Could not send: ${String(err?.message || err).slice(0, 120)}` }); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="cm-form">
      <h2>1. The writer</h2>
      <div className="cm-two">
        <label>Name (English) *<input name="authorName" required /></label>
        <label>Name (اردو)<input name="authorNameUr" dir="rtl" /></label>
      </div>
      <div className="cm-two">
        <label>Role / who they are (English)<input name="authorRole" placeholder="e.g. Lawyer and columnist" /></label>
        <label>Role (اردو)<input name="authorRoleUr" dir="rtl" /></label>
      </div>
      <div className="cm-two">
        <label>Short bio (English, 1-2 lines)<textarea name="authorBio" rows={3} /></label>
        <label>Short bio (اردو)<textarea name="authorBioUr" rows={3} dir="rtl" /></label>
      </div>
      <div className="cm-two">
        <label>Writer’s photo<input type="file" name="authorPhoto" accept="image/jpeg,image/png,image/webp" /></label>
        <label>Photo credit (optional)<input name="photoCredit" placeholder="e.g. Courtesy of the writer" /></label>
      </div>
      <label>Writer’s profile link (optional: Facebook, X, website)<input name="authorUrl" type="url" placeholder="https://" /></label>

      <h2>2. English version</h2>
      <label>Title *<input name="titleEn" required /></label>
      <label>One-line summary (shown under the title)<textarea name="summaryEn" rows={2} /></label>
      <label>Text * (paragraphs; ## for a heading)<textarea name="bodyEn" rows={14} required /></label>

      <h2>3. اردو ورژن</h2>
      <label>عنوان<input name="titleUr" dir="rtl" /></label>
      <label>ایک سطری خلاصہ<textarea name="summaryUr" rows={2} dir="rtl" /></label>
      <label>متن<textarea name="bodyUr" rows={14} dir="rtl" /></label>

      <h2>4. Picture and credit</h2>
      <div className="cm-two">
        <label>Article picture<input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
        <label>Credit for the picture (needed with a picture)<input name="imageCredit" placeholder="e.g. Photo: Ali Khan / Pak Dharti TV" /></label>
      </div>
      <label>Credit link (optional)<input name="imageCreditUrl" type="url" placeholder="https://" /></label>

      <h2>5. Where it goes</h2>
      <div className="cm-two">
        <label>Section<select name="category" defaultValue="pakistan">{CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Type<select name="contentType" defaultValue="opinion"><option value="opinion">Opinion / column</option><option value="feature">Feature</option></select></label>
      </div>
      <label>Tags (comma separated)<input name="tags" /></label>

      <p>
        <button type="submit" value="draft" disabled={busy} className="btn secondary">Save as draft</button>{" "}
        <span style={{ display: "inline-flex", gap: ".4rem", alignItems: "center", flexWrap: "wrap" }}><input type="datetime-local" name="scheduleAt" aria-label="Publish at (Pakistan time)" /><button type="submit" value="schedule" disabled={busy} className="btn secondary">Schedule (Pakistan time)</button></span>{" "}
        <button type="submit" value="publish" disabled={busy} className="btn publish">Publish now</button>
      </p>
      {busy && <p>Saving…</p>}
      {res?.error && <p style={{ color: "#B3261E", fontWeight: 700 }}>{res.error}</p>}
      {res?.ok && <p style={{ color: "#126B3A", fontWeight: 700 }}>{res.status === "published" ? "Published: " : "Saved as draft: "}<a href={res.status === "published" ? `/en/news/${res.slug}` : `/admin/preview/${res.id}`}>{res.slug}</a></p>}
    </form>
  );
}
