/* ============================================================
   «Говорящий автор» — голосовой гид hanc.ai по сайту, на всех страницах (подключается в <head> после layout.js).
   Внизу слева — табличка, а над ней «выходит» сам автор, вырезанный из фона: голова и плечи
   над краем таблички, руки при жестах — поверх неё.
   Ролики assets/presenter/idle-a.mp4 (слушает, руки скрещены) и talk.mp4 (говорит) сделаны из
   студийных видео: человек вырезан нейросетью (RobustVideoMatting), в кадре сверху — цвет
   (умноженный на прозрачность), снизу — маска прозрачности. Склеивает их WebGL на <canvas>:
   так прозрачное видео работает во всех браузерах, включая iPhone. Без WebGL — неподвижный
   вырез poster.webp.
   Видео следует за голосом агента: talk.mp4 — «атлас» из кусков восьми роликов, разметка в talk.json
   (собирает presenter-tools/atlas.py). Зазвучал голос — автор начинает говорить со скрещёнными руками
   и через полсекунды раскрывает их; речь идёт — куски сменяют друг друга в похожих позах (наплыв
   между двумя плеерами, шва не видно), руки не скрещиваются; пауза между фразами — движения
   замедляются; голос смолк — автор сам скрещивает руки и переходит в idle.
   Звонок ведёт виджет hanc-ai-pill-call, его кнопка с шаром спрятана — видна только своя
   кнопка в стиле сайта. Голос определяется по громкости входящего звука звонка (WebRTC),
   поэтому файл подключается в <head> до виджета и до первого звонка.
   Табличку можно свернуть (✕) — состояние запоминается в браузере. В админку пока не вынесено.
   ============================================================ */
(function () {
  var AGENT_ID = "6ae607b83ebfd5ff68c070c6";
  var SCRIPT = "https://unpkg.com/hanc-webrtc-widgets";
  var MEDIA = "assets/presenter/", VER = "?v=10";
  var TEXT = {
    ru: { kick: "Экскурсия по сайту", live: "В эфире", name: "Ростислав Вишневский",
          idle: "Расскажу о книгах и покажу сайт", wait: "Соединяю…", listen: "Слушает вас…", talk: "Рассказывает…",
          fail: "Не удалось соединиться — попробуйте ещё раз", off: "Разговор сейчас недоступен",
          start: "Начать экскурсию", end: "Завершить разговор", hide: "Свернуть", open: "Поговорить с автором" },
    en: { kick: "A tour of the site", live: "On air", name: "Rostyslav Vishnevsky",
          idle: "I’ll tell you about my books and show you around", wait: "Connecting…", listen: "Listening…", talk: "Speaking…",
          fail: "Couldn’t connect — please try again", off: "The conversation is unavailable right now",
          start: "Start the tour", end: "End the conversation", hide: "Minimise", open: "Talk to the author" },
    uk: { kick: "Екскурсія сайтом", live: "В ефірі", name: "Ростислав Вишневський",
          idle: "Розповім про книги й покажу сайт", wait: "З’єдную…", listen: "Слухає вас…", talk: "Розповідає…",
          fail: "Не вдалося з’єднатися — спробуйте ще раз", off: "Розмова зараз недоступна",
          start: "Почати екскурсію", end: "Завершити розмову", hide: "Згорнути", open: "Поговорити з автором" },
    bg: { kick: "Обиколка на сайта", live: "В ефир", name: "Ростислав Вишневски",
          idle: "Ще ви разкажа за книгите и ще ви покажа сайта", wait: "Свързване…", listen: "Слуша ви…", talk: "Разказва…",
          fail: "Неуспешно свързване — опитайте отново", off: "Разговорът в момента не е достъпен",
          start: "Започни обиколката", end: "Край на разговора", hide: "Скрий", open: "Говорете с автора" }
  };
  // голос агента: громкость (RMS) выше ON — говорит; после последнего звука ждём HANG мс тишины
  var ON = 0.02, ON_DELAY = 70, HANG = 1200;
  var GAP = 180, SLOW = 0.5, RATE = 0.88;   // жесты чуть медленнее (спокойнее); пауза дольше GAP мс — до SLOW
  var PHRASE = 600, HOLD = 4000;   // новый жест — с первым звуком новой фразы (после паузы ≥ PHRASE мс: вдох короче), не чаще раза в HOLD мс
  var FPS = 24;

  // 1) входящий звук звонков — до того, как виджет создаст соединение
  var audioListeners = [];
  var Native = window.RTCPeerConnection;
  if (Native && !Native.__rpPatched) {
    var Patched = function () {
      var pc = new (Function.prototype.bind.apply(Native, [null].concat([].slice.call(arguments))))();
      pc.addEventListener("track", function (e) {
        if (!e.track || e.track.kind !== "audio") return;
        var stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
        audioListeners.forEach(function (fn) { fn(stream, e.track); });
      });
      return pc;
    };
    Patched.prototype = Native.prototype;
    Object.setPrototypeOf(Patched, Native);
    Patched.__rpPatched = true;
    window.RTCPeerConnection = Patched;
  }

  function lang() {
    try { var l = localStorage.getItem("vish_lang"); return TEXT[l] ? l : "ru"; } catch (e) { return "ru"; }
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  var G = "201,168,106";
  var CSS =
    // табличка; сверху над ней оставлено место, куда «выходит» автор
    ".rp{position:fixed;left:calc(20px + env(safe-area-inset-left,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:60;" +
      "width:470px;max-width:calc(100vw - 40px);padding-top:66px;font-family:Spectral,Georgia,serif;color:#ecdfc4;--lvl:0;pointer-events:none}" +
    ".rp-panel{position:relative;min-height:150px;padding:18px 20px 14px 214px;pointer-events:auto;" +
      "background:linear-gradient(180deg,rgba(30,24,19,.93),rgba(14,11,9,.96));border:1px solid rgba(" + G + ",.2);border-radius:3px;" +
      "box-shadow:0 22px 60px rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}" +
    // тёплый свет из-за спины автора; в разговоре разгорается в такт голосу
    ".rp-panel::before{content:'';position:absolute;left:0;bottom:0;width:250px;height:100%;pointer-events:none;border-radius:3px;" +
      "background:radial-gradient(ellipse 60% 85% at 45% 100%,rgba(232,194,122,.2),rgba(232,194,122,0) 70%);opacity:calc(.75 + var(--lvl) * .9);transition:opacity .3s}" +
    // сам автор: canvas выходит за верх таблички, низ растворяется у её нижнего края
    ".rp-stage{position:absolute;left:-30px;bottom:0;width:300px;aspect-ratio:560/396;padding:0;border:0;background:none;cursor:pointer;z-index:2;pointer-events:auto;" +
      "-webkit-tap-highlight-color:transparent}" +
    ".rp-stage canvas,.rp-stage img{position:absolute;inset:0;width:100%;height:100%;" +
      "filter:drop-shadow(0 0 1px rgba(255,236,205,.32)) drop-shadow(0 12px 18px rgba(0,0,0,.5))}" +
    ".rp-stage img{object-fit:contain;-webkit-mask-image:linear-gradient(to top,transparent,#000 14%);mask-image:linear-gradient(to top,transparent,#000 14%)}" +
    ".rp.is-gl .rp-stage img{display:none}" +
    ".rp-text{position:relative;z-index:1}" +
    ".rp-kick{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#c9a86a;margin-bottom:7px;white-space:nowrap}" +
    ".rp-dot{width:6px;height:6px;border-radius:50%;background:#c9a86a;display:none;flex:none}" +
    ".rp[data-state=wait] .rp-dot,.rp[data-state=listen] .rp-dot,.rp[data-state=talk] .rp-dot{display:block;animation:rp-pulse 1.4s ease-in-out infinite}" +
    ".rp[data-state=listen] .rp-dot,.rp[data-state=talk] .rp-dot{background:#e46b4f;box-shadow:0 0 8px rgba(228,107,79,.8)}" +
    ".rp-name{font:400 21px/1.15 Forum,Georgia,serif;letter-spacing:.02em;color:#f1e6d1}" +
    ".rp-status{font-size:13.5px;line-height:1.35;font-style:italic;color:#b5a78f;margin:4px 0 12px;min-height:1.35em}" +
    ".rp[data-state=fail] .rp-status{color:#e0937c}" +
    ".rp-btn{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(" + G + ",.55);background:rgba(" + G + ",.07);color:#ecdfc4;" +
      "font:400 14px Spectral,Georgia,serif;letter-spacing:1px;padding:10px 18px;border-radius:2px;cursor:pointer;transition:background .25s,border-color .25s,transform .25s}" +
    ".rp-btn:hover{background:rgba(" + G + ",.16);border-color:#c9a86a;transform:translateY(-1px)}" +
    ".rp-btn svg{width:15px;height:15px;fill:currentColor;flex:none;color:#d9b877}" +
    ".rp-btn .rp-i-end{display:none}" +
    ".rp[data-state=wait] .rp-btn,.rp[data-state=listen] .rp-btn,.rp[data-state=talk] .rp-btn{border-color:#c9a86a;background:rgba(" + G + ",.16)}" +
    ".rp[data-state=wait] .rp-i-go,.rp[data-state=listen] .rp-i-go,.rp[data-state=talk] .rp-i-go{display:none}" +
    ".rp[data-state=wait] .rp-i-end,.rp[data-state=listen] .rp-i-end,.rp[data-state=talk] .rp-i-end{display:block}" +
    ".rp-credit{margin-top:9px;font-size:10px;letter-spacing:1px;color:#6b6152}" +
    ".rp-credit a{color:#8a8070;text-decoration:none}.rp-credit a:hover{color:#c9a86a}" +
    ".rp-x{position:absolute;top:6px;right:8px;z-index:3;width:24px;height:24px;padding:0;border:0;background:none;color:#8f826d;" +
      "font:14px/1 Georgia,serif;cursor:pointer;transition:color .2s}" +
    ".rp-x:hover{color:#e2c98f}" +
    ".rp-stage:focus-visible,.rp-btn:focus-visible,.rp-x:focus-visible{outline:2px solid #f0c77c;outline-offset:3px}" +
    // свёрнуто: только автор, поменьше, на светящемся «полу»
    ".rp.is-min{width:170px;padding-top:0}" +
    ".rp.is-min .rp-panel{min-height:0;padding:0;border:0;background:none;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}" +
    ".rp.is-min .rp-text,.rp.is-min .rp-x{display:none}" +
    ".rp.is-min .rp-panel::before{width:100%;height:46px;background:radial-gradient(ellipse 50% 60% at 50% 100%,rgba(232,194,122,.28),rgba(232,194,122,0) 70%)}" +
    ".rp.is-min .rp-stage{position:relative;left:auto;width:170px}" +
    "@keyframes rp-pulse{0%,100%{opacity:1}50%{opacity:.35}}" +
    "@media (max-width:560px){.rp{left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px);padding-top:30px}" +
      ".rp-panel{min-height:126px;padding:13px 14px 12px 146px}.rp-panel::before{width:170px}.rp-stage{left:-22px;width:204px}" +
      ".rp-name{font-size:17px}.rp-status{font-size:12.5px;margin:3px 0 9px}.rp-kick{font-size:9px;letter-spacing:2px;margin-bottom:5px}" +
      ".rp-btn{padding:8px 12px;font-size:12.5px;gap:8px}.rp-credit{display:none}.rp.is-min,.rp.is-min .rp-stage{width:130px}}" +
    "@media (prefers-reduced-motion:reduce){.rp-dot{animation:none!important}.rp-btn,.rp-btn:hover{transform:none}}" +
    "@media print{.rp,.rp-engine{display:none!important}}" +
    // виджет hanc ведёт звонок, но его кнопку с шаром не показываем (окно формы виджета, если появится, остаётся)
    ".rp-engine{position:fixed;left:0;bottom:0;z-index:61}" +
    ".rp-engine::part(pill-button){display:none!important}";

  var ICON_GO = '<svg class="rp-i-go" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6.2h1.6v3.6H2zM5.2 3.8h1.6v8.4H5.2zM8.4 1.6H10v12.8H8.4zM11.6 4.6h1.6v6.8h-1.6z"/></svg>';
  var ICON_END = '<svg class="rp-i-end" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>';

  // ---------------------------------------------------------------- прозрачное видео на WebGL
  // В кадре ролика сверху цвет (уже умножен на прозрачность), снизу маска. Шейдер берёт цвет и маску
  // из двух роликов и смешивает их коэффициентом m (наплыв с a на b), низ растворяет.
  function glRenderer(canvas) {
    var gl;
    try { gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) || canvas.getContext("experimental-webgl"); } catch (e) {}
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}");
    var fs = sh(gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec2 uv;uniform sampler2D t0,t1;uniform float m,h;" +
      "vec4 px(sampler2D t){float y=clamp(uv.y,h,1.-h);" +                         // полтекселя от стыка половин
      "vec3 c=texture2D(t,vec2(uv.x,y*.5)).rgb;float a=texture2D(t,vec2(uv.x,.5+y*.5)).r;" +
      "a=clamp((a-.04)/.92,0.,1.);return vec4(min(c,vec3(a)),a);}" +
      "void main(){vec4 c=mix(px(t0),px(t1),m);gl_FragColor=c*smoothstep(0.,.14,1.-uv.y);}");
    if (!vs || !fs) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var tex = [0, 1].map(function (i) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(function (w) { gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      return t;
    });
    gl.uniform1i(gl.getUniformLocation(pr, "t0"), 0); gl.uniform1i(gl.getUniformLocation(pr, "t1"), 1);
    var uM = gl.getUniformLocation(pr, "m"), uH = gl.getUniformLocation(pr, "h");
    var ready = [false, false], src = [null, null];
    function upload(i, v) {
      if (src[i] !== v) { src[i] = v; ready[i] = false; }   // в текстуре кадр другого ролика — не показываем, пока не обновим
      if (!v || v.readyState < 2) return;
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v); ready[i] = true; } catch (e) {}
      if (v.videoHeight) gl.uniform1f(uH, 1 / v.videoHeight);
    }
    return {
      draw: function (a, b, m) {
        var w = Math.round(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1)), hh = Math.round(w * 396 / 560);
        if (w && (canvas.width !== w || canvas.height !== hh)) { canvas.width = w; canvas.height = hh; }
        upload(0, a);
        if (b && m > 0) upload(1, b);
        var k = b && m > 0 && ready[1] ? (ready[0] ? m : 1) : 0;
        if (!ready[0] && k < 1) return false;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(uM, k);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return true;
      }
    };
  }

  function build() {
    if (document.querySelector(".rp")) return;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    var root = document.createElement("div");
    root.className = "rp" + (store("rp_min") === "1" ? " is-min" : "");
    root.setAttribute("data-state", "idle");
    root.innerHTML =
      '<div class="rp-panel">' +
        '<button type="button" class="rp-stage"><img src="' + MEDIA + "poster.webp" + VER + '" alt=""><canvas></canvas></button>' +
        '<div class="rp-text">' +
          '<div class="rp-kick"><i class="rp-dot"></i><span class="rp-kick-t"></span></div>' +
          '<div class="rp-name"></div>' +
          '<div class="rp-status" aria-live="polite"></div>' +
          '<button type="button" class="rp-btn">' + ICON_GO + ICON_END + '<span class="rp-btn-t"></span></button>' +
          '<div class="rp-credit">Powered by <a href="https://hanc.ai" target="_blank" rel="noopener">HANC.ai</a></div>' +
        "</div>" +
        '<button type="button" class="rp-x">✕</button>' +
      "</div>";
    document.body.appendChild(root);

    function video(name, loop) {
      var v = document.createElement("video");
      v.muted = true; v.loop = !!loop; v.playsInline = true; v.preload = "auto";
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      if (name) v.src = MEDIA + name + VER;
      return v;
    }
    var idle = video("idle-a.mp4", true);
    var stage = root.querySelector(".rp-stage"), canvas = stage.querySelector("canvas");
    var gl = glRenderer(canvas);
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (gl && !still) { var p0 = idle.play(); if (p0 && p0.catch) p0.catch(function () {}); }
    else if (gl) idle.load();
    // два плеера атласа речи: пока один на экране, второй заранее встаёт на кадр, куда будет переход.
    // Атлас грузим, когда к автору потянулись (наведение, касание, фокус, кнопка): пока звонок соединяется,
    // он успевает; один раз в память — оба плеера читают оттуда, перемотка мгновенная
    var P = gl && !still ? [video(), video()] : [], meta = null, loading = false;
    function loadTalk() {
      if (loading || !P.length) return;
      loading = true;
      Promise.all([
        fetch(MEDIA + "talk.json" + VER).then(function (r) { return r.ok ? r.json() : null; }),
        fetch(MEDIA + "talk.mp4" + VER).then(function (r) { return r.ok ? r.blob() : null; })
      ]).then(function (res) {
        if (!res[0] || !res[1]) { loading = false; return; }
        var url = URL.createObjectURL(res[1]);
        P.forEach(function (v) { v.src = url; });
        meta = res[0];
      }).catch(function () { loading = false; });
    }
    ["pointerenter", "touchstart", "focusin"].forEach(function (ev) { root.addEventListener(ev, loadTalk, { passive: true }); });

    var pill = document.createElement("hanc-ai-pill-call");
    pill.className = "rp-engine";
    pill.setAttribute("agent-id", AGENT_ID);
    pill.setAttribute("voice-service-url", "https://voice.hanc.ai");
    document.body.appendChild(pill);

    var btn = root.querySelector(".rp-btn"), x = root.querySelector(".rp-x");
    var state = "idle", failUntil = 0;

    function live() { var s = pill.callStatus; return s === "connected" || s === "connecting"; }
    function failed() {
      var b = pill.shadowRoot && pill.shadowRoot.querySelector("[part=pill-button]");
      return pill.callStatus === "error" || (b && b.getAttribute("data-state") === "error");
    }
    function render() {
      var t = TEXT[lang()];
      var s = state;
      if (!live()) s = pill.domainBlocked ? "off" : (Date.now() < failUntil ? "fail" : "idle");
      root.setAttribute("data-state", s);
      root.querySelector(".rp-kick-t").textContent = s === "listen" || s === "talk" ? t.live : t.kick;
      root.querySelector(".rp-name").textContent = t.name;
      root.querySelector(".rp-status").textContent = t[s] || t.idle;
      root.querySelector(".rp-btn-t").textContent = live() ? t.end : t.start;
      stage.setAttribute("aria-label", t.open);
      x.setAttribute("aria-label", t.hide);
      x.title = t.hide;
    }

    // 2) говорит / молчит
    var talking = false, firstVoice = 0, lastVoice = 0, lastLoud = 0, env = 0, lvl = 0;
    var ctx, analyser, data, timer = 0, lastT = 0;
    function setTalking(on) {
      if (on === talking) return;
      talking = on;
      state = live() ? (on ? "talk" : "listen") : "idle";
      render();
    }
    // 25 раз в секунду по таймеру (а не по кадрам: в перекрытом окне кадры почти не идут); всё считается по времени
    function tick() {
      var now = performance.now(), dt = lastT ? Math.min(1000, now - lastT) : 40;
      lastT = now;
      if (pill.callStatus !== "connected") {   // звук другого агента на странице не считаем
        env = 0; firstVoice = 0;
        if (talking) setTalking(false);
      } else {
        analyser.getFloatTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i++) sum += data[i] * data[i];
        var rms = Math.sqrt(sum / data.length);
        if (rms > ON) lastLoud = now;                     // без сглаживания — для пауз между фразами
        env = Math.max(rms, env * Math.exp(-dt / 120));   // огибающая: гаснет за ~0,3 с тишины
        if (env > ON) {
          lastVoice = now;
          if (!firstVoice) firstVoice = now;
          if (!talking && now - firstVoice > ON_DELAY) setTalking(true);
        } else {
          firstVoice = 0;
          if (talking && now - lastVoice > HANG) setTalking(false);
        }
      }
      step(now);   // и здесь: в перекрытом окне кадры (frame) почти не идут
      var target = talking ? Math.min(1, env / 0.12) : 0;
      lvl += (target - lvl) * (1 - Math.exp(-dt / (target > lvl ? 60 : 260)));
      root.style.setProperty("--lvl", lvl < 0.005 ? "0" : lvl.toFixed(3));
    }
    audioListeners.push(function (stream, track) {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.resume) ctx.resume();
        var src = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        data = new Float32Array(analyser.fftSize);
        src.connect(analyser);   // в колонки не подключаем — звук играет сам виджет
        clearInterval(timer);
        lastT = 0;
        timer = setInterval(tick, 40);
        track.addEventListener("ended", function () { clearInterval(timer); setTalking(false); root.style.setProperty("--lvl", "0"); });
      } catch (e) {}
    });

    // 3) режиссёр: что показывать. talk.json — разметка атласа talk.mp4 (номера кадров атласа):
    //    clips[k] = [начало куска, руки начинают раскрываться, начинают скрещиваться, скрещены, конец куска,
    //    1 — спокойный ролик (руки скрещивает сразу)]; start — кадры начала реплики (руки ещё скрещены, рот уже
    //    говорит); next[3f..3f+2] — куда перейти с кадра f, чтобы речь продолжилась в другом куске (три похожие
    //    позы на выбор); loop[f] — похожая поза раньше в том же куске (−1 — нет); out[f] — куда перейти, чтобы
    //    скрестить руки; idle[f] — похожий кадр idle-a.mp4. Переход — плавный наплыв за 5–7 кадров между плеерами.
    //    Жест меняется только между фразами (или когда кусок кончается). Из подходящих по позе кусков берётся
    //    ролик, которого не было дольше всех: пока не показаны все, к показанным не возвращаемся.
    var cur = idle, nxt = null, fade = 0, fadeMs = 1, pend = null, rate = 1, since = 0, first = true;
    var used = {};   // ролик → когда показывался в последний раз
    var lastM = 0, shown = false, kicked = 0;
    function fr(v) { return v.currentTime * FPS; }
    function clipOf(f) { var c = meta.clips, k = 0; while (k < c.length - 1 && f >= c[k][4]) k++; return k; }
    function spare() { return cur === P[0] ? P[1] : P[0]; }
    function prep(v, f, kind, n, at) {     // плеер заранее встаёт на кадр f; at — с какого кадра текущего ролика переходим
      pend = { v: v, f: f, kind: kind, n: n, at: at };
      if (!v.paused) v.pause();
      v.currentTime = (f + 0.3) / FPS;
    }
    function ready() { var v = pend.v; return !v.seeking && v.readyState >= 2 && Math.abs(fr(v) - pend.f - 0.3) < 0.7; }
    function go() {
      since = performance.now();                                  // когда сменился жест
      if (pend.v !== idle) used[clipOf(pend.f)] = since;
      nxt = pend.v; fade = 0; fadeMs = pend.n * 1000 / FPS; pend = null;
      nxt.playbackRate = nxt === idle ? 1 : rate;
      var p = nxt.play(); if (p && p.catch) p.catch(function () {});
    }
    // куда уже прыгали за последние 20 с — туда не возвращаемся, чтобы один и тот же кусок не шёл по кругу
    var seen = [];
    function fresh(t) {
      var now = performance.now();
      seen = seen.filter(function (s) { return now - s[1] < 20000; });
      return !seen.some(function (s) { return Math.abs(s[0] - t) < 24; });
    }
    // next[f] — [кадр, цена×10] в каждом ролике, где поза подходит. Берём ролик, которого не было дольше всех
    // (недавнее место — штраф), при равенстве — где поза ближе
    function pickNext(f) {
      var o = meta.next[Math.max(0, Math.min(meta.frames - 1, Math.round(f)))], best = o[0][0], bs = Infinity;
      for (var j = 0; j < o.length; j++) {
        var t = o[j][0], sc = (used[clipOf(t)] || 0) + o[j][1] * 30 + (fresh(t) ? 0 : 60000);
        if (sc < bs) { bs = sc; best = t; }
      }
      return best;
    }
    function startFrame() {                // первая реплика — с приветственного жеста (S[0]), дальше — ролик, которого давно не было
      var S = meta.start;
      if (first) return S[0];
      var best = S[0], bs = Infinity;
      for (var j = 0; j < S.length; j++) {
        var sc = (used[clipOf(S[j])] || 0) + Math.random() * 500;
        if (sc < bs) { bs = sc; best = S[j]; }
      }
      return best;
    }
    function direct() {
      var S = meta.start;
      if (cur === idle) {                  // слушает: начало следующей реплики уже ждёт на втором плеере
        if (!pend || pend.kind !== "start") prep(P[0], startFrame(), "start", 5);
        if (talking && ready()) { first = false; go(); }
        return;
      }
      var f = fr(cur), k = clipOf(f), c = meta.clips[k], u = c[1], r = c[2], x = c[3];
      if (pend && pend.at != null && f > pend.at + 8) pend = null;   // не успел перемотаться — выберем заново
      if (talking) {
        if (pend && (pend.kind === "out" || pend.kind === "idle")) pend = null;
        var now = performance.now(), quiet = now - lastLoud, hush = quiet > 400;   // hush — может, речь кончается
        if (f >= x) {                      // кусок кончился (руки скрещены) — реплика начинается заново
          if (!pend && !hush) prep(spare(), startFrame(), "start", 5, f);
        } else if (f >= r - 18) {          // скоро начнёт скрещивать руки, а фраза идёт — продолжаем в другом ролике
          if ((!pend || pend.kind === "phrase") && !hush) {
            var at = Math.max(f, r - 6);
            prep(spare(), pickNext(at + 3), "next", 6, at);
          }
        } else if (!pend && quiet > PHRASE && f > u && now - since > HOLD) {
          prep(spare(), pickNext(f + 2), "phrase", 7, f);   // пауза между фразами — новый жест ждёт следующую фразу
        }
        if (pend && (pend.kind === "phrase" ? quiet < 80 : f >= pend.at) && ready()) {   // новый жест — с первым звуком фразы
          seen.push([pend.f, now]);
          go();
        }
      } else {
        if (pend && pend.kind !== "out" && pend.kind !== "idle") pend = null;
        if (f < u - 2 || f >= x) {         // руки и так скрещены — в idle
          if (!pend || pend.kind !== "idle") prep(idle, meta.idle[Math.min(meta.frames - 1, Math.round(f) + 4)], "idle", 7);
        } else if (!pend && (!c[5] || f < r - 24)) {   // жестикулирует — переход к похожей позе перед скрещиванием рук
          prep(spare(), meta.out[Math.min(meta.frames - 1, Math.round(f) + 3)], "out", 6, f + 3);
        }
        if (pend && ready()) go();
      }
    }
    function step(now) {
      var dt = lastM ? Math.max(0, Math.min(200, now - lastM)) : 16;
      lastM = now;
      if (nxt) {
        fade = Math.min(1, fade + dt / fadeMs);
        if (fade >= 1) { var old = cur; cur = nxt; nxt = null; fade = 0; old.pause(); }
      }
      if (meta && !nxt) direct();
      // браузер сам остановил ролик (вкладка была в фоне, режим энергосбережения) — запускаем снова, не чаще раза в секунду
      if (!nxt && !still && cur.paused && cur.readyState >= 2 && now - kicked > 1000) {
        kicked = now; var p = cur.play(); if (p && p.catch) p.catch(function () {});
      }
      // пауза между фразами — движения замедляются, голос вернулся — снова RATE
      var want = talking && performance.now() - lastLoud > GAP ? SLOW : RATE;
      rate += (want - rate) * Math.min(1, dt / 120);
      [cur, nxt].forEach(function (v) { if (v && v !== idle && Math.abs(v.playbackRate - rate) > 0.04) v.playbackRate = rate; });
    }
    function frame(now) {
      requestAnimationFrame(frame);
      step(now);
      var e = fade * fade * (3 - 2 * fade);   // наплыв с мягким началом и концом
      if (gl && gl.draw(cur, nxt, e) && !shown) { shown = true; root.classList.add("is-gl"); }
    }
    if (gl) requestAnimationFrame(frame);

    // 4) состояние звонка
    var wasLive = false, wasFail = false;
    function sync() {
      var on = live(), f = failed();
      if (f && !wasFail) failUntil = Date.now() + 4000;   // ошибку показываем 4 с, один раз
      wasFail = f;
      if (on && pill.callStatus === "connecting") state = "wait";
      else if (on && state !== "talk") state = "listen";
      if (!on) {
        if (wasLive && talking) setTalking(false);
        state = "idle";
      }
      wasLive = on;
      render();
    }
    pill.addEventListener("call-start", sync);
    pill.addEventListener("call-end", sync);
    setInterval(sync, 300);
    render();

    function toggle() {
      if (typeof pill.toggleCall !== "function") return;
      if (pill.domainBlocked) { render(); return; }
      loadTalk();
      failUntil = 0;
      pill.toggleCall();
      setTimeout(sync, 50);
    }
    btn.addEventListener("click", toggle);
    stage.addEventListener("click", function () {
      if (root.classList.contains("is-min")) { root.classList.remove("is-min"); store("rp_min", "0"); return; }
      toggle();
    });
    x.addEventListener("click", function () { root.classList.add("is-min"); store("rp_min", "1"); });

    if (!document.querySelector('script[src="' + SCRIPT + '"]')) {
      var sc = document.createElement("script");
      sc.src = SCRIPT; sc.async = true; sc.type = "text/javascript";
      document.head.appendChild(sc);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
