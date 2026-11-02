@echo off
rem Запуск сайта на этом компьютере: http://localhost:8765 (окно не закрывать, Ctrl+C — остановить).
rem Нужен Python 3 (python.org). Админка и магазин (PHP) так не работают — только страницы, редактор (?edit) и презентер.
cd /d "%~dp0.."
start "" "http://localhost:8765/"
python scripts\edit-server.py
pause
