import os, glob
SITE = os.path.expanduser("~/Documents/PROJECTS-/Project. Roni Site")
# Порядок ВАЖЕН: сначала более длинные/специфичные строки.
MAP = [
    ("Книга — Просто вернуться домой.dc.html", "book.html"),   # em-dash (404)
    ("Книга - Просто вернуться домой.dc.html", "book.html"),   # hyphen (реальное имя)
    ("Главная - направления.dc.html", "directions.html"),
    ("Читать онлайн.dc.html", "read.html"),
    ("Об авторе.dc.html", "about.html"),
    ("В разработке.dc.html", "dev.html"),
    ("Дизайн-система.dc.html", "styleguide.html"),
    ("Главная.dc.html", "index.html"),
    ("Заказ.dc.html", "order.html"),
    ("Отзывы.dc.html", "reviews.html"),
    ("Статья.dc.html", "article.html"),
    ("Новости.dc.html", "news.html"),
    ("Контакты.dc.html", "contacts.html"),
    ("Вайфрейм.dc.html", "wireframe.html"),
    ("Блог.dc.html", "blog.html"),
    ("404.dc.html", "404.html"),
]
files = glob.glob(os.path.join(SITE, "*.dc.html")) + [os.path.join(SITE, "index.html")] + glob.glob(os.path.join(SITE, "components", "*.dc.html"))
for f in files:
    if not os.path.exists(f):
        continue
    t = open(f, encoding="utf-8").read()
    orig = t
    for old, new in MAP:
        t = t.replace(old, new)
    if t != orig:
        open(f, "w", encoding="utf-8").write(t)
        print("relinked:", os.path.relpath(f, SITE))
