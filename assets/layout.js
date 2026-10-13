/* ============================================================
   Конструктор страниц: добавленные блоки и секции, порядок секций,
   скрытые секции, заменённые картинки/аудио, общий аудиоплеер.
   Работает у всех посетителей; правится в режиме ?edit (assets/editor.js).

   data/layout.json:
   {
     "media": { "assets/img/author.jpg": "assets/uploads/author-1700000000.jpg" },   // общая замена (подвал)
     "pages": {
       "index.html": {
         "order":  ["top", "read", "c-k3x9", "cast", …],   // порядок секций (перетаскивание)
         "hidden": ["cast"],                              // скрытые секции
         "custom": { "k3x9": { "bg": "deep|dark|glow|image", "image": "…",
                               "ru": { "kicker": "…", "title": "…" }, … } },   // свои секции
         "free":   { "cast": { "items": [ {элемент}, … ] }, "c-k3x9": {…} }   // свободные элементы секций
         "moves":  { "voice": { "0.1.2": { "dx": 40, "dy": -12, "w": 300, "h": 120, "hide": false, "del": false } } } // сдвиги, размеры, скрытие/удаление родных элементов
       }
     }
   }
   Подвал общий для всех страниц: его элементы и сдвиги — в "global": { "free": { "footer": … }, "moves": { "footer": … } }.
   Элемент типа «clone» — копия существующего элемента: { "type": "clone", "h": px, "ru": { "html": "…" } }.
   Элемент: { "id", "type": "heading|text|quote|image|audio|button|book",
              "x": % ширины слоя, "y": px от верха секции, "w": % ширины (нет — по содержимому),
              "align": "left|center|right", "src", "href", "book",
              "ru": { "text", "caption", "author", "title", "label" }, "en": {…}, … }
   Слой элементов — по центру секции шириной как контейнер сайта; на телефоне
   элементы встают колонкой (по y, затем x).

   Секции страницы — верхнеуровневые <section>/<header>/<article> страницы.
   Ключ секции: id → data-screen-label → «тег-номер»; своя секция — «c-<id>».
   Слой элементов и свои секции вставляются в DOM (вне React); порядок
   секций меняется через CSS order (flex-колонка у общего родителя), а не
   перестановкой узлов — React-у ничего не мешает.

   Родные элементы секций сдвигаются через CSS translate (React их не трогает).
   Элемент находится по пути индексов детей от секции («0.1.2»); вставки
   конструктора (слой, плеер, кнопки редактора) в индексах не считаются.
   На ширине ≤ 700px сдвиги не применяются (скрытие — применяется).

   Аудиоплеер сайта: <audio data-rl-enhance data-rl-title="…" src="…"> —
   превращается в плеер «как в Голосе автора» (кнопка, волна, время).
   ============================================================ */
(function () {
  var T = window.RoniTexts;
  var FILE = location.pathname.split("/").pop() || "index.html";
  var PAGE = T && T.pageKey ? T.pageKey(FILE) : FILE;          // book.html?id=X — своя версия страницы книги
  var PARENT = PAGE !== FILE ? FILE : null;                     // …а до первой правки — макет book.html
  var data = null, editing = false, booksWanted = false;
  var preview = {};   // путь → blob: URL для только что загруженных файлов (до сохранения)

  function lang() {
    try { var l = localStorage.getItem("vish_lang"); return ["ru", "en", "uk", "bg"].indexOf(l) >= 0 ? l : "ru"; } catch (e) { return "ru"; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function url(p) { return preview[p] || p || ""; }
  function safeHref(h) { h = String(h || "").trim(); return /^(javascript|data):/i.test(h) ? "#" : h; }
  function page() { return (data && data.pages && (data.pages[PAGE] || (PARENT && data.pages[PARENT]))) || {}; }
  // подвал — общий для всех страниц: его данные лежат в data.global
  function bucket(key) { return key === "footer" ? ((data && data.global) || {}) : page(); }
  function footerEl() { return document.querySelector('[data-sc-name="SiteFooter"] footer'); }
  function tx(b, f) {
    var L = lang(), order = [L, "ru", "en", "uk", "bg"];
    for (var i = 0; i < order.length; i++) { var v = b && b[order[i]] && b[order[i]][f]; if (v) return v; }
    return "";
  }
  function paras(s) { return String(s || "").split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean); }

  // ---------------------------------------------------------------- стили
  var css = document.createElement("style");
  css.textContent = [
    "[data-rl-hidden]{display:none!important}",
    ".rl-h{font:400 clamp(28px,4vw,44px)/1.1 Forum,serif;color:#f0e6d2;margin:0;text-align:center}",
    ".rl-p{font:300 18px/1.85 Spectral,serif;color:#d8cdb8;margin:0 0 18px}",
    ".rl-p:last-child{margin-bottom:0}",
    ".rl-q{margin:0;padding:6px 0 6px 26px;border-left:2px solid var(--gold,#c9a86a)}",
    ".rl-q .rl-p{font-style:italic;font-size:clamp(19px,2.4vw,24px);line-height:1.6;color:var(--text,#e8dcc6)}",
    ".rl-cite{display:block;margin-top:12px;font:400 13px Spectral,serif;letter-spacing:2px;color:var(--gold-text,#b8955a);font-style:normal}",
    ".rl-fig{margin:0;text-align:center}",
    ".rl-fig img{display:block;max-width:100%;max-height:85vh;width:auto;height:auto;margin:0 auto;border-radius:3px;border:1px solid rgba(var(--gold-rgb,201,168,106),.22);box-shadow:0 20px 50px rgba(0,0,0,.45)}",
    ".rl-cap{font:300 italic 14px Spectral,serif;color:#9c917c;margin-top:12px}",
    ".rl-btnwrap{text-align:center}",
    ".rl-btn{display:inline-block;background:var(--gold,#c9a86a);color:var(--bg-2,#0f0d0a);font:500 14.5px Spectral,serif;letter-spacing:1px;padding:15px 32px;text-decoration:none;border-radius:2px;transition:transform .25s}",
    ".rl-btn:hover{transform:translateY(-2px)}",
    ".rl-book{display:flex;gap:28px;align-items:center;flex-wrap:wrap;text-decoration:none}",
    ".rl-book img{width:150px;aspect-ratio:2/3;object-fit:cover;border-radius:3px;border:1px solid rgba(var(--gold-rgb,201,168,106),.25);box-shadow:0 16px 36px rgba(0,0,0,.5)}",
    ".rl-book-t{font:400 clamp(24px,3vw,32px) Forum,serif;color:#f0e6d2}",
    ".rl-book-s{font:300 italic 14px Spectral,serif;color:#9c917c;margin-top:6px}",
    ".rl-book-d{font:300 16px/1.7 Spectral,serif;color:#a89c84;margin-top:12px;max-width:460px}",
    ".rl-book-a{font:400 13px Spectral,serif;color:var(--gold,#c9a86a);letter-spacing:1px;margin-top:14px;display:inline-block}",
    // плеер «как в Голосе автора»
    ".rl-player{border:1px solid rgba(var(--gold-rgb,201,168,106),.28);border-radius:4px;padding:20px 22px;background:rgba(var(--gold-rgb,201,168,106),.03);display:flex;align-items:center;gap:20px;max-width:560px;margin:0 auto}",
    ".rl-play{flex-shrink:0;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:var(--gold,#c9a86a);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(var(--gold-rgb,201,168,106),.3);transition:transform .25s}",
    ".rl-play:hover{transform:scale(1.05)}",
    ".rl-pl-b{flex:1;min-width:0}",
    ".rl-pl-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}",
    ".rl-pl-title{font:400 14px Spectral,serif;color:var(--text,#e8dcc6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".rl-pl-time{font:300 12px Spectral,serif;color:var(--text-mute,#8f846f);flex-shrink:0}",
    ".rl-wave{display:flex;align-items:center;gap:3px;height:30px;cursor:pointer}",
    ".rl-wave i{flex:1;max-width:4px;border-radius:2px;background:rgba(var(--gold-rgb,201,168,106),.28);transition:background .2s}",
    ".rl-wave i.on{background:var(--gold,#c9a86a)}",
    ".rl-player.playing .rl-wave i.on{background:var(--gold-soft,#e6cf9f)}",
    // свои секции
    ".rl-csec{position:relative;padding:84px 7vw;border-top:1px solid rgba(var(--gold-rgb,201,168,106),.12);background:var(--bg,#14110d);background-size:cover;background-position:center}",
    ".rl-csec.rl-bg-deep{background-color:var(--bg-2,#0f0d0a)}",
    ".rl-csec.rl-bg-glow{background:radial-gradient(120% 90% at 50% 0,rgba(var(--gold-rgb,201,168,106),.10),var(--bg,#14110d) 65%)}",
    ".rl-csec-head{text-align:center;max-width:760px;margin:0 auto 10px}",
    ".rl-kick{font:400 11px Spectral,serif;color:var(--gold-text,#b8955a);letter-spacing:5px;margin-bottom:16px;text-transform:uppercase}",
    ".rl-csec{min-height:360px}",
    ".rl-free{position:absolute;top:0;bottom:0;left:50%;width:min(var(--container,1180px),100%);transform:translateX(-50%);pointer-events:none;z-index:3}",
    ".rl-fi{position:absolute;pointer-events:auto;box-sizing:border-box}",
    ".rl-fi .rl-h{text-align:inherit}",
    ".rl-fi .rl-btnwrap{text-align:inherit}",
    ".rl-fi .rl-fig img{width:100%;max-height:none}",
    ".rl-fi .rl-player{max-width:none;margin:0}",
    ".rl-fi .rl-cap:empty{display:none}",
    ".rl-spacer{pointer-events:none}",
    ".rl-row{display:contents}",
    ".rl-clone{width:100%;height:100%}",
    ".rl-clone>*{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;transform:none!important;translate:none!important;margin:0!important;width:100%!important;height:100%!important;box-sizing:border-box}",
    "@media(max-width:700px){.rl-free{position:static;transform:none;width:auto;flex-basis:100%;padding:8px 20px 28px;display:flex;flex-direction:column;gap:16px}.rl-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.rl-fi{position:static!important;width:auto!important;flex:1 1 auto;max-width:100%}.rl-t-button{flex:0 1 auto}.rl-spacer{display:none}}"
  ].join("\n");
  document.head.appendChild(css);

  // ---------------------------------------------------------------- аудиоплеер
  var PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1a1410" style="margin-left:2px"><path d="M8 5v14l11-7z"/></svg>';
  var PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#1a1410"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  function waveHTML(seed) {
    var h = 7; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    var out = "";
    for (var j = 0; j < 46; j++) out += '<i style="height:' + (6 + Math.round((Math.sin(j * 0.9 + (h % 13)) * 0.5 + 0.5) * 22 + ((j + h) % 5) * 1.4)) + 'px"></i>';
    return out;
  }
  function playerHTML(src, titleHTML) {
    return '<div class="rl-player"><button type="button" class="rl-play" aria-label="Play">' + PLAY + '</button>' +
      '<div class="rl-pl-b"><div class="rl-pl-top"><div class="rl-pl-title">' + titleHTML + '</div><div class="rl-pl-time">0:00</div></div>' +
      '<div class="rl-wave">' + waveHTML(src || "x") + "</div></div></div>";
  }
  function fmt(s) { if (!isFinite(s) || !s) return "0:00"; s = Math.floor(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function wire(pl, au) {
    if (au.__rlWired === pl) return;
    au.__rlWired = pl; au.__rlPlayer = pl;
    var btn = pl.querySelector(".rl-play"), time = pl.querySelector(".rl-pl-time"), bars = pl.querySelectorAll(".rl-wave i");
    function paint() {
      var d = au.duration, c = au.currentTime, n = d ? Math.round(c / d * bars.length) : 0;
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("on", i < n);
      time.textContent = (c > 0 ? fmt(c) + " / " : "") + fmt(d);
      pl.classList.toggle("playing", !au.paused);
      btn.innerHTML = au.paused ? PLAY : PAUSE;
    }
    ["loadedmetadata", "timeupdate", "play", "pause", "ended"].forEach(function (ev) { au.addEventListener(ev, paint); });
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (au.paused) {
        document.querySelectorAll("audio").forEach(function (a) { if (a !== au) a.pause(); });
        au.play().catch(function () {});
      } else au.pause();
    });
    pl.querySelector(".rl-wave").addEventListener("click", function (e) {
      var r = this.getBoundingClientRect();
      if (au.duration) au.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * au.duration;
    });
    paint();
  }
  // <audio data-rl-enhance> в вёрстке страниц → плеер сайта
  function enhanceAudio() {
    document.querySelectorAll("audio[data-rl-enhance]").forEach(function (au) {
      var title = au.getAttribute("data-rl-title") || "";
      var pl = au.__rlPlayer;
      if (!pl || !pl.isConnected || pl.nextSibling !== au) {
        if (pl && pl.isConnected) pl.remove();
        var box = document.createElement("div");
        box.innerHTML = playerHTML(au.getAttribute("src") || "", esc(title));
        pl = box.firstChild;
        pl.setAttribute("data-rl-own", "");
        au.parentNode.insertBefore(pl, au);
        au.hidden = true;
        au.__rlWired = null;
        wire(pl, au);
      }
      var t = pl.querySelector(".rl-pl-title");
      if (t.textContent !== title) t.textContent = title;
    });
  }

  // ---------------------------------------------------------------- блоки
  var LABELS = { ru: "Открыть →", en: "Open →", uk: "Відкрити →", bg: "Отвори →" };
  // html копии хранится в репозитории, но чистим всё равно: без скриптов, обработчиков и javascript:-ссылок
  function cleanHTML(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    tpl.content.querySelectorAll("script,iframe,object,embed,link,meta,style").forEach(function (n) { n.remove(); });
    tpl.content.querySelectorAll("*").forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^data-(re|rl)-/i.test(a.name) || a.name === "contenteditable" ||
            ((a.name === "href" || a.name === "src") && /^\s*(javascript|data:text)/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  }
  function textHTML(b) { return paras(tx(b, "text")).map(function (p) { return '<p class="rl-p">' + esc(p) + "</p>"; }).join(""); }
  function renderBlock(b) {
    var t = b.type;
    if (t === "heading") return '<h2 class="rl-h" data-rl-f="text">' + esc(tx(b, "text")) + "</h2>";
    if (t === "text") return '<div data-rl-f="text" data-rl-multi>' + textHTML(b) + "</div>";
    if (t === "quote") return '<blockquote class="rl-q"><div data-rl-f="text" data-rl-multi>' + textHTML(b) +
      '</div><cite class="rl-cite" data-rl-f="author">' + esc(tx(b, "author")) + "</cite></blockquote>";
    if (t === "image") return '<figure class="rl-fig">' + (b.src ? '<img src="' + esc(url(b.src)) + '" alt="' + esc(tx(b, "caption")) + '" loading="lazy" data-rl-img>' : "") +
      '<figcaption class="rl-cap" data-rl-f="caption">' + esc(tx(b, "caption")) + "</figcaption></figure>";
    if (t === "audio") return playerHTML(b.src || "", '<span data-rl-f="title">' + esc(tx(b, "title")) + "</span>") +
      (b.src ? '<audio preload="metadata" src="' + esc(url(b.src)) + '"></audio>' : "");
    if (t === "button") return '<div class="rl-btnwrap"><a class="rl-btn" href="' + esc(safeHref(b.href)) + '"><span data-rl-f="label">' + esc(tx(b, "label")) + "</span></a></div>";
    if (t === "clone") return '<div class="rl-clone" data-rl-html>' + cleanHTML(tx(b, "html")) + "</div>";
    if (t === "book") {
      var B = window.RoniBooks, list = B && B.cached().books;
      if (!list) { booksWanted = true; return ""; }
      var bk = list.filter(function (x) { return x.id === b.book; })[0];
      if (!bk) return editing ? '<div class="rl-cap">Книга «' + esc(b.book) + '» не найдена</div>' : "";
      var v = B.view(bk, lang());
      return '<a class="rl-book" href="' + esc(v.href) + '">' + (v.cover ? '<img src="' + esc(v.cover) + '" alt="">' : "") +
        '<div><div class="rl-book-t">' + esc(v.title) + '</div><div class="rl-book-s">' + esc(v.tag || v.subtitle) + "</div>" +
        (v.blurb ? '<div class="rl-book-d">' + esc(v.blurb) + "</div>" : "") + '<span class="rl-book-a">' + LABELS[lang()] + "</span></div></a>";
    }
    return "";
  }
  function renderFree(layer, key, items) {
    layer.textContent = "";
    // порядок в DOM = порядок на телефоне (сверху вниз, слева направо)
    // элементы на одной высоте — один ряд: на телефоне они остаются рядом (если влезают)
    var row = null, rowY = -1e9;
    items.slice().sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); }).forEach(function (b) {
      if (!row || Math.abs((+b.y || 0) - rowY) > 12) {
        row = document.createElement("div"); row.className = "rl-row"; rowY = +b.y || 0;
        layer.appendChild(row);
      }
      var d = document.createElement("div");
      d.className = "rl-fi rl-t-" + b.type;
      d.setAttribute("data-rl-id", b.id);
      d.style.left = (+b.x || 0) + "%";
      d.style.top = (+b.y || 0) + "px";
      if (b.w) d.style.width = b.w + "%";
      if (b.h) d.style.height = b.h + "px";
      d.style.textAlign = b.align || "left";
      d.innerHTML = renderBlock(b);
      var pl = d.querySelector(".rl-player"), au = d.querySelector("audio");
      if (pl && au) wire(pl, au);
      row.appendChild(d);
    });
    if (window.RoniLayout.onFree) window.RoniLayout.onFree(layer, key, items);
  }
  // секция вырастает, если элементы стоят ниже её низа
  function fitSpacer(sec) {
    var layer = sec.__rlLayer, sp = sec.__rlSpacer;
    if (!layer || !sp) return;
    var need = 0;
    Array.prototype.forEach.call(layer.querySelectorAll(".rl-fi"), function (c) { need = Math.max(need, c.offsetTop + c.offsetHeight + 40); });
    var natural = sec.offsetHeight - sp.offsetHeight;
    var h = Math.max(0, need - natural);
    if (sp.style.height !== h + "px") sp.style.height = h + "px";
  }

  // ---------------------------------------------------------------- секции
  // главный блок страницы. По адресу без имени файла (…/Roni-Site/?edit) движок зовёт его «Root»,
  // поэтому ищем по имени, а если не нашли — самый внешний блок движка (шапка и подвал — внутри него)
  function host() {
    return document.querySelector('[data-sc-name="' + FILE.replace(/\.html$/, "") + '"]') ||
      document.querySelector('[data-sc-name="Root"]') || document.querySelector("[data-sc-name]");
  }
  function sections() {
    var h = host(); if (!h) return [];
    return Array.prototype.filter.call(h.querySelectorAll("section,header,article"), function (el) {
      return el.closest("[data-sc-name]") === h && !el.closest(".rl-free") &&
        !(el.parentElement && el.parentElement.closest("section,header,article"));
    });
  }
  function keys(secs) {
    var used = {};
    return secs.map(function (el, i) {
      var c = el.getAttribute("data-rl-custom");
      var k = c ? "c-" + c : (el.id || (el.getAttribute("data-screen-label") || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      if (!k || used[k]) k = el.tagName.toLowerCase() + "-" + (i + 1);
      used[k] = 1;
      return k;
    });
  }
  function attr(el, name, on) {
    if (on) { if (!el.hasAttribute(name)) el.setAttribute(name, ""); }
    else if (el.hasAttribute(name)) el.removeAttribute(name);
  }
  // сохранённый порядок + секции, которых в нём нет, — на их естественное место
  function computeOrder(ks, saved) {
    var out = (saved || []).filter(function (k) { return ks.indexOf(k) >= 0; });
    ks.forEach(function (k, i) {
      if (out.indexOf(k) >= 0) return;
      var at = 0;
      for (var j = i - 1; j >= 0; j--) { var p = out.indexOf(ks[j]); if (p >= 0) { at = p + 1; break; } }
      out.splice(at, 0, k);
    });
    return out;
  }

  // ---- родные элементы: путь от секции и обратно
  function injected(n) {
    return n.nodeType === 1 && (n.classList.contains("rl-free") || n.classList.contains("rl-spacer") ||
      n.classList.contains("re-chip") || n.hasAttribute("data-rl-own"));
  }
  function pathOf(sec, el) {
    var parts = [];
    while (el && el !== sec) {
      if (injected(el)) return null;
      var i = 0, x = el.previousElementSibling;
      while (x) { if (!injected(x)) i++; x = x.previousElementSibling; }
      parts.unshift(i);
      el = el.parentElement;
    }
    return el === sec && parts.length ? parts.join(".") : null;
  }
  function byPath(sec, path) {
    var el = sec;
    path.split(".").forEach(function (i) {
      if (!el) return;
      var kids = Array.prototype.filter.call(el.children, function (c) { return !injected(c); });
      el = kids[+i] || null;
    });
    return el;
  }
  // что двигать под курсором — только «настоящие» элементы: заголовок, текст, картинка,
  // кнопка/ссылка, плеер, карточка с рамкой или фоном. Пустые обёртки и отступы — нет.
  var ELEMENT_TAGS = /^(h1|h2|h3|h4|h5|h6|p|blockquote|figure|img|a|button|li|audio|video|iframe)$/i;
  function ownText(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return true;
    return Array.prototype.some.call(el.children, function (k) { return /^(span|b|i|em|strong|small|br)$/i.test(k.tagName) && k.textContent.trim(); }) &&
      Array.prototype.every.call(el.children, function (k) { return /^(span|b|i|em|strong|small|br)$/i.test(k.tagName); });
  }
  function boxed(el) {
    var cs = getComputedStyle(el);
    return parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== "none" ||
      (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || cs.backgroundImage !== "none";
  }
  function isElement(el) {
    if (ELEMENT_TAGS.test(el.tagName)) return true;
    if (/^span$/i.test(el.tagName)) return false;              // кусок текста — часть своего заголовка/абзаца
    if (/^div$/i.test(el.tagName)) return ownText(el) || boxed(el);
    return false;
  }
  function pick(t, sec) {
    var el = t.nodeType === 1 ? t : t.parentElement;
    var own = el && el.closest("[data-rl-own]"); if (own) el = own.parentElement;
    while (el && el !== sec && !isElement(el)) el = el.parentElement;
    if (!el || el === sec) return null;
    var link = el.parentElement && el.parentElement.closest("a,button");     // текст внутри кнопки → вся кнопка
    if (link && sec.contains(link)) el = link;
    // небольшая карточка с рамкой/фоном (плеер, фото в рамке, плашка) — выбирается целиком
    var q = sec.getBoundingClientRect(), secArea = q.width * q.height;
    for (var up = el.parentElement; up && up !== sec; up = up.parentElement) {
      var r = up.getBoundingClientRect();
      if (r.width * r.height < 0.25 * secArea && boxed(up) && !wholeSection(up, sec)) el = up;
    }
    if (/^img$/i.test(el.tagName))                                           // картинка → её рамка того же размера
      while (el.parentElement && el.parentElement !== sec && same(el, el.parentElement) && !wholeSection(el.parentElement, sec)) el = el.parentElement;
    var br = el.getBoundingClientRect();
    return wholeSection(el, sec) || (br.width < 1 && br.height < 1) ? null : el;
  }
  // обёртка на всю секцию — это «вся секция», её не двигаем
  function wholeSection(el, sec) {
    if (!el || el === sec) return true;
    var r = el.getBoundingClientRect(), q = sec.getBoundingClientRect();
    return el.parentElement === sec && r.width * r.height > 0.6 * q.width * q.height;
  }
  function same(a, b) {
    var r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    return Math.abs(r.width - q.width) <= 2 && Math.abs(r.height - q.height) <= 2;
  }
  var movedNow = [];
  function setSize(el, prop, v) {
    var key = "__rlOrig_" + prop;
    if (v) {
      if (!(key in el)) el[key] = el.style[prop];
      if (el.style[prop] !== v) el.style[prop] = v;
    } else if (key in el) { el.style[prop] = el[key]; delete el[key]; }
  }
  // list: [{ el: секция, key, mv: { путь: {dx,dy,w,h,hide} } }]
  function applyMoves(list) {
    var narrow = innerWidth <= 700, seen = [];
    list.forEach(function (it) {
      var mv = it.mv; if (!mv) return;
      Object.keys(mv).forEach(function (path) {
        var el = byPath(it.el, path), m = mv[path]; if (!el) return;
        seen.push(el);
        var tr = !narrow && (m.dx || m.dy) ? (m.dx || 0) + "px " + (m.dy || 0) + "px" : "";
        if (el.style.translate !== tr) el.style.translate = tr;
        setSize(el, "width", !narrow && m.w ? m.w + "px" : "");
        setSize(el, "height", !narrow && m.h ? m.h + "px" : "");
        // удалённый — нет нигде (и у редактора); скрытый — у редактора бледный
        attr(el, "data-rl-hidden", !!m.del || (!!m.hide && !editing));
        attr(el, "data-rl-dim", !m.del && !!m.hide && editing);
        attr(el, "data-rl-moved", !!(m.dx || m.dy || m.w || m.h));
      });
    });
    movedNow.forEach(function (el) {
      if (seen.indexOf(el) >= 0) return;
      el.style.translate = ""; setSize(el, "width", ""); setSize(el, "height", "");
      attr(el, "data-rl-hidden", false); attr(el, "data-rl-dim", false); attr(el, "data-rl-moved", false);
    });
    movedNow = seen;
  }

  // ---- свои секции (фон + свободные элементы)
  var BG = { dark: "", deep: "rl-bg-deep", glow: "rl-bg-glow", image: "" };
  function syncCustom(parent, after) {
    var custom = page().custom || {};
    var alive = {};
    Object.keys(custom).forEach(function (id) {
      alive[id] = 1;
      var c = custom[id];
      var el = document.querySelector('[data-rl-custom="' + id + '"]');
      if (!el) {
        el = document.createElement("section");
        el.setAttribute("data-rl-custom", id);
        el.id = "c-" + id;
        parent.insertBefore(el, after ? after.nextSibling : null);
      }
      var img = c.bg === "image" && c.image ? url(c.image) : "";
      var cls = "rl-csec " + (BG[c.bg] || "");
      if (el.className !== cls) el.className = cls;
      var bg = img ? 'linear-gradient(rgba(10,9,8,.74),rgba(10,9,8,.86)),url("' + img.replace(/"/g, "%22") + '")' : "";
      if (el.style.backgroundImage !== bg) el.style.backgroundImage = bg;
    });
    document.querySelectorAll("[data-rl-custom]").forEach(function (el) { if (!alive[el.getAttribute("data-rl-custom")]) el.remove(); });
  }

  // ---- порядок секций: flex-колонка у общего родителя + CSS order
  function applyOrder(secs, ord) {
    var P = secs[0].parentElement;
    if (!secs.every(function (s) { return s.parentElement === P; })) return false;
    var p = page(), need = (p.order && p.order.length) || (p.custom && Object.keys(p.custom).length);
    var kids = Array.prototype.slice.call(P.children);
    if (!need) {
      if (P.__rlFlex) {
        P.style.display = P.__rlDisp; P.style.flexDirection = ""; P.__rlFlex = false;
        kids.forEach(function (c) { c.style.order = ""; });
      }
      return true;
    }
    if (!P.__rlFlex) {
      P.__rlDisp = P.style.display;
      P.style.display = "flex"; P.style.flexDirection = "column"; P.__rlFlex = true;
    }
    var pos = {}; ord.forEach(function (k, i) { pos[k] = (i + 1) * 10; });
    var firstSec = -1, lastSec = -1;
    kids.forEach(function (c, i) { if (c.hasAttribute("data-rl-sec")) { if (firstSec < 0) firstSec = i; lastSec = i; } });
    var cur = -1000;
    kids.forEach(function (c, i) {
      var k = c.getAttribute("data-rl-sec"), o;
      if (k != null && pos[k] != null) o = cur = pos[k];
      else if (i < firstSec) o = -1000;
      else if (i > lastSec) o = 100000;
      else o = cur + 1;
      if (c.style.order !== String(o)) c.style.order = o;
    });
    return true;
  }

  // ---------------------------------------------------------------- заменённые картинки/аудио
  // замена картинок/аудио: своя для страницы (pages[…].media), общая — data.media (подвал и старые замены)
  function applyMedia() {
    var gm = (data && data.media) || {}, pm = page().media || {};
    if (!Object.keys(gm).length && !Object.keys(pm).length) return;
    var both = Object.assign({}, gm, pm);
    document.querySelectorAll("img,audio").forEach(function (el) {
      if (el.closest(".rl-free,#re-root")) return;
      var map = el.closest('[data-sc-name="SiteFooter"]') ? gm : both;
      var cur = el.getAttribute("src"); if (!cur) return;
      var orig = el.getAttribute("data-rl-orig");
      if (orig && cur !== orig && cur !== url(map[orig])) orig = null;   // React сам поменял src
      if (!orig) orig = cur;
      var to = map[orig];
      if (!to) return;
      el.setAttribute("data-rl-orig", orig);
      if (cur !== url(to)) el.setAttribute("src", url(to));
    });
  }

  // ---------------------------------------------------------------- применить всё
  var applying = false, lastOrder = [], reorderable = false, fitQueued = false;
  function apply() {
    if (!data || applying) return;
    applying = true;
    try {
      applyMedia();
      var natural = sections().filter(function (s) { return !s.hasAttribute("data-rl-custom"); });
      if (!natural.length) return;
      syncCustom(natural[0].parentElement, natural[natural.length - 1]);
      var secs = sections(), ks = keys(secs), p = page(), hidden = p.hidden || [], L = lang();
      secs.forEach(function (el, i) {
        var key = ks[i];
        el.setAttribute("data-rl-sec", key);
        var off = hidden.indexOf(key) >= 0;
        attr(el, "data-rl-hidden", off && !editing);
        attr(el, "data-rl-dim", off && editing);
        layerFor(el, key, ((p.free || {})[key] || {}).items || [], L);
      });
      var foot = footerEl(), moveList = secs.map(function (el, i) { return { el: el, key: ks[i], mv: (p.moves || {})[ks[i]] }; });
      if (foot) {
        foot.setAttribute("data-rl-sec", "footer");
        var g = bucket("footer");
        layerFor(foot, "footer", ((g.free || {}).footer || {}).items || [], L);
        moveList.push({ el: foot, key: "footer", mv: (g.moves || {}).footer });
      }
      lastOrder = computeOrder(ks, p.order);
      reorderable = applyOrder(secs, lastOrder);
      applyMoves(moveList);
      enhanceAudio();
      if (!fitQueued) {
        fitQueued = true;
        requestAnimationFrame(function () { fitQueued = false; sections().concat(footerEl() || []).forEach(fitSpacer); });
      }
      if (booksWanted) loadBooks();
    } finally { applying = false; }
  }
  function layerFor(el, key, items, L) {
    var layer = el.__rlLayer;
    if (!items.length && !editing && !el.hasAttribute("data-rl-custom")) {
      if (layer) { layer.remove(); el.__rlSpacer.remove(); el.__rlLayer = el.__rlSpacer = null; }
      if (el.__rlPos) { el.style.position = ""; el.__rlPos = false; }
      return;
    }
    if (!layer || layer.parentNode !== el) {
      layer = el.__rlLayer = document.createElement("div");
      layer.className = "rl-free"; layer.setAttribute("data-rl-layer", key);
      el.__rlSpacer = document.createElement("div"); el.__rlSpacer.className = "rl-spacer";
    }
    if (layer.parentNode !== el || el.lastChild !== el.__rlSpacer) { el.appendChild(layer); el.appendChild(el.__rlSpacer); }
    if (layer.getAttribute("data-rl-layer") !== key) { layer.setAttribute("data-rl-layer", key); layer.__sig = null; }
    if (!el.__rlPos && getComputedStyle(el).position === "static") { el.style.position = "relative"; el.__rlPos = true; }
    var sig = JSON.stringify(items) + L + editing + JSON.stringify(preview) + (window.RoniBooks && window.RoniBooks.cached().books ? 1 : 0);
    if (layer.__sig !== sig) { layer.__sig = sig; renderFree(layer, key, items); }
  }
  function loadBooks() {
    booksWanted = false;
    var go = function () { window.RoniBooks.list().then(apply, function () {}); };
    if (window.RoniBooks) return go();
    var s = document.createElement("script"); s.src = "assets/books.js"; s.onload = go; document.head.appendChild(s);
  }

  // DOM меняется (React отрисовал, сменили язык) → применяем сразу, до отрисовки кадра
  new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) {
      var t = recs[i].target;
      var n = t.nodeType === 1 ? t : t.parentElement;
      if (n && !n.closest(".rl-free,.rl-spacer,.rl-player,#re-root,.re-tools,.rl-pop,.re-chip,.re-modal-bg,.re-drop,.re-guide")) { apply(); return; }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  var resizeT = 0;
  window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(apply, 150); });

  var ready = (T ? T.fetchJSON("data/layout.json") : fetch("data/layout.json", { cache: "no-cache" }).then(function (r) { return r.json(); }))
    .catch(function () { return {}; })
    .then(function (d) { data = d || {}; apply(); return data; });

  window.RoniLayout = {
    PAGE: PAGE,
    ready: ready,
    data: function () { return data; },
    page: page,
    bucket: bucket,
    bucketForEdit: function (key) {
      if (key !== "footer") return this.pageForEdit();
      return (data.global = data.global || {});
    },
    cleanHTML: cleanHTML,
    pageForEdit: function () {
      data.pages = data.pages || {};
      // первая правка на странице книги: начинаем со своей копии макета общей страницы
      if (!data.pages[PAGE]) data.pages[PAGE] = PARENT && data.pages[PARENT] ? JSON.parse(JSON.stringify(data.pages[PARENT])) : {};
      return data.pages[PAGE];
    },
    FILE: FILE,
    sections: sections,
    keys: keys,
    order: function () { return lastOrder.slice(); },
    canReorder: function () { return reorderable; },
    preview: preview,
    apply: function () {
      document.querySelectorAll(".rl-free").forEach(function (z) { z.__sig = null; });
      apply();
    },
    setEditing: function (on) { editing = !!on; document.documentElement.classList.toggle("rl-editing", editing); this.apply(); },
    fit: function () { sections().forEach(fitSpacer); },
    pathOf: pathOf,
    byPath: byPath,
    pick: pick,
    wholeSection: wholeSection,
    onFree: null
  };
})();
