/* ============================================================
   Редактор «прямо на сайте». Подключается из assets/texts.js,
   только если в этом браузере включён режим (?edit).

   ✎ Редактировать → тексты обводятся пунктиром → клик → правка → «Сохранить».
   Сохранение:
     • localhost + scripts/edit-server.py → прямо в файлы проекта;
     • сайт на GitHub Pages → один коммит в репозиторий (нужен токен GitHub).
   Инструкция — docs/ADMIN.md.
   ============================================================ */
(function () {
  "use strict";
  var T = window.RoniTexts, B;
  if (!T) return;
  // книги нужны редактору на любой странице — догружаем assets/books.js, если страница его не подключает
  function withBooks(cb) {
    if (window.RoniBooks) return cb();
    var s = document.createElement("script");
    s.src = "assets/books.js"; s.onload = cb;
    document.head.appendChild(s);
  }
  // скрипт вставляется из <head> — ждём <body>
  withBooks(function () {
    if (!document.body) document.addEventListener("DOMContentLoaded", start);
    else start();
  });
  function start() {
  B = window.RoniBooks;
  var LANGS = T.LANGS;
  var LANG_NAMES = { ru: "русский", en: "английский", uk: "украинский", bg: "болгарский" };
  var BOOK_FIELDS = ["title", "subtitle", "tag", "blurb", "price"];
  var CHAP_FIELDS = ["chapter", "gate_title", "gate_text"];

  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function lang() { var l = ls("vish_lang"); return LANGS.indexOf(l) >= 0 ? l : "ru"; }
  function page() { return location.pathname.split("/").pop() || "index.html"; }

  var active = ss("roni_edit_on") === "1";
  var pending = fresh();
  var editing = null, original = "", index = new Map();
  var plainOnly = (function () { var d = document.createElement("div"); d.contentEditable = "plaintext-only"; return d.contentEditable === "plaintext-only"; })();

  function fresh() { return { texts: {}, books: {}, add: [], del: [], order: null, chapters: {}, uploads: {}, layout: { media: {}, pages: {} }, newPages: {}, bookPages: {} }; }
  function count() {
    var n = 0, k;
    for (k in pending.texts) n += Object.keys(pending.texts[k]).length;
    for (k in pending.books) n += Object.keys(pending.books[k]).length;
    for (k in pending.chapters) n += Object.keys(pending.chapters[k]).length;
    n += Object.keys(pending.layout.media).length;
    for (k in pending.layout.pages) {
      var pp = pending.layout.pages[k];
      n += (pp.hidden ? 1 : 0) + (pp.order ? 1 : 0) + (pp.custom ? 1 : 0) + (pp.moves ? 1 : 0) + Object.keys(pp.free || {}).length + Object.keys(pp.media || {}).length;
    }
    var gl = pending.layout.global;
    if (gl) n += Object.keys(gl.free || {}).length + (gl.moves ? 1 : 0);
    n += Object.keys(pending.newPages).length + Object.keys(pending.bookPages).length;
    return n + pending.add.length + pending.del.length + (pending.order ? 1 : 0);
  }

  // ---------------------------------------------------------------- данные
  function setDeep(obj, path, v) {
    var k = path.split(".");
    for (var i = 0; i < k.length - 1; i++) {
      if (obj[k[i]] == null || typeof obj[k[i]] !== "object") obj[k[i]] = {};
      obj = obj[k[i]];
    }
    obj[k[k.length - 1]] = v;
  }
  function books() { return B.cached().books || []; }
  function findBook(id) { return books().filter(function (b) { return b.id === id; })[0] || null; }
  function splitParas(v) { return v.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function setBook(id, path, liveValue, storedValue) {
    var b = findBook(id); if (!b) return;
    setDeep(b, path, liveValue);
    (pending.books[id] = pending.books[id] || {})[path] = storedValue === undefined ? liveValue : storedValue;
  }
  function chapterOf(id, create) {
    var ch = B.cached().chapters[id];
    if (!ch && create) { ch = { book: id }; B.putChapter(id, ch); }
    return ch;
  }
  function setChap(id, path, v) {
    var ch = chapterOf(id, true);
    if (ch.__skeleton) {                    // заготовка из «Просто вернуться домой» → своя глава этой книги
      delete ch.__skeleton;
      var seed = (pending.chapters[id] = pending.chapters[id] || {});
      LANGS.forEach(function (L) { if (ch[L]) Object.keys(ch[L]).forEach(function (k) { seed[L + "." + k] = ch[L][k]; }); });
    }
    setDeep(ch, path, v);
    (pending.chapters[id] = pending.chapters[id] || {})[path] = v;
  }

  // ---------------------------------------------- карта «текст на экране → откуда он»
  function flatten(obj, prefix, out) {
    if (typeof obj === "string") { out.push([prefix, obj]); return; }
    if (obj && typeof obj === "object") for (var k in obj) flatten(obj[k], prefix ? prefix + "." + k : k, out);
  }
  function otherLang(path, L) {
    return path.split(".").some(function (s) { return LANGS.indexOf(s) >= 0 && s !== L; });
  }
  function buildIndex() {
    var L = lang(), idx = new Map(), seen = {};
    function add(text, t) {
      if (!text || typeof text !== "string") return;
      var key = text + "\u0000" + JSON.stringify(t);
      if (seen[key]) return; seen[key] = 1;
      if (!idx.has(text)) idx.set(text, []);
      idx.get(text).push(t);
    }
    T.live().forEach(function (inst) {
      (inst.__rtProps || []).forEach(function (p) {
        var out = []; flatten(inst[p], p, out);
        out.forEach(function (e) { if (!otherLang(e[0], L)) add(e[1], { kind: "text", name: inst.__rtName, path: e[0] }); });
      });
    });
    books().forEach(function (b) {
      BOOK_FIELDS.forEach(function (k) { add(B.field(b, L, k), { kind: "book", id: b.id, key: k }); });
      ["description", "blurb"].forEach(function (k) {
        var ps = B.paras(b[L] && b[L][k]);
        if (ps.length > 1) ps.forEach(function (p, i) { add(p, { kind: "bookPara", id: b.id, key: k, i: i }); });
        else if (k === "description") add(ps[0], { kind: "book", id: b.id, key: k });
      });
    });
    var chs = B.cached().chapters;
    var curBook = readPageBookId();
    Object.keys(chs).forEach(function (id) {
      // на странице чтения правим только главу открытой книги (заготовка = копия главы «home», тексты совпадают)
      if (curBook && id !== curBook) return;
      var ch = chs[id]; if (!ch) return;
      CHAP_FIELDS.forEach(function (k) { add(B.field(ch, L, k), { kind: "chap", id: id, key: k }); });
      B.paras(ch[L] && ch[L].text).forEach(function (p, i) { add(p, { kind: "chapPara", id: id, i: i }); });
    });
    return idx;
  }
  // одинаковый текст может стоять в шапке, подвале и странице — берём только тот компонент, где кликнули
  function targetsFor(sp, text) {
    var all = index.get(text); if (!all) return null;
    var host = sp.closest("[data-sc-name]"), hn = host ? host.getAttribute("data-sc-name") : "";
    var names = {}; T.live().forEach(function (i) { names[i.__rtName] = i.__rtName; if (i.__rtBase) names[i.__rtBase] = i.__rtName; });
    // «Root» — главный блок по адресу без имени файла (…/?edit): это страница index.html
    var comp = names[hn] || names[hn + ".html"] || (hn === "Root" ? names[(Lay && Lay.FILE) || "index.html"] : null) || null;
    var isPage = !comp || /\.html(\?|$)/.test(comp);    // страница (в т.ч. book.html?id=…), а не шапка/подвал
    var res = all.filter(function (t) { return t.kind === "text" ? (!comp || t.name === comp) : isPage; });
    return res.length ? res : null;
  }
  function multiline(targets) {
    return targets.some(function (t) { return t.kind === "bookPara" || t.kind === "chapPara" || /blurb|description|gate_text/.test(t.key || ""); });
  }

  function applyTarget(t, v) {
    var L = lang();
    if (t.kind === "text") {
      T.live().forEach(function (i) { if (i.__rtName === t.name) T.setPath(i, t.path, v); });
      (pending.texts[t.name] = pending.texts[t.name] || {})[t.path] = v;
    } else if (t.kind === "book") {
      setBook(t.id, L + "." + t.key, v);
    } else if (t.kind === "bookPara") {
      var b = findBook(t.id), ps = B.paras(b && b[L] && b[L][t.key]);
      ps.splice.apply(ps, [t.i, 1].concat(splitParas(v)));
      setBook(t.id, L + "." + t.key, ps.join("\n\n"));
    } else if (t.kind === "chap") {
      setChap(t.id, L + "." + t.key, v);
    } else if (t.kind === "chapPara") {
      var ch = chapterOf(t.id), cps = B.paras(ch && ch[L] && ch[L].text);
      cps.splice.apply(cps, [t.i, 1].concat(splitParas(v)));
      setChap(t.id, L + ".text", cps.join("\n\n"));
    }
  }

  // картинки книг, которые можно заменить кликом
  function imgTarget(src) {
    if (!src) return null;
    var nc = B.NO_COVER && src.indexOf(B.NO_COVER + "#book=") === 0 ? decodeURIComponent(src.split("#book=")[1]) : null;
    if (nc) return { id: nc, path: "cover" };
    var L = lang(), bs = books();
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b[L] && b[L].cover && src === b[L].cover) return { id: b.id, path: L + ".cover" };
      if (b.cover && src === b.cover) return { id: b.id, path: "cover" };
      // картинка над главой — книжная только на странице чтения (на главной тот же файл может быть фоном героя)
      if (b.chapter_image && src === b.chapter_image && readPageBookId()) return { id: b.id, path: "chapter_image" };
    }
    return null;
  }

  // ---------------------------------------------------------------- разметка страницы
  function unmarkAll() {
    document.querySelectorAll("[data-re-edit]").forEach(function (sp) {
      sp.removeAttribute("data-re-edit"); sp.removeAttribute("contenteditable");
    });
    document.querySelectorAll("[data-re-img]").forEach(function (im) { im.removeAttribute("data-re-img"); });
    document.querySelectorAll("audio").forEach(function (au) { if (au.__reChip) { au.__reChip.remove(); au.__reChip = null; } });
    deselect();
  }
  var scanTimer = 0;
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 120); }
  var scannedLang = null;
  function scan() {
    if (!active) return;
    if (scannedLang !== lang()) { scannedLang = lang(); ui(); }
    index = buildIndex();
    document.querySelectorAll("span.sc-interp").forEach(function (sp) {
      if (sp === editing || sp.closest("#re-root")) return;
      if (targetsFor(sp, sp.textContent)) {
        if (!sp.hasAttribute("data-re-edit")) {
          sp.setAttribute("data-re-edit", "");
          sp.setAttribute("contenteditable", plainOnly ? "plaintext-only" : "true");
        }
      } else if (sp.hasAttribute("data-re-edit")) {
        sp.removeAttribute("data-re-edit"); sp.removeAttribute("contenteditable");
      }
    });
    // любую картинку можно заменить кликом
    document.querySelectorAll("img").forEach(function (im) {
      if (im.closest("#re-root,.re-modal-bg")) return;
      if (!im.hasAttribute("data-re-img")) im.setAttribute("data-re-img", "");
    });
    // у каждого аудиоплеера — кнопка «Заменить запись»
    document.querySelectorAll("audio").forEach(function (au) {
      if (au.closest(".rl-free") || (au.__reChip && au.__reChip.isConnected)) return;
      au.__reChip = chipFor(au);
    });
  }

  function commit(sp) {
    var nv = (sp.innerText || "").replace(/ /g, " ").replace(/\r/g, "");
    var targets = targetsFor(sp, original);
    nv = targets && multiline(targets) ? nv.replace(/\n{3,}/g, "\n\n").trim() : nv.replace(/\s*\n\s*/g, " ").trim();
    sp.textContent = original;            // DOM как был — React сам поставит новый текст
    editing = null;
    if (!targets || nv === original) { scheduleScan(); return; }
    targets.forEach(function (t) { applyTarget(t, nv); });
    T.rerender();
    ui();
    scheduleScan();
  }

  document.addEventListener("focusin", function (e) {
    var sp = e.target.closest && e.target.closest("[data-re-edit]");
    if (!active || !sp) return;
    editing = sp; original = sp.textContent;
  }, true);
  document.addEventListener("focusout", function (e) {
    if (editing && e.target === editing) commit(editing);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (!editing || e.target !== editing) return;
    if (e.key === "Escape") { editing.textContent = original; editing.blur(); e.preventDefault(); }
    else if (e.key === "Enter" && !e.shiftKey) {
      var targets = targetsFor(editing, original) || [];
      if (!multiline(targets)) { e.preventDefault(); editing.blur(); }
    }
  }, true);
  // клик по тексту внутри ссылки/кнопки — правка, а не переход (Ctrl+клик — перейти)
  document.addEventListener("click", function (e) {
    if (!active || e.ctrlKey || e.metaKey || !e.target.closest) return;
    var sp = e.target.closest("[data-re-edit]");
    if (sp) { e.preventDefault(); e.stopPropagation(); if (document.activeElement !== sp) sp.focus(); return; }
    if (e.target.closest(".re-tools,.re-chip,.rl-ft,.rl-grip,.rl-pop,.rl-play,.rl-wave")) return;
    if (e.target.closest(".rl-fi a, [data-rl-f]")) e.preventDefault();
  }, true);
  // вставка — только текст
  document.addEventListener("paste", function (e) {
    if (!editing || plainOnly) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text"));
  }, true);
  window.addEventListener("beforeunload", function (e) {
    if (count()) { e.preventDefault(); e.returnValue = ""; }
  });
  new MutationObserver(function () { if (active && !editing) scheduleScan(); })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  // смена языка (кнопки в шапке пишут vish_lang)
  window.addEventListener("storage", scheduleScan);

  // ---------------------------------------------------------------- картинки
  function pickImage(t) {
    if (!t) return;
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) { status("Файл больше 5 МБ — уменьшите картинку.", true); return; }
      var ext = (f.name.match(/\.(jpe?g|png|webp)$/i) || [".jpg"])[0].toLowerCase().replace(".jpeg", ".jpg");
      var path = "assets/img/books/" + t.id + "-" + t.path.replace(/\W+/g, "-") + "-" + Date.now() + ext;
      pending.uploads[path] = f;
      setBook(t.id, t.path, URL.createObjectURL(f), path);
      T.rerender(); ui(); scheduleScan();
    };
    inp.click();
  }

  // ---------------------------------------------------------------- сохранение
  function b64utf8(s) {
    var bytes = new TextEncoder().encode(s), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64file(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = rej; r.readAsDataURL(f);
    });
  }
  function json(o) { return JSON.stringify(o, null, 2) + "\n"; }

  // собрать итоговые файлы поверх свежей версии из репозитория (чужие правки не затираются)
  async function buildFiles(read) {
    var files = [], k, p;
    // страницы новых книг: копия лендинга «Просто вернуться домой» (book.html) — только если файла ещё нет
    var bookPages = [], readPages = [];
    for (k in pending.bookPages) {
      if (await read(k)) continue;
      var srcPage = await read("book.html");
      if (!srcPage) throw new Error("не найден book.html — не из чего сделать страницу книги");
      var bp = pending.bookPages[k], title = bp.title.replace(/[<>&"]/g, "");
      var html = srcPage.replace("BOOK_ID='home';", "BOOK_ID='" + bp.id + "';")
        .replace(/<link rel="canonical"[^>]*>\n?/, "").replace(/<meta property="og:url"[^>]*>\n?/, "")
        .split("«Просто вернуться домой»").join("«" + title + "»");
      if (html.indexOf("BOOK_ID='" + bp.id + "'") < 0) throw new Error("не удалось подставить книгу в копию book.html");
      files.push({ path: k, text: html });
      bookPages.push(k);
      // страница чтения — копия read.html (макет главы «Просто вернуться домой»)
      var rf = "read-" + bp.id + ".html";
      if (!(await read(rf))) {
        var srcRead = await read("read.html");
        if (!srcRead) throw new Error("не найден read.html — не из чего сделать страницу главы");
        var rhtml = srcRead.replace("DEFAULT_BOOK = 'home';", "DEFAULT_BOOK = '" + bp.id + "';");
        if (rhtml.indexOf("DEFAULT_BOOK = '" + bp.id + "'") < 0) throw new Error("не удалось подставить книгу в копию read.html");
        files.push({ path: rf, text: rhtml });
        readPages.push(rf);
      }
      // глава-заготовка: текст первой главы «Просто вернуться домой» — заменить через «Текст главы»
      var cf = "data/chapters/" + bp.id + ".json";
      if (!(await read(cf))) {
        var home = JSON.parse((await read("data/chapters/home.json")) || "null");
        if (home) { home.book = bp.id; files.push({ path: cf, text: json(home) }); }
      }
    }
    if (Object.keys(pending.texts).length || bookPages.length) {
      var tx = JSON.parse((await read("data/texts.json")) || "{}");
      for (k in pending.texts) { tx[k] = tx[k] || {}; for (p in pending.texts[k]) tx[k][p] = pending.texts[k][p]; }
      bookPages.forEach(function (f) { if (!tx[f] && tx["book.html"]) tx[f] = JSON.parse(JSON.stringify(tx["book.html"])); });
      readPages.forEach(function (f) { if (!tx[f] && tx["read.html"]) tx[f] = JSON.parse(JSON.stringify(tx["read.html"])); });
      files.push({ path: "data/texts.json", text: json(tx) });
    }
    if (Object.keys(pending.books).length || pending.add.length || pending.del.length || pending.order) {
      var cat = JSON.parse((await read("data/books.json")) || '{"books":[]}');
      var list = (cat.books = cat.books || []);
      pending.add.forEach(function (nb) { if (!list.some(function (b) { return b.id === nb.id; })) list.push(JSON.parse(JSON.stringify(nb))); });
      for (k in pending.books) {
        var b = list.filter(function (x) { return x.id === k; })[0];
        if (b) for (p in pending.books[k]) setDeep(b, p, pending.books[k][p]);
      }
      cat.books = list = list.filter(function (b) { return pending.del.indexOf(b.id) < 0; });
      if (pending.order) {
        var ord = pending.order;
        list.sort(function (a, c) {
          var ia = ord.indexOf(a.id), ic = ord.indexOf(c.id);
          return (ia < 0 ? 1e9 : ia) - (ic < 0 ? 1e9 : ic);
        });
      }
      files.push({ path: "data/books.json", text: json(cat) });
    }
    for (k in pending.chapters) {
      var path = "data/chapters/" + k + ".json";
      var ch = JSON.parse((await read(path)) || "null") || { book: k };
      for (p in pending.chapters[k]) setDeep(ch, p, pending.chapters[k][p]);
      files.push({ path: path, text: json(ch) });
    }
    var lay = pending.layout, lp = Object.keys(lay.pages);
    if (Object.keys(lay.media).length || lp.length || lay.global || bookPages.length) {
      var lj = JSON.parse((await read("data/layout.json")) || "{}");
      lj.media = lj.media || {}; lj.pages = lj.pages || {};
      for (k in lay.media) lj.media[k] = lay.media[k];
      lp.forEach(function (pg) {
        var src = lay.pages[pg], dst = (lj.pages[pg] = lj.pages[pg] || {});
        if (src.hidden) dst.hidden = src.hidden;
        if (src.media) { dst.media = dst.media || {}; for (var mk in src.media) dst.media[mk] = src.media[mk]; }
        if (src.order) dst.order = src.order;
        if (src.custom) dst.custom = src.custom;
        if (src.moves) dst.moves = src.moves;
        if (src.free) {
          dst.free = dst.free || {};
          for (var z in src.free) { if (src.free[z] && src.free[z].items && src.free[z].items.length) dst.free[z] = src.free[z]; else delete dst.free[z]; }
        }
      });
      // новая страница книги начинает с того же конструктора, что и book.html
      bookPages.forEach(function (f) { if (!lj.pages[f] && lj.pages["book.html"]) lj.pages[f] = JSON.parse(JSON.stringify(lj.pages["book.html"])); });
      readPages.forEach(function (f) { if (!lj.pages[f] && lj.pages["read.html"]) lj.pages[f] = JSON.parse(JSON.stringify(lj.pages["read.html"])); });
      if (lay.global) {
        var gdst = (lj.global = lj.global || {}), gsrc = lay.global;
        if (gsrc.moves) gdst.moves = gsrc.moves;
        if (gsrc.free) {
          gdst.free = gdst.free || {};
          for (var gz in gsrc.free) { if (gsrc.free[gz] && gsrc.free[gz].items && gsrc.free[gz].items.length) gdst.free[gz] = gsrc.free[gz]; else delete gdst.free[gz]; }
        }
      }
      files.push({ path: "data/layout.json", text: json(lj) });
    }
    // новые страницы из ссылок кнопок — только если такого файла ещё нет (существующие не перезаписываем)
    var newPages = Object.keys(pending.newPages);
    if (newPages.length) {
      var tpl = await fetch("assets/new-page.template.html", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; });
      if (!tpl) throw new Error("не найден шаблон новой страницы assets/new-page.template.html");
      for (var np = 0; np < newPages.length; np++) {
        if (!(await read(newPages[np]))) files.push({ path: newPages[np], text: tpl });
      }
    }
    // загружаем только файлы, на которые что-то ссылается (заменили дважды — первый не нужен)
    var refs = files.map(function (f) { return f.text || ""; }).join("\n");
    for (p in pending.uploads) if (refs.indexOf(p) >= 0) files.push({ path: p, file: pending.uploads[p] });
    return files;
  }

  // локальный сервер редактора (scripts/edit-server.py); со страницы Live Server сохраняем через него
  var LOCAL_SERVER = "http://localhost:8765", localBase = "";
  var LocalBackend = {
    name: "local",
    read: function (path) {
      return fetch(path, { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : null; });
    },
    write: async function (files) {
      var out = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        out.push({ path: f.path, base64: f.file ? await b64file(f.file) : b64utf8(f.text) });
      }
      var r = await fetch(localBase + "/__edit/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: out }) });
      if (!r.ok) throw new Error("Локальный сервер: " + (await r.text()));
    }
  };

  function GitHubBackend(token) {
    var api = "https://api.github.com/repos/" + T.REPO;
    function gh(method, url, body) {
      return fetch(api + url, {
        method: method, cache: "no-store",
        headers: Object.assign({ Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }, body ? { "Content-Type": "application/json" } : {}),
        body: body ? JSON.stringify(body) : undefined
      }).then(async function (r) {
        if (r.status === 404 && method === "GET") return null;
        if (!r.ok) {
          var msg = ""; try { msg = (await r.json()).message; } catch (e) {}
          var err = new Error("GitHub " + r.status + (msg ? ": " + msg : "")); err.status = r.status; throw err;
        }
        return r.status === 204 ? null : r.json();
      });
    }
    var base = null;
    return {
      name: "github",
      check: async function () {
        var repo = await gh("GET", "");
        if (!repo) throw new Error("Репозиторий " + T.REPO + " не найден или токен не даёт к нему доступа.");
        if (!repo.permissions || !repo.permissions.push) throw new Error("У этого аккаунта GitHub нет прав на запись в " + T.REPO + ". Попросите владельца добавить вас в Collaborators.");
      },
      read: async function (path) {
        if (!base) base = (await gh("GET", "/git/ref/heads/" + T.BRANCH)).object.sha;
        var r = await fetch(api + "/contents/" + path + "?ref=" + base, { cache: "no-store", headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json" } });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("GitHub " + r.status + " при чтении " + path);
        return r.text();
      },
      write: async function (files, message) {
        if (!base) base = (await gh("GET", "/git/ref/heads/" + T.BRANCH)).object.sha;
        var commit = await gh("GET", "/git/commits/" + base);
        var tree = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          var blob = await gh("POST", "/git/blobs", { content: f.file ? await b64file(f.file) : b64utf8(f.text), encoding: "base64" });
          tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }
        var nt = await gh("POST", "/git/trees", { base_tree: commit.tree.sha, tree: tree });
        var nc = await gh("POST", "/git/commits", { message: message, tree: nt.sha, parents: [base] });
        await gh("PATCH", "/git/refs/heads/" + T.BRANCH, { sha: nc.sha });
      }
    };
  }

  async function backend() {
    if (T.isLocal || location.protocol === "file:") {
      var bases = location.protocol === "file:" ? [LOCAL_SERVER] : ["", LOCAL_SERVER];
      for (var bi = 0; bi < bases.length; bi++) {
        try { var r = await fetch(bases[bi] + "/__edit/ping", { cache: "no-store" }); if (r.ok) { localBase = bases[bi]; return LocalBackend; } } catch (e) {}
      }
    }
    // на своём компьютере сохраняем только через scripts/edit-server.py — без входа в GitHub
    if (T.isLocal || location.protocol === "file:") {
      throw new Error("не запущен локальный сервер редактора. Запустите «python scripts/edit-server.py» в папке Roni-Site " +
        "и нажмите «Сохранить» ещё раз — правки запишутся прямо в файлы проекта.");
    }
    var token = ls("roni_gh_token");
    if (!token) { tokenDialog(); return null; }
    var be = GitHubBackend(token);
    await be.check();
    return be;
  }

  var saving = false;
  async function save() {
    if (saving || !count()) return;
    if (editing) editing.blur();
    saving = true; status("Сохраняю…");
    try {
      for (var attempt = 0; attempt < 2; attempt++) {
        var be = await backend();
        if (!be) { saving = false; status(""); return; }
        var files = await buildFiles(be.read);
        var names = files.map(function (f) { return f.path; }).join(", ");
        try {
          await be.write(files, "Правка на сайте: " + names);
          break;
        } catch (e) {
          // кто-то сохранил одновременно — перечитываем свежую версию и пробуем ещё раз
          if (e.status === 422 && attempt === 0) continue;
          throw e;
        }
      }
      pending = fresh();
      ui();
      status(be.name === "local" ? "Сохранено в файлы проекта." : "Сохранено. Сайт обновится через 1–2 минуты.");
    } catch (e) {
      console.error(e);
      if (e.status === 401) ls("roni_gh_token", null);
      status("Не сохранилось: " + e.message, true);
    }
    saving = false;
  }

  // ---------------------------------------------------------------- интерфейс
  var CSS = [
    "[data-re-edit]{border-radius:2px;cursor:text}",
    "[data-re-edit]:hover{outline:1px dashed #e6aa5a;outline-offset:3px}",
    "[data-re-edit]:focus{outline:2px solid #e6aa5a;background:rgba(0,0,0,.35)}",
    "img[data-re-img]{cursor:pointer}",
    "img[data-re-img]:hover{filter:brightness(1.1)}",
    "#re-root{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1d1f}",
    "#re-root *{box-sizing:border-box}",
    "#re-root .re-panel{background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.45);padding:12px 14px;max-width:min(380px,calc(100vw - 32px))}",
    "#re-root .re-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
    "#re-root button{font:inherit;border:1px solid #d0d0d6;background:#f4f4f6;color:#1d1d1f;border-radius:8px;padding:7px 12px;cursor:pointer}",
    "#re-root button:hover{background:#ebebef}",
    "#re-root button.re-main{background:#c9842f;border-color:#c9842f;color:#fff;font-weight:600}",
    "#re-root button.re-main:disabled{opacity:.45;cursor:default}",
    "#re-root .re-fabs{display:flex;gap:6px;align-items:center}",
    "#re-root .re-fab-x{border-radius:999px;width:34px;height:34px;padding:0;background:rgba(255,255,255,.92);box-shadow:0 6px 24px rgba(0,0,0,.4)}",
    "#re-root .re-fab{background:#c9842f;border-color:#c9842f;color:#fff;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.4);padding:10px 16px;border-radius:999px}",
    "#re-root .re-note{font-size:12.5px;color:#55555c;margin:8px 0 0}",
    "#re-root .re-status{font-size:13px;margin-top:8px}",
    "#re-root .re-err{color:#b3261e}",
    "#re-root a{color:#a3621a}",
    ".re-modal-bg{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 16px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1d1f}",
    ".re-modal{background:#fff;border-radius:14px;width:min(760px,100%);padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5)}",
    ".re-modal h2{font:600 20px system-ui,sans-serif;margin:0 0 6px}",
    ".re-modal h3{font:600 16px system-ui,sans-serif;margin:0}",
    ".re-modal p{margin:6px 0 12px;color:#55555c}",
    ".re-modal label{display:block;font-size:12.5px;color:#55555c;margin:10px 0 4px}",
    ".re-modal input[type=text],.re-modal input[type=password],.re-modal select,.re-modal textarea{width:100%;font:14px system-ui,sans-serif;padding:8px 10px;border:1px solid #c8c8ce;border-radius:8px;background:#fff;color:#1d1d1f}",
    ".re-modal textarea{min-height:90px;resize:vertical}",
    ".re-modal .re-big{min-height:360px;font:15px/1.6 Georgia,serif}",
    ".re-modal button{font:inherit;border:1px solid #d0d0d6;background:#f4f4f6;border-radius:8px;padding:7px 12px;cursor:pointer;color:#1d1d1f}",
    ".re-modal button.re-main{background:#c9842f;border-color:#c9842f;color:#fff;font-weight:600}",
    ".re-modal button.re-danger{color:#b3261e}",
    ".re-modal .re-book{border:1px solid #e2e2e6;border-radius:10px;padding:14px;margin:12px 0}",
    ".re-modal .re-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px}",
    ".re-modal .re-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
    ".re-modal .re-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}",
    ".re-modal a{color:#a3621a}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (k === "on") for (var ev in v) e.addEventListener(ev, v[ev]);
      else if (k === "text") e.textContent = v;
      else if (v === true) e.setAttribute(k, "");
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  var root = el("div", { id: "re-root" });
  var statusMsg = "", statusErr = false;
  function status(msg, err) { statusMsg = msg; statusErr = !!err; ui(); }

  function readPageBookId() {
    if (page() === "read.html") return B.param("book") || "home";
    var m = page().match(/^read-(.+)\.html$/);                 // страница чтения новой книги
    return m ? (B.param("book") || m[1]) : null;
  }
  function pageBookId() {
    if (readPageBookId()) return readPageBookId();
    if (page() === "books.html") return B.param("id");
    if (page() === "book.html") return "home";
    var m = page().match(/^book-(.+)\.html$/);                 // страница новой книги
    return m ? m[1] : null;
  }

  function ui() {
    root.textContent = "";
    if (!active) {
      root.appendChild(el("div", { class: "re-fabs" }, [
        el("button", { class: "re-fab", on: { click: function () { setActive(true); } } }, ["✎ Редактировать"]),
        el("button", { class: "re-fab-x", title: "Убрать редактор из этой вкладки (вернуть — открыть сайт с ?edit)", on: { click: function () {
          try { sessionStorage.removeItem("roni_edit"); sessionStorage.removeItem("roni_edit_on"); } catch (e) {}
          location.reload();
        } } }, ["✕"])
      ]));
      return;
    }
    var n = count(), L = lang();
    var panel = el("div", { class: "re-panel" }, [
      el("div", { class: "re-row", style: "justify-content:space-between;margin-bottom:8px" }, [
        el("strong", { text: "Редактирование" }),
        el("span", { style: "font-size:12.5px;color:#55555c", text: n ? "несохранённых правок: " + n : "правок нет" })
      ]),
      el("div", { class: "re-row" }, [
        el("button", { class: "re-main", disabled: !n || saving, on: { click: save } }, ["Сохранить"]),
        n ? el("button", { on: { click: discard } }, ["Отменить"]) : null,
        el("button", { on: { click: booksDialog } }, ["Книги"]),
        readPageBookId() ? el("button", { on: { click: chapterDialog } }, ["Текст главы"]) : null,
        pageBookId() ? el("button", { on: { click: function () { chapterAudio(); } } }, ["🎙 Аудио главы"]) : null,
        readPageBookId() && !chapterOf(readPageBookId()) ? el("button", { title: "Подставить макет и текст первой главы «Просто вернуться домой» — потом заменить через «Текст главы»", on: { click: chapterTemplate } }, ["Заготовка главы"]) : null,
        el("button", { title: "Выключить режим правки (несохранённые правки останутся)", on: { click: function () { setActive(false); } } }, ["Закончить"])
      ]),
      el("p", { class: "re-note" }, [
        "Кликните по элементу — появится его панель («⠿ Двигать», «🖼 Заменить картинку», «Скрыть») и панель секции («+ Элемент»). Esc — снять выделение. Сейчас правится ",
        el("b", { text: LANG_NAMES[L] }), " — другие языки переключайте в шапке сайта. Ctrl+клик — перейти по ссылке."
      ]),
      statusMsg ? el("div", { class: "re-status" + (statusErr ? " re-err" : ""), text: statusMsg }) : null
    ]);
    root.appendChild(panel);
  }
  function setActive(on) {
    if (editing) editing.blur();
    active = on; ss("roni_edit_on", on ? "1" : null);
    if (on) scan(); else unmarkAll();
    if (Lay) Lay.setEditing(on);
    ui();
  }
  function discard() {
    if (!confirm("Отменить все несохранённые правки на этой странице?")) return;
    pending = fresh();
    location.reload();
  }

  function modal(children, onClose) {
    var bg = el("div", { class: "re-modal-bg" });
    var box = el("div", { class: "re-modal" }, children);
    bg.appendChild(box);
    function close() { bg.remove(); if (onClose) onClose(); }
    bg.addEventListener("mousedown", function (e) { if (e.target === bg) close(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { document.removeEventListener("keydown", esc); close(); } });
    document.body.appendChild(bg);
    return close;
  }

  // ---- токен GitHub ----
  function tokenDialog() {
    var inp = el("input", { type: "password", placeholder: "github_pat_… или ghp_…", autocomplete: "off" });
    var close = modal([
      el("h2", { text: "Вход в GitHub" }),
      el("p", {}, ["Чтобы сохранять правки на сайт, нужен токен GitHub аккаунта, у которого есть право записи в репозиторий ",
        el("b", { text: T.REPO }), ". Как его получить — в docs/ADMIN.md. Токен хранится только в этом браузере."]),
      el("label", { text: "Токен" }), inp,
      el("div", { class: "re-foot" }, [
        el("button", { on: { click: function () { close(); } } }, ["Отмена"]),
        el("button", { class: "re-main", on: { click: function () {
          var v = inp.value.trim(); if (!v) return;
          ls("roni_gh_token", v); close(); save();
        } } }, ["Войти и сохранить"])
      ])
    ]);
    setTimeout(function () { inp.focus(); }, 0);
  }

  // ---- книги: настройки, порядок, добавление ----
  function moveBook(id, d) {
    var list = B.cached().books || [], i = list.findIndex(function (x) { return x.id === id; });
    if (i < 0 || i + d < 0 || i + d >= list.length) return;
    var b = list.splice(i, 1)[0]; list.splice(i + d, 0, b);
    pending.order = list.map(function (x) { return x.id; });
    T.rerender(); ui();
  }
  function removeBook(id) {
    var list = B.cached().books || [], i = list.findIndex(function (x) { return x.id === id; });
    if (i < 0) return false;
    var b = list[i];
    if (!confirm("Удалить книгу «" + (B.field(b, lang(), "title") || b.id) + "» из каталога? Текст главы останется в файлах.")) return false;
    list.splice(i, 1);
    delete pending.books[b.id];
    if (b.page) delete pending.bookPages[b.page];
    var wasNew = pending.add.some(function (x) { return x.id === b.id; });
    pending.add = pending.add.filter(function (x) { return x.id !== b.id; });
    if (!wasNew) pending.del.push(b.id);
    if (pending.order) pending.order = list.map(function (x) { return x.id; });
    T.rerender(); ui();
    return true;
  }
  function booksDialog(onlyId) {
    if (typeof onlyId !== "string") onlyId = null;
    var L = lang(), list = B.cached().books;
    if (!list) { status("Каталог книг ещё не загрузился.", true); return; }
    var body = el("div");
    var close = modal([
      el("h2", { text: onlyId ? "Настройки книги" : "Книги" }),
      el("p", { text: "Названия и описания удобнее править прямо на страницах. Здесь — то, чего не видно в тексте. Поля с ценой и описанием — для языка: " + LANG_NAMES[L] + "." }),
      body
    ], function () { T.rerender(); ui(); scheduleScan(); });

    function changed() { T.rerender(); ui(); }
    function input(label, value, onchange, opts) {
      opts = opts || {};
      var tag = opts.area ? "textarea" : "input";
      var i = el(tag, { type: opts.area ? null : "text", placeholder: opts.ph || "" });
      i.value = value || "";
      i.addEventListener("change", function () { onchange(i.value); changed(); });
      return el("div", {}, [el("label", { text: label }), i, opts.hint ? el("div", { style: "font-size:12px;color:#77777d;margin-top:3px", text: opts.hint }) : null]);
    }
    function select(label, value, options, onchange) {
      var s = el("select");
      options.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (o[0] === value) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { onchange(s.value); changed(); });
      return el("div", {}, [el("label", { text: label }), s]);
    }
    function render() {
      body.textContent = "";
      list.forEach(function (b, i) {
        var id = b.id;
        if (onlyId && id !== onlyId) return;
        body.appendChild(el("div", { class: "re-book" }, [
          el("div", { class: "re-row", style: "justify-content:space-between" }, [
            el("h3", { text: (B.field(b, L, "title") || "(без названия)") + "  ·  " + id }),
            el("div", { class: "re-row" }, [
              el("button", { title: "Выше", disabled: i === 0, on: { click: function () { moveBook(id, -1); render(); } } }, ["↑"]),
              el("button", { title: "Ниже", disabled: i === list.length - 1, on: { click: function () { moveBook(id, 1); render(); } } }, ["↓"]),
              el("button", { class: "re-danger", on: { click: function () { if (removeBook(id)) { if (onlyId) close(); else render(); } } } }, ["Удалить"])
            ])
          ]),
          el("div", { class: "re-grid" }, [
            select("Статус", b.status || "published", [["published", "Опубликована — можно купить"], ["soon", "Скоро — без «Купить»"]], function (v) { setBook(id, "status", v); }),
            select("Оформление", b.theme || "classic", [["classic", "Классика — тёплое золото"], ["noir", "Нуар — тёмный детектив"]], function (v) { setBook(id, "theme", v); }),
            input("Цена (" + LANG_NAMES[L] + ")", b[L] && b[L].price, function (v) { setBook(id, L + ".price", v); }, { ph: "3.99 €" }),
            input("Ссылка на Amazon", b.amazon, function (v) { setBook(id, "amazon", v); }, { ph: "https://www.amazon.com/dp/…" }),
            input("Название (" + LANG_NAMES[L] + ")", b[L] && b[L].title, function (v) { setBook(id, L + ".title", v); }),
            input("Подпись под обложкой (" + LANG_NAMES[L] + ")", b[L] && b[L].tag, function (v) { setBook(id, L + ".tag", v); })
          ]),
          el("label", {}, [(function () {
            var c = el("input", { type: "checkbox" }); c.checked = !!b.featured;
            c.addEventListener("change", function () { setBook(id, "featured", c.checked); changed(); });
            return c;
          })(), " Большой блок на главной (если отмечено несколько — показывается первая)"]),
          input("Короткое описание (" + LANG_NAMES[L] + ")", b[L] && b[L].blurb, function (v) { setBook(id, L + ".blurb", v.trim()); }, { area: true }),
          input("Полное описание для страницы книги (" + LANG_NAMES[L] + ")", b[L] && b[L].description, function (v) { setBook(id, L + ".description", v.trim()); },
            { area: true, hint: "Абзацы — через пустую строку. Пусто — показывается короткое описание." }),
          el("div", { class: "re-row", style: "margin-top:12px" }, [
            el("button", { on: { click: function () { pickImage({ id: id, path: "cover" }); } } }, [b.cover ? "Заменить обложку" : "Загрузить обложку"]),
            el("button", { on: { click: function () { pickImage({ id: id, path: "chapter_image" }); } } }, [b.chapter_image ? "Заменить картинку над главой" : "Картинка над главой"]),
            el("a", { href: b.page || ("books.html?id=" + encodeURIComponent(id)) }, ["Страница книги"]),
            el("a", { href: "read.html?book=" + encodeURIComponent(id) }, ["Первая глава"])
          ])
        ]));
      });
      if (onlyId) { body.appendChild(el("div", { class: "re-foot" }, [el("button", { class: "re-main", on: { click: function () { close(); } } }, ["Закрыть"])])); return; }
      var idInp = el("input", { type: "text", placeholder: "код латиницей, например ghost-2" });
      var tInp = el("input", { type: "text", placeholder: "Название книги" });
      var err = el("div", { class: "re-err", style: "font-size:13px;margin-top:6px" });
      body.appendChild(el("div", { class: "re-book", style: "background:#faf7f2" }, [
        el("h3", { text: "Добавить книгу" }),
        el("div", { class: "re-grid" }, [
          el("div", {}, [el("label", { text: "Код (из него адрес страницы: books.html?id=код)" }), idInp]),
          el("div", {}, [el("label", { text: "Название (" + LANG_NAMES[L] + ")" }), tInp])
        ]),
        err,
        el("div", { class: "re-row", style: "margin-top:10px" }, [el("button", { class: "re-main", on: { click: function () {
          var id = idInp.value.trim().toLowerCase(), title = tInp.value.trim();
          if (!/^[a-z0-9-]+$/.test(id)) { err.textContent = "Код: только латинские буквы, цифры и дефис."; return; }
          if (list.some(function (b) { return b.id === id; })) { err.textContent = "Книга с таким кодом уже есть."; return; }
          if (!title) { err.textContent = "Введите название."; return; }
          var nb = { id: id, status: "soon", featured: false, theme: "classic", cover: "", chapter_image: "", page: "", amazon: "", ru: { title: title } };
          if (L !== "ru") nb[L] = { title: title };
          pending.del = pending.del.filter(function (x) { return x !== id; });
          pending.add.push(JSON.parse(JSON.stringify(nb)));
          list.push(nb);
          if (pending.order) pending.order.push(id);
          changed(); render();
          // новую книгу сохраняем сразу — чтобы не потерять её при переходе на её страницу
          close();
          status("Сохраняю новую книгу «" + title + "»…");
          save();
        } } }, ["Добавить"])]),
        el("p", { style: "margin:10px 0 0;font-size:12.5px", text: "Новая книга появится в каталоге со статусом «Скоро». Она сразу сохранится. Её страница (book.html?id=код) и глава сразу выглядят как «Просто вернуться домой» — меняйте их на сайте; правки касаются только этой книги. Текст главы — кнопкой «Текст главы» на странице чтения." })
      ]));
      body.appendChild(el("div", { class: "re-foot" }, [el("button", { class: "re-main", on: { click: function () { close(); } } }, ["Закрыть"])]));
    }
    render();
  }

  // ---- глава-заготовка: текст первой главы «Просто вернуться домой» ----
  function chapterTemplate() {
    var id = readPageBookId(), book = findBook(id);
    if (!book) { status("Книги «" + id + "» нет в каталоге — сначала добавьте её в «Книги».", true); return; }
    B.chapter("home").then(function (home) {
      LANGS.forEach(function (L) {
        var h = home[L]; if (!h) return;
        Object.keys(h).forEach(function (k) { setChap(id, L + "." + k, h[k]); });
      });
      var c = chapterOf(id);
      T.live().forEach(function (i) { if (i.__rtBase === page()) i.setState({ book: book, chapter: c, notFound: false }); });
      T.rerender(); ui(); scheduleScan();
      status("Заготовка подставлена. Замените текст через «Текст главы» и нажмите «Сохранить».");
    }, function () { status("Не нашлась глава «Просто вернуться домой» (data/chapters/home.json).", true); });
  }

  // ---- первая глава целиком (read.html) ----
  function chapterDialog() {
    var id = readPageBookId(), L = lang();
    var book = findBook(id);
    if (!book) { status("Книги «" + id + "» нет в каталоге — сначала добавьте её в «Книги».", true); return; }
    var ch = chapterOf(id) || {};
    var own = ch[L] || {};
    var fields = {
      chapter: el("input", { type: "text", placeholder: "Глава первая" }),
      text: el("textarea", { class: "re-big" }),
      gate_title: el("input", { type: "text", placeholder: "Продолжение — в книге" }),
      gate_text: el("textarea", {})
    };
    Object.keys(fields).forEach(function (k) { fields[k].value = own[k] || ""; });
    var close = modal([
      el("h2", { text: "Первая глава: " + (B.field(book, L, "title") || id) }),
      el("p", { text: "Язык: " + LANG_NAMES[L] + ". Абзацы разделяйте пустой строкой, реплики начинайте с «— ». Если текста на этом языке нет — читатель увидит русский." }),
      el("label", { text: "Название главы" }), fields.chapter,
      el("label", { text: "Текст главы" }), fields.text,
      el("label", { text: "Заголовок в конце главы" }), fields.gate_title,
      el("label", { text: "Текст в конце главы" }), fields.gate_text,
      el("div", { class: "re-foot" }, [
        el("button", { on: { click: function () { close(); } } }, ["Отмена"]),
        el("button", { class: "re-main", on: { click: function () {
          Object.keys(fields).forEach(function (k) {
            var v = fields[k].value.replace(/\r/g, "").trim();
            if (k === "text") v = B.paras(v).join("\n\n");
            if (v !== (own[k] || "")) setChap(id, L + "." + k, v);
          });
          // страница чтения могла показать «Глава не найдена» — подставляем данные
          var c = chapterOf(id);
          T.live().forEach(function (i) {
            if (i.__rtBase === page()) i.setState({ book: book, chapter: c, notFound: false });
          });
          close(); T.rerender(); ui(); scheduleScan();
        } } }, ["Готово"])
      ])
    ]);
  }

  // ================================================================ КОНСТРУКТОР
  // свободные элементы в секциях, свои секции, порядок секций, картинки/аудио (данные — assets/layout.js)
  var Lay = window.RoniLayout || null;
  var IMG_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
  var AUDIO_ACCEPT = "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav";
  var PH = {
    "heading.text": "Заголовок", "text.text": "Текст. Новый абзац — Enter", "quote.text": "Цитата",
    "quote.author": "— автор", "image.caption": "Подпись", "audio.title": "Название записи",
    "button.label": "Кнопка"
  };
  var TYPES = [
    ["heading", "Заголовок"], ["text", "Текст"], ["button", "🔗 Кнопка"], ["image", "🖼 Картинка"],
    ["audio", "🎙 Аудио"], ["quote", "Цитата"], ["book", "📖 Книга"]
  ];
  var WIDTH = { heading: 60, text: 46, quote: 46, image: 30, audio: 46, book: 50 };

  function slug(s) {
    return String(s || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  }
  function upload(f) {
    var ext = (f.name.match(/\.[a-z0-9]+$/i) || [".bin"])[0].toLowerCase().replace(".jpeg", ".jpg");
    var path = "assets/uploads/" + slug(f.name) + "-" + Date.now() + ext;
    pending.uploads[path] = f;
    if (Lay) Lay.preview[path] = URL.createObjectURL(f);
    return path;
  }
  function pickFile(accept, maxMB, cb) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = accept;
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > maxMB * 1048576) { status("Файл больше " + maxMB + " МБ — уменьшите его.", true); return; }
      cb(f);
    };
    inp.click();
  }
  // При «Размере текста» на <html> стоит CSS zoom: getBoundingClientRect/scrollY/clientX — в увеличенных px,
  // а style.top/left/width — в обычных (браузер их ещё раз умножит). Z() — масштаб, vr() — рамка элемента в px страницы.
  function Z() { return parseFloat(getComputedStyle(document.documentElement).zoom) || 1; }
  function vr(node) {
    var r = node.getBoundingClientRect(), z = Z();
    return { top: (r.top + scrollY) / z, left: (r.left + scrollX) / z, right: (r.right + scrollX) / z, bottom: (r.bottom + scrollY) / z,
      width: r.width / z, height: r.height / z, vtop: r.top / z };
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function pagePending() {
    if (!pending.layout.pages[Lay.PAGE]) pending.layout.pages[Lay.PAGE] = Lay.PAGE !== Lay.FILE ? JSON.parse(JSON.stringify(Lay.pageForEdit())) : {};
    return pending.layout.pages[Lay.PAGE];
  }
  function bucketPending(key) { return key === "footer" ? (pending.layout.global = pending.layout.global || {}) : pagePending(); }

  // ---- картинки и аудио сайта ----
  function setMedia(orig, path, node) {
    if (node && node.closest('[data-sc-name="SiteFooter"]')) {
      var d = Lay.data(); d.media = d.media || {};
      d.media[orig] = path;
      pending.layout.media[orig] = path;
    } else {
      var pg = Lay.pageForEdit(); pg.media = pg.media || {};
      pg.media[orig] = path;
      var pp = pagePending(); pp.media = pp.media || {}; pp.media[orig] = path;
    }
    Lay.apply(); ui();
  }
  function replaceImage(im) {
    var fi = im.closest(".rl-fi");
    if (fi) {
      var key = fi.closest(".rl-free").getAttribute("data-rl-layer"), id = fi.getAttribute("data-rl-id");
      return pickFile(IMG_ACCEPT, 8, function (f) { editItem(key, id, function (x) { x.src = upload(f); }); });
    }
    var src = im.getAttribute("src"), bt = imgTarget(src);
    if (bt) return pickImage(bt);                      // обложка книги → в карточку книги
    var orig = im.getAttribute("data-rl-orig") || src;
    if (!orig || /^blob:/.test(orig) || !Lay) return;
    pickFile(IMG_ACCEPT, 8, function (f) { setMedia(orig, upload(f), im); });
  }
  function chapterAudio(id) {
    id = id || pageBookId();
    if (!findBook(id)) { status("Сначала добавьте книгу в «Книги».", true); return; }
    pickFile(AUDIO_ACCEPT, 60, function (f) {
      var path = upload(f);
      setBook(id, lang() + ".audio", Lay ? Lay.preview[path] : path, path);
      T.rerender(); ui(); scheduleScan();
      status("Аудио добавлено — не забудьте «Сохранить».");
    });
  }
  function chipFor(au) {
    var bookId = au.getAttribute("data-book-audio");
    function btn(label, fn) {
      return el("button", { type: "button", on: { click: function (e) { e.preventDefault(); e.stopPropagation(); fn(); } } }, [label]);
    }
    var c = el("span", { class: "re-chip" }, [
      btn("🎙 Заменить запись", function () {
        if (bookId) return chapterAudio(bookId);
        pickFile(AUDIO_ACCEPT, 60, function (f) { setMedia(au.getAttribute("data-rl-orig") || au.getAttribute("src"), upload(f), au); });
      }),
      bookId ? btn("✕ Убрать", function () { setBook(bookId, lang() + ".audio", ""); T.rerender(); ui(); }) : null
    ]);
    au.parentNode.insertBefore(c, au.nextSibling);
    return c;
  }

  // ---- свободные элементы секции ----
  function freeItems(key) {
    var pg = Lay.bucketForEdit(key); pg.free = pg.free || {};
    var f = (pg.free[key] = pg.free[key] || { items: [] });
    f.items = f.items || [];
    return f.items;
  }
  function findItem(key, id) { return freeItems(key).filter(function (x) { return x.id === id; })[0]; }
  function commitFree(key, focusId) {
    var pp = bucketPending(key); pp.free = pp.free || {};
    pp.free[key] = JSON.parse(JSON.stringify(Lay.bucketForEdit(key).free[key]));
    Lay.apply(); ui(); scheduleScan();
    if (focusId) setTimeout(function () {
      var f = document.querySelector('.rl-fi[data-rl-id="' + focusId + '"] [data-rl-f]');
      if (f) f.focus();
    }, 60);
  }
  function editItem(key, id, fn) { var it = findItem(key, id); if (!it) return; fn(it); commitFree(key); }
  function layerOf(key) { return document.querySelector('.rl-free[data-rl-layer="' + key + '"]'); }
  function addItem(key, type) {
    var L = lang(), it = { id: uid(), type: type, align: type === "heading" ? "center" : "left" };
    it[L] = {};
    if (WIDTH[type]) it.w = WIDTH[type];
    if (type === "button") it.href = "books.html";
    // ставим посередине видимой части секции
    var layer = layerOf(key), r = layer ? layer.getBoundingClientRect() : { top: 0, height: 400, width: 1000 };
    var vis = Math.min(innerHeight, r.top + r.height) - Math.max(0, r.top);
    var zz = Z();
    it.y = Math.round(Math.max(24, Math.min(r.height / zz - 80, (Math.max(0, -r.top) + Math.max(vis, 200) / 2) / zz - 40)) / 4) * 4;
    it.x = it.w ? Math.round((100 - it.w) / 2) : 42;
    // не класть поверх других элементов: опускаем ниже, пока по высоте есть пересечение
    if (layer) {
      var lw = layer.clientWidth, x1 = it.x / 100 * lw, x2 = x1 + (it.w ? it.w / 100 * lw : 180), guard = 0, hit = true;
      while (hit && guard++ < 60) {
        hit = false;
        Array.prototype.forEach.call(layer.querySelectorAll(".rl-fi"), function (n) {
          var l = n.offsetLeft, t = n.offsetTop;
          if (l < x2 && l + n.offsetWidth > x1 && t < it.y + 60 && t + n.offsetHeight + 16 > it.y) { it.y = t + n.offsetHeight + 16; hit = true; }
        });
      }
    }
    function put() { freeItems(key).push(it); commitFree(key, it.id); }
    if (type === "image") return pickFile(IMG_ACCEPT, 8, function (f) { it.src = upload(f); put(); });
    if (type === "audio") return pickFile(AUDIO_ACCEPT, 60, function (f) { it.src = upload(f); put(); });
    if (type === "book") {
      var go = function () { popover(lastAnchor || document.body, [el("div", { class: "rl-pop-t", text: "Какую книгу показать?" })].concat(bookChooser(function (bid) { it.book = bid; put(); }))); };
      return books().length ? go() : B.list().then(go);
    }
    put();
  }
  function dupItem(key, id) {
    var it = findItem(key, id); if (!it) return;
    var c = JSON.parse(JSON.stringify(it)); c.id = uid();
    var w = it.w || 14, node = document.querySelector('.rl-fi[data-rl-id="' + id + '"]');
    var lw = layerOf(key).offsetWidth;
    if (node && !it.w) w = node.offsetWidth / lw * 100;
    if (it.x + 2 * w + 2 <= 100) c.x = Math.round((it.x + w + 2) * 10) / 10;       // рядом справа
    else c.y = it.y + (node ? node.offsetHeight : 60) + 16;                          // или ниже
    freeItems(key).push(c);
    commitFree(key);
  }
  function delItem(key, id) {
    var items = freeItems(key), i = items.findIndex(function (x) { return x.id === id; });
    if (i >= 0) { items.splice(i, 1); commitFree(key); }
  }

  var pop = null, lastAnchor = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function popover(anchor, kids) {
    closePop();
    pop = el("div", { class: "rl-pop" }, kids);
    document.body.appendChild(pop);
    var r = vr(anchor), z = Z();
    pop.style.top = (r.bottom + 6) + "px";
    pop.style.left = Math.max(8, Math.min(r.left, (scrollX + innerWidth) / z - pop.offsetWidth - 8)) + "px";
    var inp = pop.querySelector("input"); if (inp) setTimeout(function () { inp.focus(); }, 0);
    return pop;
  }
  document.addEventListener("mousedown", function (e) { if (pop && !pop.contains(e.target)) closePop(); }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); }, true);

  function bookChooser(onPick) {
    var list = books();
    if (!list.length) return [el("span", { text: "Книги ещё не загрузились" })];
    return list.map(function (b) {
      return el("button", { type: "button", on: { click: function () { closePop(); onPick(b.id); } } }, [B.field(b, lang(), "title") || b.id]);
    });
  }
  function openItemMenu(anchor, key) {
    lastAnchor = anchor;
    popover(anchor, [el("div", { class: "rl-pop-t", text: "Добавить в секцию:" })].concat(TYPES.map(function (t) {
      return el("button", { type: "button", on: { click: function () { closePop(); addItem(key, t[0]); } } }, [t[1]]);
    })));
  }
  // ссылка на свою страницу, которой ещё нет → создаём её (шапка, подвал, секция «Новая страница»)
  var TRANSLIT = { "а": "a", "б": "b", "в": "v", "г": "g", "ґ": "g", "д": "d", "е": "e", "ё": "e", "є": "ye", "ж": "zh", "з": "z", "и": "i", "і": "i", "ї": "yi",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya" };
  function pageSlug(s) {
    return String(s).toLowerCase().replace(/\.html?$/, "").split("").map(function (c) { return TRANSLIT[c] != null ? TRANSLIT[c] : c; }).join("")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function isPageLink(h) {
    return !!h && !/^(https?:|mailto:|tel:|#|\/\/)/i.test(h) && !/[?#\/]/.test(h) && !/\.(jpe?g|png|webp|gif|pdf|mp3|m4a|zip)$/i.test(h);
  }
  async function ensurePage(href) {
    if (!isPageLink(href)) return href;
    var slug = pageSlug(href); if (!slug) return href;
    var file = slug + ".html";
    if (pending.newPages[file]) return file;
    var exists = false;
    try { exists = (await fetch(file, { method: "HEAD", cache: "no-store" })).ok; } catch (e) {}
    if (!exists) {
      pending.newPages[file] = {};
      ui();
      status("Страница «" + file + "» будет создана при сохранении: шапка, подвал и секция «Новая страница».");
    }
    return file;
  }
  function linkPopover(anchor, key, id) {
    var it = findItem(key, id);
    var inp = el("input", { type: "text", placeholder: "events, О нас, books.html или https://…" });
    inp.value = it.href || "";
    async function ok() {
      closePop();
      var h = await ensurePage(inp.value.trim());
      editItem(key, id, function (x) { x.href = h; });
    }
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") ok(); });
    popover(anchor, [el("div", { class: "rl-pop-t", text: "Куда ведёт кнопка. Новое имя — будет создана новая страница." }), inp, el("button", { type: "button", class: "re-main", on: { click: ok } }, ["OK"])]);
  }

  // правка текста внутри элемента
  function editableField(f, getVal, setVal, multi, ph) {
    f.setAttribute("contenteditable", plainOnly ? "plaintext-only" : "true");
    f.setAttribute("data-rl-ph", ph);
    if (multi && !f.textContent.trim()) f.textContent = "";
    f.addEventListener("focus", function () { f.__orig = f.innerText; });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { f.innerText = f.__orig; f.blur(); }
      else if (e.key === "Enter" && !e.shiftKey && !multi) { e.preventDefault(); f.blur(); }
    });
    f.addEventListener("blur", function () {
      var v = (f.innerText || "").replace(/ /g, " ").replace(/\r/g, "");
      v = multi ? v.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).join("\n\n") : v.replace(/\s*\n\s*/g, " ").trim();
      if (v !== getVal()) setVal(v);
    });
  }

  var ALIGN_NEXT = { left: "center", center: "right", right: "left" };
  var ALIGN_ICON = { left: "⇤", center: "↔", right: "⇥" };
  if (Lay) Lay.onFree = function (layer, key, items) {
    if (!active) return;
    Array.prototype.forEach.call(layer.querySelectorAll(".rl-fi"), function (node) {
      var id = node.getAttribute("data-rl-id"), it = items.filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      node.classList.add("rl-ed");
      if (selFree && selFree.getAttribute("data-rl-id") === id) setSelFree(node);
      node.querySelectorAll("[data-rl-f]").forEach(function (f) {
        var field = f.getAttribute("data-rl-f");
        editableField(f, function () { var L = lang(); return (it[L] && it[L][field]) || ""; },
          function (v) { editItem(key, id, function (x) { var L = lang(); x[L] = x[L] || {}; x[L][field] = v; }); },
          f.hasAttribute("data-rl-multi"), PH[it.type + "." + field] || "Текст");
      });
      function tb(label, title, fn) {
        return el("button", { type: "button", title: title, on: { click: function (e) { e.preventDefault(); e.stopPropagation(); fn(e.currentTarget); } } }, [label]);
      }
      var handle = el("button", { type: "button", class: "re-handle", title: "Перетащить (Shift — без привязки)" }, ["⠿"]);
      handle.addEventListener("pointerdown", function (e) { startMove(e, key, id, node, layer); });
      var tools = [handle];
      if (it.type !== "clone") tools.push(tb(ALIGN_ICON[it.align || "left"], "Выравнивание текста", function () { editItem(key, id, function (x) { x.align = ALIGN_NEXT[x.align || "left"]; }); }));
      if (it.type === "image") tools.push(tb("🖼", "Заменить картинку", function () { pickFile(IMG_ACCEPT, 8, function (f) { editItem(key, id, function (x) { x.src = upload(f); }); }); }));
      if (it.type === "audio") tools.push(tb("🎙", "Заменить запись", function () { pickFile(AUDIO_ACCEPT, 60, function (f) { editItem(key, id, function (x) { x.src = upload(f); }); }); }));
      if (it.type === "button") tools.push(tb("🔗", "Куда ведёт кнопка", function (a) { linkPopover(a, key, id); }));
      if (it.type === "book") tools.push(tb("📖", "Другая книга", function (a) { popover(a, bookChooser(function (bid) { editItem(key, id, function (x) { x.book = bid; }); })); }));
      tools.push(tb("⧉", "Дублировать рядом", function () { dupItem(key, id); }));
      tools.push(tb("✕", "Удалить элемент", function () { delItem(key, id); }));
      node.appendChild(el("div", { class: "rl-ft" }, tools));
      if (it.type === "clone") {
        var box = node.querySelector("[data-rl-html]");
        box.setAttribute("contenteditable", "true");
        box.addEventListener("blur", function () {
          var html = Lay.cleanHTML(box.innerHTML);
          if (html !== ((it[lang()] || {}).html || "")) editItem(key, id, function (x) { var L = lang(); x[L] = x[L] || {}; x[L].html = html; });
        });
        var gripH = el("div", { class: "rl-grip rl-grip-b", title: "Потяните, чтобы изменить высоту" });
        gripH.addEventListener("pointerdown", function (e) { startHeight(e, key, id, node); });
        node.appendChild(gripH);
      }
      var grip = el("div", { class: "rl-grip", title: "Потяните, чтобы изменить ширину" });
      grip.addEventListener("pointerdown", function (e) { startResize(e, key, id, node, layer); });
      node.appendChild(grip);
      // картинку, плеер и книгу можно тянуть за само тело
      if (/image|audio|book/.test(it.type)) node.addEventListener("pointerdown", function (e) {
        if (e.target.closest(".rl-ft,.rl-grip,[data-rl-f],.rl-play,.rl-wave")) return;
        startMove(e, key, id, node, layer);
      });
    });
  };

  // ---- перемещение/ширина элемента с привязками ----
  var act = null, guides = [];
  function clearGuides() { guides.forEach(function (g) { g.remove(); }); guides = []; }
  function guide(layer, vertical, pos) {
    var g = el("div", { class: "re-guide " + (vertical ? "re-gv" : "re-gh") });
    g.style[vertical ? "left" : "top"] = pos + "px";
    layer.appendChild(g); guides.push(g);
  }
  function snapLines(layer, selfNode) {
    var W = layer.clientWidth, xs = [0, W / 2, W], ys = [];
    Array.prototype.forEach.call(layer.querySelectorAll(".rl-fi"), function (n) {
      if (n === selfNode) return;
      var l = n.offsetLeft, t = n.offsetTop;
      xs.push(l, l + n.offsetWidth, l + n.offsetWidth / 2);
      ys.push(t, t + n.offsetHeight, t + n.offsetHeight / 2);
    });
    return { xs: xs, ys: ys, W: W };
  }
  function snap(v, lines, own, free) {
    // own — смещения точек элемента (левый край, центр, правый край), lines — куда можно прилипнуть
    var best = null;
    if (!free) own.forEach(function (o) {
      lines.forEach(function (l) { var d = l - (v + o); if (Math.abs(d) <= 6 && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, at: l }; });
    });
    return best ? { v: v + best.d, at: best.at } : { v: v, at: null };
  }
  function begin(e, data) {
    if (e.button !== 0) return false;
    e.preventDefault(); e.stopPropagation();
    if (editing) editing.blur();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    hideTools(); closePop();
    act = data;
    data.node.classList.add("rl-moving");
    document.documentElement.classList.add("re-dragmode");
    window.addEventListener("pointermove", onAct, true);
    window.addEventListener("pointerup", endAct, true);
    return true;
  }
  function startMove(e, key, id, node, layer) {
    begin(e, { mode: "move", key: key, id: id, node: node, layer: layer, sx: e.clientX, sy: e.clientY,
      l0: node.offsetLeft, t0: node.offsetTop, lines: snapLines(layer, node) });
  }
  function startResize(e, key, id, node, layer) {
    begin(e, { mode: "resize", key: key, id: id, node: node, layer: layer, sx: e.clientX, w0: node.offsetWidth, l0: node.offsetLeft, lines: snapLines(layer, node) });
  }
  function startHeight(e, key, id, node) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    var h0 = node.offsetHeight, sy = e.clientY, v = null;
    function mvH(ev) { v = Math.max(1, Math.round(h0 + (ev.clientY - sy) / Z())); node.style.height = v + "px"; }
    function upH() {
      window.removeEventListener("pointermove", mvH, true); window.removeEventListener("pointerup", upH, true);
      justDragged = true; setTimeout(function () { justDragged = false; }, 0);
      if (v != null) editItem(key, id, function (x) { x.h = v; });
    }
    window.addEventListener("pointermove", mvH, true); window.addEventListener("pointerup", upH, true);
  }
  function onAct(e) {
    if (!act) return;
    clearGuides();
    var n = act.node, L = act.lines;
    if (act.mode === "move") {
      var w = n.offsetWidth, h = n.offsetHeight;
      var x = snap(act.l0 + (e.clientX - act.sx) / Z(), L.xs, [0, w / 2, w], e.shiftKey);
      var y = snap(act.t0 + (e.clientY - act.sy) / Z(), L.ys, [0, h / 2, h], e.shiftKey);
      var nx = Math.max(0, Math.min(L.W - w, x.v)), ny = Math.max(0, y.at == null ? Math.round(y.v / 4) * 4 : y.v);
      n.style.left = (nx / L.W * 100) + "%"; n.style.top = ny + "px";
      if (x.at != null) guide(act.layer, true, x.at);
      if (y.at != null) guide(act.layer, false, y.at);
      act.x = nx / L.W * 100; act.y = ny;
    } else {
      var r = snap(act.l0 + act.w0 + (e.clientX - act.sx) / Z(), L.xs, [0], e.shiftKey);
      var nw = Math.max(40, Math.min(L.W - act.l0, r.v - act.l0));
      n.style.width = (nw / L.W * 100) + "%";
      if (r.at != null) guide(act.layer, true, r.at);
      act.w = nw / L.W * 100;
    }
  }
  function endAct() {
    window.removeEventListener("pointermove", onAct, true);
    window.removeEventListener("pointerup", endAct, true);
    document.documentElement.classList.remove("re-dragmode");
    clearGuides();
    var a = act; act = null;
    if (!a) return;
    a.node.classList.remove("rl-moving");
    justDragged = true; setTimeout(function () { justDragged = false; }, 0);
    if (a.mode === "move" && a.x != null) editItem(a.key, a.id, function (x) { x.x = Math.round(a.x * 10) / 10; x.y = Math.round(a.y); });
    if (a.mode === "resize" && a.w != null) editItem(a.key, a.id, function (x) { x.w = Math.round(a.w * 10) / 10; });
  }

  // ---- родные элементы секций: двигать / скрыть ----
  var nFrame = el("div", { class: "re-nframe", style: "display:none" });
  var nBar = el("div", { class: "re-nbar", style: "display:none" });
  document.body.appendChild(nFrame); document.body.appendChild(nBar);
  var nSel = null, nAct = null, nCan = false;
  var gripR = el("div", { class: "re-ngrip re-ngrip-r", title: "Ширина", style: "display:none" });
  var gripB = el("div", { class: "re-ngrip re-ngrip-b", title: "Высота", style: "display:none" });
  document.body.appendChild(gripR); document.body.appendChild(gripB);
  gripR.addEventListener("pointerdown", function (e) { startSize(e, "w"); });
  gripB.addEventListener("pointerdown", function (e) { startSize(e, "h"); });
  // размер родного элемента (ширина/высота в px)
  var sAct = null;
  function startSize(e, dim) {
    if (e.button !== 0 || !nSel) return;
    e.preventDefault(); e.stopPropagation();
    var r = nSel.el.getBoundingClientRect(), x = nSel.el;
    // запомнить родные инлайн-размеры до правки — по ним «↺» вернёт как было (см. setSize в layout.js)
    if (!("__rlOrig_width" in x)) x.__rlOrig_width = x.style.width;
    if (!("__rlOrig_height" in x)) x.__rlOrig_height = x.style.height;
    sAct = { sel: nSel, dim: dim, sx: e.clientX, sy: e.clientY, w0: r.width / Z(), h0: r.height / Z() };
    document.documentElement.classList.add("re-dragmode");
    window.addEventListener("pointermove", sizeMove, true);
    window.addEventListener("pointerup", sizeEnd, true);
  }
  function sizeMove(e) {
    if (!sAct) return;
    if (sAct.dim === "w") { sAct.v = Math.max(1, Math.round(sAct.w0 + (e.clientX - sAct.sx) / Z())); sAct.sel.el.style.width = sAct.v + "px"; }
    else { sAct.v = Math.max(1, Math.round(sAct.h0 + (e.clientY - sAct.sy) / Z())); sAct.sel.el.style.height = sAct.v + "px"; }
    placeFrame();
  }
  function sizeEnd() {
    window.removeEventListener("pointermove", sizeMove, true);
    window.removeEventListener("pointerup", sizeEnd, true);
    document.documentElement.classList.remove("re-dragmode");
    var a = sAct; sAct = null;
    if (!a || a.v == null) return;
    justDragged = true; setTimeout(function () { justDragged = false; }, 0);
    var patch = {}; patch[a.dim] = a.v;
    setMove(a.sel, patch); showNative(a.sel);
  }
  // копия родного элемента → свободный элемент той же секции, чуть ниже-правее
  function cleanClone(node) {
    var c = node.cloneNode(true);
    c.querySelectorAll(".re-chip,[data-rl-own],.rl-free,.rl-spacer").forEach(function (n) { n.remove(); });
    return Lay.cleanHTML(c.outerHTML);
  }
  function cloneNative(sel) {
    var layer = layerOf(sel.key); if (!layer) return;
    var r = sel.el.getBoundingClientRect(), lr = layer.getBoundingClientRect(), lw = lr.width;
    var L = lang(), it = { id: uid(), type: "clone", align: "left" };
    it.w = Math.max(0.05, Math.min(100, Math.round(r.width / lw * 1000) / 10));
    it.h = Math.round(r.height / Z());
    it.x = Math.max(0, Math.min(100 - it.w, Math.round((r.left + 24 - lr.left) / lw * 1000) / 10));
    it.y = Math.max(0, Math.round((r.top - lr.top) / Z() + 24));
    it[L] = { html: cleanClone(sel.el) };
    freeItems(sel.key).push(it);
    hideNative();
    commitFree(sel.key);
    status("Копия добавлена — тяните её за ⠿.");
  }
  function nativeAt(t) {
    if (!t || !t.closest) t = t && t.parentElement;
    if (!t || t.closest(".rl-free,#re-root,.re-tools,.re-nbar,.rl-pop,.re-modal-bg,.re-chip")) return null;
    var sec = t.closest("[data-rl-sec]");
    if (!sec || sec.hasAttribute("data-rl-custom")) return null;
    var e = Lay.pick(t, sec);
    return e ? { sec: sec, key: sec.getAttribute("data-rl-sec"), el: e } : null;
  }
  function moveOf(sel) {
    var path = Lay.pathOf(sel.sec, sel.el), mv = (Lay.bucket(sel.key).moves || {})[sel.key] || {};
    return { path: path, m: (path && mv[path]) || {} };
  }
  function setMove(sel, patch) {
    var path = Lay.pathOf(sel.sec, sel.el); if (!path) return;
    var pg = Lay.bucketForEdit(sel.key); pg.moves = pg.moves || {};
    var mv = (pg.moves[sel.key] = pg.moves[sel.key] || {});
    var cur = Object.assign({}, mv[path] || {}, patch);
    if (!cur.dx && !cur.dy && !cur.w && !cur.h && !cur.hide && !cur.del) delete mv[path]; else mv[path] = cur;
    if (!Object.keys(mv).length) delete pg.moves[sel.key];
    bucketPending(sel.key).moves = JSON.parse(JSON.stringify(pg.moves));
    Lay.apply(); ui();
  }
  function placeFrame() {
    if (!nSel) return;
    var r = vr(nSel.el);
    nFrame.style.cssText = "display:block;top:" + (r.top - 3) + "px;left:" + (r.left - 3) + "px;width:" + (r.width + 6) + "px;height:" + (r.height + 6) + "px";
    nBar.style.display = "flex";
    var top = r.top - nBar.offsetHeight - 8;
    if (r.vtop - nBar.offsetHeight - 8 < 72) top = r.bottom + 8;   // не под шапкой сайта
    nBar.style.top = top + "px";
    nBar.style.left = Math.max(8, r.left - 3) + "px";
    var show = nCan ? "block" : "none";
    gripR.style.display = gripB.style.display = show;
    gripR.style.top = (r.top + r.height / 2 - 14) + "px"; gripR.style.left = (r.right + 1) + "px";
    gripB.style.top = (r.bottom + 1) + "px"; gripB.style.left = (r.left + r.width / 2 - 14) + "px";
  }
  function hideNative() { nFrame.style.display = "none"; nBar.style.display = "none"; gripR.style.display = gripB.style.display = "none"; nSel = null; }
  function nbtn(label, title, fn) {
    return el("button", { type: "button", title: title, on: { click: function (e) { e.preventDefault(); e.stopPropagation(); fn(); } } }, [label]);
  }
  function showNative(sel) {
    nSel = sel;
    var info = moveOf(sel), m = info.m;
    var er = sel.el.getBoundingClientRect(), sr = sel.sec.getBoundingClientRect();
    var big = er.width * er.height > 0.6 * sr.width * sr.height;      // фон на всю секцию — только заменить
    var can = !!info.path && !big;
    nBar.textContent = "";
    nCan = can;
    var handle = el("button", { type: "button", class: "re-handle", title: "Перетащить (Shift — без привязки)" }, ["⠿ Двигать"]);
    handle.addEventListener("pointerdown", startNative);
    [can ? handle : (sel.img ? null : el("span", { text: "Этот элемент нельзя сдвинуть" })),
     sel.img ? nbtn("🖼 Заменить картинку", "Загрузить другую картинку", function () { replaceImage(sel.img); }) : null,
     info.path && !big ? nbtn("⧉ Копия", "Скопировать элемент рядом — копию можно двигать и менять", function () { cloneNative(sel); }) : null,
     can && (m.dx || m.dy || m.w || m.h) ? nbtn("↺", "Вернуть на место и в прежний размер", function () { setMove(sel, { dx: 0, dy: 0, w: 0, h: 0 }); showNative(sel); }) : null,
     info.path ? nbtn("🗑 Удалить", "Убрать элемент со страницы (вернуть — в панели секции «↩ Вернуть удалённые»)", function () {
       if (!confirm("Удалить этот элемент со страницы?")) return;
       var s0 = sel.sec; setMove(sel, { del: true }); hideNative(); showTools(s0, sectionTools(s0));
     }) : null,
     can || (m.hide && info.path) ? nbtn(m.hide ? "👁 Показать" : "Скрыть", m.hide ? "Снова показать посетителям" : "Спрятать этот элемент от посетителей", function () { setMove(sel, { hide: !m.hide }); showNative(sel); }) : null
    ].forEach(function (k) { if (k) nBar.appendChild(k); });
    placeFrame();
  }
  function startNative(e) {
    if (e.button !== 0 || !nSel) return;
    e.preventDefault(); e.stopPropagation();
    if (editing) editing.blur();
    var m = moveOf(nSel).m;
    var sr = vr(nSel.sec), er = vr(nSel.el);
    nAct = { sel: nSel, sx: e.clientX, sy: e.clientY, dx0: m.dx || 0, dy0: m.dy || 0,
      cx0: er.left + er.width / 2 - sr.left, mid: sr.width / 2, secLeft: sr.left };
    nSel.el.classList.add("rl-moving-native");
    document.documentElement.classList.add("re-dragmode");
    window.addEventListener("pointermove", moveNative, true);
    window.addEventListener("pointerup", endNative, true);
  }
  var nGuide = el("div", { class: "re-nguide", style: "display:none" });
  document.body.appendChild(nGuide);
  function moveNative(e) {
    if (!nAct) return;
    var dx = nAct.dx0 + (e.clientX - nAct.sx) / Z(), dy = nAct.dy0 + (e.clientY - nAct.sy) / Z();
    nGuide.style.display = "none";
    if (!e.shiftKey) {
      dx = Math.round(dx / 4) * 4; dy = Math.round(dy / 4) * 4;
      // центр элемента — по центру секции
      var c = nAct.cx0 + (dx - nAct.dx0);
      if (Math.abs(c - nAct.mid) <= 8) {
        dx += nAct.mid - c;
        var r = vr(nAct.sel.sec);
        nGuide.style.cssText = "display:block;left:" + (nAct.secLeft + nAct.mid) + "px;top:" + r.top + "px;height:" + r.height + "px";
      }
      if (Math.abs(dx) <= 4) dx = 0;
      if (Math.abs(dy) <= 4) dy = 0;
    }
    nAct.dx = Math.round(dx); nAct.dy = Math.round(dy);
    nAct.sel.el.style.translate = nAct.dx + "px " + nAct.dy + "px";
    placeFrame();
  }
  function endNative() {
    window.removeEventListener("pointermove", moveNative, true);
    window.removeEventListener("pointerup", endNative, true);
    document.documentElement.classList.remove("re-dragmode");
    nGuide.style.display = "none";
    var a = nAct; nAct = null;
    if (!a) return;
    a.sel.el.classList.remove("rl-moving-native");
    justDragged = true; setTimeout(function () { justDragged = false; }, 0);
    if (a.dx != null) { setMove(a.sel, { dx: a.dx, dy: a.dy }); showNative(a.sel); }
  }

  // ---- выделение по клику: элемент → его панель, секция → панель секции ----
  var tools = el("div", { class: "re-tools", style: "display:none" });
  document.body.appendChild(tools);
  var toolsFor = null, selFree = null;
  function hideTools() { tools.style.display = "none"; toolsFor = null; }
  function showTools(target, kids) {
    toolsFor = target;
    tools.textContent = "";
    kids.forEach(function (k) { if (k) tools.appendChild(k); });
    tools.style.display = "flex";
    placeTools();
  }
  function placeTools() {
    if (!toolsFor || !toolsFor.isConnected) return;
    var r = vr(toolsFor);
    tools.style.top = (Math.max(r.vtop, 76) + scrollY / Z() + 8) + "px";   // не под шапкой сайта
    tools.style.left = Math.max(8, r.right - tools.offsetWidth - 8) + "px";
  }
  function tbtn(label, title, fn) {
    return el("button", { type: "button", title: title, on: { click: function (e) { e.preventDefault(); e.stopPropagation(); fn(e.currentTarget); } } }, [label]);
  }
  function toggleSection(key) {
    var pg = Lay.pageForEdit(), h = (pg.hidden || []).slice(), i = h.indexOf(key);
    if (i >= 0) h.splice(i, 1); else h.push(key);
    pg.hidden = h;
    pagePending().hidden = h.slice();
    Lay.apply(); ui();
  }
  function sectionTools(sec) {
    var key = sec.getAttribute("data-rl-sec"), off = sec.hasAttribute("data-rl-dim");
    var cid = sec.getAttribute("data-rl-custom");
    function again() { showTools(sec, sectionTools(sec)); }
    // удалённые родные элементы этой секции — можно вернуть
    var mvs = (Lay.bucket(key).moves || {})[key] || {};
    var dels = Object.keys(mvs).filter(function (pth) { return mvs[pth].del; });
    var restore = dels.length ? tbtn("↩ Вернуть удалённые (" + dels.length + ")", "Вернуть на страницу удалённые элементы этой секции", function () {
      dels.forEach(function (pth) { var e = Lay.byPath(sec, pth); if (e) setMove({ sec: sec, key: key, el: e }, { del: false }); });
      again();
    }) : null;
    if (key === "footer") return [
      el("span", { text: "Подвал — на всех страницах" }),
      tbtn("+ Элемент", "Добавить текст, кнопку, картинку, аудио…", function (a) { openItemMenu(a, key); }),
      restore
    ];
    return [
      el("span", { text: off ? "Секция скрыта" : (cid ? "Своя секция" : "Секция") }),
      tbtn("+ Элемент", "Добавить текст, кнопку, картинку, аудио…", function (a) { openItemMenu(a, key); }),
      tbtn(off ? "👁 Показать" : "Скрыть", off ? "Снова показать посетителям" : "Спрятать секцию от посетителей (не удаляется)", function () { toggleSection(key); again(); }),
      cid ? tbtn("🎨", "Сменить фон секции", function () { cycleBg(cid); }) : null,
      cid ? tbtn("🖼 Фон", "Картинка на фон секции", function () { bgImage(cid); }) : null,
      Lay.canReorder() ? tbtn("+ Секция ниже", "Новая пустая секция под этой", function () { deselect(); addSection(key); }) : null,
      cid ? tbtn("✕", "Удалить секцию", function () { deselect(); deleteSection(cid); }) : null,
      restore
    ];
  }
  function bookByHref(href) {
    var L = lang();
    return books().filter(function (b) { return B.view(b, L).href === href; })[0] || null;
  }
  function bookTools(b) {
    return [
      el("span", { text: "Книга" }),
      tbtn("↑", "Раньше в списке", function () { moveBook(b.id, -1); deselect(); }),
      tbtn("↓", "Позже в списке", function () { moveBook(b.id, 1); deselect(); }),
      tbtn("⚙ Настройки", "Цена, статус, Amazon, описание", function () { deselect(); booksDialog(b.id); }),
      tbtn("✕", "Удалить книгу", function () { deselect(); removeBook(b.id); })
    ];
  }
  function setSelFree(node) {
    if (selFree && selFree !== node) selFree.classList.remove("rl-sel");
    selFree = node;
    if (node) node.classList.add("rl-sel");
  }
  function deselect() { hideTools(); hideNative(); setSelFree(null); }
  var EDITOR_UI = "#re-root,.re-tools,.re-nbar,.rl-pop,.re-modal-bg,.rl-ft,.rl-grip,.re-chip,.re-ngrip";
  function imageUnder(x, y, sec) {
    if (x == null || !sec) return null;
    var list = document.elementsFromPoint(x, y);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.tagName === "IMG" && sec.contains(e) && !e.closest(EDITOR_UI) && !e.closest(".rl-fi")) return e;
    }
    return null;
  }
  // тонкая линия (полоска 1–4px) рядом с точкой клика
  function thinAt(x, y, sec) {
    if (x == null || !sec) return null;
    var pts = [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]];
    for (var i = 0; i < pts.length; i++) {
      var list = document.elementsFromPoint(x + pts[i][0], y + pts[i][1]);
      for (var j = 0; j < list.length; j++) {
        var e = list[j];
        if (!sec.contains(e) || e === sec || e.closest(EDITOR_UI) || e.closest(".rl-free")) continue;
        var r = e.getBoundingClientRect();
        if ((r.width <= 4 && r.height > 8) || (r.height <= 4 && r.width > 8)) {
          var cs = getComputedStyle(e);
          if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0) return e;
        }
      }
    }
    return null;
  }
  function selectAt(t, x, y) {
    if (!t || !t.closest || t.closest(EDITOR_UI)) return;
    nHover.style.display = "none";
    var fi = t.closest(".rl-fi");
    var sec = t.closest("[data-rl-sec]");
    if (fi) {                                          // свой элемент
      hideNative(); setSelFree(fi);
      if (sec) showTools(sec, sectionTools(sec)); else hideTools();
      return;
    }
    setSelFree(null);
    var card = t.closest("a.vcard"), bk = card && bookByHref(card.getAttribute("href"));
    var img = imageUnder(x, y, sec);
    if (bk) { showNative({ sec: sec, key: sec.getAttribute("data-rl-sec"), el: card, img: card.querySelector("img") }); showTools(card, bookTools(bk)); return; }
    var thin = thinAt(x, y, sec);
    var nt = thin ? { sec: sec, key: sec.getAttribute("data-rl-sec"), el: thin } : nativeAt(t);   // родной элемент секции
    if (!nt && img) nt = { sec: sec, key: sec.getAttribute("data-rl-sec"), el: Lay.pick(img, sec) || img };
    if (nt) {
      // картинка: та, что под курсором, или единственная внутри элемента
      var inner = nt.el.tagName === "IMG" ? [nt.el] : nt.el.querySelectorAll("img");
      nt.img = img && (nt.el === img || nt.el.contains(img) || !inner.length) ? img : (inner.length === 1 ? inner[0] : img);
      showNative(nt);
    } else hideNative();
    if (sec) showTools(sec, sectionTools(sec)); else hideTools();
  }
  document.addEventListener("pointerdown", function (e) {
    if (!active || !Lay || act || nAct || sAct || e.button !== 0) return;
    selectAt(e.target, e.clientX, e.clientY);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && active && !editing && !pop && !document.querySelector(".re-modal-bg")) deselect();
  });
  // ссылки и кнопки-ссылки в секциях при правке не уводят со страницы (Ctrl+клик — перейти)
  document.addEventListener("click", function (e) {
    if (!active || e.ctrlKey || e.metaKey || !e.target.closest) return;
    var a = e.target.closest("a[href]");
    if (a && a.closest("[data-rl-sec]") && !a.closest(EDITOR_UI)) e.preventDefault();
  }, true);
  // при наведении — только тонкая рамка
  var nHover = el("div", { class: "re-nhover", style: "display:none" });
  document.body.appendChild(nHover);
  document.addEventListener("mouseover", function (e) {
    if (!active || !Lay || act || nAct || !e.target.closest) return;
    var nt = e.target.closest(".rl-fi") ? null : nativeAt(e.target);
    if (!nt || (nSel && nt.el === nSel.el)) { nHover.style.display = "none"; return; }
    var r = vr(nt.el);
    nHover.style.cssText = "display:block;top:" + (r.top - 3) + "px;left:" + (r.left - 3) + "px;width:" + (r.width + 6) + "px;height:" + (r.height + 6) + "px";
  }, true);
  // вёрстка поменялась (сохранили, сменили язык) — подвинуть рамки к элементам
  window.addEventListener("resize", function () { placeTools(); placeFrame(); });

  // ---- порядок секций и свои секции ----
  function setOrder(o) {
    Lay.pageForEdit().order = o.slice();
    pagePending().order = o.slice();
    Lay.apply(); ui(); scheduleScan();
  }
  function saveCustom() { pagePending().custom = JSON.parse(JSON.stringify(Lay.pageForEdit().custom || {})); }
  function addSection(afterKey) {
    var id = Date.now().toString(36), pg = Lay.pageForEdit(), key = "c-" + id;
    pg.custom = pg.custom || {};
    pg.custom[id] = { bg: "deep" };
    saveCustom();
    // сразу заголовок посередине — его можно переписать или удалить
    var L = lang(), h = { id: uid(), type: "heading", align: "center", x: 20, y: 72, w: 60 };
    h[L] = { text: "" };
    freeItems(key).push(h);
    var pp = pagePending(); pp.free = pp.free || {}; pp.free[key] = JSON.parse(JSON.stringify(pg.free[key]));
    var o = Lay.order(), at = o.indexOf(afterKey) + 1;
    o.splice(at > 0 ? at : o.length, 0, key);
    setOrder(o);
    setTimeout(function () {
      var s = document.getElementById(key);
      if (s) s.scrollIntoView({ block: "center", behavior: "smooth" });
      var f = document.querySelector('.rl-fi[data-rl-id="' + h.id + '"] [data-rl-f]');
      if (f) f.focus();
    }, 80);
  }
  function deleteSection(id) {
    if (!confirm("Удалить эту секцию вместе со всем, что в ней?")) return;
    var pg = Lay.pageForEdit(), key = "c-" + id, o = Lay.order(), i = o.indexOf(key);
    delete pg.custom[id];
    saveCustom();
    if (pg.free && pg.free[key]) { pg.free[key].items = []; commitFree(key); }
    if (i >= 0) o.splice(i, 1);
    setOrder(o);
  }
  function cycleBg(id) {
    var c = Lay.pageForEdit().custom[id], list = ["deep", "dark", "glow"].concat(c.image ? ["image"] : []);
    c.bg = list[(list.indexOf(c.bg) + 1) % list.length];
    saveCustom(); Lay.apply(); ui();
  }
  function bgImage(id) {
    pickFile(IMG_ACCEPT, 8, function (f) {
      var c = Lay.pageForEdit().custom[id];
      c.image = upload(f); c.bg = "image";
      saveCustom(); Lay.apply(); ui();
    });
  }

  // клик, которым закончилось перетаскивание элемента, не должен ничего нажимать
  var justDragged = false;
  document.addEventListener("click", function (e) { if (justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);

  var BCSS = [
    ".re-ngrip{position:absolute;z-index:2147482998;background:#6fb6ff;border-radius:4px;box-shadow:0 0 0 2px rgba(0,0,0,.4);touch-action:none}",
    ".re-ngrip-r{width:8px;height:28px;cursor:ew-resize}.re-ngrip-b{width:28px;height:8px;cursor:ns-resize}",
    ".rl-grip-b{top:auto;bottom:-9px;right:auto;left:50%;width:28px;height:8px;margin:0 0 0 -14px;cursor:ns-resize}",
    ".rl-fi.rl-t-clone.rl-ed{min-width:0;min-height:0}",
    ".rl-t-clone [data-rl-html]:focus{outline:none}",
    ".re-nhover{position:absolute;z-index:2147482996;pointer-events:none;border:1px dashed rgba(111,182,255,.7);border-radius:3px}",
    ".re-nframe{position:absolute;z-index:2147482997;pointer-events:none;border:1px solid #6fb6ff;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}",
    ".re-nbar{position:absolute;z-index:2147482998;gap:4px;align-items:center;background:#fff;border-radius:9px;padding:4px;box-shadow:0 6px 20px rgba(0,0,0,.45);font:13px system-ui,sans-serif;color:#1d1d1f}",
    ".re-nbar button{font:13px system-ui,sans-serif;border:1px solid #d0d0d6;background:#f4f4f6;color:#1d1d1f;border-radius:7px;padding:5px 10px;cursor:pointer;white-space:nowrap}",
    ".re-nbar button:hover{background:#e8e8ee}",
    ".re-nbar span{font-size:12px;color:#6a6a70;padding:0 4px}",
    ".re-nguide{position:absolute;width:1px;background:#ff5fa2;z-index:2147482996;pointer-events:none}",
    ".rl-moving-native{outline:2px solid #6fb6ff!important;outline-offset:3px}",

    ".re-drop{position:fixed;height:4px;background:#e6aa5a;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 14px #e6aa5a;z-index:2147483003;pointer-events:none}",
    ".re-dragging{opacity:.3!important}",
    ".re-dragmode,.re-dragmode *{cursor:grabbing!important;user-select:none!important}",
    ".re-handle{cursor:grab!important;touch-action:none}",
    ".rl-editing [data-rl-dim]{opacity:.3;outline:2px dashed #9a9aa0;outline-offset:-3px}",

    // свободные элементы в режиме правки
    ".rl-fi.rl-ed{min-width:40px;min-height:24px}",
    ".rl-fi.rl-ed:hover{outline:1px dashed #e6aa5a;outline-offset:4px}",
    ".rl-fi.rl-ed:focus-within{outline:1px solid #e6aa5a;outline-offset:4px}",
    ".rl-fi.rl-moving{outline:2px solid #e6aa5a;box-shadow:0 12px 30px rgba(0,0,0,.45);z-index:10}",
    ".rl-fi [data-rl-f]{cursor:text}",
    ".rl-editing .rl-fi [data-rl-f]:focus{outline:none;background:rgba(0,0,0,.28)}",
    "[data-rl-f][data-rl-ph]:empty:before{content:attr(data-rl-ph);opacity:.45}",
    ".rl-ft{position:absolute;bottom:100%;right:-4px;margin-bottom:8px;display:none;gap:4px;z-index:12;background:#fff;border-radius:9px;padding:4px;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:nowrap}",
    ".rl-fi.rl-sel>.rl-ft,.rl-fi.rl-ed:focus-within>.rl-ft{display:flex}",
    ".rl-fi.rl-sel{outline:2px solid #e6aa5a}",
    ".rl-grip{position:absolute;top:50%;right:-9px;width:8px;height:28px;margin-top:-14px;border-radius:4px;background:#e6aa5a;cursor:ew-resize;display:none;touch-action:none;box-shadow:0 0 0 2px rgba(0,0,0,.35)}",
    ".rl-fi.rl-sel>.rl-grip,.rl-fi.rl-moving>.rl-grip{display:block}",
    ".rl-t-image.rl-ed,.rl-t-audio.rl-ed,.rl-t-book.rl-ed{cursor:grab}",
    ".re-guide{position:absolute;z-index:11;pointer-events:none;background:#ff5fa2}",
    ".re-gv{top:0;bottom:0;width:1px}.re-gh{left:0;right:0;height:1px}",
    // панели и меню
    ".re-tools,.rl-ft,.rl-pop,.re-chip{font:13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1d1f}",
    ".re-tools button,.rl-ft button,.rl-pop button,.re-chip button{font:13px system-ui,sans-serif;border:1px solid #d0d0d6;background:#f4f4f6;color:#1d1d1f;border-radius:7px;padding:5px 10px;cursor:pointer;white-space:nowrap}",
    ".re-tools button:hover,.rl-ft button:hover,.rl-pop button:hover,.re-chip button:hover{background:#e8e8ee}",
    ".re-tools{position:absolute;z-index:2147482999;gap:6px;align-items:center;background:#fff;border-radius:9px;box-shadow:0 6px 24px rgba(0,0,0,.45);padding:5px;flex-wrap:wrap;max-width:min(760px,calc(100vw - 16px))}",
    ".re-tools span{font-size:12px;color:#6a6a70;padding:0 4px}",
    ".rl-pop{position:absolute;z-index:2147483002;background:#fff;border-radius:11px;box-shadow:0 10px 36px rgba(0,0,0,.5);padding:10px;display:flex;flex-wrap:wrap;gap:6px;max-width:360px}",
    ".rl-pop-t{width:100%;font-size:12.5px;color:#6a6a70}",
    ".rl-pop input{flex:1;min-width:220px;font:14px system-ui,sans-serif;padding:7px 9px;border:1px solid #c8c8ce;border-radius:7px;color:#1d1d1f;background:#fff}",
    ".rl-pop button.re-main{background:#c9842f;border-color:#c9842f;color:#fff}",
    ".re-chip{display:inline-flex;gap:6px;margin:10px 0;position:relative;z-index:5}"
  ].join("\n");
  var bst = document.createElement("style"); bst.textContent = BCSS; document.head.appendChild(bst);

  document.body.appendChild(root);
  ui();
  if (active) {
    if (Lay) Lay.setEditing(true);
    if (readPageBookId()) B.chapter(readPageBookId()).then(ui, ui);
    // данные книг/текстов догружаются асинхронно — размечаем после них
    Promise.all([T.ready, B.list().catch(function () {})]).then(scheduleScan);
    scheduleScan();
  }
  }
})();
