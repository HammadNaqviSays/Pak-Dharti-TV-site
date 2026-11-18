"use client";
import { useEffect, useState } from "react";
import { uploadReelPicAction, uploadReelClipAction, setReelSceneMediaAction, setReelSceneTextAction, reelScenePictureAction, suggestScenePicturesAction, setReelSceneSplitAction, mergeSceneSegmentAction, removeSceneSegmentAction, changeSegmentPictureAction, addReelLineAction, deleteReelLineAction, logReelMediaAction, sceneOptionsAction, useSceneOptionAction } from "../reelsAction";

// shrink a chosen picture to ~1500 px JPEG in the browser before sending it
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));   // landscape pictures are cut to the middle: keep enough pixels
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
}

/** Own picture / own video clip for ONE line of the script, right in the list. */
export default function SceneMedia({ id, n, text = "", pic = "", clip = "", extra = [], extraAt = [], thumb = "", onPicture }) {
  const [msg, setMsg] = useState("");
  const [view, setView] = useState("");      // picture shown big
  const [whole, setWhole] = useState(false);
  const [cur, setCur] = useState({ pic, clip });
  useEffect(() => { const f = (e) => { if (e.detail?.id === id && e.detail?.n === n) { setWhole(false); setView(e.detail.url); } }; window.addEventListener("reel-view", f); return () => window.removeEventListener("reel-view", f); }, [id, n]);
  const [opts, setOpts] = useState(null), [oq, setOq] = useState("");   // suggested pictures to choose from
  const showOpts = async (q = "") => {
    setMsg("Looking for pictures…"); setOpts(opts || []);
    const r = await sceneOptionsAction(id, n, q);
    if (r?.error) { setMsg(r.error); return; }
    setOpts(r.options); if (!q) setOq(r.kw || "");
    setMsg(r.options.length ? `${r.options.length} pictures. Click one to use it.${r.notes?.length ? " (" + r.notes.join(", ") + ")" : ""}` : "Nothing found. Try other search words (English works best) or use My picture.");
  };
  const useOpt = async (o) => {
    setMsg("Saving…");
    const r = await useSceneOptionAction(id, n, o.url, o.credit);
    if (r?.error) { setMsg(r.error); return; }
    setCur({ pic: "", clip: "" }); onPicture?.(r.url); setOpts(null); setMsg("Picture chosen for this line.");
  };
  const [more, setMore] = useState(extra);
  const words = text.split(/\s+/).filter(Boolean);
  const [at, setAt] = useState(() => more.map((_, j) => (typeof extraAt[j] === "number" ? extraAt[j] : Math.round(words.length * (j + 1) / (more.length + 1)))));
  const suggest = async () => {
    setMsg("AI is reading the line and choosing pictures…");
    const r = await suggestScenePicturesAction(id, n);
    if (r?.error) { setMsg(r.error); return; }
    setCur({ pic: "", clip: "" }); setMore(r.urls.slice(1)); setAt(r.at); onPicture?.(r.urls[0]);
    setMsg(`AI chose ${r.urls.length} pictures. Change the "from word" or any picture if you like.`);
  };
  const changeAt = async (j, v) => {
    const next = [...at]; next[j] = Number(v); setAt(next);
    const r = await setReelSceneSplitAction(id, n, next);
    if (r?.error) setMsg(r.error); else { setAt(r.at); setMsg("Saved when the picture changes."); }
  };

  const upPic = async (file) => {
    if (!file) return;
    setMsg("Uploading the picture…");
    try {
      const blob = await shrink(file); const fd = new FormData();
      fd.set("id", id); fd.set("n", String(n)); fd.set("file", new File([blob], "p.jpg", { type: "image/jpeg" }));
      const r = await uploadReelPicAction(fd);
      if (r?.error) { setMsg(r.error); return; }
      const s = await setReelSceneMediaAction(id, n, "pic", r.url);
      if (s?.error) { setMsg(s.error); return; }
      setCur({ pic: r.url, clip: "" }); onPicture?.(r.url); logReelMediaAction(id, n, "picture"); setMsg("Picture added for this line.");
    } catch { setMsg("Could not read that picture."); }
  };
  const upClip = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setMsg("Clip is too big (max 20 MB). Please trim it first."); return; }
    const PIECE = 3 * 1024 * 1024, total = Math.ceil(file.size / PIECE);
    try {
      let url = "";
      for (let p = 0; p < total; p++) {
        setMsg(`Uploading clip… ${p + 1}/${total}`);
        const fd = new FormData();
        fd.set("id", id); fd.set("n", String(n)); fd.set("part", String(p)); fd.set("total", String(total));
        fd.set("file", new File([file.slice(p * PIECE, (p + 1) * PIECE)], "c.bin"));
        const r = await uploadReelClipAction(fd);
        if (r?.error) { setMsg(r.error); return; }
        url = r.url;
      }
      const s = await setReelSceneMediaAction(id, n, "clip", url);
      if (s?.error) { setMsg(s.error); return; }
      setCur({ pic: "", clip: url }); logReelMediaAction(id, n, "clip"); setMsg("Video clip added for this line.");
    } catch { setMsg("Clip upload failed, try again."); }
  };
  const slotOf = (u) => Number((/x(\d)(\?|$)/.exec(String(u)) || [])[1]) || 0;
  const upExtra = async (file) => {
    if (!file || more.length >= 3) return;
    setMsg("Uploading the picture…");
    try {
      const used = more.map(slotOf), k = [1, 2, 3].find((x) => !used.includes(x)), blob = await shrink(file), fd = new FormData();
      fd.set("id", id); fd.set("n", String(n)); fd.set("k", String(k)); fd.set("file", new File([blob], "p.jpg", { type: "image/jpeg" }));
      const r = await uploadReelPicAction(fd);
      if (r?.error) { setMsg(r.error); return; }
      const s = await setReelSceneMediaAction(id, n, `extra${k}`, r.url);
      if (s?.error) { setMsg(s.error); return; }
      const cnt = more.length + 1, nat = [...at, Math.round(words.length * cnt / (cnt + 1))].map((v, q, arr) => Math.min(words.length - 1, Math.max(v, (arr[q - 1] || 0) + 1))); setMore([...more, r.url]); setAt(nat); setReelSceneSplitAction(id, n, nat); logReelMediaAction(id, n, "extra"); setMsg(`Another picture added (${cnt + 1} pictures in this line).`);
    } catch { setMsg("Could not read that picture."); }
  };
  const other = async () => {
    setMsg("Looking for another picture…");
    const r = await reelScenePictureAction(id, n, "other");
    if (r?.error) setMsg(r.error); else { setCur({ pic: "", clip: "" }); onPicture?.(r.url); setMsg("New stock picture. " + (r.credit || "")); }
  };
  const clear = async () => { const s = await setReelSceneMediaAction(id, n, "none", ""); if (s?.error) setMsg(s.error); else { setCur({ pic: "", clip: "" }); setMore([]); setAt([]); onPicture?.(""); setMsg("Back to the automatic picture."); } };

  const apply = (r) => { if (r?.error) { setMsg(r.error); return false; } setMore(r.extra); setAt(r.at); if (r.main) onPicture?.(r.main); return true; };
  const join = async (seg, dir) => { setMsg("Joining…"); if (apply(await mergeSceneSegmentAction(id, n, seg, dir))) setMsg("Joined. Those words now use the " + (dir === "prev" ? "previous" : "next") + " picture."); };
  const remove = async (seg) => { setMsg("Removing…"); if (apply(await removeSceneSegmentAction(id, n, seg))) setMsg("Picture removed. Its words were shared with the pictures before and after it."); };
  const another = async (seg) => { setMsg("Looking for another picture…"); if (seg === 0) await other(); else if (apply(await changeSegmentPictureAction(id, n, seg))) setMsg("New picture for part " + (seg + 1) + "."); };
  const mine = async (seg, file) => {
    if (!file) return;
    if (seg === 0) return upPic(file);
    setMsg("Uploading the picture…");
    try {
      const blob = await shrink(file), fd = new FormData();
      const slot = slotOf(more[seg - 1]) || [1, 2, 3].find((x) => !more.map(slotOf).includes(x));
      fd.set("id", id); fd.set("n", String(n)); fd.set("k", String(slot)); fd.set("file", new File([blob], "p.jpg", { type: "image/jpeg" }));
      const r = await uploadReelPicAction(fd);
      if (r?.error) { setMsg(r.error); return; }
      const s2 = await setReelSceneMediaAction(id, n, `extra${slot}`, r.url, seg - 1);
      if (s2?.error) { setMsg(s2.error); return; }
      const nm = [...more]; nm[seg - 1] = r.url; setMore(nm); logReelMediaAction(id, n, "extra"); setMsg("Your picture is used for part " + (seg + 1) + ".");
    } catch { setMsg("Could not read that picture."); }
  };
  const starts = [0, ...at], ends = [...at, words.length];
  const pics = [thumb || cur.pic || "", ...more];
  const nudge = (j, d) => { const v = (at[j - 1] ?? 1) + d; if (v >= 1 && v < words.length) changeAt(j - 1, v); };
  const small = { padding: ".15rem .5rem", fontSize: ".72rem" };
  return (
    <span dir="ltr" style={{ display: "block", marginInlineStart: ".5rem", fontFamily: "system-ui, sans-serif", fontSize: ".8rem" }}>
      {view && (
        <span onClick={() => setView("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 9999, display: "grid", placeItems: "center", cursor: "zoom-out", padding: "1rem" }}>
          <span onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: ".5rem", justifyItems: "center", cursor: "default" }}>
            <span style={{ position: "relative", height: "82vh", aspectRatio: whole ? "auto" : "9 / 16", maxWidth: "92vw", background: "#000", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center" }}>
              <img src={view} alt="" style={whole ? { maxHeight: "82vh", maxWidth: "92vw", objectFit: "contain" } : { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 28%" }} />
            </span>
            <span style={{ display: "flex", gap: ".5rem" }}>
              <button type="button" className="btn secondary" onClick={() => setWhole(!whole)}>{whole ? "Show as in the video (9:16)" : "Show the whole picture"}</button>
              <button type="button" className="btn publish" onClick={() => setView("")}>Close</button>
            </span>
            <small style={{ color: "#fff" }}>{whole ? "The whole picture." : "This is how it will look in the video: wide pictures are cut to the middle."}</small>
          </span>
        </span>
      )}
      {!cur.clip && pics.length > 0 && (
        <span style={{ display: "grid", gap: ".4rem", margin: ".4rem 0" }}>
          {pics.map((u, j) => (
            <span key={j} style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap", border: "1px solid #e2dcda", borderRadius: 8, padding: ".3rem" }}>
              {u ? <img src={u} alt="" title="Click to see it big, as it will look in the video" onClick={() => { setWhole(false); setView(u); }} width="48" height="85" style={{ objectFit: "cover", borderRadius: 4, cursor: "zoom-in" }} /> : <span style={{ width: 34, height: 60, background: "#e9e4e2", borderRadius: 4 }} />}
              <span style={{ flex: "1 1 160px", minWidth: 0 }}>
                <b>{pics.length > 1 ? `Picture ${j + 1}` : "Picture for the whole line"}</b>{pics.length > 1 && <small> — words {starts[j] + 1} to {ends[j]}</small>}
                <span dir="rtl" style={{ display: "block", fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1rem", opacity: .85 }}>{words.slice(starts[j], ends[j]).join(" ")}</span>
              </span>
              <span style={{ display: "inline-flex", gap: ".3rem", flexWrap: "wrap" }}>
                {j === 0 && <button type="button" className="btn secondary" style={small} onClick={() => (opts ? setOpts(null) : showOpts())} title="See several suggested pictures and choose one">{opts ? "Hide options" : "Options"}</button>}
                <button type="button" className="btn secondary" style={small} onClick={() => another(j)}>Different</button>
                <label className="btn secondary" style={{ ...small, cursor: "pointer" }}>My picture<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => mine(j, e.target.files?.[0])} /></label>
                {pics.length > 1 && <button type="button" className="btn secondary" style={{ ...small, color: "#a00" }} onClick={() => remove(j)} title="Remove this picture; its words are shared by the pictures before and after">Remove this picture</button>}
                {pics.length > 1 && j > 0 && <button type="button" className="btn secondary" style={small} onClick={() => join(j, "prev")}>Words join previous picture</button>}
                {pics.length > 1 && j < pics.length - 1 && <button type="button" className="btn secondary" style={small} onClick={() => join(j, "next")}>Words join next picture</button>}
                {j > 0 && <span style={{ display: "inline-flex", gap: ".2rem", alignItems: "center" }}>
                  <button type="button" className="btn secondary" style={small} onClick={() => nudge(j, -1)} title="Start this picture one word earlier">◀ 1 word</button>
                  <button type="button" className="btn secondary" style={small} onClick={() => nudge(j, 1)} title="Start this picture one word later">1 word ▶</button>
                </span>}
              </span>
            </span>
          ))}
        </span>
      )}
      {opts && !cur.clip && (
        <span style={{ display: "block", border: "1px solid #e2dcda", borderRadius: 8, padding: ".4rem", margin: ".3rem 0" }}>
          <span style={{ display: "flex", gap: ".4rem", marginBottom: ".4rem" }}>
            <input value={oq} onChange={(e) => setOq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), showOpts(oq))} placeholder="Search words, e.g. courtroom, television studio" style={{ flex: 1, minWidth: 0 }} />
            <button type="button" className="btn secondary" style={small} onClick={() => showOpts(oq)}>Search</button>
          </span>
          <span style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
            {opts.map((o) => (
              <button type="button" key={o.url} onClick={() => useOpt(o)} title={o.credit} style={{ border: "1px solid #ccc", padding: 0, background: "none", cursor: "pointer", borderRadius: 4, overflow: "hidden" }}>
                <img src={o.thumb} alt="" width="72" height="108" loading="lazy" style={{ objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </span>
        </span>
      )}
    <span style={{ display: "inline-flex", gap: ".4rem", flexWrap: "wrap", alignItems: "center" }}>
      {more.length < 3 && <label className="btn secondary" style={{ cursor: "pointer", padding: ".2rem .6rem" }}>+ Another picture<input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => upExtra(e.target.files?.[0])} /></label>}
      {words.length >= 6 && <button type="button" className="btn secondary" style={{ padding: ".2rem .6rem" }} onClick={suggest}>AI: pictures for each part</button>}
      <label className="btn secondary" style={{ cursor: "pointer", padding: ".2rem .6rem" }}>My video clip<input type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => upClip(e.target.files?.[0])} /></label>
      {(cur.pic || cur.clip || more.length > 0) && <button type="button" className="btn secondary" style={{ padding: ".2rem .6rem" }} onClick={clear}>Remove</button>}
      <small>{cur.clip ? "Your clip" : ""} {msg}</small>
    </span>
    </span>
  );
}

/** One line of the script: the words can be changed right here, with the media buttons beside it. */
export function SceneLine({ id, n, text, kw, who, pic, clip, extra = [], extraAt = [], canEdit }) {
  const [val, setVal] = useState(text);
  const [saved, setSaved] = useState(text);
  const [msg, setMsg] = useState("");
  const [thumb, setThumb] = useState(pic || "");
  const [isClip, setIsClip] = useState(!!clip);
  useEffect(() => {
    if (!canEdit) return;
    let live = true;
    const t = setTimeout(async () => { const r = await reelScenePictureAction(id, n, "show"); if (live && r?.url) setThumb(r.url); if (live && r?.clip) setIsClip(true); if (live && r?.error) setMsg(r.error); }, 250 * n);
    return () => { live = false; clearTimeout(t); };
  }, [id, n, canEdit]);
  const save = async () => {
    if (val.replace(/\s+/g, " ").trim() === saved) return;
    setMsg("Saving…");
    const r = await setReelSceneTextAction(id, n, val);
    if (r?.error) setMsg(r.error); else { setSaved(val.replace(/\s+/g, " ").trim()); setMsg("Saved. Press Make video again to hear it."); }
  };
  if (!canEdit) return <span>{text} <small dir="ltr" style={{ opacity: .6 }}>[{kw}{who ? ` · ${who}` : ""}]</small></span>;
  return (
    <span style={{ display: "flex", gap: ".8rem", alignItems: "flex-start" }}>
      <span style={{ flex: "none", width: 90, height: 160, background: "#e9e4e2", borderRadius: 8, overflow: "hidden", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", fontSize: ".7rem", textAlign: "center" }}>
        {thumb ? <img src={thumb} alt="" title="Click to see it big" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("reel-view", { detail: { id, n, url: thumb } })); }} width="90" height="160" style={{ objectFit: "cover", cursor: "zoom-in" }} /> : isClip ? "Your video clip" : "picture…"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <textarea dir="rtl" lang="ur" value={val} rows={2} onChange={(e) => setVal(e.target.value)} onBlur={save}
          style={{ width: "100%", fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1.15rem", lineHeight: 1.9, padding: ".3rem .5rem" }} />
        <span dir="ltr" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center", fontFamily: "system-ui, sans-serif", fontSize: ".8rem" }}>
          <small style={{ opacity: .6 }}>[{kw}{who ? ` · ${who}` : ""}]</small>
          {val.replace(/\s+/g, " ").trim() !== saved && <button type="button" className="btn publish" style={{ padding: ".2rem .7rem" }} onClick={save}>Save words</button>}
          <small>{msg}</small>
        </span>
        <LineTools id={id} n={n} />
        <SceneMedia id={id} n={n} text={val} pic={pic} clip={clip} extra={extra} extraAt={extraAt} thumb={thumb} onPicture={(u) => { setThumb(u); setIsClip(false); }} />
      </span>
    </span>
  );
}

/** Add a new line after this one, or remove this line. */
function LineTools({ id, n }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState("");
  const [msg, setMsg] = useState("");
  const add = async () => { setMsg("Adding…"); const r = await addReelLineAction(id, n, t); if (r?.error) setMsg(r.error); else { setT(""); setOpen(false); setMsg("Line added below. Refresh if you do not see it."); } };
  const del = async () => { if (!confirm("Remove this line?")) return; setMsg("Removing…"); const r = await deleteReelLineAction(id, n); if (r?.error) setMsg(r.error); };
  return (
    <span dir="ltr" style={{ display: "block", fontFamily: "system-ui, sans-serif", fontSize: ".8rem", margin: ".3rem 0" }}>
      <button type="button" className="btn secondary" style={{ padding: ".2rem .6rem" }} onClick={() => setOpen(!open)}>+ Line after this</button>{" "}
      <button type="button" className="btn secondary" style={{ padding: ".2rem .6rem" }} onClick={del}>Delete line</button> <small>{msg}</small>
      {open && (
        <span style={{ display: "block", marginTop: ".3rem" }}>
          <textarea dir="rtl" lang="ur" rows={2} value={t} onChange={(e) => setT(e.target.value)} placeholder="نئی لائن لکھیں…" style={{ width: "100%", fontFamily: "\"Jameel Noori Nastaleeq\", serif", fontSize: "1.1rem", lineHeight: 1.9 }} />
          <button type="button" className="btn publish" style={{ padding: ".2rem .7rem" }} onClick={add}>Add line</button>
        </span>
      )}
    </span>
  );
}
