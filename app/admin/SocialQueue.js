"use client";
import { useEffect, useRef, useState } from "react";
import { socialQueueAction, cancelQueuedPostAction } from "./socialAction";

const left = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} sec` : `${s} sec`);
const clock = (t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi" });

/** Posts waiting to go to Facebook / Instagram (first in, first out). While this page is open it also sends them the moment their time comes. */
export default function SocialQueue({ bump = 0 }) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  const loadedAt = useRef(Date.now());
  const busy = useRef(false);
  const load = async () => {
    if (busy.current) return; busy.current = true;
    try { const r = await socialQueueAction(); if (!r?.error) { setData(r); loadedAt.current = Date.now(); } } catch {}
    busy.current = false;
  };
  useEffect(() => { load(); }, [bump]);
  useEffect(() => {
    const t = setInterval(() => {
      setTick((x) => x + 1);
      const first = data?.list?.[0];
      const secs = first ? Math.round((first.etaAt - Date.now()) / 1000) : 99;
      if ((first && secs <= 0 && Date.now() - loadedAt.current > 5000) || Date.now() - loadedAt.current > 30000) load();
    }, 1000);
    return () => clearInterval(t);
  }, [data]);
  if (!data || (!data.list?.length && !data.recent?.length)) return null;
  return (
    <div style={{ border: "1px solid #e6c34d", background: "#fff9e6", borderRadius: 10, padding: ".7rem 1rem", margin: ".8rem 0" }} data-t={tick}>
      {data.list.length > 0 && <b>⏳ Waiting to be posted ({data.list.length}) — oldest goes first</b>}
      <ol style={{ margin: ".4rem 0", paddingInlineStart: "1.2rem" }}>
        {data.list.map((q) => (
          <li key={q.id} style={{ marginBottom: ".25rem" }}>
            <span dir="ltr">{q.slug.slice(0, 44)}</span> <small>({q.lang === "ur" ? "Urdu" : "English"}{q.fb ? " · Facebook" : ""}{q.ig ? " · Instagram" : ""})</small>{" "}
            {q.status === "posting" ? <b>sending now…</b> : <>⏱ <b>{left(Math.max(0, Math.round((q.etaAt - Date.now()) / 1000)))}</b> left — will be posted at <b>{clock(q.etaAt)}</b> <small>(Pakistan time)</small>{" "}
              <button type="button" className="btn secondary" style={{ padding: ".1rem .5rem", fontSize: ".75rem" }} onClick={async () => { await cancelQueuedPostAction(q.id); load(); }}>Cancel</button></>}
          </li>
        ))}
      </ol>
      {data.recent?.map((r) => <div key={r.id} style={{ fontSize: ".85rem" }}>{r.status === "done" ? "✅ Posted" : "⚠️ Failed"}: <span dir="ltr">{r.slug.slice(0, 44)}</span>{r.error ? ` — ${r.error}` : ""}</div>)}
      {data.list.length > 0 && <small>Keep this page open for the exact time. If you close it, the site still sends it within about 15–30 minutes.</small>}
    </div>
  );
}
