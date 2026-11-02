<?php
/* Магазин: оплата книг через myPOS Checkout (IPC API 1.4) и выдача файлов после оплаты.
   Общие функции для shop/checkout.php, notify.php, return.php, status.php, download.php.
   Настройки — shop/config.php (создаётся из shop/config.sample.php, в git не попадает).
   Подробно — docs/SHOP.md. Совместимо с PHP 7.0+, нужно расширение openssl. */

require_once dirname(__DIR__) . '/seo/lib.php';   // seo_base(), книги из data/books.json

define('SHOP_DATA', __DIR__ . '/.data');            // заказы (закрыто от браузера)
const SHOP_GUARD = "<?php exit; ?>\n";               // первая строка файлов заказов: открытые напрямую, они ничего не покажут

// Публичные тестовые данные myPOS (developers.mypos.com → Configuration): в тестовом режиме оплата
// проходит всегда успешно, деньги не списываются. Это не секрет — их публикует сам myPOS.
const SHOP_TEST_URL = 'https://www.mypos.com/vmp/checkout-test';
const SHOP_LIVE_URL = 'https://www.mypos.com/vmp/checkout';
const SHOP_TEST_SID = '000000000000010';
const SHOP_TEST_WALLET = '61938166610';
const SHOP_TEST_KEY_INDEX = 1;
const SHOP_TEST_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCf0TdcTuphb7X+Zwekt1XKEWZDczSGecfo6vQfqvraf5VPzcnJ
2Mc5J72HBm0u98EJHan+nle2WOZMVGItTa/2k1FRWwbt7iQ5dzDh5PEeZASg2UWe
hoR8L8MpNBqH6h7ZITwVTfRS4LsBvlEfT7Pzhm5YJKfM+CdzDM+L9WVEGwIDAQAB
AoGAYfKxwUtEbq8ulVrD3nnWhF+hk1k6KejdUq0dLYN29w8WjbCMKb9IaokmqWiQ
5iZGErYxh7G4BDP8AW/+M9HXM4oqm5SEkaxhbTlgks+E1s9dTpdFQvL76TvodqSy
l2E2BghVgLLgkdhRn9buaFzYta95JKfgyKGonNxsQA39PwECQQDKbG0Kp6KEkNgB
srCq3Cx2od5OfiPDG8g3RYZKx/O9dMy5CM160DwusVJpuywbpRhcWr3gkz0QgRMd
IRVwyxNbAkEAyh3sipmcgN7SD8xBG/MtBYPqWP1vxhSVYPfJzuPU3gS5MRJzQHBz
sVCLhTBY7hHSoqiqlqWYasi81JzBEwEuQQJBAKw9qGcZjyMH8JU5TDSGllr3jybx
FFMPj8TgJs346AB8ozqLL/ThvWPpxHttJbH8QAdNuyWdg6dIfVAa95h7Y+MCQEZg
jRDl1Bz7eWGO2c0Fq9OTz3IVLWpnmGwfW+HyaxizxFhV+FOj1GUVir9hylV7V0DU
QjIajyv/oeDWhFQ9wQECQCydhJ6NaNQOCZh+6QTrH3TC5MeBA1Yeipoe7+BhsLNr
cFG8s9sTxRnltcZl1dXaBSemvpNvBizn0Kzi8G3ZAgc=
-----END RSA PRIVATE KEY-----";
const SHOP_TEST_CERT = "-----BEGIN CERTIFICATE-----
MIIBsTCCARoCCQCCPjNttGNQWDANBgkqhkiG9w0BAQsFADAdMQswCQYDVQQGEwJC
RzEOMAwGA1UECgwFbXlQT1MwHhcNMTgxMDEyMDcwOTEzWhcNMjgxMDA5MDcwOTEz
WjAdMQswCQYDVQQGEwJCRzEOMAwGA1UECgwFbXlQT1MwgZ8wDQYJKoZIhvcNAQEB
BQADgY0AMIGJAoGBAML+VTmiY4yChoOTMZTXAIG/mk+xf/9mjwHxWzxtBJbNncNK
0OLI0VXYKW2GgVklGHHQjvew1hTFkEGjnCJ7f5CDnbgxevtyASDGst92a6xcAedE
adP0nFXhUz+cYYIgIcgfDcX3ZWeNEF5kscqy52kpD2O7nFNCV+85vS4duJBNAgMB
AAEwDQYJKoZIhvcNAQELBQADgYEACj0xb+tNYERJkL+p+zDcBsBK4RvknPlpk+YP
ephunG2dBGOmg/WKgoD1PLWD2bEfGgJxYBIg9r1wLYpDC1txhxV+2OBQS86KULh0
NEcr0qEY05mI4FlE+D/BpT/+WFyKkZug92rK0Flz71Xy/9mBXbQfm+YK6l9roRYd
J4sHeQc=
-----END CERTIFICATE-----";

const SHOP_FORMATS = ['pdf' => 'application/pdf', 'epub' => 'application/epub+zip', 'mobi' => 'application/x-mobipocket-ebook',
                      'fb2' => 'application/x-fictionbook+xml', 'azw3' => 'application/vnd.amazon.ebook', 'zip' => 'application/zip'];

// ---------------------------------------------------------------- настройки
function shop_cfg() {
    static $c = null;
    if ($c !== null) return $c;
    $f = __DIR__ . '/config.php';
    $user = is_file($f) ? (include $f) : [];
    if (!is_array($user)) $user = [];
    return $c = array_merge([
        'mode' => 'off',            // off — магазин выключен; test — тестовые оплаты (только для вошедших в admin/); live — настоящие
        'pack' => '',               // configuration pack из myPOS (строка внутри loadConfigurationPackage('…'))
        'currency' => 'EUR',
        'from' => '',               // адрес отправителя писем; пусто — books@<домен>
        'notify' => '',             // куда присылать уведомления о продажах
        'files_dir' => '',          // папка с файлами книг; пусто — book-files рядом с папкой сайта
        'link_days' => 30,          // сколько дней работает ссылка на скачивание
        'link_downloads' => 10,     // сколько раз можно скачать
        'smtp' => [],               // ящик для отправки писем: host, port, user, pass (пусто — mail() хостинга)
        'file_names' => ['ghost' => 'Detective'],   // своё начало имени файлов книги вместо кода: Detective_EN.pdf
    ], $user);
}

// данные для подписи: тестовые myPOS или из configuration pack
function shop_creds($mode) {
    if ($mode === 'test') {
        return ['url' => SHOP_TEST_URL, 'sid' => SHOP_TEST_SID, 'wallet' => SHOP_TEST_WALLET, 'idx' => SHOP_TEST_KEY_INDEX,
                'pk' => SHOP_TEST_PRIVATE_KEY, 'cert' => SHOP_TEST_CERT];
    }
    $pack = preg_replace('/\s+/', '', (string) shop_cfg()['pack']);
    $d = json_decode((string) base64_decode($pack, true), true);
    if (!is_array($d) || empty($d['sid']) || empty($d['cn']) || empty($d['pk']) || empty($d['pc']) || !isset($d['idx'])) return null;
    return ['url' => SHOP_LIVE_URL, 'sid' => (string) $d['sid'], 'wallet' => (string) $d['cn'], 'idx' => (int) $d['idx'],
            'pk' => (string) $d['pk'], 'cert' => (string) $d['pc']];
}

function shop_files_dir() {
    $d = trim((string) shop_cfg()['files_dir']);
    return rtrim($d !== '' ? $d : dirname(SEO_ROOT) . '/book-files', '/\\');
}

// Начала имён файлов книги: её код и, если задано в 'file_names', своё имя (ghost → Detective).
function shop_file_prefixes($id) {
    $n = shop_cfg()['file_names'];
    $alias = is_array($n) && isset($n[$id]) && is_string($n[$id]) ? trim($n[$id]) : '';
    return $alias !== '' && strcasecmp($alias, $id) !== 0 ? [$id, $alias] : [$id];
}

// Все файлы книги в <files_dir> по языкам: ['en' => ['pdf' => путь, …], '' => файлы без языка].
// Имя — начало (код книги или своё имя) и язык в конце: ghost-en.pdf, Detective_EN.pdf, ghost UA.epub
// (регистр не важен, UA = uk).
function shop_book_files_all($id) {
    if (!seo_valid_id($id)) return [];
    $dir = shop_files_dir();
    $names = @scandir($dir);
    if (!$names) return [];
    $codes = seo_langs();
    if (in_array('uk', $codes, true)) $codes[] = 'ua';
    $re = '/^(?:' . implode('|', array_map(function ($p) { return preg_quote($p, '/'); }, shop_file_prefixes($id))) . ')(?:[ ._-]+(' . implode('|', $codes) . '))?\.(' . implode('|', array_keys(SHOP_FORMATS)) . ')$/i';
    $all = [];
    foreach ($names as $n) {
        if (!preg_match($re, $n, $m) || !@is_file($dir . '/' . $n)) continue;
        $l = strtolower($m[1]);
        if ($l === 'ua') $l = 'uk';
        $ext = strtolower($m[2]);
        if (!isset($all[$l][$ext])) $all[$l][$ext] = $dir . '/' . $n;
    }
    return $all;
}

// Файлы книги на языке заказа: ['pdf' => путь, 'epub' => путь, …] — сначала с языком заказа в имени
// (ghost-en.pdf), если таких нет — общие без языка (ghost.pdf). Порядок — как в SHOP_FORMATS.
function shop_book_files($id, $lang = '') {
    $all = shop_book_files_all($id);
    $pick = $lang !== '' && !empty($all[$lang]) ? $all[$lang] : (isset($all['']) ? $all[''] : []);
    $out = [];
    foreach (array_keys(SHOP_FORMATS) as $ext) if (isset($pick[$ext])) $out[$ext] = $pick[$ext];
    return $out;
}

// ---------------------------------------------------------------- книга и цена
// Цена — та же, что видит покупатель: поле «Цена» книги на его языке; если там не евро — русская.
function shop_price($b, $lang) {
    $cur = strtoupper((string) shop_cfg()['currency']);
    foreach ([$lang, seo_def()] as $l) {
        $p = seo_price(seo_bf($b, $l, 'price'));
        if ($p && $p[1] === $cur && (float) $p[0] > 0) return [number_format((float) $p[0], 2, '.', ''), $cur];
    }
    return null;
}

function shop_lang($l) {
    return in_array($l, seo_langs(), true) ? $l : seo_def();
}

// ---------------------------------------------------------------- заказы
function shop_data_dir() {
    if (!is_dir(SHOP_DATA . '/orders')) {
        @mkdir(SHOP_DATA . '/orders', 0700, true);
        @file_put_contents(SHOP_DATA . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
        @file_put_contents(SHOP_DATA . '/index.html', '');
    }
    return SHOP_DATA . '/orders';
}

function shop_valid_order_id($id) {
    return is_string($id) && preg_match('/^\d{14}-[a-f0-9]{8}$/', $id) === 1;
}

function shop_order_file($id) {
    return shop_data_dir() . '/' . $id . '.php';
}

function shop_order_load($id) {
    if (!shop_valid_order_id($id)) return null;
    $raw = @file_get_contents(shop_order_file($id));
    if (!is_string($raw)) return null;
    if (strpos($raw, SHOP_GUARD) === 0) $raw = substr($raw, strlen(SHOP_GUARD));
    $o = json_decode($raw, true);
    return is_array($o) ? $o : null;
}

function shop_order_save($o) {
    $f = shop_order_file($o['id']);
    $tmp = $f . '.tmp-' . bin2hex(random_bytes(4));
    $ok = @file_put_contents($tmp, SHOP_GUARD . json_encode($o, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false && @rename($tmp, $f);
    if (!$ok) @unlink($tmp);
    return $ok;
}

// изменить заказ под блокировкой (уведомление myPOS может прийти дважды)
function shop_order_update($id, $fn) {
    $lock = @fopen(shop_order_file($id) . '.lock', 'c');
    if ($lock) flock($lock, LOCK_EX);
    $o = shop_order_load($id);
    $res = $o ? $fn($o) : null;
    if ($o && $res !== false) shop_order_save($o);
    if ($lock) { flock($lock, LOCK_UN); fclose($lock); }   // файл блокировки не удаляем: иначе два процесса могут разминуться
    return $o;
}

function shop_new_order_id() {
    return gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
}

// ---------------------------------------------------------------- подпись myPOS
// Все значения через «-» → base64 → RSA-SHA256 закрытым ключом → base64 (как в myPOS PHP SDK)
function shop_sign($params, $pk) {
    $key = openssl_pkey_get_private($pk);
    if (!$key) return null;
    $sig = '';
    if (!openssl_sign(base64_encode(implode('-', $params)), $sig, $key, OPENSSL_ALGO_SHA256)) return null;
    return base64_encode($sig);
}

// проверка ответа myPOS: все присланные поля, кроме Signature, в том же порядке
function shop_verify($post, $cert) {
    if (empty($post['Signature']) || !is_string($post['Signature'])) return false;
    $sig = base64_decode($post['Signature'], true);
    unset($post['Signature']);
    foreach ($post as $v) if (!is_string($v)) return false;
    $pub = openssl_pkey_get_public($cert);
    return $sig !== false && $pub && openssl_verify(base64_encode(implode('-', $post)), $sig, $pub, OPENSSL_ALGO_SHA256) === 1;
}

// ---------------------------------------------------------------- адреса
function shop_url($path, $q = []) {
    $s = [];
    foreach ($q as $k => $v) $s[] = rawurlencode($k) . '=' . rawurlencode((string) $v);
    return seo_base() . $path . ($s ? '?' . implode('&', $s) : '');
}

function shop_download_url($o, $ext) {
    return shop_url('shop/download.php', ['o' => $o['id'], 't' => $o['token'], 'f' => $ext]);
}

// вошёл ли администратор (для тестового режима)
function shop_admin() {
    global $CONFIG;   // admin/lib.php кладёт настройки входа в глобальную $CONFIG — без этого внутри функции она не видна
    $f = dirname(__DIR__) . '/admin/lib.php';
    if (!is_file(dirname(__DIR__) . '/admin/config.php') || !is_file($f)) return false;
    require_once $f;
    return function_exists('logged_in') && logged_in();
}

// ---------------------------------------------------------------- письма
function shop_t($lang) {
    $T = [
        'ru' => ['subject' => 'Ваша книга «{title}»', 'hello' => 'Здравствуйте, {name}!',
                 'paid' => 'Спасибо за покупку книги «{title}». Оплата {amount} {currency} получена (заказ {order}).',
                 'links' => 'Скачать книгу:', 'valid' => 'Ссылки работают {days} дней.',
                 'manual' => 'Файл книги автор пришлёт вам на эту почту в ближайшее время.',
                 'reply' => 'Если что-то не получилось — просто ответьте на это письмо.', 'sign' => 'Ростислав Вишневский'],
        'en' => ['subject' => 'Your book “{title}”', 'hello' => 'Hello {name},',
                 'paid' => 'Thank you for buying “{title}”. Your payment of {amount} {currency} has been received (order {order}).',
                 'links' => 'Download the book:', 'valid' => 'The links work for {days} days.',
                 'manual' => 'The author will send the book file to this email shortly.',
                 'reply' => 'If anything goes wrong, just reply to this email.', 'sign' => 'Rostyslav Vishnevsky'],
        'uk' => ['subject' => 'Ваша книга «{title}»', 'hello' => 'Вітаємо, {name}!',
                 'paid' => 'Дякуємо за покупку книги «{title}». Оплату {amount} {currency} отримано (замовлення {order}).',
                 'links' => 'Завантажити книгу:', 'valid' => 'Посилання працюють {days} днів.',
                 'manual' => 'Файл книги автор надішле вам на цю пошту найближчим часом.',
                 'reply' => 'Якщо щось не вийшло — просто дайте відповідь на цей лист.', 'sign' => 'Ростислав Вишневський'],
        'bg' => ['subject' => 'Вашата книга „{title}“', 'hello' => 'Здравейте, {name}!',
                 'paid' => 'Благодарим за покупката на „{title}“. Плащането от {amount} {currency} е получено (поръчка {order}).',
                 'links' => 'Изтеглете книгата:', 'valid' => 'Връзките работят {days} дни.',
                 'manual' => 'Авторът ще ви изпрати файла на книгата на този имейл съвсем скоро.',
                 'reply' => 'Ако нещо не се получи, просто отговорете на това писмо.', 'sign' => 'Ростислав Вишневски'],
    ];
    return isset($T[$lang]) ? $T[$lang] : $T['ru'];
}

function shop_host() {
    return (string) parse_url(seo_base(), PHP_URL_HOST);
}

function shop_from() {
    $c = shop_cfg();
    if (trim((string) $c['from']) !== '') return trim((string) $c['from']);
    $site = preg_replace('/^www\./', '', shop_host());
    // логин SMTP — отправитель, только если это ящик на домене сайта (у Brevo и т. п. логин технический)
    $u = !empty($c['smtp']['user']) ? (string) $c['smtp']['user'] : '';
    if (filter_var($u, FILTER_VALIDATE_EMAIL) && strcasecmp(substr(strrchr($u, '@'), 1), $site) === 0) return $u;
    return 'books@' . $site;
}

// Письмо (простой текст, UTF-8). Если в shop/config.php заполнен 'smtp' — через почтовый ящик по SMTP
// (надёжнее и реже попадает в спам), иначе — встроенной почтой хостинга (mail()).
// Ошибка последней отправки — в $GLOBALS['shop_mail_error'].
function shop_mail($to, $subject, $text, $replyTo = '') {
    $GLOBALS['shop_mail_error'] = '';
    $c = shop_cfg();
    $from = shop_from();
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) { $GLOBALS['shop_mail_error'] = 'bad address'; return false; }
    $name = '=?UTF-8?B?' . base64_encode(seo_author(seo_def())) . '?=';
    $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $h = "From: $name <$from>\r\n";
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $h .= "Reply-To: $replyTo\r\n";
    $h .= "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n";
    $body = chunk_split(base64_encode(str_replace("\n", "\r\n", str_replace("\r\n", "\n", $text))), 76, "\r\n");

    if (!empty($c['smtp']['host']) && !empty($c['smtp']['user']) && isset($c['smtp']['pass']) && $c['smtp']['pass'] !== '') {
        $domain = substr(strrchr($from, '@'), 1);
        $msg = 'Date: ' . date('r') . "\r\nTo: <$to>\r\nSubject: $subj\r\n"
             . 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . ">\r\n" . $h . "\r\n" . $body;
        return shop_smtp_send($c['smtp'], $from, $to, $msg);
    }
    $ok = @mail($to, $subj, $body, $h, '-f' . $from);
    if (!$ok) $ok = @mail($to, $subj, $body, $h);
    if (!$ok) $GLOBALS['shop_mail_error'] = 'mail() failed';
    return $ok;
}

// Минимальный SMTP-клиент: SSL (порт 465) или STARTTLS (587), вход AUTH LOGIN.
function shop_smtp_send($s, $from, $to, $msg) {
    $host = (string) $s['host'];
    $port = isset($s['port']) ? (int) $s['port'] : 465;
    $verify = !isset($s['verify']) || $s['verify'];
    $ctx = stream_context_create(['ssl' => ['verify_peer' => $verify, 'verify_peer_name' => $verify, 'allow_self_signed' => !$verify, 'peer_name' => $host]]);
    $errno = 0; $errstr = '';
    $fp = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    $fail = function ($why) use (&$fp) { $GLOBALS['shop_mail_error'] = 'SMTP: ' . $why; if ($fp) @fclose($fp); return false; };
    if (!$fp) return $fail("connect $host:$port — $errstr");
    stream_set_timeout($fp, 20);
    $read = function () use ($fp) {
        $all = '';
        while (($line = fgets($fp, 1024)) !== false) { $all .= $line; if (strlen($line) < 4 || $line[3] === ' ') break; }
        return $all;
    };
    $cmd = function ($line, $expect) use ($fp, $read) {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        $r = $read();
        return in_array(substr($r, 0, 3), (array) $expect, true) ? true : trim($r);
    };
    $me = preg_replace('/[^a-z0-9.-]/i', '', shop_host()) ?: 'localhost';
    if (($r = $cmd(null, '220')) !== true) return $fail($r);
    if (($r = $cmd("EHLO $me", '250')) !== true) return $fail($r);
    if ($port !== 465) {
        if (($r = $cmd('STARTTLS', '220')) !== true) return $fail($r);
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $fail('STARTTLS failed');
        if (($r = $cmd("EHLO $me", '250')) !== true) return $fail($r);
    }
    if (($r = $cmd('AUTH LOGIN', '334')) !== true) return $fail($r);
    if (($r = $cmd(base64_encode((string) $s['user']), '334')) !== true) return $fail($r);
    if (($r = $cmd(base64_encode((string) $s['pass']), '235')) !== true) return $fail('login rejected (' . $r . ')');
    if (($r = $cmd("MAIL FROM:<$from>", '250')) !== true) return $fail($r);
    if (($r = $cmd("RCPT TO:<$to>", ['250', '251'])) !== true) return $fail($r);
    if (($r = $cmd('DATA', '354')) !== true) return $fail($r);
    $data = preg_replace('/^\./m', '..', $msg);   // строки, начинающиеся с точки, экранируются
    if (($r = $cmd($data . "\r\n.", '250')) !== true) return $fail($r);
    $cmd('QUIT', '221');
    fclose($fp);
    return true;
}

// письмо покупателю со ссылками (или «автор пришлёт») + уведомление автору
function shop_send_book($o) {
    $c = shop_cfg();
    $b = seo_book($o['book']);
    $lang = shop_lang($o['lang']);
    $t = shop_t($lang);
    $title = $b ? seo_bf($b, $lang, 'title') : $o['book'];
    $v = ['title' => $title, 'name' => trim($o['first']), 'amount' => $o['amount'], 'currency' => $o['currency'],
          'order' => $o['id'], 'days' => (int) $c['link_days']];
    $files = shop_book_files($o['book'], $o['lang']);
    $body = seo_fill($t['hello'], $v) . "\n\n" . seo_fill($t['paid'], $v) . "\n\n";
    if ($files) {
        $body .= $t['links'] . "\n";
        foreach (array_keys($files) as $ext) $body .= strtoupper($ext) . ': ' . shop_download_url($o, $ext) . "\n";
        $body .= "\n" . seo_fill($t['valid'], $v) . "\n";
    } else {
        $body .= $t['manual'] . "\n";
    }
    $body .= "\n" . $t['reply'] . "\n\n" . $t['sign'] . "\n" . seo_base() . "\n";
    $notify = trim((string) $c['notify']);
    $sent = shop_mail($o['email'], seo_fill($t['subject'], $v), $body, $notify);

    if ($notify !== '') {
        $msg = "Продажа на сайте" . ($o['mode'] === 'test' ? ' (ТЕСТ, деньги не списаны)' : '') . "\n\n"
             . "Книга: $title\nСумма: {$o['amount']} {$o['currency']}\nПокупатель: {$o['first']} {$o['last']} <{$o['email']}>\n"
             . "Язык: $lang\nЗаказ: {$o['id']}\nmyPOS: " . (isset($o['trnref']) ? $o['trnref'] : '') . "\n\n"
             . ($files ? 'Ссылки на скачивание отправлены покупателю' . ($sent ? '.' : ' — НО ПИСЬМО НЕ УШЛО, покупатель видит ссылки только на сайте после оплаты.')
                       : "ФАЙЛА КНИГИ НЕТ на сервере (" . shop_files_dir() . "/{$o['book']}-{$lang}.pdf / .epub или {$o['book']}.pdf) — отправьте книгу покупателю вручную.")
             . "\n";
        shop_mail($notify, ($o['mode'] === 'test' ? '[ТЕСТ] ' : '') . 'Продажа: «' . $title . '» — ' . $o['amount'] . ' ' . $o['currency'], $msg, $o['email']);
    }
    return $sent;
}

function shop_text_response($code, $text) {
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo $text;
    exit;
}
