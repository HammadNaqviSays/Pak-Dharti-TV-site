// Login check only (posts nothing): do the keys in SOCIAL_EXTRA_ENV work?
const env = {};
for (const line of (process.env.SOCIAL_EXTRA_ENV || "").split(/\r?\n/)) {
  const [k, ...r] = line.trim().split("=");
  let v = r.join("=").trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && "\"'".includes(v[0])) v = v.slice(1, -1);
  if (k && v) env[k.trim()] = v;
}
const say = (n, m) => console.log(`::notice title=${n}::${m}`);
console.log("keys found:", Object.keys(env).sort().join(", ") || "(none)");
if (env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD) {
  const r = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD }) });
  say("Bluesky", r.ok ? "LOGIN OK" : `LOGIN FAILED (${r.status})`);
} else say("Bluesky", "keys not set");
if (env.TELEGRAM_BOT_TOKEN) { const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`); say("Telegram", r.ok ? "BOT OK" : `FAILED (${r.status})`); } else say("Telegram", "keys not set");
if (env.THREADS_TOKEN && env.THREADS_USER_ID) { const r = await fetch(`https://graph.threads.net/v1.0/${env.THREADS_USER_ID}?fields=username&access_token=${encodeURIComponent(env.THREADS_TOKEN)}`); say("Threads", r.ok ? "TOKEN OK" : `FAILED (${r.status})`); } else say("Threads", "keys not set");
