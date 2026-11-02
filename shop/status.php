<?php
/* Статус заказа для экрана «Спасибо» на order.html: оплачен ли, куда ушло письмо, ссылки на скачивание.
   Без ключа заказа (k) ничего не отдаёт. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$o = shop_order_load(isset($_GET['o']) ? (string) $_GET['o'] : '');
if (!$o || !hash_equals((string) $o['key'], isset($_GET['k']) ? (string) $_GET['k'] : '')) {
    http_response_code(404);
    echo json_encode(['status' => 'unknown']);
    exit;
}
$out = ['status' => $o['status'], 'email' => $o['email'], 'test' => $o['mode'] === 'test', 'files' => []];
if ($o['status'] === 'paid') {
    foreach (array_keys(shop_book_files($o['book'], $o['lang'])) as $ext) $out['files'][] = ['format' => strtoupper($ext), 'url' => shop_download_url($o, $ext)];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
