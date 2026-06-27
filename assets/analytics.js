/* ============================================================
   Google Analytics (GA4) — единая точка для всего сайта.
   Подключён на каждой странице через <script src="assets/analytics.js" defer>.

   КАК ВКЛЮЧИТЬ:
   1) Получите Measurement ID в Google Analytics (вид: G-XXXXXXXXXX).
   2) Впишите его в GA_ID ниже.
   Аналитика заработает сразу на всех страницах — менять больше ничего не нужно.

   Пока GA_ID пустой — скрипт ничего не делает (никаких ошибок, ничего не грузится).

   ⚠️ GDPR/EU: автор в Болгарии (ЕС). По закону GA с cookie требует согласия
   пользователя ДО запуска. Если нужно — отдельно сделаем баннер согласия,
   и тогда вызывать инициализацию только после "принять".
   ============================================================ */
(function () {
  var GA_ID = ""; // <-- ВПИШИТЕ СЮДА, напр. "G-XXXXXXXXXX"

  if (!GA_ID) return;

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);
})();
