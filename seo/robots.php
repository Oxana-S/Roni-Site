<?php
/* robots.txt для поисковиков (/robots.txt → сюда, см. .htaccess): адрес карты сайта подставляется сам —
   тот домен, на котором открыт сайт (или siteUrl из assets/seo.json). */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

$base = seo_base();
$dir = (string) parse_url($base, PHP_URL_PATH);
if ($dir === '') $dir = '/';

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache');
echo "User-agent: *\n"
    . "Disallow: {$dir}admin/\n"
    . "Disallow: {$dir}seo/\n"
    . "Allow: {$dir}\n"
    . "\n"
    . "# Яндекс: служебные параметры адреса не создают новых страниц\n"
    . "Clean-param: edit&raw&fbclid&gclid&yclid&utm_source&utm_medium&utm_campaign&utm_content&utm_term\n"
    . "\n"
    . "Sitemap: {$base}sitemap.xml\n";
