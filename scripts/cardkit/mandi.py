# Draws the mandi card in a real browser (the card code is canvas code) from /tmp/mandi.json -> /tmp/mandi.png
import re, os, json, base64, subprocess, time
R = os.getcwd()
W = "/tmp/mandikit"; os.makedirs(f"{W}/lib", exist_ok=True)
for f in ["dailyCards", "newsCard", "collageCard", "flags", "prayTimes", "mandiItems", "asOf"]:
    s = open(f"{R}/lib/{f}.js").read()
    s = re.sub(r'from "(\./[A-Za-z]+)"', r'from "\1.js"', s)
    open(f"{W}/lib/{f}.js", "w").write(s)
for d in ["brand", "fonts"]:
    if not os.path.exists(f"{W}/{d}"): os.symlink(f"{R}/public/{d}", f"{W}/{d}")
open(f"{W}/page.html", "w").write(open(f"{R}/scripts/cardkit/page.html").read())
data = json.load(open("/tmp/mandi.json"))["data"]
srv = subprocess.Popen(["python3", "-m", "http.server", "8766"], cwd=W, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    try: b = p.chromium.launch(channel="chrome")   # the Chrome already on the GitHub machine: nothing to download
    except Exception: b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1900})
    pg.on("pageerror", lambda e: print("ERR", e))
    pg.goto("http://localhost:8766/page.html")
    url = pg.evaluate("""async (data)=>{
      const m=await import('/lib/dailyCards.js');
      const def=m.CARD_DEFS.find(d=>d.key==='mandi');
      await document.fonts.load('60px "Jameel Noori Nastaleeq"','منڈی کے تھوک نرخ');
      const c=document.createElement('canvas'); await m.drawDailyCard(c,def,{mandi:data}); return c.toDataURL('image/png');}""", data)
    open("/tmp/mandi.png", "wb").write(base64.b64decode(url.split(",")[1]))
    b.close()
srv.terminate(); print("mandi card drawn", os.path.getsize("/tmp/mandi.png"))
