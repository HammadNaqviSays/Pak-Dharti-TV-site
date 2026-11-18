"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="panel" style={{ maxWidth: 380 }}>
      <div className="field">
        <label htmlFor="pw">Admin password</label>
        <input id="pw" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
    </form>
  );
}
