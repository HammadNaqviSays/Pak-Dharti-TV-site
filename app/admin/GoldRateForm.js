"use client";
import { useActionState } from "react";
import { setGoldRateAction } from "./actions";

export default function GoldRateForm({ current, intl }) {
  const [state, action, pending] = useActionState(setGoldRateAction, null);
  return (
    <form action={action} className="gold-form">
      <label>24K gold, per tola (Rs)
        <input name="tola24" inputMode="numeric" defaultValue={current?.tola24 || ""} placeholder={intl ? `international ≈ ${Math.round(intl).toLocaleString("en-US")}` : "e.g. 412500"} />
      </label>
      <label>Silver, per tola (Rs) <small>optional</small>
        <input name="silver" inputMode="numeric" defaultValue={current?.silver || ""} />
      </label>
      <button className="btn publish" disabled={pending}>{pending ? "Saving…" : "Save today's rate"}</button>
      {state?.msg && <p className={state.ok ? "ok" : "err"}>{state.msg}</p>}
      <p className="hint">Enter the All Pakistan Sarafa rate each morning. Leave the gold box empty and save to go back to the automatic international price.</p>
    </form>
  );
}
