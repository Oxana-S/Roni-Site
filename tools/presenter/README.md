# Сборка роликов «говорящего автора» (assets/presenter/)

На хостинг эта папка не нужна — только для пересборки видео. Что получается на выходе и как оно
работает на сайте — в начале `assets/presenter.js`.

- `source/` — исходные ролики (8 с, 1280×720, 24 к/с; все начинаются и кончаются скрещёнными руками —
  новые снимать так же).
- `matte.py` — вырезает человека (нейросеть RobustVideoMatting) → `out/*.mkv` (RGBA без потерь, FFV1).
- `atlas.py` + `atlas.json` — собирает атлас речи `talk.mp4` и разметку `talk.json`.
- `jumpcheck.py` — картинка с переходами, чтобы проверить швы глазами.

## Что нужно

ffmpeg (в PATH), Python 3 с пакетами `numpy onnxruntime`, модель `rvm_mobilenetv3_fp32.onnx`
(GitHub PeterL1n/RobustVideoMatting → Releases; в git не кладём, ~15 МБ).

## Шаги (из этой папки)

1. Вырезать человека: `python matte.py rvm_mobilenetv3_fp32.onnx out source/Man_*.mp4`
2. Атлас: `python atlas.py atlas.json` — печатает разметку роликов и «цену» переходов
   (чем меньше, тем незаметнее; хорошо — до ~6). Настройки роликов в atlas.json:
   - порядок: первый ролик с `start` — первая реплика (сейчас — приветственный жест);
   - `start: false` — ролик не начинает реплику; `exit: false` — в него не уходят скрещивать руки;
   - `entry`, `r` — вручную: с какого кадра можно войти в речь / где начинается скрещивание рук.
3. Проверка: `python jumpcheck.py ffmpeg talk.mp4 ../../assets/presenter/idle-a.mp4 talk.json jumps.png`
4. `talk.mp4` и `talk.json` — в `assets/presenter/`, в `assets/presenter.js` поднять `VER`,
   в `index.html` — версию `presenter.js?v=…`.

`idle-a.mp4` (слушает) — два ролика Man_standing_with_arms_crossed подряд, тот же кроп
(crop=932:658:197:62, scale=560:396), цвет×прозрачность сверху, маска снизу, H.264 bt709.

Проверять на компьютере — через `scripts/edit-server.py` (умеет перемотку видео);
`python -m http.server` не подходит.
