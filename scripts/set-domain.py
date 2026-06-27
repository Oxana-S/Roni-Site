#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Смена базового домена сайта одной командой.

Меняет ВСЕ абсолютные URL (canonical, og:url, og:image, twitter:image,
sitemap <loc>, ссылку на sitemap в robots.txt) с текущего домена на новый.

Использование:
    python3 scripts/set-domain.py https://roni-vyshnevskyi.com

Текущий домен хранится в файле .sitebase (обновляется автоматически),
поэтому команду можно запускать сколько угодно раз.
"""
import os, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def norm(base):
    base = base.strip()
    if not base.startswith("http://") and not base.startswith("https://"):
        base = "https://" + base
    if not base.endswith("/"):
        base += "/"
    return base

def main():
    if len(sys.argv) != 2:
        print("Использование: python3 scripts/set-domain.py https://ваш-домен.com")
        sys.exit(1)
    new = norm(sys.argv[1])
    sb = os.path.join(ROOT, ".sitebase")
    if not os.path.exists(sb):
        print("Нет .sitebase — не знаю текущий домен. Создайте .sitebase с текущим базовым URL.")
        sys.exit(1)
    old = norm(open(sb, encoding="utf-8").read())
    if old == new:
        print("Домен уже:", new, "— ничего не меняю.")
        return

    targets = glob.glob(os.path.join(ROOT, "*.html")) + [
        os.path.join(ROOT, "sitemap.xml"),
        os.path.join(ROOT, "robots.txt"),
    ]
    total_files = 0
    total_hits = 0
    for f in targets:
        if not os.path.exists(f):
            continue
        t = open(f, encoding="utf-8").read()
        hits = t.count(old)
        if hits:
            t = t.replace(old, new)
            open(f, "w", encoding="utf-8").write(t)
            total_files += 1
            total_hits += hits
            print("  обновлено %2d  %s" % (hits, os.path.relpath(f, ROOT)))

    open(sb, "w", encoding="utf-8").write(new + "\n")
    print("\nГотово. Заменено вхождений: %d в %d файлах." % (total_hits, total_files))
    print("Старый домен: %s\nНовый домен:  %s" % (old, new))
    print("После этого загрузите файлы на сервер.")

if __name__ == "__main__":
    main()
