"use client";
import { useEffect, useRef, useState } from "react";
import { captionAction, curiousHeadlineAction } from "./captionAction";
import { sendSocialAction, socialStateAction } from "./socialAction";
import SocialQueue from "./SocialQueue";
import CollageEditor from "./CollageEditor";
import FullPreview from "./FullPreview";
import { fitPhotoAction } from "./photoAction";
import { drawNewsCard, LABELS, TEMPLATE_NAMES, isRealPhoto, autoHighlight } from "@/lib/newsCard";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Social-media graphic for one story. Titles come in pre-filled; wrap words in *stars* to highlight them. */
// The summary's first sentence, short enough for one or two lines on the card
const firstLine = (s = "") => { const t = String(s).split(/(?<=[۔.!?؟])\s/)[0] || ""; return t.length > 110 ? `${t.slice(0, 105)}…` : t; };

export default function NewsCardMaker({ slug, postedCards = {}, titles, image, summaries = {}, categories = {}, sources = "", visual = null }) {
  const [lang, setLang] = useState(titles.ur ? "ur" : "en");
  const [text, setText] = useState(autoHighlight(titles.ur || titles.en || ""));
  const hasVisual = !!(visual && (visual.people?.length || visual.flags?.length || visual.scene));
  const [template, setTemplate] = useState(hasVisual ? "collage" : isRealPhoto(image) ? "pdnews" : "brand");
  const [vis, setVis] = useState(visual || { people: [], flags: [], scene: null });
  const [sub, setSub] = useState(firstLine(summaries[titles.ur ? "ur" : "en"]));
  const [showSub, setShowSub] = useState(false);
  const [cat, setCat] = useState(categories[titles.ur ? "ur" : "en"] || "");
  const [src, setSrc] = useState(sources);
  const [scale, setScale] = useState(1);
  const [badgePos, setBadgePos] = useState("auto");
  const [size, setSize] = useState("square");
  const [label, setLabel] = useState(LABELS[titles.ur ? "ur" : "en"][0]);
  const [speaker, setSpeaker] = useState("");
  const [img, setImg] = useState(image || "");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);
  // how wide the preview column is: S 340px (default), M 520px, L 720px, XL 960px; remembered on this device
  const [pv, setPv] = useState("S");
  useEffect(() => { try { const v = localStorage.getItem("cm-pv"); if (v) setPv(v); } catch {} }, []);
  const setPvSize = (v) => { setPv(v); try { localStorage.setItem("cm-pv", v); } catch {} };
  const PV_W = { S: 340, M: 520, L: 720, XL: 960 };
  const [cap, setCap] = useState(null); // { facebook, instagram, link } | { error }
  const [capBusy, setCapBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [sendFb, setSendFb] = useState(true);
  const [sendIg, setSendIg] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendRes, setSendRes] = useState(null);
  const [posted, setPosted] = useState(null); // { fb, ig, at } what this story already has on the pages
  const [force, setForce] = useState(false);
  const justNow = !!(posted?.at && Date.now() - new Date(posted.at).getTime() < 5 * 60e3) || !!(sendRes && ((sendRes.fb && !sendRes.fb.error) || (sendRes.ig && !sendRes.ig.error)));
  const canvas = useRef(null);
  const drag = useRef(null);   // { idx, x0, y0, dx0, dy0 } while a person is being dragged on the card
  useEffect(() => { let on = true; setPosted(null); setForce(false); socialStateAction(slug, lang).then((r) => { if (on && !r?.error) setPosted(r); }).catch(() => {}); return () => { on = false; }; }, [slug, lang, sendRes?.fb, sendRes?.ig]);

  // everything typed or arranged here is kept for this story (in this browser), so a refresh does not lose it
  const KEY = `pdcard:${slug}`;
  const restored = useRef(false);
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || "null");
      if (j && typeof j === "object") {
        if (j.lang) setLang(j.lang); if (j.text != null) setText(j.text); if (j.template) setTemplate(j.template); if (j.vis) setVis(j.vis);
        if (j.sub != null) setSub(j.sub); if (j.showSub != null) setShowSub(j.showSub); if (j.cat != null) setCat(j.cat); if (j.src != null) setSrc(j.src);
        if (j.scale) setScale(j.scale); if (j.badgePos) setBadgePos(j.badgePos); if (j.size) setSize(j.size); if (j.label != null) setLabel(j.label);
        if (j.speaker != null) setSpeaker(j.speaker); if (j.img) setImg(j.img);
        setSaved(true);
      }
    } catch {}
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ lang, text, template, vis, sub, showSub, cat, src, scale, badgePos, size, label, speaker, img })); setSaved(true); } catch {} }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, text, template, vis, sub, showSub, cat, src, scale, badgePos, size, label, speaker, img]);
  function startOver() { try { localStorage.removeItem(KEY); } catch {} location.reload(); }

  function switchLang(l) {
    setLang(l);
    setText(autoHighlight(titles[l] || titles.en || ""));
    setLabel(LABELS[l][0]);
    setSub(firstLine(summaries[l] || summaries.en));
    setCat(categories[l] || categories.en || "");
  }

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const c = canvas.current || (canvas.current = document.createElement("canvas"));
      await drawNewsCard(c, { ...opts(size), hd: drag.current ? false : undefined });
      if (alive) setPreview(c.toDataURL("image/jpeg", drag.current ? 0.6 : 0.85));
    }, drag.current ? 20 : 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, text, template, size, label, speaker, img, sub, showSub, cat, src, scale, vis, badgePos]);


  // Pick a person on the card with the mouse: drag = move, wheel = bigger / smaller
  function personAt(e) {
    const c = canvas.current; const r = e.currentTarget.getBoundingClientRect();
    if (!c?._boxes?.length || !r.width) return null;
    const x = ((e.clientX - r.left) / r.width) * c._lw, y = ((e.clientY - r.top) / r.height) * c._lh;
    for (let k = c._boxes.length - 1; k >= 0; k--) { const b = c._boxes[k]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.idx; }
    return null;
  }
  function dragStart(e) {
    if (template !== "collage") return;
    const idx = personAt(e); if (idx == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const L = vis.people[idx]?.lay || {};
    drag.current = { idx, x0: e.clientX, y0: e.clientY, dx0: L.dx || 0, dy0: L.dy || 0 };
  }
  function dragMove(e) {
    const d = drag.current; if (!d) return;
    const c = canvas.current, r = e.currentTarget.getBoundingClientRect();
    const dx = d.dx0 + (e.clientX - d.x0) / r.width;
    const dy = d.dy0 + ((e.clientY - d.y0) / r.height) * (c._lh / (c._areaH || c._lh));
    setVis((v) => ({ ...v, people: v.people.map((p, k) => k === d.idx ? { ...p, lay: { ...(p.lay || {}), dx: Math.max(-0.9, Math.min(0.9, dx)), dy: Math.max(-0.9, Math.min(0.9, dy)) } } : p) }));
  }
  function dragEnd() { if (drag.current) { drag.current = null; setVis((v) => ({ ...v })); } }
  function wheel(e) {
    if (template !== "collage") return;
    const idx = personAt(e); if (idx == null) return;
    e.preventDefault();
    setVis((v) => ({ ...v, people: v.people.map((p, k) => k === idx ? { ...p, lay: { ...(p.lay || {}), sc: Math.max(0.3, Math.min(2.2, (p.lay?.sc ?? 1) * (e.deltaY < 0 ? 1.05 : 0.95))) } } : p) }));
  }
  const previewBox = useRef(null);
  useEffect(() => {
    const el = previewBox.current; if (!el) return;
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const opts = (s) => ({ template, size: s, lang, text, label, speaker, imageSrc: img, subtitle: showSub ? sub : "", category: cat, sources: src, scale, visual: vis, badgePos });

  async function findPhoto() {
    setPhotoNote("Looking for a fitting photo…");
    try {
      const r = await fitPhotoAction(slug);
      if (r.url) { setImg(r.url); if (template === "brand" || (template === "collage" && !vis.people?.length)) setTemplate("pdnews"); setPhotoNote(`Photo: ${r.credit}`); }
      else setPhotoNote(r.error || "No photo found.");
    } catch { setPhotoNote("Could not look for a photo, try again."); }
  }
  // A story without a real news photo would show the big logo at the top: find a fitting photo by itself
  useEffect(() => { if (!isRealPhoto(img) && !vis.people?.length) findPhoto(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function writeCaption() {
    setCapBusy(true); setCap(null);
    try { setCap(await captionAction(slug, lang)); } catch { setCap({ error: "Please try again." }); }
    setCapBusy(false);
  }
  async function copy(key, text) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 2000); } catch { setCopied("press Ctrl+C"); }
  }

  async function sendNow() {
    if (!cap?.facebook) return;
    const where = [sendFb && "Facebook", sendIg && "Instagram"].filter(Boolean).join(" + ");
    if (!where) { setSendRes({ error: "Choose Facebook or Instagram." }); return; }
    if (!window.confirm(`Post this LIVE on ${where} (${lang === "ur" ? "Urdu" : "English"} page)?`)) return;
    setSendBusy(true); setSendRes(null);
    let stage = "drawing the card";
    try {
      const c = document.createElement("canvas");
      await drawNewsCard(c, opts("post"));
      stage = "making the image";
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("image could not be made");
      stage = "sending";
      const fd = new FormData();
      fd.set("slug", slug); fd.set("lang", lang);
      fd.set("fb", sendFb ? "1" : "0"); fd.set("ig", sendIg ? "1" : "0");
      fd.set("fbText", cap.facebook); fd.set("fbComment", cap.facebookComment || ""); fd.set("igText", cap.instagram);
      fd.set("force", force ? "1" : "0");
      fd.set("card", new File([blob], "card.jpg", { type: "image/jpeg" }));
      setSendRes(await sendSocialAction(fd));
    } catch (e) { setSendRes({ error: `Could not send (${stage}): ${String(e?.message || e).slice(0, 140)}` }); }
    setSendBusy(false);
  }

  async function save(sizes) {
    setBusy(true);
    for (const s of sizes) {
      const c = document.createElement("canvas");
      await drawNewsCard(c, opts(s));
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
      download(blob, `pak-dharti-${slug}-${lang}-${s}.jpg`);
    }
    setBusy(false);
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (f) setImg(URL.createObjectURL(f));
  }

  return (
    <section className="card-maker">
      <h2>Social media card</h2>
      <div className="cm-grid" style={{ gridTemplateColumns: `minmax(0, 1fr) ${PV_W[pv]}px` }}>
        <div className="cm-form">
          <div className="cm-line3">
            <label>Language
              <select value={lang} onChange={(e) => switchLang(e.target.value)}>
                <option value="ur">اردو</option><option value="en">English</option>
              </select>
            </label>
            <label>Design
              <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                {Object.entries(TEMPLATE_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Size
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="square">Square 1:1 (Instagram, Facebook)</option>
                <option value="post">Portrait 4:5 (Instagram, Facebook, X)</option>
              </select>
            </label>
          </div>
          <label>Headline <small>— words in *stars* are highlighted (already suggested)</small>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"} lang={lang} className={lang === "ur" ? "cm-ur" : ""} />
          </label>
          <div className="cm-actions cm-mini">
            <button type="button" className="btn secondary" onClick={async () => { const r = await curiousHeadlineAction(slug, lang); if (r?.text) setText(autoHighlight(r.text)); else alert(r?.error || "Try again."); }}>Make it curious ❓</button>
            <button type="button" className="btn secondary" onClick={() => setText(autoHighlight(text))}>Suggest highlight</button>
            <button type="button" className="btn secondary" onClick={() => setText(text.replace(/\*/g, ""))}>Remove highlight</button>
          </div>
          <div className="cm-line3">
            <label>Text size
              <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                <option value={0.7}>Much smaller</option><option value={0.85}>Smaller</option><option value={1}>Normal</option><option value={1.15}>Larger</option><option value={1.3}>Much larger</option>
              </select>
            </label>
            <label>Badge place
              <select value={badgePos} onChange={(e) => setBadgePos(e.target.value)}>
                <option value="auto">Automatic (top, reading side)</option><option value="none">No badge (remove it)</option>
                <option value="top-right">Top right</option><option value="top-left">Top left</option><option value="top-center">Top center</option>
                <option value="bottom-right">Bottom right (of the picture)</option><option value="bottom-left">Bottom left (of the picture)</option><option value="bottom-center">Bottom center (of the picture)</option>
              </select>
            </label>
            {template === "collage" && vis.people?.length > 0 && (
              <label>Picture style
                <select value={vis.people.every((p) => p.lay?.shape === "open") ? "open" : "circle"}
                  onChange={(e) => setVis((v) => ({ ...v, people: v.people.map((p) => ({ ...p, lay: { ...(p.lay || {}), shape: e.target.value } })) }))}>
                  <option value="circle">Circle with gold ring</option>
                  <option value="open">Open (whole photo)</option>
                </select>
              </label>
            )}
          </div>
          {template === "collage" && <CollageEditor vis={vis} setVis={setVis} />}
          <details className="cm-more">
            <summary>More options (one-line summary, section chip, sources, label, photo link)</summary>
          {(template === "pdnews" || template === "brand" || template === "collage") && (
            <>
              <label><span><input type="checkbox" checked={showSub} onChange={(e) => setShowSub(e.target.checked)} /> One-line summary under the headline</span>
                {showSub && <input value={sub} onChange={(e) => setSub(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"} className={lang === "ur" ? "cm-ur" : ""} />}
              </label>
              <div className="cm-row">
                <label>Section chip (top corner)
                  <input value={cat} onChange={(e) => setCat(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"} className={lang === "ur" ? "cm-ur" : ""} />
                </label>
                <label>Sources line
                  <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Dawn, Geo" />
                </label>
              </div>
            </>
          )}
          <div className="cm-row">
            {template !== "quote" ? (
              <label>Label
                <input list="cm-labels" value={label} onChange={(e) => setLabel(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"} className={lang === "ur" ? "cm-ur" : ""} />
                <datalist id="cm-labels">{LABELS[lang].map((l) => <option key={l} value={l} />)}</datalist>
              </label>
            ) : (
              <label>Speaker name
                <input value={speaker} onChange={(e) => setSpeaker(e.target.value)} dir={lang === "ur" ? "rtl" : "ltr"} className={lang === "ur" ? "cm-ur" : ""} placeholder={lang === "ur" ? "مثلاً: وزیر خزانہ" : "e.g. Finance Minister"} />
              </label>
            )}
            <label>Photo link
              <input value={img.startsWith("blob:") ? "(file from your device)" : img} onChange={(e) => setImg(e.target.value)} placeholder="https://..." />
            </label>
            <label>…or a photo from your device
              <input type="file" accept="image/*" onChange={pickFile} />
            </label>
          </div>
          </details>
          <div className="cm-actions">
            <button className="btn publish" onClick={() => save([size])} disabled={busy}>{busy ? "Preparing…" : "Download card"}</button>
            <button className="btn secondary" onClick={writeCaption} disabled={capBusy}>{capBusy ? "Writing…" : "Write the post text"}</button>
          </div>
          <div className="cm-caption">
            {cap?.error && <p className="error">{cap.error}</p>}
            {cap?.facebook && ["facebook", "facebookComment", "instagram"].map((k) => (
              <label key={k} style={{ display: "block", marginTop: ".7rem" }}>{k === "facebook" ? "Facebook post (no link)" : k === "facebookComment" ? "Facebook FIRST COMMENT (post it right after, as the page)" : "Instagram caption (link in bio)"}
                <textarea rows={k === "facebookComment" ? 4 : 8} value={cap[k]} onChange={(e) => setCap({ ...cap, [k]: e.target.value })} dir={cap.lang === "ur" ? "rtl" : "ltr"} style={{ width: "100%" }} />
                <button type="button" className="btn publish" onClick={() => copy(k, cap[k])}>{copied === k ? "Copied ✓" : "Copy"}</button>
              </label>
            ))}
            {cap?.link && <p className="hint">Instagram bio / story link (counted as Instagram in Traffic): <code>{cap.link}</code> <button type="button" className="btn secondary" onClick={() => copy("link", cap.link)}>{copied === "link" ? "Copied ✓" : "Copy link"}</button></p>}
            {cap?.facebook && (
              <div className="cm-send">
                <strong>Post now (uses the card above, 4:5 size)</strong>
                <label className="cm-inline"><input type="checkbox" checked={sendFb} onChange={(e) => setSendFb(e.target.checked)} /> Facebook page + first comment with link</label>
                <label className="cm-inline"><input type="checkbox" checked={sendIg} onChange={(e) => setSendIg(e.target.checked)} /> Instagram</label>
                {posted && (posted.fb || posted.ig) && (
                  <p className="hint" style={{ color: justNow ? "#126B3A" : "#a00" }}><strong>{justNow ? "Posted just now ✓" : "Already posted:"}</strong> Facebook {posted.fb ? "✓" : "✗"} · Instagram {posted.ig ? "✓" : "✗"}{posted.at ? ` (${new Date(posted.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" })})` : ""}. {justNow ? "It is on your page now. To post it again later you would need “Post anyway”." : "Posting the ticked one again needs “Post anyway”."}</p>
                )}
                {((posted && (posted.fb || posted.ig)) || sendRes?.duplicate) && (
                  <label className="cm-inline"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Post anyway (for example I deleted the old post)</label>
                )}
                <button type="button" className="btn publish" onClick={sendNow} disabled={sendBusy}>{sendBusy ? "Posting…" : "Post on selected"}</button>
                {sendRes?.error && <p className="error">{sendRes.error}</p>}
                {sendRes?.queued && <p className="hint" style={{ color: "#126B3A", fontWeight: 700 }}>✅ Saved in the posting queue (number {sendRes.position}). It will be posted by itself at {new Date(sendRes.etaAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi" })} Pakistan time (in about {sendRes.etaMin} minute(s)), when the gap after the last post is over. The list below counts down. You do not need to press again.</p>}
                <SocialQueue bump={sendRes?.queued ? 1 : 0} />
                {sendRes?.fb && <p className={sendRes.fb.error ? "error" : "hint"}>Facebook: {sendRes.fb.error || (sendRes.fb.commentError ? `posted ✓ (comment failed: ${sendRes.fb.commentError})` : "posted ✓")}</p>}
                {sendRes?.ig && <p className={sendRes.ig.error ? "error" : "hint"}>Instagram: {sendRes.ig.error || "posted ✓"}</p>}
              </div>
            )}
            {cap?.facebook && <p className="hint">Check the text once before posting. The link carries a tag, so Facebook and Instagram visitors show up in Traffic.</p>}
          </div>
          <div className="cm-photo">
            <button type="button" className="btn secondary" onClick={findPhoto}>Find a fitting photo (person or place)</button>
            {photoNote && <p className="hint">{photoNote}</p>}
            {!isRealPhoto(img) && !photoNote && <p className="hint">This story has no news photo yet, so the Pak Dharti frame is used.</p>}
          </div>
          <p className="hint">Use only photos you are allowed to use: our own, Wikimedia/Unsplash (already credited on the site) or official handouts. Never put another channel's graphic or logo in our cards.</p>
        </div>
        <div className="cm-preview">
          {postedCards[lang] && (
            <div className="cm-posted">
              <a href={`/api/media/${postedCards[lang]}`} target="_blank" rel="noopener"><img src={`/api/media/${postedCards[lang]}`} alt="" /></a>
              <span><strong>Already posted card</strong><br /><small>Exactly the picture that went to Facebook / Instagram.</small><br />
                <a className="btn publish" href={`/api/media/${postedCards[lang]}`} download={`${slug}-${lang}-posted.jpg`}>Download the posted card</a></span>
            </div>
          )}
          {saved && <p className="hint cm-saved">✓ Saved automatically for this story. <button type="button" className="btn secondary" onClick={startOver}>Start over</button></p>}
          {preview ? <img ref={previewBox} src={preview} alt="Card preview" draggable={false}
            onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}
            style={template === "collage" ? { touchAction: "none", cursor: "grab" } : undefined} /> : <div className="cm-wait">Drawing…</div>}
          {preview && (
            <p className="cm-pvbar" style={{ margin: ".5rem 0 0", display: "flex", flexWrap: "wrap", gap: ".4rem", alignItems: "center" }}>
              <span className="hint" style={{ margin: 0 }}>Size:</span>
              {["S", "M", "L", "XL"].map((k) => <button key={k} type="button" className={pv === k ? "btn publish" : "btn secondary"} onClick={() => setPvSize(k)}>{k}</button>)}
              <button type="button" className="btn secondary" onClick={() => setFull(true)}>⛶ Full screen</button>
            </p>
          )}
          {full && preview && (
            <FullPreview onClose={() => setFull(false)} note="This is the finished card. Check the edges, top and bottom, then close.">
              <img src={preview} alt="Full card preview" style={{ height: "92vh", maxWidth: "98vw", objectFit: "contain", borderRadius: 4, background: "#fff" }} />
            </FullPreview>
          )}
        </div>
      </div>
    </section>
  );
}
