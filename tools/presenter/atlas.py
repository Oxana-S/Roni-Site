# «Атлас» речи: куски всех роликов, где автор говорит, подряд в одном видео + talk.json для presenter.js:
# где в каждом куске руки раскрываются / снова скрещиваются и куда прыгать (по сходству поз),
# чтобы продолжать речь, уйти в «руки скрещены» или вернуться в idle.
import subprocess, sys, json
import numpy as np
cfg = json.load(open(sys.argv[1], encoding="utf-8"))
ff = cfg["ffmpeg"]
VF = "crop=932:658:197:62,scale=560:396:flags=lanczos,format=rgba"
W, H, FW, FH = 560, 396, 160, 90
LEAD, TAIL, WIN = cfg.get("lead", 16), cfg.get("tail", 10), 4

HEAD_W = cfg.get("head_weight", 2.0)
def feats(src):
    p = subprocess.run([ff, "-v", "error", "-i", src, "-vf", f"scale={FW*2}:{FH*2}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True, check=True)
    f = np.frombuffer(p.stdout, np.uint8).reshape(-1, FH * 2, FW * 2, 4).astype(np.float32) / 255
    a = f[..., 3]; g = (f[..., 0] * .3 + f[..., 1] * .59 + f[..., 2] * .11) * a
    a2, g2 = a.reshape(-1, FH, 2, FW, 2).mean((2, 4)), g.reshape(-1, FH, 2, FW, 2).mean((2, 4))
    body = np.concatenate([a2[:, 9:, 25:141], g2[:, 9:, 25:141]], axis=2).reshape(len(f), -1)
    head = np.concatenate([a[:, 16:66, 136:196], g[:, 16:66, 136:196]], axis=2).reshape(len(f), -1)
    k = np.sqrt(HEAD_W * body.shape[1] / head.shape[1])         # голова весит HEAD_W от всей фигуры
    return body, np.concatenate([body, head * k], axis=1) / np.sqrt(1 + HEAD_W)   # фигура — для разметки, с головой — для прыжков

talk, idle = cfg["talk"], cfg["idle"]
FB, F = zip(*[feats(c["src"]) for c in talk])
IB, I = zip(*[feats(s) for s in idle]); I = np.concatenate(I)   # кадры idle-a.mp4 подряд
cross = np.mean([f[0] for f in FB] + [IB[0][0]], axis=0)           # поза «руки скрещены»

def d2(A, B):
    a2 = (A * A).sum(1)[:, None]; b2 = (B * B).sum(1)[None]
    return np.maximum(a2 + b2 - 2 * A @ B.T, 0) / A.shape[1] * 1000

# 1) разметка: u — начинает раскрывать руки, r — начинает скрещивать, x — руки снова скрещены
clips = []
for c, f in zip(talk, FB):
    cd = ((f - cross) ** 2).mean(1) * 1000
    n = len(f); lo, hi = cfg.get("cross_lo", 3.5), cfg.get("cross_hi", 8.0)
    u = next(i for i in range(n) if cd[i] > lo)
    x = max(i for i in range(n) if cd[i] > lo) + 1
    r = max(i for i in range(u, x) if cd[i] > hi)
    u, r, x = c.get("u", u), c.get("r", r), c.get("x", x)
    entry = c.get("entry", u + 2)
    s = max(0, u - LEAD - 6) if c.get("start", True) else max(0, entry - 4)   # без «старта» начало куска не нужно
    e = min(n, x + TAIL)
    clips.append(dict(name=c["src"].replace("\\", "/").split("/")[-1][-12:-4], u=u, r=r, x=x, s=s, e=e,
                      entry=entry, start=c.get("start", True), exit=c.get("exit", True), cd=cd))
    print(f"{clips[-1]['name']}: u={u} r={r} x={x} keep [{s},{e}) talk {(r-u)/24:.1f}s")

# 2) атлас: номера кадров
a = 0
for c in clips: c["a"] = a; a += c["e"] - c["s"]
N = a
def gid(k, i): return clips[k]["a"] + i - clips[k]["s"]
G = np.concatenate([F[k][c["s"]:c["e"]] for k, c in enumerate(clips)])   # признаки кадров атласа
D = d2(G, G)
def win(D, i, j, ni, nj):                          # сходство с учётом движения: окно из WIN кадров
    m = min(WIN, ni - i, nj - j)
    return np.mean([D[i + t, j + t] for t in range(m)])
owner = np.concatenate([[k] * (c["e"] - c["s"]) for k, c in enumerate(clips)])
end = np.array([clips[k]["a"] + clips[k]["e"] - clips[k]["s"] for k in owner])
talkset = [gid(k, i) for k, c in enumerate(clips) for i in range(c["entry"], c["r"] - 36)]   # осталось ≥ 1,5 с речи
outset = [gid(k, i) for k, c in enumerate(clips) if c["exit"] for i in range(c["r"] - 10, c["r"] + 1)]   # уход — только спокойные ролики
nxt, out, cn, co = [], [], [], []
MARGIN = cfg.get("margin", 1.5)
for f in range(N):
    def ranked(cands):
        per = {}
        for t in cands:
            if owner[t] == owner[f]: continue
            v = win(D, f, t, end[f], end[t])
            if owner[t] not in per or v < per[owner[t]][1]: per[owner[t]] = (t, v)
        return sorted(per.values(), key=lambda p: p[1])
    rk = ranked(talkset)
    # лучшее место в КАЖДОМ из остальных роликов, если поза подходит: [кадр, цена×10] — браузер берёт ролик,
    # которого не было дольше всех, чтобы куски не шли по кругу
    lim = max(cfg.get("next_max", 8.0), rk[0][1] + 2.0)
    nxt.append([[int(t), int(round(v * 10))] for t, v in rk if v <= lim]); cn.append(rk[0][1])
    ro = ranked(outset); out.append(ro[0][0]); co.append(ro[0][1])
# петля внутри куска: фраза длиннее куска — возвращаемся к похожей позе того же ролика (жест тот же, смены не видно)
loop, cl = [], []
for f in range(N):
    k = owner[f]; c = clips[k]
    cands = [gid(k, i) for i in range(c["entry"], c["r"] - 30) if gid(k, i) <= f - 40]
    if not cands: loop.append(-1); cl.append(99); continue
    v = [win(D, f, t, end[f], end[t]) for t in cands]
    lim = min(cfg.get("loop_max", 6.0), min(v) + 1.5)       # из хороших совпадений — самое раннее: петля длиннее,
    good = [i for i in range(len(v)) if v[i] <= lim]           # жест повторяется реже
    j = good[0] if good else int(np.argmin(v))
    loop.append(cands[j] if good else -1); cl.append(v[j])
DI = d2(G, I)
idl = [int(np.argmin(DI[f])) for f in range(N)]
ci = [float(DI[f, idl[f]]) for f in range(N)]
print(f"atlas {N} frames = {N/24:.1f}s")
for k, c in enumerate(clips):
    rng = range(gid(k, c["u"]), gid(k, c["r"]))
    print(f"  {c['name']}: next cost med {np.median([cn[f] for f in rng]):.1f} max {max(cn[f] for f in rng):.1f} | "
          f"out med {np.median([co[f] for f in rng]):.1f} max {max(co[f] for f in rng):.1f} | idle@x {ci[gid(k, c['x'])]:.1f} | "
          f"loop@r-6 {cl[gid(k, c['r']) - 6]:.1f}")
meta = dict(fps=24, frames=N, clips=[[c["a"], gid(k, max(c["u"], c["s"])), gid(k, c["r"]), gid(k, c["x"]), c["a"] + c["e"] - c["s"], int(c["exit"])] for k, c in enumerate(clips)],
            start=[gid(k, c["u"] - LEAD) for k, c in enumerate(clips) if c["start"]], next=nxt, out=out, idle=idl, loop=loop)
json.dump(meta, open(cfg["json"], "w"), separators=(",", ":"))

# 3) видео: цвет (умножен на прозрачность) сверху, маска снизу
enc = subprocess.Popen([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H*2}", "-r", "24", "-i", "-",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-an", "-c:v", "libx264", "-profile:v", "high",
    "-crf", str(cfg.get("crf", 22)), "-preset", "slow", "-g", str(cfg.get("gop", 24)), "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart", cfg["video"]],
    stdin=subprocess.PIPE)
for c, t in zip(clips, talk):
    p = subprocess.run([ff, "-v", "error", "-i", t["src"], "-vf", VF, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], capture_output=True, check=True)
    v = np.frombuffer(p.stdout, np.uint8).reshape(-1, H, W, 4)
    for i in range(c["s"], c["e"]):
        x = v[i].astype(np.float32) / 255
        rgb = np.clip(x[..., :3] * x[..., 3:4] * 255 + .5, 0, 255).astype(np.uint8)
        al = np.repeat(v[i][..., 3:4], 3, axis=2)
        enc.stdin.write(np.concatenate([rgb, al], axis=0).tobytes())
enc.stdin.close(); enc.wait()
print("video ok")
