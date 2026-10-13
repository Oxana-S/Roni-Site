#!/usr/bin/env python3
"""Локальный сервер для правки сайта без GitHub.

    python scripts/edit-server.py          → http://localhost:8765/?edit

Пока он запущен, сохранять можно и со страниц Live Server (127.0.0.1:5500/…/?edit):
редактор отправляет «Сохранить» сюда, на localhost:8765.

Отдаёт сайт и принимает «Сохранить» из редактора на сайте (assets/editor.js):
пишет прямо в файлы проекта. Потом изменения коммитятся обычным git.
Записывать можно только данные (data/*.json, data/chapters/*.json),
обложки книг (assets/img/books/*), загрузки конструктора (assets/uploads/*)
и новые страницы в корне (имя.html) — только если такого файла ещё нет.
"""
import base64
import functools
import http.server
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
NEW_PAGE = re.compile(r"^[a-z0-9][a-z0-9-]{0,59}\.html$")   # новая страница из ссылки кнопки
# сохранять можно и со страниц, открытых другим локальным сервером (например, Live Server в VS Code)
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$")
ALLOWED = re.compile(r"^(data/[a-z0-9_-]+\.json|data/chapters/[a-z0-9-]+\.json"
                     r"|assets/img/books/[A-Za-z0-9._-]+\.(jpg|png|webp)"
                     r"|assets/uploads/[a-z0-9-]+\.(jpg|png|webp|gif|mp3|m4a|aac|ogg|wav))$")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin", "")
        if LOCAL_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _reply(self, code, body):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/__edit/ping":
            return self._reply(200, "ok")
        return super().do_GET()

    def do_POST(self):
        if self.path != "/__edit/save":
            return self._reply(404, "not found")
        origin = self.headers.get("Origin", "")
        if origin and not LOCAL_ORIGIN.match(origin):
            return self._reply(403, "сохранять можно только со своего компьютера")
        try:
            size = int(self.headers.get("Content-Length", "0"))
            files = json.loads(self.rfile.read(size))["files"]
            for f in files:
                if NEW_PAGE.match(f["path"]):
                    if (ROOT / f["path"]).exists():
                        return self._reply(400, "страница уже есть, не перезаписываю: " + f["path"])
                elif not ALLOWED.match(f["path"]):
                    return self._reply(400, "запрещённый путь: " + f["path"])
            for f in files:
                dest = ROOT / f["path"]
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(base64.b64decode(f["base64"]))
                print("  записан", f["path"])
        except Exception as e:  # noqa: BLE001 — ответ редактору вместо падения сервера
            return self._reply(500, str(e))
        return self._reply(200, "ok")


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as srv:
        print(f"Сайт: http://localhost:{PORT}/?edit   (Ctrl+C — остановить)")
        srv.serve_forever()
