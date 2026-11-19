"use client";
import { useState } from "react";
import ReelShare from "@/components/ReelShare";

/** The reel video inside a story. Only a small poster picture loads with the page; the video itself loads when the reader taps it. */
export default function ReelPlayer({ id, sec = 0, title = "", label = "", hint = "", caption = "", shareUrl = "" }) {
  const [on, setOn] = useState(false);
  const src = `/api/reels/${id}`;
  return (
    <figure className="reel-embed">
      <div className="reel-frame">
        {on ? (
          <video src={`${src}/web`} poster={`${src}/poster`} controls autoPlay playsInline preload="auto" />
        ) : (
          <button type="button" onClick={() => setOn(true)} aria-label={label}>
            <img src={`${src}/poster`} alt={title} width="360" height="640" loading="lazy" decoding="async" />
            <span className="reel-play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
      {shareUrl ? <ReelShare url={shareUrl} title={title} /> : null}
    </figure>
  );
}
