<?php
/* SEO-слой сайта: общие функции для seo/page.php (страницы), seo/sitemap.php и seo/robots.php.
   Тексты и настройки — assets/seo.json, книги — data/books.json, главы — data/chapters/<id>.json.
   Код совместим с PHP 7.0+ и не требует расширений (mbstring и т. п.). Подробно — docs/SEO.md. */

define('SEO_ROOT', dirname(__DIR__));   // корень сайта

// ---------------------------------------------------------------- данные
function seo_json($rel) {
    static $cache = [];
    if (array_key_exists($rel, $cache)) return $cache[$rel];
    $data = null;
    $file = SEO_ROOT . '/' . $rel;
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        if (is_string($raw)) {
            if (substr($raw, 0, 3) === "\xEF\xBB\xBF") $raw = substr($raw, 3);
            $data = json_decode($raw, true);
        }
    }
    return $cache[$rel] = is_array($data) ? $data : null;
}

function seo_cfg() {
    $c = seo_json('assets/seo.json');
    return $c ?: [];
}

function seo_langs() {
    $c = seo_cfg();
    return !empty($c['langs']) && is_array($c['langs']) ? array_values($c['langs']) : ['ru', 'en', 'uk', 'bg'];
}

function seo_def() {
    $c = seo_cfg();
    return isset($c['defaultLang']) ? (string) $c['defaultLang'] : 'ru';
}

// значение на языке: строка как есть, словарь {ru:…, en:…} — нужный язык, иначе язык по умолчанию
function seo_loc($v, $lang) {
    if (is_string($v)) return $v;
    if (!is_array($v)) return '';
    if (isset($v[$lang]) && is_string($v[$lang]) && $v[$lang] !== '') return $v[$lang];
    $def = seo_def();
    if (isset($v[$def]) && is_string($v[$def])) return $v[$def];
    foreach ($v as $x) if (is_string($x)) return $x;
    return '';
}

// поле страницы из assets/seo.json: pages[page][lang][key] → язык по умолчанию → запасное значение
function seo_field($pc, $lang, $key, $fallback) {
    foreach ([$lang, seo_def()] as $l) {
        if (isset($pc[$l][$key]) && is_string($pc[$l][$key]) && $pc[$l][$key] !== '') return $pc[$l][$key];
    }
    return $fallback;
}

function seo_ui($key, $lang) {
    $c = seo_cfg();
    return isset($c['ui'][$key]) ? seo_loc($c['ui'][$key], $lang) : '';
}

function seo_author($lang) {
    $c = seo_cfg();
    return isset($c['author']['name']) ? seo_loc($c['author']['name'], $lang) : '';
}

function seo_fill($pattern, $vars) {
    foreach ($vars as $k => $v) $pattern = str_replace('{' . $k . '}', (string) $v, $pattern);
    return $pattern;
}

function seo_valid_id($id) {
    return is_string($id) && preg_match('/^[a-z0-9_-]{1,60}$/i', $id) === 1;
}

function seo_param($name) {
    return isset($_GET[$name]) && is_string($_GET[$name]) ? $_GET[$name] : '';
}

// ---------------------------------------------------------------- текст
function seo_e($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function seo_len($s) {
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : (int) preg_match_all('/./us', $s);
}

function seo_sub($s, $n) {
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return preg_match('/^.{0,' . (int) $n . '}/us', $s, $m) ? $m[0] : '';
}

// обрезать до $max символов по границе слова, с многоточием
function seo_cut($s, $max = 160) {
    $s = trim(preg_replace('/\s+/u', ' ', (string) $s));
    if (seo_len($s) <= $max) return $s;
    $cut = seo_sub($s, $max - 1);
    $sp = strrpos($cut, ' ');
    if ($sp !== false && seo_len(substr($cut, 0, $sp)) > $max * 0.6) $cut = substr($cut, 0, $sp);
    return preg_replace('/[\s,;:.\x{2013}\x{2014}-]+$/u', '', $cut) . '…';
}

// абзацы текста главы/описания: разделены пустой строкой (как RoniBooks.paras в assets/books.js)
function seo_paras($text) {
    $out = [];
    foreach (preg_split('/\n\s*\n/u', (string) $text) as $p) {
        $p = trim($p);
        if ($p !== '') $out[] = $p;
    }
    return $out;
}

// ---------------------------------------------------------------- адреса
function seo_is_https() {
    $s = $_SERVER;
    return (!empty($s['HTTPS']) && strtolower((string) $s['HTTPS']) !== 'off')
        || (isset($s['HTTP_X_FORWARDED_PROTO']) && stripos((string) $s['HTTP_X_FORWARDED_PROTO'], 'https') === 0)
        || (isset($s['HTTP_X_FORWARDED_SSL']) && strtolower((string) $s['HTTP_X_FORWARDED_SSL']) === 'on')
        || (isset($s['REQUEST_SCHEME']) && strtolower((string) $s['REQUEST_SCHEME']) === 'https')
        || (isset($s['SERVER_PORT']) && (string) $s['SERVER_PORT'] === '443');
}

// базовый адрес сайта со слешем на конце: siteUrl из assets/seo.json, иначе — адрес, по которому пришёл запрос
function seo_base() {
    static $base = null;
    if ($base !== null) return $base;
    $c = seo_cfg();
    $site = isset($c['siteUrl']) ? trim((string) $c['siteUrl']) : '';
    if ($site !== '' && preg_match('#^https?://[a-z0-9.-]+(:\d+)?(/[^\s"<>]*)?$#i', $site)) {
        return $base = rtrim($site, '/') . '/';
    }
    $host = strtolower(isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '');
    if (!preg_match('/^[a-z0-9.-]+(:\d+)?$/', $host)) {
        $host = strtolower(isset($_SERVER['SERVER_NAME']) ? (string) $_SERVER['SERVER_NAME'] : '');
        if (!preg_match('/^[a-z0-9.-]+$/', $host)) $host = 'localhost';
    }
    // папка сайта на сервере: скрипты лежат в <сайт>/seo/
    $dir = '';
    $script = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\', '/', (string) $_SERVER['SCRIPT_NAME']) : '';
    if (preg_match('#^(.*)/seo/[a-z]+\.php$#', $script, $m) && preg_match('#^[A-Za-z0-9/_.-]*$#', $m[1])) $dir = $m[1];
    return $base = (seo_is_https() ? 'https' : 'http') . '://' . $host . $dir . '/';
}

// абсолютный адрес страницы на языке: index.html → корень, русский — без ?lang
function seo_url($path, $params, $lang) {
    $q = [];
    foreach ($params as $k => $v) $q[] = rawurlencode($k) . '=' . rawurlencode($v);
    if ($lang !== seo_def()) $q[] = 'lang=' . rawurlencode($lang);
    if ($path === 'index.html') $path = '';
    return seo_base() . $path . ($q ? '?' . implode('&', $q) : '');
}

// абсолютный адрес картинки/файла сайта (data:-картинки и пустые — '')
function seo_abs($rel) {
    $rel = (string) $rel;
    if ($rel === '' || stripos($rel, 'data:') === 0) return '';
    if (preg_match('#^https?://#i', $rel)) return $rel;
    $rel = preg_replace('#[?\#].*$#', '', $rel);
    return seo_base() . ltrim(preg_replace('#^\./#', '', $rel), '/');
}

// размеры локальной картинки [ширина, высота] или null
function seo_img_size($rel) {
    $rel = preg_replace('#[?\#].*$#', '', (string) $rel);
    if ($rel === '' || strpos($rel, '..') !== false || preg_match('#^(https?:|data:)#i', $rel)) return null;
    $f = SEO_ROOT . '/' . ltrim($rel, '/');
    if (!is_file($f) || !function_exists('getimagesize')) return null;
    $s = @getimagesize($f);
    return $s ? [(int) $s[0], (int) $s[1]] : null;
}

// «book.html?id=x#y» → ['book.html', ['id' => 'x']]
function seo_href_split($href) {
    $href = preg_replace('/#.*$/', '', (string) $href);
    $parts = explode('?', $href, 2);
    $path = $parts[0] === '' ? 'index.html' : $parts[0];
    $params = [];
    if (isset($parts[1]) && $parts[1] !== '') parse_str($parts[1], $params);
    unset($params['lang']);
    return [$path, $params];
}

// ---------------------------------------------------------------- книги (как assets/books.js)
function seo_books() {
    $d = seo_json('data/books.json');
    return ($d && isset($d['books']) && is_array($d['books'])) ? $d['books'] : [];
}

function seo_book($id) {
    if (!seo_valid_id($id)) return null;
    foreach (seo_books() as $b) if (is_array($b) && isset($b['id']) && $b['id'] === $id) return $b;
    return null;
}

// поле книги на языке, пустое — русское (RoniBooks.field)
function seo_bf($b, $lang, $key) {
    if (isset($b[$lang][$key]) && is_string($b[$lang][$key]) && $b[$lang][$key] !== '') return $b[$lang][$key];
    $def = seo_def();
    return isset($b[$def][$key]) && is_string($b[$def][$key]) ? $b[$def][$key] : '';
}

function seo_published($b) {
    return !isset($b['status']) || $b['status'] !== 'soon';
}

function seo_cover($b, $lang) {
    $c = seo_bf($b, $lang, 'cover');
    if ($c === '' && isset($b['cover'])) $c = (string) $b['cover'];
    return $c;
}

// своя страница книги: page из каталога или book.html?id=<id>
function seo_book_page($b) {
    if (!empty($b['page']) && is_string($b['page'])) return seo_href_split($b['page']);
    return ['book.html', ['id' => (string) $b['id']]];
}

// страница первой главы: read_page или read.html?book=<id>
function seo_book_read($b) {
    if (!empty($b['read_page']) && is_string($b['read_page'])) return seo_href_split($b['read_page']);
    return ['read.html', ['book' => (string) $b['id']]];
}

function seo_chapter($id) {
    return seo_valid_id($id) ? seo_json('data/chapters/' . $id . '.json') : null;
}

// языки, на которых у главы есть свой текст
function seo_chapter_langs($ch) {
    $out = [];
    foreach (seo_langs() as $l) {
        if (isset($ch[$l]['text']) && is_string($ch[$l]['text']) && trim($ch[$l]['text']) !== '') $out[] = $l;
    }
    return $out;
}

// правка текста из редактора сайта (data/texts.json), например ARTICLES.1.ru.title
function seo_text_override($page, $path) {
    $t = seo_json('data/texts.json');
    return (isset($t[$page][$path]) && is_string($t[$page][$path]) && $t[$page][$path] !== '') ? $t[$page][$path] : null;
}

// статья блога: заголовок, вводный абзац, картинка (assets/seo.json + правки из редактора)
function seo_article($id, $lang) {
    $c = seo_cfg();
    if (!isset($c['articles'][$id]) || !is_array($c['articles'][$id])) return null;
    $a = $c['articles'][$id];
    $l = isset($a[$lang]) ? $lang : seo_def();
    $x = isset($a[$l]) && is_array($a[$l]) ? $a[$l] : [];
    $t = seo_text_override('article.html', 'ARTICLES.' . $id . '.' . $l . '.title');
    $d = seo_text_override('article.html', 'ARTICLES.' . $id . '.' . $l . '.lead');
    $i = seo_text_override('article.html', 'ARTICLES.' . $id . '.' . $l . '.img');
    return [
        't' => $t !== null ? $t : (isset($x['t']) ? (string) $x['t'] : ''),
        'd' => $d !== null ? $d : (isset($x['d']) ? (string) $x['d'] : ''),
        'img' => $i !== null ? $i : (isset($x['img']) ? (string) $x['img'] : ''),
    ];
}

// ---------------------------------------------------------------- schema.org
function seo_person_id() { return seo_base() . '#author'; }
function seo_website_id() { return seo_base() . '#website'; }

function seo_person_node($lang) {
    $c = seo_cfg();
    $a = isset($c['author']) && is_array($c['author']) ? $c['author'] : [];
    $name = seo_author($lang);
    $n = ['@type' => 'Person', '@id' => seo_person_id(), 'name' => $name];
    if (!empty($a['alternateName']) && is_array($a['alternateName'])) {
        $alt = array_values(array_filter($a['alternateName'], function ($x) use ($name) { return is_string($x) && $x !== $name; }));
        if ($alt) $n['alternateName'] = $alt;
    }
    if (!empty($a['jobTitle'])) $n['jobTitle'] = seo_loc($a['jobTitle'], $lang);
    if (!empty($a['page'])) $n['url'] = seo_url((string) $a['page'], [], $lang);
    if (!empty($a['image']) && seo_abs($a['image']) !== '') $n['image'] = seo_abs($a['image']);
    if (!empty($a['sameAs']) && is_array($a['sameAs'])) $n['sameAs'] = array_values($a['sameAs']);
    if (!empty($a['locality']) || !empty($a['country'])) {
        $n['address'] = ['@type' => 'PostalAddress'];
        if (!empty($a['locality'])) $n['address']['addressLocality'] = (string) $a['locality'];
        if (!empty($a['country'])) $n['address']['addressCountry'] = (string) $a['country'];
    }
    return $n;
}

function seo_website_node($lang) {
    $c = seo_cfg();
    return [
        '@type' => 'WebSite', '@id' => seo_website_id(), 'url' => seo_base(),
        'name' => isset($c['siteName']) ? seo_loc($c['siteName'], $lang) : seo_author($lang),
        'inLanguage' => seo_langs(),
        'publisher' => ['@id' => seo_person_id()],
    ];
}

function seo_book_id($b) {
    list($p, $q) = seo_book_page($b);
    return seo_url($p, $q, seo_def()) . '#book-' . $b['id'];
}

// цена «3.99 €» / «$2.99» → ['3.99', 'EUR'] или null
function seo_price($s) {
    $s = (string) $s;
    if (!preg_match('/(\d+(?:[.,]\d{1,2})?)/', $s, $m)) return null;
    $cur = null;
    $map = ['€' => 'EUR', 'eur' => 'EUR', '$' => 'USD', 'usd' => 'USD', '£' => 'GBP', 'gbp' => 'GBP',
            'лв' => 'BGN', 'bgn' => 'BGN', '₴' => 'UAH', 'грн' => 'UAH', 'uah' => 'UAH', '₽' => 'RUB', 'руб' => 'RUB', 'rub' => 'RUB'];
    foreach ($map as $k => $v) if (stripos($s, $k) !== false) { $cur = $v; break; }
    return $cur ? [str_replace(',', '.', $m[1]), $cur] : null;
}

function seo_book_node($b, $lang) {
    $c = seo_cfg();
    list($p, $q) = seo_book_page($b);
    $name = seo_bf($b, $lang, 'title');
    $n = ['@type' => 'Book', '@id' => seo_book_id($b), 'name' => $name, 'url' => seo_url($p, $q, $lang),
          'author' => ['@id' => seo_person_id()], 'bookFormat' => 'https://schema.org/EBook'];
    $alt = [];
    foreach (seo_langs() as $l) {
        $t = isset($b[$l]['title']) && is_string($b[$l]['title']) ? $b[$l]['title'] : '';
        if ($t !== '' && $t !== $name && !in_array($t, $alt, true)) $alt[] = $t;
    }
    if ($alt) $n['alternateName'] = $alt;
    $desc = seo_bf($b, $lang, 'description');
    if ($desc === '') $desc = seo_bf($b, $lang, 'blurb');
    if ($desc !== '') $n['description'] = seo_cut($desc, 300);
    $img = seo_abs(seo_cover($b, $lang));
    if ($img !== '') $n['image'] = $img;
    if (isset($c['books'][$b['id']]['genre'])) $n['genre'] = seo_loc($c['books'][$b['id']]['genre'], $lang);
    if (!empty($b['amazon']) && is_string($b['amazon']) && stripos($b['amazon'], 'REPLACE') === false && preg_match('#^https?://#i', $b['amazon'])) {
        $n['sameAs'] = $b['amazon'];
    }
    // цена — только когда на сайте работает оплата ("offers": true в assets/seo.json)
    if (!empty($c['offers']) && seo_published($b) && ($pr = seo_price(seo_bf($b, $lang, 'price')))) {
        $n['offers'] = ['@type' => 'Offer', 'price' => $pr[0], 'priceCurrency' => $pr[1],
                        'availability' => 'https://schema.org/InStock',
                        'url' => seo_url('order.html', ['book' => (string) $b['id']], $lang)];
    }
    return $n;
}

function seo_crumbs_node($url, $crumbs) {
    $items = [];
    foreach ($crumbs as $i => $c) {
        $it = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $c[0]];
        if ($c[1] !== '') $it['item'] = $c[1];
        $items[] = $it;
    }
    return ['@type' => 'BreadcrumbList', '@id' => $url . '#breadcrumb', 'itemListElement' => $items];
}

// ---------------------------------------------------------------- карта сайта
// [['path','params','langs','files','images'], …] — все страницы для поисковиков
function seo_sitemap_entries() {
    $c = seo_cfg();
    $langs = seo_langs();
    $out = [];
    $seen = [];
    $add = function ($path, $params, $ls, $files, $images) use (&$out, &$seen) {
        $key = seo_url($path, $params, seo_def());
        if (isset($seen[$key]) || !$ls || !is_file(SEO_ROOT . '/' . $path)) return;
        $seen[$key] = true;
        $out[] = ['path' => $path, 'params' => $params, 'langs' => $ls, 'files' => $files, 'images' => $images];
    };
    $pages = isset($c['pages']) && is_array($c['pages']) ? $c['pages'] : [];
    foreach ($pages as $page => $pc) {
        if (!is_array($pc) || !empty($pc['noindex']) || !empty($pc['redirect']) || (isset($pc['sitemap']) && !$pc['sitemap'])) continue;
        $type = isset($pc['type']) ? $pc['type'] : 'page';
        if (in_array($type, ['home', 'profile', 'contact', 'blog', 'page', 'landing'], true)) {
            $files = [$page];
            if ($type === 'home') $files[] = 'data/books.json';
            $add($page, [], $langs, $files, []);
        } elseif ($type === 'article' && !empty($c['articles']) && is_array($c['articles'])) {
            foreach ($c['articles'] as $id => $a) {
                $ls = array_values(array_intersect($langs, array_keys((array) $a)));
                $art = seo_article((string) $id, seo_def());
                $add($page, ['id' => (string) $id], $ls, [$page], $art && $art['img'] !== '' ? [$art['img']] : []);
            }
        }
    }
    foreach (seo_books() as $b) {
        if (!is_array($b) || !isset($b['id']) || !seo_valid_id($b['id']) || !seo_published($b)) continue;
        list($p, $q) = seo_book_page($b);
        $cover = seo_cover($b, seo_def());
        if ($p !== 'index.html') $add($p, $q, $langs, [$p, 'data/books.json'], $cover !== '' ? [$cover] : []);
        $ch = seo_chapter($b['id']);
        if ($ch) {
            list($rp, $rq) = seo_book_read($b);
            $add($rp, $rq, seo_chapter_langs($ch), [$rp, 'data/books.json', 'data/chapters/' . $b['id'] . '.json'], []);
        }
    }
    return $out;
}
