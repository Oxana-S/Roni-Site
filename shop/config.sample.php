<?php
/* Настройки магазина (оплата myPOS). Скопируйте этот файл в shop/config.php и заполните.
   shop/config.php в git не попадает и загружается на хостинг вручную — в нём ключ myPOS. Подробно — docs/SHOP.md. */
return [
    // 'off'  — оплата выключена (кнопка «Перейти к оплате» покажет «временно недоступна»)
    // 'test' — тестовые оплаты myPOS: деньги не списываются; работает только для вошедшего в admin/
    // 'live' — настоящие оплаты
    'mode' => 'test',

    // Для 'live': строка из кабинета myPOS (Stores → магазин → Integration → myPOS PHP SDK) —
    // ТОЛЬКО то, что внутри кавычек в $cnf->loadConfigurationPackage('…'), без кавычек и скобок.
    'pack' => '',

    'currency' => 'EUR',                     // валюта магазина в myPOS
    'notify' => 'rostvish.bg@gmail.com',     // сюда приходят уведомления о каждой продаже
    'from' => '',                            // адрес отправителя писем покупателям; пусто — books@<домен сайта>
    'files_dir' => '',                       // папка с файлами книг; пусто — book-files рядом с папкой сайта (снаружи)
    'file_names' => ['ghost' => 'Detective'],  // начало имён файлов книги вместо кода: Detective_EN.pdf, Detective_RU.pdf
    'link_days' => 30,                       // сколько дней работает ссылка на скачивание
    'link_downloads' => 10,                  // сколько раз можно скачать по одной ссылке
    // Ящик для отправки писем покупателям (ISPmanager → Почта). Пароль ящика вписываете только вы.
    'smtp' => [
        'host' => 'mail.vishnevsky.info',
        'port' => 465,                       // 465 — SSL; 587 — STARTTLS
        'user' => 'books@vishnevsky.info',
        'pass' => '',                        // пароль ящика books@vishnevsky.info
    ],
];
