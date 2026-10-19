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
   Элемент типа «agent» — голосовой AI-агент hanc.ai в оформлении сайта:
     { "type": "agent", "agentId", "style": "keeper|portal", "size": 280|370|440, "voiceUrl",
       "ru": { "kicker", "title", "text", "label" } }   (пустые подписи — по умолчанию для стиля)
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
    // AI-агент: рисунок (дверь хранителя / врата) + подписи + своя кнопка; шар виджета светится внутри рисунка
    ".rl-ag{container-type:inline-size;padding-bottom:44px}",
    ".rl-ag-in{display:flex;flex-direction:column;align-items:center;gap:26px;text-align:center}",
    ".rl-ag-art{position:relative;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".rl-ag-art::before{content:'';position:absolute;left:50%;top:var(--gy);width:var(--gs);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(closest-side,var(--glow),transparent);opacity:.55;transition:opacity .8s;pointer-events:none}",
    ".rl-ag-art:hover::before{opacity:.85}",
    ".rl-ag-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}",
    ".rl-ag-orb{position:absolute;aspect-ratio:1;transition:opacity .6s}",
    ".rl-ag-orb hanc-ai-inline-call{display:block;width:100%;height:100%}",
    ".rl-ag-orb hanc-ai-inline-call::part(button){display:none}",
    ".rl-ag-orb hanc-ai-inline-call::part(orb-container){pointer-events:none;overflow:hidden}",   // свечение шара — только в своём круге
    ".rl-ag-body{display:flex;flex-direction:column;align-items:center;max-width:360px;min-width:0}",
    "@container (min-width:560px){.rl-ag .rl-ag-in{flex-direction:row;justify-content:center;gap:48px;text-align:left}.rl-ag .rl-ag-body{align-items:flex-start}}",
    ".rl-ag-kick{font:400 11px Spectral,serif;letter-spacing:5px;text-transform:uppercase;color:var(--ag-accent);margin-bottom:14px}",
    ".rl-ag-title{font:400 clamp(28px,3vw,36px)/1.15 Forum,serif;color:var(--ag-title);margin-bottom:14px;text-wrap:balance}",
    ".rl-ag-text{font:300 italic 17px/1.7 Spectral,serif;color:#c9bda8;margin-bottom:26px;text-wrap:pretty}",
    ".rl-ag-btn{display:inline-flex;align-items:center;gap:11px;text-decoration:none;border:1px solid rgba(var(--gold-rgb,201,168,106),.5);background:rgba(var(--gold-rgb,201,168,106),.06);color:#ecdfc4;font:400 14.5px Spectral,serif;letter-spacing:1px;padding:14px 28px;border-radius:2px;cursor:pointer;transition:background .25s,border-color .25s,transform .25s}",
    ".rl-ag-btn:hover{background:rgba(var(--gold-rgb,201,168,106),.15);border-color:var(--gold,#c9a86a);transform:translateY(-2px)}",
    ".rl-ag-btn svg{width:14px;height:17px;fill:currentColor;flex-shrink:0;color:var(--ag-icon)}",
    ".rl-ag-st{display:none}",
    ".rl-ag.is-wait .rl-ag-btn [data-rl-f],.rl-ag.is-live .rl-ag-btn [data-rl-f],.rl-ag.is-fail .rl-ag-btn [data-rl-f]{display:none}",
    ".rl-ag.is-wait .rl-ag-st,.rl-ag.is-live .rl-ag-st,.rl-ag.is-fail .rl-ag-st{display:inline}",
    ".rl-ag.is-live .rl-ag-btn{border-color:var(--gold,#c9a86a);background:rgba(var(--gold-rgb,201,168,106),.16)}",
    ".rl-ag.is-live .rl-ag-btn svg{animation:rl-pulse 1.4s ease-in-out infinite}",
    ".rl-ag-credit{font:400 10px Spectral,serif;letter-spacing:1px;color:#6b6152;margin-top:16px}",
    ".rl-ag-credit a{color:#8a8070;text-decoration:none}",
    ".rl-ag-credit a:hover{color:var(--gold,#c9a86a)}",
    ".rl-ag.is-live .rl-ag-art::before{opacity:1;animation:rl-breathe 3s ease-in-out infinite}",
    ".rl-ag.is-wait .rl-ag-art::before,.rl-ag.is-wait .rl-ag-orb{animation:rl-flick 1s linear infinite}",
    // хранитель тайн: дверь кабинета с матовым стеклом, силуэт с сигарой, свет из-под двери, кот у порога
    ".rl-ag-keeper{--ag-accent:var(--gold-text,#b8935a);--ag-title:#f0d8a8;--ag-icon:var(--gold,#c9a86a);--glow:rgba(240,170,80,.2);--gy:34%;--gs:125%}",
    ".rl-ag-frost{position:absolute;left:16.92%;top:8.5%;width:66.15%;height:51.5%;-webkit-backdrop-filter:blur(1.6px);backdrop-filter:blur(1.6px);background:radial-gradient(ellipse at 58% 38%,rgba(255,226,170,.1),rgba(18,11,6,.28) 85%);pointer-events:none}",
    ".rl-ag-sign{position:absolute;left:18.5%;right:18.5%;top:48.5%;height:11.5%;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Forum,serif;text-transform:uppercase;letter-spacing:.14em;line-height:1.25;color:#ecd39b;text-shadow:0 1px 0 #120c06,0 0 8px rgba(0,0,0,.75);text-wrap:balance}",
    ".rl-ag-keeper hanc-ai-inline-call::part(orb-container){overflow:visible;-webkit-mask:radial-gradient(closest-side,#000 68%,transparent) no-repeat;mask:radial-gradient(closest-side,#000 68%,transparent) no-repeat}",   // лампа за стеклом — с мягким краем
    ".rl-ag-man{opacity:.92;transition:opacity .8s}",
    ".rl-ag.is-live .rl-ag-man{opacity:1}",
    ".rl-ag-eye{opacity:.12;transition:opacity .6s}",
    ".rl-ag.is-live .rl-ag-eye{opacity:.95}",
    ".rl-ag-ember{animation:rl-pulse 3s ease-in-out infinite}",
    ".rl-ag-ring{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:rl-ring 7.5s ease-out infinite}",
    ".rl-ag-ring+.rl-ag-ring{animation-delay:-2.5s}",
    ".rl-ag-ring+.rl-ag-ring+.rl-ag-ring{animation-delay:-5s}",
    ".rl-ag-gap{opacity:.6;transition:opacity .8s}",
    ".rl-ag-art:hover .rl-ag-gap{opacity:.85}",
    ".rl-ag.is-live .rl-ag-gap{opacity:1;animation:rl-glow 2.4s ease-in-out infinite}",
    ".rl-ag.is-wait .rl-ag-gap{animation:rl-flick 1s linear infinite}",
    ".rl-ag-tail{transform-box:fill-box;transform-origin:100% 70%;animation:rl-tail 6s ease-in-out infinite}",
    ".rl-ag.is-live .rl-ag-tail{animation-duration:1.8s}",
    ".rl-ag.is-knock .rl-ag-art{animation:rl-knock .55s ease-out}",
    "@media(max-width:700px){.rl-ag-keeper{padding-top:22px}}",
    // врата между мирами: руны по кругу, звёзды, скрещённые клинки
    ".rl-ag-portal{--ag-accent:var(--gold-text,#b8935a);--ag-title:#f0d8a8;--ag-icon:var(--gold,#c9a86a);--glow:rgba(201,168,106,.26);--gy:50%;--gs:125%}",
    ".rl-ag-runes{transform-box:view-box;transform-origin:160px 160px;animation:rl-spin 160s linear infinite}",
    ".rl-ag-ticks{transform-box:view-box;transform-origin:160px 160px;animation:rl-spin 240s linear infinite reverse}",
    ".rl-ag-rglow{opacity:0;transition:opacity .8s}",
    ".rl-ag-art:hover .rl-ag-rglow{opacity:.4}",
    ".rl-ag.is-live .rl-ag-rglow{opacity:.95}",
    ".rl-ag.is-live .rl-ag-runes{animation-duration:36s}",
    ".rl-ag-tw{animation:rl-tw 4.2s ease-in-out infinite}",
    ".rl-ag.is-live .rl-ag-tw{animation-duration:1.8s}",
    "@keyframes rl-spin{to{transform:rotate(360deg)}}",
    "@keyframes rl-tw{0%,100%{opacity:.25}50%{opacity:1}}",
    "@keyframes rl-ring{0%{transform:translate(0,0) scale(.5);opacity:0}15%{opacity:.7}100%{transform:translate(-16px,-72px) scale(1.8);opacity:0}}",
    "@keyframes rl-tail{0%,100%{transform:rotate(0)}50%{transform:rotate(-8deg)}}",
    "@keyframes rl-glow{0%,100%{opacity:.75}50%{opacity:1}}",
    "@keyframes rl-knock{0%,100%{transform:none}12%{transform:translateX(-2px)}24%{transform:translateX(2px)}40%{transform:translateX(-1.5px)}52%{transform:translateX(1.5px)}}",
    "@keyframes rl-flick{0%,100%{opacity:.55}18%{opacity:.95}32%{opacity:.4}54%{opacity:1}71%{opacity:.6}86%{opacity:.9}}",
    "@keyframes rl-breathe{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.08)}}",
    "@keyframes rl-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
    ".rl-editing .rl-ag-art{cursor:move}",
    "@media(prefers-reduced-motion:reduce){.rl-ag *,.rl-ag-art::before{animation:none!important}}",
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
  // ---- AI-агент hanc.ai: виджет <hanc-ai-inline-call> в оформлении сайта.
  // Скрипт виджета подключается один раз и только там, где агент есть.
  // Стили: «keeper» — «Хранитель тайн и секретов» («Призрачный детектив»): дверь кабинета с матовым стеклом,
  //        за стеклом силуэт старого полицейского с сигарой, у порога — кот Конфуций;
  //        «portal» — рунические врата между мирами («Просто вернуться домой»).
  // Шар виджета (three.js) — лампа за стеклом / сердце врат; кнопка, подписи и состояния звонка — наши.
  var AGENT_SCRIPT = "https://unpkg.com/hanc-webrtc-widgets";
  var AGENT_ORB = { 280: 150, 370: 180, 440: 220 };   // размер «маленький / обычный / большой» → масштаб рисунка (180 — как нарисован)
  var AGENT_STYLES = {
    keeper: {
      name: "Хранитель тайн",
      w: 260, h: 400, cx: 140, cy: 118, d: 150, sign: true,   // дверь 260×400; шар Ø150 — лампа в кабинете за силуэтом; название — на стекле
      orb: { primary: "#7a4310", secondary: "#3d1e06", accent: "#c9842f", glow: "#e8a24a", atmosphere: "#3d1e06", depth: "#0a0401", highlight: "#f0c070" },
      fx: { "glow-intensity": 1, "idle-glow-multiplier": 0.6, "morph-strength": 0.9, "noise-scale": 1.4, "noise-speed": 0.22,
            "fresnel-power": 2.2, "rotation-speed": 0.06, "color-contrast": 1.6, "sound-preset": "2" },
      icon: '<svg viewBox="0 0 14 18" aria-hidden="true"><circle cx="7" cy="6" r="4.4"/><path d="M5,8.6H9L10.6,17H3.4Z"/></svg>',
      text: {
        ru: { kicker: "Призрачный детектив", title: "Хранитель тайн и секретов", text: "Он знает, о чём молчат стены старого Нью\u2011Йорка. Постучите — и\u00a0он ответит.",
              label: "Постучать", wait: "Шаги за дверью…", end: "Закрыть дверь", fail: "Никто не открыл — ещё раз" },
        en: { kicker: "A Detective for the Dead", title: "Keeper of Mysteries and Secrets", text: "He knows what the walls of old New\u00a0York keep silent about. Knock — and he will answer.",
              label: "Knock", wait: "Footsteps behind the door…", end: "Close the door", fail: "No one answered — try again" },
        uk: { kicker: "Примарний детектив", title: "Хранитель таємниць і секретів", text: "Він знає, про що мовчать стіни старого Нью\u2011Йорка. Постукайте — і\u00a0він відповість.",
              label: "Постукати", wait: "Кроки за дверима…", end: "Зачинити двері", fail: "Ніхто не відчинив — ще раз" },
        bg: { kicker: "Призрачният детектив", title: "Пазител на тайни и секрети", text: "Той знае за какво мълчат стените на стария Ню\u00a0Йорк. Почукайте — и\u00a0той ще отговори.",
              label: "Почукай", wait: "Стъпки зад вратата…", end: "Затвори вратата", fail: "Никой не отвори — опитайте пак" }
      }
    },
    portal: {
      name: "Врата между мирами",
      w: 320, h: 320, cx: 160, cy: 160, d: 202,         // рисунок 320×320, шар Ø202 — в кольце с рунами
      orb: { primary: "#1c1660", secondary: "#0c0a33", accent: "#2a2290", glow: "#5a48ff", atmosphere: "#0c0a33", depth: "#010008", highlight: "#e8c27a" },
      fx: { "glow-intensity": 1, "idle-glow-multiplier": 0.6, "morph-strength": 0.9, "noise-scale": 1.6, "noise-speed": 0.25,
            "fresnel-power": 2.4, "rotation-speed": 0.12, "color-contrast": 2, "sound-preset": "4" },
      icon: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M9,0L11,7L18,9L11,11L9,18L7,11L0,9L7,7Z"/></svg>',
      text: {
        ru: { kicker: "Хроники рода Даргонов", title: "Голос из другого мира", text: "Дорога между мирами открыта. Коснитесь врат — и\u00a0вам ответят.",
              label: "Открыть врата", wait: "Врата открываются…", end: "Закрыть врата", fail: "Не вышло — ещё раз" },
        en: { kicker: "Chronicles of the Dargon clan", title: "A voice from another world", text: "The road between worlds is open. Touch the gate — and you will be answered.",
              label: "Open the gate", wait: "The gate is opening…", end: "Close the gate", fail: "It didn't work — try again" },
        uk: { kicker: "Хроніки роду Даргонів", title: "Голос з іншого світу", text: "Дорога між світами відкрита. Торкніться брами — і\u00a0вам дадуть відповідь.",
              label: "Відчинити браму", wait: "Брама відчиняється…", end: "Зачинити браму", fail: "Не вийшло — ще раз" },
        bg: { kicker: "Хроники на рода Даргон", title: "Глас от друг свят", text: "Пътят между световете е отворен. Докоснете портата — и\u00a0ще ви отговорят.",
              label: "Отвори портата", wait: "Портата се отваря…", end: "Затвори портата", fail: "Не стана — опитайте пак" }
      }
    }
  };
  var agentSeq = 0;
  function agentScript() {
    if (window.customElements && customElements.get("hanc-ai-inline-call")) return;
    if (document.querySelector('script[src="' + AGENT_SCRIPT + '"]')) return;
    var sc = document.createElement("script");
    sc.src = AGENT_SCRIPT; sc.async = true; sc.type = "text/javascript";
    document.head.appendChild(sc);
  }
  function agentStyle(b) { return AGENT_STYLES[b && b.style] ? b.style : "keeper"; }
  // подпись на текущем языке: своя → по умолчанию для стиля
  function agentText(b, f) {
    var L = lang(), own = b && b[L] && b[L][f];
    if (own) return own;
    var d = AGENT_STYLES[agentStyle(b)].text;
    return (d[L] || d.ru)[f] || tx(b, f);
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function brass(id) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3418"/><stop offset=".22" stop-color="#9c7840"/>' +
      '<stop offset=".42" stop-color="#f0d8a8"/><stop offset=".6" stop-color="#c9a86a"/><stop offset=".85" stop-color="#6e5028"/><stop offset="1" stop-color="#3a2912"/></linearGradient>';
  }
  // силуэт за стеклом (рамка 90×182, лицом влево): старый полицейский — зачёсанные назад волосы, нос с горбинкой
  var KEEPER = "M40,6C52,4 62,10 64,20C66,30 64,40 60,46C58,52 58,58 60,62C70,66 82,70 86,80L90,182L0,182L4,84" +
    "C6,76 14,70 24,68C28,66 31,62 31,58C29,56 26,55 24,52C22,50 21,48 22,46L20,45C20.5,43 21.5,42 21,41" +
    "C19,40 17,39 16,38C13,38 11,36 12,34C13,31 15,29 16,27C17,25 19,23 20,21C20,18 22,15 25,12C30,8 34,6 40,6Z";
  // кот Конфуций у порога (рамка 70×88, сидит мордой вправо): мейн-кун — кисточки на ушах, пушистый хвост
  var CAT = "M38,22C38,14 41,9 44,7L42,-1L49,5C51,4 53,4 55,5L59,-2L60,8C63,12 64,17 63,21C63,24 61,27 58,28" +
    "C57,32 57,36 58,40C60,48 60,60 58,72L58,86C56,88 53,88 52,86L50,79L48,86C40,88 30,88 22,87C14,86 8,81 8,73" +
    "C8,59 18,47 30,39C34,35 37,29 38,22Z";
  var CAT_TAIL = "M24,84C12,88 -2,87 -6,79C-9,72 -3,66 4,68C-1,71 0,78 6,80C12,82 18,81 24,80Z";
  function keeperArt(u) {
    var GLASS = 'x="44" y="34" width="172" height="206"';
    var back = '<svg class="rl-ag-svg" viewBox="0 0 260 400" aria-hidden="true"><defs>' +
      '<radialGradient id="kr' + u + '" gradientUnits="userSpaceOnUse" cx="140" cy="118" r="150"><stop offset="0" stop-color="#f0b45a" stop-opacity=".42"/>' +
      '<stop offset=".55" stop-color="#8a4a14" stop-opacity=".18"/><stop offset="1" stop-color="#0b0806" stop-opacity="0"/></radialGradient></defs>' +
      '<rect ' + GLASS + ' fill="#0b0806"/><rect ' + GLASS + ' fill="url(#kr' + u + ')"/></svg>';
    var man = '<svg class="rl-ag-svg" viewBox="0 0 260 400" aria-hidden="true"><defs><clipPath id="kc' + u + '"><rect ' + GLASS + "/></clipPath></defs>" +
      '<g clip-path="url(#kc' + u + ')"><g fill="none" stroke="#f6efe2" stroke-width="1.9">' +
      '<ellipse class="rl-ag-ring" cx="90" cy="98" rx="6" ry="2.6"/><ellipse class="rl-ag-ring" cx="90" cy="98" rx="6" ry="2.6"/><ellipse class="rl-ag-ring" cx="90" cy="98" rx="6" ry="2.6"/></g>' +
      '<g class="rl-ag-man" transform="translate(88 58)"><path d="' + KEEPER + '" fill="#070504" stroke="#ffcf8a" stroke-opacity=".22" stroke-width="1.2"/>' +
      '<path d="M20.5,43.8L1.5,46.2L1.9,49.6L20.8,47.6Z" fill="#2a190d"/><circle class="rl-ag-ember" cx="1.7" cy="47.9" r="2.2" fill="#ffb054"/>' +
      '<ellipse class="rl-ag-eye" cx="24" cy="25" rx="1.7" ry="1" fill="#ffd28a"/></g></g></svg>';
    var front = '<svg class="rl-ag-svg" viewBox="0 0 260 400" aria-hidden="true"><defs>' + brass("kb" + u) +
      '<linearGradient id="kw' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36261a"/><stop offset="1" stop-color="#1b120b"/></linearGradient>' +
      '<linearGradient id="kl' + u + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f0b45a" stop-opacity="0"/><stop offset=".5" stop-color="#ffd28a"/><stop offset="1" stop-color="#f0b45a" stop-opacity="0"/></linearGradient>' +
      '<filter id="kn' + u + '" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>' +
      '<feColorMatrix values="0 0 0 0 1 0 0 0 0 .95 0 0 0 0 .88 0 0 0 .09 0"/></filter>' +
      '<filter id="kf' + u + '" x="-10%" y="-300%" width="120%" height="700%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>' +
      '<rect ' + GLASS + ' filter="url(#kn' + u + ')"/>' +                                                  // зерно матового стекла
      '<path fill="url(#kw' + u + ')" fill-rule="evenodd" d="M14,8H246V392H14ZM44,34V240H216V34Z"/>' +       // дверь с проёмом под стекло
      '<path d="M22,14V386M30,250V386M236,14V386M228,250V386" stroke="#000" stroke-opacity=".22" fill="none"/>' +
      '<rect x="41" y="31" width="178" height="212" fill="none" stroke="url(#kb' + u + ')" stroke-width="4"/>' +
      '<g fill="none" stroke="#c9a86a" stroke-opacity=".28"><rect x="40" y="258" width="180" height="56" rx="2"/><rect x="48" y="266" width="164" height="40"/>' +
      '<rect x="40" y="324" width="180" height="56" rx="2"/><rect x="48" y="332" width="164" height="40"/></g>' +
      '<g fill="url(#kb' + u + ')"><rect x="14" y="58" width="5" height="26" rx="1"/><rect x="14" y="320" width="5" height="26" rx="1"/>' +
      '<rect x="217" y="286" width="16" height="44" rx="3"/><circle cx="225" cy="298" r="8"/></g>' +
      '<circle cx="225" cy="298" r="8" fill="none" stroke="#2a1d0c" stroke-opacity=".45"/><ellipse cx="222.5" cy="295.5" rx="2.6" ry="1.6" fill="#fff3d6" opacity=".5"/>' +
      '<path class="rl-ag-gap" d="M225,309.6A2.4,2.4 0 1,1 224.99,309.6ZM223.7,313H226.3L227.1,320H222.9Z" fill="#ffcf7a"/>' +   // в замочной скважине — свет
      '<rect class="rl-ag-gap" x="16" y="391" width="228" height="4" fill="url(#kl' + u + ')" filter="url(#kf' + u + ')"/>' +     // свет из-под двери
      '<ellipse class="rl-ag-gap" cx="130" cy="398" rx="110" ry="4" fill="#f0b45a" fill-opacity=".4" filter="url(#kf' + u + ')"/>' +
      '<g transform="translate(12 310)"><path class="rl-ag-tail" d="' + CAT_TAIL + '" fill="#090605" stroke="#e8a050" stroke-opacity=".35"/>' +
      '<path d="' + CAT + '" fill="#090605" stroke="#e8a050" stroke-opacity=".35"/>' +
      '<path d="M42,-1L41,-6M59,-2L60,-7" stroke="#090605" stroke-width="1.4" stroke-linecap="round"/>' +
      '<ellipse cx="57.5" cy="14.5" rx="1.9" ry="1.2" fill="#e8b04a"/></g></svg>';
    return [back, man + '<div class="rl-ag-frost"></div>' + front];
  }
  // руны старшего футарка (рамка 10×16) — по кругу врат
  var RUNES = ["M3 0V16M3 4L9 0M3 9L9 5", "M2 16V2L8 6V16", "M3 0V16M3 4L8 8L3 12", "M3 0V16M3 2L8 6M3 7L8 11",
    "M3 16V0L8 4L3 8L8 16", "M8 3L3 8L8 13", "M2 2L8 14M8 2L2 14", "M3 16V0L8 4L3 8",
    "M2 0V16M8 0V16M2 6L8 10", "M5 0V16M2 5L8 10", "M5 0V16", "M5 2L2 6L5 10M5 6L8 10L5 14",
    "M5 0V16M5 0L8 3M5 16L2 13", "M2 0V16M2 0L6 4L8 2M2 16L6 12L8 14", "M5 16V0M5 6L1 2M5 6L9 2", "M7 0L2 6L8 10L3 16",
    "M5 16V0M1 5L5 0L9 5", "M3 0V16M3 0L8 4L3 8L8 12L3 16", "M2 16V0L5 5L8 0V16", "M2 16V0L8 8M8 16V0L2 8",
    "M3 16V0L8 5", "M5 1L9 8L5 15L1 8Z", "M1 2L9 14V2L1 14Z", "M5 0L9 5L3 13L1 16M5 0L1 5L7 13L9 16"];
  var STARS = [[160, 8, 3.5], [112, 12, 2.4], [214, 14, 2.6], [24, 92, 3], [296, 92, 3.5], [10, 168, 2.5], [310, 176, 2.5],
    [22, 232, 4], [300, 236, 3], [92, 306, 2.6], [230, 308, 3], [160, 312, 2]];
  function portalArt(u) {
    var i, a, ticks = "", runes = "", stars = "";
    for (i = 0; i < 60; i++) {
      a = i * Math.PI / 30;
      var r2 = i % 5 ? 99 : 101;
      ticks += "M" + r1(160 + 96 * Math.sin(a)) + "," + r1(160 - 96 * Math.cos(a)) + "L" + r1(160 + r2 * Math.sin(a)) + "," + r1(160 - r2 * Math.cos(a));
    }
    for (i = 0; i < RUNES.length; i++) runes += '<path transform="rotate(' + (i * 15) + ' 160 160) translate(155 37)" d="' + RUNES[i] + '"/>';
    STARS.forEach(function (p, j) {
      var x = p[0], y = p[1], s = p[2], q = r1(s * 0.22);
      stars += '<path class="rl-ag-tw" style="animation-delay:-' + (j * 0.7).toFixed(1) + 's" d="M' + x + "," + (y - s) + "L" + (x + q) + "," + (y - q) +
        "L" + (x + s) + "," + y + "L" + (x + q) + "," + (y + q) + "L" + x + "," + (y + s) + "L" + (x - q) + "," + (y + q) +
        "L" + (x - s) + "," + y + "L" + (x - q) + "," + (y - q) + 'Z"/>';
    });
    var sword = '<path d="M0,-172L7,-150L7,136L-7,136L-7,-150Z" fill="url(#ps' + u + ')" stroke="#c9a86a" stroke-opacity=".45"/>' +
      '<path d="M0,-146V128" stroke="#fff" stroke-opacity=".16" stroke-width="1.4"/>' +
      '<g fill="url(#pb' + u + ')"><rect x="-31" y="134" width="62" height="8" rx="3"/><circle cx="-33" cy="138" r="4.5"/><circle cx="33" cy="138" r="4.5"/><circle cx="0" cy="175" r="7"/></g>' +
      '<rect x="-5" y="142" width="10" height="27" rx="2" fill="#3b2a18"/>' +
      '<path d="M-5,147L5,151M-5,153L5,157M-5,159L5,163" stroke="#c9a86a" stroke-opacity=".5"/>';
    var back = '<svg class="rl-ag-svg" viewBox="0 0 320 320" aria-hidden="true"><defs>' + brass("pb" + u) +
      '<linearGradient id="ps' + u + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#26252a"/><stop offset=".45" stop-color="#8c919c"/>' +
      '<stop offset=".5" stop-color="#dfe3ea"/><stop offset=".56" stop-color="#6b707a"/><stop offset="1" stop-color="#222126"/></linearGradient>' +
      '<radialGradient id="pd' + u + '"><stop offset=".7" stop-color="#0b0a16"/><stop offset="1" stop-color="#17121c"/></radialGradient></defs>' +
      '<g fill="#f3dfb0">' + stars + '</g>' +
      '<g transform="translate(160 160) rotate(45)">' + sword + '</g><g transform="translate(160 160) rotate(-45)">' + sword + '</g>' +
      '<circle cx="160" cy="160" r="103" fill="url(#pd' + u + ')"/></svg>';
    var front = '<svg class="rl-ag-svg" viewBox="0 0 320 320" aria-hidden="true"><defs>' +
      '<radialGradient id="pr' + u + '" cx="50%" cy="50%" r="50%"><stop offset=".78" stop-color="#2c2216"/><stop offset=".89" stop-color="#3d2f1c"/><stop offset="1" stop-color="#1b140c"/></radialGradient>' +
      '<filter id="pg' + u + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>' +
      '<path fill="url(#pr' + u + ')" fill-rule="evenodd" d="M160,32A128,128 0 1,1 159.99,32ZM160,58A102,102 0 1,1 159.99,58Z"/>' +
      '<g fill="none" stroke="#c9a86a"><circle cx="160" cy="160" r="128" stroke-opacity=".85" stroke-width="1.6"/><circle cx="160" cy="160" r="123.5" stroke-opacity=".25"/>' +
      '<circle cx="160" cy="160" r="106.5" stroke-opacity=".25"/><circle cx="160" cy="160" r="102" stroke-opacity=".75" stroke-width="1.4"/></g>' +
      '<g class="rl-ag-ticks" fill="none" stroke="#c9a86a" stroke-opacity=".55"><path d="' + ticks + '"/></g>' +
      '<g class="rl-ag-runes" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="rl-ag-rglow" stroke="#ffd98a" stroke-width="3" filter="url(#pg' + u + ')">' + runes + '</g>' +
      '<g stroke="#d9b877" stroke-width="1.5">' + runes + '</g></g></svg>';
    return [back, front];
  }
  function agentHTML(b) {
    if (!b.agentId) return editing ? '<div class="rl-cap">AI-агент: укажите ID (⚙)</div>' : "";
    agentScript();
    var s = agentStyle(b), st = AGENT_STYLES[s], k = (AGENT_ORB[b.size] || 180) / 180, orb = Math.round(st.d * k), u = "ag" + (++agentSeq);
    var art = s === "portal" ? portalArt(u) : keeperArt(u), title = agentText(b, "title");
    function pct(v) { return (Math.round(v * 1000) / 10) + "%"; }
    // theme="" — не перекрашивать шар темой из кабинета hanc.ai; свой значок «Powered by» — под кнопкой
    var attrs = ' agent-id="' + esc(b.agentId) + '" voice-service-url="' + esc(b.voiceUrl || "https://voice.hanc.ai") + '" size="' + orb +
      '" container-padding="0" theme="" hide-branding sound-enabled sound-volume="0.35" orb-colors="' + esc(JSON.stringify(st.orb)) + '"';
    for (var a in st.fx) attrs += " " + a + '="' + esc(st.fx[a]) + '"';
    return '<div class="rl-ag rl-ag-' + s + '" data-rl-agent><div class="rl-ag-in">' +
      '<div class="rl-ag-art" style="width:' + Math.round(st.w * k) + "px;height:" + Math.round(st.h * k) + 'px">' + art[0] +
        '<div class="rl-ag-orb" style="left:' + pct((st.cx - st.d / 2) / st.w) + ";top:" + pct((st.cy - st.d / 2) / st.h) + ";width:" + pct(st.d / st.w) +
          '"><hanc-ai-inline-call' + attrs + "></hanc-ai-inline-call></div>" + art[1] +
        // у двери название — золотом на стекле (правится там же, как заголовок)
        (st.sign ? '<div class="rl-ag-sign" data-rl-f="title" style="font-size:' + r1(Math.max(9.5, Math.min(13.5, 13.5 * 24 / Math.max(24, title.length))) * k) + 'px">' + esc(title) + "</div>" : "") +
        "</div>" +
      '<div class="rl-ag-body">' +
        '<div class="rl-ag-kick" data-rl-f="kicker">' + esc(agentText(b, "kicker")) + "</div>" +
        (st.sign ? "" : '<div class="rl-ag-title" data-rl-f="title">' + esc(title) + "</div>") +
        '<div class="rl-ag-text" data-rl-f="text">' + esc(agentText(b, "text")) + "</div>" +
        '<a href="#" role="button" class="rl-ag-btn">' + st.icon + '<span data-rl-f="label">' + esc(agentText(b, "label")) + '</span><span class="rl-ag-st"></span></a>' +
        '<div class="rl-ag-credit">Powered by <a href="https://hanc.ai" target="_blank" rel="noopener">HANC.ai</a></div>' +
      "</div></div></div>";
  }
  // состояние звонка → классы и текст кнопки. Начало и конец приходят событиями,
  // «соединяю» и ошибка — только в атрибуте data-state кнопки виджета (shadow DOM открыт)
  function wireAgent(node, b) {
    var root = node.querySelector("[data-rl-agent]"), w = root && root.querySelector("hanc-ai-inline-call");
    if (!w) return;
    var d = AGENT_STYLES[agentStyle(b)].text, t = d[lang()] || d.ru, label = root.querySelector(".rl-ag-st"), flash = 0;
    function paint() {
      var s = flash ? "error" : (w.callStatus || "idle");
      root.classList.toggle("is-wait", s === "connecting");
      root.classList.toggle("is-live", s === "connected");
      root.classList.toggle("is-fail", s === "error");
      label.textContent = s === "connecting" ? t.wait : s === "connected" ? t.end : s === "error" ? t.fail : "";
    }
    root.__rlFail = function () { clearTimeout(flash); flash = setTimeout(function () { flash = 0; paint(); }, 3000); paint(); };
    w.addEventListener("call-start", paint);
    w.addEventListener("call-end", paint);
    if (window.customElements) customElements.whenDefined("hanc-ai-inline-call").then(function () { return w.updateComplete; }).then(function () {
      var btn = w.shadowRoot && w.shadowRoot.querySelector("[part=button]");
      if (btn && window.MutationObserver) new MutationObserver(paint).observe(btn, { attributes: true, attributeFilter: ["data-state"] });
      paint();
    });
  }
  // клик по рисунку (дверь / врата) или по кнопке — позвонить или положить трубку (в режиме правки — нет)
  document.addEventListener("click", function (e) {
    var t = e.target, root = t && t.closest && t.closest("[data-rl-agent]");
    if (!root || !t.closest(".rl-ag-art,.rl-ag-btn")) return;
    e.preventDefault();
    if (editing) return;
    var w = root.querySelector("hanc-ai-inline-call");
    if (!w || typeof w.toggleCall !== "function") return;
    if (w.domainBlocked) { if (root.__rlFail) root.__rlFail(); return; }
    if (w.callStatus === "idle") {                               // стук в дверь хранителя
      root.classList.remove("is-knock"); void root.offsetWidth; root.classList.add("is-knock");
      setTimeout(function () { root.classList.remove("is-knock"); }, 600);
    }
    w.toggleCall();
  });
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (e.key === " " && !editing && t && t.classList && t.classList.contains("rl-ag-btn")) { e.preventDefault(); t.click(); }
  });
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
    if (t === "agent") return agentHTML(b);
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
  // элементы, которые дорисовываются позже (виджет AI-агента, картинки), — секция подстраивает высоту
  var sizeObs = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { var sec = e.target.closest("[data-rl-sec]"); if (sec) fitSpacer(sec); });
  }) : null;
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
      else if (b.type === "agent") d.style.width = "50%";
      if (b.h) d.style.height = b.h + "px";
      d.style.textAlign = b.align || "left";
      d.innerHTML = renderBlock(b);
      if (b.type === "agent") wireAgent(d, b);
      var pl = d.querySelector(".rl-player"), au = d.querySelector("audio");
      if (pl && au) wire(pl, au);
      row.appendChild(d);
      if (sizeObs) sizeObs.observe(d);
    });
    if (window.RoniLayout.onFree) window.RoniLayout.onFree(layer, key, items);
  }
  // секция вырастает, если элементы стоят ниже её низа
  function fitSpacer(sec) {
    var layer = sec.__rlLayer, sp = sec.__rlSpacer;
    if (!layer || !sp) return;
    var need = 0;
    Array.prototype.forEach.call(layer.querySelectorAll(".rl-fi"), function (c) { need = Math.max(need, c.offsetTop + c.offsetHeight + 40); });
    // подгоняем, пока секция не станет нужной высоты: у секции может быть min-height,
    // и тогда прибавка распорки сначала «съедается» им
    for (var i = 0; i < 4; i++) {
      var cur = sp.offsetHeight, h = Math.max(0, Math.round(cur + need - sec.offsetHeight));
      if (Math.abs(h - cur) < 1) break;
      sp.style.height = h + "px";
    }
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
    // книги догрузились — перерисовываем только слой с карточками книг (виджет агента не пересоздаётся, звонок не рвётся)
    var wantsBooks = items.some(function (b) { return b.type === "book"; });
    var sig = JSON.stringify(items) + L + editing + JSON.stringify(preview) + (wantsBooks && window.RoniBooks && window.RoniBooks.cached().books ? 1 : 0);
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
    agentText: agentText,
    agentStyles: function () { return Object.keys(AGENT_STYLES).map(function (k) { return [k, AGENT_STYLES[k].name]; }); },
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
