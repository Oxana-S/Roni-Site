/* ============================================================
   Многоязычные SEO-мета (title / description / keywords).
   Язык сайта клиентский (localStorage 'vish_lang'), поэтому мета
   обновляется на лету: при загрузке и при каждой смене языка.

   Статичные RU-мета в <head> остаются как фолбэк для краулеров
   и OG-скраперов (они часто не исполняют JS). Этот файл обновляет
   то, что видит реальный посетитель (вкладка браузера + JS-краулеры).
   ============================================================ */
(function () {
  // page -> lang -> {t:title, d:description, k:keywords}
  var SEO = {
    "index.html": {
      ru: { t: "Ростислав Вишневский — мистический детектив «Призрачный детектив»",
            d: "Официальный сайт писателя Ростислава Вишневского. «Призрачный детектив»: нью-йоркский полицейский Лукас Палао, кот Конфуций и призрак Оливия Холден.",
            k: "Ростислав Вишневский, мистический детектив, Призрачный детектив, Лукас Палао, детектив книга, писатель" },
      en: { t: "Rostyslav Vishnevsky (Ronny Cherry) — A Detective for the Dead",
            d: "Official site of author Rostyslav Vishnevsky (Ronny Cherry). A Detective for the Dead: NYPD detective Lucas Palao, Confucius the cat and the ghost of Olivia Holden.",
            k: "Rostyslav Vishnevsky, Ronny Cherry, A Detective for the Dead, mystery, supernatural detective, Lucas Palao, author" },
      uk: { t: "Ростислав Вишневський — містичний детектив «Примарний детектив»",
            d: "Офіційний сайт письменника Ростислава Вишневського. «Примарний детектив»: нью-йоркський поліцейський Лукас Палао, кіт Конфуцій і привид Олівія Холден.",
            k: "Ростислав Вишневський, містичний детектив, Примарний детектив, Лукас Палао, детектив книга, письменник" },
      bg: { t: "Ростислав Вишневски — мистичен детектив „Призрачният детектив“",
            d: "Официален сайт на писателя Ростислав Вишневски. „Призрачният детектив“: нюйоркският полицай Лукас Палао, котаракът Конфуций и призракът Оливия Холдън.",
            k: "Ростислав Вишневски, мистичен детектив, Призрачният детектив, Лукас Палао, детективска книга, писател" }
    },
    "return-home.html": {
      ru: { t: "«Просто вернуться домой» — эпическое фэнтези Ростислава Вишневского",
            d: "Официальный сайт писателя Ростислава Вишневского. Эпическое фэнтези о долге, наследии и судьбе — мир Толус и хроники рода Даргонов.",
            k: "Ростислав Вишневский, эпическое фэнтези, фэнтези книги, Просто вернуться домой, Толус, Даргоны, писатель фэнтези" },
      en: { t: "“Just to Return Home” — epic fantasy by Rostyslav Vyshnevskyi",
            d: "Official site of author Rostyslav Vyshnevskyi. Epic fantasy of duty, heritage and fate — the world of Tolus and the chronicles of the Dargon clan.",
            k: "Rostyslav Vyshnevskyi, epic fantasy, fantasy books, Just to Return Home, Tolus, Dargons, fantasy author" },
      uk: { t: "«Просто повернутися додому» — епічне фентезі Ростислава Вишневського",
            d: "Офіційний сайт письменника Ростислава Вишневського. Епічне фентезі про обов'язок, спадок і долю — світ Толус і хроніки роду Даргонів.",
            k: "Ростислав Вишневський, епічне фентезі, фентезі книги, Просто повернутися додому, Толус, Даргони, письменник фентезі" },
      bg: { t: "«Просто да се върнеш у дома» — епично фентъзи от Ростислав Вишневски",
            d: "Официален сайт на писателя Ростислав Вишневски. Епично фентъзи за дълг, наследство и съдба — светът Толус и хрониките на рода Даргони.",
            k: "Ростислав Вишневски, епично фентъзи, фентъзи книги, Просто да се върна у дома, Толус, Даргони, писател фентъзи" }
    },
    "about.html": {
      ru: { t: "Об авторе — Ростислав Вишневский", d: "Ростислав Вишневский — писатель в жанре эпического фэнтези. История, вдохновение и мир его книг.", k: "Ростислав Вишневский, об авторе, биография писателя, фэнтези автор" },
      en: { t: "About the author — Rostyslav Vyshnevskyi", d: "Rostyslav Vyshnevskyi is an epic fantasy author. His story, inspiration and the world of his books.", k: "Rostyslav Vyshnevskyi, about the author, writer biography, fantasy author" },
      uk: { t: "Про автора — Ростислав Вишневський", d: "Ростислав Вишневський — письменник у жанрі епічного фентезі. Історія, натхнення і світ його книг.", k: "Ростислав Вишневський, про автора, біографія письменника, фентезі автор" },
      bg: { t: "За автора — Ростислав Вишневски", d: "Ростислав Вишневски е писател в жанра епично фентъзи. История, вдъхновение и светът на книгите му.", k: "Ростислав Вишневски, за автора, биография на писателя, фентъзи автор" }
    },
    "book.html": {
      ru: { t: "«Просто вернуться домой» — роман Ростислава Вишневского", d: "Первая книга цикла. Воин рода Даргонов, древнее оружие и дорога между мирами. Купить и читать онлайн.", k: "Просто вернуться домой, книга, роман, эпическое фэнтези, Ростислав Вишневский, купить книгу" },
      en: { t: "“Just to Return Home” — a novel by Rostyslav Vyshnevskyi", d: "The first book of the series. A warrior of the Dargon clan, ancient weapons and a road between worlds. Buy and read online.", k: "Just to Return Home, book, novel, epic fantasy, Rostyslav Vyshnevskyi, buy book" },
      uk: { t: "«Просто повернутися додому» — роман Ростислава Вишневського", d: "Перша книга циклу. Воїн роду Даргонів, давня зброя і дорога між світами. Купити і читати онлайн.", k: "Просто повернутися додому, книга, роман, епічне фентезі, Ростислав Вишневський, купити книгу" },
      bg: { t: "«Просто да се върна у дома» — роман от Ростислав Вишневски", d: "Първата книга от поредицата. Воин от рода Даргони, древно оръжие и път между световете. Купи и чети онлайн.", k: "Просто да се върна у дома, книга, роман, епично фентъзи, Ростислав Вишневски, купи книга" }
    },
    // read.html / order.html / books.html — заголовок ставит сама страница по данным книги (assets/books.js)
    "reviews.html": {
      ru: { t: "Отзывы читателей — книги Ростислава Вишневского", d: "Что читатели говорят о книгах Ростислава Вишневского и мире Толус.", k: "отзывы, рецензии, читатели, Ростислав Вишневский, книги отзывы" },
      en: { t: "Reader reviews — books by Rostyslav Vyshnevskyi", d: "What readers say about Rostyslav Vyshnevskyi's books and the world of Tolus.", k: "reviews, ratings, readers, Rostyslav Vyshnevskyi, book reviews" },
      uk: { t: "Відгуки читачів — книги Ростислава Вишневського", d: "Що читачі кажуть про книги Ростислава Вишневського та світ Толус.", k: "відгуки, рецензії, читачі, Ростислав Вишневський, відгуки про книги" },
      bg: { t: "Отзиви на читатели — книги от Ростислав Вишневски", d: "Какво казват читателите за книгите на Ростислав Вишневски и света Толус.", k: "отзиви, рецензии, читатели, Ростислав Вишневски, отзиви за книги" }
    },
    "blog.html": {
      ru: { t: "Блог — заметки Ростислава Вишневского", d: "Заметки автора о мире Толус, создании книг и философии историй.", k: "блог, заметки автора, worldbuilding, Толус, Ростислав Вишневский" },
      en: { t: "Blog — notes by Rostyslav Vyshnevskyi", d: "The author's notes on the world of Tolus, writing books and the philosophy of stories.", k: "blog, author notes, worldbuilding, Tolus, Rostyslav Vyshnevskyi" },
      uk: { t: "Блог — нотатки Ростислава Вишневського", d: "Нотатки автора про світ Толус, створення книг і філософію історій.", k: "блог, нотатки автора, worldbuilding, Толус, Ростислав Вишневський" },
      bg: { t: "Блог — бележки от Ростислав Вишневски", d: "Бележки на автора за света Толус, създаването на книги и философията на историите.", k: "блог, бележки на автора, worldbuilding, Толус, Ростислав Вишневски" }
    },
    "article.html": {
      ru: { t: "Статья — блог Ростислава Вишневского", d: "Статья из блога писателя Ростислава Вишневского о мире Толус.", k: "статья, блог, Ростислав Вишневский, фэнтези, Толус" },
      en: { t: "Article — Rostyslav Vyshnevskyi's blog", d: "An article from author Rostyslav Vyshnevskyi's blog about the world of Tolus.", k: "article, blog, Rostyslav Vyshnevskyi, fantasy, Tolus" },
      uk: { t: "Стаття — блог Ростислава Вишневського", d: "Стаття з блогу письменника Ростислава Вишневського про світ Толус.", k: "стаття, блог, Ростислав Вишневський, фентезі, Толус" },
      bg: { t: "Статия — блог на Ростислав Вишневски", d: "Статия от блога на писателя Ростислав Вишневски за света Толус.", k: "статия, блог, Ростислав Вишневски, фентъзи, Толус" }
    },
    "news.html": {
      ru: { t: "Новости — Ростислав Вишневский", d: "Новости о книгах, выходах и событиях писателя Ростислава Вишневского.", k: "новости, анонсы, Ростислав Вишневский, книги новости" },
      en: { t: "News — Rostyslav Vyshnevskyi", d: "News about books, releases and events of author Rostyslav Vyshnevskyi.", k: "news, announcements, Rostyslav Vyshnevskyi, book news" },
      uk: { t: "Новини — Ростислав Вишневський", d: "Новини про книги, виходи та події письменника Ростислава Вишневського.", k: "новини, анонси, Ростислав Вишневський, новини книг" },
      bg: { t: "Новини — Ростислав Вишневски", d: "Новини за книги, издания и събития на писателя Ростислав Вишневски.", k: "новини, анонси, Ростислав Вишневски, новини за книги" }
    },
    "contacts.html": {
      ru: { t: "Контакты — написать автору | Ростислав Вишневский", d: "Связаться с писателем Ростиславом Вишневским: почта, телефон, форма обратной связи.", k: "контакты, написать автору, связь, Ростислав Вишневский" },
      en: { t: "Contact — write to the author | Rostyslav Vyshnevskyi", d: "Get in touch with author Rostyslav Vyshnevskyi: email, phone, contact form.", k: "contact, write to the author, get in touch, Rostyslav Vyshnevskyi" },
      uk: { t: "Контакти — написати автору | Ростислав Вишневський", d: "Зв'язатися з письменником Ростиславом Вишневським: пошта, телефон, форма зворотного зв'язку.", k: "контакти, написати автору, зв'язок, Ростислав Вишневський" },
      bg: { t: "Контакти — пишете на автора | Ростислав Вишневски", d: "Свържете се с писателя Ростислав Вишневски: имейл, телефон, формуляр за контакт.", k: "контакти, пишете на автора, връзка, Ростислав Вишневски" }
    }
  };

  var LOCALE = { ru: "ru_RU", en: "en_US", uk: "uk_UA", bg: "bg_BG" };

  function pageKey() {
    var p = location.pathname.split("/").pop();
    if (!p) return "index.html";
    return p;
  }
  function setMeta(sel, attr, val) {
    var el = document.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  }
  function applyMeta(lang) {
    if (pageKey() === "book.html" && /[?&]id=(?!home(&|$))/.test(location.search)) return;   // страница другой книги
    var data = SEO[pageKey()];
    if (!data) return;                 // страница без переводов — оставляем статичную RU
    var m = data[lang] || data.ru;
    if (!m) return;
    document.title = m.t;
    setMeta('meta[name="description"]', "content", m.d);
    setMeta('meta[name="keywords"]', "content", m.k);
    setMeta('meta[property="og:title"]', "content", m.t);
    setMeta('meta[property="og:description"]', "content", m.d);
    setMeta('meta[property="og:locale"]', "content", LOCALE[lang] || "ru_RU");
    setMeta('meta[name="twitter:title"]', "content", m.t);
    setMeta('meta[name="twitter:description"]', "content", m.d);
    try { document.documentElement.lang = lang; } catch (e) {}
  }
  function current() {
    try { return localStorage.getItem("vish_lang") || "ru"; } catch (e) { return "ru"; }
  }

  // применить при загрузке
  applyMeta(current());

  // обновлять при смене языка: перехватываем запись 'vish_lang'
  try {
    var _set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) { _set(k, v); if (k === "vish_lang") applyMeta(v); };
  } catch (e) {}
})();
