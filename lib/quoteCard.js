// Share card for a saying: the Pak Dharti frame, section ribbon, big centred text in Nastaliq,
// the source under it. Square (Instagram/WhatsApp), drawn at 1080 and rendered at 1440 for HD.
import { NOORI, MAROON, GOLD, loadImage, cover, roundRect, gloss, fit, drawLines } from "./newsCard";

const W = 1080, H = 1080, SCALE = 4 / 3, FOOT = 166;
let assets = null;
async function getAssets() {
  if (!assets) {
    const [top, foot] = await Promise.all([loadImage("/brand/card-top.jpg"), loadImage("/brand/card-foot.jpg")]);
    assets = { top, foot };
  }
  return assets;
}

/** q: { text, by?, source?, meaning? }, section: title shown in the ribbon */
export async function drawQuoteCard(canvas, q, section) {
  const A = await getAssets();
  try { await document.fonts.load(`60px ${NOORI}`, `${q.text} ${q.by || ""} ${q.source || ""} ${q.meaning || ""} ${section}`); await document.fonts.ready; } catch {}
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  ctx.fillStyle = "#F7F7F7"; ctx.fillRect(0, 0, W, H);
  if (A.top) cover(ctx, A.top, 0, 0, W, H - FOOT + 30, 0.5);

  // ribbon
  ctx.font = `50px ${NOORI}`; ctx.direction = "rtl";
  const rw = Math.min(W - 160, ctx.measureText(section).width + 120), rh = 96, ry = 40;
  ctx.save(); ctx.shadowColor = "rgba(76,0,0,.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  roundRect(ctx, W / 2 - rw / 2, ry, rw, rh, 48); ctx.clip(); gloss(ctx, W / 2 - rw / 2, ry, rw, rh); ctx.restore();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(section, W / 2, ry + rh / 2 + 5);

  // text plate
  const top = ry + rh + 40, bottom = H - FOOT - 40;
  const px = 60, pw = W - 120;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  roundRect(ctx, px, top, pw, bottom - top, 26); ctx.fillStyle = "rgba(255,255,255,.93)"; ctx.fill(); ctx.restore();
  roundRect(ctx, px, top, pw, bottom - top, 26); ctx.strokeStyle = "rgba(184,137,27,.6)"; ctx.lineWidth = 2; ctx.stroke();

  // quote marks
  ctx.fillStyle = "rgba(122,0,0,.18)"; ctx.font = "900 150px Georgia, serif"; ctx.direction = "ltr";
  ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText("”", px + pw - 24, top + 130);
  ctx.textAlign = "left"; ctx.fillText("“", px + 24, bottom - 10);

  const hasFoot = !!(q.by || q.source || q.meaning);
  const footH = q.meaning ? 120 : hasFoot ? 110 : 0;
  const areaTop = top + 40, areaBottom = bottom - 30 - footH;
  const r = fit(ctx, q.text, NOORI, { maxW: pw - 140, maxLines: 5, max: 68, min: 38 });
  const font = ctx.font;
  const lh = r.fs * 1.75;
  const blockH = r.lines.length * lh;
  const y0 = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2) + lh / 2;
  drawLines(ctx, r.lines, { x: W / 2, y: y0 + 6, lh, rtl: true, align: "center", color: "#141414", hiColor: MAROON, stroke: r.fs / 55, font });

  // source / meaning
  let fy = bottom - 30 - footH + 20;
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (hasFoot) { ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 50, fy - 14, 100, 4); }
  if (q.meaning) {
    const m = fit(ctx, `مطلب: ${q.meaning}`, NOORI, { maxW: pw - 120, maxLines: 2, max: 40, min: 30 });
    drawLines(ctx, m.lines, { x: W / 2, y: fy + 34, lh: m.fs * 1.6, rtl: true, align: "center", color: "#5A4630", hiColor: MAROON, font: ctx.font });
  } else {
    if (q.by) { ctx.font = `44px ${NOORI}`; ctx.fillStyle = MAROON; ctx.fillText(q.by, W / 2, fy + 34); ctx.strokeStyle = MAROON; ctx.lineWidth = 0.8; ctx.strokeText(q.by, W / 2, fy + 34); }
    if (q.source) { ctx.font = `31px ${NOORI}`; ctx.fillStyle = "#6B6B6B"; ctx.fillText(q.source, W / 2, fy + 84); }
  }

  if (A.foot) ctx.drawImage(A.foot, 0, H - FOOT, W, FOOT);
  return canvas;
}
