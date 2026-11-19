// Read-only: which Pixabay picture addresses can be downloaded (key never printed).
const key = process.env.PIXABAY_API_KEY; console.log("key set:", !!key);
const r = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent("hospital")}&image_type=photo&orientation=vertical&safesearch=true&per_page=5`);
console.log("api status", r.status, "ratelimit-remaining", r.headers.get("x-ratelimit-remaining"), "limit", r.headers.get("x-ratelimit-limit"));
const j = await r.json().catch(() => ({})); const hits = j.hits || []; console.log("hits", hits.length);
const UA = { plain: { "User-Agent": "PakDhartiTV-reels/1.0" }, browser: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/124 Safari/537.36", Referer: "https://pixabay.com/" }, own: { "User-Agent": "Mozilla/5.0 Chrome/124", Referer: "https://www.pakdhartitv.com/" } };
for (const h of hits.slice(0, 2)) for (const f of ["webformatURL", "largeImageURL", "fullHDURL", "imageURL"]) {
  if (!h[f]) { console.log(f, "absent"); continue; }
  for (const [n, hd] of Object.entries(UA)) {
    const x = await fetch(h[f], { headers: hd }).catch((e) => ({ status: "ERR " + e.message }));
    console.log(f, new URL(h[f]).pathname.split("/").slice(0, 3).join("/"), n, x.status, x.headers?.get?.("content-length") || "");
  }
}
