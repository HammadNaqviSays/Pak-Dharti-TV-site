"""Background photos of places for the news cards (UN, parliament, courts, capitals ...), freely licensed from
Wikimedia Commons, wide and large. Sends {key: {url, credit, license, source, title}} to the site."""
import os, re, requests

SITE = os.environ.get("SITE", "https://pak-dharti-tv.vercel.app")
TOKEN = os.environ["TOKEN"]
CM = "https://commons.wikimedia.org/w/api.php"
S = requests.Session()
S.headers["User-Agent"] = "PakDhartiTV-PeopleLibrary/1.0 (news site; https://pak-dharti-tv.vercel.app)"
FREE = re.compile(r"^(cc[ -]?by(-sa)?( \d\.\d)?|cc[ -]?by[ -]sa|cc0|public domain|pd\b|pd-|attribution|no restrictions)", re.I)

SCENES = {
    "un": "United Nations Headquarters New York building", "un-security-council": "United Nations Security Council chamber",
    "un-geneva": "Palais des Nations Geneva", "parliament-pk": "Parliament House Islamabad", "senate-pk": "Senate of Pakistan building",
    "supreme-court-pk": "Supreme Court of Pakistan building Islamabad", "pm-house-pk": "Prime Minister's Secretariat Islamabad",
    "aiwan-e-sadr": "Aiwan-e-Sadr Islamabad", "punjab-assembly": "Provincial Assembly of the Punjab building Lahore",
    "kp-assembly": "Khyber Pakhtunkhwa Assembly Peshawar", "sindh-assembly": "Sindh Assembly building Karachi",
    "adiala": "Adiala Jail Rawalpindi", "islamabad-high-court": "Islamabad High Court building", "lahore-high-court": "Lahore High Court building",
    "election-commission-pk": "Election Commission of Pakistan Islamabad", "faisal-mosque": "Faisal Mosque Islamabad",
    "minar-e-pakistan": "Minar-e-Pakistan Lahore", "mazar-e-quaid": "Mazar-e-Quaid Karachi", "badshahi-mosque": "Badshahi Mosque Lahore",
    "karachi": "Karachi skyline", "lahore": "Lahore city view", "islamabad": "Islamabad city view Margalla", "peshawar": "Peshawar city",
    "quetta": "Quetta city", "gwadar": "Gwadar port", "kashmir": "Neelum Valley Azad Kashmir", "torkham": "Torkham border crossing",
    "loc": "Line of Control Kashmir", "wagah": "Wagah border ceremony", "psx": "Pakistan Stock Exchange building Karachi",
    "state-bank-pk": "State Bank of Pakistan building Karachi", "white-house": "White House north facade Washington",
    "capitol-us": "United States Capitol west front", "pentagon": "The Pentagon aerial", "kremlin": "Moscow Kremlin Red Square",
    "beijing": "Tiananmen Gate Beijing", "great-hall-beijing": "Great Hall of the People Beijing", "new-delhi": "Rashtrapati Bhavan New Delhi",
    "parliament-india": "Parliament House New Delhi", "kabul": "Kabul city view", "tehran": "Azadi Tower Tehran", "riyadh": "Riyadh skyline Kingdom Centre",
    "makkah": "Masjid al-Haram Mecca", "madinah": "Al-Masjid an-Nabawi Medina", "jerusalem": "Dome of the Rock Jerusalem",
    "gaza": "Gaza City", "doha": "Doha skyline", "dubai": "Dubai skyline", "ankara": "Presidential Complex Ankara",
    "london": "Palace of Westminster London", "downing-street": "10 Downing Street", "brussels-eu": "Berlaymont building Brussels",
    "nato": "NATO headquarters Brussels", "kyiv": "Kyiv Maidan Nezalezhnosti", "imf": "International Monetary Fund headquarters Washington",
    "world-bank": "World Bank headquarters Washington", "icc-hague": "International Criminal Court The Hague building",
    "cricket-stadium": "Gaddafi Stadium Lahore", "national-stadium-karachi": "National Stadium Karachi", "flood": "Pakistan floods 2022",
    "earthquake": "earthquake damage buildings", "court-gavel": "judge gavel courtroom", "protest": "protest crowd flags rally",
    "election": "ballot box election polling station", "oil": "oil refinery", "gold": "gold bars", "wheat": "wheat field Punjab Pakistan",
}


def best(query):
    j = S.get(CM, params={"action": "query", "format": "json", "formatversion": 2, "generator": "search", "gsrnamespace": 6, "gsrlimit": 20,
                          "gsrsearch": f"{query} filetype:bitmap filemime:image/jpeg", "prop": "imageinfo",
                          "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280}, timeout=40).json()
    pages = sorted(j.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))
    for p in pages:
        ii = (p.get("imageinfo") or [None])[0]
        if not ii or ii.get("width", 0) < 1280 or ii["width"] < ii["height"] * 1.25: continue
        meta = ii.get("extmetadata") or {}
        lic = (meta.get("LicenseShortName") or {}).get("value", "")
        if not FREE.search(lic.strip()) or re.search(r"\b(nc|nd)\b", lic, re.I): continue
        artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "")).strip()[:80] or "Wikimedia Commons"
        return {"url": ii.get("thumburl") or ii["url"], "credit": artist, "license": lic, "source": ii.get("descriptionurl"), "title": p["title"]}
    return None


def main():
    out, miss = {}, []
    for k, q in SCENES.items():
        try:
            b = best(q)
        except Exception:  # noqa
            b = None
        if b: out[k] = b
        else: miss.append(k)
    r = S.post(f"{SITE}/api/cron/people?op=scenes", json={"scenes": out}, headers={"x-cron-token": TOKEN}, timeout=60)
    msg = f"scenes saved: {len(out)}/{len(SCENES)} ({r.status_code}); missing: {', '.join(miss)}"
    print(msg); print(f"::notice title=scenes::{msg[:900]}")


if __name__ == "__main__":
    main()
