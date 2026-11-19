// Starts the video maker (GitHub workflow "Reels") right away, so pressing "Make video" does not wait for the hourly schedule.
export async function kickReels() {
  const t = process.env.GH_DISPATCH_TOKEN;
  if (!t) return false;
  try {
    const r = await fetch("https://api.github.com/repos/HammadNaqviSays/Pak-Dharti-TV-site/actions/workflows/reels.yml/dispatches", {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, accept: "application/vnd.github+json", "user-agent": "pak-dharti-tv", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
    });
    return r.status === 204;
  } catch { return false; }
}
