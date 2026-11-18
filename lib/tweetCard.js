// "Post on X" card in the Pak Dharti style: dark maroon stage, the person's photo in a gold ring,
// name and role, the post in a white panel (Urdu; for posts in other languages the Urdu translation
// large and the original small underneath), the date, and the Pak Dharti footer band.
import { NOORI, MAROON, GOLD, loadImage, latinFont, cover, roundRect, fit, drawLines } from "./newsCard";

export const TWEET_SIZES = { post: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
const FOOT = 166;
const urDate = (iso) => new Intl.DateTimeFormat("ur-PK", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(iso ? new Date(`${iso}T12:00:00Z`) : new Date());

let base = null;
async function assets() {
  if (!base) {
    const [foot, logo] = await Promise.all([loadImage("/brand/card-foot.png"), loadImage("/brand/logo.png")]);
    try { await document.fonts.load(`60px ${NOORI}`, "سوشل میڈیا پر بیان وزیر اعظم ترجمہ"); await document.fonts.ready; } catch {}
    base = { foot, logo, latin: latinFont() };
  }
  return base;
}

const clean = (s = "") => String(s).replace(/\*/g, "").replace(/\s*\n+\s*/g, " ").trim();

/**
 * o: { size, nameUr, name, handle, role, text (original), urdu (translation, optional), date (YYYY-MM-DD),
 *      photo (url), showOriginal (bool), scale }
 */
export async function drawTweetCard(canvas, o) {
  const A = await assets();
  const [W, H] = TWEET_SIZES[o.size] || TWEET_SIZES.post;
  const S = 4 / 3;
  canvas.width = W * S; canvas.height = H * S;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingQuality = "high";
  const photo = o.photo ? await loadImage(o.photo) : null;
  const compact = H < 1200, tall = H > 1500;

  // stage
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#3A0008"); bg.addColorStop(0.6, "#5E0010"); bg.addColorStop(1, "#22000A");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, compact ? 200 : 260, 40, W / 2, compact ? 200 : 260, 620);
  glow.addColorStop(0, "rgba(226,176,7,.28)"); glow.addColorStop(1, "rgba(226,176,7,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  // fine diagonal lines
  ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  for (let x = -H; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
  ctx.restore();

  // label (the logo is in the footer band)
  const label = "سوشل میڈیا پر بیان";
  ctx.font = `34px ${NOORI}`; ctx.direction = "rtl";
  const lw = ctx.measureText(label).width + 56;
  roundRect(ctx, W - 40 - lw, 52, lw, 58, 29); ctx.fillStyle = GOLD; ctx.fill();
  ctx.fillStyle = "#2A1A00"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, W - 40 - lw / 2, 84);

  // photo
  const R = compact ? 92 : tall ? 140 : 118, cx = W / 2, cy = (compact ? 150 : 205) + (tall ? 60 : 0) + R * 0.35;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.arc(cx, cy, R + 9, 0, Math.PI * 2);
  const ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  ring.addColorStop(0, "#FBE7A1"); ring.addColorStop(0.5, GOLD); ring.addColorStop(1, "#9A6E06");
  ctx.fillStyle = ring; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  if (photo) cover(ctx, photo, cx - R, cy - R, 2 * R, 2 * R, 0.28);
  else {
    ctx.fillStyle = "#7A0000"; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    ctx.fillStyle = "#fff"; ctx.font = `${R}px ${NOORI}`; ctx.textAlign = "center"; ctx.direction = "rtl";
    ctx.fillText((o.nameUr || o.name || "؟").trim().charAt(0), cx, cy + R * 0.12);
  }
  ctx.restore();

  // name, role, handle
  let y = cy + R + (compact ? 52 : 64);
  const nameUr = clean(o.nameUr || o.name);
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff"; ctx.font = `${compact ? 56 : 64}px ${NOORI}`;
  ctx.fillText(nameUr, W / 2, y); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeText(nameUr, W / 2, y);
  y += compact ? 54 : 62;
  if (o.role) { ctx.fillStyle = "#F3D36B"; ctx.font = `${compact ? 32 : 36}px ${NOORI}`; ctx.fillText(clean(o.role), W / 2, y); y += compact ? 44 : 50; }
  if (o.handle) {
    ctx.direction = "ltr"; ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = `700 ${compact ? 24 : 26}px ${A.latin}`;
    ctx.fillText(`@${o.handle}  ·  X`, W / 2, y); y += compact ? 30 : 36;
  }

  // post panel (from y to the date line above the footer)
  const dateH = 70, px = 56, pw = W - 112;
  const pTop = y + 10, pBot = H - FOOT - dateH - 18;
  const ph = pBot - pTop;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12;
  roundRect(ctx, px, pTop, pw, ph, 28); ctx.fillStyle = "#FFFDF7"; ctx.fill(); ctx.restore();
  ctx.fillStyle = GOLD; ctx.fillRect(px + 40, pTop, pw - 80, 6);
  // quote mark
  ctx.fillStyle = "rgba(122,0,0,.12)"; ctx.font = `900 190px Georgia, serif`; ctx.direction = "ltr"; ctx.textAlign = "right";
  ctx.fillText("”", px + pw - 18, pTop + 112);

  const urdu = clean(o.urdu || (o.lang === "ur" || /[؀-ۿ]/.test(o.text || "") ? o.text : ""));
  const original = clean(o.text);
  const showOrig = !!o.urdu && o.showOriginal !== false && original;
  const innerW = pw - 110, sc = o.scale || 1;
  let origBlock = null;
  if (showOrig) {
    const r = fit(ctx, original, A.latin, { maxW: innerW, maxLines: compact ? 2 : 3, max: 28, min: 22, weight: 600 });
    origBlock = { ...r, font: ctx.font, lh: r.fs * 1.4 };
  }
  const reserve = origBlock ? origBlock.lines.length * origBlock.lh + 70 : 0;
  const availH = ph - 70 - reserve;
  const mainText = urdu || original;
  const rtl = !!urdu;
  let maxFs = Math.round((compact ? 52 : 60) * sc), lines = 1, r;
  for (let fs = maxFs; fs >= 30; fs -= 2) {
    const lh = fs * (rtl ? 1.75 : 1.4);
    const maxLines = Math.max(1, Math.floor(availH / lh));
    r = fit(ctx, mainText, rtl ? NOORI : A.latin, { maxW: innerW, maxLines, max: fs, min: fs, weight: rtl ? "" : 700 });
    if (r.lines.length <= maxLines) break;
  }
  const font = ctx.font, lh = r.fs * (rtl ? 1.75 : 1.4);
  const blockH = r.lines.length * lh;
  const ty = pTop + 40 + Math.max(0, (availH - blockH) / 2) + lh / 2;
  drawLines(ctx, r.lines, { x: rtl ? px + pw - 55 : px + 55, y: ty, lh, rtl, align: "start", color: "#1A1A1A", hiColor: MAROON, stroke: rtl ? r.fs / 70 : 0, font });
  void lines;
  if (origBlock) {
    let oy = pBot - 30 - origBlock.lines.length * origBlock.lh + origBlock.lh / 2;
    ctx.fillStyle = "rgba(184,137,27,.5)"; ctx.fillRect(px + 50, oy - origBlock.lh / 2 - 26, pw - 100, 1.5);
    ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.fillStyle = "#8A6A10"; ctx.font = `24px ${NOORI}`; ctx.textBaseline = "middle";
    ctx.fillText("اصل پوسٹ:", px + pw - 55, oy - origBlock.lh / 2 - 6);
    drawLines(ctx, origBlock.lines, { x: px + 55, y: oy + 14, lh: origBlock.lh, rtl: false, align: "start", color: "#5A5A5A", hiColor: "#5A5A5A", font: origBlock.font });
  }

  // date line
  const dl = `ایکس (ٹوئٹر) پر — ${urDate(o.date)}`;
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `32px ${NOORI}`; ctx.fillStyle = "#fff";
  ctx.fillText(dl, W / 2, H - FOOT - dateH / 2 - 4);

  if (A.foot) ctx.drawImage(A.foot, 0, H - FOOT, W, FOOT);
  return canvas;
}
