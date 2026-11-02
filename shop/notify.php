<?php
/* Уведомление myPOS об оплате (URL_Notify): сервер myPOS → сюда, напрямую, без браузера покупателя.
   Только здесь заказ становится оплаченным: проверяем подпись myPOS, магазин, сумму и валюту,
   затем отправляем покупателю ссылки на книгу. Ответ «OK» обязателен — иначе myPOS повторит запрос
   или отменит платёж (IPCPurchaseRollback). */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') shop_text_response(405, 'POST only');

$post = $_POST;   // порядок полей важен для проверки подписи
$method = isset($post['IPCmethod']) ? (string) $post['IPCmethod'] : '';
$id = isset($post['OrderID']) ? (string) $post['OrderID'] : '';
$o = shop_order_load($id);
if (!$o) shop_text_response(400, 'Unknown order');

$cr = shop_creds($o['mode']);
if (!$cr || !shop_verify($post, $cr['cert'])) shop_text_response(400, 'Invalid signature');
if (!isset($post['SID']) || (string) $post['SID'] !== $cr['sid']) shop_text_response(400, 'Wrong store');

if ($method === 'IPCPurchaseNotify') {
    $amount = isset($post['Amount']) ? (float) $post['Amount'] : -1;
    $currency = isset($post['Currency']) ? strtoupper((string) $post['Currency']) : '';
    if (round($amount * 100) !== round((float) $o['amount'] * 100) || $currency !== $o['currency']) shop_text_response(400, 'Amount mismatch');

    $send = false;
    shop_order_update($id, function (&$x) use ($post, &$send) {
        if ($x['status'] === 'paid') return false;   // повтор уведомления — письмо уже ушло
        $x['status'] = 'paid';
        $x['paid'] = gmdate('c');
        $x['trnref'] = isset($post['IPC_Trnref']) ? (string) $post['IPC_Trnref'] : '';
        $send = true;
        return true;
    });
    if ($send) {
        $o = shop_order_load($id);
        $mailed = shop_send_book($o);
        $err = isset($GLOBALS['shop_mail_error']) ? (string) $GLOBALS['shop_mail_error'] : '';
        shop_order_update($id, function (&$x) use ($mailed, $err) { $x['mailed'] = $mailed; $x['mail_error'] = $mailed ? '' : $err; return true; });
    }
    shop_text_response(200, 'OK');
}

if ($method === 'IPCPurchaseRollback') {
    // myPOS не получил наш «OK» и отменил платёж
    shop_order_update($id, function (&$x) { $x['status'] = 'rollback'; $x['rollback'] = gmdate('c'); return true; });
    $c = shop_cfg();
    if (trim((string) $c['notify']) !== '') {
        shop_mail(trim((string) $c['notify']), 'myPOS отменил платёж по заказу ' . $id,
            "myPOS отменил платёж (IPCPurchaseRollback) по заказу $id: {$o['amount']} {$o['currency']}, {$o['email']}.\n"
            . "Ссылки на скачивание по этому заказу отключены. Если покупатель напишет — проверьте платёж в кабинете myPOS.\n");
    }
    shop_text_response(200, 'OK');
}

shop_text_response(400, 'Unknown method');
