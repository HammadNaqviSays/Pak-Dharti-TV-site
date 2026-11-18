// Small, simplified national flags drawn on a canvas (emoji flags do not show on Windows).
// drawFlag(ctx, code, x, y, w, h) — code is the currency code.

function star(ctx, cx, cy, r, points = 5, inner = 0.4, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = rot + (Math.PI / points) * i;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
}
const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

function unionJack(ctx, x, y, w, h) {
  rect(ctx, "#012169", x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#fff"; ctx.lineWidth = h * 0.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
  ctx.strokeStyle = "#C8102E"; ctx.lineWidth = h * 0.07;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
  rect(ctx, "#fff", x + w / 2 - h * 0.17, y, h * 0.34, h); rect(ctx, "#fff", x, y + h / 2 - h * 0.17, w, h * 0.34);
  rect(ctx, "#C8102E", x + w / 2 - h * 0.1, y, h * 0.2, h); rect(ctx, "#C8102E", x, y + h / 2 - h * 0.1, w, h * 0.2);
  ctx.restore();
}

const FLAGS = {
  USD(ctx, x, y, w, h) {
    for (let i = 0; i < 13; i++) rect(ctx, i % 2 ? "#fff" : "#B22234", x, y + (h / 13) * i, w, h / 13 + 0.5);
    rect(ctx, "#3C3B6E", x, y, w * 0.42, h * 7 / 13);
    ctx.fillStyle = "#fff";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) star(ctx, x + w * 0.06 + c * w * 0.1, y + h * 0.09 + r * h * 0.17, h * 0.045);
  },
  EUR(ctx, x, y, w, h) {
    rect(ctx, "#003399", x, y, w, h); ctx.fillStyle = "#FFCC00";
    for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 * i) / 12; star(ctx, x + w / 2 + Math.cos(a) * h * 0.32, y + h / 2 + Math.sin(a) * h * 0.32, h * 0.06); }
  },
  GBP: unionJack,
  SAR(ctx, x, y, w, h) {
    rect(ctx, "#006C35", x, y, w, h);
    ctx.fillStyle = "#fff"; ctx.fillRect(x + w * 0.22, y + h * 0.3, w * 0.56, h * 0.12);
    ctx.fillRect(x + w * 0.25, y + h * 0.66, w * 0.5, h * 0.06);
  },
  AED(ctx, x, y, w, h) {
    rect(ctx, "#00732F", x, y, w, h / 3); rect(ctx, "#fff", x, y + h / 3, w, h / 3); rect(ctx, "#000", x, y + (2 * h) / 3, w, h / 3 + 0.5);
    rect(ctx, "#FF0000", x, y, w * 0.26, h);
  },
  QAR(ctx, x, y, w, h) {
    rect(ctx, "#8A1538", x, y, w, h); ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(x, y);
    const n = 9, bx = x + w * 0.3, s = h / n;
    for (let i = 0; i < n; i++) { ctx.lineTo(bx, y + s * i); ctx.lineTo(bx + w * 0.1, y + s * i + s / 2); }
    ctx.lineTo(bx, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  },
  KWD(ctx, x, y, w, h) {
    rect(ctx, "#007A3D", x, y, w, h / 3); rect(ctx, "#fff", x, y + h / 3, w, h / 3); rect(ctx, "#CE1126", x, y + (2 * h) / 3, w, h / 3 + 0.5);
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.25, y + h / 3); ctx.lineTo(x + w * 0.25, y + (2 * h) / 3); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  },
  OMR(ctx, x, y, w, h) {
    rect(ctx, "#DB161B", x, y, w, h); rect(ctx, "#fff", x + w * 0.3, y, w * 0.7, h / 3); rect(ctx, "#008000", x + w * 0.3, y + (2 * h) / 3, w * 0.7, h / 3 + 0.5);
  },
  BHD(ctx, x, y, w, h) {
    rect(ctx, "#CE1126", x, y, w, h); ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(x, y);
    const n = 5, bx = x + w * 0.25, s = h / n;
    for (let i = 0; i < n; i++) { ctx.lineTo(bx, y + s * i); ctx.lineTo(bx + w * 0.12, y + s * i + s / 2); }
    ctx.lineTo(bx, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  },
  CAD(ctx, x, y, w, h) {
    rect(ctx, "#fff", x, y, w, h); rect(ctx, "#D52B1E", x, y, w * 0.25, h); rect(ctx, "#D52B1E", x + w * 0.75, y, w * 0.25, h);
    ctx.fillStyle = "#D52B1E"; star(ctx, x + w / 2, y + h * 0.48, h * 0.3, 7, 0.55);
    ctx.fillRect(x + w / 2 - 1.5, y + h * 0.6, 3, h * 0.25);
  },
  AUD(ctx, x, y, w, h) {
    rect(ctx, "#012169", x, y, w, h); unionJack(ctx, x, y, w / 2, h / 2);
    ctx.fillStyle = "#fff"; star(ctx, x + w * 0.25, y + h * 0.75, h * 0.12, 7, 0.5);
    [[0.75, 0.25], [0.62, 0.5], [0.88, 0.45], [0.75, 0.82]].forEach(([a, b]) => star(ctx, x + w * a, y + h * b, h * 0.07, 7, 0.5));
  },
  CNY(ctx, x, y, w, h) {
    rect(ctx, "#DE2910", x, y, w, h); ctx.fillStyle = "#FFDE00";
    star(ctx, x + w * 0.17, y + h * 0.27, h * 0.15);
    [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]].forEach(([a, b]) => star(ctx, x + w * a, y + h * b, h * 0.05));
  },
};

export function drawFlag(ctx, code, x, y, w, h) {
  const f = FLAGS[code];
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 5) : ctx.rect(x, y, w, h); ctx.clip();
  if (f) f(ctx, x, y, w, h); else rect(ctx, "#999", x, y, w, h);
  ctx.restore();
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 5) : ctx.rect(x, y, w, h); ctx.stroke(); ctx.restore();
}
