<?php
/* Общее для админки: настройки, сессия, вход, защита от подбора пароля.
   Подключается из admin/index.php (страница входа) и admin/api.php (сохранение).
   Логин и хеш пароля — в admin/config.php (создаётся: python scripts/set-admin-password.py). */
declare(strict_types=1);

if (!is_file(__DIR__ . '/config.php')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Не найден admin/config.php.\nСоздайте его на своём компьютере: python scripts/set-admin-password.py — и загрузите в папку admin/ на хостинге.");
}
$CONFIG = require __DIR__ . '/config.php';

define('SITE_ROOT', (string) realpath(__DIR__ . '/..'));   // корень сайта
define('DATA_DIR', __DIR__ . '/.data');                     // попытки входа, резервные копии
define('SESSION_IDLE', 8 * 3600);                           // сессия живёт 8 часов без действий
define('MAX_FAILS', 5);                                     // неверных попыток входа…
define('FAIL_WINDOW', 15 * 60);                             // …за 15 минут — и вход для этого IP закрыт на 15 минут
const GUARD = "<?php exit; ?>\n";                            // первая строка служебных файлов в admin/.data

function security_headers(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
}

function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('roni_admin');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_start();
}

// меняется вместе с паролем — после смены пароля все старые входы недействительны
function cred_version(): string {
    global $CONFIG;
    return substr(hash('sha256', $CONFIG['salt'] . $CONFIG['hash']), 0, 16);
}

function logged_in(): bool {
    start_session();
    if (empty($_SESSION['admin']) || ($_SESSION['v'] ?? '') !== cred_version()) return false;
    if (time() - (int) ($_SESSION['seen'] ?? 0) > SESSION_IDLE) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['seen'] = time();
    return true;
}

function csrf_token(): string {
    start_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_ok(string $token): bool {
    start_session();
    return !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

// Пароль проверяется по PBKDF2-SHA256 (соль и число итераций — в config.php); сам пароль нигде не хранится.
function check_login(string $user, string $pass): bool {
    global $CONFIG;
    $calc = hash_pbkdf2('sha256', $pass, (string) hex2bin($CONFIG['salt']), (int) $CONFIG['iterations'], 64);
    $userOk = hash_equals((string) $CONFIG['user'], $user);
    $passOk = hash_equals((string) $CONFIG['hash'], $calc);
    return $userOk && $passOk;
}

// ---- служебная папка admin/.data (закрыта от браузера .htaccess-ом) ----
function data_dir(): string {
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0700, true);
        @file_put_contents(DATA_DIR . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
        @file_put_contents(DATA_DIR . '/index.html', '');
    }
    return DATA_DIR;
}

function client_ip(): string {
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

// ---- защита от подбора пароля: не больше MAX_FAILS неверных попыток с одного IP за FAIL_WINDOW ----
function with_attempts(callable $fn) {
    $file = data_dir() . '/attempts.php';   // .php с exit в начале: даже без .htaccess (nginx) браузер увидит пустоту
    $h = @fopen($file, 'c+');
    if (!$h) { $none = []; return $fn($none); }
    flock($h, LOCK_EX);
    $raw = (string) stream_get_contents($h);
    if (strpos($raw, GUARD) === 0) $raw = substr($raw, strlen(GUARD));
    $all = json_decode($raw ?: '{}', true) ?: [];
    $now = time();
    foreach ($all as $ip => $times) {
        $all[$ip] = array_values(array_filter((array) $times, function ($t) use ($now) { return $now - (int) $t < FAIL_WINDOW; }));
        if (!$all[$ip]) unset($all[$ip]);
    }
    $result = $fn($all);
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, GUARD . json_encode($all));
    flock($h, LOCK_UN);
    fclose($h);
    return $result;
}

function login_blocked(): bool {
    $ip = client_ip();
    return (bool) with_attempts(function (array &$all) use ($ip) { return count($all[$ip] ?? []) >= MAX_FAILS; });
}

function login_failed(): void {
    $ip = client_ip();
    with_attempts(function (array &$all) use ($ip) { $all[$ip][] = time(); return null; });
}

function login_ok(): void {
    $ip = client_ip();
    with_attempts(function (array &$all) use ($ip) { unset($all[$ip]); return null; });
}
