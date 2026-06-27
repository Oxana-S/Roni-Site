# Рони — Фундамент (Фазы 0–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить фундамент дизайн-системы — локальные React/Babel + патч движка, единый `theme.css` с токенами (без визуальных изменений), латинские URL — так, чтобы сайт остался полностью рабочим.

**Architecture:** Оставляем dc-runtime. Вендорим React/ReactDOM/Babel в `assets/vendor/` (байт-в-байт, SRI валиден). Компоненты переезжают в `components/` (`COMPONENT_DIR="./components"`). Папка `templates/` (с дублями и 2-й копией `support.js`) удаляется. `styles/theme.css` объявляет токены и подключается во все страницы. Все имена файлов и ссылки латинизируются с сохранением `?query`/`#anchor`.

**Tech Stack:** Статический сайт, dc-runtime (`support.js`), React 18.3.1 (UMD) + @babel/standalone 7.26.4, GitHub Pages (subpath `/Roni-Site/`). Тестов-юнитов нет — верификация через локальный HTTP-сервер, `curl`, браузер (Network/консоль) и grep-гейты.

## Global Constraints

- Рабочая папка: `/Users/sergioiarcov/Documents/PROJECTS-/Project. Roni Site` (есть пробел и точка — всегда в кавычках). Далее `SITE="$HOME/Documents/PROJECTS-/Project. Roni Site"`.
- Все пути в коде — **относительные, без ведущего `/`** (`styles/theme.css`, `assets/vendor/...`, `./components/...`) — иначе ломается subpath `/Roni-Site/`.
- Локальная проверка — только через HTTP-сервер (под `file://` `fetch` падает). Сервер запускать из корня сайта.
- Латинизируются ТОЛЬКО имена файлов, `href`, пути, якоря. Тексты переводов (`CH`/`DICT`), бренд и контент — НЕ трогать (остаются кириллицей).
- Сохранять `?query` и `#anchor` при переписывании ссылок.
- Каждая задача — отдельный коммит. После каждой фазы — push в `main` и проверка на проде `https://oxana-s.github.io/Roni-Site/`.
- React 18.3.1 и Babel 7.26.4 — версии не менять (SRI-хэши привязаны к ним).
- Спека: `docs/superpowers/specs/2026-06-27-roni-design-system-refactor-design.md`.

---

## Карта латинизации (общая для Фазы 2)

| Старый файл (basename) | Новый |
|---|---|
| `Главная.dc.html` | `index.html` (канон уже существует — мержим) |
| `Книга - Просто вернуться домой.dc.html` | `book.html` |
| `Читать онлайн.dc.html` | `read.html` |
| `Заказ.dc.html` | `order.html` |
| `Об авторе.dc.html` | `about.html` |
| `Отзывы.dc.html` | `reviews.html` |
| `Блог.dc.html` | `blog.html` |
| `Статья.dc.html` | `article.html` |
| `Новости.dc.html` | `news.html` |
| `Контакты.dc.html` | `contacts.html` |
| `В разработке.dc.html` | `dev.html` |
| `Главная - направления.dc.html` | `directions.html` |
| `Вайфрейм.dc.html` | `wireframe.html` |
| `Дизайн-система.dc.html` | `styleguide.html` |
| `404.dc.html` | `404.html` |

Дополнительные строки-ссылки (em-dash вариант в `404`): `Книга — Просто вернуться домой.dc.html` → `book.html`.
Компоненты (`SiteHeader.dc.html`, `SiteFooter.dc.html`) — имена латинские, остаются `.dc.html`.

---

# ФАЗА 0 — Vendoring и патч движка

### Task 0.1: Вендоринг React/ReactDOM/Babel локально

**Files:**
- Create: `assets/vendor/react.production.min.js`
- Create: `assets/vendor/react-dom.production.min.js`
- Create: `assets/vendor/babel.min.js`
- Modify: `support.js:1020` (BABEL_URL), `support.js:1514` (REACT_URL), `support.js:1516` (REACT_DOM_URL)

**Interfaces:**
- Produces: локальные пути, на которые ссылается `loadReactUmd()` (support.js:1536) и `ensureBabel()` (support.js:1028).

- [ ] **Step 1: Скачать байт-идентичные файлы (те же версии — SRI сойдётся)**

```bash
SITE="$HOME/Documents/PROJECTS-/Project. Roni Site"
mkdir -p "$SITE/assets/vendor"
curl -sL "https://unpkg.com/react@18.3.1/umd/react.production.min.js" -o "$SITE/assets/vendor/react.production.min.js"
curl -sL "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" -o "$SITE/assets/vendor/react-dom.production.min.js"
curl -sL "https://unpkg.com/@babel/standalone@7.26.4/babel.min.js" -o "$SITE/assets/vendor/babel.min.js"
ls -la "$SITE/assets/vendor"
```

- [ ] **Step 2: Проверить, что SRI-хэш React совпадает (иначе браузер заблокирует)**

```bash
SITE="$HOME/Documents/PROJECTS-/Project. Roni Site"
echo -n "react:     "; cat "$SITE/assets/vendor/react.production.min.js" | openssl dgst -sha384 -binary | openssl base64 -A; echo
echo -n "react-dom: "; cat "$SITE/assets/vendor/react-dom.production.min.js" | openssl dgst -sha384 -binary | openssl base64 -A; echo
```
Expected: первый = `DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z`, второй = `gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1` (это значения `REACT_SRI`/`REACT_DOM_SRI` в support.js:1515/1517). Если НЕ совпало — не продолжать: либо перекачать, либо в Task сделать снятие integrity (см. примечание ниже).

> Примечание: если хэши не сойдутся (unpkg отдал другой билд), альтернатива — в `support.js:1528` заменить `s.integrity = integrity;` на `if (integrity) s.integrity = integrity;` и в `loadReactUmd` передавать `null` вместо SRI. Но сначала пытаемся байт-в-байт.

- [ ] **Step 3: Переключить URL в support.js на локальные относительные пути**

`support.js:1020`:
```js
  var BABEL_URL = "assets/vendor/babel.min.js";
```
`support.js:1514`:
```js
  var REACT_URL = "assets/vendor/react.production.min.js";
```
`support.js:1516`:
```js
  var REACT_DOM_URL = "assets/vendor/react-dom.production.min.js";
```
(Строки SRI 1515/1517 НЕ трогаем — байты совпадают.)

- [ ] **Step 4: Поднять локальный сервер из корня сайта**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site" && python3 -m http.server 8765
```
Открыть `http://localhost:8765/Главная.dc.html` (имена ещё кириллические — Фаза 2 позже).

- [ ] **Step 5: Проверить в браузере — нет обращений к unpkg, сайт рендерится**

Открыть DevTools → Network, перезагрузить. Expected: запросы на `assets/vendor/react.production.min.js`, `react-dom...`, `babel.min.js` со статусом 200; НЕТ запросов на `unpkg.com`; в консоли нет ошибки SRI (`Failed to find a valid digest`); главная отрисована (видна шапка/hero).

- [ ] **Step 6: Commit**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git add assets/vendor support.js
git commit -m "Фаза 0: вендоринг React/ReactDOM/Babel локально (SRI сохранён)"
```

---

### Task 0.2: Патч COMPONENT_DIR + переезд компонентов в components/, удаление templates/

**Files:**
- Modify: `support.js:1348` (COMPONENT_DIR)
- Move: `SiteHeader.dc.html` → `components/SiteHeader.dc.html`
- Move: `SiteFooter.dc.html` → `components/SiteFooter.dc.html`
- Move: `templates/Шаблон страницы.dc.html` → `components/PageTemplate.dc.html`
- Delete: папка `templates/` целиком (включая `templates/support.js`, дубли `templates/SiteHeader.dc.html`, `templates/SiteFooter.dc.html`)

**Interfaces:**
- Consumes: `<dc-import name="SiteHeader">` / `name="SiteFooter">` на страницах резолвятся как `./components/<name>.dc.html` (support.js:1372).
- Produces: компоненты в `components/`; `PageTemplate` доступен для Фазы 5.

- [ ] **Step 1: Гейт — убедиться, что dc-import ссылается только на SiteHeader/SiteFooter**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
grep -rhoE 'dc-import name="[^"]+"' --include="*.dc.html" . | sort -u
```
Expected: только `dc-import name="SiteHeader"` и `dc-import name="SiteFooter"`. Если есть другие имена — остановиться и пересмотреть (план рассчитан на этот инвариант).

- [ ] **Step 2: Создать components/, перенести канонические компоненты (из КОРНЯ, не из templates/)**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
mkdir -p components
git mv "SiteHeader.dc.html" "components/SiteHeader.dc.html"
git mv "SiteFooter.dc.html" "components/SiteFooter.dc.html"
git mv "templates/Шаблон страницы.dc.html" "components/PageTemplate.dc.html"
```

- [ ] **Step 3: Удалить остаток папки templates/ (дубли + вторая support.js)**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git rm -r templates
ls -la   # templates/ больше нет
```

- [ ] **Step 4: Патч COMPONENT_DIR**

`support.js:1348`:
```js
  var COMPONENT_DIR = "./components";
```

- [ ] **Step 5: Проверить рендеринг шапки/футера локально**

Сервер из Task 0.1 (перезапустить при необходимости). Открыть `http://localhost:8765/Главная.dc.html`.
Expected: шапка (логотип/меню/языки) и футер отрисованы (значит `./components/SiteHeader.dc.html` и `SiteFooter.dc.html` зарезолвились); в Network запросы на `components/SiteHeader.dc.html` и `components/SiteFooter.dc.html` = 200; переключение языка в шапке работает (клик RU/EN меняет меню и футер).

- [ ] **Step 6: Commit + push + проверка на проде**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git add support.js
git commit -m "Фаза 0: компоненты в components/, COMPONENT_DIR=./components, удалена templates/"
git push origin main
```
После сборки Pages открыть `https://oxana-s.github.io/Roni-Site/Главная.dc.html` — шапка/футер на месте, языки переключаются, в Network нет unpkg.

---

# ФАЗА 1 — theme.css с токенами (без визуальных изменений)

### Task 1.1: Создать styles/theme.css (только объявления токенов + a11y-база)

**Files:**
- Create: `styles/theme.css`

**Interfaces:**
- Produces: CSS-переменные `--*` в `:root`, доступные всем страницам; правила `:focus-visible`, `prefers-reduced-motion`. Использование переменных в разметке — Фаза 3 (сейчас вид НЕ меняется).

- [ ] **Step 1: Создать файл с токенами = текущие значения сайта**

```css
/* styles/theme.css — единый источник истины для дизайна.
   ФАЗА 1: только объявления токенов + базовая доступность.
   Значения = текущие фактические цвета/размеры сайта (вид не меняется). */
:root{
  /* --- Примитивы --- */
  --c-ink-900:#14110d; --c-ink-850:#16120d; --c-ink-800:#1a1410; --c-ink-700:#2c241a;
  --c-gold-500:#c9a86a; --c-gold-300:#f0d8a8; --c-paper-100:#ece4d6; --c-paper-50:#f3ece0;
  --c-mute-500:#8a8070; --c-dim-400:#c9bda8;

  /* --- Семантика --- */
  --bg:var(--c-ink-900); --bg-2:var(--c-ink-800);
  --gold:var(--c-gold-500); --gold-soft:var(--c-gold-300);
  --text:var(--c-paper-100); --text-dim:var(--c-dim-400); --text-mute:var(--c-mute-500);
  --line-soft:rgba(201,168,106,.18); --line-med:rgba(201,168,106,.3); --line-strong:rgba(201,168,106,.7);
  --header-bg:rgba(20,17,13,.72);

  /* --- Слой / сетка --- */
  --container:1180px; --container-narrow:980px; --measure:760px;
  --gutter:7vw; --header-h:66px;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:24px;
  --space-6:32px; --space-7:40px; --space-8:56px; --space-9:72px; --space-10:96px;
  --radius:2px; --shadow:0 24px 50px rgba(0,0,0,.6);

  /* --- Типографика --- */
  --font-display:Forum,serif; --font-body:Spectral,serif;
  --fw-300:300; --fw-400:400; --fw-500:500;
  --lh-tight:1.15; --lh-normal:1.5; --lh-loose:1.7;
  --tracking-1:.5px; --tracking-2:1px; --tracking-3:3px;
  --fs-eyebrow:12px; --fs-small:14px; --fs-nav:16px; --fs-body:17px; --fs-lead:19px;
  --fs-h3:22px; --fs-h2:clamp(28px,4vw,44px); --fs-h1:clamp(40px,7vw,96px);

  /* --- Служебные --- */
  --z-header:50; --z-overlay:100; --z-toast:1000;
  --t-fast:.25s; --t-med:.4s; --ease:cubic-bezier(.2,.7,.2,1);
  --focus-ring:2px solid var(--gold); --touch-min:44px;
}

/* Доступность — безопасно добавляется сразу */
:focus-visible{ outline:var(--focus-ring); outline-offset:2px; }
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important; scroll-behavior:auto !important; }
}
```

- [ ] **Step 2: Проверить, что файл валиден (нет синтаксических ошибок)**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
node -e "const c=require('fs').readFileSync('styles/theme.css','utf8'); const o=(c.match(/{/g)||[]).length, cl=(c.match(/}/g)||[]).length; if(o!==cl) throw new Error('несбалансированы скобки: '+o+' vs '+cl); console.log('OK, блоков:', o);"
```
Expected: `OK, блоков: N` (без ошибки).

- [ ] **Step 3: Commit**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git add styles/theme.css
git commit -m "Фаза 1: styles/theme.css — токены дизайн-системы (значения = текущие)"
```

---

### Task 1.2: Подключить theme.css во все страницы (статический <head>) и компоненты (<helmet>)

**Files:**
- Modify: все страницы `*.dc.html` в корне (вставка `<link>` в реальный `<head>`)
- Modify: `components/SiteHeader.dc.html`, `components/SiteFooter.dc.html`, `components/PageTemplate.dc.html` (вставка `<link>` в `<helmet>`)

**Interfaces:**
- Consumes: `styles/theme.css` из Task 1.1.
- Produces: переменные `--*` доступны в каждом документе. Href строго `styles/theme.css` везде (дедуп helmet по href, support.js:1268).

- [ ] **Step 1: Скрипт — вставить <link> в <head> страниц и в <helmet> компонентов**

Создать `scripts/link_theme.py` (вне деплоя — в репо ок, Pages его игнорирует как .py):
```python
import os, glob
SITE = os.path.expanduser("~/Documents/PROJECTS-/Project. Roni Site")
LINK = '<link rel="stylesheet" href="styles/theme.css">'
# 1) страницы в корне: после <meta name="viewport"...> в реальном <head>
for f in glob.glob(os.path.join(SITE, "*.dc.html")):
    t = open(f, encoding="utf-8").read()
    if "styles/theme.css" in t:
        continue
    marker = '<script src="./support.js"></script>'
    assert marker in t, f"нет маркера support.js в {f}"
    t = t.replace(marker, LINK + "\n" + marker, 1)
    open(f, "w", encoding="utf-8").write(t)
    print("page:", os.path.basename(f))
# 2) компоненты: добавить <link> внутрь <helmet> (первой строкой после <helmet>)
for f in glob.glob(os.path.join(SITE, "components", "*.dc.html")):
    t = open(f, encoding="utf-8").read()
    if "styles/theme.css" in t:
        continue
    assert "<helmet>" in t, f"нет <helmet> в {f}"
    t = t.replace("<helmet>", "<helmet>\n" + LINK, 1)
    open(f, "w", encoding="utf-8").write(t)
    print("component:", os.path.basename(f))
```

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site" && mkdir -p scripts && python3 scripts/link_theme.py
```
Expected: список всех страниц и компонентов; без AssertionError.

- [ ] **Step 2: Проверить, что link добавлен везде ровно один раз**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
grep -rc 'styles/theme.css' *.dc.html components/*.dc.html | grep -v ':1$' && echo "ПРОБЛЕМА: не везде ровно 1" || echo "OK: ровно по 1 во всех файлах"
```
Expected: `OK: ровно по 1 во всех файлах`.

- [ ] **Step 3: Проверить в браузере, что переменные резолвятся и вид НЕ изменился**

Локальный сервер, открыть `http://localhost:8765/Главная.dc.html`. В консоли:
```js
getComputedStyle(document.documentElement).getPropertyValue('--gold')
```
Expected: ` #c9a86a`. Визуально страница как до изменений (link только объявляет переменные, ничего не переопределяет).

- [ ] **Step 4: Commit + push + проверка на проде**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git add -A
git commit -m "Фаза 1: подключение theme.css во все страницы (<head>) и компоненты (<helmet>)"
git push origin main
```
На проде открыть главную, в Network убедиться `styles/theme.css` = 200.

---

# ФАЗА 2 — Латинизация имён и ссылок

### Task 2.1: Реконсиляция index.html ↔ Главная.dc.html

**Files:**
- Keep: `index.html` (канон), Delete (на Step): `Главная.dc.html`
- Контекст: `index.html` сейчас — копия `Главная.dc.html`; в Task 1.2 в обе вставлен `theme.css`.

**Interfaces:**
- Produces: единственная главная страница `index.html`. Ссылки `Главная.dc.html...` будут переписаны в Task 2.2 на `index.html...`.

- [ ] **Step 1: Сверить, что index.html и Главная.dc.html идентичны по содержимому**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
diff "index.html" "Главная.dc.html" && echo "ИДЕНТИЧНЫ — можно удалять Главную" || echo "РАЗЛИЧАЮТСЯ — разобраться вручную перед удалением"
```
Expected: `ИДЕНТИЧНЫ` (обе получили theme.css в Task 1.2). Если различаются — взять более полную как `index.html`, затем удалить вторую.

- [ ] **Step 2: Удалить Главная.dc.html**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git rm "Главная.dc.html"
```

- [ ] **Step 3: Commit**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git commit -m "Фаза 2: index.html как единственная главная, удалён дубль Главная.dc.html"
```

---

### Task 2.2: Переписать все ссылки на латиницу (с сохранением query/anchor)

**Files:**
- Modify: все `*.dc.html`, `index.html` в корне, `components/*.dc.html`

**Interfaces:**
- Consumes: карта латинизации (см. начало плана).
- Produces: все `href`/`href:'...'` указывают на латинские имена; `?query`/`#anchor` сохранены.

- [ ] **Step 1: Скрипт перезаписи ссылок (строковая замена по карте, включая JS-массивы и em-dash)**

Создать `scripts/relink.py`:
```python
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
files = glob.glob(os.path.join(SITE, "*.dc.html")) + [os.path.join(SITE,"index.html")] + glob.glob(os.path.join(SITE,"components","*.dc.html"))
for f in files:
    t = open(f, encoding="utf-8").read()
    orig = t
    for old, new in MAP:
        t = t.replace(old, new)
    if t != orig:
        open(f, "w", encoding="utf-8").write(t)
        print("relinked:", os.path.relpath(f, SITE))
```
Замена работает на подстроке имени файла → `...dc.html#offer` и `...dc.html?id=1` сохраняют хвост автоматически.

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site" && python3 scripts/relink.py
```

- [ ] **Step 2: Проверить, что кириллических ссылок на .dc.html не осталось**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
grep -rhoE "href=[\"'][^\"']*\.dc\.html" *.dc.html index.html components/*.dc.html | grep -P "[А-Яа-яЁё]" && echo "ОСТАЛИСЬ кириллические ссылки (см. выше)" || echo "OK: кириллических ссылок на .dc.html нет"
```
Expected: `OK: кириллических ссылок на .dc.html нет`. (Ссылки на компоненты через `dc-import name="SiteHeader"` — не `href`, их не трогаем.)

- [ ] **Step 3: Commit**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git add -A
git commit -m "Фаза 2: переписаны все ссылки на латиницу (query/anchor сохранены)"
```

---

### Task 2.3: Переименовать файлы страниц в латиницу

**Files:**
- Rename: все кириллические `*.dc.html` страницы → латинские `*.html` (см. карту). `index.html` уже есть.

**Interfaces:**
- Consumes: ссылки из Task 2.2 уже указывают на эти новые имена.
- Produces: латинские файлы страниц; навигация замкнута.

- [ ] **Step 1: Переименовать через git mv**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git mv "Книга - Просто вернуться домой.dc.html" "book.html"
git mv "Читать онлайн.dc.html" "read.html"
git mv "Заказ.dc.html" "order.html"
git mv "Об авторе.dc.html" "about.html"
git mv "Отзывы.dc.html" "reviews.html"
git mv "Блог.dc.html" "blog.html"
git mv "Статья.dc.html" "article.html"
git mv "Новости.dc.html" "news.html"
git mv "Контакты.dc.html" "contacts.html"
git mv "В разработке.dc.html" "dev.html"
git mv "Главная - направления.dc.html" "directions.html"
git mv "Вайфрейм.dc.html" "wireframe.html"
git mv "Дизайн-система.dc.html" "styleguide.html"
git mv "404.dc.html" "404.html"
ls *.html
```
Expected: список латинских `.html`; кириллических `*.dc.html` в корне не осталось.

- [ ] **Step 2: Гейт — нет битых внутренних ссылок (каждая ссылка ведёт на существующий файл)**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
miss=0
for href in $(grep -rhoE "href=[\"'][^\"']+\.html" *.html components/*.dc.html | sed -E "s/href=[\"']//" | sed -E 's/[#?].*//' | sort -u); do
  [ -f "$href" ] || { echo "БИТАЯ ссылка: $href"; miss=1; }
done
[ "$miss" = "0" ] && echo "OK: все внутренние ссылки ведут на существующие файлы"
```
Expected: `OK: все внутренние ссылки ведут на существующие файлы`.

- [ ] **Step 3: Проверить навигацию и язык локально (сервер)**

`http://localhost:8765/` (открывается `index.html`). Кликнуть по всем пунктам меню (Книги/Автор/Блог/Новости/Контакты), перейти на статью (`?id`), сменить язык RU→EN и перейти на другую страницу.
Expected: все переходы открываются (нет 404), URL латинские, выбранный язык сохраняется между страницами (через `localStorage('vish_lang')`), футер и шапка везде на выбранном языке.

- [ ] **Step 4: Commit + push + проверка на проде**

```bash
cd "$HOME/Documents/PROJECTS-/Project. Roni Site"
git commit -m "Фаза 2: переименование страниц в латиницу (.html)"
git push origin main
```
На проде: открыть `https://oxana-s.github.io/Roni-Site/`, пройти навигацию, убедиться что в адресной строке латиница и нет 404.

---

## Self-Review (выполнено при написании)

- **Покрытие спеки (Фазы 0–2):** vendoring+SRI (0.1) ✓; COMPONENT_DIR+components/+удаление templates/ (0.2) ✓; theme.css токены вкл. spacing/типошкала/a11y-база (1.1) ✓; статическое+helmet подключение, дедуп по href (1.2) ✓; реконсиляция index/Главная (2.1) ✓; перезапись ссылок с query/anchor/em-dash, не трогая CH-тексты (2.2) ✓; переименование + гейт битых ссылок + проверка языка (2.3) ✓.
- **Плейсхолдеры:** нет — все шаги с конкретными командами/кодом и ожидаемым результатом.
- **Согласованность:** пути `assets/vendor/*`, `styles/theme.css`, `./components` использованы единообразно; карта латинизации одна и та же в 2.2/2.3.
- **Вне рамок (отдельные планы):** Фаза 3 (рефакторинг инлайнов на токены + фикс шапки + контейнеры/колонки), Фаза 4 (адаптив+a11y aria), Фаза 5 (вынос компонентов + Style Guide + Playwright baseline), Фаза 6 (реальные фото). Они зависят от диагностики скролла на проде и обнаружения повторяющихся секций — планируются после фундамента.
