// News graphic drawn on the SERVER (so every auto-post gets a proper Pak Dharti card, like the ones made by hand in /admin).
// Same design as lib/newsCard.js ("Pak Dharti News" photo card, and the channel-frame card when there is no fitting photo),
// but the Urdu is shaped by Pango/HarfBuzz inside sharp (the Nastaliq fonts are fetched once per server and kept in /tmp).
// Output: 1440 x 1800 JPEG (the 1080 x 1350 design at 4/3 scale, like the browser version).
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
// sharp is loaded on first use only: importing it at the top breaks every page that merely imports this file
// on hosts where the native library is missing (Cloudflare Workers).
let _sharp = null;
const sharp = (...a) => _sharp(...a);
async function loadSharp() { _sharp ??= (await import("sharp")).default; }
import { getCardLook, LOOK_DEFAULT } from "./cardLook";

const W = 1080, H = 1350, S = 4 / 3, TZ = "Asia/Karachi";
const MAROON = "#7A0000";
const SITE_URL = "www.PakDhartiTV.com";
export const LABELS = { ur: ["تازہ ترین", "بریکنگ نیوز", "اہم خبر"], en: ["LATEST", "BREAKING", "TOP STORY"] };

// ---------------------------------------------------------------- fonts
const FONT_DIR = path.join(os.tmpdir(), "pdfonts");
const FILES = {
  PDAslam: ["PDAslam.ttf", "PDAslam.ttf"],
  PDNoori: ["PDNoori.ttf", "PDNoori.ttf.br"],          // Jameel Noori Nastaleeq: headline, labels (the look of the manual cards)
  "DejaVu Sans Bold": ["DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"],
};
const pending = new Map();
/** Downloads the wanted fonts once per server (kept in /tmp) and points fontconfig at them. */
export async function ensureFonts(origin, fams) {
  fs.mkdirSync(path.join(FONT_DIR, "cache"), { recursive: true });
  await Promise.all(fams.map((fam) => {
    const [out, remote] = FILES[fam], f = path.join(FONT_DIR, out);
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) return null;
    if (!pending.has(fam)) pending.set(fam, (async () => {
      const r = await fetch(`${origin}/fonts/server/${remote}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`font ${remote} ${r.status}`);
      let b = Buffer.from(await r.arrayBuffer());
      if (remote.endsWith(".br")) b = zlib.brotliDecompressSync(b);
      fs.writeFileSync(f + ".part", b); fs.renameSync(f + ".part", f);
    })().finally(() => pending.delete(fam)));
    return pending.get(fam);
  }));
  const conf = path.join(FONT_DIR, "fonts.conf");
  if (!fs.existsSync(conf)) fs.writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${path.join(FONT_DIR, "cache")}</cachedir></fontconfig>`);
  process.env.FONTCONFIG_FILE = conf; process.env.FONTCONFIG_PATH = FONT_DIR;
}

// ---------------------------------------------------------------- text as pictures
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cache = new Map();
/** Latin digits and punctuation are not in the Nastaliq font: take them from the Aslam font (also calligraphic), not a plain sans. */
const mixed = (t, rtl) => (rtl ? esc(t).replace(/([0-9A-Za-z:.,%+()"'\/&-]+)/g, '<span font_family="PDAslam">$1</span>') : esc(t));
/** One piece of text as a transparent picture. size = design px; returns { buf, w, h } in design px. */
async function tx(text, { fam, size, color = "#FFFFFF", rtl = false, ls = 0, mix = false }) {
  const key = `${fam}|${size}|${color}|${rtl}|${ls}|${mix}|${text}`;
  if (cache.has(key)) return cache.get(key);
  const markup = `<span foreground="${color}"${ls ? ` letter_spacing="${Math.round(ls * S * 1024)}"` : ""}>${mix ? mixed(text, rtl) : esc(text)}</span>`;
  const { data, info } = await sharp({ text: { text: markup, font: `${fam} ${(size * S).toFixed(2)}`, fontfile: path.join(FONT_DIR, FILES[fam][0]), rgba: true, dpi: 72, rtl } })
    .png().toBuffer({ resolveWithObject: true });
  const out = { buf: data, w: info.width / S, h: info.height / S };
  if (cache.size > 500) cache.clear();
  cache.set(key, out);
  return out;
}

/** Remembers the width (per 1px of font size) of every word, so lines can be fitted without drawing at each size. */
function measurer(fam, rtl) {
  const w = new Map();
  return {
    async ensure(text) {
      for (const tk of tokens(text)) if (!w.has(tk.t)) w.set(tk.t, (await tx(tk.t, { fam, size: 100, rtl, mix: true })).w / 100);
    },
    wOf: (t) => w.get(t) || 0,
    async spaceUnit() {
      if (fam === "PDKasheeda" || fam === "PDNoori") return 0.17;      // the font's real space (as the browser measures it); a measured gap comes out too tight
      const a = (await tx("ب", { fam, size: 100, rtl })).w, ab = (await tx("ب ب", { fam, size: 100, rtl })).w;
      return Math.max(0.1, (ab - 2 * a) / 100);
    },
  };
}

// ---------------------------------------------------------------- text helpers (same logic as lib/newsCard.js)
function tokens(text) {
  const out = [];
  let hi = false, prev = "";
  for (const part of String(text).split("*")) {
    const glueFirst = out.length > 0 && part.length > 0 && !/^\s/.test(part) && !/\s$/.test(prev);
    prev = part;
    part.split(/\s+/).filter(Boolean).forEach((w, i) => out.push({ t: w, hi, glue: i === 0 && glueFirst }));
    hi = !hi;
  }
  return out;
}
export function autoHighlight(text) {
  const t = String(text).replace(/\*/g, "").trim();
  const m = /^(.{3,40}?)\s*([:：،,])\s*(.+)$/.exec(t);
  if (m) return `*${m[1]}*${m[2]} ${m[3]}`;
  const w = t.split(/\s+/);
  return w.length > 4 ? `*${w.slice(0, 2).join(" ")}* ${w.slice(2).join(" ")}` : t;
}
const CITIES = [
  ["کراچی", "Karachi", /کراچی|Karachi/i], ["لاہور", "Lahore", /لاہور|Lahore/i], ["اسلام آباد", "Islamabad", /اسلام آباد|Islamabad/i],
  ["راولپنڈی", "Rawalpindi", /راولپنڈی|Rawalpindi/i], ["پشاور", "Peshawar", /پشاور|Peshawar/i], ["کوئٹہ", "Quetta", /کوئٹہ|Quetta/i],
  ["ملتان", "Multan", /ملتان|Multan/i], ["فیصل آباد", "Faisalabad", /فیصل آباد|Faisalabad/i], ["حیدرآباد", "Hyderabad", /حیدر آباد|حیدرآباد|Hyderabad/i],
  ["سیالکوٹ", "Sialkot", /سیالکوٹ|Sialkot/i], ["گوجرانوالہ", "Gujranwala", /گوجرانوالہ|Gujranwala/i], ["سکھر", "Sukkur", /سکھر|Sukkur/i],
  ["بہاولپور", "Bahawalpur", /بہاولپور|Bahawalpur/i], ["ایبٹ آباد", "Abbottabad", /ایبٹ آباد|Abbottabad/i], ["مظفر آباد", "Muzaffarabad", /مظفر آباد|Muzaffarabad/i],
  ["گوادر", "Gwadar", /گوادر|Gwadar/i], ["سوات", "Swat", /سوات|Swat/i], ["گلگت", "Gilgit", /گلگت|Gilgit/i],
];
function detectCity(text, ur) {
  let best = null;
  for (const [u, e, re] of CITIES) { const m = String(text || "").match(re); if (m && (!best || m.index < best.i)) best = { i: m.index, name: ur ? u : e }; }
  return best ? best.name : "";
}
function stripCity(text, city) {
  if (!city) return text;
  const re = new RegExp(`^\\s*\\*?\\s*${city}\\s*\\*?\\s*[:：،,\\-–—]\\s*`);
  const t = String(text).replace(re, "");
  return t.trim().length > 8 ? t : text;
}

function wrapLines(toks, maxW, space, wOf, fs) {
  const lines = []; let line = []; let w = 0;
  for (const tk of toks) {
    const tw = wOf(tk.t) * fs;
    const gap = line.length && !tk.glue ? space * fs : 0;
    if (line.length && !tk.glue && w + gap + tw > maxW) { lines.push({ toks: line, w }); line = []; w = 0; }
    w += (line.length && !tk.glue ? space * fs : 0) + tw; line.push({ ...tk, w: tw, glue: line.length ? tk.glue : false });
  }
  if (line.length) lines.push({ toks: line, w });
  return lines;
}
function fitLines(toks, maxW, space, wOf, { maxLines, max, min }) {
  for (let fs = max; fs >= min; fs -= 2) {
    const lines = wrapLines(toks, maxW, space, wOf, fs);
    if (lines.length <= maxLines) return { fs, lines };
  }
  return { fs: min, lines: wrapLines(toks, maxW, space, wOf, min) };
}
/** At most two lines: shrinks the text, and if it is still too long drops the last words and ends with "…". */
async function fitTwo(text, m, space, { maxW, max, min }) {
  let words = String(text).trim().split(/\s+/), cut = false;
  for (;;) {
    const t = words.join(" ") + (cut ? "…" : "");
    await m.ensure(t);
    const r = fitLines(tokens(t), maxW, space, m.wOf, { maxLines: 2, max, min });
    if (r.lines.length <= 2 || words.length <= 3) return r;
    words = words.slice(0, -1); cut = true;
  }
}

// ---------------------------------------------------------------- drawing pieces
const G = (x) => Math.round(x * S);     // design px -> output px
function svg(inner) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(W)}" height="${G(H)}" viewBox="0 0 ${W} ${H}">${inner}</svg>`);
}
const full = (inner) => ({ input: svg(inner), left: 0, top: 0 });
const place = (img, cx, cy) => ({ input: img.buf, left: Math.max(0, Math.round((cx - img.w / 2) * S)), top: Math.max(0, Math.round((cy - img.h / 2) * S)) });
const placeL = (img, x, cy) => ({ input: img.buf, left: Math.max(0, Math.round(x * S)), top: Math.max(0, Math.round((cy - img.h / 2) * S)) });

/**
 * One whole line as one picture, so every word sits on the same baseline and punctuation joins its word naturally.
 * An invisible tall reference text at the end of the line gives every line the same height (same baseline offset).
 */
async function lineTx(ln, { fam, fs, rtl, color, hiColor, space }) {
  const ref = rtl ? "ٹکڈجگے" : "Ágjy";
  const gapPx = (space - (fam === "DejaVu Sans Bold" ? 0.28 : 0.17)) * fs * S;     // the space is narrowed (or widened) from the font's own
  const sp = `<span letter_spacing="${Math.round(gapPx * 1024)}"> </span>`;
  const body = ln.toks.map((tk, i) => `${i > 0 && !tk.glue ? sp : ""}<span foreground="${tk.hi ? hiColor : color}">${mixed(tk.t, rtl)}</span>`).join("");
  const markup = `${body}${sp}<span alpha="1">${ref}</span>`;
  const key = `L|${fam}|${fs}|${rtl}|${markup}`;
  if (cache.has(key)) return cache.get(key);
  const render = (m) => sharp({ text: { text: m, font: `${fam} ${(fs * S).toFixed(2)}`, fontfile: path.join(FONT_DIR, FILES[fam][0]), rgba: true, dpi: 72, rtl } }).png().toBuffer({ resolveWithObject: true });
  const { data, info } = await render(markup);
  // where the words' ink really starts and ends (the invisible reference is not ink), to centre the line exactly
  const alpha = await sharp(data).ensureAlpha().extractChannel(3).raw().toBuffer();
  let inkL = info.width, inkR = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (alpha[y * info.width + x] > 24) { if (x < inkL) inkL = x; if (x > inkR) inkR = x; }
  if (inkR <= inkL) { inkL = 0; inkR = info.width; }
  const out = { buf: data, w: info.width / S, h: info.height / S, mid: (inkL + inkR) / 2 / S };
  cache.set(key, out);
  return out;
}

/** Draws wrapped lines (one picture per line) with an optional soft shadow. */
async function textLayers(lines, { fam, fs, rtl, cx, y0, lh, color, hiColor, bold, shadow, space, dy = 0 }) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i], cy = y0 + i * lh + dy;
    const img = await lineTx(ln, { fam, fs, rtl, color, hiColor, space });
    items.push({ img, left: cx - img.mid, cy });
  }
  if (!items.length) return [];
  const pad = 40;
  const top = Math.max(0, Math.floor(Math.min(...items.map((i) => i.cy - i.img.h / 2)) - pad));
  const bottom = Math.min(H, Math.ceil(Math.max(...items.map((i) => i.cy + i.img.h / 2)) + pad));
  const d = bold ? Math.max(0.6, fs / 92) : 0, offs = bold ? [[-d, 0], [d, 0], [0, -d], [0, d], [0, 0]] : [[0, 0]];
  const comp = [];
  for (const it of items) for (const [ox, oy] of offs) {
    comp.push({ input: it.img.buf, left: Math.max(0, Math.round((it.left + ox + 300) * S)), top: Math.max(0, Math.round((it.cy - it.img.h / 2 - top + oy) * S)) });
  }
  // drawn on a wider sheet (a line's picture can reach past the card edge by its invisible reference), then cropped to the card
  const textPng = await sharp(await sharp({ create: { width: G(W + 600), height: G(bottom - top), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comp).png().toBuffer()).extract({ left: G(300), top: 0, width: G(W), height: G(bottom - top) }).png().toBuffer();
  const out = [];
  if (shadow) {
    const sh = await sharp({ create: { width: G(W), height: G(bottom - top), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite([{ input: textPng, blend: "dest-in" }]).blur(5 * S).linear([1, 1, 1, 0.5], [0, 0, 0, 0]).png().toBuffer();
    out.push({ input: sh, left: 0, top: Math.round((top + 4) * S) });
  }
  out.push({ input: textPng, left: 0, top: Math.round(top * S) });
  return out;
}

const diamond = (x, y, r, c) => `<path d="M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z" fill="${c}"/>`;
const rr = (x, y, w, h, r, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${extra}/>`;
const GLOSS = `<linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A30606"/><stop offset=".55" stop-color="#7A0000"/><stop offset="1" stop-color="#4C0000"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
const shadowF = (id, dy, blur, op) => `<filter id="${id}" x="-20%" y="-30%" width="140%" height="190%"><feDropShadow dx="0" dy="${dy}" stdDeviation="${blur / 2}" flood-color="#000" flood-opacity="${op}"/></filter>`;

async function websitePill(bandTop) {
  const fs = Math.round(166 * 0.155), h = Math.round(fs * 1.75);
  const parts = [["www.", "#FFFFFF"], ["PakDhartiTV", "#F6D15A"], [".com", "#FFFFFF"]];
  const imgs = [];
  for (const [t, c] of parts) imgs.push(await tx(t, { fam: "DejaVu Sans Bold", size: fs, color: c, ls: 1.5 }));
  const tw = imgs.reduce((a, i) => a + i.w, 0), ir = fs * 0.62;
  const w = Math.round(tw + ir * 2 + fs * 1.5 + 12), x = Math.round((W - w) / 2), y = bandTop - h - 20;
  const gx = x + fs * 0.75 + ir, gy = y + h / 2, lw = Math.max(2, ir / 7);
  const globe = `<g fill="none" stroke="#F6D15A" stroke-width="${lw}" stroke-linecap="round"><circle cx="${gx}" cy="${gy}" r="${ir}"/><ellipse cx="${gx}" cy="${gy}" rx="${ir * 0.42}" ry="${ir}"/><path d="M${gx - ir} ${gy}H${gx + ir}M${gx - ir * 0.86} ${gy - ir * 0.5}H${gx + ir * 0.86}M${gx - ir * 0.86} ${gy + ir * 0.5}H${gx + ir * 0.86}"/></g>`;
  const out = [full(`<defs>${shadowF("ps", 3, 12, 0.4)}</defs>${rr(x, y, w, h, h / 2, 'fill="#1A0000" fill-opacity=".82" filter="url(#ps)"')}${rr(x, y, w, h, h / 2, 'fill="none" stroke="#F6D15A" stroke-width="2.5"')}${globe}`)];
  let x0 = x + fs * 0.75 + ir * 2 + fs * 0.45;
  for (const im of imgs) { out.push(placeL(im, x0, y + h / 2 + 1)); x0 += im.w; }
  return out;
}

async function logoLayers(logoBuf, y0, size) {
  const x = Math.round(W * 0.05), n = G(size);
  const logo = await sharp(logoBuf).resize(n, n).png().toBuffer();
  const pad = G(40);
  const sh = await sharp({ create: { width: n + pad * 2, height: n + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: n, height: n, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).composite([{ input: logo, blend: "dest-in" }]).png().toBuffer(), left: pad, top: pad }])
    .blur(8 * S).linear([1, 1, 1, 0.45], [0, 0, 0, 0]).png().toBuffer();
  return [{ input: sh, left: Math.max(0, G(x) - pad), top: Math.max(0, G(y0) - pad + G(4)) }, { input: logo, left: G(x), top: G(y0) }];
}

async function loadAssets(origin) {
  const get = async (p) => { const r = await fetch(`${origin}${p}`, { cache: "no-store" }); if (!r.ok) throw new Error(`asset ${p} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
  const [foot, footJpg, logo, top] = await Promise.all([get("/brand/card-foot.png"), get("/brand/card-foot.jpg"), get("/brand/logo.png"), get("/brand/card-top.jpg")]);
  return { foot, footJpg, logo, top };
}

/** Cover-crops a photo to w x h design px (focus keeps faces in the upper third). */
async function coverPhoto(buf, w, h, focusY = 0.3) {
  const rotated = await sharp(buf).rotate().toBuffer();
  const m = await sharp(rotated).metadata();
  const s = Math.max(w / m.width, h / m.height), sw = Math.min(m.width, Math.round(w / s)), sh = Math.min(m.height, Math.round(h / s));
  const sx = Math.max(0, Math.round((m.width - sw) / 2)), sy = Math.max(0, Math.min(m.height - sh, Math.round(m.height * focusY - sh / 2)));
  return sharp(rotated).extract({ left: sx, top: sy, width: sw, height: sh }).resize(G(w), G(h), { fit: "fill" }).png().toBuffer();
}

// ---------------------------------------------------------------- top of the card: story photo, or the people / flags / place collage
async function silhouetteShadow(buf, w, h, alpha, blur) {
  const pad = G(60);
  return sharp({ create: { width: w + pad * 2, height: h + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).composite([{ input: buf, blend: "dest-in" }]).png().toBuffer(), left: pad, top: pad }])
    .blur(blur * S).linear([1, 1, 1, alpha], [0, 0, 0, 0]).png().toBuffer().then((b) => ({ buf: b, pad }));
}

/** A flag as a gently waving picture (vertical strips shifted like cloth). */
async function wavingFlag(buf, w, h, phase0) {
  const W2 = G(w), H2 = G(h);
  const flag = await sharp(buf, { density: 200 }).resize(W2, H2, { fit: "fill" }).png().toBuffer();
  const strips = 48, sw = W2 / strips, amp = H2 * 0.07, pad = Math.ceil(amp * 1.2);
  const comp = [];
  for (let i = 0; i < strips; i++) {
    const t = i / strips, ph = phase0 + t * Math.PI * 1.8;
    const dy = Math.sin(ph) * amp * (0.3 + t), c = Math.cos(ph);
    const x0 = Math.floor(i * sw), x1 = Math.min(W2, Math.ceil((i + 1) * sw) + 1);
    const strip = await sharp(flag).extract({ left: x0, top: 0, width: x1 - x0, height: H2 }).toBuffer();
    comp.push({ input: strip, left: x0, top: Math.round(pad + dy) });
    const shade = c > 0 ? { r: 255, g: 255, b: 255, alpha: 0.16 * c } : { r: 0, g: 0, b: 0, alpha: 0.22 * -c };
    comp.push({ input: await sharp({ create: { width: x1 - x0, height: H2, channels: 4, background: shade } }).png().toBuffer(), left: x0, top: Math.round(pad + dy) });
  }
  const img = await sharp({ create: { width: W2, height: H2 + pad * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).png().toBuffer();
  return { buf: img, pad };
}

async function nameTag(text, cx, cy) {
  if (!text) return [];
  const t = await tx(text, { fam: /[\u0600-\u06FF]/.test(text) ? "PDAslam" : "DejaVu Sans Bold", size: /[\u0600-\u06FF]/.test(text) ? 34 : 24, rtl: /[\u0600-\u06FF]/.test(text) });
  const w = t.w + 40, h = /[\u0600-\u06FF]/.test(text) ? 54 : 44;
  return [full(`<defs>${GLOSS}${shadowF("nt" + Math.round(cx), 3, 10, 0.4)}<clipPath id="nc${Math.round(cx)}">${rr(cx - w / 2, cy - h / 2, w, h, h / 2, "")}</clipPath></defs>
${rr(cx - w / 2, cy - h / 2, w, h, h / 2, `fill="#7A0000" filter="url(#nt${Math.round(cx)})"`)}<g clip-path="url(#nc${Math.round(cx)})"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="url(#gl)"/><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h / 2}" fill="url(#sheen)"/></g>`), place(t, cx, cy + 4)];
}

/**
 * Top of the card, 0..bgH. v = { scene: Buffer|null, flags: [Buffer], people: [{ buf, cut, name }] } (any may be empty:
 * then it is the maroon stage with the channel logo).
 */

/** Flags as a soft, blurred colour wash across the background (one band per flag, blended at the seams). */
async function flagWash(flags, bgH, rtl, alpha = 0.7) {
  const order = rtl ? [...flags].reverse() : flags, n = order.length, sw = W / n, ov = n > 1 ? 220 : 0, out = [];
  for (let i = 0; i < n; i++) {
    try {
      const x0 = i === 0 ? 0 : i * sw - ov / 2, x1 = i === n - 1 ? W : (i + 1) * sw + ov / 2, w = x1 - x0;
      const img = await sharp(order[i], { density: 200 }).resize(G(w), G(bgH), { fit: "cover" }).blur(14 * S).ensureAlpha().png().toBuffer();
      const lft = i === 0 ? "" : `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${ov / w}" stop-color="#000" stop-opacity="1"/>`;
      const rgt = i === n - 1 ? "" : `<stop offset="${1 - ov / w}" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/>`;
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(w)}" height="${G(bgH)}"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0">${i === 0 ? '<stop offset="0" stop-color="#000"/>' : lft}${rgt || '<stop offset="1" stop-color="#000"/>'}</linearGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
      const soft = await sharp(img).composite([{ input: mask, blend: "dest-in" }]).linear([1, 1, 1, alpha], [0, 0, 0, 0]).png().toBuffer();
      out.push({ input: soft, left: G(x0), top: 0 });
    } catch { /* a flag that cannot be drawn is simply left out */ }
  }
  return out;
}


/** Flags split by jagged golden cracks (a "darar"): each flag fills its own piece, the cracks glow like lightning. */
async function flagCrack(flags, bgH, rtl, alpha = 0.7) {
  const order = rtl ? [...flags].reverse() : flags, n = order.length, out = [], rnd = (a) => { const x = Math.sin(a * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const steps = 9, cracks = [];
  for (let j = 1; j < n; j++) {
    const pts = [];
    for (let k = 0; k <= steps; k++) pts.push([j * W / n + (k === 0 || k === steps ? (j % 2 ? 40 : -40) : (rnd(k * 7 + j * 31) - 0.5) * 110) + (k / steps - 0.5) * 70 * (j % 2 ? 1 : -1), k * bgH / steps]);
    cracks.push(pts);
  }
  const fmt = (pts) => pts.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");
  for (let i = 0; i < n; i++) {
    try {
      const left = i === 0 ? [[0, 0], [0, bgH]] : null, right = i === n - 1 ? [[W, 0], [W, bgH]] : null;
      const L = i === 0 ? left : cracks[i - 1], R = i === n - 1 ? right : cracks[i];
      const poly = [...L, ...[...R].reverse()];
      const xs = poly.map((q) => q[0]), x0 = Math.max(0, Math.min(...xs) - 4), x1 = Math.min(W, Math.max(...xs) + 4);
      const img = await sharp(order[i], { density: 200 }).resize(G(x1 - x0), G(bgH), { fit: "cover" }).blur(1.5 * S).ensureAlpha().png().toBuffer();
      const canvas = await sharp({ create: { width: G(W), height: G(bgH), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: img, left: G(x0), top: 0 }]).png().toBuffer();
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(W)}" height="${G(bgH)}" viewBox="0 0 ${W} ${bgH}"><polygon points="${fmt(poly)}" fill="#000"/></svg>`);
      const piece = await sharp(canvas).composite([{ input: mask, blend: "dest-in" }]).linear([1, 1, 1, alpha], [0, 0, 0, 0]).png().toBuffer();
      out.push({ input: piece, left: 0, top: 0 });
    } catch { /* a flag that cannot be drawn is simply left out */ }
  }
  for (const pts of cracks) {
    const d = fmt(pts);
    out.push(full(`<defs><filter id="cgl" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="14"/></filter><filter id="csh" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="9"/></filter></defs>
<polyline points="${d}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="30" stroke-linejoin="round" filter="url(#csh)"/>
<polyline points="${d}" fill="none" stroke="#F6D15A" stroke-opacity=".85" stroke-width="22" stroke-linejoin="round" filter="url(#cgl)"/>
<polyline points="${d}" fill="none" stroke="#FFE9A8" stroke-width="5" stroke-linejoin="miter"/>
<polyline points="${d}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.6" stroke-linejoin="miter"/>`));
  }
  return out;
}


/** A small maroon label with a gold edge at the foot of a panel (the Pak Dharti two-people look). */
async function panelLabel(text, cx, cy) {
  if (!text) return [];
  const ur = /[\u0600-\u06FF]/.test(text);
  const t = await tx(text, { fam: ur ? "PDAslam" : "DejaVu Sans Bold", size: ur ? 36 : 26, rtl: ur });
  const w = t.w + 44, h = ur ? 58 : 46, id = Math.round(cx);
  return [full(`<defs>${shadowF("pl" + id, 3, 10, 0.45)}</defs>${rr(cx - w / 2, cy - h / 2, w, h, 6, `fill="#4C0000" fill-opacity=".93" filter="url(#pl${id})"`)}<rect x="${cx - w / 2}" y="${cy + h / 2 - 4}" width="${w}" height="4" fill="#E2B007"/>`), place(t, cx, cy + (ur ? 2 : 0) - 2)];
}

/** Two or three people, only photos: every person fills a panel, a thin white slanted gap between panels, a name label per panel. */
async function panelsTop(ppl, { areaH, bgH, rtl }) {
  const L = [], n = ppl.length, sl = 10, gap = 8, order = rtl ? [...ppl].reverse() : ppl;
  const edge = (b) => (b * W) / n;
  L.push(full(`<rect width="${W}" height="${bgH}" fill="#2A0008"/>`));
  for (let i = 0; i < n; i++) {
    const x0 = i === 0 ? 0 : edge(i) - sl, x1 = i === n - 1 ? W : edge(i + 1) + sl, w = x1 - x0;
    try {
      const img = await coverPhoto(order[i].buf, w, bgH, 0.22);
      const lt = i === 0 ? 0 : edge(i) + sl - x0, lb = i === 0 ? 0 : edge(i) - sl - x0, rt = i === n - 1 ? w : edge(i + 1) + sl - x0, rb = i === n - 1 ? w : edge(i + 1) - sl - x0;
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(w)}" height="${G(bgH)}" viewBox="0 0 ${w} ${bgH}"><polygon points="${lt},0 ${rt},0 ${rb},${bgH} ${lb},${bgH}" fill="#000"/></svg>`);
      L.push({ input: await sharp(img).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer(), left: G(x0), top: 0 });
    } catch { /* a photo that cannot be read is left out */ }
  }
  for (let b = 1; b < n; b++) L.push(full(`<defs>${shadowF("gp" + b, 0, 14, 0.45)}</defs><line x1="${edge(b) + sl}" y1="0" x2="${edge(b) - sl}" y2="${bgH}" stroke="#E2B007" stroke-width="${gap}" filter="url(#gp${b})"/>`));
  L.push(full(`<defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E0004" stop-opacity="0"/><stop offset="1" stop-color="#1E0004" stop-opacity=".3"/></linearGradient></defs><rect y="${bgH - 200}" width="${W}" height="200" fill="url(#cf)"/>`));
  for (let i = 0; i < n; i++) L.push(...await panelLabel(order[i].name, (edge(i) + edge(i + 1)) / 2, areaH - 34));
  return L;
}

async function collageTop(v, { areaH, bgH, rtl, logo, look = LOOK_DEFAULT }) {
  const L = [];
  const cap = look.maxPics || 2, ppl = v.people.slice(0, cap);
  if (ppl.length >= 2 && look.panels !== false && ppl.every((p) => !p.cut)) return await panelsTop(ppl, { areaH, bgH, rtl });   // the reference look for 2-3 people
  if (["photo", "whole"].includes(look.noCut) && ppl.length && ppl.every((p) => !p.cut)) {
    // only photos, no cut-outs: the plain photo(s) edge to edge; the story's own thing (a truck, a building) fills the other side
    const withScene = v.scene && ppl.length < cap;   // two or more people are enough on their own: no third picture crowding the card
    const items = [...ppl, ...(withScene ? [{ buf: v.scene, scene: true }] : [])];
    const n = items.length, ov = n > 1 ? 50 : 0, order = rtl ? [...items].reverse() : items;
    const widths = order.map((it) => (n === 1 ? W : it.scene ? W * (v.sceneShare || 0.42) : (W * (1 - (v.sceneShare || 0.42))) / (n - 1))), total = widths.reduce((x, y) => x + y, 0);
    L.push(full(`<rect width="${W}" height="${bgH}" fill="#2A0008"/>`));
    let cx0 = 0;
    for (let i = 0; i < n; i++) {
      const it = order[i], pw = (widths[i] / total) * W, x0 = i === 0 ? 0 : cx0 - ov / 2, x1 = i === n - 1 ? W : cx0 + pw + ov / 2, w = x1 - x0;
      cx0 += pw;
      try {
        let img = await coverPhoto(it.buf, w, bgH, 0.22);
        const pm = await sharp(it.buf).metadata();
        const ratio = pm.width && pm.height ? pm.width / pm.height : 1;
        if (!it.scene && ratio <= (w / (areaH - 24)) * (look.noCut === "whole" ? 1.0 : 0.85)) {   // only when the photo is tall enough to fill the height: a wide photo is cropped instead of shrunk to a strip
          // the whole picture, nothing cropped: fitted into the part the headline panel does not cover, the sides filled with a soft blur of itself
          const back = await sharp(img).blur(18 * S).modulate({ brightness: 0.55 }).png().toBuffer();
          const fh = areaH - 24, fw = Math.min(w, fh * ratio), fhh = Math.min(fh, fw / ratio);
          const fg = await sharp(it.buf).rotate().resize(G(fw), G(fhh), { fit: "fill" }).ensureAlpha().png().toBuffer();
          const fm = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(fw)}" height="${G(fhh)}"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${Math.min(0.3, 40 / fw)}" stop-color="#000"/><stop offset="${1 - Math.min(0.3, 40 / fw)}" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`);
          const fgSoft = await sharp(fg).composite([{ input: fm, blend: "dest-in" }]).png().toBuffer();
          img = await sharp(back).composite([{ input: fgSoft, left: G((w - fw) / 2), top: 0 }]).png().toBuffer();
        }
        const lft = i === 0 ? '<stop offset="0" stop-color="#000"/>' : `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${ov / w}" stop-color="#000"/>`;
        const rgt = i === n - 1 ? '<stop offset="1" stop-color="#000"/>' : `<stop offset="${1 - ov / w}" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/>`;
        const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${G(w)}" height="${G(bgH)}"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="0">${lft}${rgt}</linearGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
        const piece = await sharp(img).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
        L.push({ input: piece, left: G(x0), top: 0 });
        if (!it.scene) L.push(...await nameTag(it.name, x0 + w / 2, areaH - 98));
      } catch { /* a photo that cannot be read is left out */ }
    }
    L.push(full(`<defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E0004" stop-opacity="0"/><stop offset="1" stop-color="#1E0004" stop-opacity=".35"/></linearGradient></defs><rect y="${bgH - 220}" width="${W}" height="220" fill="url(#cf)"/>`));
    return L;
  }
  if (v.scene) {
    L.push({ input: await coverPhoto(v.scene, W, bgH, 0.45), left: 0, top: 0 });
    L.push(full(`<rect width="${W}" height="${bgH}" fill="#280006" fill-opacity=".35"/>`));
  } else {
    let diag = "";
    for (let x = -bgH; x < W; x += 34) diag += `<path d="M${x} 0L${x + bgH} ${bgH}"/>`;
    L.push(full(`<defs><linearGradient id="st" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${bgH}"><stop offset="0" stop-color="#3A0008"/><stop offset=".6" stop-color="#6A0012"/><stop offset="1" stop-color="#24000A"/></linearGradient></defs>
<rect width="${W}" height="${bgH}" fill="url(#st)"/><g stroke="#fff" stroke-width="2" opacity=".07" fill="none">${diag}</g>`));
    if (!v.people.length && !v.flags.length && logo) {
      const n = G(380);
      const lg = await sharp(logo).resize(n, n).ensureAlpha().linear([1, 1, 1, 0.9], [0, 0, 0, 0]).png().toBuffer();
      L.push({ input: lg, left: G((W - 380) / 2), top: G(areaH / 2 - 190 + 40) });
    }
  }
  const flags = v.flags.slice(0, 4);
  if (flags.length) { L.push(...await (look.flagStyle === "blend" || flags.length < 2 ? flagWash : flagCrack)(flags, bgH, rtl, look.flag / 100)); L.push(full(`<rect width="${W}" height="${bgH}" fill="#1E0004" fill-opacity=".22"/>`)); }
  L.push(full(`<defs><radialGradient id="cg" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${areaH * 0.55}" r="${W * 0.7}"><stop offset="0" stop-color="#E2B007" stop-opacity=".18"/><stop offset="1" stop-color="#E2B007" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${bgH}" fill="url(#cg)"/>`));

  const people = v.people.slice(0, 3);
  if (people.length) {
    const n = people.length;
    const slots = n === 1 ? [W / 2] : n === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8];
    const pos = rtl ? [...slots].reverse() : slots;
    for (let i = 0; i < n; i++) {
      const p = people[i], cx = pos[i], k = look.scale / 100;
      try {
        if (look.glow > 0) L.push(full(`<defs><radialGradient id="pw${i}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${areaH * 0.6}" r="${W / n * 0.62}"><stop offset="0" stop-color="#F6D15A" stop-opacity="${(look.glow / 100 * 0.55).toFixed(2)}"/><stop offset="1" stop-color="#F6D15A" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${bgH}" fill="url(#pw${i})"/>`));
        const m = await sharp(p.buf).metadata();
        if (p.cut) {
          const maxH = Math.min(areaH * 0.96, areaH * (n === 1 ? 0.78 : 0.7) * k), maxW = Math.min(W / n * 1.3, W / n * (n === 1 ? 0.8 : 1.05) * k);
          const s = Math.min(maxH / m.height, maxW / m.width), w = m.width * s, h = m.height * s;
          const img = await sharp(p.buf).resize(G(w), G(h)).png().toBuffer();
          const sh = await silhouetteShadow(img, G(w), G(h), 0.55, 15);
          L.push({ input: sh.buf, left: Math.max(0, G(cx - w / 2) - sh.pad), top: Math.max(0, G(areaH - h) - sh.pad + G(10)) });
          L.push({ input: img, left: Math.max(0, G(cx - w / 2)), top: Math.max(0, G(areaH - h)) });
          L.push(...await nameTag(p.name, cx, areaH - 98));
        } else if (look.noCut === "bust") {
          // a photo without a cut-out: keep only a head-and-shoulders shape so the old background is trimmed away
          const bw = Math.min(W / n * 1.1, (n === 1 ? 560 : n === 2 ? 460 : 350) * k), bh = Math.min(areaH * 0.95, bw * 1.25);
          const face = await coverPhoto(p.buf, bw, bh, 0.22);
          const iw = G(bw), ih = G(bh);
          const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}" viewBox="0 0 ${bw} ${bh}"><ellipse cx="${bw * 0.5}" cy="${bh * 0.36}" rx="${bw * 0.33}" ry="${bh * 0.34}" fill="#000"/><rect x="${bw * 0.3}" y="${bh * 0.4}" width="${bw * 0.4}" height="${bh * 0.35}" fill="#000"/><ellipse cx="${bw * 0.5}" cy="${bh * 1.04}" rx="${bw * 0.5}" ry="${bh * 0.42}" fill="#000"/></svg>`;
          const mask = await sharp(Buffer.from(maskSvg)).blur(G(10)).png().toBuffer();
          const shape = await sharp(face).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
          const sh = await silhouetteShadow(shape, iw, ih, 0.55, 15);
          L.push({ input: sh.buf, left: Math.max(0, G(cx - bw / 2) - sh.pad), top: Math.max(0, G(areaH - bh) - sh.pad + G(10)) });
          L.push({ input: shape, left: Math.max(0, G(cx - bw / 2)), top: Math.max(0, G(areaH - bh)) });
          L.push(...await nameTag(p.name, cx, areaH - 98));
        } else if (look.noCut === "fade") {
          // a photo without a cut-out: a soft portrait whose edges melt into the background (no ring, no hard circle)
          const bw = Math.min(W / n * 1.15, (n === 1 ? 620 : n === 2 ? 500 : 380) * k), bh = Math.min(areaH * 0.93, bw * 1.2);
          const face = await coverPhoto(p.buf, bw, bh, 0.25);
          const iw = G(bw), ih = G(bh), rx = G(bw * 0.34);
          const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}"><rect x="${G(bw * 0.12)}" y="${G(bh * 0.06)}" width="${G(bw * 0.76)}" height="${ih + rx}" rx="${rx}" fill="#000"/></svg>`;
          const mask = await sharp(Buffer.from(maskSvg)).blur(G(20)).png().toBuffer();
          const soft = await sharp(face).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
          L.push({ input: soft, left: Math.max(0, G(cx - bw / 2)), top: Math.max(0, G(areaH - bh)) });
          L.push(...await nameTag(p.name, cx, areaH - 98));
        } else {
          const R = n === 1 ? 170 : n === 2 ? 140 : 112, cy = areaH - R - 64;
          L.push(full(`<defs>${shadowF("pr" + i, 0, 26, 0.5)}</defs><circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="#E2B007" filter="url(#pr${i})"/>`));
          const face = await coverPhoto(p.buf, 2 * R, 2 * R, 0.28);
          const round = await sharp(face).composite([{ input: Buffer.from(`<svg width="${G(2 * R)}" height="${G(2 * R)}"><circle cx="${G(R)}" cy="${G(R)}" r="${G(R)}"/></svg>`), blend: "dest-in" }]).png().toBuffer();
          L.push({ input: round, left: Math.max(0, G(cx - R)), top: Math.max(0, G(cy - R)) });
          L.push(...await nameTag(p.name, cx, cy + R + 22));
        }
      } catch { /* a person whose picture cannot be read is left out */ }
    }
  }
  L.push(full(`<defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E0004" stop-opacity="0"/><stop offset="1" stop-color="#1E0004" stop-opacity=".3"/></linearGradient></defs><rect y="${bgH - 200}" width="${W}" height="200" fill="url(#cf)"/>`));
  return L;
}

// ---------------------------------------------------------------- the two designs
/** Photo card: big photo, section badge with date, maroon panel with the headline, footer band. */
async function photoCard({ lang, text, label, category, photo, collage, A, look }) {
  const ur = lang === "ur";
  const footH = 166, photoH = 760;
  const cityName = detectCity(text, ur), headline = stripCity(text, cityName);
  const L = [];                                                       // layers, bottom to top
  if (collage) L.push(...await collageTop(collage, { areaH: photoH - 50, bgH: photoH + 40, rtl: ur, logo: A.logo, look }));
  else L.push({ input: await coverPhoto(photo, W, photoH + 40), left: 0, top: 0 });
  L.push(full(`<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
<rect width="${W}" height="200" fill="url(#t)"/>${collage ? "" : `<rect y="${photoH - 260}" width="${W}" height="300" fill="url(#b)"/>`}`));

  const panelLook = !!collage && collage.people?.length >= 2 && look.panels !== false && collage.people.slice(0, look.maxPics || 2).length >= 2 && collage.people.slice(0, look.maxPics || 2).every((p) => !p.cut);
  if (panelLook && !["hide", "left", "right"].includes(look.badge)) look = { ...look, badge: "center" };   // two-people look: the badge sits in the middle at the top
  if (category && look.badge !== "hide") {
    const dp = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: TZ }).formatToParts(new Date());
    const pv = (t) => dp.find((x) => x.type === t)?.value || "";
    const dt = `${pv("day")} ${pv("month")} ${pv("year")}`.toUpperCase();
    const catShown = cityName && cityName !== category ? `${category} | ${cityName}` : category;
    const catImg = ur ? await tx(catShown, { fam: "PDAslam", size: 38, rtl: true }) : await tx(catShown, { fam: "DejaVu Sans Bold", size: 27 });
    const dateImg = await tx(dt, { fam: "DejaVu Sans Bold", size: 16, color: "#F6D15A", ls: 1.5 });
    const bw = Math.max(catImg.w + 56, dateImg.w + 44), bh = ur ? 98 : 86, right = look.badge === "right" || (look.badge !== "left" && look.badge !== "center" && ur), bx = look.badge === "center" ? (W - bw) / 2 : right ? W - 40 - bw : 40, by = 36, mx = bx + bw / 2, ly = by + bh - 34;
    L.push(full(`<defs>${GLOSS}${shadowF("bs", 5, 18, 0.5)}<clipPath id="bc">${rr(bx + 3, by + 3, bw - 6, bh - 6, 19, "")}</clipPath></defs>
${rr(bx, by, bw, bh, 22, 'fill="#fff" filter="url(#bs)"')}
<g clip-path="url(#bc)"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#gl)"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh / 2}" fill="url(#sheen)"/></g>
${rr(bx + 7, by + 7, bw - 14, bh - 14, 15, 'fill="none" stroke="#F6D15A" stroke-opacity=".85" stroke-width="2"')}
<rect x="${bx + 22}" y="${ly}" width="${bw / 2 - 34}" height="2" fill="#F6D15A" fill-opacity=".8"/><rect x="${mx + 12}" y="${ly}" width="${bw / 2 - 34}" height="2" fill="#F6D15A" fill-opacity=".8"/>${diamond(mx, ly + 1, 5, "#F6D15A")}`));
    if (ur) { for (const ox of [-0.8, 0, 0.8]) L.push(place(catImg, mx + ox, by + 40)); }
    else L.push(place(catImg, mx, by + 33));
    L.push(place(dateImg, mx + 1, by + bh - 15));
  }

  const cardY = photoH - 50, cardH = H - cardY;
  let diag = "";
  for (let x = -cardH; x < W; x += 36) diag += `<path d="M${x} ${cardY}L${x + cardH} ${cardY + cardH}"/>`;
  L.push(full(`<defs>${shadowF("ps2", -8, 34, 0.4)}
<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A0B0B"/><stop offset=".45" stop-color="#6E0000"/><stop offset="1" stop-color="#3E0000"/></linearGradient>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="gw" gradientUnits="userSpaceOnUse" cx="${W / 2}" cy="${cardY + cardH * 0.45}" r="${W * 0.6}"><stop offset="0" stop-color="#E2B007" stop-opacity=".16"/><stop offset="1" stop-color="#E2B007" stop-opacity="0"/></radialGradient>
<clipPath id="pc">${rr(24, cardY, W - 48, cardH, 34, "")}</clipPath></defs>
${rr(24, cardY, W - 48, cardH, 34, 'fill="url(#pg)" filter="url(#ps2)"')}
<g clip-path="url(#pc)"><rect x="24" y="${cardY}" width="${W - 48}" height="150" fill="url(#sh)"/><rect x="24" y="${cardY}" width="${W - 48}" height="${cardH}" fill="url(#gw)"/>
<g stroke="#fff" stroke-width="2" opacity=".05" fill="none">${diag}</g></g>
${rr(36, cardY + 12, W - 72, cardH - 24, 26, 'fill="none" stroke="#F3D36B" stroke-opacity=".55" stroke-width="2"')}`));

  {
    const lab = ur ? await tx(label, { fam: "PDNoori", size: 42, color: "#3A0000", rtl: true }) : await tx(label, { fam: "DejaVu Sans Bold", size: 30, color: "#3A0000" });
    const bw = lab.w + 110, bh = ur ? 78 : 62, cx = W / 2, cy = cardY + 4, x = cx - bw / 2, y = cy - bh / 2;
    L.push(full(`<defs>${shadowF("ls", 5, 16, 0.45)}<linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBE48A"/><stop offset=".5" stop-color="#E8B80F"/><stop offset="1" stop-color="#B98800"/></linearGradient></defs>
${rr(x, y, bw, bh, bh / 2, 'fill="#fff" filter="url(#ls)"')}${rr(x + 4, y + 4, bw - 8, bh - 8, (bh - 8) / 2, 'fill="url(#gd)"')}${diamond(x + 34, cy, 7, "#5A0000")}${diamond(x + bw - 34, cy, 7, "#5A0000")}`));
    L.push(place(lab, cx, cy + (ur ? 4 : 1)));
  }

  const bandTop = H - Math.round(footH * 95 / 166);
  const bottom = bandTop - Math.round(Math.round(footH * 0.155) * 1.75) - 36;
  const topY = cardY + 50, avail = bottom - topY;
  const fam = ur ? "PDNoori" : "DejaVu Sans Bold", sp = ur ? 1.7 : 1;
  const m = measurer(fam, ur), space = ur ? (await m.spaceUnit()) * sp : 0.28;
  const r = await fitTwo(headline, m, space, { maxW: W - 150, max: ur ? 100 : 92, min: ur ? 38 : 34 });
  const lh = ur ? r.fs * 1.58 : r.fs * 1.16, blockH = r.lines.length * lh;
  const y0 = topY + Math.max(0, (avail - blockH) / 2) + lh / 2;
  L.push(...await textLayers(r.lines, { fam, fs: r.fs, rtl: ur, cx: W / 2, y0, lh, color: "#FFFFFF", hiColor: "#F6D15A", bold: ur, shadow: true, space, dy: ur ? 6 : 0 }));

  L.push({ input: await sharp(A.foot).extract({ left: 215, top: 0, width: 865, height: 166 }).resize(G(865), G(166)).png().toBuffer(), left: G(215), top: G(H - footH) });
  L.push({ input: await sharp(A.foot).extract({ left: 215, top: 72, width: 20, height: 94 }).resize(G(217), G(94), { fit: "fill" }).png().toBuffer(), left: 0, top: G(H - footH + 72) });
  const LS = Math.round(W * 0.135);
  L.push(...await logoLayers(A.logo, H - LS - Math.round(W * 0.012), LS));
  L.push(...await websitePill(bandTop));
  return { base: { r: 255, g: 255, b: 255 }, layers: L };
}

/** Channel-frame card (no fitting photo): the Pak Dharti background, a white plate with the headline, footer. */
async function frameCard({ lang, text, label, A }) {
  const ur = lang === "ur";
  const footH = 166, areaH = H - footH;
  const L = [];
  L.push({ input: await coverPhoto(A.top, W, areaH + 30, 0.5), left: 0, top: 0 });
  const top = 70, bottom = areaH - 60, room = bottom - (top + 100);
  const fam = ur ? "PDNoori" : "DejaVu Sans Bold", sp = 1;
  const m = measurer(fam, ur), space = ur ? (await m.spaceUnit()) * sp : 0.28;
  await m.ensure(text);
  const r = fitLines(tokens(text), W - 160, space, m.wOf, { maxLines: Math.max(2, Math.floor(room / (ur ? 105 : 80))), max: ur ? 84 : 80, min: ur ? 40 : 36 });
  const lh = ur ? r.fs * 1.6 : r.fs * 1.16, blockH = r.lines.length * lh;
  const y0 = top + 100 + Math.max(0, (room - blockH) / 2) + lh / 2;
  const lab = ur ? await tx(label, { fam: "PDNoori", size: 38, color: "#FFFFFF", rtl: true }) : await tx(label, { fam: "DejaVu Sans Bold", size: 28, color: "#FFFFFF" });
  const lw = lab.w + 64, lhh = ur ? 70 : 58, lcy = top + 46;
  L.push(full(`${rr(W / 2 - lw / 2, lcy - lhh / 2, lw, lhh, 6, `fill="${MAROON}"`)}
${rr(40, y0 - lh / 2 - 18, W - 80, blockH + 36, 18, 'fill="#fff" fill-opacity=".72"')}<rect x="${W / 2 - 60}" y="${y0 - lh / 2 - 18}" width="120" height="5" fill="${MAROON}"/>`));
  L.push(place(lab, W / 2, lcy + (ur ? 4 : 1)));
  L.push(...await textLayers(r.lines, { fam, fs: r.fs, rtl: ur, cx: W / 2, y0, lh, color: "#141414", hiColor: MAROON, bold: ur, shadow: false, space, dy: ur ? 6 : 0 }));
  const date = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).format(new Date());
  L.push(place(await tx(date, { fam: "DejaVu Sans Bold", size: 24, color: "#7A7A7A" }), W / 2, areaH - 26));
  L.push({ input: await sharp(A.footJpg).resize(G(W), G(footH), { fit: "fill" }).png().toBuffer(), left: 0, top: G(H - footH) });
  const url = await tx(SITE_URL, { fam: "DejaVu Sans Bold", size: Math.round(footH * 0.17), color: "#8B0000" });
  L.push({ input: url.buf, left: Math.round((W - Math.round(W * 0.04) - url.w) * S), top: Math.round((H - footH + Math.round(footH * 0.2) - url.h / 2) * S) });
  return { base: { r: 247, g: 247, b: 247 }, layers: L };
}

/**
 * { lang, title, category, label?, photo?: Buffer, origin } → JPEG buffer (1440 x 1800).
 * A story photo gives the photo card; without one the channel-frame card is used.
 */
export async function renderNewsCard({ lang = "ur", title, category = "", label, photo = null, collage = null, origin, look = null }) {
  await loadSharp();
  const hasCollage = !!collage;
  await ensureFonts(origin, ["PDNoori", "PDAslam", "DejaVu Sans Bold"]);
  const A = await loadAssets(origin);
  const text = autoHighlight(String(title || "").trim());
  const l = lang === "ur" ? "ur" : "en";
  // no photo and no collage pieces: the maroon stage with the channel logo (never a bare white frame)
  const top = hasCollage ? collage : photo ? null : { scene: null, flags: [], people: [] };
  const o = { lang: l, text, label: label || LABELS[l][0], category, photo, collage: top, A, look: { ...(await getCardLook()), ...(look || {}) } };
  const { base, layers } = await photoCard(o);
  return sharp({ create: { width: G(W), height: G(H), channels: 3, background: base } })
    .composite(layers).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
