/* ============================================================
   Тексты сайта + режим «Редактировать на сайте».

   Тексты страниц по умолчанию живут в коде (DICT/CH в каждой странице).
   Всё, что поменяли через редактор на сайте, хранится в data/texts.json
   и подставляется поверх: { "index.html": { "DICT.ru.heroTitle": "…" } }.

   Каждый компонент регистрируется в конструкторе:
     constructor(p){ super(p); window.RoniTexts&&RoniTexts.register(this,'index.html',['DICT']); }

   Редактор (assets/editor.js) включается так: открыть любую страницу с ?edit
   (выключить — ?edit=0 или кнопкой «Выйти» в панели).
   ============================================================ */
(function () {
  var REPO = "Oxana-S/Roni-Site", BRANCH = "main";
  var LANGS = ["ru", "en", "uk", "bg"];

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  // ---- режим редактора: флаг в localStorage, ставится через ?edit ----
  var q = location.search;
  // Режим правки живёт только в этой вкладке (sessionStorage): открыли с ?edit — есть,
  // закрыли вкладку или зашли обычной ссылкой — сайт как у посетителя.
  function ss(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  ls("roni_edit", null);                 // старая «вечная» отметка из localStorage — больше не используется
  if (/[?&]edit=0(&|$)/.test(q)) ss("roni_edit", null);
  else if (/[?&]edit(=1)?(&|$)/.test(q)) ss("roni_edit", "1");
  var editMode = ss("roni_edit") === "1";
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var token = ls("roni_gh_token");

  // Данные (data/*.json). Редактор с токеном читает их прямо из GitHub,
  // чтобы видеть свои правки сразу, а не через 1–2 минуты после деплоя Pages.
  function plain(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  }
  function apiMode() { return editMode && !isLocal && !!token; }
  function fetchJSON(path) {
    if (!apiMode()) return plain(path);
    return fetch("https://api.github.com/repos/" + REPO + "/contents/" + path + "?ref=" + BRANCH, {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json" }
    }).then(function (r) {
      if (r.status === 404) throw new Error(path + " 404");
      if (!r.ok) return plain(path);
      return r.json();
    }, function () { return plain(path); });
  }

  // ---- правки текстов поверх словарей компонентов ----
  var overrides = null, insts = [];

  function setPath(obj, path, v) {
    var k = path.split(".");
    for (var i = 0; i < k.length - 1; i++) {
      if (obj == null || typeof obj !== "object") return false;
      obj = obj[k[i]];
    }
    if (obj == null || typeof obj !== "object") return false;
    obj[k[k.length - 1]] = v;
    return true;
  }
  // book.html?id=X и read.html?book=X — свои правки у каждой книги; всё нетронутое берётся
  // от «Просто вернуться домой» (book.html / read.html). Для 'home' — сама общая страница.
  function pageKey(file) {
    var q; try { q = new URLSearchParams(location.search); } catch (e) { return file; }
    var id = file === "book.html" ? q.get("id") : file === "read.html" ? q.get("book") : null;
    if (!id || id === "home") return file;
    return file + (file === "book.html" ? "?id=" : "?book=") + id;
  }
  function apply(inst) {
    if (!overrides) return;
    var base = inst.__rtBase !== inst.__rtName && overrides[inst.__rtBase];
    if (base) for (var b in base) setPath(inst, b, base[b]);
    var o = overrides[inst.__rtName];
    if (o) for (var p in o) setPath(inst, p, o[p]);
  }
  // живые экземпляры (движок может заменить экземпляр при догрузке логики)
  function live() {
    insts = insts.filter(function (i) { return !i.__host || i.__host.logic === i; });
    return insts;
  }
  function rerender() {
    live().forEach(function (i) { try { i.forceUpdate(); } catch (e) {} });
  }
  function register(inst, name, props) {
    inst.__rtBase = name;
    inst.__rtName = pageKey(name);
    inst.__rtProps = props || ["DICT"];
    insts.push(inst);
    if (overrides) apply(inst);
  }

  var ready = fetchJSON("data/texts.json").catch(function () { return {}; }).then(function (d) {
    overrides = d || {};
    live().forEach(apply);
    rerender();
    return overrides;
  });

  window.RoniTexts = {
    REPO: REPO, BRANCH: BRANCH, LANGS: LANGS,
    register: register, live: live, pageKey: pageKey, rerender: rerender, setPath: setPath, ready: ready,
    fetchJSON: fetchJSON, apiMode: apiMode, isLocal: isLocal, editMode: editMode,
    overrides: function () { return overrides; }
  };

  if (editMode) {
    var s = document.createElement("script");
    s.src = "assets/editor.js";
    s.defer = true;
    document.head.appendChild(s);
  }
})();
