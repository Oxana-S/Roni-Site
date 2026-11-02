<?php
/* Скачивание купленной книги по личной ссылке из письма: shop/download.php?o=<заказ>&t=<токен>&f=pdf|epub…
   Файлы лежат вне папки сайта (shop_files_dir()), поэтому напрямую их не открыть.
   Ссылка работает link_days дней и не больше link_downloads скачиваний (shop/config.php). */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

$id = isset($_GET['o']) ? (string) $_GET['o'] : '';
$ext = strtolower(isset($_GET['f']) ? (string) $_GET['f'] : '');
$o = shop_order_load($id);
if (!$o || !hash_equals((string) $o['token'], isset($_GET['t']) ? (string) $_GET['t'] : '') || $o['status'] !== 'paid') {
    shop_text_response(404, 'Ссылка недействительна / Link is not valid.');
}
$c = shop_cfg();
$age = time() - (int) strtotime(isset($o['paid']) ? $o['paid'] : $o['created']);
if ($age > (int) $c['link_days'] * 86400 || (int) $o['downloads'] >= (int) $c['link_downloads']) {
    shop_text_response(410, "Срок ссылки истёк — ответьте на письмо с книгой, и мы пришлём новую.\nThis link has expired — reply to the email with your book and we will send a new one.");
}
$files = shop_book_files($o['book'], $o['lang']);
if (!isset($files[$ext])) shop_text_response(404, 'Файл не найден / File not found.');

shop_order_update($id, function (&$x) { $x['downloads'] = (int) $x['downloads'] + 1; return true; });

$b = seo_book($o['book']);
$title = $b ? seo_bf($b, shop_lang($o['lang']), 'title') : $o['book'];
$name = $title . '.' . $ext;
$ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', $o['book'] . '-' . shop_lang($o['lang']) . '.' . $ext);
$file = $files[$ext];

header('Content-Type: ' . SHOP_FORMATS[$ext]);
header('Content-Length: ' . filesize($file));
header('Content-Disposition: attachment; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));
header('Cache-Control: private, no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
while (ob_get_level()) ob_end_clean();
readfile($file);
