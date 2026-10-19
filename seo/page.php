<?php
/* SEO-слой: отдаёт страницы сайта (*.html) с title, description, canonical, hreflang, Open Graph
   и разметкой schema.org на нужном языке: ?lang=en|uk|bg, русский — без параметра.
   Сюда запросы направляет .htaccess в корне сайта. Сам файл страницы не меняется — правится только то,
   что уходит посетителю. Если что-то пошло не так, отдаётся исходный файл как есть.
   ?raw=1 — исходник без обработки (им пользуется редактор сайта, когда копирует страницы).
   Тексты — assets/seo.json, книги — data/books.json и data/chapters/. Подробно — docs/SEO.md. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

$page = seo_param('__page');
if ($page === '') $page = 'index.html';
$file = SEO_ROOT . '/' . $page;
if (!preg_match('/^[a-z0-9][a-z0-9_-]*\.html$/i', $page) || !is_file($file)) seo_not_found();
if (isset($_GET['raw'])) seo_passthru($file, 200);

$out = null;
try {
    $out = seo_page($page, $file);
} catch (Exception $e) {
    $out = null;
} catch (Throwable $e) {
    $out = null;
}
if (!$out) seo_passthru($file, $page === '404.html' ? 404 : 200);

if (!empty($out['redirect'])) {
    header('Location: ' . $out['redirect'], true, 301);
    exit;
}
seo_send($out);

// ======================================================================

function seo_send($out) {
    $etag = '"' . md5($out['html']) . '"';
    http_response_code($out['status']);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Roni-SEO: 1');
    if (!$out['index']) header('X-Robots-Tag: noindex, follow');
    if ($out['status'] === 200) {
        header('ETag: ' . $etag);
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim((string) $_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
            http_response_code(304);
            exit;
        }
    }
    echo $out['html'];
    exit;
}

function seo_passthru($file, $status) {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    if ($status !== 200 || isset($_GET['raw'])) header('X-Robots-Tag: noindex, follow');
    readfile($file);
    exit;
}

function seo_not_found() {
    $f = SEO_ROOT . '/404.html';
    if (!is_file($f)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "404 Not Found";
        exit;
    }
    $out = null;
    try { $out = seo_page('404.html', $f); } catch (Exception $e) { $out = null; } catch (Throwable $e) { $out = null; }
    if ($out && empty($out['redirect'])) seo_send($out);
    seo_passthru($f, 404);
}

// title / description / keywords / robots из исходного файла — запасные значения
function seo_static($head) {
    $g = function ($re) use ($head) { return preg_match($re, $head, $m) ? html_entity_decode($m[1], ENT_QUOTES, 'UTF-8') : ''; };
    return [
        'title' => trim($g('#<title\b[^>]*>(.*?)</title>#is')),
        'desc' => $g('#<meta\s+name="description"\s+content="([^"]*)"#i'),
        'keys' => $g('#<meta\s+name="keywords"\s+content="([^"]*)"#i'),
        'robots' => $g('#<meta\s+name="robots"\s+content="([^"]*)"#i'),
    ];
}

// ---------------------------------------------------------------- страница
function seo_page($page, $file) {
    $cfg = seo_cfg();
    $langs = seo_langs();
    $def = seo_def();
    $pc = isset($cfg['pages'][$page]) && is_array($cfg['pages'][$page]) ? $cfg['pages'][$page] : [];
    $lang = strtolower(seo_param('lang'));
    if (!in_array($lang, $langs, true)) $lang = $def;

    if (!empty($pc['redirect'])) {
        list($rp, $rq) = seo_href_split($pc['redirect']);
        return ['redirect' => seo_url($rp, $rq, $lang)];
    }

    $html = @file_get_contents($file);
    if (!is_string($html)) return null;
    $he = stripos($html, '</head>');
    if ($he === false) return null;
    $head = substr($html, 0, $he);
    $rest = substr($html, $he);
    $st = seo_static($head);

    $type = isset($pc['type']) ? (string) $pc['type'] : '';
    if ($type === '' && preg_match('/^book-([a-z0-9_-]+)\.html$/i', $page, $mm)) { $type = 'book'; $pc['book'] = $mm[1]; $pc['fixed'] = true; }
    if ($type === '' && preg_match('/^read-([a-z0-9_-]+)\.html$/i', $page, $mm)) { $type = 'read'; $pc['book'] = $mm[1]; }
    if ($type === '') $type = 'page';

    $m = [
        'path' => $page, 'params' => [], 'langs' => $langs, 'canon' => $lang,
        'title' => seo_field($pc, $lang, 't', $st['title']),
        'desc' => seo_field($pc, $lang, 'd', $st['desc']),
        'keys' => seo_field($pc, $lang, 'k', $st['keys']),
        'image' => isset($pc['image']) ? seo_loc($pc['image'], $lang) : (isset($cfg['ogImage']) ? seo_loc($cfg['ogImage'], $lang) : ''),
        'index' => empty($pc['noindex']) && stripos($st['robots'], 'noindex') === false,
        'og' => 'website', 'pageType' => 'WebPage', 'main' => null, 'nodes' => [], 'crumbs' => [],
        'nos' => '', 'status' => 200, 'base' => false,
    ];
    $home = [seo_ui('home', $lang), seo_url('index.html', [], $lang)];

    switch ($type) {
        case '404':
            $m['status'] = 404;
            $m['index'] = false;
            $m['base'] = true;   // относительные ссылки 404-страницы работают на любом несуществующем адресе
            break;

        case 'home':
            $nodes = [];
            $list = '';
            foreach (seo_books() as $b) {
                if (!is_array($b) || !isset($b['id']) || !seo_valid_id($b['id']) || !seo_published($b)) continue;
                $nodes[] = seo_book_node($b, $lang);
                $list .= seo_nos_book($b, $lang, 'h2');
            }
            $m['nodes'] = $nodes;
            $m['nos'] = '<h1>' . seo_e(seo_author($lang)) . '</h1><p>' . seo_e($m['desc']) . '</p>' . $list;
            break;

        case 'profile':
            $m['pageType'] = 'ProfilePage';
            $m['main'] = ['@id' => seo_person_id()];
            break;

        case 'contact':
            $m['pageType'] = 'ContactPage';
            break;

        case 'blog':
            $m['pageType'] = 'CollectionPage';
            $posts = [];
            $list = '';
            foreach (array_keys(isset($cfg['articles']) && is_array($cfg['articles']) ? $cfg['articles'] : []) as $id) {
                $a = seo_article((string) $id, $lang);
                if (!$a || $a['t'] === '') continue;
                $u = seo_url('article.html', ['id' => (string) $id], $lang);
                $posts[] = ['@type' => 'BlogPosting', 'headline' => $a['t'], 'url' => $u];
                $list .= '<h2><a href="' . seo_e($u) . '">' . seo_e($a['t']) . '</a></h2><p>' . seo_e($a['d']) . '</p>';
            }
            $m['main'] = ['@type' => 'Blog', '@id' => seo_url('blog.html', [], $def) . '#blog', 'name' => $m['title'],
                          'author' => ['@id' => seo_person_id()], 'blogPost' => $posts];
            $m['nos'] = '<h1>' . seo_e($m['title']) . '</h1><p>' . seo_e($m['desc']) . '</p>' . $list;
            break;

        case 'article':
            $ids = array_map('strval', array_keys(isset($cfg['articles']) && is_array($cfg['articles']) ? $cfg['articles'] : []));
            $id = seo_param('id');
            if (!in_array($id, $ids, true)) $id = $ids ? $ids[0] : '';   // как article.html: без id — первая статья
            $a = $id !== '' ? seo_article($id, $lang) : null;
            if (!$a || $a['t'] === '') break;
            $m['params'] = ['id' => $id];
            $m['title'] = seo_fill(seo_loc(isset($cfg['patterns']['article']) ? $cfg['patterns']['article'] : '{title}', $lang), ['title' => $a['t']]);
            $m['desc'] = seo_cut($a['d']);
            if ($a['img'] !== '') $m['image'] = $a['img'];
            $m['og'] = 'article';
            $url = seo_url('article.html', $m['params'], $lang);
            $m['main'] = ['@type' => 'BlogPosting', '@id' => $url . '#article', 'headline' => $a['t'], 'description' => $m['desc'],
                          'inLanguage' => $lang, 'author' => ['@id' => seo_person_id()], 'publisher' => ['@id' => seo_person_id()],
                          'mainEntityOfPage' => $url, 'isPartOf' => ['@id' => seo_url('blog.html', [], $def) . '#blog']];
            if (seo_abs($m['image']) !== '') $m['main']['image'] = seo_abs($m['image']);
            $m['crumbs'] = [$home, [seo_ui('blog', $lang), seo_url('blog.html', [], $lang)], [$a['t'], '']];
            $m['nos'] = '<h1>' . seo_e($a['t']) . '</h1><p>' . seo_e($a['d']) . '</p>'
                . '<p><a href="' . seo_e(seo_url('blog.html', [], $lang)) . '">' . seo_e(seo_ui('blog', $lang)) . '</a></p>';
            break;

        case 'book':
        case 'books':
        case 'landing':
            if ($type === 'books') $id = seo_param('id');
            elseif ($type === 'book' && empty($pc['fixed']) && seo_param('id') !== '') $id = seo_param('id');
            else $id = isset($pc['book']) ? (string) $pc['book'] : '';
            $b = seo_book($id);
            if (!$b) {
                if ($type !== 'landing') $m['index'] = false;   // книги нет в каталоге — страница-заготовка
                break;
            }
            $m['nodes'][] = seo_book_node($b, $lang);
            if ($type === 'landing') {
                $m['crumbs'] = [$home, [$m['title'], '']];
                $m['nos'] = '<h1>' . seo_e($m['title']) . '</h1><p>' . seo_e($m['desc']) . '</p>' . seo_nos_book($b, $lang, 'h2');
                $m['about'] = ['@id' => seo_book_id($b)];
                break;
            }
            list($p, $q) = seo_book_page($b);
            $m['path'] = $p;
            $m['params'] = $q;
            $title = seo_bf($b, $lang, 'title');
            // у страницы с текстами в assets/seo.json (book.html для «Просто вернуться домой») — они
            if (!($page === 'book.html' && isset($pc['book']) && $id === $pc['book'] && isset($pc[$def]['t']))) {
                $m['title'] = seo_fill(seo_loc(isset($cfg['patterns']['book']) ? $cfg['patterns']['book'] : '«{title}» — {author}', $lang),
                                       ['title' => $title, 'author' => seo_author($lang)]);
                $d = seo_bf($b, $lang, 'description');
                $m['desc'] = seo_cut($d !== '' ? $d : seo_bf($b, $lang, 'blurb'));
            }
            $cover = seo_cover($b, $lang);
            if (seo_abs($cover) !== '') $m['image'] = $cover;
            $m['og'] = 'book';
            $m['pageType'] = 'ItemPage';
            $m['main'] = ['@id' => seo_book_id($b)];
            if (!seo_published($b)) $m['index'] = false;   // «Скоро»: страница пока собрана из макета
            $m['crumbs'] = [$home, [$title, '']];
            $m['nos'] = seo_nos_book($b, $lang, 'h1');
            break;

        case 'read':
            $id = seo_param('book');
            if (!seo_valid_id($id)) $id = isset($pc['book']) ? (string) $pc['book'] : 'home';
            $b = seo_book($id);
            $ch = seo_chapter($id);
            $avail = $ch ? seo_chapter_langs($ch) : [];
            if (!$b || !$avail) { $m['index'] = false; break; }
            if (!seo_published($b)) $m['index'] = false;
            $canon = in_array($lang, $avail, true) ? $lang : (in_array($def, $avail, true) ? $def : $avail[0]);
            list($rp, $rq) = seo_book_read($b);
            list($bp, $bq) = seo_book_page($b);
            $m['path'] = $rp;
            $m['params'] = $rq;
            $m['langs'] = $avail;
            $m['canon'] = $canon;
            $title = seo_bf($b, $lang, 'title');
            $text = (string) $ch[$canon]['text'];
            $chName = isset($ch[$canon]['chapter']) && is_string($ch[$canon]['chapter']) && $ch[$canon]['chapter'] !== '' ? $ch[$canon]['chapter'] : seo_ui('chapter', $lang);
            $vars = ['title' => $title, 'author' => seo_author($lang), 'text' => $text];
            $m['title'] = seo_fill(seo_loc(isset($cfg['patterns']['read']) ? $cfg['patterns']['read'] : '«{title}» | {author}', $lang), $vars);
            $m['desc'] = seo_cut(seo_fill(seo_loc(isset($cfg['patterns']['readDesc']) ? $cfg['patterns']['readDesc'] : '{text}', $lang), $vars));
            $img = !empty($b['chapter_image']) ? (string) $b['chapter_image'] : seo_cover($b, $lang);
            if (seo_abs($img) !== '') $m['image'] = $img;
            $m['og'] = 'article';
            $url = seo_url($rp, $rq, $canon);
            $m['nodes'][] = seo_book_node($b, $lang);
            $m['main'] = ['@type' => 'Chapter', '@id' => $url . '#chapter', 'name' => $chName, 'position' => 1,
                          'inLanguage' => $canon, 'url' => $url, 'author' => ['@id' => seo_person_id()],
                          'isPartOf' => ['@id' => seo_book_id($b)]];
            $m['crumbs'] = [$home, [$title, $bp === 'index.html' ? $home[1] : seo_url($bp, $bq, $lang)], [$chName, '']];
            $nos = '<h1>' . seo_e($title) . '</h1><h2>' . seo_e($chName) . '</h2>';
            foreach (seo_paras($text) as $p) $nos .= '<p>' . seo_e($p) . '</p>';
            $gate = isset($ch[$canon]['gate_text']) && is_string($ch[$canon]['gate_text']) ? $ch[$canon]['gate_text'] : '';
            if ($gate !== '') $nos .= '<p><em>' . seo_e($gate) . '</em></p>';
            $nos .= '<p><a href="' . seo_e($bp === 'index.html' ? $home[1] : seo_url($bp, $bq, $lang)) . '">' . seo_e(seo_ui('aboutBook', $lang)) . ': «' . seo_e($title) . '»</a></p>';
            $m['nos'] = $nos;
            break;

        case 'order':
            $m['index'] = false;
            break;
    }

    if (isset($_GET['edit'])) $m['index'] = false;   // режим редактора

    // крошки и описание для обычных страниц
    if (!$m['crumbs'] && $type !== 'home' && $m['index']) {
        $name = !empty($pc['name']) ? seo_ui((string) $pc['name'], $lang) : '';
        $m['crumbs'] = [$home, [$name !== '' ? $name : $m['title'], '']];
    }
    if ($m['nos'] === '' && $m['index']) $m['nos'] = '<h1>' . seo_e($m['title']) . '</h1><p>' . seo_e($m['desc']) . '</p>';

    $headOut = seo_head_strip($head);
    $block = seo_head_block($m, $lang);
    // вставляем сразу после <meta name="viewport"> (или после <head>) — до стилей и скриптов
    if (preg_match('#<meta\s+name="viewport"[^>]*>\s*#i', $headOut, $vm, PREG_OFFSET_CAPTURE)) {
        $pos = $vm[0][1] + strlen($vm[0][0]);
    } elseif (preg_match('#<head\b[^>]*>\s*#i', $headOut, $vm, PREG_OFFSET_CAPTURE)) {
        $pos = $vm[0][1] + strlen($vm[0][0]);
    } else {
        return null;
    }
    $headOut = substr($headOut, 0, $pos) . $block . substr($headOut, $pos);
    $headOut = preg_replace('#(<html\b[^>]*?\blang=")[^"]*(")#i', '${1}' . $lang . '${2}', $headOut, 1);

    if ($m['nos'] !== '') {
        $rest = preg_replace('#(<body\b[^>]*>)#i', '$1' . "\n" . seo_nos_wrap($m['nos'], $lang), $rest, 1);
    }
    return ['html' => $headOut . $rest, 'status' => $m['status'], 'index' => $m['index']];
}

// убрать из <head> старые SEO-теги (их заменит сгенерированный блок)
function seo_head_strip($head) {
    $re = [
        '#<!-- seo -->.*?<!-- /seo -->\s*#s',
        '#<title\b[^>]*>.*?</title>\s*#is',
        '#<meta\s+name="(?:description|keywords|author|robots|twitter:[^"]*|google-site-verification|yandex-verification|msvalidate\.01)"[^>]*>\s*#i',
        '#<meta\s+property="(?:og|book|article):[^"]*"[^>]*>\s*#i',
        '#<link\s+rel="canonical"[^>]*>\s*#i',
        '#<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>\s*#i',
        '#<script\s+type="application/ld\+json"[^>]*>.*?</script>\s*#is',
        '#<meta\s+http-equiv="refresh"[^>]*>\s*#i',
    ];
    foreach ($re as $r) {
        $x = preg_replace($r, '', $head);
        if (is_string($x)) $head = $x;
    }
    return $head;
}

function seo_head_block($m, $lang) {
    $cfg = seo_cfg();
    $def = seo_def();
    $tag = function ($attr, $name, $content) {
        return '<meta ' . $attr . '="' . $name . '" content="' . seo_e($content) . '">' . "\n";
    };
    $self = seo_url($m['path'], $m['params'], $lang);
    $canon = seo_url($m['path'], $m['params'], $m['canon']);
    $url = $m['index'] ? $canon : $self;
    $o = "<!-- seo -->\n";
    if ($m['base']) $o .= '<base href="' . seo_e(seo_base()) . '">' . "\n";
    $o .= '<title>' . seo_e($m['title']) . "</title>\n";
    if ($m['desc'] !== '') $o .= $tag('name', 'description', $m['desc']);
    if ($m['keys'] !== '') $o .= $tag('name', 'keywords', $m['keys']);
    $o .= $tag('name', 'author', seo_author($lang));
    $o .= $tag('name', 'robots', $m['index'] ? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' : 'noindex,follow');
    if ($m['index']) {
        $o .= '<link rel="canonical" href="' . seo_e($canon) . '">' . "\n";
        if (count($m['langs']) > 1) {
            foreach ($m['langs'] as $l) $o .= '<link rel="alternate" hreflang="' . seo_e($l) . '" href="' . seo_e(seo_url($m['path'], $m['params'], $l)) . '">' . "\n";
            $xd = in_array($def, $m['langs'], true) ? $def : $m['langs'][0];
            $o .= '<link rel="alternate" hreflang="x-default" href="' . seo_e(seo_url($m['path'], $m['params'], $xd)) . '">' . "\n";
        }
    }
    $ver = isset($cfg['verification']) && is_array($cfg['verification']) ? $cfg['verification'] : [];
    foreach (['google' => 'google-site-verification', 'yandex' => 'yandex-verification', 'bing' => 'msvalidate.01'] as $k => $n) {
        if (!empty($ver[$k]) && is_string($ver[$k])) $o .= $tag('name', $n, $ver[$k]);
    }
    // Open Graph / Twitter
    $loc = isset($cfg['locales']) && is_array($cfg['locales']) ? $cfg['locales'] : [];
    $site = isset($cfg['siteName']) ? seo_loc($cfg['siteName'], $lang) : seo_author($lang);
    $o .= $tag('property', 'og:type', $m['og']);
    $o .= $tag('property', 'og:site_name', $site);
    $o .= $tag('property', 'og:title', $m['title']);
    if ($m['desc'] !== '') $o .= $tag('property', 'og:description', $m['desc']);
    $o .= $tag('property', 'og:url', $url);
    if (isset($loc[$lang])) $o .= $tag('property', 'og:locale', $loc[$lang]);
    foreach ($m['langs'] as $l) if ($l !== $lang && isset($loc[$l])) $o .= $tag('property', 'og:locale:alternate', $loc[$l]);
    $img = seo_abs($m['image']);
    if ($img !== '') {
        $o .= $tag('property', 'og:image', $img);
        $sz = seo_img_size($m['image']);
        if ($sz) {
            $o .= $tag('property', 'og:image:width', (string) $sz[0]);
            $o .= $tag('property', 'og:image:height', (string) $sz[1]);
        }
        $o .= $tag('property', 'og:image:alt', $m['title']);
    }
    if ($m['og'] === 'book' || $m['og'] === 'article') {
        $au = isset($cfg['author']['page']) ? seo_url((string) $cfg['author']['page'], [], $lang) : '';
        if ($au !== '') $o .= $tag('property', $m['og'] . ':author', $au);
    }
    $o .= $tag('name', 'twitter:card', 'summary_large_image');
    $o .= $tag('name', 'twitter:title', $m['title']);
    if ($m['desc'] !== '') $o .= $tag('name', 'twitter:description', $m['desc']);
    if ($img !== '') {
        $o .= $tag('name', 'twitter:image', $img);
        $o .= $tag('name', 'twitter:image:alt', $m['title']);
    }
    // schema.org (JSON-LD)
    if ($m['index']) {
        $graph = [seo_website_node($lang), seo_person_node($lang)];
        $wp = ['@type' => $m['pageType'], '@id' => $canon . '#webpage', 'url' => $canon, 'name' => $m['title'],
               'inLanguage' => $m['canon'], 'isPartOf' => ['@id' => seo_website_id()]];
        if ($m['desc'] !== '') $wp['description'] = $m['desc'];
        if ($img !== '') $wp['primaryImageOfPage'] = ['@type' => 'ImageObject', 'url' => $img];
        if ($m['crumbs']) $wp['breadcrumb'] = ['@id' => $canon . '#breadcrumb'];
        if (!empty($m['about'])) $wp['about'] = $m['about'];
        $main = $m['main'];
        if ($main) {
            if (isset($main['@type'])) { $graph[] = $main; $wp['mainEntity'] = ['@id' => isset($main['@id']) ? $main['@id'] : $canon . '#main']; }
            else $wp['mainEntity'] = $main;
        }
        $graph[] = $wp;
        foreach ($m['nodes'] as $n) $graph[] = $n;
        if ($m['crumbs']) $graph[] = seo_crumbs_node($canon, $m['crumbs']);
        $json = json_encode(['@context' => 'https://schema.org', '@graph' => $graph], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);
        if (is_string($json)) $o .= '<script type="application/ld+json">' . $json . "</script>\n";
    }
    if ($m['nos'] !== '') $o .= "<noscript><style>x-dc{display:none!important}</style></noscript>\n";
    return $o . "<!-- /seo -->\n";
}

// ---------------------------------------------------------------- версия без JavaScript
// Тот же текст, что показывает страница, — для поисковиков и программ, которые не выполняют JavaScript.
function seo_nos_book($b, $lang, $h) {
    list($p, $q) = seo_book_page($b);
    $url = seo_url($p, $q, $lang);
    $title = seo_bf($b, $lang, 'title');
    $o = '<' . $h . '><a href="' . seo_e($url) . '">' . seo_e($title) . '</a></' . $h . '>';
    $sub = seo_bf($b, $lang, 'subtitle');
    if ($sub !== '') $o .= '<p><em>' . seo_e($sub) . '</em></p>';
    $img = seo_cover($b, $lang);
    if (seo_abs($img) !== '') $o .= '<p><img src="' . seo_e($img) . '" alt="' . seo_e($title) . '" width="200" loading="lazy"></p>';
    $d = seo_bf($b, $lang, 'description');
    foreach (seo_paras($d !== '' ? $d : seo_bf($b, $lang, 'blurb')) as $para) $o .= '<p>' . seo_e($para) . '</p>';
    $ch = seo_chapter($b['id']);
    if ($ch && seo_chapter_langs($ch)) {
        list($rp, $rq) = seo_book_read($b);
        $o .= '<p><a href="' . seo_e(seo_url($rp, $rq, $lang)) . '">' . seo_e(seo_ui('readChapter', $lang)) . ' →</a></p>';
    }
    return $o;
}

function seo_nos_wrap($inner, $lang) {
    $nav = [];
    foreach ([['home', 'index.html'], ['about', 'about.html'], ['blog', 'blog.html'], ['news', 'news.html'], ['contacts', 'contacts.html']] as $it) {
        $nav[] = '<a href="' . seo_e(seo_url($it[1], [], $lang)) . '" style="color:#c9a86a">' . seo_e(seo_ui($it[0], $lang)) . '</a>';
    }
    return '<noscript><div style="max-width:780px;margin:0 auto;padding:40px 22px;font:300 18px/1.7 Georgia,serif;color:#e6dccb;background:#14110d">'
        . '<nav style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:28px">' . implode(' ', $nav) . '</nav>'
        . $inner
        . '<p style="margin-top:36px;font-size:14px;color:#9c917c">' . seo_e(seo_ui('noJs', $lang)) . '</p>'
        . "</div></noscript>\n";
}
