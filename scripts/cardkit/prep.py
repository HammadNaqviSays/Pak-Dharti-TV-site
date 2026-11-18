import re, os, shutil
R="/home/claude/pak-dharti-tv"
os.makedirs("lib",exist_ok=True)
for f in ["dailyCards","newsCard","collageCard","flags","prayTimes","mandiItems","asOf"]:
    s=open(f"{R}/lib/{f}.js").read()
    s=re.sub(r'from "(\./[A-Za-z]+)"', r'from "\1.js"', s)
    if f=="dailyCards":
        # frame: drop dynamic date lines
        a=s.index("  // date line"); b=s.index("  return ry + rh + 120;")
        s=s[:a]+s[b:]
        s=s.replace("function statusPill(ctx, text, y) {","function statusPill(ctx, text, y) { return;")
        s=s.replace("function la(ctx, A, text, x, y, size, color = INK, align = \"left\", weight = 800) {","function la(ctx, A, text, x, y, size, color = INK, align = \"left\", weight = 800) { return;")
        # fuel note constant
        s=s.replace("`ماخذ: ${fuel.source || \"خبری رپورٹس\"} — حکومتی اعلان کے مطابق`","\"حکومتی اعلان کے مطابق\"")
        # kse: drop dynamic hero texts
        s=re.sub(r'  ur\(ctx, kse\.live \?.*\n','',s)
        s=re.sub(r'    ur\(ctx, up \? \(isToday.*\n','',s)

        # --- round 3: tighter words, bigger titles, no gold bar on kse/prayer, prayer columns, tag centring
        s=s.replace("ctx.imageSmoothingQuality = \"high\";","ctx.imageSmoothingQuality = \"high\"; ctx.wordSpacing = \"-4px\";")
        s=s.replace("ctx.fillStyle = \"#fff\"; ctx.font = `68px ${NOORI}`;","ctx.fillStyle = \"#fff\"; ctx.font = `72px ${NOORI}`; ctx.wordSpacing = \"-12px\";")
        s=s.replace("ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 90, ry + rh - 10, 180, 5);","if (!window.__noBar) { ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 90, ry + rh - 10, 180, 5); }")
        s=s.replace("labelW = 330;","labelW = 285;")
        s=s.replace("ctx.strokeText(title, W / 2, ry + rh / 2 + 6);","ctx.strokeText(title, W / 2, ry + rh / 2 + 6); ctx.wordSpacing = \"-4px\";")
        s=s.replace("ctx.font = `38px ${NOORI}`; ctx.fillStyle = INK;\n    ctx.fillText(row.label","ctx.font = `36px ${NOORI}`; ctx.fillStyle = INK;\n    ctx.fillText(row.label")
        s=s.replace("roundRect(ctx, tx, cy - 18, tw, 38, 8)","roundRect(ctx, tx, cy - 23, tw, 47, 10)")
        s=s.replace("ctx.fillText(row.tag, tx + tw / 2, cy + 3);","ctx.fillText(row.tag, tx + tw / 2, cy + 9);")
        s=s.replace("const ph = rows.length * rh + 70;\n  panel(ctx, px, y, pw, ph);","const ph = rows.length * rh + 70;\n  panel(ctx, px, y, pw, ph);\n  ctx.fillStyle = \"rgba(184,137,27,.55)\"; ctx.fillRect(right - labelW + 16, y + 58, 2, ph - 72);")
        s=s.replace("ry + rh / 2 + 6","ry + rh / 2 + 18")
        # bolder, darker text: notes + every Urdu line get a stroke
        s=s.replace('ctx.fillStyle = MUTED; ctx.font = `26px ${NOORI}`;\n  ctx.fillText(text, W / 2, y);','ctx.fillStyle = "#1A1A1A"; ctx.font = `28px ${NOORI}`;\n  ctx.fillText(text, W / 2, y); ctx.strokeStyle = "#1A1A1A"; ctx.lineWidth = 0.9; ctx.strokeText(text, W / 2, y);')
        s=s.replace('if (stroke) { ctx.strokeStyle = color; ctx.lineWidth = stroke;','{ ctx.strokeStyle = color; ctx.lineWidth = stroke || 0.7;')
    open(f"lib/{f}.js","w").write(s)
for d in ["brand","fonts"]:
    if not os.path.exists(d): os.symlink(f"{R}/public/{d}",d)
