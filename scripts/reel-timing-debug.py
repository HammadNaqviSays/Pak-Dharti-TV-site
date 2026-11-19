import json, wave, numpy as np
meta = json.load(open("dbg/meta.json"))
for m in meta:
    w = wave.open(f"dbg/{m['id']}.wav"); VR, VN = w.getframerate(), w.getnframes()
    v = np.frombuffer(w.readframes(VN), dtype=np.int16).astype(np.float32) / 32768
    frame = int(VR * 0.02); nfr = len(v) // frame
    rms = np.sqrt((v[: nfr * frame].reshape(nfr, frame) ** 2).mean(axis=1))
    thr = 0.05 * float(np.percentile(rms, 95))
    sil, run = [], None
    for k, x in enumerate(rms):
        if x < thr: run = k if run is None else run
        elif run is not None:
            sil.append((round(run * .02, 2), round((k - run) * .02, 2))); run = None
    sp = [k * .02 for k, x in enumerate(rms) if x >= thr]; b, e = sp[0], sp[-1] + .02
    cs = [max(12, len(t)) for t in m["texts"]]; tot = sum(cs); acc = 0; exp = []
    for k in range(len(cs) - 1): acc += cs[k]; exp.append(round(b + (e - b) * acc / tot, 2))
    print("REEL", m["title"][:40], "dur", round(VN / VR, 1), "speech", round(b, 2), round(e, 2))
    print(" expected scene starts:", exp)
    print(" pauses >=0.14s (start,len):", [s for s in sil if s[1] >= 0.14])
    print(" pauses 0.06-0.14s:", len([s for s in sil if 0.06 <= s[1] < 0.14]))
