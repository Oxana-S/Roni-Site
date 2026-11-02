# Проверка прыжков атласа: по строке на прыжок — 2 кадра до, 6 кадров наплыва, 2 после (на тёмном фоне, как на сайте)
import subprocess, sys, json, random
import numpy as np
ff, atlas, idlev, meta_p, out = sys.argv[1:6]
m = json.load(open(meta_p)); W, H = 560, 396
def dec(src):
    p = subprocess.run([ff, "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    v = np.frombuffer(p.stdout, np.uint8).reshape(-1, H * 2, W, 3)
    return v
A, I = dec(atlas), dec(idlev)
bg = np.array([30, 24, 19], np.float32) / 255
def px(v, f):
    c = v[f, :H].astype(np.float32) / 255; a = v[f, H:, :, :1].astype(np.float32) / 255
    return c, a
def comp(c, a): return (c + bg * (1 - a))[40:380:2, 130:430:2]
rows = []
def row(src1, f, src2, t):
    tiles = []
    for i in range(-2, 0): tiles.append(comp(*px(src1, f + i)))
    for i in range(6):
        w = (i + 1) / 7
        c1, a1 = px(src1, f + i); c2, a2 = px(src2, t + i)
        tiles.append(comp(c1 * (1 - w) + c2 * w, a1 * (1 - w) + a2 * w))
    for i in range(6, 8): tiles.append(comp(*px(src2, t + i)))
    rows.append(np.concatenate(tiles, axis=1))
random.seed(3)
cl = m["clips"]
for k in [6]:
    a, u, r, x, e = cl[k]; f = r - 6; row(A, f, A, m["next"][3 * f])
for k in [1, 3, 6, 7]:
    a, u, r, x, e = cl[k]; f = (u + r) // 2; row(A, f, A, m["out"][f + 3])
for k in [0, 5]:
    a, u, r, x, e = cl[k]; row(A, x, I, m["idle"][x + 4])
img = (np.concatenate(rows, axis=0) * 255).clip(0, 255).astype(np.uint8)
h, w = img.shape[:2]
subprocess.run([ff, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-i", "-", out], input=img.tobytes(), check=True)
