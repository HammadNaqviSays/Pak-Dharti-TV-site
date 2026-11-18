"use client";
import { useState } from "react";
import { deleteReelAction } from "../reelsAction";

/** Deletes one reel (asks first). */
export default function DeleteReel({ id }) {
  const [msg, setMsg] = useState("");
  const go = async () => {
    if (!confirm("Delete this reel and its files for good?")) return;
    setMsg("Deleting…");
    const r = await deleteReelAction(id);
    if (r?.error) setMsg(r.error); else window.location.reload();
  };
  return <span><button type="button" className="btn secondary" onClick={go}>Delete</button> <small>{msg}</small></span>;
}
