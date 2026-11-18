// Draws a poem as a framed calligraphy card on a <canvas> (browser only), and turns it into
// JPEG or PDF. The browser's own text engine shapes Nastaliq correctly, so Jameel Noori
// Nastaleeq renders exactly as on the page.

export const CARD_W = 1080;
export const CARD_H = 1350; // 4:5, ideal for WhatsApp / Facebook / Instagram

const MAROON = "#7A0000";
const MAROON_DEEP = "#4C0000";
const GOLD = "#B8891B";
const GOLD_LIGHT = "#E2C062";
const INK = "#1B1410";
const FONT = '"Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function star(ctx, x, y, r, points = 8, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function diamond(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y);
  ctx.closePath();
}

// Corner rosette: an 8-point star inside two rings, with a curl along each edge
function corner(ctx, x, y, dx, dy) {
  ctx.save();
  ctx.fillStyle = MAROON; ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = GOLD_LIGHT; star(ctx, x, y, 24); ctx.fill();
  ctx.fillStyle = MAROON; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x + dx * 40, y); ctx.quadraticCurveTo(x + dx * 90, y + dy * 4, x + dx * 120, y + dy * 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + dy * 40); ctx.quadraticCurveTo(x + dx * 4, y + dy * 90, x + dx * 22, y + dy * 120); ctx.stroke();
  ctx.restore();
}

function frame(ctx, W, H) {
  // Parchment
  const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, "#FFFCF3"); g.addColorStop(1, "#EFE0BE");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Outer maroon band with gloss, like the logo
  const band = 34, o = 22;
  const mg = ctx.createLinearGradient(0, 0, 0, H);
  mg.addColorStop(0, "#A30606"); mg.addColorStop(0.5, MAROON); mg.addColorStop(1, MAROON_DEEP);
  ctx.fillStyle = mg;
  ctx.fillRect(o, o, W - 2 * o, band); ctx.fillRect(o, H - o - band, W - 2 * o, band);
  ctx.fillRect(o, o, band, H - 2 * o); ctx.fillRect(W - o - band, o, band, H - 2 * o);

  // Gold diamonds running round the band
  ctx.fillStyle = GOLD_LIGHT;
  const c = o + band / 2, step = 30;
  for (let x = o + 40; x <= W - o - 40; x += step) { diamond(ctx, x, c, 5); ctx.fill(); diamond(ctx, x, H - c, 5); ctx.fill(); }
  for (let y = o + 40; y <= H - o - 40; y += step) { diamond(ctx, c, y, 5); ctx.fill(); diamond(ctx, W - c, y, 5); ctx.fill(); }

  // Gold and maroon inner rules
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
  ctx.strokeRect(o + band + 10, o + band + 10, W - 2 * (o + band + 10), H - 2 * (o + band + 10));
  ctx.strokeStyle = MAROON; ctx.lineWidth = 1.5;
  ctx.strokeRect(o + band + 18, o + band + 18, W - 2 * (o + band + 18), H - 2 * (o + band + 18));

  const k = o + band + 10;
  corner(ctx, k, k, 1, 1); corner(ctx, W - k, k, -1, 1);
  corner(ctx, k, H - k, 1, -1); corner(ctx, W - k, H - k, -1, -1);
}

function flourish(ctx, cx, y, half) {
  ctx.save();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 26, y); ctx.moveTo(cx + 26, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.fillStyle = MAROON; star(ctx, cx, y, 18); ctx.fill();
  ctx.fillStyle = GOLD_LIGHT; star(ctx, cx, y, 9); ctx.fill();
  ctx.fillStyle = GOLD; diamond(ctx, cx - half - 8, y, 5); ctx.fill(); diamond(ctx, cx + half + 8, y, 5); ctx.fill();
  ctx.restore();
}

export const SITE_NAME = "پاک دھرتی ٹی وی";
const MAX_H = 1920; // 9:16, the WhatsApp / Instagram story shape
const PER_PAGE = 6; // couplets per card; longer poems continue on the next card

/** Splits couplets into evenly sized pages of at most PER_PAGE. */
export function paginate(lines) {
  const pages = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const size = Math.ceil(lines.length / pages);
  const out = [];
  for (let i = 0; i < lines.length; i += size) out.push(lines.slice(i, i + size));
  return out;
}

const TOP = 300, FOOT = 340;
const blockFor = (lines, f) => lines.flat().filter(Boolean).length * f * 1.72 + (lines.length - 1) * f * 0.62;

// Largest verse size (up to 66px) at which every half-line fits the width and the
// card, grown up to 9:16, holds every line.
function fitSize(ctx, lines) {
  const misras = lines.flat().filter(Boolean);
  const maxW = CARD_W - 290;
  let fs = 66;
  ctx.font = `${fs}px ${FONT}`;
  while (fs > 34 && misras.some((m) => ctx.measureText(m).width > maxW)) { fs -= 2; ctx.font = `${fs}px ${FONT}`; }
  while (fs > 34 && TOP + blockFor(lines, fs) + FOOT > MAX_H) fs -= 2;
  return fs;
}

/**
 * Draws one card. poem: { lines: [[m1, m2], ...], title, poet, source }
 * page: { index, count } when the poem runs over several cards.
 */
export async function drawPoemCard(canvas, poem, { logoSrc = "/brand/logo.png", page = { index: 0, count: 1 }, maxFs = 66 } = {}) {
  const W = CARD_W;
  const allText = poem.lines.flat().join(" ") + poem.poet + poem.title + SITE_NAME + "صفحہ از 0123456789";
  try { await document.fonts.load(`60px ${FONT}`, allText); await document.fonts.ready; } catch {}
  const logo = await loadImage(logoSrc);

  const fs = Math.min(maxFs, fitSize(canvas.getContext("2d"), poem.lines));
  const H = Math.max(CARD_H, Math.min(MAX_H, Math.ceil(TOP + blockFor(poem.lines, fs) + FOOT + 40)));

  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  frame(ctx, W, H);

  // Watermark in the middle, very light
  if (logo) {
    ctx.save(); ctx.globalAlpha = 0.055;
    const s = 620; ctx.drawImage(logo, (W - s) / 2, (H - s) / 2 + 20, s, s);
    ctx.restore();
  }

  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";

  // Header
  ctx.fillStyle = MAROON;
  ctx.font = `46px ${FONT}`;
  ctx.fillText(poem.title || "", W / 2, 160);
  if (page.count > 1) {
    ctx.fillStyle = "#5A4630"; ctx.font = `30px ${FONT}`;
    ctx.fillText(`صفحہ ${page.index + 1} از ${page.count}`, W / 2, 210);
  }
  flourish(ctx, W / 2, 252, 210);

  const lh = fs * 1.72, gap = fs * 0.62;
  const blockH = blockFor(poem.lines, fs);
  const top = TOP, bottom = H - FOOT;
  let y = top + Math.max(0, (bottom - top - blockH) / 2) + lh / 2;

  ctx.font = `${fs}px ${FONT}`;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, fs / 55); ctx.lineJoin = "round";
  poem.lines.forEach((couplet, i) => {
    couplet.filter(Boolean).forEach((m) => {
      ctx.fillText(m, W / 2, y);
      ctx.strokeText(m, W / 2, y);
      y += lh;
    });
    if (i < poem.lines.length - 1) {
      ctx.fillStyle = GOLD; diamond(ctx, W / 2, y - lh / 2 + gap / 2, 6); ctx.fill(); ctx.fillStyle = INK;
      y += gap;
    }
  });

  // Poet
  flourish(ctx, W / 2, H - 300, 160);
  ctx.fillStyle = MAROON;
  ctx.font = `58px ${FONT}`;
  ctx.strokeStyle = MAROON; ctx.lineWidth = 1.2;
  ctx.fillText(poem.poet, W / 2, H - 236);
  ctx.strokeText(poem.poet, W / 2, H - 236);
  if (poem.source) {
    ctx.fillStyle = "#5A4630"; ctx.font = `36px ${FONT}`;
    ctx.fillText(`(${poem.source})`, W / 2, H - 182);
  }

  // Corner logo (bottom left) and the channel name (bottom right); no web address, so cards stay valid if the domain changes
  if (logo) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 8;
    ctx.drawImage(logo, 92, H - 92 - 118, 118, 118);
    ctx.restore();
  }
  ctx.fillStyle = MAROON; ctx.font = `38px ${FONT}`; ctx.textAlign = "right";
  ctx.fillText(SITE_NAME, W - 104, H - 128);
  return canvas;
}

/** All cards for a poem (one per page). */
export async function drawPoemPages(poem, opts = {}) {
  const pages = paginate(poem.lines);
  try { await document.fonts.load(`60px ${FONT}`, poem.lines.flat().join(" ")); await document.fonts.ready; } catch {}
  // Same verse size on every card of a poem
  const probe = document.createElement("canvas").getContext("2d");
  const maxFs = Math.min(...pages.map((pg) => fitSize(probe, pg)));
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement("canvas");
    await drawPoemCard(c, { ...poem, lines: pages[i] }, { ...opts, maxFs, page: { index: i, count: pages.length } });
    out.push(c);
  }
  return out;
}

export function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((r) => canvas.toBlob(r, type, quality));
}

/** PDF with one page per card, each holding the JPEG at full quality (no library needed).
 *  cards: [{ blob, w, h }] */
export async function jpegsToPdf(cards) {
  const enc = new TextEncoder();
  const parts = []; const offsets = []; let len = 0;
  const push = (b) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const obj = (n, write) => { offsets[n] = len; push(`${n} 0 obj\n`); write(); push("\nendobj\n"); };
  const n = cards.length;
  const pageId = (i) => 3 + i * 3; // page, image, content
  push("%PDF-1.4\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${cards.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] /Count ${n} >>`));
  for (let i = 0; i < n; i++) {
    const { blob, w, h } = cards[i];
    const jpeg = new Uint8Array(await blob.arrayBuffer());
    const pw = 595.28, ph = +(pw * h / w).toFixed(2);
    const p = pageId(i);
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`));
    obj(p + 1, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg); push("\nendstream");
    });
    obj(p + 2, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  }
  const total = 3 + n * 3;
  const xref = len;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) table += `${String(offsets[k]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
