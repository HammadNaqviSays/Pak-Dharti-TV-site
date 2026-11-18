// "Bayan" (statement) card in the Pak Dharti TV post style:
// white background with soft raised squares and a faint logo, the statement in big Nastaliq at the top
// (first line dark red, the rest black, *starred* words dark red), a dark red name strip with a date badge,
// the speaker's cut-out at the bottom (optionally a second person, a photo / screenshot, or a place photo behind),
// and the Pak Dharti TV band with logo and social icons at the bottom.
// Designed at 1080 wide, rendered at 1440 (HD).
import { NOORI, loadImage, roundRect } from "./newsCard";

export const RED = "#8B0000", RED_HI = "#B01010", RED_DEEP = "#4A0000", BLUE = "#0B2A5B", BLUE_DEEP = "#061733";
export const STATEMENT_SIZES = { square: [1080, 1080], post: [1080, 1350] };
const SCALE = 4 / 3, FOOT = 166, BAND = 96;   // card-foot.png: 166 high, the red band is its lower 96 px
const LATIN = '"Segoe UI", Roboto, Arial, sans-serif';

let brand = null;
async function getBrand() {
  if (!brand) {
    const [foot, logo] = await Promise.all([loadImage("/brand/card-foot.png"), loadImage("/brand/logo.png")]);
    brand = { foot, logo };
  }
  return brand;
}

export function todayLabel(long = true) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: long ? "long" : "short", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date());
}

/* ------------------------------------------------------------ background */
function background(ctx, W, H, logo) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#F2F2F2"); g.addColorStop(0.5, "#FAFAFA"); g.addColorStop(1, "#EDEDED");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft raised squares (fixed layout, as fractions of the card)
  const tiles = [
    [-0.04, 0.02, 0.2], [0.12, -0.05, 0.16], [0.43, 0.03, 0.14], [0.78, -0.03, 0.18], [0.9, 0.2, 0.15],
    [0.02, 0.27, 0.14], [0.22, 0.2, 0.22], [0.66, 0.24, 0.2], [-0.03, 0.5, 0.18], [0.36, 0.44, 0.16],
    [0.8, 0.46, 0.17], [0.12, 0.66, 0.15], [0.56, 0.62, 0.19], [0.88, 0.7, 0.14], [0.3, 0.8, 0.13], [0.7, 0.86, 0.12],
  ];
  for (const [fx, fy, fs] of tiles) {
    const s = fs * W, x = fx * W, y = fy * H;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.07)"; ctx.shadowBlur = 22; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, s, s, s * 0.12);
    const t = ctx.createLinearGradient(x, y, x + s, y + s);
    t.addColorStop(0, "rgba(255,255,255,.95)"); t.addColorStop(1, "rgba(246,246,246,.9)");
    ctx.fillStyle = t; ctx.fill();
    ctx.restore();
    roundRect(ctx, x, y, s, s, s * 0.12); ctx.strokeStyle = "rgba(0,0,0,.035)"; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // faint logo in the middle
  if (logo) {
    const s = W * 0.46;
    ctx.save(); ctx.globalAlpha = 0.06; ctx.drawImage(logo, (W - s) / 2, H * 0.36 - s / 2, s, s); ctx.restore();
  }
}

/* ------------------------------------------------------------ text */
// Urdu fonts for the statement. "w" = weights the font has (bold uses 700 when available), "lh" = natural line height.
export const URDU_FONTS = [
  // Nastaleeq (self-hosted in /public/fonts/urdu)
  { id: "noori", label: "Jameel Noori Nastaleeq", family: '"Jameel Noori Nastaleeq"', lh: 1.6, w: [400] },
  { id: "noori-kasheeda", label: "Jameel Noori Kasheeda", family: '"PD Noori Kasheeda"', src: "JameelNooriNastaleeqKasheeda.woff2", lh: 1.65, w: [400], big: true },
  { id: "khushkhati", label: "Jameel Khushkhati", family: '"PD Jameel Khushkhati"', src: "jameel-khushkhati.woff2", lh: 1.65, w: [400], sc: 1.05 },
  { id: "alvi", label: "Alvi Lahori Nastaleeq", family: '"PD Alvi Lahori"', src: "AlviLahoriNastaleeq.woff2", lh: 1.7, w: [400], sc: 1.05, big: true },
  { id: "nafees", label: "Nafees Nastaleeq", family: '"PD Nafees Nastaleeq"', src: "Nafees-Nastaleeq.woff", lh: 1.85, w: [400], sc: 0.92 },
  { id: "mehr", label: "Mehr Nastaliq", family: '"PD Mehr"', src: "Mehr-Nastaliq-Web.woff2", lh: 1.75, w: [400] },
  { id: "pak", label: "Pak Nastaleeq", family: '"PD Pak Nastaleeq"', src: "PakNastaleeq.woff2", lh: 1.75, w: [400] },
  { id: "fajer", label: "Fajer Noori Nastalique", family: '"PD Fajer Noori"', src: "Fajer-Noori-Nastalique.woff", lh: 2.0, w: [400], sc: 0.9 },
  { id: "emad", label: "Emad Nastaleeq", family: '"PD Emad"', src: "emad-nastaleeq.woff2", lh: 1.75, w: [400] },
  { id: "hussaini", label: "Hussaini Nastaleeq", family: '"PD Hussaini"', src: "HussainiNastaleeq.woff2", lh: 1.8, w: [400], sc: 0.9 },
  { id: "dehalvi", label: "Dehalvi Khushkhat", family: '"PD Dehalvi"', src: "DehalviKhushKhat.woff2", lh: 1.7, w: [400], sc: 1.08 },
  { id: "noto-nastaliq", label: "Noto Nastaliq Urdu", family: '"Noto Nastaliq Urdu"', lh: 1.95, w: [400, 700], g: "Noto+Nastaliq+Urdu:wght@400;700", sc: 0.9 },
  { id: "gulzar", label: "Gulzar Nastaliq", family: '"Gulzar"', lh: 1.75, w: [400], g: "Gulzar" },
  // headline / bold
  { id: "aslam", label: "Aslam (bold headline)", family: '"PD Aslam"', src: "Aslam.woff2", lh: 1.5, w: [400], sc: 0.85 },
  { id: "alqalam-shakir", label: "AlQalam Shakir (bold)", family: '"PD AlQalam Shakir"', src: "AlQalamShakir.woff2", lh: 1.5, w: [400], sc: 0.95 },
  { id: "alqalam-khalid", label: "AlQalam Khalid Maqbool", family: '"PD AlQalam Khalid"', src: "AlQalamKhalidMaqbool.woff2", lh: 1.6, w: [400], sc: 0.85 },
  { id: "alqalam-farhan", label: "AlQalam Farhan", family: '"PD AlQalam Farhan"', src: "AlQalamFarhan.woff2", lh: 1.5, w: [400], sc: 1.05 },
  { id: "musarat", label: "Khat-e-Musarat (heavy)", family: '"PD Musarat"', src: "Khat-e-Musarat.woff2", lh: 1.5, w: [400], sc: 0.85 },
  { id: "bukhari", label: "Bukhari", family: '"PD Bukhari"', src: "Bukhari.woff2", lh: 1.55, w: [400], sc: 0.95 },
  { id: "laiq", label: "Laiq Nastaleeq", family: '"PD Laiq"', src: "LaiqNastaleeq.woff2", lh: 1.6, w: [400] },
  // naskh / modern
  { id: "nafees-naskh", label: "Nafees Web Naskh", family: '"PD Nafees Naskh"', src: "Nafees-Web-Naskh.woff", lh: 1.55, w: [400], sc: 0.95 },
  { id: "noto-naskh", label: "Noto Naskh", family: '"Noto Naskh Arabic"', lh: 1.55, w: [400, 700], g: "Noto+Naskh+Arabic:wght@400;700", sc: 0.9 },
  { id: "noto-sans", label: "Noto Sans Arabic (modern)", family: '"Noto Sans Arabic"', lh: 1.5, w: [400, 800], g: "Noto+Sans+Arabic:wght@400;800", sc: 0.85 },
  { id: "noto-kufi", label: "Noto Kufi (headline)", family: '"Noto Kufi Arabic"', lh: 1.55, w: [400, 800], g: "Noto+Kufi+Arabic:wght@400;800", sc: 0.8 },
  { id: "lalezar", label: "Lalezar (heavy display)", family: '"Lalezar"', lh: 1.45, w: [400], g: "Lalezar", sc: 0.9 },
  { id: "baloo", label: "Baloo Bhaijaan (rounded)", family: '"Baloo Bhaijaan 2"', lh: 1.4, w: [400, 800], g: "Baloo+Bhaijaan+2:wght@400;800", sc: 0.85 },
  { id: "vazir", label: "Vazirmatn (modern)", family: '"Vazirmatn"', lh: 1.5, w: [400, 800], g: "Vazirmatn:wght@400;800", sc: 0.85 },
  { id: "amiri", label: "Amiri", family: '"Amiri"', lh: 1.6, w: [400, 700], g: "Amiri:wght@400;700" },
  { id: "lateef", label: "Lateef", family: '"Lateef"', lh: 1.45, w: [400, 700], g: "Lateef:wght@400;700" },
];
/** @font-face rules for the self-hosted fonts (the browser downloads a font only when it is used). */
export const URDU_FONT_CSS = URDU_FONTS.filter((f) => f.src)
  .map((f) => `@font-face{font-family:${f.family};src:url(/fonts/urdu/${f.src}) format("${f.src.endsWith("woff2") ? "woff2" : "woff"}");font-display:swap}`).join("\n");
export const fontById = (id) => URDU_FONTS.find((f) => f.id === id) || URDU_FONTS[0];

/** Text with colour marks: *word* = colour A (red), _word_ = colour B → [{t, c: 0|1|2, glue}] */
export function colorTokens(text) {
  const out = [];
  let c = 0, cur = "", space = true;   // space: whitespace seen since the last piece
  const push = () => { if (cur) { out.push({ t: cur, c, glue: !space && out.length > 0 }); cur = ""; space = false; } };
  for (const ch of String(text)) {
    if (ch === "*" || ch === "_") { push(); const m = ch === "*" ? 1 : 2; c = c === m ? 0 : m; continue; }
    if (/\s/.test(ch)) { push(); space = true; continue; }
    cur += ch;
  }
  push();
  return out;
}

/** Plain words (marks removed) and their colour, for the tap-to-colour list. */
export function wordColors(text) {
  const words = [];
  for (const tk of colorTokens(text)) {
    if (tk.glue && words.length) { const w = words[words.length - 1]; w.t += tk.t; if (tk.c) w.c = w.c || tk.c; }
    else words.push({ t: tk.t, c: tk.c });
  }
  return words;
}
/** Writes words + colours back as marked text (neighbouring words of one colour share one mark). */
export function markWords(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.c) { out.push(w.t); continue; }
    const m = w.c === 1 ? "*" : "_";
    let j = i; const grp = [];
    while (j < words.length && words[j].c === w.c) grp.push(words[j++].t);
    out.push(m + grp.join(" ") + m); i = j - 1;
  }
  return out.join(" ");
}

function wrapC(ctx, toks, maxW, gap) {
  const lines = []; let line = []; let w = 0;
  for (const tk of toks) {
    const tw = ctx.measureText(tk.t).width;
    const g = line.length && !tk.glue ? gap : 0;
    if (line.length && !tk.glue && w + g + tw > maxW) { lines.push({ toks: line, w }); line = []; w = 0; }
    w += (line.length && !tk.glue ? gap : 0) + tw; line.push({ ...tk, w: tw, glue: line.length ? tk.glue : false });
  }
  if (line.length) lines.push({ toks: line, w });
  return lines;
}

/** Largest size at which the statement fits the width in maxH; the size slider then scales that freely. */
function fitText(ctx, text, maxW, maxH, t) {
  const toks = colorTokens(text);
  const layout = (fs) => {
    ctx.font = `${t.weight} ${fs}px ${t.family}`;
    const gap = ctx.measureText(" ").width * t.gapK;
    return { gap, lines: wrapC(ctx, toks, maxW, gap) };
  };
  let fit = 30;
  for (let fs = Math.round(86 * t.sc); fs >= 30; fs -= 2) {
    if (layout(fs).lines.length * fs * t.lh <= maxH) { fit = fs; break; }
  }
  const fs = Math.max(16, Math.round(fit * t.sizeK));
  const { gap, lines } = layout(fs);
  // even out the lines (no single word left alone on the last line)
  let w = maxW, best = lines;
  if (lines.length > 1) {
    for (let tw = maxW - 10; tw > maxW * 0.55; tw -= 10) {
      const l2 = wrapC(ctx, toks, tw, gap);
      if (l2.length > lines.length) break;
      best = l2; w = tw;
    }
  }
  return { fs, lines: best, lh: fs * t.lh, w, gap };
}

/** Justified (or centred / right) lines; a line that cannot be stretched nicely is centred. No quote marks. */
function drawText(ctx, r, { right, top, maxW, t }) {
  ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  const colors = [t.color, t.colorA, t.colorB];
  r.lines.forEach((ln, i) => {
    const cy = top + r.lh * i + r.lh / 2 + r.fs * 0.08;
    const gaps = ln.toks.filter((x, k) => k > 0 && !x.glue).length;
    const last = i === r.lines.length - 1;
    const need = gaps ? (maxW - ln.w) / gaps : Infinity;
    const full = t.align === "justify" && !last && need <= r.gap * 1.8 + 6;
    const extra = full ? need : 0;
    let x = full || t.align === "right" ? right : right - (maxW - ln.w) / 2;
    ln.toks.forEach((tk, k) => {
      if (k > 0) x -= tk.glue ? 0 : r.gap + extra;
      ctx.fillStyle = tk.c ? colors[tk.c] : t.firstRed && i === 0 ? t.colorA : t.color;
      ctx.fillText(tk.t, x, cy);
      if (t.boldK > 0) { ctx.strokeStyle = ctx.fillStyle; ctx.lineJoin = "round"; ctx.lineWidth = (r.fs / 38) * t.boldK; ctx.strokeText(tk.t, x, cy); }
      x -= tk.w;
    });
  });
}

/** The text settings with defaults filled in. */
export function textStyle(o) {
  const f = fontById(o.font);
  const bold = o.bold ?? 1;                               // 0 … 6
  return {
    family: f.family, lh: (o.lineK ?? 1) * f.lh, gapK: o.gapK ?? 1, sizeK: o.sizeK ?? 1, boldK: bold, sc: f.sc || 1,
    weight: bold >= 1.5 && f.w.length > 1 ? f.w[f.w.length - 1] : 400,
    align: o.align || (o.justify === false ? "center" : "justify"),
    firstRed: o.firstRed !== false, color: o.color || "#111111", colorA: o.colorA || RED, colorB: o.colorB || "#0B3D91",
  };
}

/* ------------------------------------------------------------ name strip + date */
function strip(ctx, cx, y, h, w, top, deep) {
  const sk = h * 0.32;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  // darker fold under the left end
  ctx.beginPath();
  ctx.moveTo(x0 + sk * 0.2, y + h * 0.35); ctx.lineTo(x0 - 16, y + h + 12); ctx.lineTo(x0 + 40, y + h + 12); ctx.lineTo(x0 + 40, y + h * 0.35); ctx.closePath();
  ctx.fillStyle = deep; ctx.fill();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.moveTo(x0 + sk, y); ctx.lineTo(x1, y); ctx.lineTo(x1 - sk, y + h); ctx.lineTo(x0, y + h); ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top); g.addColorStop(1, deep);
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  // light edge on top
  ctx.beginPath(); ctx.moveTo(x0 + sk, y + 1.5); ctx.lineTo(x1, y + 1.5);
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.stroke();
}

function nameAndDate(ctx, { name, date, dateBlue, k = 1 }, cx, y, W) {
  let fs = Math.round(58 * k);
  ctx.direction = "rtl";
  for (; fs > 24; fs -= 2) { ctx.font = `${fs}px ${NOORI}`; if (ctx.measureText(name).width < W * 0.8) break; }
  const tw = ctx.measureText(name).width;
  const h = fs * 1.62, w = tw + fs * 1.9;
  cx = Math.min(W - w / 2 - 24, Math.max(w / 2 + 24, cx));
  strip(ctx, cx, y, h, w, RED_HI, RED_DEEP);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name, cx, y + h / 2 + fs * 0.12);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = fs / 40; ctx.strokeText(name, cx, y + h / 2 + fs * 0.12);
  let bottom = y + h;
  if (date) {
    const dfs = Math.round(30 * k);
    ctx.direction = "ltr"; ctx.font = `700 ${dfs}px ${LATIN}`;
    const dw = ctx.measureText(date).width + dfs * 1.8, dh = dfs * 1.67, dy = y + h - 4;
    const dcx = cx - w * 0.04;
    strip(ctx, dcx, dy, dh, dw, dateBlue ? "#163E80" : "#7A0606", dateBlue ? BLUE_DEEP : RED_DEEP);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(date, dcx, dy + dh / 2 + 1);
    bottom = dy + dh;
  }
  return { cx, w, bottom };
}

/* ------------------------------------------------------------ pictures */
/** A cut-out (transparent PNG/WebP) standing on the bottom of the box, at its side. */
function drawPerson(ctx, img, box, { side, flip, cut }) {
  const s = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * s, h = img.height * s;
  const x = side === "left" ? box.x : box.x + box.w - w;
  const y = box.y + box.h - h;
  if (cut) {
    ctx.save();
    if (flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
    else ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return;
  }
  // a normal photo: crop to a portrait and fade its edges into the background
  const pw = Math.min(box.w, box.h * 0.82), ph = box.h;
  const px = side === "left" ? box.x : box.x + box.w - pw;
  const off = document.createElement("canvas"); off.width = Math.round(pw * 2); off.height = Math.round(ph * 2);
  const o = off.getContext("2d"); o.scale(2, 2);
  const sc = Math.max(pw / img.width, ph / img.height);
  const sw = pw / sc, sh = ph / sc, sx = (img.width - sw) / 2, sy = Math.max(0, Math.min(img.height - sh, img.height * 0.25 - sh / 2));
  if (flip) { o.translate(pw, 0); o.scale(-1, 1); }
  o.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
  o.setTransform(2, 0, 0, 2, 0, 0);
  o.globalCompositeOperation = "destination-in";
  const fades = [
    [0, 0, 0, ph * 0.22, 0, 1],                                     // top
    side === "left" ? [pw, 0, pw * 0.7, 0, 0, 1] : [0, 0, pw * 0.3, 0, 0, 1], // inner side
  ];
  for (const [x0, y0, x1, y1, a0, a1] of fades) {
    const g = o.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(0,0,0,${a0})`); g.addColorStop(1, `rgba(0,0,0,${a1})`);
    o.fillStyle = g; o.fillRect(0, 0, pw, ph);
  }
  ctx.drawImage(off, px, box.y + box.h - ph, pw, ph);
}

/** A photo / screenshot in a frame. */
function drawFramed(ctx, img, box, side) {
  const s = Math.min(box.w / img.width, box.h / img.height, 1.6);
  const w = img.width * s, h = img.height * s;
  const x = side === "left" ? box.x : box.x + box.w - w;
  const y = box.y + (box.h - h) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#fff"; ctx.fillRect(x - 7, y - 7, w + 14, h + 14);
  ctx.restore();
  ctx.drawImage(img, x, y, w, h);
  ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.strokeRect(x - 4.5, y - 4.5, w + 9, h + 9);
}

/** A place photo behind the lower part of the card, fading into white at the top. */
function drawBackdrop(ctx, img, W, top, bottom) {
  const h = bottom - top;
  const off = document.createElement("canvas"); off.width = Math.round(W * 2); off.height = Math.round(h * 2);
  const o = off.getContext("2d"); o.scale(2, 2);
  const s = Math.max(W / img.width, h / img.height);
  const sw = W / s, sh = h / s;
  o.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, h);
  o.globalCompositeOperation = "destination-in";
  const g = o.createLinearGradient(0, 0, 0, h * 0.45);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.95)");
  o.fillStyle = g; o.fillRect(0, 0, W, h);
  ctx.drawImage(off, 0, top, W, h);
}

/** The lower part of another post (person, clipping …) across the card, fading in at the top. */
function drawPostBottom(ctx, img, W, bottom, { scale = 1, dx = 0, dy = 0 }) {
  const w = W * scale, h = img.height * (w / img.width);
  const x = (W - w) / 2 + dx, y = bottom - h + dy;
  const off = document.createElement("canvas"); off.width = Math.round(w * 2); off.height = Math.round(h * 2);
  const o = off.getContext("2d"); o.scale(2, 2);
  o.drawImage(img, 0, 0, w, h);
  o.globalCompositeOperation = "destination-in";
  const g = o.createLinearGradient(0, 0, 0, h * 0.16);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
  o.fillStyle = g; o.fillRect(0, 0, w, h);
  if (scale < 0.98) {   // narrower than the card: soft left and right edges too
    const gs = o.createLinearGradient(0, 0, w, 0);
    gs.addColorStop(0, "rgba(0,0,0,0)"); gs.addColorStop(0.06, "rgba(0,0,0,1)"); gs.addColorStop(0.94, "rgba(0,0,0,1)"); gs.addColorStop(1, "rgba(0,0,0,0)");
    o.fillStyle = gs; o.fillRect(0, 0, w, h);
  }
  ctx.drawImage(off, x, y, w, h);
}

/** Box grown/shrunk around its bottom edge (on the picture's side), then moved. */
function moveBox(b, side, { scale = 1, dx = 0, dy = 0 } = {}) {
  const w = b.w * scale, h = b.h * scale;
  const x = side === "left" ? b.x : side === "right" ? b.x + b.w - w : b.x + (b.w - w) / 2;
  return { x: x + dx, y: b.y + b.h - h + dy, w, h };
}

/**
 * o: { size, text, firstRed, justify, name, date, dateBlue, side ("left"|"right"),
 *      main: {src, cut, flip}, second: {kind: "none"|"person"|"photo"|"backdrop", src, cut, flip} }
 */
export async function drawStatementCard(canvas, o) {
  const [W, H] = STATEMENT_SIZES[o.size] || STATEMENT_SIZES.square;
  const B = await getBrand();
  const ts = textStyle(o);
  if (typeof document !== "undefined" && !document.getElementById("pd-urdu-fonts")) {
    const st = document.createElement("style"); st.id = "pd-urdu-fonts"; st.textContent = URDU_FONT_CSS; document.head.appendChild(st);
  }
  try {
    await Promise.all([document.fonts.load(`60px ${NOORI}`, `${o.name} ${o.text}`), document.fonts.load(`${ts.weight} 60px ${ts.family}`, String(o.text || "ابجد"))]);
    await document.fonts.ready;
  } catch {}
  const second = o.second?.kind && o.second.kind !== "none" ? o.second : null;
  const [mainImg, secondImg] = await Promise.all([loadImage(o.main?.src), loadImage(second?.src)]);

  canvas.width = Math.round(W * SCALE); canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  background(ctx, W, H, B.logo);

  const side = o.side === "right" ? "right" : "left";
  const other = side === "left" ? "right" : "left";
  const bandTop = H - BAND;

  // 1. the statement
  const PAD = 44;
  let TOP = 34;
  const nameH = 150 * (o.nameK ?? 1);                      // name strip + date
  const hasPics = !!(mainImg || secondImg);
  const minPic = H * (hasPics ? 0.3 : 0.12);
  const maxTextH = bandTop - TOP - nameH - minPic;
  const textW = (W - PAD * 2) * (o.textW ?? 1);
  const text = String(o.text || "").trim() || "یہاں بیان لکھیں";
  const r = fitText(ctx, text, textW, maxTextH, ts);
  // no pictures: text and name sit in the middle of the card instead of leaving the bottom empty
  if (!hasPics) TOP = Math.max(34, (bandTop - (r.lines.length * r.lh + nameH)) / 2 - 10);
  TOP += o.textY ?? 0;
  const textBottom = TOP + r.lines.length * r.lh;

  // 2. pictures (under the name strip)
  const picTop = Math.min(textBottom + 10, bandTop - 220);
  const box = (sd, wf) => ({ x: sd === "left" ? 0 : W - W * wf, y: picTop, w: W * wf, h: bandTop + 40 - picTop });
  const mv2 = { scale: second?.scale ?? 1, dx: second?.dx ?? 0, dy: second?.dy ?? 0 };
  const mv1 = { scale: o.main?.scale ?? 1, dx: o.main?.dx ?? 0, dy: o.main?.dy ?? 0 };
  if (secondImg && second.kind === "backdrop") drawBackdrop(ctx, secondImg, W, textBottom - 20 + mv2.dy, bandTop + 10);
  if (secondImg && second.kind === "postbottom") drawPostBottom(ctx, secondImg, W, H - BAND * 0.25, mv2);
  if (secondImg && second.kind === "photo") {
    const b0 = box(other, 0.54); b0.x += other === "left" ? 34 : -34; b0.y += 120 * (o.nameK ?? 1); b0.h -= 150 * (o.nameK ?? 1) + 20; b0.w -= 34;
    const b = moveBox(b0, "center", mv2);
    ctx.save();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.translate(cx, cy); ctx.rotate(((second.tilt ?? 0) * Math.PI) / 180); ctx.translate(-cx, -cy);
    drawFramed(ctx, secondImg, b, other);
    ctx.restore();
  }
  if (secondImg && second.kind === "person") drawPerson(ctx, secondImg, moveBox(box(other, 0.5), other, mv2), { side: other, flip: second.flip, cut: second.cut });
  if (mainImg) drawPerson(ctx, mainImg, moveBox(box(side, second?.kind === "person" ? 0.5 : 0.56), side, mv1), { side, flip: o.main.flip, cut: o.main.cut });

  // 3. the text above the pictures (they may reach up beside the name strip)
  ctx.font = `${ts.weight} ${r.fs}px ${ts.family}`;
  drawText(ctx, r, { right: W / 2 + r.w / 2, top: TOP, maxW: r.w, t: ts });

  // 4. name + date: centred, leaning to the free side
  if (o.name) {
    const lean = !mainImg || second?.kind === "person" ? 0 : side === "left" ? 0.08 : -0.08;
    const ny = Math.min(textBottom + 8 + (o.nameY ?? 0), bandTop - nameH * 0.85);   // never under the band
    nameAndDate(ctx, { name: o.name, date: o.date, dateBlue: o.dateBlue, k: o.nameK ?? 1 }, W * (0.5 + lean) + (o.nameX ?? 0), ny, W);
  }

  // 5. band with logo and social icons
  if (B.foot) ctx.drawImage(B.foot, 0, H - FOOT, W, FOOT);
  return canvas;
}

export function statementCaption({ text, name, title, titleEn, hashtags }) {
  const t = String(text || "").replace(/[*_]/g, "").trim();
  return [title ? `🔴 ${title}` : "", titleEn || "", `${name ? `🗣️ ${name}:\n` : ""}«${t}»`, "— پاک دھرتی ٹی وی", hashtags || ""]
    .filter(Boolean).join("\n\n");
}
