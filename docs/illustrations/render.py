# Рендер SVG-иллюстраций из assets/img в JPG через headless Microsoft Edge.
# Нужен запущенный локальный сервер из корня сайта: npx http-server -p 8765 -c-1
# Пример: python docs/illustrations/render.py hero-detective:2560x1440 world-lucas world-olivia
import subprocess, base64, re, sys, os, tempfile, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PAGE = os.path.join(ROOT, '_render.html')
HTML = '''<!doctype html><meta charset="utf-8"><body><script>
(async () => {
  const q = new URLSearchParams(location.search);
  const W = +q.get('w'), H = +q.get('h');
  const img = new Image();
  img.src = 'assets/img/' + q.get('f') + '.svg';
  await img.decode();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').drawImage(img, 0, 0, W, H);
  document.body.textContent = 'DATA:' + c.toDataURL('image/jpeg', +(q.get('q') || 0.86));
})().catch(e => { document.body.textContent = 'ERR:' + e; });
</script></body>'''

open(PAGE, 'w', encoding='utf-8').write(HTML)
prof = tempfile.mkdtemp(prefix='edge-render-')
try:
    for arg in sys.argv[1:]:
        name, _, size = arg.partition(':')
        w, h = (size or '1920x1080').split('x')
        url = 'http://localhost:8765/_render.html?f=%s&w=%s&h=%s&q=0.86' % (name, w, h)
        r = subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--user-data-dir=' + prof,
                            '--virtual-time-budget=90000', '--dump-dom', url],
                           capture_output=True, text=True, timeout=600)
        m = re.search(r'DATA:data:image/jpeg;base64,([A-Za-z0-9+/=]+)', r.stdout)
        if not m:
            print(name, 'FAILED', r.stdout[-300:], r.stderr[-300:])
            continue
        data = base64.b64decode(m.group(1))
        open(os.path.join(ROOT, 'assets', 'img', name + '.jpg'), 'wb').write(data)
        print(name, '%sx%s' % (w, h), len(data) // 1024, 'KB')
finally:
    os.remove(PAGE)
    shutil.rmtree(prof, ignore_errors=True)
