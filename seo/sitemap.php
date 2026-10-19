<?php
/* Карта сайта для поисковиков (/sitemap.xml → сюда, см. .htaccess).
   Собирается сама: страницы из assets/seo.json, книги и главы — из data/books.json и data/chapters/
   (новая книга из админки появляется здесь, как только получит статус «Опубликована»).
   Каждая страница — на всех языках, где есть её текст, со ссылками hreflang между версиями. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

function seo_x($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_XML1 | ENT_SUBSTITUTE, 'UTF-8');
}

$xml = '';
try {
    $def = seo_def();
    $rows = [];
    foreach (seo_sitemap_entries() as $e) {
        $mt = 0;
        foreach ($e['files'] as $f) if (is_file(SEO_ROOT . '/' . $f)) $mt = max($mt, (int) filemtime(SEO_ROOT . '/' . $f));
        $alt = '';
        if (count($e['langs']) > 1) {
            foreach ($e['langs'] as $l) $alt .= '    <xhtml:link rel="alternate" hreflang="' . seo_x($l) . '" href="' . seo_x(seo_url($e['path'], $e['params'], $l)) . '"/>' . "\n";
            $xd = in_array($def, $e['langs'], true) ? $def : $e['langs'][0];
            $alt .= '    <xhtml:link rel="alternate" hreflang="x-default" href="' . seo_x(seo_url($e['path'], $e['params'], $xd)) . '"/>' . "\n";
        }
        $img = '';
        foreach ($e['images'] as $i) {
            $u = seo_abs($i);
            if ($u !== '') $img .= '    <image:image><image:loc>' . seo_x($u) . '</image:loc></image:image>' . "\n";
        }
        foreach ($e['langs'] as $l) {
            $rows[] = "  <url>\n    <loc>" . seo_x(seo_url($e['path'], $e['params'], $l)) . "</loc>\n"
                . ($mt ? '    <lastmod>' . gmdate('Y-m-d\TH:i:s\Z', $mt) . "</lastmod>\n" : '')
                . $alt . $img . "  </url>";
        }
    }
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n"
        . implode("\n", $rows) . "\n</urlset>\n";
} catch (Exception $e) {
    $xml = '';
} catch (Throwable $e) {
    $xml = '';
}

header('Cache-Control: no-cache');
header('X-Robots-Tag: noindex');
if ($xml === '' && is_file(SEO_ROOT . '/sitemap.xml')) {
    header('Content-Type: application/xml; charset=utf-8');
    readfile(SEO_ROOT . '/sitemap.xml');   // запасной статичный файл
    exit;
}
header('Content-Type: application/xml; charset=utf-8');
echo $xml;
