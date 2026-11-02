<?php
/* Раз в месяц — служебное письмо на адрес 'notify' (shop/config.php), чтобы ключ SMTP не отключился без писем:
   у Brevo ключ отключается после 90 дней без отправки. Запускается планировщиком CRON хостинга (docs/SHOP.md):
     wget -q -O /dev/null https://vishnevsky.info/shop/keepalive.php
   Запускать можно хоть каждый день: письмо уходит не чаще раза в 25 дней, поэтому открыть адрес может кто угодно —
   больше одного письма автору в месяц так не отправить. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');
$c = shop_cfg();
if (empty($c['smtp']['host']) || empty($c['smtp']['pass'])) shop_text_response(200, 'SMTP не настроен — письмо не нужно.');
$to = trim((string) $c['notify']);
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) shop_text_response(200, "Нет адреса 'notify' в shop/config.php.");

shop_data_dir();                                   // папка .data, закрытая от браузера
$fp = @fopen(SHOP_DATA . '/keepalive.txt', 'c+');
if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) shop_text_response(200, 'Уже выполняется.');
$last = (int) trim((string) stream_get_contents($fp));
if ($last && time() - $last < 25 * 86400) {
    shop_text_response(200, 'Рано: прошлое письмо ' . gmdate('Y-m-d', $last) . ' (UTC), следующее — не раньше чем через 25 дней после него.');
}

$ok = shop_mail($to, 'Сайт ' . shop_host() . ': почта магазина работает',
    "Это автоматическое письмо раз в месяц: оно держит ключ SMTP активным, чтобы письма покупателям не перестали уходить.\n"
    . "Отвечать на него не нужно.\n\nОтправлено: " . gmdate('Y-m-d H:i') . " UTC, от " . shop_from() . "\n");
if ($ok) {
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, (string) time());
}
flock($fp, LOCK_UN);
fclose($fp);
shop_text_response(200, $ok ? "ОТПРАВЛЕНО на $to" : 'НЕ ОТПРАВЛЕНО: ' . $GLOBALS['shop_mail_error']);
