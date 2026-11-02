<?php
/* Оформление заказа: форма со страницы order.html → заказ → переход на защищённую страницу оплаты myPOS.
   Цена берётся из каталога (data/books.json) на сервере — из формы приходят только книга и данные покупателя. */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$lang = shop_lang(isset($_POST['lang']) ? (string) $_POST['lang'] : '');
$E = [
    'ru' => ['off' => 'Оплата на сайте временно недоступна. Напишите автору — книгу можно заказать по почте.', 'bad' => 'Проверьте e-mail, имя и галочку согласия и попробуйте ещё раз.',
             'book' => 'Эта книга пока не продаётся.', 'err' => 'Не удалось начать оплату. Попробуйте ещё раз чуть позже.', 'test' => 'Тестовый режим оплаты доступен только после входа в admin/.',
             'back' => '← Вернуться', 'go' => 'Переход на страницу оплаты myPOS…', 'btn' => 'Перейти к оплате'],
    'en' => ['off' => 'Online payment is temporarily unavailable. Please write to the author to order the book by email.', 'bad' => 'Please check your email, name and the consent checkbox and try again.',
             'book' => 'This book is not on sale yet.', 'err' => 'Could not start the payment. Please try again a little later.', 'test' => 'Test payments are only available after logging in to admin/.',
             'back' => '← Go back', 'go' => 'Redirecting to the myPOS payment page…', 'btn' => 'Continue to payment'],
    'uk' => ['off' => 'Оплата на сайті тимчасово недоступна. Напишіть автору — книгу можна замовити поштою.', 'bad' => 'Перевірте e-mail, ім’я та позначку згоди й спробуйте ще раз.',
             'book' => 'Ця книга поки не продається.', 'err' => 'Не вдалося розпочати оплату. Спробуйте ще раз трохи згодом.', 'test' => 'Тестовий режим оплати доступний лише після входу в admin/.',
             'back' => '← Повернутися', 'go' => 'Перехід на сторінку оплати myPOS…', 'btn' => 'Перейти до оплати'],
    'bg' => ['off' => 'Плащането на сайта временно не е достъпно. Пишете на автора — книгата може да се поръча по имейл.', 'bad' => 'Проверете имейла, името и отметката за съгласие и опитайте отново.',
             'book' => 'Тази книга все още не се продава.', 'err' => 'Плащането не можа да започне. Опитайте отново малко по-късно.', 'test' => 'Тестовият режим е достъпен само след вход в admin/.',
             'back' => '← Назад', 'go' => 'Пренасочване към страницата за плащане на myPOS…', 'btn' => 'Към плащането'],
];
$e = $E[$lang];

function shop_page($title, $body) {
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">'
        . '<title>' . seo_e($title) . '</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101116;color:#e6dccb;font:300 18px/1.6 Georgia,serif;text-align:center;padding:24px;box-sizing:border-box}'
        . 'a,button{color:#14110d;background:#cf9a57;border:0;border-radius:3px;padding:13px 26px;font:500 15px Georgia,serif;text-decoration:none;cursor:pointer;display:inline-block;margin-top:22px}</style></head><body><div style="max-width:520px">'
        . $body . '</div></body></html>';
    exit;
}

function shop_fail($msg) {
    global $e;
    $back = isset($_SERVER['HTTP_REFERER']) && strpos((string) $_SERVER['HTTP_REFERER'], seo_base()) === 0 ? (string) $_SERVER['HTTP_REFERER'] : seo_base();
    shop_page($msg, '<p>' . seo_e($msg) . '</p><a href="' . seo_e($back) . '">' . seo_e($e['back']) . '</a>');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Location: ' . seo_base(), true, 303); exit; }

$cfg = shop_cfg();
$mode = (string) $cfg['mode'];
if (!in_array($mode, ['test', 'live'], true) || !function_exists('openssl_sign')) shop_fail($e['off']);
if ($mode === 'test' && !shop_admin()) shop_fail($e['test']);
$cr = shop_creds($mode);
if (!$cr) shop_fail($e['off']);

// покупатель
$f = function ($k, $max) { $v = isset($_POST[$k]) && is_string($_POST[$k]) ? trim(preg_replace('/\s+/u', ' ', $_POST[$k])) : ''; return seo_len($v) > $max ? '' : $v; };
$email = $f('email', 120);
$first = $f('first', 60);
$last = $f('last', 60);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $first === '' || $last === '' || empty($_POST['agree'])) shop_fail($e['bad']);
// в полях имени — только буквы, пробел, дефис, апостроф и точка (myPOS не любит лишнего)
if (!preg_match("/^[\\p{L}\\p{M} .'’-]+$/u", $first . $last)) shop_fail($e['bad']);

// книга и цена — из каталога на сервере; книга должна быть на сайте на языке заказа и не «Скоро»
$b = seo_book(isset($_POST['book']) ? (string) $_POST['book'] : '');
$price = $b && seo_book_in($b, $lang) && seo_published($b, $lang) ? shop_price($b, $lang) : null;
if (!$price) shop_fail($e['book']);

$o = [
    'id' => shop_new_order_id(), 'key' => bin2hex(random_bytes(16)), 'token' => bin2hex(random_bytes(16)),
    'mode' => $mode, 'status' => 'new', 'book' => (string) $b['id'], 'lang' => $lang,
    'email' => $email, 'first' => $first, 'last' => $last,
    'amount' => $price[0], 'currency' => $price[1], 'created' => gmdate('c'), 'downloads' => 0,
];
if (!shop_order_save($o)) shop_fail($e['err']);

$title = seo_bf($b, $lang, 'title');
$article = seo_sub(preg_replace('/[^\p{L}\p{N} .,:()«»“”„"\'’!?-]/u', '', $title), 80);
$ipcLang = ['ru' => 'RU', 'en' => 'EN', 'uk' => 'EN', 'bg' => 'BG'];

// порядок полей важен: подпись считается по значениям в этом же порядке
$p = [
    'IPCmethod' => 'IPCPurchase',
    'IPCVersion' => '1.4',
    'IPCLanguage' => isset($ipcLang[$lang]) ? $ipcLang[$lang] : 'EN',
    'SID' => $cr['sid'],
    'WalletNumber' => $cr['wallet'],
    'KeyIndex' => (string) $cr['idx'],
    'Amount' => $o['amount'],
    'Currency' => $o['currency'],
    'OrderID' => $o['id'],
    'URL_OK' => shop_url('shop/return.php', ['r' => 'ok', 'o' => $o['id'], 'k' => $o['key']]),
    'URL_Cancel' => shop_url('shop/return.php', ['r' => 'cancel', 'o' => $o['id'], 'k' => $o['key']]),
    'URL_Notify' => shop_url('shop/notify.php'),
    'CardTokenRequest' => '0',
    'PaymentParametersRequired' => '1',
    'CustomerEmail' => $email,
    'CustomerFirstNames' => $first,
    'CustomerFamilyName' => $last,
    'Note' => 'Order ' . $o['id'],
    'CartItems' => '1',
    'Article_1' => $article !== '' ? $article : 'Ebook',
    'Quantity_1' => '1',
    'Price_1' => $o['amount'],
    'Currency_1' => $o['currency'],
    'Amount_1' => $o['amount'],
];
$sig = shop_sign($p, $cr['pk']);
if ($sig === null) shop_fail($e['err']);
$p['Signature'] = $sig;   // подпись — всегда последним полем

$inputs = '';
foreach ($p as $k => $v) $inputs .= '<input type="hidden" name="' . seo_e($k) . '" value="' . seo_e($v) . '">';
shop_page($e['go'],
    '<p>' . seo_e($e['go']) . '</p>'
    . '<form id="pay" method="post" action="' . seo_e($cr['url']) . '">' . $inputs
    . '<button type="submit">' . seo_e($e['btn']) . '</button></form>'
    . '<script>document.getElementById("pay").submit();</script>');
