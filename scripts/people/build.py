"""People library builder (runs in GitHub Actions; the site's own servers have a 60-second limit).

1. Collects people: Wikipedia categories / list pages of the National Assembly, Senate and the four provincial
   assemblies, plus scripts/people/seeds.json (PTI leadership, federal and provincial leaders, military, police,
   judiciary, historical figures, sports, international leaders) and names the newsroom found in the news.
2. Resolves each one on Wikipedia/Wikidata (must be a human; Pakistani for the Pakistani groups).
3. Photos: only freely licensed files from Wikimedia Commons (CC BY, CC BY-SA, CC0, public domain), with credit
   and licence. Important people get more photos (from their Commons category).
4. Sends everything to the site:  POST {SITE}/api/cron/people?op=upsert
Prints ::notice lines so the result is visible on the workflow run.
"""
import json, os, re, sys, time
import requests

SITE = os.environ.get("SITE", "https://pak-dharti-tv.vercel.app")
TOKEN = os.environ["TOKEN"]
ONLY = os.environ.get("ONLY", "")            # e.g. "seeds" for a quick run
S = requests.Session()
S.headers["User-Agent"] = "PakDhartiTV-PeopleLibrary/1.0 (news site; https://pak-dharti-tv.vercel.app)"
WP, WD, CM = "https://en.wikipedia.org/w/api.php", "https://www.wikidata.org/w/api.php", "https://commons.wikimedia.org/w/api.php"
PK_COUNTRIES = {"Q843", "Q129286", "Q1775277"}   # Pakistan, British Raj, Dominion of Pakistan
FREE = re.compile(r"^(cc[ -]?by(-sa)?( \d\.\d)?|cc[ -]?by[ -]sa|cc0|public domain|pd\b|pd-|attribution|no restrictions|godl)", re.I)
NOTES = []
# Seeds in these groups must have a matching occupation on Wikidata (stops "Sanam Javed" → an actress "Sana Javed")
POLITICS = {"Q82955", "Q40348", "Q185351", "Q16533", "Q15627169", "Q1930187", "Q43845", "Q372436", "Q3242115", "Q193391", "Q1397808", "Q4964182", "Q131524", "Q15980158"}
OCC = {"pti": POLITICS, "federal": POLITICS, "judiciary": POLITICS,
       "military": {"Q189290", "Q47064", "Q4991371", "Q1402561"}, "police": {"Q384593", "Q189290", "Q82955", "Q1930187", "Q16533"}}
ACTING = {"Q33999", "Q10800557", "Q2405480", "Q10798782", "Q2259451", "Q4610556", "Q177220", "Q639669", "Q753110"}


def note(msg):
    NOTES.append(msg)
    print(msg, flush=True)


def get(url, params, tries=4):
    params = {**params, "format": "json", "formatversion": 2}
    for i in range(tries):
        try:
            r = S.get(url, params=params, timeout=40)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(5 * (i + 1)); continue
            return r.json()
        except Exception as e:  # noqa
            time.sleep(3 * (i + 1))
    return {}


def chunks(a, n):
    for i in range(0, len(a), n):
        yield a[i:i + n]


# ------------------------------------------------------------------ collect
def category_members(cat):
    out, cont = [], {}
    while True:
        j = get(WP, {"action": "query", "list": "categorymembers", "cmtitle": cat, "cmnamespace": 0, "cmlimit": 500, **cont})
        out += [m["title"] for m in j.get("query", {}).get("categorymembers", [])]
        if "continue" not in j: break
        cont = j["continue"]
    return out


def find_category(candidates, search):
    for c in candidates:
        m = category_members(c)
        if len(m) > 5: return c, m
    j = get(WP, {"action": "query", "list": "search", "srsearch": search, "srnamespace": 14, "srlimit": 10})
    for h in j.get("query", {}).get("search", []):
        m = category_members(h["title"])
        if len(m) > 5: return h["title"], m
    return None, []


def list_page_links(candidates, search):
    titles = list(candidates)
    j = get(WP, {"action": "query", "list": "search", "srsearch": search, "srlimit": 5})
    titles += [h["title"] for h in j.get("query", {}).get("search", []) if h["title"].lower().startswith("list of")]
    for t in titles:
        j = get(WP, {"action": "parse", "page": t, "prop": "text", "redirects": 1})
        html = (j.get("parse") or {}).get("text") or ""
        if not html: continue
        rows = re.findall(r"<table[^>]*wikitable[\s\S]*?</table>", html)
        links = []
        for tb in rows:
            for row in re.findall(r"<tr[\s\S]*?</tr>", tb):
                cons = re.search(r"\b(NA|PP|PK|PS|PB)-\s?\d+", re.sub(r"<[^>]+>", " ", row))
                for href, _ in re.findall(r'<a href="/wiki/([^"#?]+)"[^>]*>([^<]+)</a>', row):
                    if ":" in href: continue
                    links.append((requests.utils.unquote(href).replace("_", " "), cons.group(0).replace(" ", "") if cons else None))
        if len(links) > 20: return t, links
    return None, []


# ------------------------------------------------------------------ resolve
def resolve_titles(titles):
    """title -> {title, qid, image (free lead image file), description, disambig}"""
    out = {}
    for part in chunks(list(dict.fromkeys(titles)), 50):
        j = get(WP, {"action": "query", "titles": "|".join(part), "redirects": 1, "prop": "pageprops|pageimages|description",
                     "ppprop": "wikibase_item|disambiguation", "piprop": "name", "pilicense": "free"})
        q = j.get("query", {})
        back = {}
        for r in q.get("normalized", []) + q.get("redirects", []):
            back.setdefault(r["to"], []).append(r["from"])
        for p in q.get("pages", []):
            if p.get("missing"): continue
            info = {"title": p["title"], "qid": (p.get("pageprops") or {}).get("wikibase_item"), "image": p.get("pageimage"),
                    "description": p.get("description", ""), "disambig": "disambiguation" in (p.get("pageprops") or {})}
            for k in [p["title"]] + back.get(p["title"], []):
                out[k] = info
            for k in list(back.get(p["title"], [])):
                for k2 in back.get(k, []):
                    out[k2] = info
    return out


def search_title(name, hint=""):
    j = get(WP, {"action": "query", "list": "search", "srsearch": f"{name} {hint}".strip(), "srlimit": 5})
    return [h["title"] for h in j.get("query", {}).get("search", [])]


def entities(qids):
    out = {}
    for part in chunks(list(dict.fromkeys([q for q in qids if q])), 50):
        j = get(WD, {"action": "wbgetentities", "ids": "|".join(part), "props": "claims|labels|descriptions", "languages": "en|ur"})
        for qid, e in (j.get("entities") or {}).items():
            c = e.get("claims", {})
            val = lambda p: [s["mainsnak"].get("datavalue", {}).get("value") for s in c.get(p, []) if s["mainsnak"].get("datavalue")]
            ids = lambda p: [v.get("id") for v in val(p) if isinstance(v, dict)]
            out[qid] = {
                "human": "Q5" in ids("P31"), "countries": set(ids("P27")), "image": (val("P18") or [None])[0],
                "commonscat": (val("P373") or [None])[0], "party": (ids("P102") or [None])[-1], "occ": set(ids("P106")),
                "ur": (e.get("labels", {}).get("ur") or {}).get("value"), "en": (e.get("labels", {}).get("en") or {}).get("value"),
                "desc": (e.get("descriptions", {}).get("en") or {}).get("value", ""),
            }
    return out


def labels(qids):
    out = {}
    for part in chunks(list(dict.fromkeys([q for q in qids if q])), 50):
        j = get(WD, {"action": "wbgetentities", "ids": "|".join(part), "props": "labels", "languages": "en|ur"})
        for qid, e in (j.get("entities") or {}).items():
            out[qid] = (e.get("labels", {}).get("en") or {}).get("value")
    return out


# ------------------------------------------------------------------ photos
def commons_info(files):
    out = {}
    for part in chunks(list(dict.fromkeys([ftitle(f) for f in files if f])), 40):
        j = get(CM, {"action": "query", "titles": "|".join(part), "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280})
        alias = {n["to"]: n["from"] for n in j.get("query", {}).get("normalized", [])}
        for p in j.get("query", {}).get("pages", []):
            ii = (p.get("imageinfo") or [None])[0]
            if not ii: continue
            meta = ii.get("extmetadata") or {}
            lic = (meta.get("LicenseShortName") or {}).get("value", "")
            if ii.get("mime") not in ("image/jpeg", "image/png", "image/webp") or ii.get("width", 0) < 400: continue
            if not FREE.search(lic.strip()) or re.search(r"\b(nc|nd)\b", lic, re.I): continue
            artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "")).strip()[:80] or "Wikimedia Commons"
            out[p["title"]] = {"url": ii.get("thumburl") or ii["url"], "thumb": ii.get("thumburl") or ii["url"], "width": ii.get("thumbwidth") or ii["width"],
                               "height": ii.get("thumbheight") or ii["height"], "license": lic, "credit": artist,
                               "source": ii.get("descriptionurl"), "provider": "wikimedia", "tags": []}
            if p["title"] in alias: out[alias[p["title"]]] = out[p["title"]]
    return out


def ftitle(f):
    return "File:" + f.replace("File:", "").replace("_", " ")


def category_files(cat, surname, limit):
    j = get(CM, {"action": "query", "list": "categorymembers", "cmtitle": "Category:" + cat, "cmtype": "file", "cmlimit": 200})
    files = [m["title"] for m in j.get("query", {}).get("categorymembers", [])]
    files = [f for f in files if re.search(r"\.(jpe?g|png|webp)$", f, re.I) and surname.lower() in f.lower()]
    return files[: limit * 3]


def photo_count(priority):
    return 15 if priority >= 90 else 6 if priority >= 60 else 3 if priority >= 30 else 2


# ------------------------------------------------------------------ main
def main():
    people = {}      # wiki title -> record
    want = []        # (title_or_name, group, priority, extra, is_seed)

    seeds = json.load(open(os.path.join(os.path.dirname(__file__), "seeds.json")))
    for key, block in seeds.items():
        if key.startswith("_"): continue
        for name, prio in block["names"]:
            want.append((name, block["groups"], prio, {}, True))

    if ONLY != "seeds":
        bodies = [
            ("mna", 30, ["Category:Pakistani MNAs 2024–2029"], "Category Pakistani MNAs 2024–2029",
             ["List of members of the 16th National Assembly of Pakistan"], "members 16th National Assembly of Pakistan"),
            ("senator", 30, ["Category:Members of the Senate of Pakistan"], "Category Members of the Senate of Pakistan",
             ["List of current members of the Senate of Pakistan", "List of members of the Senate of Pakistan"], "current members Senate of Pakistan"),
            ("mpa-punjab", 15, ["Category:Punjab MPAs 2024–2029"], "Category Punjab MPAs 2024–2029",
             ["List of members of the 18th Provincial Assembly of the Punjab"], "members 18th Provincial Assembly of the Punjab"),
            ("mpa-kp", 15, ["Category:Khyber Pakhtunkhwa MPAs 2024–2029"], "Category Khyber Pakhtunkhwa MPAs 2024–2029",
             ["List of members of the 12th Provincial Assembly of Khyber Pakhtunkhwa"], "members Provincial Assembly of Khyber Pakhtunkhwa 2024"),
            ("mpa-sindh", 15, ["Category:Sindh MPAs 2024–2029"], "Category Sindh MPAs 2024–2029",
             ["List of members of the 16th Provincial Assembly of Sindh"], "members Provincial Assembly of Sindh 2024"),
            ("mpa-balochistan", 15, ["Category:Balochistan MPAs 2024–2029"], "Category Balochistan MPAs 2024–2029",
             ["List of members of the 12th Provincial Assembly of Balochistan"], "members Provincial Assembly of Balochistan 2024"),
        ]
        for group, prio, cats, csearch, lists, lsearch in bodies:
            cat, members = find_category(cats, csearch)
            lp, links = list_page_links(lists, lsearch)
            cons = {t: c for t, c in links if c}
            titles = list(dict.fromkeys(members + [t for t, _ in links]))
            note(f"{group}: category={cat} ({len(members)}), list={lp} ({len(links)} links)")
            for t in titles:
                want.append((t, [group], prio, {"constituency": cons.get(t)}, False))

        # names the newsroom found in the news
        try:
            q = S.get(f"{SITE}/api/cron/people?op=queue", headers={"x-cron-token": TOKEN}, timeout=60).json().get("names", [])
            for n in q[:300]:
                want.append((n, ["news"], 40, {}, True))
            note(f"news queue: {len(q)} names")
        except Exception as e:  # noqa
            note(f"news queue failed: {e}")

    # 1) resolve exact titles
    res = resolve_titles([w[0] for w in want])
    # 2) seeds that did not resolve to a person → search
    retry = [w for w in want if w[4] and (w[0] not in res or res[w[0]]["disambig"] or not res[w[0]]["qid"])]
    HINT = {"pti": "Pakistan Tehreek-e-Insaf politician", "federal": "Pakistani politician", "military": "Pakistan Army general",
            "police": "Pakistani police officer", "judiciary": "Pakistani judge lawyer", "sports": "Pakistani", "historical": "Pakistan",
            "public": "Pakistani", "news": "Pakistan"}
    for w in retry:
        hint = "" if "international" in w[1] else next((HINT[g] for g in w[1] if g in HINT), "Pakistan")
        for t in search_title(w[0], hint)[:3]:
            r = resolve_titles([t])
            if t in r and r[t]["qid"] and not r[t]["disambig"]:
                res[w[0]] = r[t]; break

    ents = entities([r["qid"] for r in res.values() if r.get("qid")])
    skipped, rejected = 0, set()
    for name, groups, prio, extra, is_seed in want:
        r = res.get(name)
        if not r or not r.get("qid"): skipped += 1; continue
        e = ents.get(r["qid"])
        if not e or not e["human"]: skipped += 1; continue
        intl = "international" in groups
        if not intl and e["countries"] and not (e["countries"] & PK_COUNTRIES): skipped += 1; continue
        # a seed for a politician / officer must not land on an actor or singer with a similar name
        if is_seed and any(g in OCC for g in groups) and e["occ"] & ACTING and not e["occ"] & POLITICS:
            rejected.add(r["qid"]); skipped += 1; continue
        rec = people.setdefault(r["qid"], {"qid": r["qid"], "name": re.sub(r"\s*\(.*?\)\s*$", "", r["title"]) or e["en"], "nameUr": e["ur"], "wiki": r["title"],
                                           "description": e["desc"] or r["description"], "groups": [], "priority": 0,
                                           "aliases": [name, r["title"], e["en"] or ""], "_lead": r.get("image"), "_p18": e["image"],
                                           "_cat": e["commonscat"], "_party": e["party"]})
        rec["groups"] = list(dict.fromkeys(rec["groups"] + groups))
        rec["priority"] = max(rec["priority"], prio)
        if extra.get("constituency"): rec["constituency"] = extra["constituency"]
        if name not in rec["aliases"]: rec["aliases"].append(name)
    note(f"resolved {len(people)} people ({skipped} names skipped: not found / not a person / not Pakistani)")

    # party names
    pl = labels([p["_party"] for p in people.values() if p.get("_party")])
    for p in people.values():
        if p.get("_party"): p["party"] = pl.get(p["_party"])

    # photos
    files = {}
    for p in people.values():
        fl = [f for f in [p["_lead"], p["_p18"]] if f]
        n = photo_count(p["priority"])
        if p["_cat"] and n > 2:
            surname = p["name"].split()[-1] if p["name"] else ""
            fl += category_files(p["_cat"], surname, n)
        files[p["qid"]] = list(dict.fromkeys([ftitle(f) for f in fl]))
    info = commons_info([f for fl in files.values() for f in fl])
    with_photo = 0
    for p in people.values():
        n = photo_count(p["priority"])
        # sharpest first: big photos (>= 900 px wide) before small ones, the Wikipedia lead photo first among equals
        cand = [info[f] for f in files[p["qid"]] if f in info]
        cand.sort(key=lambda x: (0 if x["width"] >= 900 else 1, -min(x["width"], 1280)))
        p["photos"] = cand[:n]
        if p["photos"]: with_photo += 1
    note(f"photos: {with_photo}/{len(people)} people have at least one free photo ({sum(len(p['photos']) for p in people.values())} photos)")

    # send
    sent = {"created": 0, "updated": 0}
    out = [{k: v for k, v in p.items() if not k.startswith("_")} for p in people.values()]
    for part in chunks(sorted(out, key=lambda x: -x["priority"]), 60):
        for i in range(3):
            try:
                r = S.post(f"{SITE}/api/cron/people?op=upsert", json={"people": part}, headers={"x-cron-token": TOKEN}, timeout=90)
                j = r.json()
                sent["created"] += j.get("created", 0); sent["updated"] += j.get("updated", 0)
                break
            except Exception as e:  # noqa
                time.sleep(5)
    note(f"saved: {sent['created']} new, {sent['updated']} updated")
    drop = sorted(rejected - set(people))
    if drop:
        try:
            r = S.post(f"{SITE}/api/cron/people?op=drop", json={"qids": drop}, headers={"x-cron-token": TOKEN}, timeout=60).json()
            note(f"removed wrong matches: {r.get('removed')}")
        except Exception as e:  # noqa
            note(f"drop failed: {e}")
    by = {}
    for p in people.values():
        for g in p["groups"]:
            a = by.setdefault(g, [0, 0]); a[0] += 1; a[1] += 1 if p["photos"] else 0
    note("by group (with photo/total): " + ", ".join(f"{g} {v[1]}/{v[0]}" for g, v in sorted(by.items(), key=lambda x: -x[1][0])))
    missing = [p["name"] for p in sorted(people.values(), key=lambda x: -x["priority"]) if not p["photos"] and p["priority"] >= 60][:40]
    note("important people without a free photo: " + ", ".join(missing))


if __name__ == "__main__":
    main()
    with open(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null"), "a") as f:
        f.write("\n".join(NOTES) + "\n")
    for n in NOTES[-9:]:
        print(f"::notice title=people::{n[:900]}")
