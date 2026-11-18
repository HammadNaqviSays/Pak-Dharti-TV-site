// Top half of the "collage" news card: a photo of the place (UN, parliament, a capital ...), waving flags of the
// countries / bodies in the story, and the people in it as cut-outs (or round portraits when no cut-out exists).
// Only real, licensed photos are used; the composition is ours.
import { NOORI, MAROON, GOLD, cover, roundRect, gloss } from "./newsCard";

export function wavingFlag(ctx, src, x, y, w, h, phase0 = 0) {
  // SVG flags often have no intrinsic size: draw them once onto a canvas, then slice that
  const img = document.createElement("canvas");
  img.width = 640; img.height = Math.round(640 * h / w);
  img.getContext("2d").drawImage(src, 0, 0, img.width, img.height);
  const strips = 48, sw = w / strips;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  for (let i = 0; i < strips; i++) {
    const t = i / strips, ph = phase0 + t * Math.PI * 1.8;
    const dy = Math.sin(ph) * h * 0.07 * (0.3 + t);
    ctx.drawImage(img, t * img.width, 0, img.width / strips + 1, img.height, x + i * sw, y + dy, sw + 1.6, h);
  }
  ctx.shadowColor = "transparent";
  for (let i = 0; i < strips; i++) {
    const t = i / strips, ph = phase0 + t * Math.PI * 1.8;
    const dy = Math.sin(ph) * h * 0.07 * (0.3 + t), c = Math.cos(ph);
    ctx.fillStyle = c > 0 ? `rgba(255,255,255,${0.16 * c})` : `rgba(0,0,0,${0.22 * -c})`;
    ctx.fillRect(x + i * sw, y + dy, sw + 1.6, h);
  }
  ctx.restore();
}

function nameTag(ctx, text, cx, y, latin, k = 1, box = false) {
  if (!text) return;
  const ur = /[؀-ۿ]/.test(text);
  if (box) {                       // panel layout: a small maroon label with a gold edge, like the Pak Dharti reference card
    ctx.font = ur ? `${Math.round(36 * k)}px ${NOORI}` : `800 ${Math.round(26 * k)}px ${latin}`; ctx.direction = ur ? "rtl" : "ltr";
    const w = ctx.measureText(text).width + 44 * k, h = (ur ? 58 : 46) * k;
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(76,0,0,.92)"; roundRect(ctx, cx - w / 2, y - h / 2, w, h, 6 * k); ctx.fill(); ctx.restore();
    ctx.fillStyle = GOLD; ctx.fillRect(cx - w / 2, y + h / 2 - 4 * k, w, 4 * k);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, cx, y + (ur ? 2 : 0) - 2 * k);
    return;
  }
  ctx.font = ur ? `${Math.round(34 * k)}px ${NOORI}` : `800 ${Math.round(24 * k)}px ${latin}`; ctx.direction = ur ? "rtl" : "ltr";
  const w = ctx.measureText(text).width + 40 * k, h = (ur ? 54 : 44) * k;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 10;
  roundRect(ctx, cx - w / 2, y - h / 2, w, h, h / 2); ctx.clip(); gloss(ctx, cx - w / 2, y - h / 2, w, h); ctx.restore();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + (ur ? 4 : 1));
}

/**
 * v: { scene: Image|null, flags: [Image], people: [{ img: Image, cut: bool, name }] }
 * Draws into the box (0,0)-(W,areaH). Leaves the top 150px for the logo and section chip.
 */
export function drawCollageTop(ctx, W, areaH, v, { latin, rtl, bgH = areaH }) {
  // nothing of the picture may go below the top line of the red panel (areaH): a photo that was zoomed or slid down is cut there
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, areaH + 12); ctx.clip();
  // background: place photo or brand stage
  if (v.scene) {
    cover(ctx, v.scene, 0, 0, W, bgH, 0.45);
    ctx.fillStyle = "rgba(40,0,6,.35)"; ctx.fillRect(0, 0, W, bgH);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, bgH);
    g.addColorStop(0, "#3A0008"); g.addColorStop(0.6, "#6A0012"); g.addColorStop(1, "#24000A");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, bgH);
    ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    for (let x = -bgH; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + bgH, bgH); ctx.stroke(); }
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(W / 2, areaH * 0.55, 30, W / 2, areaH * 0.55, W * 0.7);
  glow.addColorStop(0, "rgba(226,176,7,.18)"); glow.addColorStop(1, "rgba(226,176,7,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, areaH);

  const people = (v.people || []).slice(0, 3);
  const flags = (v.flags || []).slice(0, 4);
  const n = people.length;
  v.boxes = []; v.areaH = areaH; const tags = [];                       // where each person was drawn: the editor uses it to pick a person with the mouse

  // panels ("darar"): with several people the picture can be split into panels with a gap between them
  // layout "split" (the default for 2-3 people): every person fills a panel of the picture, thin white gap between panels
  const split = n > 1 && v.layout !== "circles";
  const dv = n > 1 ? (v.divider ? (v.divider.on ? v.divider : null) : split ? { on: true, w: 8, slant: 10, color: "#E2B007" } : null) : null;
  const gapW = dv ? Number(dv.w ?? 10) : 0, slant = dv ? Number(dv.slant ?? 0) : 0;
  // where the gaps between the panels are (fractions of the width, left to right); the editor can move them: divider.cuts
  const cuts = Array.isArray(v.divider?.cuts) ? v.divider.cuts : [];
  const edge = (b) => (b <= 0 ? 0 : b >= n ? W : (Number(cuts[b - 1]) > 0 ? Number(cuts[b - 1]) : b / n) * W);
  const slotX = n === 1 ? [W / 2] : split ? Array.from({ length: n }, (_, i) => (edge(i) + edge(i + 1)) / 2) : n === 2 ? [W * 0.27, W * 0.73] : [W * 0.2, W * 0.5, W * 0.8];
  const pos = rtl ? [...slotX].reverse() : slotX;      // the main person stands on the reading-start side
  const slotOf = (i) => (rtl ? n - 1 - i : i);          // the visual slot, left to right
  const panelPath = (s) => {
    const first = s === 0, last = s === n - 1;
    const l = first ? -60 : edge(s), r = last ? W + 60 : edge(s + 1);
    ctx.beginPath();
    ctx.moveTo(l + (first ? 0 : slant), 0); ctx.lineTo(r + (last ? 0 : slant), 0);
    ctx.lineTo(r - (last ? 0 : slant), bgH); ctx.lineTo(l - (first ? 0 : slant), bgH); ctx.closePath();
  };

  // flags: either a row under the top bar (larger when there are no people), or (countries / tournaments) big and faded behind each person
  const behind = v.flagMode === "behind" && flags.length && n;
  if (behind) {
    flags.slice(0, n).forEach((src, i) => {
      const fc = document.createElement("canvas"); fc.width = 960; fc.height = 640;
      fc.getContext("2d").drawImage(src, 0, 0, fc.width, fc.height);
      ctx.save();
      if (n > 1) panelPath(slotOf(i)); else { ctx.beginPath(); ctx.rect(0, 0, W, bgH); }
      ctx.clip();
      ctx.globalAlpha = Math.min(1, Math.max(0.1, Number(v.flagAlpha ?? 0.4)));
      const l = n > 1 ? (slotOf(i) === 0 ? 0 : edge(slotOf(i))) : 0, r = n > 1 ? (slotOf(i) === n - 1 ? W : edge(slotOf(i) + 1)) : W;
      cover(ctx, fc, l - slant, 0, r - l + 2 * slant, bgH, 0.5);
      ctx.restore();
    });
  } else if (flags.length) {
    const fw = people.length ? (flags.length > 2 ? 150 : 180) : (flags.length > 2 ? 210 : 260);
    const fh = fw * 0.66, gap = people.length ? 26 : 40;
    const total = flags.length * fw + (flags.length - 1) * gap;
    const fy = people.length ? 160 : areaH / 2 - fh / 2 + 30;
    let fx = W / 2 - total / 2;
    const order = rtl ? [...flags].reverse() : flags;   // the first flag on the reading-start side
    order.forEach((img, i) => { wavingFlag(ctx, img, fx, fy, fw, fh, i * 0.9); fx += fw + gap; });
  }

  // people (the editor can move, resize and reorder each one: p.lay = { dx, dy, sc, z })
  if (n) {
    const order = people.map((_, i) => i).sort((a, b) => (people[a].lay?.z ?? a) - (people[b].lay?.z ?? b));
    for (const i of order) {
      const p = people[i], L = p.lay || {};
      const sc = Number(L.sc) > 0 ? Number(L.sc) : 1, dy = (Number(L.dy) || 0) * areaH;
      const cx = pos[i] + (Number(L.dx) || 0) * W;
      ctx.save();
      if (dv) { panelPath(slotOf(i)); ctx.clip(); }
      const flipped = !!L.flip;
      const withFlip = (fn) => { ctx.save(); if (flipped) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); } fn(); ctx.restore(); };
      if (split && !p.cut) {
        // the whole panel is the photo (cut to fit, face kept near the top); the editor's size / position still apply
        const s0 = slotOf(i), l = s0 === 0 ? 0 : edge(s0), r = s0 === n - 1 ? W : edge(s0 + 1), pw = r - l + 2 * slant + 4;
        // the WHOLE photo stays behind the panel: it is not cut to the panel's shape. Size zooms it, Left/Right and Up/Down slide it,
        // and the panel (with the yellow gap drawn over its edge) only decides how much of it is seen.
        const iw = p.img.naturalWidth || p.img.width, ih = p.img.naturalHeight || p.img.height;
        const base = Math.max(pw / iw, bgH / ih), w = iw * base * sc, h = ih * base * sc;
        withFlip(() => ctx.drawImage(p.img, cx - w / 2, (bgH - h) * 0.22 + dy, w, h));
        v.boxes.push({ idx: p.idx ?? i, x: l, y: 0, w: r - l, h: areaH });
      } else if (p.cut) {
        const maxH = areaH * (n === 1 ? 0.78 : 0.7), maxW = W / n * (n === 1 ? 0.8 : 1.05);
        const s = Math.min(maxH / p.img.height, maxW / p.img.width) * sc;
        const w = p.img.width * s, h = p.img.height * s;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 30; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 10;
        withFlip(() => ctx.drawImage(p.img, cx - w / 2, areaH - h + dy, w, h)); ctx.restore();
                v.boxes.push({ idx: p.idx ?? i, x: cx - w / 2, y: areaH - h + dy, w, h });
      } else if (L.shape === "open") {
        // "open": the whole photo as it is (no circle, no gold ring); the size is set with the Size slider
        const maxH = areaH * (n === 1 ? 0.74 : 0.6), maxW = W / n * (n === 1 ? 0.8 : 0.96);
        const s = Math.min(maxH / p.img.height, maxW / p.img.width) * sc;
        const w = p.img.width * s, h = p.img.height * s, y0 = areaH - h - 30 + dy;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
        withFlip(() => ctx.drawImage(p.img, cx - w / 2, y0, w, h)); ctx.restore();
                v.boxes.push({ idx: p.idx ?? i, x: cx - w / 2, y: y0, w, h });
      } else {
        const R = (n === 1 ? 170 : n === 2 ? 140 : 112) * sc, cy = areaH - R - 64 + dy;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fillStyle = GOLD; ctx.fill(); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
        withFlip(() => cover(ctx, p.img, cx - R, cy - R, 2 * R, 2 * R, 0.28)); ctx.restore();
                v.boxes.push({ idx: p.idx ?? i, x: cx - R, y: cy - R, w: 2 * R, h: 2 * R });
      }
      ctx.restore();
      // the name sits in the middle of the person's own area, at the bottom (the editor can hide it or move it)
      if (!L.nameOff && p.name) tags.push([p.name, pos[i] + (Number(L.nx) || 0) * W, areaH - (split ? 34 : 48) + (Number(L.ny) || 0) * areaH, Number(L.ns) > 0 ? Number(L.ns) : 1]);
    }
    for (const [t, tx, ty, tk] of tags) nameTag(ctx, t, tx, ty, latin, tk, split);
  }
  // the gaps between the panels
  if (dv && gapW > 0) {
    for (let b = 1; b < n; b++) {
      ctx.save(); ctx.strokeStyle = dv.color || "#FFFFFF"; ctx.lineWidth = gapW; ctx.lineCap = "butt";
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(edge(b) + slant, 0); ctx.lineTo(edge(b) - slant, bgH); ctx.stroke(); ctx.restore();
    }
  }
  // fade into the white card
  const f = ctx.createLinearGradient(0, areaH - 200, 0, areaH + 12);
  f.addColorStop(0, "rgba(0,0,0,0)"); f.addColorStop(1, "rgba(30,0,4,.3)");
  ctx.fillStyle = f; ctx.fillRect(0, areaH - 200, W, 212);
  ctx.restore();
  void MAROON;
}
