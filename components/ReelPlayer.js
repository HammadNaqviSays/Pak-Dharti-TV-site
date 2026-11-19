"use client";
import { useState } from "react";

/** The reel video inside a story. Only a small poster picture loads with the page; the video itself loads when the reader taps it. */
export default function ReelPlayer({ id, sec = 0, title = "", label = "", hint = "" }) {
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
            {sec ? <span className="reel-dur" aria-hidden="true">{Math.round(sec)}″</span> : null}
            <span className="reel-play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
    </figure>
  );
}
