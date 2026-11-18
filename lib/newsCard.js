import { drawCollageTop } from "./collageCard";
// News graphics for social media, drawn on a <canvas> in the browser.
// Three templates in the house style (maroon + gold, Jameel Noori Nastaleeq):
//   "headline" — photo on top, dark panel with the headline, maroon footer band
//   "boxed"    — full photo, headline in a white card with maroon highlight words
//   "quote"    — a statement card: big quote marks, the quote, the speaker's name tag and photo
// Two sizes: post (1080×1350, 4:5) and story (1080×1920, 9:16).
// Words wrapped in *stars* are highlighted.

export const MAROON = "#7A0000", MAROON_HI = "#A30606", MAROON_DEEP = "#4C0000";
export const GOLD = "#E2B007", GOLD_SOFT = "#F3D36B";
export const KASHEEDA = '"PD Noori Kasheeda", "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif';
export const ASLAM = '"PD Aslam", "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif';
export const NOORI = '"Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif';
export const SITE_URL = "www.PakDhartiTV.com";
export const SITE_NAME = { ur: "پاک دھرتی ٹی وی", en: "PAK DHARTI TV" };
export const LABELS = {
  ur: ["تازہ ترین", "بریکنگ نیوز", "اہم خبر", "خصوصی رپورٹ", "بیان", "عالمی خبر", "کھیل", "کاروبار"],
  en: ["LATEST", "BREAKING", "TOP STORY", "EXCLUSIVE", "STATEMENT", "WORLD", "SPORTS", "BUSINESS"],
};
export const SIZES = { square: [1080, 1080], post: [1080, 1350], story: [1080, 1920] };

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Remote photos go through our own server so the canvas stays downloadable
    img.src = /^https?:\/\//.test(src) ? `/api/img?u=${encodeURIComponent(src)}` : src;
  });
}

export function latinFont() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--f-display").trim();
    if (v) return `${v}, "Segoe UI", Arial, sans-serif`;
  } catch {}
  return '"Segoe UI", Arial, sans-serif';
}

/** Draws img to cover the box, keeping faces (usually in the upper third) in view. */
export function cover(ctx, img, x, y, w, h, focusY = 0.3) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  const sx = (img.width - sw) / 2;
  const sy = Math.min(img.height - sh, Math.max(0, img.height * focusY - sh / 2));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function gloss(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, MAROON_HI); g.addColorStop(0.55, MAROON); g.addColorStop(1, MAROON_DEEP);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const s = ctx.createLinearGradient(0, y, 0, y + h / 2);
  s.addColorStop(0, "rgba(255,255,255,.18)"); s.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = s; ctx.fillRect(x, y, w, h / 2);
}

/** "*word*" → [{t, hi, glue, br}] tokens. br = the word starts a line the editor typed with Enter. */
export function tokens(text) {
  const out = [];
  let hi = false, prev = "", pendingBr = false;
  for (const part of String(text).split("*")) {
    // text touching a star on both sides (e.g. "*word*،") sticks to the previous word
    const glueFirst = out.length > 0 && part.length > 0 && !/^\s/.test(part) && !/\s$/.test(prev);
    prev = part;
    part.split(/\r?\n/).forEach((seg, si) => {
      if (si > 0) pendingBr = true;
      seg.split(/\s+/).filter(Boolean).forEach((w, i) => {
        const br = pendingBr && out.length > 0;
        pendingBr = false;
        out.push({ t: w, hi, glue: !br && si === 0 && i === 0 && glueFirst, br });
      });
    });
    hi = !hi;
  }
  return out;
}

/** Greedy line wrap of tokens at the current font. A line the editor ended with Enter always ends there. */
export function wrap(ctx, toks, maxW, sp = 1) {
  const space = ctx.measureText(" ").width * sp;
  const lines = []; let line = []; let w = 0;
  for (const tk of toks) {
    const tw = ctx.measureText(tk.t).width;
    const gap = line.length && !tk.glue ? space : 0;
    if (line.length && (tk.br || (!tk.glue && w + gap + tw > maxW))) { lines.push({ toks: line, w }); line = []; w = 0; }
    w += (line.length && !tk.glue ? space : 0) + tw; line.push({ ...tk, w: tw, glue: line.length ? tk.glue : false });
  }
  if (line.length) lines.push({ toks: line, w });
  return lines;
}

/** Finds the largest font size at which the text fits in maxLines lines of width maxW. */
export function fit(ctx, text, family, { maxW, maxLines, max, min, weight = "", sp = 1 }) {
  const toks = tokens(text);
  // lines typed with Enter: each one gets its own single line, so the font shrinks until none of them has to wrap
  const typed = toks.filter((t) => t.br).length + 1;
  if (typed > 1) {
    for (let fs = max; fs >= min; fs -= 2) {
      ctx.font = `${weight} ${fs}px ${family}`.trim();
      const lines = wrap(ctx, toks, maxW, sp);
      if (lines.length <= typed) return { fs, lines };
    }
  }
  for (let fs = max; fs >= min; fs -= 2) {
    ctx.font = `${weight} ${fs}px ${family}`.trim();
    const lines = wrap(ctx, toks, maxW, sp);
    if (lines.length <= maxLines) return { fs, lines };
  }
  ctx.font = `${weight} ${min}px ${family}`.trim();
  return { fs: min, lines: wrap(ctx, toks, maxW, sp) };
}


/** Draws wrapped lines word by word so highlighted words can take another colour. */
export function drawLines(ctx, lines, { x, y, lh, rtl, align, color, hiColor, stroke = 0, font, sp = 1 }) {
  if (font) ctx.font = font;
  const space = ctx.measureText(" ").width * sp;
  ctx.textBaseline = "middle";
  ctx.direction = rtl ? "rtl" : "ltr";
  lines.forEach((ln, i) => {
    const cy = y + i * lh;
    // starting edge of this line
    let cx;
    if (align === "center") cx = rtl ? x + ln.w / 2 : x - ln.w / 2;
    else cx = x; // x is the right edge for rtl, left edge for ltr
    for (const tk of ln.toks) {
      if (tk.glue) cx -= (rtl ? -1 : 1) * space;
      ctx.fillStyle = tk.hi ? hiColor : color;
      ctx.textAlign = rtl ? "right" : "left";
      ctx.fillText(tk.t, cx, cy);
      if (stroke) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = stroke; ctx.strokeText(tk.t, cx, cy); }
      cx += (rtl ? -1 : 1) * (tk.w + space);
    }
  });
}

function stampDate(lang) {
  const d = new Date();
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
}

function footerBand(ctx, W, y, h, { logo, lang, latin }) {
  gloss(ctx, 0, y, W, h);
  ctx.fillStyle = GOLD; ctx.fillRect(0, y, W, 5);
  const ls = h - 24;
  if (logo) ctx.drawImage(logo, 36, y + 12, ls, ls);
  ctx.textBaseline = "middle";
  if (lang === "ur") {
    ctx.direction = "rtl"; ctx.textAlign = "right"; ctx.fillStyle = "#fff";
    ctx.font = `44px ${NOORI}`;
    ctx.fillText(SITE_NAME.ur, W - 40, y + h / 2 + 4);
  } else {
    ctx.direction = "ltr"; ctx.textAlign = "right"; ctx.fillStyle = "#fff";
    ctx.font = `800 34px ${latin}`;
    ctx.fillText(SITE_NAME.en, W - 40, y + h / 2);
  }
  ctx.direction = "ltr"; ctx.textAlign = "left"; ctx.fillStyle = GOLD_SOFT;
  ctx.font = `600 24px ${latin}`;
  ctx.fillText(stampDate(lang), 36 + ls + 18, y + h / 2 - 15);
  ctx.font = `700 22px ${latin}`; ctx.fillStyle = "#fff";
  ctx.fillText(SITE_URL, 36 + ls + 18, y + h / 2 + 16);
}

// The channel footer image has a white strip above its red band: the website address goes there
function siteUrlOnFooter(ctx, W, H, footH, latin, color = "#8B0000") {
  ctx.save();
  ctx.direction = "ltr"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `800 ${Math.round(footH * 0.17)}px ${latin}`;
  ctx.fillText(SITE_URL, W - Math.round(W * 0.04), H - footH + Math.round(footH * 0.2));
  ctx.restore();
}

function labelPill(ctx, text, cx, cy, { lang, latin, bg = GOLD, fg = "#1A1A1A" }) {
  const ur = lang === "ur";
  ctx.font = ur ? `38px ${NOORI}` : `800 28px ${latin}`;
  ctx.direction = ur ? "rtl" : "ltr";
  const w = ctx.measureText(text).width + 64, h = ur ? 70 : 58;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 6);
  ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + (ur ? 4 : 1));
  return w;
}

function diamond(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
}

/** The section badge at the top of the maroon panel: a gold pill with a white edge and small diamonds. */
function labelBadge(ctx, text, cx, cy, { lang, latin }) {
  const ur = lang === "ur";
  ctx.font = ur ? `42px ${NOORI}` : `800 30px ${latin}`;
  ctx.direction = ur ? "rtl" : "ltr";
  const w = ctx.measureText(text).width + 110, h = ur ? 78 : 62, x = cx - w / 2, y = cy - h / 2;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, (h - 8) / 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#FBE48A"); g.addColorStop(0.5, "#E8B80F"); g.addColorStop(1, "#B98800");
  ctx.fillStyle = g; ctx.fill();
  diamond(ctx, x + 34, cy, 7, "#5A0000"); diamond(ctx, x + w - 34, cy, 7, "#5A0000");
  ctx.fillStyle = "#3A0000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + (ur ? 4 : 1));
}

const CITIES = [
  ["کراچی", "Karachi", /کراچی|Karachi/i], ["لاہور", "Lahore", /لاہور|Lahore/i], ["اسلام آباد", "Islamabad", /اسلام آباد|Islamabad/i],
  ["راولپنڈی", "Rawalpindi", /راولپنڈی|Rawalpindi/i], ["پشاور", "Peshawar", /پشاور|Peshawar/i], ["کوئٹہ", "Quetta", /کوئٹہ|Quetta/i],
  ["ملتان", "Multan", /ملتان|Multan/i], ["فیصل آباد", "Faisalabad", /فیصل آباد|Faisalabad/i], ["حیدرآباد", "Hyderabad", /حیدر آباد|حیدرآباد|Hyderabad/i],
  ["سیالکوٹ", "Sialkot", /سیالکوٹ|Sialkot/i], ["گوجرانوالہ", "Gujranwala", /گوجرانوالہ|Gujranwala/i], ["سکھر", "Sukkur", /سکھر|Sukkur/i],
  ["بہاولپور", "Bahawalpur", /بہاولپور|Bahawalpur/i], ["ایبٹ آباد", "Abbottabad", /ایبٹ آباد|Abbottabad/i], ["مظفر آباد", "Muzaffarabad", /مظفر آباد|Muzaffarabad/i],
  ["گوادر", "Gwadar", /گوادر|Gwadar/i], ["سوات", "Swat", /سوات|Swat/i], ["گلگت", "Gilgit", /گلگت|Gilgit/i],
];
/** The Pakistani city a headline is about, if it names one (first one mentioned). */
export function detectCity(text, ur) {
  let best = null;
  for (const [u, e, re] of CITIES) { const m = String(text || "").match(re); if (m && (!best || m.index < best.i)) best = { i: m.index, name: ur ? u : e }; }
  return best ? best.name : "";
}

/** The headline in at most two lines: shrinks the text, and if it is still too long drops the last words and ends with "…". */
function fitTwoLines(ctx, text, family, { maxW, max, min, weight = "", sp = 1 }) {
  const words = [];   // words with the spaces / Enter breaks that follow them, so typed line breaks survive
  String(text).trim().replace(/(\S+)(\s*)/g, (m, w, sepa) => { words.push({ w, sepa }); return m; });
  const typedLines = String(text).trim().split(/\r?\n/).filter((l) => l.trim()).length, lim = Math.max(2, typedLines);
  let cut = false;
  for (;;) {
    const t = words.map((x, i) => x.w + (i < words.length - 1 ? x.sepa : "")).join("") + (cut ? "…" : "");
    const r = fit(ctx, t, family, { maxW, maxLines: lim, max, min, weight, sp });
    if (r.lines.length <= lim || words.length <= 3) return r;
    words.pop(); cut = true;
  }
}

/** Takes the city off the front of a headline ("کراچی: ..."), since the badge already names it. */
function stripCity(text, city) {
  if (!city) return text;
  const re = new RegExp(`^\\s*\\*?\\s*${city}\\s*\\*?\\s*[:：،,\\-–—]\\s*`);
  const t = String(text).replace(re, "");
  return t.trim().length > 8 ? t : text;
}

function globeIcon(ctx, cx, cy, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r / 7); ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.42, r, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.86, cy - r * 0.5); ctx.lineTo(cx + r * 0.86, cy - r * 0.5); ctx.moveTo(cx - r * 0.86, cy + r * 0.5); ctx.lineTo(cx + r * 0.86, cy + r * 0.5); ctx.stroke();
  ctx.restore();
}

/** Footer of the Pak Dharti card: the red band, the logo with rounded corners, and the website in a gold-edged pill with a globe. */
function pdFooter(ctx, W, H, footH, { bgFoot, logo, latin }) {
  const sc = W / 1080, bandTop = H - Math.round(footH * 95 / 166);
  if (bgFoot) {
    ctx.drawImage(bgFoot, 215, 0, 865, 166, Math.round(215 * sc), H - footH, W - Math.round(215 * sc), footH);
    ctx.drawImage(bgFoot, 215, 72, 20, 94, 0, H - footH + Math.round(72 * sc), Math.round(215 * sc) + 2, footH - Math.round(72 * sc));
  }
  if (logo) {
    const S = Math.round(W * 0.135);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    ctx.drawImage(logo, Math.round(W * 0.05), H - S - Math.round(W * 0.012), S, S); ctx.restore();
  }
  // website pill
  const fs = Math.round(footH * 0.155), h = Math.round(fs * 1.75);
  ctx.save(); ctx.direction = "ltr"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = `800 ${fs}px ${latin}`; try { ctx.letterSpacing = "1.5px"; } catch {}
  const parts = [["www.", "#FFFFFF"], ["PakDhartiTV", "#F6D15A"], [".com", "#FFFFFF"]];
  const tw = parts.reduce((a, [t]) => a + ctx.measureText(t).width, 0), ir = fs * 0.62;
  const w = Math.round(tw + ir * 2 + fs * 1.5 + 12), x = Math.round((W - w) / 2), y = bandTop - h - 20;
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = "rgba(26,0,0,.82)"; ctx.fill();
  ctx.shadowColor = "transparent";
  roundRect(ctx, x, y, w, h, h / 2); ctx.strokeStyle = "#F6D15A"; ctx.lineWidth = 2.5; ctx.stroke();
  globeIcon(ctx, x + fs * 0.75 + ir, y + h / 2, ir, "#F6D15A");
  let tx = x + fs * 0.75 + ir * 2 + fs * 0.45;
  for (const [t, c] of parts) { ctx.fillStyle = c; ctx.fillText(t, tx, y + h / 2 + 1); tx += ctx.measureText(t).width; }
  ctx.restore();
}

function cornerLogo(ctx, logo, x, y, s) {
  if (!logo) return;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 12;
  ctx.drawImage(logo, x, y, s, s); ctx.restore();
}

// ---------------------------------------------------------------- templates

function tHeadline(ctx, W, H, o) {
  const { img, logo, lang, latin, text, label } = o;
  const ur = lang === "ur";
  const story = H > 1500, square = H < 1200;
  const photoH = story ? 1060 : square ? 560 : 790;
  const footH = 104;

  ctx.fillStyle = "#0E0E0E"; ctx.fillRect(0, 0, W, H);
  if (img) cover(ctx, img, 0, 0, W, photoH);
  // fade the photo into the panel
  const f = ctx.createLinearGradient(0, photoH - 220, 0, photoH);
  f.addColorStop(0, "rgba(14,14,14,0)"); f.addColorStop(1, "rgba(14,14,14,1)");
  ctx.fillStyle = f; ctx.fillRect(0, photoH - 220, W, 220);
  // faint maroon glow in the panel
  const rg = ctx.createRadialGradient(W / 2, photoH + 200, 40, W / 2, photoH + 200, 700);
  rg.addColorStop(0, "rgba(122,0,0,.35)"); rg.addColorStop(1, "rgba(122,0,0,0)");
  ctx.fillStyle = rg; ctx.fillRect(0, photoH, W, H - photoH - footH);
  cornerLogo(ctx, logo, ur ? 34 : W - 34 - 120, 34, 120);

  labelPill(ctx, label, W / 2, photoH + 6, { lang, latin });

  const top = photoH + 70, bottom = H - footH - 40;
  const maxW = W - 150;
  const r = ur
    ? fit(ctx, text, NOORI, { maxW, maxLines: story ? 5 : square ? 3 : 4, max: square ? 70 : 76, min: 42 })
    : fit(ctx, text, latin, { maxW, maxLines: story ? 6 : square ? 4 : 5, max: square ? 64 : 72, min: 36, weight: "800" });
  const font = ctx.font;
  const lh = ur ? r.fs * 1.62 : r.fs * 1.18;
  const blockH = r.lines.length * lh;
  const y0 = top + Math.max(0, (bottom - top - blockH) / 2) + lh / 2;
  // gold bar on the reading side
  ctx.fillStyle = GOLD;
  const barX = ur ? W - 60 : 54;
  ctx.fillRect(barX, y0 - lh / 2 + 8, 7, blockH - 16);
  drawLines(ctx, r.lines, {
    x: ur ? W - 88 : 82, y: y0 + (ur ? 6 : 0), lh, rtl: ur, align: "start",
    color: "#FFFFFF", hiColor: GOLD, stroke: ur ? r.fs / 60 : 0, font,
  });
  footerBand(ctx, W, H - footH, footH, o);
}

function tBoxed(ctx, W, H, o) {
  const { img, logo, lang, latin, text, label } = o;
  const ur = lang === "ur";
  const footH = 96;
  ctx.fillStyle = "#222"; ctx.fillRect(0, 0, W, H);
  if (img) cover(ctx, img, 0, 0, W, H - footH, 0.35);
  // darken the lower half a little so the card stands out
  const f = ctx.createLinearGradient(0, H * 0.35, 0, H - footH);
  f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = f; ctx.fillRect(0, 0, W, H - footH);

  // thin gold frame
  ctx.strokeStyle = "rgba(226,176,7,.85)"; ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, W - 56, H - footH - 56);
  cornerLogo(ctx, logo, ur ? W - 34 - 112 - 20 : 52, 52, 112);

  // headline card
  const maxW = W - 220;
  const r = ur
    ? fit(ctx, text, NOORI, { maxW, maxLines: 4, max: 74, min: 44 })
    : fit(ctx, text, latin, { maxW, maxLines: 5, max: 78, min: 42, weight: "800" });
  const font = ctx.font;
  const lh = ur ? r.fs * 1.6 : r.fs * 1.14;
  const padY = ur ? 46 : 52;
  const boxH = r.lines.length * lh + padY * 2;
  const boxW = W - 150;
  const boxX = 75, boxY = H - footH - 70 - boxH;

  // maroon diagonal stripes behind the card
  ctx.save();
  ctx.translate(W / 2, boxY + boxH / 2); ctx.rotate(-0.12);
  gloss(ctx, -W, -18, W * 2, 36);
  ctx.restore();

  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  roundRect(ctx, boxX, boxY, boxW, boxH, 22); ctx.fillStyle = "#FFFFFF"; ctx.fill();
  ctx.restore();
  // label tab on the card's top edge
  labelPill(ctx, label, W / 2, boxY, { lang, latin, bg: MAROON, fg: "#FFFFFF" });

  drawLines(ctx, r.lines, {
    x: W / 2, y: boxY + padY + lh / 2 + (ur ? 8 : 0), lh, rtl: ur, align: "center",
    color: "#111111", hiColor: MAROON, stroke: ur ? r.fs / 55 : 0, font,
  });
  footerBand(ctx, W, H - footH, footH, o);
}

function tQuote(ctx, W, H, o) {
  const { img, logo, lang, latin, text, speaker } = o;
  const ur = lang === "ur";
  const footH = 96;
  // soft paper background with a light maroon wash
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#FFFFFF"); bg.addColorStop(1, "#F3E9E9");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // faint diamond pattern
  ctx.fillStyle = "rgba(122,0,0,.035)";
  for (let y = 0; y < H; y += 60) for (let x = (y / 60) % 2 ? 30 : 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 10, y); ctx.fill();
  }
  // watermark logo
  if (logo) { ctx.save(); ctx.globalAlpha = 0.05; ctx.drawImage(logo, W / 2 - 300, H * 0.18, 600, 600); ctx.restore(); }

  // photo panel, bottom (speaker)
  const story = H > 1500;
  const photoH = story ? 820 : H < 1200 ? 400 : 560;
  const photoY = H - footH - photoH;
  if (img) {
    ctx.save();
    roundRect(ctx, 0, photoY, W, photoH, 0); ctx.clip();
    cover(ctx, img, 0, photoY, W, photoH, 0.28);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, photoY, 0, photoY + 200);
    fade.addColorStop(0, "#F3E9E9"); fade.addColorStop(1, "rgba(243,233,233,0)");
    ctx.fillStyle = fade; ctx.fillRect(0, photoY, W, 200);
  }

  // big quote mark
  ctx.fillStyle = MAROON; ctx.font = `900 220px Georgia, serif`;
  ctx.textBaseline = "alphabetic"; ctx.direction = "ltr";
  ctx.textAlign = ur ? "right" : "left";
  ctx.fillText(ur ? "”" : "“", ur ? W - 50 : 50, 230);

  const top = 150, bottom = photoY - 40;
  const maxW = W - 160;
  const r = ur
    ? fit(ctx, text, NOORI, { maxW, maxLines: story ? 7 : H < 1200 ? 4 : 5, max: 68, min: 38 })
    : fit(ctx, text, latin, { maxW, maxLines: story ? 8 : 6, max: 60, min: 36, weight: "800" });
  const font = ctx.font;
  const lh = ur ? r.fs * 1.62 : r.fs * 1.2;
  const blockH = r.lines.length * lh;
  const y0 = top + Math.max(0, (bottom - top - blockH) / 2) + lh / 2;
  drawLines(ctx, r.lines, {
    x: W / 2, y: y0 + (ur ? 6 : 0), lh, rtl: ur, align: "center",
    color: "#151515", hiColor: MAROON, stroke: ur ? r.fs / 60 : 0, font,
  });

  // speaker name tag
  if (speaker) {
    ctx.font = ur ? `52px ${NOORI}` : `800 40px ${latin}`;
    ctx.direction = ur ? "rtl" : "ltr";
    const tw = ctx.measureText(speaker).width + 70, th = ur ? 84 : 70;
    const tx = W / 2 - tw / 2, ty = photoY - th / 2 + 10;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 16;
    roundRect(ctx, tx, ty, tw, th, 8); ctx.clip(); gloss(ctx, tx, ty, tw, th); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(speaker, W / 2, ty + th / 2 + (ur ? 5 : 1));
    // date chip under the name
    ctx.font = `700 24px ${latin}`; ctx.direction = "ltr";
    const d = stampDate(lang); const dw = ctx.measureText(d).width + 34;
    roundRect(ctx, W / 2 - dw / 2, ty + th + 4, dw, 40, 6); ctx.fillStyle = MAROON_DEEP; ctx.fill();
    ctx.fillStyle = GOLD_SOFT; ctx.fillText(d, W / 2, ty + th + 25);
  }
  footerBand(ctx, W, H - footH, footH, o);
}


// "Pak Dharti" frame: the channel's own background (light tiles, watermark logo) and footer band
// with logo and social icons. Works with or without a photo.
function tBrand(ctx, W, H, o) {
  const { img, lang, latin, text, label, bgTop, bgFoot } = o;
  const ur = lang === "ur";
  const footH = Math.round(W * 166 / 1080);
  const areaH = H - footH;
  ctx.fillStyle = "#F7F7F7"; ctx.fillRect(0, 0, W, H);
  if (bgTop) cover(ctx, bgTop, 0, 0, W, areaH + 30, 0.5);

  let top = 70;
  if (img) {
    const story = H > 1500, square = H < 1200;
    const ph = story ? 900 : square ? 470 : 640;
    const px = 56, pw = W - 112;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    roundRect(ctx, px - 8, 48, pw + 16, ph + 16, 26); ctx.fillStyle = "#fff"; ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, px, 56, pw, ph, 20); ctx.clip(); cover(ctx, img, px, 56, pw, ph); ctx.restore();
    top = 56 + ph + 16;
  }
  const bottom = areaH - 60;
  labelPill(ctx, label, W / 2, top + 46, { lang, latin, bg: MAROON, fg: "#FFFFFF" });
  const maxW = W - 160;
  const room = bottom - (top + 100);
  const r = ur
    ? fit(ctx, text, NOORI, { maxW, maxLines: Math.max(2, Math.floor(room / 105)), max: img ? 70 : 84, min: 40 })
    : fit(ctx, text, latin, { maxW, maxLines: Math.max(2, Math.floor(room / 80)), max: img ? 64 : 80, min: 36, weight: "800" });
  const font = ctx.font;
  const lh = ur ? r.fs * 1.6 : r.fs * 1.16;
  const blockH = r.lines.length * lh;
  const y0 = top + 100 + Math.max(0, (room - blockH) / 2) + lh / 2;
  // soft white plate behind the text so it reads over the tiles and watermark
  ctx.save(); ctx.fillStyle = "rgba(255,255,255,.72)";
  roundRect(ctx, 40, y0 - lh / 2 - 18, W - 80, blockH + 36, 18); ctx.fill(); ctx.restore();
  ctx.fillStyle = MAROON; ctx.fillRect(W / 2 - 60, y0 - lh / 2 - 18, 120, 5);
  drawLines(ctx, r.lines, {
    x: W / 2, y: y0 + (ur ? 6 : 0), lh, rtl: ur, align: "center",
    color: "#141414", hiColor: MAROON, stroke: ur ? r.fs / 55 : 0, font,
  });
  // date, small, above the footer
  ctx.direction = "ltr"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 24px ${latin}`; ctx.fillStyle = "#7A7A7A";
  ctx.fillText(stampDate(lang), W / 2, areaH - 26);

  if (bgFoot) { ctx.drawImage(bgFoot, 0, H - footH, W, footH); if (o.template !== "__none") siteUrlOnFooter(ctx, W, H, footH, latin); }
  else footerBand(ctx, W, H - 104, 104, o);
}

// "Pak Dharti News" — the house design: big photo, logo and section chip on top, a white card with the
// headline (Nastaliq, key words in maroon), an optional one-line summary and the sources, and the
// channel's own footer band.
function tPdNews(ctx, W, H, o) {
  const { img, logo, lang, latin, text, label, subtitle, sources, category, bgFoot, scale = 1 } = o;
  const ur = lang === "ur";
  const story = H > 1500, square = H < 1200;
  const footH = Math.round(W * 166 / 1080);
  const photoH = story ? 1060 : square ? 560 : 760;
  const cityName = detectCity(`${text} ${subtitle || ""}`, ur);
  const headline = stripCity(text, cityName);

  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  if (o.collage) drawCollageTop(ctx, W, photoH - 50, o.collage, { latin, rtl: ur, bgH: photoH + 40 });
  else if (img) cover(ctx, img, 0, 0, W, photoH + 40);
  // top shade for the chips, bottom fade into the card
  let g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 200);
  if (!o.collage) {
    g = ctx.createLinearGradient(0, photoH - 260, 0, photoH + 40);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = g; ctx.fillRect(0, photoH - 260, W, 300);
  }

  // section + date badge in the top corner
  if (category && o.badgePos !== "none") {
    const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).formatToParts(new Date());
    const pv = (t) => parts.find((x) => x.type === t)?.value || "";
    const dt = `${pv("day")} ${pv("month")} ${pv("year")}`.toUpperCase();
    const city = cityName;
    const catShown = city && city !== category ? `${category} | ${city}` : category;
    const catFont = ur ? `38px ${ASLAM}` : `800 27px ${latin}`;
    ctx.direction = ur ? "rtl" : "ltr"; ctx.font = catFont;
    const catW = ctx.measureText(catShown).width;
    ctx.direction = "ltr"; ctx.font = `800 16px ${latin}`; try { ctx.letterSpacing = "1.5px"; } catch {}
    const dateW = ctx.measureText(dt).width;
    const bw = Math.max(catW + 56, dateW + 44), bh = ur ? 98 : 86;
    // where the badge sits: "top-right", "bottom-left" ... ("bottom" = the bottom of the picture area, above the red panel); auto = top corner on the reading side
    const twoPeople = !!o.collage && o.collage.people?.length > 1 && o.collage.layout !== "circles";
    const bp = String(o.badgePos === "auto" || !o.badgePos ? (twoPeople ? "top-center" : "auto") : o.badgePos), side = bp.includes("left") ? "left" : bp.includes("right") ? "right" : bp.includes("center") ? "center" : (ur ? "right" : "left");
    const bx = side === "center" ? (W - bw) / 2 : side === "right" ? W - 40 - bw : 40;
    const by = bp.startsWith("bottom") ? photoH - 50 - bh - 18 : 36;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    roundRect(ctx, bx, by, bw, bh, 22); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
    roundRect(ctx, bx + 3, by + 3, bw - 6, bh - 6, 19); ctx.save(); ctx.clip(); gloss(ctx, bx, by, bw, bh); ctx.restore();
    roundRect(ctx, bx + 7, by + 7, bw - 14, bh - 14, 15); ctx.strokeStyle = "rgba(246,209,90,.85)"; ctx.lineWidth = 2; ctx.stroke();
    // section name (big), gold rule with a diamond, then the date
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.direction = ur ? "rtl" : "ltr"; ctx.font = catFont; ctx.fillStyle = "#FFFFFF";
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    if (ur) { ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 38 / 16; ctx.lineJoin = "round"; ctx.strokeText(catShown, bx + bw / 2, by + 38); }
    ctx.fillText(catShown, bx + bw / 2, by + (ur ? 38 : 33)); ctx.restore();
    const ly = by + bh - 34;
    ctx.fillStyle = "rgba(246,209,90,.8)"; ctx.fillRect(bx + 22, ly, bw / 2 - 22 - 12, 2); ctx.fillRect(bx + bw / 2 + 12, ly, bw / 2 - 22 - 12, 2);
    diamond(ctx, bx + bw / 2, ly + 1, 5, "#F6D15A");
    ctx.direction = "ltr"; ctx.font = `800 16px ${latin}`; try { ctx.letterSpacing = "1.5px"; } catch {}
    ctx.fillStyle = "#F6D15A"; ctx.fillText(dt, bx + bw / 2 + 1, by + bh - 15);
    try { ctx.letterSpacing = "0px"; } catch {}
  }

  // deep maroon panel with a gold hairline, soft sheen and a faint pattern
  const cardY = photoH - 50, cardH = H - cardY;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.40)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = -8;
  roundRect(ctx, 24, cardY, W - 48, cardH, 34);
  const pg = ctx.createLinearGradient(0, cardY, 0, H);
  pg.addColorStop(0, "#9A0B0B"); pg.addColorStop(0.45, "#6E0000"); pg.addColorStop(1, "#3E0000");
  ctx.fillStyle = pg; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, 24, cardY, W - 48, cardH, 34); ctx.clip();
  const sh = ctx.createLinearGradient(0, cardY, 0, cardY + 150);
  sh.addColorStop(0, "rgba(255,255,255,.16)"); sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillRect(24, cardY, W - 48, 150);
  const gl = ctx.createRadialGradient(W / 2, cardY + cardH * 0.45, 20, W / 2, cardY + cardH * 0.45, W * 0.6);
  gl.addColorStop(0, "rgba(226,176,7,.16)"); gl.addColorStop(1, "rgba(226,176,7,0)");
  ctx.fillStyle = gl; ctx.fillRect(24, cardY, W - 48, cardH);
  ctx.globalAlpha = 0.05; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  for (let x = -cardH; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, cardY); ctx.lineTo(x + cardH, cardY + cardH); ctx.stroke(); }
  ctx.restore();
  ctx.save(); roundRect(ctx, 36, cardY + 12, W - 72, cardH - 24, 26);
  ctx.strokeStyle = "rgba(243,211,107,.55)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  labelBadge(ctx, label, W / 2, cardY + 4, { lang, latin });

  const hasSub = !!(subtitle && subtitle.trim());
  const hasSrc = false;   // no source line on the card: the story page carries the credit
  const bandTop = H - Math.round(footH * 95 / 166);           // the red band of the footer
  let bottom = bandTop - Math.round(Math.round(footH * 0.155) * 1.75) - 36;   // above the website pill
  // bottom-up: sources line, then the summary, then the headline fills the rest
  const srcY = hasSrc ? bottom - 16 : null;
  if (hasSrc) bottom -= 42;
  let subLines = null, subLh = 0, subFont = "";
  if (hasSub) {
    const sr = ur
      ? fit(ctx, subtitle, NOORI, { maxW: W - 180, maxLines: square ? 1 : 2, max: 34, min: 26 })
      : fit(ctx, subtitle, latin, { maxW: W - 180, maxLines: square ? 1 : 2, max: 28, min: 22, weight: "500" });
    subFont = ctx.font; subLines = sr.lines; subLh = ur ? sr.fs * 1.6 : sr.fs * 1.3;
    bottom -= subLines.length * subLh + 22;
  }
  const top = cardY + 50;
  const maxW = W - 150;
  const avail = bottom - top;
  let r = ur
    ? fitTwoLines(ctx, headline, KASHEEDA, { maxW, max: square ? 88 : 100, min: 38, sp: 0.55 })
    : fitTwoLines(ctx, headline, latin, { maxW, max: square ? 80 : 92, min: 34, weight: "800" });
  if (scale !== 1) {
    // the automatic size is what fits two lines; "Text size" scales that real size (a larger one may use a third line)
    const fam = ur ? KASHEEDA : latin, wt = ur ? "" : "800", spv = ur ? 0.55 : 1, lhf = ur ? 1.58 : 1.16;
    let fs = Math.max(28, Math.round(r.fs * scale));
    for (;;) {
      const r2 = fit(ctx, headline, fam, { maxW, maxLines: 3, max: fs, min: fs, weight: wt, sp: spv });
      if (r2.lines.length * r2.fs * lhf <= avail || fs <= 28) { r = r2; break; }
      fs -= 2;
    }
  }
  const font = ctx.font;
  const lh = ur ? r.fs * 1.58 : r.fs * 1.16;
  const blockH = r.lines.length * lh;
  const y0 = top + Math.max(0, (avail - blockH) / 2) + lh / 2;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  drawLines(ctx, r.lines, { x: W / 2, y: y0 + (ur ? 6 : 0), lh, rtl: ur, align: "center", color: "#FFFFFF", hiColor: "#F6D15A", stroke: ur ? r.fs / 46 : 0, font, sp: ur ? 0.55 : 1 });
  ctx.restore();

  if (hasSub) {
    const sy = bottom + 8;
    ctx.fillStyle = "rgba(243,211,107,.8)"; ctx.fillRect(W / 2 - 60, sy, 120, 3);
    drawLines(ctx, subLines, { x: W / 2, y: sy + 14 + subLh / 2, lh: subLh, rtl: ur, align: "center", color: "#F3E6C4", hiColor: "#F6D15A", font: subFont });
  }
  if (hasSrc) {
    ctx.direction = ur ? "rtl" : "ltr"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = ur ? `26px ${NOORI}` : `600 20px ${latin}`; ctx.fillStyle = "#7A7A7A";
    ctx.fillText(ur ? `ذرائع: ${sources}` : `Sources: ${sources}`, W / 2, srcY);
  }
  if (bgFoot) pdFooter(ctx, W, H, footH, { bgFoot, logo, latin });
  else footerBand(ctx, W, H - 104, 104, o);
}

const TEMPLATES = { collage: tPdNews, pdnews: tPdNews, brand: tBrand, headline: tHeadline, boxed: tBoxed, quote: tQuote };
export const TEMPLATE_NAMES = { collage: "Collage: people, flags and place (recommended)", pdnews: "Pak Dharti News (story photo)", brand: "Pak Dharti frame (works without a photo)", headline: "Headline (photo + dark panel)", boxed: "Boxed (white card on photo)", quote: "Quote / statement" };

/** Category banners are placeholders, not news photos. */
export const isRealPhoto = (src) => !!src && !/\/images\/categories\//.test(src);

/**
 * opts: { template, size, lang ("ur" | "en"), text, label, speaker, imageSrc, logoSrc }
 */
export async function drawNewsCard(canvas, opts) {
  const [W, H] = SIZES[opts.size] || SIZES.post;
  // HD: drawn at 1440 px wide (designed at 1080), so photos and text stay sharp on phones and when zoomed
  const S = opts.hd === false ? 1 : 4 / 3;
  canvas.width = Math.round(W * S); canvas.height = Math.round(H * S);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const lang = opts.lang === "ur" ? "ur" : "en";
  if (lang === "ur") {
    try {
      if (!document.fonts.check('60px "PD Noori Kasheeda"')) {
        const ff = new FontFace("PD Noori Kasheeda", "url(/fonts/urdu/JameelNooriNastaleeqKasheeda.woff2)");
        document.fonts.add(await ff.load());
      }
    } catch {}
    try {
      if (!document.fonts.check('60px "PD Aslam"')) {
        const fa = new FontFace("PD Aslam", "url(/fonts/urdu/Aslam.woff2)");
        document.fonts.add(await fa.load());
      }
    } catch {}
    try { await document.fonts.load(`60px ${NOORI}`, `${opts.text} ${opts.label} ${opts.speaker || ""} ${SITE_NAME.ur}`); } catch {}
  }
  try { await document.fonts.ready; } catch {}
  const photo = isRealPhoto(opts.imageSrc) ? opts.imageSrc : null;
  const [img, logo, bgTop, bgFoot] = await Promise.all([
    loadImage(photo), loadImage(opts.logoSrc || "/brand/logo.png"),
    loadImage(opts.bgTopSrc || "/brand/card-top.jpg"), loadImage(opts.bgFootSrc || (["pdnews", "collage"].includes(opts.template) ? "/brand/card-foot.png" : "/brand/card-foot.jpg")),
  ]);
  // Collage: place photo, flags and people from the library
  let collage = null;
  if (opts.template === "collage" && opts.visual) {
    const v = opts.visual;
    const [scene, flags, people] = await Promise.all([
      loadImage(v.sceneOff ? null : v.scene?.url),
      Promise.all((v.flags || []).slice(0, 4).map(loadImage)),
      Promise.all((v.people || []).map((p, idx) => ({ p, idx })).filter(({ p }) => !p.off).slice(0, 3).map(async ({ p, idx }) => {
        // the cut-out may be unreachable (stored on a blocked store): fall back to the plain photo so the person still shows
        const cutIm = p.cutout ? await loadImage(p.cutout) : null;
        const im = cutIm || await loadImage(p.photo);
        return im ? { img: im, cut: !!cutIm, name: lang === "ur" ? p.nameUr || p.name : p.name, idx, lay: p.lay } : null;
      })),
    ]);
    // never draw the same face twice (same image, or one name inside the other)
    const tk = (n) => String(n || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    const uniq = [];
    for (const p of people.filter(Boolean)) {
      const t = tk(p.name);
      if (!uniq.some((u) => (p.img.src && u.img.src === p.img.src) || (t.length && u.tk.length && (t.every((x) => u.tk.includes(x)) || u.tk.every((x) => t.includes(x)))))) uniq.push({ ...p, tk: t });
    }
    collage = { scene, flags: flags.filter(Boolean), people: uniq, divider: v.divider, layout: v.layout, flagMode: v.flagMode, flagAlpha: v.flagAlpha };
    if (!collage.scene && !collage.flags.length && !collage.people.length) collage = null;
  }
  // Without a real photo, the photo designs fall back to the channel frame
  const name = opts.template === "collage" ? (collage ? "collage" : img ? "pdnews" : "brand")
    : !img && opts.template !== "quote" ? "brand" : opts.template;
  const draw = TEMPLATES[name] || tBrand;
  draw(ctx, W, H, { ...opts, lang, img, logo, bgTop, bgFoot, collage, latin: latinFont(), label: opts.label || LABELS[lang][0] });
  canvas._boxes = collage?.boxes || []; canvas._lw = W; canvas._lh = H; canvas._areaH = collage?.areaH || 1;   // for picking people with the mouse in the editor
  return canvas;
}

/** Suggests highlighting: the part before ":" or the first "،" (usually who or where), else the first two words. */
export function autoHighlight(text) {
  const t = String(text).replace(/\*/g, "").trim();
  const m = /^(.{3,40}?)\s*([:：،,])\s*(.+)$/.exec(t);
  if (m) return `*${m[1]}*${m[2]} ${m[3]}`;
  const w = t.split(/\s+/);
  return w.length > 4 ? `*${w.slice(0, 2).join(" ")}* ${w.slice(2).join(" ")}` : t;
}
