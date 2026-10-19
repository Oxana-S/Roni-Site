/* ============================================================
   Язык страницы в адресе + многоязычные SEO-мета (title / description / Open Graph).

   У каждой страницы есть адрес на каждом языке: about.html (русский), about.html?lang=en,
   ?lang=uk, ?lang=bg. Поисковики видят и индексируют все четыре версии (hreflang).
   - ?lang=… в адресе главнее сохранённого языка: ссылка открывает нужную версию;
   - смена языка в шапке меняет и адрес (без перезагрузки), русский — без параметра;
   - title / description / Open Graph обновляются на лету. Тексты — assets/seo.json
     (тот же файл читает сервер, seo/page.php). Заголовки страниц книг, глав, заказа и статей
     ставят сами страницы по своим данным.
   На хостинге правильные мета для языка из адреса приходят уже с сервера (seo/page.php),
   этот файл нужен посетителю, который переключает язык, и для просмотра без сервера.
   ============================================================ */
(function () {
  var LANGS = ["ru", "en", "uk", "bg"], DEF = "ru";
  var LOCALE = { ru: "ru_RU", en: "en_US", uk: "uk_UA", bg: "bg_BG" };
  var cfg = null;

  var baseSet = null;
  try { baseSet = Storage.prototype.setItem; } catch (e) {}
  function origSet(k, v) { baseSet.call(window.localStorage, k, v); }

  function valid(l) { return LANGS.indexOf(l) >= 0; }
  function param(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function stored() {
    try { return localStorage.getItem("vish_lang"); } catch (e) { return null; }
  }

  // 1) язык из адреса — до того, как страница прочитает сохранённый язык
  var urlLang = param("lang");
  if (valid(urlLang) && baseSet) { try { origSet("vish_lang", urlLang); } catch (e) {} }

  function current() {
    var l = stored();
    if (valid(l)) return l;
    return valid(urlLang) ? urlLang : DEF;
  }

  // 2) адрес показывает текущий язык; остальные параметры (?id=, ?book=, ?edit) не трогаем
  function syncUrl(lang) {
    try {
      var parts = location.search.replace(/^\?/, "").split("&").filter(function (p) {
        return p && p.split("=")[0] !== "lang";
      });
      if (lang !== DEF) parts.push("lang=" + lang);
      var search = parts.length ? "?" + parts.join("&") : "";
      if (search !== location.search) history.replaceState(history.state, "", location.pathname + search + location.hash);
    } catch (e) {}
  }

  function pageKey() { return location.pathname.split("/").pop() || "index.html"; }
  function setMeta(sel, attr, val) {
    var el = document.querySelector(sel);
    if (el && val) el.setAttribute(attr, val);
  }

  // 3) мета-теги на языке страницы
  function applyMeta(lang) {
    try { document.documentElement.lang = lang; } catch (e) {}
    setMeta('meta[property="og:locale"]', "content", LOCALE[lang]);
    // canonical — на версию этого языка, если сервер её объявил (link hreflang)
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + lang + '"]');
    if (alt) {
      setMeta('link[rel="canonical"]', "href", alt.getAttribute("href"));
      setMeta('meta[property="og:url"]', "content", alt.getAttribute("href"));
    }
    if (!cfg || !cfg.pages) return;
    var key = pageKey();
    if (key === "book.html" && /[?&]id=(?!home(&|$))/.test(location.search)) return;   // страница другой книги
    var page = cfg.pages[key];
    var m = page && (page[lang] || page[DEF]);
    if (!m || !m.t) return;                // заголовок ставит сама страница (книги, главы, статьи)
    document.title = m.t;
    setMeta('meta[name="description"]', "content", m.d);
    setMeta('meta[name="keywords"]', "content", m.k);
    setMeta('meta[property="og:title"]', "content", m.t);
    setMeta('meta[property="og:description"]', "content", m.d);
    setMeta('meta[name="twitter:title"]', "content", m.t);
    setMeta('meta[name="twitter:description"]', "content", m.d);
  }

  var lang0 = current();
  syncUrl(lang0);
  applyMeta(lang0);
  try {
    fetch("assets/seo.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        cfg = d;
        if (d.langs && d.langs.length) LANGS = d.langs;
        if (d.defaultLang) DEF = d.defaultLang;
        if (d.locales) LOCALE = d.locales;
        applyMeta(current());
      })
      .catch(function () {});
  } catch (e) {}

  // смена языка в шапке: страницы пишут 'vish_lang' — перехватываем запись
  // (через Storage.prototype: присваивание localStorage.setItem работает не во всех браузерах)
  try {
    if (baseSet) Storage.prototype.setItem = function (k, v) {
      baseSet.apply(this, arguments);
      if (this === window.localStorage && k === "vish_lang" && valid(v)) { syncUrl(v); applyMeta(v); }
    };
  } catch (e) {}
})();
