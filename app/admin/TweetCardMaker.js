"use client";
import { useEffect, useRef, useState } from "react";
import { drawTweetCard } from "@/lib/tweetCard";
import { tweetLookupAction, dismissTweetAction } from "./actions";

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }
const handleOf = (u) => (u.split("/")[3] || "");

/** Paste a link to a post on X → a Pak Dharti card with the Urdu text, ready to download and post. */
export default function TweetCardMaker({ suggestions = [] }) {
  const [link, setLink] = useState("");
  const [d, setD] = useState(null);           // the card's fields
  const [size, setSize] = useState("post");
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState("");
  const [list, setList] = useState(suggestions);
  const canvas = useRef(null);

  async function lookup(u = link) {
    setBusy(true); setMsg(""); setLink(u);
    const r = await tweetLookupAction(u);
    setBusy(false);
    if (r.error) { setMsg(r.error); return; }
    setD({ ...r, showOriginal: true });
    if (!r.photo) setMsg("No free photo found for this person: add a photo link or a file (an official photo or one you are allowed to use).");
  }

  useEffect(() => {
    if (!d) return;
    let alive = true;
    const t = setTimeout(async () => {
      const c = canvas.current || (canvas.current = document.createElement("canvas"));
      await drawTweetCard(c, { ...d, size, scale });
      if (alive) setPreview(c.toDataURL("image/jpeg", 0.85));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [d, size, scale]);

  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const caption = () => {
    if (!d) return "";
    const who = `${d.nameUr || d.name}${d.role ? ` (${d.role})` : ""}`;
    return `🗣️ *${who}* کا ایکس پر بیان:\n\n«${(d.urdu || d.text).trim()}»\n\n— پاک دھرتی ٹی وی`;
  };
  async function save() {
    setBusy(true);
    const c = document.createElement("canvas");
    await drawTweetCard(c, { ...d, size, scale });
    download(await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95)), `pak-dharti-x-${d.handle}-${size}.jpg`);
    setBusy(false);
  }
  async function dismiss(u) { await dismissTweetAction(u); setList(list.filter((s) => s.url !== u)); }
  function pickFile(e) { const f = e.target.files?.[0]; if (f) setD({ ...d, photo: URL.createObjectURL(f), photoCredit: "" }); }

  return (
    <section className="card-maker">
      <h2>Tweet card</h2>
      <p className="hint">Paste the link of a post on X (x.com/…/status/…). The text, name and date come from X; Urdu name, role and translation are suggested by AI — check them before posting.</p>
      <div className="cm-row" style={{ alignItems: "end" }}>
        <label style={{ flex: 1 }}>Link to the post
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://x.com/CMShehbaz/status/..." onKeyDown={(e) => { if (e.key === "Enter") lookup(); }} />
        </label>
        <button className="btn publish" onClick={() => lookup()} disabled={busy || !link}>{busy ? "Fetching…" : "Make card"}</button>
      </div>
      {msg && <p className="hint" style={{ color: "#8a0000" }}>{msg}</p>}

      {d && (
        <div className="cm-grid">
          <div className="cm-form">
            <div className="cm-row">
              <label>Name (Urdu)<input value={d.nameUr || ""} onChange={set("nameUr")} dir="rtl" className="cm-ur" /></label>
              <label>Role (Urdu, optional)<input value={d.role || ""} onChange={set("role")} dir="rtl" className="cm-ur" /></label>
            </div>
            <label>{d.urdu ? "Urdu translation (shown large)" : "Text"}
              <textarea rows={5} value={d.urdu || d.text} onChange={set(d.urdu ? "urdu" : "text")} dir="rtl" className="cm-ur" />
            </label>
            {d.urdu && (
              <>
                <label><span><input type="checkbox" checked={d.showOriginal} onChange={set("showOriginal")} /> Show the original post small underneath</span></label>
                <details><summary>Original post</summary><textarea rows={4} value={d.text} onChange={set("text")} /></details>
              </>
            )}
            <div className="cm-row">
              <label>Size
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  <option value="post">Portrait 4:5 (Facebook, Instagram)</option>
                  <option value="square">Square 1:1</option>
                  <option value="story">Story 9:16 (Status, Reels)</option>
                </select>
              </label>
              <label>Text size
                <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                  <option value={0.9}>Smaller</option><option value={1}>Normal</option><option value={1.12}>Larger</option>
                </select>
              </label>
              <label>Date<input type="date" value={d.date || ""} onChange={set("date")} /></label>
            </div>
            <div className="cm-row">
              <label>Photo link<input value={d.photo?.startsWith("blob:") ? "(file from your device)" : d.photo || ""} onChange={set("photo")} placeholder="https://..." /></label>
              <label>…or a file<input type="file" accept="image/*" onChange={pickFile} /></label>
            </div>
            {d.photoCredit && <p className="hint">Photo: {d.photoCredit}</p>}
            <div className="cm-actions">
              <button className="btn publish" onClick={save} disabled={busy}>Download card</button>
              <button className="btn secondary" onClick={async () => setMsg((await copy(caption())) ? "Caption copied." : "Could not copy.")}>Copy caption</button>
              <button className="btn secondary" onClick={async () => setMsg((await copy(d.url)) ? "Link copied — paste it as the first comment." : "Could not copy.")}>Copy link for first comment</button>
            </div>
            <p className="hint">Only real, public posts: the card shows exactly what the person wrote. Put the original link in the first comment so readers can check it.</p>
          </div>
          <div className="cm-preview">{preview ? <img src={preview} alt="Card preview" /> : <div className="cm-wait">Drawing…</div>}</div>
        </div>
      )}

      <h2 style={{ marginTop: "2rem" }}>Posts on X found in today's news <small className="muted">({list.length})</small></h2>
      {!list.length ? <p className="muted">None yet. They are collected automatically from the news pages our stories come from.</p> : (
        <div className="table-scroll"><table>
          <thead><tr><th>Account</th><th>In the story</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.url}>
                <td><a href={s.url} target="_blank" rel="noopener noreferrer">@{handleOf(s.url)}</a></td>
                <td>{s.story}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn publish" onClick={() => lookup(s.url)} disabled={busy}>Make card</button>{" "}
                  <button className="btn secondary" onClick={() => dismiss(s.url)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
