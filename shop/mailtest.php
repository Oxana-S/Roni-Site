<?php
/* Проверка отправки писем магазина — только для вошедшего в admin/.
   Откройте https://<сайт>/shop/mailtest.php — письмо уйдёт на адрес 'notify' из shop/config.php
   (или ?to=адрес). На экране — ушло ли письмо и, если нет, ответ почтового сервера. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

if (!shop_admin()) shop_text_response(403, 'Войдите в admin/ и откройте эту страницу снова.');
$c = shop_cfg();
$to = isset($_GET['to']) ? trim((string) $_GET['to']) : trim((string) $c['notify']);
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) shop_text_response(400, "Нет адреса: укажите 'notify' в shop/config.php или ?to=адрес");

$via = !empty($c['smtp']['host']) && !empty($c['smtp']['pass']) ? 'SMTP ' . $c['smtp']['host'] . ':' . (isset($c['smtp']['port']) ? $c['smtp']['port'] : 465) : 'mail() хостинга';
$ok = shop_mail($to, 'Проверка почты сайта ' . shop_host(), "Это проверочное письмо магазина сайта " . seo_base() . ".\nЕсли вы его видите — письма покупателям тоже будут доходить.\n\nОтправлено: $via, от " . shop_from() . "\n");
shop_text_response(200, ($ok ? "ОТПРАВЛЕНО на $to" : "НЕ ОТПРАВЛЕНО на $to\nОшибка: " . $GLOBALS['shop_mail_error'])
    . "\nСпособ: $via\nОт кого: " . shop_from() . "\n\nЕсли «отправлено», а письма нет — проверьте папку «Спам».");
