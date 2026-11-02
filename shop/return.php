<?php
/* Возврат покупателя со страницы myPOS (URL_OK / URL_Cancel) → страница заказа с экраном результата.
   Оплату здесь не подтверждаем: это делает только notify.php (сервер myPOS → сайт). */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

$r = isset($_GET['r']) && $_GET['r'] === 'ok' ? 'ok' : 'cancel';
$id = isset($_GET['o']) ? (string) $_GET['o'] : '';
$key = isset($_GET['k']) ? (string) $_GET['k'] : '';
$o = shop_order_load($id);
if (!$o || !hash_equals((string) $o['key'], $key)) { header('Location: ' . seo_base(), true, 303); exit; }

if ($r === 'cancel') shop_order_update($id, function (&$x) { if ($x['status'] !== 'new') return false; $x['status'] = 'cancel'; return true; });

$q = ['book' => $o['book'], 'order' => $o['id'], 'key' => $o['key'], 'pay' => $r];
header('Cache-Control: no-store');
header('Location: ' . seo_url('order.html', $q, shop_lang($o['lang'])), true, 303);
