"use client";
import { useMemo, useRef, useState } from "react";
import { FLAGS } from "@/lib/flagList";
import { searchPeopleAction, findPersonPhotoAction } from "./peopleSearchAction";

// Everything for arranging the people / flags / place photo of a collage card in one place.
// The card itself can also be dragged with the mouse (see NewsCardMaker): drag = move, mouse wheel = bigger / smaller.
const Slider = ({ label, value, min, max, step, onChange }) => (
  <label className="cm-inline" style={{ display: "grid", gridTemplateColumns: "6.5rem 1fr 3rem", gap: ".4rem", alignItems: "center" }}>
    {label}<input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <span className="hint" style={{ margin: 0 }}>{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
  </label>
);

// A picture the editor picked from the computer, made smaller so the card stays light.
function readPicture(file, keepAlpha) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read"));
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => reject(new Error("image"));
      im.onload = () => {
        const k = Math.min(1, 1400 / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        resolve(keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.92));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

export default function CollageEditor({ vis, setVis }) {
  const people = vis.people || [], flags = vis.flags || [];
  const [q, setQ] = useState(""), [found, setFound] = useState(null), [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(-1);          // -1: add a new person, else replace this one
  const [cutUpload, setCutUpload] = useState(false);  // the uploaded picture has a transparent background
  const [note, setNote] = useState("");
  const [flagPick, setFlagPick] = useState("");
  const boxRef = useRef(null);
  const tried = useRef([]);                       // photos the AI search already gave for this name
  const count = people.filter((p) => !p.off).length;
  const setCount = (n) => set({ people: people.map((p, i) => ({ ...p, off: i >= n })) });
  const edit = (i) => { setTarget(i); setNote(`Changing the picture of ${people[i]?.nameUr || people[i]?.name}: search the library, find with AI, or upload.`); setQ(people[i]?.name || ""); tried.current = []; setTimeout(() => boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); };
  async function findAI() {
    const name = q.trim() || (target >= 0 ? people[target]?.name : "");
    setBusy(true); setNote("Looking for a free photo…"); setFound(null);
    try {
      const r = await findPersonPhotoAction(name, tried.current);
      if (r.error) setNote(r.error);
      else { tried.current.push(r.photo.photo); setFound([{ ...r.photo, nameUr: target >= 0 ? people[target]?.nameUr || "" : "", roleUr: "" }]); setNote("Found one. Click it to use it, or press Find with AI again for another."); }
    } catch { setNote("Search failed, try again."); }
    setBusy(false);
  }

  const shown = people.filter((p) => !p.off).length;
  const set = (patch) => setVis({ ...vis, ...patch });
  const upd = (i, patch) => set({ people: people.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const lay = (i, patch) => upd(i, { lay: { ...(people[i].lay || {}), ...patch } });
  const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const zs = people.map((p, i) => p.lay?.z ?? i);

  async function search() {
    setBusy(true); setNote(""); setFound(null);
    try { const r = await searchPeopleAction(q); if (r.error) setNote(r.error); else { setFound(r.people); if (!r.people.length) setNote("Not in the people library. Upload a picture instead."); } }
    catch { setNote("Search failed, try again."); }
    setBusy(false);
  }
  function choose(p) {
    if (target >= 0) upd(target, { ...p, off: false, lay: people[target]?.lay });
    else set({ people: [...people, p] });
    setFound(null); setQ(""); setTarget(-1);
  }
  async function upload(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setNote("");
    try {
      const url = await readPicture(f, cutUpload);
      const base = { name: q.trim() || f.name.replace(/\.[^.]+$/, ""), nameUr: "", roleUr: "", credit: "Uploaded by the editor" };
      const p = cutUpload ? { ...base, cutout: url, photo: "" } : { ...base, photo: url, cutout: "" };
      if (target >= 0) upd(target, { ...p, off: false, lay: people[target]?.lay }); else set({ people: [...people, p] });
      setTarget(-1);
    } catch { setNote("Could not read that picture."); }
  }

  const flagNames = useMemo(() => {
    let dn = null; try { dn = new Intl.DisplayNames(["en"], { type: "region" }); } catch {}
    return [...FLAGS].map((c) => ({ c, n: c.length === 2 && dn ? dn.of(c.toUpperCase()) : c })).sort((a, b) => a.n.localeCompare(b.n));
  }, []);
  const addFlag = () => { if (flagPick && !flags.includes(`/flags/${flagPick}.svg`) && flags.length < 4) set({ flags: [...flags, `/flags/${flagPick}.svg`] }); setFlagPick(""); };
  const dv = vis.divider || (count > 1 && vis.layout !== "circles" ? { on: true, w: 8, slant: 10, color: "#E2B007" } : { on: false, w: 10, slant: 0, color: "#FFFFFF" });
  const setDv = (patch) => set({ divider: { ...dv, ...patch } });

  // saves the original (free-licence) photo to the computer; if the host does not allow it, it opens in a new tab instead
  const saveImg = async (url, base) => {
    if (!url) return;
    try {
      const b = await (await fetch(url, { mode: "cors" })).blob();
      const ext = (b.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${String(base || "photo").replace(/[^\p{L}\p{N}]+/gu, "-")}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { window.open(url, "_blank", "noopener"); }
  };
  const ctl = (i, p) => (
    <div className="cm-btns">
      {[["⬅", "Move left", "dx", -1], ["➡", "Move right", "dx", 1], ["⬆", "Move up", "dy", -1], ["⬇", "Move down", "dy", 1]].map(([ch, t, k, d]) => (
        <button key={ch} type="button" title={t} onClick={() => lay(i, { [k]: Math.max(-0.9, Math.min(0.9, (p.lay?.[k] ?? 0) + d * 0.02)) })}>{ch}</button>
      ))}
      <button type="button" title="Bigger" onClick={() => lay(i, { sc: Math.min(2.2, (p.lay?.sc ?? 1) + 0.1) })}>＋</button>
      <button type="button" title="Smaller" onClick={() => lay(i, { sc: Math.max(0.3, (p.lay?.sc ?? 1) - 0.1) })}>－</button>
      <button type="button" title="Mirror (turn left ↔ right)" className={p.lay?.flip ? "on" : ""} onClick={() => lay(i, { flip: !p.lay?.flip })}>⇋</button>
      <button type="button" title="Swap place with the one on the left" onClick={() => set({ people: swap(people, i, -1) })}>◀</button>
      <button type="button" title="Swap place with the one on the right" onClick={() => set({ people: swap(people, i, 1) })}>▶</button>
      <button type="button" title="Change the picture (library, AI or your own file)" onClick={() => edit(i)}>🖼 Change</button>
      {(p.photo || p.cutout) && <button type="button" title={`Download this photo${p.credit ? " (credit: " + p.credit + ")" : ""}`} onClick={() => saveImg(p.photo || p.cutout, p.name || "photo")}>⬇ Photo</button>}
      <button type="button" title="Remove this person" onClick={() => set({ people: people.filter((_, k) => k !== i) })}>×</button>
    </div>
  );

  return (
    <div className="cm-visual">
      <strong>In the picture</strong>
      <p className="hint">Drag a person on the card to move them; the mouse wheel on a person makes them bigger or smaller.</p>
      {!people.length && !flags.length && !vis.scene && <p className="hint">Nothing found for this story yet. Add people below (people library, AI or your own upload).</p>}

      <div className="cm-two">
        <div className="cm-person cm-col">
          <div className="cm-boxhead">
            <strong>People</strong>
            <span className="cm-count">On the card:
              {[1, 2, 3].map((n) => <button key={n} type="button" className={count === n ? "on" : ""} onClick={() => setCount(n)} disabled={n > people.length && n !== 1}>{n}</button>)}
            </span>
          </div>
          {people.map((p, i) => (
            <div key={`${p.name}-${i}`} className="cm-prow">
              <label className="cm-pname">
                <input type="checkbox" checked={!p.off} onChange={() => upd(i, { off: !p.off })} />
                <strong>{p.nameUr || p.name || "Background photo"}</strong> <small>{p.cutout ? "(cut-out)" : "(photo)"}</small>
              </label>
              {ctl(i, p)}
              <details>
                <summary>Fine tune</summary>
                <label className="cm-inline" style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>Frame (no cut-out)
                  <select value={p.lay?.shape || "circle"} onChange={(e) => lay(i, { shape: e.target.value })}>
                    <option value="circle">Circle with gold ring</option>
                    <option value="open">Open: whole photo, no circle</option>
                  </select>
                </label>
                <Slider label="Size" min={0.3} max={2.2} step={0.05} value={p.lay?.sc ?? 1} onChange={(v) => lay(i, { sc: v })} />
                <Slider label="Left ↔ Right" min={-0.9} max={0.9} step={0.01} value={p.lay?.dx ?? 0} onChange={(v) => lay(i, { dx: v })} />
                <Slider label="Up ↕ Down" min={-0.9} max={0.9} step={0.01} value={p.lay?.dy ?? 0} onChange={(v) => lay(i, { dy: v })} />
                <div className="cm-row">
                  <button type="button" onClick={() => lay(i, { z: Math.max(...zs, 0) + 1 })}>Bring to front</button>
                  <button type="button" onClick={() => lay(i, { z: Math.min(...zs, 0) - 1 })}>Send to back</button>
                  <button type="button" onClick={() => upd(i, { lay: undefined })}>Reset position</button>
                </div>
              </details>
            </div>
          ))}
          {!people.length && <p className="hint" style={{ margin: 0 }}>No people yet.</p>}
          {shown > 3 && <p className="hint" style={{ margin: 0 }}>More than 3 people are ticked: only the first 3 are drawn.</p>}
        </div>

        <div className="cm-person cm-col">
          <div className="cm-boxhead">
            <strong>Names under the people</strong>
            <label className="cm-inline" style={{ display: "flex", gap: ".35rem", alignItems: "center" }}>
              <input type="checkbox" checked={!people.every((p) => p.lay?.nameOff)}
                onChange={(e) => set({ people: people.map((p) => ({ ...p, lay: { ...(p.lay || {}), nameOff: !e.target.checked } })) })} /> Show
            </label>
          </div>
          {people.map((p, i) => (
            <div key={`n-${p.name}-${i}`} className="cm-prow">
              <label className="cm-pname">
                <input type="checkbox" checked={!p.lay?.nameOff} onChange={(e) => lay(i, { nameOff: !e.target.checked })} />
                <strong>{p.nameUr || p.name || "Background photo"}</strong>
              </label>
              <div className="cm-btns">
                <button type="button" title="Name smaller" onClick={() => lay(i, { ns: Math.max(0.5, (p.lay?.ns ?? 1) - 0.1) })}>Aa －</button>
                <button type="button" title="Name bigger" onClick={() => lay(i, { ns: Math.min(2, (p.lay?.ns ?? 1) + 0.1) })}>Aa ＋</button>
                {[["⬅", "Name left", "nx", -1, -0.3, 0.3], ["➡", "Name right", "nx", 1, -0.3, 0.3], ["⬆", "Name up", "ny", -1, -0.5, 0.1], ["⬇", "Name down", "ny", 1, -0.5, 0.1]].map(([ch, t, k, d, lo, hi]) => (
                  <button key={ch} type="button" title={t} onClick={() => lay(i, { [k]: Math.max(lo, Math.min(hi, (p.lay?.[k] ?? 0) + d * 0.02)) })}>{ch}</button>
                ))}
                <button type="button" onClick={() => lay(i, { nx: 0, ny: 0, ns: 1 })}>Reset</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cm-two">
        {count > 1 ? (
          <div className="cm-person cm-col">
            <label className="cm-inline">Layout
              <select value={vis.layout || "split"} onChange={(e) => set({ layout: e.target.value })}>
                <option value="split">Panels: a photo fills each panel (Pak Dharti style)</option>
                <option value="circles">Circles / cut-outs on the stage</option>
              </select>
            </label>
            <label className="cm-inline"><input type="checkbox" checked={!!dv.on} onChange={(e) => setDv({ on: e.target.checked })} /> <strong>Panels</strong> <small>(one panel per person, with a gap)</small></label>
            {dv.on && (
              <>
                {count > 1 && Array.from({ length: Math.min(count, 3) - 1 }, (_, b) => {
                  const nn = Math.min(count, 3), cuts = Array.from({ length: nn - 1 }, (_, k) => dv.cuts?.[k] ?? (k + 1) / nn);
                  return <Slider key={b} label={nn > 2 ? `Gap ${b + 1} position (left ↔ right)` : "Gap position (left ↔ right)"} min={0.15} max={0.85} step={0.01} value={cuts[b]}
                    onChange={(x) => { const c = [...cuts]; c[b] = x; for (let k = b + 1; k < c.length; k++) c[k] = Math.max(c[k], c[k - 1] + 0.15); for (let k = b - 1; k >= 0; k--) c[k] = Math.min(c[k], c[k + 1] - 0.15); setDv({ cuts: c.map((q) => Math.round(q * 100) / 100) }); }} />;
                })}
                {dv.cuts && <button type="button" onClick={() => setDv({ cuts: undefined })}>Equal panels</button>}
                <Slider label="Gap width" min={0} max={40} step={1} value={dv.w ?? 10} onChange={(v) => setDv({ w: v })} />
                <Slider label="Slant" min={0} max={140} step={2} value={dv.slant ?? 0} onChange={(v) => setDv({ slant: v })} />
                <label className="cm-inline">Gap colour
                  <select value={dv.color || "#E2B007"} onChange={(e) => setDv({ color: e.target.value })}>
                    <option value="#FFFFFF">White</option><option value="#E2B007">Gold</option><option value="#7A0014">Maroon</option><option value="#000000">Black</option>
                  </select>
                </label>
              </>
            )}
          </div>
        ) : <div />}
        <div className="cm-person cm-col">
          <strong>Flags (countries / tournaments)</strong>
          {flags.length > 0 && (
            <div className="cm-flags">
              {flags.map((f, i) => (
                <span key={f} className="cm-flagchip">
                  <img src={f} alt="" height="26" />{" "}
                  <button type="button" onClick={() => set({ flags: swap(flags, i, -1) })}>◀</button>
                  <button type="button" onClick={() => set({ flags: swap(flags, i, 1) })}>▶</button>
                  <button type="button" title="Remove this flag" onClick={() => set({ flags: flags.filter((_, k) => k !== i) })}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="cm-row" style={{ flexWrap: "nowrap" }}>
            <select value={flagPick} onChange={(e) => setFlagPick(e.target.value)} style={{ minWidth: 0, flex: 1 }}>
              <option value="">Add a flag…</option>
              {flagNames.map((f) => <option key={f.c} value={f.c}>{f.n}</option>)}
            </select>
            <button type="button" onClick={addFlag} disabled={!flagPick || flags.length >= 4}>Add</button>
          </div>
          <label className="cm-inline"><input type="checkbox" checked={vis.flagMode === "behind"} onChange={(e) => set({ flagMode: e.target.checked ? "behind" : "row" })} /> Big faded flag behind each person (matches, tournaments)</label>
          {vis.flagMode === "behind" && <Slider label="Flag strength" min={0.1} max={1} step={0.05} value={vis.flagAlpha ?? 0.4} onChange={(v) => set({ flagAlpha: v })} />}
        </div>
      </div>

      <div className="cm-person" ref={boxRef} style={{ display: "grid", gap: ".5rem" }}>
        <strong>{target >= 0 ? `Change the picture of ${people[target]?.nameUr || people[target]?.name}` : "Add a person"}</strong>
        <div className="cm-row" style={{ flexWrap: "nowrap" }}>
          <input style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())} placeholder="Name (English or Urdu)" />
          <button type="button" onClick={search} disabled={busy}>{busy ? "…" : "Search library"}</button>
          <button type="button" onClick={findAI} disabled={busy} title="Finds a free Wikimedia photo of this full name">Find with AI</button>
          {target >= 0 && <button type="button" onClick={() => { setTarget(-1); setNote(""); }}>Cancel</button>}
        </div>
        {found?.map((p) => (
          <button type="button" key={p.photo || p.name} onClick={() => choose(p)} style={{ textAlign: "left" }}>
            <img src={p.photo || p.cutout} alt="" height="44" style={{ verticalAlign: "middle", marginRight: ".4rem" }} />
            {p.name} {p.nameUr && `· ${p.nameUr}`} {p.cutout ? "(cut-out)" : "(photo)"}
          </button>
        ))}
        <div className="cm-row" style={{ alignItems: "center" }}>
          <label className="cm-inline">…or choose your own file: <input type="file" accept="image/*" onChange={upload} /></label>
          <label className="cm-inline"><input type="checkbox" checked={cutUpload} onChange={(e) => setCutUpload(e.target.checked)} /> PNG with transparent background (a cut-out)</label>
        </div>
        {note && <p className="hint" style={{ margin: 0 }}>{note}</p>}
      </div>

      {vis.scene && (
        <div className="cm-row">
          <button type="button" title="Use the background photo as one more person: a panel of its own, which you can move left or right with ◀ ▶" onClick={() => {
            const sc = vis.scene;
            set({ people: [...people, { name: "", nameUr: "", photo: sc.url, cutout: "", credit: sc.credit || "", lay: { nameOff: true } }], sceneOff: true });
          }}>🖼 Use the background photo as a person</button>
        </div>
      )}
      {vis.scene && (
        <div className="cm-row" style={{ alignItems: "center" }}>
          <button type="button" onClick={() => saveImg(vis.scene.url, "background")}>⬇ Download the background photo</button>
          <small>{[vis.scene.credit, vis.scene.license].filter(Boolean).join(" · ")}</small>
        </div>
      )}
      {vis.scene && <label className="cm-inline"><input type="checkbox" checked={!vis.sceneOff} onChange={() => set({ sceneOff: !vis.sceneOff })} /> Place photo in the background</label>}
      <p className="hint">Photos: {[...people.map((p) => p.credit), vis.scene && `${vis.scene.credit} (${vis.scene.license})`].filter(Boolean).join(" · ")}</p>
    </div>
  );
}
