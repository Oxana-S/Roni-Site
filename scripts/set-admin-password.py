"""Логин и пароль админки сайта (страница admin/ на хостинге).

    python scripts/set-admin-password.py                 — спросит логин и пароль
    python scripts/set-admin-password.py --user admin    — спросит только пароль

Создаёт admin/config.php: в нём логин, соль и хеш пароля (PBKDF2-SHA256), сам пароль не хранится.
Файл не попадает в git (.gitignore) — загрузите его на хостинг вручную в папку admin/.
Сменить пароль: запустить ещё раз и заново загрузить admin/config.php — все прежние входы сбросятся.
"""
import argparse
import datetime
import getpass
import hashlib
import re
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "admin" / "config.php"
ITERATIONS = 200_000


def main():
    ap = argparse.ArgumentParser(description="Задать логин и пароль админки (admin/config.php)")
    ap.add_argument("--user", help="логин (по умолчанию спросит; Enter — admin)")
    ap.add_argument("--stdin", action="store_true", help="прочитать пароль из стандартного ввода, одной строкой")
    a = ap.parse_args()

    user = a.user if a.user is not None else (input("Логин [admin]: ").strip() or "admin")
    if not re.fullmatch(r"[A-Za-z0-9._@-]{1,64}", user):
        sys.exit("Логин: латинские буквы, цифры и . _ @ - (до 64 символов)")

    if a.stdin:
        pw = sys.stdin.buffer.readline().decode("utf-8").rstrip("\r\n")
    else:
        pw = getpass.getpass("Пароль: ")
        if pw != getpass.getpass("Пароль ещё раз: "):
            sys.exit("Пароли не совпали — ничего не изменено")
    if len(pw) < 12:
        sys.exit("Пароль слишком короткий — нужно не меньше 12 символов")

    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, ITERATIONS).hex()
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    OUT.write_text(
        "<?php\n"
        f"// Вход в админку (admin/). Создан scripts/set-admin-password.py {stamp}.\n"
        "// Здесь только соль и хеш пароля — сам пароль не хранится. Не публикуйте файл (он в .gitignore).\n"
        "return [\n"
        f"    'user' => '{user}',\n"
        f"    'salt' => '{salt.hex()}',\n"
        f"    'iterations' => {ITERATIONS},\n"
        f"    'hash' => '{digest}',\n"
        "];\n",
        encoding="utf-8", newline="\n")
    print(f"Готово: {OUT.relative_to(ROOT)} (логин: {user}). Загрузите этот файл на хостинг в папку admin/.")


if __name__ == "__main__":
    main()
