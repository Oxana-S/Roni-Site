<?php
/* Вход в админку сайта: https://ваш-домен/admin/
   После входа открывается сайт с редактором (?edit): правки сохраняются прямо в файлы сайта на хостинге.
   Посетителям сайта ничего вводить не нужно — вход только для того, кто правит сайт. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

security_headers();
header('Content-Type: text/html; charset=utf-8');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$error = '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$do = (string) ($_POST['do'] ?? '');

if ($isPost && $do === 'logout') {
    if (csrf_ok((string) ($_POST['csrf'] ?? ''))) { $_SESSION = []; session_destroy(); }
    header('Location: ./');
    exit;
}

if ($isPost && $do === 'login') {
    $user = trim((string) ($_POST['user'] ?? ''));
    $pass = (string) ($_POST['pass'] ?? '');
    if (!csrf_ok((string) ($_POST['csrf'] ?? ''))) {
        $error = 'Страница устарела — введите логин и пароль ещё раз.';
    } elseif (login_blocked()) {
        $error = 'Слишком много неверных попыток. Попробуйте через 15 минут.';
    } elseif (check_login($user, $pass)) {
        login_ok();
        session_regenerate_id(true);
        $_SESSION = ['admin' => $user, 'v' => cred_version(), 'seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
        header('Location: ../index.html?edit');
        exit;
    } else {
        login_failed();
        $error = 'Неверный логин или пароль.';
    }
}

$in = logged_in();
$csrf = csrf_token();
?><!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Админка — Ростислав Вишневский</title>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/icons/icon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Forum&family=Spectral:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root { --bg:#14110d; --bg-2:#1a1410; --gold:#c9a86a; --gold-soft:#f0d8a8; --text:#ece4d6; --dim:#c9bda8; --mute:#8a8070;
          --line:rgba(201,168,106,.3); --err:#e08a7a; color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { background: radial-gradient(ellipse at top, #241c13 0%, var(--bg) 60%) fixed var(--bg); color: var(--text);
         font: 300 17px/1.5 Spectral, Georgia, serif; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; padding: 24px 16px; }
  .card { width: 100%; max-width: 380px; background: rgba(26,20,16,.85); border: 1px solid var(--line); padding: 36px 28px 30px;
          box-shadow: 0 24px 50px rgba(0,0,0,.6); }
  .eyebrow { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #b8935a; margin: 0 0 10px; }
  h1 { font: 400 32px/1.15 Forum, serif; margin: 0 0 22px; color: var(--gold-soft); }
  label { display: block; font-size: 14px; color: var(--dim); margin: 0 0 6px; }
  input { width: 100%; font: 400 17px Spectral, Georgia, serif; color: var(--text); background: var(--bg); border: 1px solid var(--line);
          padding: 11px 12px; margin: 0 0 16px; border-radius: 2px; }
  input:focus { outline: 2px solid var(--gold); outline-offset: 1px; border-color: transparent; }
  .btn { display: block; width: 100%; text-align: center; font: 500 15px Spectral, Georgia, serif; letter-spacing: 1px; text-transform: uppercase;
         background: var(--gold); color: #14110d; border: 0; padding: 13px 16px; cursor: pointer; text-decoration: none; border-radius: 2px; min-height: 44px; }
  .btn:hover { background: var(--gold-soft); }
  .btn.ghost { background: transparent; color: var(--dim); border: 1px solid var(--line); margin-top: 12px; }
  .btn.ghost:hover { color: var(--text); border-color: var(--gold); }
  .err { color: var(--err); border-left: 2px solid var(--err); padding: 4px 0 4px 10px; margin: 0 0 18px; font-size: 15px; }
  p { margin: 0 0 18px; color: var(--dim); }
  .note { font-size: 14px; color: var(--mute); margin: 22px 0 0; }
  .back { display: inline-block; margin-top: 18px; font-size: 14px; color: var(--mute); }
  .back:hover { color: var(--gold); }
</style>
</head>
<body>
<main class="card">
  <p class="eyebrow">Ростислав Вишневский</p>
<?php if ($in): ?>
  <h1>Админка сайта</h1>
  <p>Вы вошли как <b><?= h((string) $_SESSION['admin']) ?></b>. На страницах сайта есть кнопка «Редактировать»: правите прямо на странице и нажимаете «Сохранить» — изменения сразу видны всем.</p>
  <a class="btn" href="../index.html?edit">Открыть сайт и редактировать</a>
  <form method="post" action="./">
    <input type="hidden" name="do" value="logout">
    <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
    <button class="btn ghost" type="submit">Выйти</button>
  </form>
  <p class="note">Перед каждым сохранением прежние версии файлов откладываются в admin/.data/backups на хостинге (последние 200 сохранений).</p>
<?php else: ?>
  <h1>Вход в админку</h1>
<?php if ($error !== ''): ?>
  <p class="err" role="alert"><?= h($error) ?></p>
<?php endif; ?>
  <form method="post" action="./" autocomplete="on">
    <input type="hidden" name="do" value="login">
    <input type="hidden" name="csrf" value="<?= h($csrf) ?>">
    <label for="user">Логин</label>
    <input id="user" name="user" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
    <label for="pass">Пароль</label>
    <input id="pass" name="pass" type="password" autocomplete="current-password" required>
    <button class="btn" type="submit">Войти</button>
  </form>
  <a class="back" href="../">← На сайт</a>
<?php endif; ?>
</main>
</body>
</html>
