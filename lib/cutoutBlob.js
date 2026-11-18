// Person cut-outs are rebuildable pictures. They live in Vercel Blob (public CDN storage), not in the 512 MB database.
// Plain HTTP call to the Blob service with the store token that Vercel adds as BLOB_READ_WRITE_TOKEN.
const API = "https://blob.vercel-storage.com";

export async function putCutout(id, buffer, type = "image/webp") {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const ext = String(type).includes("png") ? "png" : "webp";
  const r = await fetch(`${API}/cutouts/${id}.${ext}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-add-random-suffix": "0",
      "x-content-type": type,
      "x-cache-control-max-age": "31536000",
    },
    body: buffer,
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text().catch(() => "")).slice(0, 160)}`);
  const j = await r.json();
  if (!j?.url) throw new Error("no url in answer");
  return j.url;
}
