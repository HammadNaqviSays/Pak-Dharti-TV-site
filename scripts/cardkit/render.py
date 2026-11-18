import json, base64, io, os, subprocess, time, sys
from playwright.sync_api import sync_playwright
from PIL import Image
OUT="/home/claude/pak-dharti-tv/public/cardkit"; os.makedirs(OUT,exist_ok=True)
srv=subprocess.Popen(["python3","-m","http.server","8765"],cwd=os.getcwd(),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
FX=[("USD","امریکی ڈالر"),("EUR","یورو"),("GBP","برطانوی پاؤنڈ"),("SAR","سعودی ریال"),("AED","اماراتی درہم"),("QAR","قطری ریال"),("KWD","کویتی دینار"),("OMR","عمانی ریال"),("BHD","بحرینی دینار"),("CAD","کینیڈین ڈالر"),("AUD","آسٹریلین ڈالر"),("CNY","چینی یوآن")]
fx=[{"code":c,"ur":u,"pkr":1} for c,u in FX]
kse=lambda ch:{"change":ch,"pct":1,"close":1,"open":1,"high":1,"low":1,"prevClose":1,"day":"2026-01-01","live":False}
CARDS={
 "currency":{"fx":fx},
 "gold_sarafa":("gold",{"gold":{"tola24":1,"tola22":1,"tola21":1,"tola18":1,"tenGram24":1,"source":"sarafa"},"silver":{"tola":1,"gram":1}}),
 "gold_intl":("gold",{"gold":{"tola24":1,"tola22":1,"tola21":1,"tola18":1,"tenGram24":1,"source":"intl"},"silver":{"tola":1,"gram":1}}),
 "fuel":{"fuel":{"petrol":1,"diesel":1}},
 "kse_up":("kse",{"kse":kse(1)}),"kse_down":("kse",{"kse":kse(-1)}),
 "prayer":{}, "nawafil":{},
}
JS_LABEL="""
async ([text,size,color,stroke,pill,pad])=>{
 await document.fonts.load(size+'px "Jameel Noori Nastaleeq"',text);
 const m=document.createElement('canvas').getContext('2d'); m.wordSpacing='-4px'; m.font=size+'px "Jameel Noori Nastaleeq"'; m.direction='rtl';
 const tw=m.measureText(text).width;
 const S=2; let w=Math.ceil(tw+(pad??size*0.6)), h=Math.ceil(size*2.6);
 if(pill){w=Math.ceil(tw+44);h=52;}
 const c=document.createElement('canvas'); c.width=w*S; c.height=h*S; const x=c.getContext('2d'); x.scale(S,S);
 if(pill){x.beginPath();x.roundRect(0,0,w,h,26);x.fillStyle='#1F5E3B';x.fill();}
 x.wordSpacing='-4px'; x.direction='rtl';x.textAlign='center';x.textBaseline='middle';x.font=size+'px "Jameel Noori Nastaleeq"';x.fillStyle=color;
 const yy=pill? h/2+8 : h/2+size*0.08;
 x.fillText(text,w/2,yy); if(stroke){x.strokeStyle=color;x.lineWidth=stroke;x.strokeText(text,w/2,yy);}
 return {w,h,url:c.toDataURL('image/png')};
}"""
def save_png(url,path):
    open(path,"wb").write(base64.b64decode(url.split(",")[1]))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1500,"height":1900})
    pg.on("console",lambda m:print("console:",m.text)); pg.on("pageerror",lambda e:print("ERR",e))
    pg.goto("http://localhost:8765/page.html")
    pg.evaluate("document.fonts.load('40px \"Jameel Noori Nastaleeq\"','نماز')")
    # --- templates
    for name,spec in CARDS.items():
        key,data=(spec if isinstance(spec,tuple) else (name,spec))
        pg.evaluate('w=>{window.__noBar=w}', name in ('kse_up','kse_down','prayer','nawafil'))
        url=pg.evaluate("""async ([key,data])=>{
          const m=await import('/lib/dailyCards.js');
          const def=m.CARD_DEFS.find(d=>d.key===key);
          await document.fonts.load('60px "Jameel Noori Nastaleeq"','نماز کے اوقات سونے کا نرخ کرنسی');
          const c=document.createElement('canvas'); await m.drawDailyCard(c,def,data); return c.toDataURL('image/png');}""",[key,data])
        im=Image.open(io.BytesIO(base64.b64decode(url.split(",")[1]))).convert("RGB").resize((1080,1350),Image.LANCZOS)
        im.save(f"{OUT}/bg_{name}.jpg",quality=93,optimize=True); print("bg",name,im.size)
    # --- labels
    man={}
    def lab(key,text,size,color,stroke=0,pill=False,pad=None):
        r=pg.evaluate(JS_LABEL,[text,size,color,stroke,pill,pad]); save_png(r["url"],f"{OUT}/l_{key}.png"); man[key]={"w":r["w"],"h":r["h"],"size":size}
    MAROON="#7A0000"
    wds=pg.evaluate("Array.from({length:7},(_,i)=>new Intl.DateTimeFormat('ur-PK',{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,0,4+i,12))))")
    mos=pg.evaluate("Array.from({length:12},(_,i)=>new Intl.DateTimeFormat('ur-PK',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,i,10,12))))")
    print(wds,mos, pg.evaluate("new Intl.DateTimeFormat('ur-PK',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Karachi'}).format(new Date())"))
    for i,t in enumerate(wds): lab(f"wd_{i}",t,46,MAROON,1.7,False,8)
    for i,t in enumerate(mos): lab(f"mo_{i+1}",t,46,MAROON,1.7,False,8)
    for d in range(10): lab(f"d_{d}",str(d),46,MAROON,1.7,False,2)
    lab("comma","،",46,MAROON,1.7,False,4)
    lab("pre_rate","ریٹ بمطابق:",46,MAROON,1.7,False,8); lab("pre_eff","نافذ:",46,MAROON,1.7,False,8); lab("pre_kse","کے ایس ای 100 انڈیکس —",46,MAROON,1.7,False,8)
    for k,t in {"weekend":"ہفتہ وار تعطیل — نئے ریٹ پیر کو آئیں گے","today":"آج کے تازہ ریٹ","hold":"نئے ریٹ آنے تک یہی ریٹ نافذ ہیں",
      "fuel_today":"آج کی سرکاری قیمت — اوگرا روزانہ قیمت جاری کرتا ہے","fuel_weekend":"ہفتہ وار تعطیل — جمعہ کی قیمتیں پیر تک برقرار","fuel_wait":"نئی قیمت کا اعلان متوقع — اوگرا روزانہ قیمت جاری کرتا ہے",
      "kse_live":"کاروبار جاری ہے — اعداد بدل سکتے ہیں","kse_done":"آج کا کاروبار مکمل","kse_old":"مارکیٹ بند — آخری کاروباری دن کے اعداد"}.items():
        lab("pill_"+k,t,30,"#ffffff",0.9,True)
    for k,t,s,a in [("kse_state_live","اس وقت (کاروبار جاری)",40,"#ffffff"),("kse_state_close","بند ہوا",40,"#ffffff"),
      ("kse_up_today","آج مارکیٹ مثبت رہی",34,"rgba(255,255,255,.9)"),("kse_up","مارکیٹ مثبت رہی",34,"rgba(255,255,255,.9)"),
      ("kse_down_today","آج مارکیٹ منفی رہی",34,"rgba(255,255,255,.9)"),("kse_down","مارکیٹ منفی رہی",34,"rgba(255,255,255,.9)")]:
        lab(k,t,s,a,0.6 if "state" in k else 0)
    json.dump(man,open(f"{OUT}/manifest.json","w"),ensure_ascii=False)
    b.close()
srv.terminate()
