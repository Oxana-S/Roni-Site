import os, glob
SITE = os.path.expanduser("~/Documents/PROJECTS-/Project. Roni Site")
LINK = '<link rel="stylesheet" href="styles/theme.css">'
MARKER = '<script src="./support.js"></script>'

# 1) страницы в корне: *.dc.html + index.html — вставить <link> перед support.js в реальном <head>
pages = glob.glob(os.path.join(SITE, "*.dc.html")) + [os.path.join(SITE, "index.html")]
for f in pages:
    if not os.path.exists(f):
        continue
    t = open(f, encoding="utf-8").read()
    if "styles/theme.css" in t:
        print("skip (already):", os.path.basename(f)); continue
    assert MARKER in t, f"нет маркера support.js в {f}"
    t = t.replace(MARKER, LINK + "\n" + MARKER, 1)
    open(f, "w", encoding="utf-8").write(t)
    print("page:", os.path.basename(f))

# 2) компоненты: <link> первой строкой после <helmet>
for f in glob.glob(os.path.join(SITE, "components", "*.dc.html")):
    t = open(f, encoding="utf-8").read()
    if "styles/theme.css" in t:
        print("skip (already):", os.path.basename(f)); continue
    assert "<helmet>" in t, f"нет <helmet> в {f}"
    t = t.replace("<helmet>", "<helmet>\n" + LINK, 1)
    open(f, "w", encoding="utf-8").write(t)
    print("component:", os.path.basename(f))
