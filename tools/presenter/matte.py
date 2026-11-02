# Вырезает человека из ролика (RobustVideoMatting) → RGBA без потерь (FFV1) + границы фигуры по всем кадрам
import subprocess, sys, json
import numpy as np, onnxruntime as ort
model, outdir, srcs = sys.argv[1], sys.argv[2], sys.argv[3:]
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
W, H, WARM = 1280, 720, 24
ds = np.array([0.4], np.float32)
def frames(src, n=None):
    args = ["ffmpeg", "-v", "error", "-i", src] + (["-frames:v", str(n)] if n else []) + ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(args, stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()
def step(f, rec):
    x = (f.astype(np.float32) / 255).transpose(2, 0, 1)[None]
    fgr, pha, *rec = sess.run(None, {"src": x, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ds})
    return fgr[0].transpose(1, 2, 0), pha[0, 0], rec
boxes = {}
for src in srcs:
    name = src.replace("\\", "/").split("/")[-1].rsplit(".", 1)[0]
    rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
    for f in frames(src, WARM):          # разогрев памяти модели, чтобы первые кадры не «плыли»
        _, _, rec = step(f, rec)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", "24", "-i", "-",
                            "-c:v", "ffv1", "-pix_fmt", "rgba", f"{outdir}/{name}.mkv"], stdin=subprocess.PIPE)
    x0, y0, x1, y1, n = W, H, 0, 0, 0
    for f in frames(src):
        fgr, a, rec = step(f, rec)
        rgba = np.empty((H, W, 4), np.uint8)
        rgba[..., :3] = (np.clip(fgr, 0, 1) * 255 + 0.5).astype(np.uint8)
        rgba[..., 3] = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
        enc.stdin.write(rgba.tobytes())
        ys, xs = np.nonzero(a > 0.06)
        if len(xs):
            x0, x1, y0, y1 = min(x0, xs.min()), max(x1, xs.max()), min(y0, ys.min()), max(y1, ys.max())
        n += 1
    enc.stdin.close(); enc.wait()
    boxes[name] = [int(x0), int(y0), int(x1), int(y1), n]
    print(name, boxes[name], flush=True)
json.dump(boxes, open(f"{outdir}/boxes.json", "w"), indent=1)
