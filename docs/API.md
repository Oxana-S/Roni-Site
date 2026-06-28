# Документация для разработчиков (Roni Site)

Сайт писателя Ростислава Вишневского. Статический, на движке **dc-runtime** (`support.js`).
Бэкенда/HTTP-API нет. «API» здесь — это **девелоперский интерфейс кодовой базы**: как
устроены страницы и компоненты, токены дизайна, многоязычность и служебные скрипты.

> TL;DR: всё статическое, пути относительные → работает из корня любого сервера.
> Меняешь цвет/размер — в `styles/theme.css`. Добавляешь блок — в `components/`.
> Новые страницы кладёшь **в корень** с расширением `.html`.

---

## 1. Структура проекта

```
/  (корень = корень сайта)
  *.html                 страницы (латиница: index, about, book, blog, …)
  support.js             движок dc-runtime (НЕ редактировать без необходимости)
  favicon.ico  site.webmanifest  robots.txt  sitemap.xml  .sitebase

  components/            переиспользуемые блоки (dc-компоненты, *.dc.html)
    SiteHeader.dc.html   шапка (логотип · меню · языки · бургер)
    SiteFooter.dc.html   подвал (+ переключатель размера текста)
    PageTemplate.dc.html заготовка страницы (копировать в корень)

  styles/theme.css       ЕДИНЫЙ ИСТОЧНИК токенов дизайна (цвет/типографика/отступы)
  assets/
    img/                 картинки   icons/  фавиконки   vendor/  React+Babel (локально)
    analytics.js         Google Analytics (одна точка на весь сайт)
    seo-meta.js          многоязычные title/description/keywords
    og-image.jpg

  scripts/set-domain.py  смена домена одной командой
  docs/                  эта документация, спеки, IMAGES-spec, DEPLOY
```

---

## 2. Движок dc-runtime: как устроен компонент/страница

Каждый `.dc.html` — это **компонент**: шаблон + логика. Анатомия:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="./support.js"></script>     <!-- движок -->
</head>
<body>
<x-dc>                                       <!-- 1) ШАБЛОН -->
  <helmet>                                  <!-- попадает в <head> страницы -->
    <link rel="stylesheet" href="styles/theme.css">
    <style> .foo{ color:var(--gold) } </style>
  </helmet>

  <h1 style="color:var(--text)">{{ title }}</h1>   <!-- {{ }} — подстановка -->
  <sc-for list="{{ items }}" as="it" hint-placeholder-count="3">
    <a href="{{ it.href }}">{{ it.label }}</a>      <!-- цикл -->
  </sc-for>
</x-dc>

<script type="text/x-dc" data-dc-script                <!-- 2) ЛОГИКА -->
        data-props="{&quot;lang&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;default&quot;:&quot;ru&quot;,&quot;tsType&quot;:&quot;string&quot;}}">
class Component extends DCLogic {        // ИМЯ КЛАССА строго "Component"
  state = { open:false };
  componentDidMount(){ /* доступ к window/DOM/localStorage */ }
  renderVals(){                          // возвращает объект подстановок для {{ }}
    return { title:'Привет', items:[{href:'a.html',label:'A'}] };
  }
}
</script>
</body></html>
```

### Шаблонный синтаксис
| Конструкция | Что делает |
|---|---|
| `{{ name }}` | подставляет значение `name` из объекта `renderVals()` |
| `<sc-for list="{{ arr }}" as="x" hint-placeholder-count="N">…{{ x.field }}…</sc-for>` | цикл по массиву; `hint-placeholder-count` — подсказка движку (примерное число) |
| `<helmet>…</helmet>` | содержимое инжектится в `<head>` (стили, шрифты). Дедуп по `href`. |
| `<dc-import name="X" prop="{{ v }}">` | вставляет компонент `components/X.dc.html`, передаёт пропсы |
| `onClick="{{ handler }}"` | обработчик из `renderVals()` (функция) |

### Логика (`class Component extends DCLogic`)
- `renderVals()` — **обязательный** метод, возвращает объект для всех `{{ }}`.
- `state` + `this.setState({...})` — как в React (вызывает ре-рендер).
- Жизненный цикл: `constructor`, `componentDidMount`, `componentWillUnmount`, `componentDidUpdate`.
- Пропсы: `this.props.lang` (объявляются в `data-props`).

> ⚠️ **Не делай побочных эффектов (запись в DOM/localStorage) внутри `renderVals()`** —
> он вызывается на каждый рендер. Side-effects → в `componentDidMount`/`componentDidUpdate`.

---

## 3. Как добавить НОВУЮ СТРАНИЦУ

1. Скопируй `components/PageTemplate.dc.html` **в корень** под латинским именем, напр. `events.html`.
2. Поменяй `<script src="./support.js">` остаётся как есть (страница в корне → путь верный).
3. В шаблоне подключи шапку/подвал:
   ```html
   <dc-import name="SiteHeader" lang="{{ lang }}" active="" on-lang="{{ setLang }}" hint-size="100%,66px"></dc-import>
   …контент…
   <dc-import name="SiteFooter" lang="{{ lang }}" hint-size="100%,320px"></dc-import>
   ```
4. В логике добавь словарь и язык (см. §5) — обязательно `setLang` + чтение `localStorage('vish_lang')` в `componentDidMount`, иначе язык не запомнится.
5. SEO: добавь страницу в `assets/seo-meta.js` (4 языка) и в `sitemap.xml`; статичные мета в `<head>` (см. §6).
6. Ссылку на страницу добавь в меню (`components/SiteHeader.dc.html` → `NAV`) и/или подвал.

**Правила (иначе сломается):**
- Страница — **в корне**, расширение **`.html`**. Не в подпапке (сломает резолвинг `dc-import`).
- Имя файла компонента в `dc-import name="X"` = `X.dc.html`, **регистр важен** (сервер Linux).
- Пути к ассетам — **относительные** (`assets/…`, `styles/…`), без ведущего `/`.

---

## 4. Как добавить НОВЫЙ КОМПОНЕНТ (переиспользуемый блок)

1. Создай `components/MyBlock.dc.html` по анатомии из §2.
2. Класс логики — строго `class Component extends DCLogic` (иначе движок отрендерит только разметку без данных).
3. Опиши пропсы в `data-props` (JSON в HTML-экранировании), напр. заголовок/тексты приходят со страницы.
4. Используй на странице: `<dc-import name="MyBlock" title="{{ pageTitle }}"></dc-import>`.
5. Движок резолвит как `./components/MyBlock.dc.html` (константа `COMPONENT_DIR="./components"` в `support.js:1348`).

> Совет по i18n переиспользуемого блока: либо текст приходит **пропсами** со страницы
> (тогда блок language-agnostic), либо у блока свой словарь `CH` + проп `lang` (как у SiteHeader/Footer).

---

## 5. Многоязычность (RU / EN / UK / BG)

Язык — **клиентский**, хранится в `localStorage('vish_lang')`. Контент рендерится из словаря.

```js
class Component extends DCLogic {
  DICT = {
    ru:{ title:'Заголовок' }, en:{ title:'Title' },
    uk:{ title:'Заголовок' }, bg:{ title:'Заглавие' },
  };
  state = { lang:'ru' };
  componentDidMount(){
    try{ const s=localStorage.getItem('vish_lang'); if(s&&this.DICT[s]) this.setState({lang:s}); }catch(e){}
  }
  setLang(code){ try{ localStorage.setItem('vish_lang',code); }catch(e){} this.setState({lang:code}); }
  renderVals(){
    const lang = this.DICT[this.props?.lang] ? this.props.lang : this.state.lang;
    return { t:this.DICT[lang], lang, setLang:(c)=>this.setLang(c) };
  }
}
```

В разметке весь текст — через `{{ t.* }}` (НЕ хардкодить строки).
Шапке передавай `lang="{{ lang }}"` **и** `on-lang="{{ setLang }}"`; подвалу — `lang="{{ lang }}"`.

**Инварианты (не нарушать):**
- Ключ localStorage — всегда `'vish_lang'`.
- В каждом `DICT`/`CH` присутствуют **все 4 языка** с одинаковым набором ключей.
- Многоязычные `title/description/keywords` для SEO — в `assets/seo-meta.js` (он сам обновляет
  мета при смене языка, перехватывая запись `vish_lang`).

---

## 6. SEO

- **Статичные мета** в реальном `<head>` каждой страницы (RU как фолбэк для краулеров и
  OG-скраперов, которые не исполняют JS): `<title>`, `description`, `keywords`, `canonical`,
  Open Graph, Twitter Card, `robots` (внутренние страницы — `noindex`).
- **Многоязычные мета** — `assets/seo-meta.js` обновляет title/description/keywords под язык
  посетителя на лету.
- `sitemap.xml`, `robots.txt`, `site.webmanifest` — в корне.
- **Один `<meta name="description">` на страницу** (не дублировать в `<helmet>`).

---

## 7. Дизайн-токены (`styles/theme.css`)

**Единый источник истины.** Меняешь токен → меняется весь сайт.

```css
.btn{ background:var(--gold); color:var(--bg-2); font-size:var(--fs-body); }
```

Основные токены: `--bg --bg-2`, `--gold --gold-soft --gold-text`, `--text --text-dim --text-mute
--text-faint --text-faintest`, линии `--line-soft/-med/-strong`, `--container --measure --gutter
--header-h`, типографика `--fs-* --fw-* --lh-* --tracking-*`, `--space-1…10`, `--radius --shadow`,
`--z-header --focus-ring --touch-min`. Полный живой каталог с контрастом WCAG — `design-tokens.html`.

**Правила:**
- Не хардкодь значение, для которого есть токен. Цвет/размер — через `var(--…)`.
- Исключение: **декоративные one-off** (hero-градиенты, свечения) — остаются инлайном.
- Инлайн-`style` побеждает класс по каскаду — учитывай при рефакторинге.
- ⚠️ В SVG-атрибутах (`fill="…"`, `stroke="…"`) `var()` **НЕ работает** — там только hex.

---

## 8. Служебные скрипты и сборка

| Файл | Назначение |
|---|---|
| `scripts/set-domain.py https://домен` | меняет все абсолютные URL (canonical/OG/sitemap/robots) на новый домен; текущий — в `.sitebase` |
| `assets/analytics.js` | GA4. Впиши `GA_ID="G-XXXX"` — заработает на всех страницах |
| `assets/seo-meta.js` | многоязычные SEO-мета |
| inline-скрипт `vish_fs` в `<head>` | ранний зум (размер текста для слабовидящих) без мигания |
| `assets/vendor/` | React 18.3.1 + ReactDOM + Babel 7.26.4 (локально, без CDN) |

> **SRI:** React/ReactDOM/Babel грузятся с проверкой целостности (`integrity` в `support.js`).
> Если обновишь файл в `assets/vendor/` — **пересчитай хеш** (`openssl dgst -sha384 -binary file | openssl base64 -A`)
> и впиши в `support.js`. Иначе браузер заблокирует скрипт → белая страница.

Деплой на сервер — см. `docs/DEPLOY.md`.

---

## 9. Частые ошибки (чек-лист отладки)

| Симптом | Причина |
|---|---|
| Белая страница | React не загрузился (SRI не совпал после обновления vendor); или `class` не назван `Component` |
| Компонент не вставился (пусто) | имя в `dc-import name=` ≠ имени файла (регистр!); страница не в корне |
| Текст не переводится | хардкод вместо `{{ t.* }}`; в `DICT` нет языка; забыт `on-lang` у SiteHeader |
| Язык не запоминается | нет чтения `localStorage('vish_lang')` в `componentDidMount` |
| Тёмный текст на тёмном | у инпута/текста не задан `color` (ставь `var(--text)`) |
| Сломанный SVG-цвет | `var()` в `fill="…"`/`stroke="…"` — нельзя, только hex |
| OG-превью на старом домене | не запущен `set-domain.py` после смены домена |

---

## 10. Известные задачи на доработку (бэклог)

Найдено аудитом, не критично для работы, но стоит вычистить:

- 🟠 **Мёртвый код старой шапки** на ~9 страницах: `onScroll`/`state.scrolled`/`headScrolled`/
  `langBtns` в `renderVals` + дублирующий `.vhead` CSS в helmet. Шапка теперь компонент, эти
  значения никуда не рендерятся, но `onScroll` зря триггерит ре-рендер на скролле. Удалить.
- 🟠 **`404.html` и `dev.html`** используют старую инлайн-шапку вместо `<dc-import name="SiteHeader">` —
  третья копия навигации. Мигрировать на компонент.
- 🟡 **`document.documentElement.lang`** ставится в `SiteHeader.renderVals()` (побочка в рендере) —
  перенести в `componentDidMount/Update`.
- 🟡 **Аудио** `assets/audio/chapter-1.mp3` отсутствует (плеер на главной даст 404 при Play) —
  добавить файл или скрыть плеер.
- 🟡 **alt-тексты** картинок (`book.html`, `about.html`) захардкожены на RU — вынести в `{{ t.* }}`.
- 🟡 **Золотая альфа** `rgba(201,168,106,α)` — ~130 хардкодов с 19 значениями α вне токенов.
  Завести `--gold-rgb` + alpha-токены и схлопнуть.
- 🟡 **`directions.html`/`wireframe.html`** — концепт-мокапы с хардкод-RU; закрыты `noindex`,
  но физически доступны. Решить — убрать из деплоя или оставить.
- 🟡 **Шрифты Google Fonts** грузятся 9 разными URL (разные начертания) — унифицировать в один.
