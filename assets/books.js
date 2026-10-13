/* ============================================================
   Данные книг (редактируются на сайте в режиме ?edit).
   data/books.json          — каталог: карточки, описания, цены, обложки
   data/chapters/<id>.json  — первая глава книги <id>

   Любое поле языка (en/uk/bg) может быть пустым — тогда берётся RU.
   Объекты общие для всех компонентов страницы: редактор меняет их на месте.
   ============================================================ */
(function () {
  var cache = {}, loaded = {};
  function getJSON(url) {
    if (!cache[url]) {
      var load = window.RoniTexts ? window.RoniTexts.fetchJSON(url) : fetch(url, { cache: "no-cache" }).then(function (r) {
        // no-cache: браузер перепроверяет файл, правки видны сразу после деплоя
        if (!r.ok) throw new Error(url + " " + r.status);
        return r.json();
      });
      cache[url] = load.then(function (d) { loaded[url] = d; return d; });
    }
    return cache[url];
  }
  function exists(url) {
    // редактор читает данные из GitHub API — новая глава может ещё не быть на Pages
    if (window.RoniTexts && window.RoniTexts.apiMode()) {
      return getJSON(url).then(function () { return true; }, function () { return false; });
    }
    var key = "HEAD " + url;
    if (!cache[key]) cache[key] = fetch(url, { method: "HEAD", cache: "no-cache" })
      .then(function (r) { return r.ok; }, function () { return false; });
    return cache[key];
  }
  function field(obj, lang, key) {
    var v = obj && obj[lang] && obj[lang][key];
    if (v) return v;
    return (obj && obj.ru && obj.ru[key]) || "";
  }
  var BOOKS = "data/books.json";
  function chapterUrl(id) { return "data/chapters/" + encodeURIComponent(id) + ".json"; }
  // книга без обложки: прозрачная заглушка (видна полосатая подложка карточки);
  // #book=<id> — чтобы редактор знал, чью обложку загружать по клику
  var NO_COVER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  function noCover(id) { return NO_COVER + "#book=" + encodeURIComponent(id); }

  // плоское «локализованное» представление книги для шаблонов
  function view(b, lang) {
    if (!b) return null;
    var id = b.id;
    return {
      id: id,
      soon: b.status === "soon",
      featured: !!b.featured,
      noir: b.theme === "noir",
      title: field(b, lang, "title"),
      subtitle: field(b, lang, "subtitle"),
      tag: field(b, lang, "tag"),
      blurb: field(b, lang, "blurb"),
      description: field(b, lang, "description") || field(b, lang, "blurb"),
      price: field(b, lang, "price"),
      cover: field(b, lang, "cover") || b.cover || noCover(id),
      chapterImage: b.chapter_image || "",
      audio: field(b, lang, "audio"),
      amazon: b.amazon || "",
      href: b.page || ("book.html?id=" + encodeURIComponent(id)),   // своя страница или макет «Просто вернуться домой»
      readHref: b.read_page || ("read.html?book=" + encodeURIComponent(id)),   // своя страница чтения (новые книги) или общая
      orderHref: "order.html?book=" + encodeURIComponent(id)
    };
  }

  window.RoniBooks = {
    list: function () {
      return getJSON(BOOKS).then(function (d) {
        if (!d.books) d.books = [];
        return d.books;
      });
    },
    find: function (id) {
      return this.list().then(function (all) {
        for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
        return null;
      });
    },
    chapter: function (id) { return getJSON(chapterUrl(id)); },
    // Макет для нових книг: поки своїх даних немає, сторінки беруть «Просто вернуться домой».
    TEMPLATE: "home",
    // Книга або, якщо її ще немає в data/books.json, — копія макета з цим id (усе потім правиться в ?edit).
    findOrTemplate: function (id) {
      var self = this;
      return this.find(id).then(function (b) {
        if (b || id === self.TEMPLATE) return b;
        return self.find(self.TEMPLATE).then(function (t) {
          if (!t) return null;
          var copy = JSON.parse(JSON.stringify(t));
          copy.id = id;
          copy.__skeleton = true;
          delete copy.read_page;
          delete copy.page;
          return copy;
        });
      });
    },
    // Перша глава або заготовка з глави макета.
    chapterOrTemplate: function (id) {
      var self = this;
      return this.chapter(id).catch(function () { return null; }).then(function (ch) {
        if (ch || id === self.TEMPLATE) return ch;
        return self.chapter(self.TEMPLATE).then(function (t) {
          var draft = JSON.parse(JSON.stringify(t));
          draft.book = id;
          draft.__skeleton = true;
          self.putChapter(id, draft);
          return draft;
        });
      });
    },
    hasChapter: function (id) { return exists(chapterUrl(id)); },
    view: view,
    NO_COVER: NO_COVER,
    field: field,
    param: function (name) {
      try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
    },
    // текст главы/описания: абзацы разделены пустой строкой
    paras: function (text) {
      return String(text || "").split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    },
    // --- для редактора: уже загруженные данные (синхронно) ---
    cached: function () {
      var chapters = {};
      for (var url in loaded) {
        var m = url.match(/^data\/chapters\/(.+)\.json$/);
        if (m && loaded[url]) chapters[decodeURIComponent(m[1])] = loaded[url];
      }
      return { books: loaded[BOOKS] ? loaded[BOOKS].books : null, chapters: chapters };
    },
    putChapter: function (id, obj) {
      var url = chapterUrl(id);
      loaded[url] = obj;
      cache[url] = Promise.resolve(obj);
      cache["HEAD " + url] = Promise.resolve(true);
    }
  };
})();
