<?php
/* API админки — вызывается редактором на сайте (assets/editor.js).
     GET  api.php?action=me      — вошли ли вы (+ CSRF-токен сессии)
     POST api.php?action=save    — записать файлы (multipart: count, path0, file0, path1, file1, …)
     POST api.php?action=logout  — выйти
   Писать можно только в данные, загрузки и новые страницы; перед перезаписью
   прежняя версия файла кладётся в admin/.data/backups/<дата-время>/. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

security_headers();
header('Content-Type: application/json; charset=utf-8');

function out(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// что редактор может записывать (как в scripts/edit-server.py)
const ALLOWED = '#^(data/[a-z0-9_-]+\.json|data/chapters/[a-z0-9-]+\.json'
    . '|assets/img/books/[A-Za-z0-9._-]+\.(jpg|png|webp)'
    . '|assets/uploads/[a-z0-9-]+\.(jpg|png|webp|gif|mp3|m4a|aac|ogg|wav))$#';
const NEW_PAGE = '#^[a-z0-9][a-z0-9-]{0,59}\.html$#';   // новая страница из ссылки кнопки — только если файла ещё нет
const MAX_FILE = 100 * 1024 * 1024;                     // 100 МБ на файл (аудио); реальный предел — лимиты PHP в admin/.user.ini
const KEEP_BACKUPS = 200;                               // сколько последних сохранений хранить в резервных копиях

$action = (string) ($_GET['action'] ?? '');

if (!logged_in()) out(401, ['ok' => false, 'error' => 'Войдите в админку: admin/']);
if ($action === 'me') out(200, ['ok' => true, 'user' => $_SESSION['admin'], 'csrf' => csrf_token()]);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(405, ['ok' => false, 'error' => 'Нужен POST']);
// запрос только со своего сайта и с токеном своей сессии
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$host = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
if ($origin !== '' && strtolower((string) parse_url($origin, PHP_URL_HOST)) !== $host) out(403, ['ok' => false, 'error' => 'Чужой сайт']);
if (!csrf_ok((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) out(403, ['ok' => false, 'error' => 'Сессия устарела — обновите страницу']);

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    out(200, ['ok' => true]);
}
if ($action !== 'save') out(400, ['ok' => false, 'error' => 'Неизвестное действие']);

// ---- сохранение: multipart, поля count, path0..N, file0..N ----
$count = (int) ($_POST['count'] ?? 0);
if ($count < 1) {
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 && !$_POST) out(413, ['ok' => false, 'error' => 'Запрос больше лимита хостинга (post_max_size) — уменьшите файл или поднимите лимит (docs/ADMIN.md)']);
    out(400, ['ok' => false, 'error' => 'Нет файлов']);
}
if ($count > 50) out(400, ['ok' => false, 'error' => 'Слишком много файлов за раз']);

$checked = [];
for ($i = 0; $i < $count; $i++) {
    $path = (string) ($_POST['path' . $i] ?? '');
    if ($path === '' || strpos($path, '..') !== false || strpos($path, chr(92)) !== false) out(400, ['ok' => false, 'error' => 'Запрещённый путь: ' . $path]);
    if (preg_match(NEW_PAGE, $path)) {
        if (file_exists(SITE_ROOT . '/' . $path)) out(400, ['ok' => false, 'error' => 'Страница уже есть, не перезаписываю: ' . $path]);
    } elseif (!preg_match(ALLOWED, $path)) {
        out(400, ['ok' => false, 'error' => 'Запрещённый путь: ' . $path]);
    }
    $up = $_FILES['file' . $i] ?? null;
    if (!is_array($up) || is_array($up['error'] ?? null)) out(400, ['ok' => false, 'error' => 'Файл не дошёл: ' . $path]);
    if (in_array($up['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) out(413, ['ok' => false, 'error' => 'Файл больше лимита хостинга (upload_max_filesize): ' . $path]);
    if ($up['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($up['tmp_name'])) out(400, ['ok' => false, 'error' => 'Файл не дошёл (код ' . $up['error'] . '): ' . $path]);
    if ($up['size'] > MAX_FILE) out(413, ['ok' => false, 'error' => 'Слишком большой файл: ' . $path]);
    if (substr($path, -5) === '.json') {
        json_decode((string) file_get_contents($up['tmp_name']));
        if (json_last_error() !== JSON_ERROR_NONE) out(400, ['ok' => false, 'error' => 'Неверный JSON: ' . $path]);
    }
    $checked[] = [$path, $up['tmp_name']];
}

// резервная копия прежних версий — в одну папку на сохранение
$backup = data_dir() . '/backups/' . date('Ymd-His') . '-' . bin2hex(random_bytes(2));
foreach ($checked as [$path, $upload]) {
    $dest = SITE_ROOT . '/' . $path;
    if (is_file($dest)) {
        $copy = $backup . '/' . $path;
        if (!is_dir(dirname($copy))) @mkdir(dirname($copy), 0700, true);
        @copy($dest, $copy);
    }
    if (!is_dir(dirname($dest)) && !@mkdir(dirname($dest), 0755, true)) out(500, ['ok' => false, 'error' => 'Нет прав создать папку для ' . $path]);
    // сначала во временный файл рядом, потом подмена одним шагом — сайт никогда не видит недописанный файл
    $tmp = $dest . '.tmp-' . bin2hex(random_bytes(4));
    $moved = @move_uploaded_file($upload, $tmp);
    if ($moved) @chmod($tmp, 0644);   // загруженные файлы бывают 0600 — тогда веб-сервер не отдал бы их посетителям
    if (!$moved || !@rename($tmp, $dest)) {
        @unlink($tmp);
        out(500, ['ok' => false, 'error' => 'Нет прав записать ' . $path . ' — проверьте права на папку сайта на хостинге (docs/ADMIN.md)']);
    }
}

// старые резервные копии — оставляем последние KEEP_BACKUPS
$dirs = glob(data_dir() . '/backups/*', GLOB_ONLYDIR) ?: [];
sort($dirs);
foreach (array_slice($dirs, 0, max(0, count($dirs) - KEEP_BACKUPS)) as $old) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($old, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $node) { $node->isDir() ? @rmdir($node->getPathname()) : @unlink($node->getPathname()); }
    @rmdir($old);
}

out(200, ['ok' => true, 'saved' => count($checked)]);
