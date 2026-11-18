"""Flags of international bodies from Wikimedia Commons (searched by name, SVG only) → public/flags/org-*.svg"""
import os, requests
S = requests.Session(); S.headers["User-Agent"] = "PakDhartiTV-PeopleLibrary/1.0 (news site)"
CM = "https://commons.wikimedia.org/w/api.php"
ORGS = {"oic": "Flag of the Organisation of Islamic Cooperation", "gcc": "Flag of the Gulf Cooperation Council",
        "asean": "Flag of ASEAN", "sco": "Flag of the Shanghai Cooperation Organisation", "commonwealth": "Flag of the Commonwealth of Nations",
        "un": "Flag of the United Nations", "eu": "Flag of Europe", "nato": "Flag of NATO", "arab-league": "Flag of the Arab League",
        "au": "Flag of the African Union", "red-cross": "Flag of the Red Cross", "saarc": "Flag of SAARC", "brics": "Flag of BRICS"}
got, miss = [], []
for key, q in ORGS.items():
    path = f"public/flags/org-{key}.svg"
    if os.path.exists(path) and os.path.getsize(path) > 200: got.append(key); continue
    j = S.get(CM, params={"action": "query", "format": "json", "list": "search", "srnamespace": 6, "srlimit": 8, "srsearch": f'intitle:"{q}" filetype:drawing'}, timeout=30).json()
    titles = [h["title"] for h in j.get("query", {}).get("search", []) if h["title"].lower().endswith(".svg")]
    ok = False
    for t in titles:
        r = S.get("https://commons.wikimedia.org/wiki/Special:FilePath/" + t.replace("File:", "").replace(" ", "_"), timeout=30)
        if r.ok and b"<svg" in r.content[:2000]:
            open(path, "wb").write(r.content); ok = True; break
    (got if ok else miss).append(key)
print(f"::notice title=org flags::have {len(got)}: {', '.join(got)}; missing: {', '.join(miss)}")
