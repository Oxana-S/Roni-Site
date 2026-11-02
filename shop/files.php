<?php
/* Какой файл книги получит покупатель на каждом языке — только для вошедшего в admin/.
   Откройте https://<сайт>/shop/files.php после того, как положили книги в папку book-files (docs/SHOP.md).
   Внизу — файлы, которые сайт не выдаёт никому (имя не подошло ни к одной книге). */
@ini_set('display_errors', '0');
require __DIR__ . '/lib.php';

if (!shop_admin()) shop_text_response(403, 'Войдите в admin/ и откройте эту страницу снова.');
$dir = shop_files_dir();
$out = "Папка с книгами: $dir\nИмя файла — начало (у каждой книги указано ниже) и язык в конце: Detective_RU.pdf, Detective_EN.epub (UA или UK — украинский).\n";
if (!@is_dir($dir)) shop_text_response(200, $out . "\nПАПКИ НЕТ — создайте book-files рядом с папкой сайта и положите книги туда.");
$names = @scandir($dir);
if ($names === false) shop_text_response(200, $out . "\nПапка есть, но сайт не может её прочитать — проверьте права доступа.");

$used = [];
foreach (seo_books() as $b) {
    if (!is_array($b) || empty($b['id']) || !seo_valid_id($b['id'])) continue;
    $all = shop_book_files_all($b['id']);
    foreach ($all as $files) foreach ($files as $f) $used[basename($f)] = true;
    $pre = shop_file_prefixes($b['id']);
    $p = end($pre);
    $out .= "\n«" . seo_bf($b, seo_def(), 'title') . "» (код {$b['id']}, имена файлов: {$p}_RU.pdf, {$p}_EN.pdf …)\n";
    foreach (seo_langs() as $l) {
        $L = '  ' . strtoupper($l) . ': ';
        if (!seo_book_in($b, $l)) { $out .= $L . "книги нет на этом языке сайта\n"; continue; }
        $files = shop_book_files($b['id'], $l);
        $soon = seo_published($b, $l) ? '' : '  (сейчас «Скоро» — не продаётся)';
        if (!$files) { $out .= $L . 'НЕТ ФАЙЛА — покупателю придёт «автор пришлёт книгу вручную»' . $soon . "\n"; continue; }
        $list = [];
        foreach ($files as $f) $list[] = basename($f) . ' (' . number_format(@filesize($f) / 1048576, 1, ',', '') . ' МБ)';
        $out .= $L . implode(', ', $list) . (empty($all[$l]) ? '  ← общий файл без языка' : '') . $soon . "\n";
    }
}

$other = [];
foreach ($names as $n) if ($n[0] !== '.' && !isset($used[$n]) && @is_file($dir . '/' . $n)) $other[] = $n;
if ($other) $out .= "\nЭти файлы сайт не выдаёт (имя не начинается с названия книги, в конце нет языка, другой формат или такой файл уже есть):\n  " . implode("\n  ", $other) . "\n";
shop_text_response(200, $out);
