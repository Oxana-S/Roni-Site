# Генератор фона первого экрана: ночной Бронкс через запотевшее окно квартиры Лукаса.
# Подоконник: Конфуций (рыжий мейн-кун), бокал виски, шляпа-федора, сигара дяди Винни.
# В отражении стекла — едва заметный силуэт Оливии. Без текста (надпись на стекле — HTML-слой).
# Выход: assets/img/hero-detective.svg (затем рендер в JPG через render.py).
import random, math, os

W, H = 1920, 1080
SILL = 945                      # верхняя кромка подоконника
MOON = (1240, 205, 56)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img', 'hero-detective.svg')

out = []
o = out.append

def pts(*ps):
    return ' '.join('%.1f,%.1f' % p for p in ps)

def bbox_filter(fid, inner, pad=1.0):
    return '<filter id="%s" x="-%s" y="-%s" width="%s" height="%s">%s</filter>' % (fid, pad, pad, 1 + 2 * pad, 1 + 2 * pad, inner)

o('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice">' % (W, H))
o('<defs>')
o('''
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#05070d"/><stop offset=".45" stop-color="#0c1220"/><stop offset=".72" stop-color="#1a2336"/><stop offset="1" stop-color="#232c40"/>
  </linearGradient>
  <radialGradient id="halo1" cx="%d" cy="%d" r="300" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#dfe6f7" stop-opacity=".55"/><stop offset=".3" stop-color="#9fb0d4" stop-opacity=".22"/><stop offset="1" stop-color="#7d8fb8" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="halo2" cx="%d" cy="%d" r="760" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#8a9cc4" stop-opacity=".22"/><stop offset="1" stop-color="#8a9cc4" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="moon" cx=".4" cy=".38" r=".75">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#e9eefb"/><stop offset="1" stop-color="#c3cde8"/>
  </radialGradient>
  <radialGradient id="streetglow" cx="900" cy="980" r="900" gradientUnits="userSpaceOnUse" gradientTransform="translate(900 980) scale(1 .45) translate(-900 -980)">
    <stop offset="0" stop-color="#d38d3e" stop-opacity=".30"/><stop offset=".5" stop-color="#a8692c" stop-opacity=".10"/><stop offset="1" stop-color="#a8692c" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="lamp" cx="1980" cy="1180" r="1100" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#f0a25a" stop-opacity=".42"/><stop offset=".45" stop-color="#c9772f" stop-opacity=".14"/><stop offset="1" stop-color="#c9772f" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fogband" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#55668c" stop-opacity="0"/><stop offset=".5" stop-color="#55668c" stop-opacity=".42"/><stop offset="1" stop-color="#55668c" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="fogDist" cx="960" cy="420" r="1000" gradientUnits="userSpaceOnUse" gradientTransform="translate(960 420) scale(1 .78) translate(-960 -420)">
    <stop offset="0" stop-color="#000"/><stop offset=".42" stop-color="#000"/><stop offset=".62" stop-color="#555"/><stop offset=".85" stop-color="#d0d0d0"/><stop offset="1" stop-color="#fff"/>
  </radialGradient>
  <linearGradient id="sillTop" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a2717"/><stop offset="1" stop-color="#140d08"/>
  </linearGradient>
  <linearGradient id="sillFront" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0f0a07"/><stop offset="1" stop-color="#050302"/>
  </linearGradient>
  <linearGradient id="whisky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f2b866"/><stop offset=".55" stop-color="#c7782b"/><stop offset="1" stop-color="#7a3d10"/>
  </linearGradient>
  <radialGradient id="glassGlow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#f0a650" stop-opacity=".55"/><stop offset="1" stop-color="#f0a650" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="ember" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ffd9a0"/><stop offset=".35" stop-color="#ff8a33" stop-opacity=".9"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ghostFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eef3ff" stop-opacity=".9"/><stop offset=".6" stop-color="#cfdaf6" stop-opacity=".55"/><stop offset=".9" stop-color="#cfdaf6" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="vig" cx=".5" cy=".46" r=".78">
    <stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/>
  </radialGradient>
''' % (MOON[0], MOON[1], MOON[0], MOON[1]))
# фильтры в координатах всей картинки
for fid, sd in (('b3', 3), ('b6', 6), ('b12', 12), ('b20', 20), ('b40', 40)):
    o('<filter id="%s" filterUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d"><feGaussianBlur stdDeviation="%s"/></filter>' % (fid, W, H, sd))
o('''<filter id="fogNoise" filterUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d">
    <feTurbulence type="fractalNoise" baseFrequency=".0035 .006" numOctaves="4" seed="11" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .80  0 0 0 0 .85  0 0 0 0 .93  0 0 0 1.9 -.62"/>
  </filter>''' % (W, H))
o('''<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 .8  0 0 0 0 .82  0 0 0 0 .9  0 0 0 .45 -.18"/>
  </filter>''' % (W, H))
# фильтры по bbox — для трансформированных групп
o(bbox_filter('fur', '<feTurbulence type="turbulence" baseFrequency=".75" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>', .3))
o(bbox_filter('rimblur', '<feGaussianBlur stdDeviation="2.2"/>', .3))
o(bbox_filter('gwisp', '<feTurbulence type="fractalNoise" baseFrequency=".02 .05" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="2.5"/>', .5))
o(bbox_filter('gglow', '<feGaussianBlur stdDeviation="26"/>', 1))
o(bbox_filter('smoke', '<feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="3" seed="21" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="3.2"/>', .6))

# маска запотевания: ясно в центре, плотнее к краям и низу; дорожки стекающих капель — чистые полосы
rnd = random.Random(31)
drips = []
for _ in range(34):
    x = rnd.uniform(150, 1770)
    # стекают в зонах запотевания: у краёв или в нижней части
    edge = min(x - 110, 1810 - x)
    y0 = rnd.uniform(80, 520) if edge < 300 else rnd.uniform(640, 820)
    y1 = min(SILL - 4, y0 + rnd.uniform(120, 420))
    d = 'M %.1f %.1f' % (x, y0)
    y = y0
    while y < y1:
        y2 = min(y1, y + rnd.uniform(18, 46))
        x += rnd.uniform(-2.2, 2.2)
        d += ' L %.1f %.1f' % (x, y2)
        y = y2
    drips.append((d, x, y1, rnd.uniform(2.2, 4.5)))
o('<mask id="fogMask" maskUnits="userSpaceOnUse" x="0" y="0" width="%d" height="%d"><rect width="%d" height="%d" fill="url(#fogDist)"/>' % (W, H, W, H))
for d, x, y1, w in drips:
    o('<path d="%s" fill="none" stroke="#000" stroke-width="%.1f" stroke-linecap="round"/>' % (d, w * 1.6))
o('</mask>')
o('<clipPath id="frame"><rect width="%d" height="%d"/></clipPath>' % (W, H))
o('<clipPath id="glass"><rect x="110" y="70" width="1700" height="%d"/></clipPath>' % (SILL - 70))
o('</defs>')

o('<g clip-path="url(#frame)">')
# ---------- ВИД ЗА ОКНОМ ----------
o('<g clip-path="url(#glass)">')
o('<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, H))
o('<rect width="%d" height="%d" fill="url(#halo2)"/>' % (W, H))
o('<rect width="%d" height="%d" fill="url(#halo1)"/>' % (W, H))
# звёзды — немного, город засвечивает небо
for _ in range(40):
    x, y = rnd.uniform(120, 1800), rnd.uniform(80, 420)
    if math.hypot(x - MOON[0], y - MOON[1]) < 260:
        continue
    o('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#dfe6ff" opacity="%.2f"/>' % (x, y, rnd.uniform(.5, 1.2), rnd.uniform(.2, .6)))
# луна и облака
mx, my, mr = MOON
o('<circle cx="%d" cy="%d" r="%d" fill="url(#moon)"/>' % (mx, my, mr))
for (dx, dy, r, op) in ((-14, -10, 11, .28), (18, 14, 8, .25), (-4, 22, 6, .22), (22, -18, 5, .2)):
    o('<circle cx="%d" cy="%d" r="%d" fill="#b7c2df" opacity="%.2f"/>' % (mx + dx, my + dy, r, op))
for (cx, cy, rx, ry, op) in ((1180, 250, 330, 26, .75), (1330, 196, 220, 14, .55), (980, 300, 420, 30, .5), (1500, 290, 300, 22, .45), (700, 230, 360, 20, .3)):
    o('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="#1c2640" opacity="%.2f" filter="url(#b12)"/>' % (cx, cy, rx, ry, op))
    o('<ellipse cx="%d" cy="%d" rx="%d" ry="%d" fill="#9fb0d6" opacity="%.2f" filter="url(#b12)"/>' % (cx + 10, cy - ry * .6, rx * .8, ry * .35, op * .35))

# дальний Манхэттен в дымке + Эмпайр-стейт
def skyline(x0, x1, base, hmin, hmax, col, seed, lit=0.0, wcol='#e7b56d'):
    r = random.Random(seed)
    x = x0
    while x < x1:
        w = r.uniform(18, 54)
        h = r.uniform(hmin, hmax)
        o('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x, base - h, w + .6, h + 400, col))
        if lit:
            for yy in range(int(base - h + 8), int(base + 40), 9):
                for xx in range(int(x + 4), int(x + w - 4), 7):
                    if r.random() < lit:
                        o('<rect x="%d" y="%d" width="2.4" height="3.4" fill="%s" opacity="%.2f"/>' % (xx, yy, wcol, r.uniform(.35, .85)))
        x += w

skyline(140, 1800, 772, 40, 150, '#151d2f', 1, .045)
ex, eb = 900, 772
steps = [(30, 150), (22, 205), (15, 245), (9, 268), (5, 282), (1.6, 326)]
lp, prev = [], 0
for hw, h in steps:
    lp += [(ex - hw, eb - prev), (ex - hw, eb - h)]
    prev = h
rp = [(2 * ex - x, y) for x, y in reversed(lp)]
o('<path d="M %s Z" fill="#141b2c"/>' % ' L '.join('%.1f %.1f' % p for p in lp + rp))
for yy in range(int(eb - 245), int(eb), 7):
    for xx in range(ex - 26, ex + 26, 6):
        if rnd.random() < .08 and abs(xx - ex) < (15 if yy < eb - 205 else 22 if yy < eb - 150 else 30):
            o('<rect x="%d" y="%d" width="2" height="3" fill="#f0c27d" opacity="%.2f"/>' % (xx, yy, rnd.uniform(.4, .8)))
o('<circle cx="%d" cy="%d" r="10" fill="#f3d9a6" opacity=".3" filter="url(#b6)"/>' % (ex, eb - 300))
o('<circle cx="%d" cy="%d" r="3.2" fill="#ffe9c0"/>' % (ex, eb - 326))
skyline(140, 1800, 790, 14, 70, '#121a2a', 2, .05)
# полосы тумана над городом
o('<rect x="0" y="690" width="%d" height="170" fill="url(#fogband)" filter="url(#b20)"/>' % W)
o('<rect width="%d" height="%d" fill="url(#streetglow)"/>' % (W, H))

# ближние крыши Бронкса: парапеты, трубы, пожарные лестницы, освещённые окна, водонапорные башни
def roofs(seed):
    r = random.Random(seed)
    x = 100
    blds = []
    while x < 1820:
        w = r.uniform(70, 190)
        top = r.uniform(780, 860)
        blds.append((x, w, top))
        x += w
    for (x, w, top) in blds:
        o('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#0a0e18"/>' % (x, top, w + .8, SILL - top + 2))
        o('<rect x="%.1f" y="%.1f" width="%.1f" height="5" fill="#0e1422"/>' % (x - 3, top - 5, w + 6))
        if r.random() < .5:
            cw = r.uniform(10, 18)
            cx = x + r.uniform(10, w - 25)
            o('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#0a0e18"/>' % (cx, top - r.uniform(18, 34), cw, 40))
        for yy in range(int(top + 14), SILL - 6, 22):
            for xx in range(int(x + 10), int(x + w - 14), 18):
                v = r.random()
                if v < .07:
                    o('<rect x="%d" y="%d" width="7" height="11" fill="#e9b062" opacity="%.2f"/>' % (xx, yy, r.uniform(.55, .95)))
                elif v < .1:
                    o('<rect x="%d" y="%d" width="7" height="11" fill="#9db0d8" opacity=".25"/>' % (xx, yy))
    return blds
blds = roofs(7)

def water_tower(cx, base, s, col='#070a12'):
    legs_h, tank_h, rad = 46 * s, 62 * s, 26 * s
    top = base - legs_h
    for dx in (-.85, -.3, .3, .85):
        o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"/>' % (cx + dx * rad * 1.15, base, cx + dx * rad, top, col, max(1.2, 2.2 * s)))
    o('<polyline points="%s" fill="none" stroke="%s" stroke-width="%.1f"/>' % (pts((cx - rad * .95, base - legs_h * .15), (cx + rad * .3, top + legs_h * .2), (cx + rad * .95, base - legs_h * .15)), col, max(1, 1.4 * s)))
    o('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (cx - rad, top - tank_h, 2 * rad, tank_h, col))
    for i in range(1, 5):
        yy = top - tank_h * i / 5
        o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#1b2438" stroke-width="%.1f"/>' % (cx - rad, yy, cx + rad, yy, max(.6, .9 * s)))
    o('<polygon points="%s" fill="%s"/>' % (pts((cx - rad * 1.1, top - tank_h), (cx, top - tank_h - rad * .85), (cx + rad * 1.1, top - tank_h)), col))
    # лунный блик по краю бака
    o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#8fa2cc" stroke-opacity=".45" stroke-width="%.1f"/>' % (cx + rad - 1, top - tank_h + 2, cx + rad - 1, top - 2, max(.8, 1.2 * s)))

water_tower(430, 792, 2.3)
water_tower(1150, 800, 1.2)
water_tower(1560, 786, 1.9)
water_tower(270, 806, 1.0)
# пожарная лестница на торце ближнего дома справа
for k in range(5):
    y = 830 + k * 24
    o('<line x1="1366" y1="%d" x2="1418" y2="%d" stroke="#05080f" stroke-width="3"/>' % (y, y))
    o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#05080f" stroke-width="1.6"/>' % (1370 if k % 2 else 1412, y, 1412 if k % 2 else 1370, y + 24))
o('</g>')  # glass view

# ---------- СТЕКЛО: ЗАПОТЕВАНИЕ, КАПЛИ, ОТРАЖЕНИЯ ----------
o('<g clip-path="url(#glass)">')
# тёплый отблеск комнаты в стекле
o('<polygon points="%s" fill="#f0a25a" opacity=".05" filter="url(#b40)"/>' % pts((1300, 945), (1810, 420), (1810, 945)))
# отражение Оливии — почти невидимое, справа у рамы
ghost = '''
<path d="M -25 -404 C -30 -428 -14 -440 0 -440 C 14 -440 30 -428 25 -404 C 32 -372 38 -330 36 -298 C 30 -290 24 -294 21 -306 C 19 -330 16 -350 12 -362 C 4 -356 -4 -356 -12 -362 C -16 -350 -19 -330 -21 -306 C -24 -294 -30 -290 -36 -298 C -38 -330 -32 -372 -25 -404 Z"/>
<ellipse cx="0" cy="-392" rx="21" ry="27"/>
<path d="M -7 -368 L -7 -350 L 7 -350 L 7 -368 Z"/>
<path d="M -10 -354 C -40 -352 -54 -342 -57 -318 L -60 -214 Q 0 -200 60 -214 L 57 -318 C 54 -342 40 -352 10 -354 Z"/>
<path d="M -57 -318 C -68 -276 -70 -236 -66 -200 L -52 -198 C -52 -236 -50 -276 -46 -300 Z"/>
<path d="M 57 -318 C 68 -276 70 -236 66 -200 L 52 -198 C 52 -236 50 -276 46 -300 Z"/>
<path d="M -40 -250 C -50 -180 -66 -112 -78 -62 Q 0 -44 78 -62 C 66 -112 50 -180 40 -250 Z"/>
'''
gt = 'translate(1712 930) scale(1.32)'
o('<g transform="%s" fill="#cfdaf8" opacity=".14" filter="url(#gglow)">%s</g>' % (gt, ghost))
o('<g transform="%s" fill="url(#ghostFill)" opacity=".22" filter="url(#gwisp)">%s</g>' % (gt, ghost))
# конденсат
o('<rect width="%d" height="%d" filter="url(#fogNoise)" mask="url(#fogMask)" opacity=".78"/>' % (W, H))
o('<rect width="%d" height="%d" fill="#b8c4da" opacity=".07" mask="url(#fogMask)"/>' % (W, H))
# дорожки капель: чуть темнее и с бликом
for d, x, y1, w in drips:
    o('<path d="%s" fill="none" stroke="#dfe7f7" stroke-opacity=".16" stroke-width="1" transform="translate(%.1f 0)"/>' % (d, w * .45))
    o('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#c9d4ea" opacity=".35"/>' % (x, y1, w * 1.1, w * 1.35))
    o('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#fff" opacity=".5"/>' % (x - w * .35, y1 - w * .4, max(.7, w * .28)))
# мелкие капли: вероятность растёт к краям
cx0, cy0 = 960, 420
n = 0
while n < 1100:
    x, y = rnd.uniform(110, 1810), rnd.uniform(70, SILL - 4)
    dist = math.hypot((x - cx0) / 1000, (y - cy0) / 780)
    if rnd.random() > max(0, (dist - .38) * 1.9):
        continue
    r = rnd.choice((.9, 1.2, 1.5, 1.9, 2.4, 3.2)) * rnd.uniform(.8, 1.2)
    o('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#d6dff0" fill-opacity=".22" stroke="#0a0d16" stroke-opacity=".28" stroke-width=".7"/>' % (x, y, r))
    if r > 1.6:
        o('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#fff" opacity=".55"/>' % (x - r * .35, y - r * .35, r * .28))
    n += 1
o('</g>')

# ---------- РАМА ОКНА ----------
fc = '#05060a'
o('<rect x="0" y="0" width="110" height="%d" fill="%s"/>' % (H, fc))
o('<rect x="1810" y="0" width="110" height="%d" fill="%s"/>' % (H, fc))
o('<rect x="0" y="0" width="%d" height="70" fill="%s"/>' % (W, fc))
for (x1, y1, x2, y2, c, op) in ((110, 70, 110, SILL, '#2a3550', .7), (1810, 70, 1810, SILL, '#5b3f26', .55), (110, 70, 1810, 70, '#1d2638', .8)):
    o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-opacity="%.2f" stroke-width="3"/>' % (x1, y1, x2, y2, c, op))
o('<rect x="98" y="58" width="1724" height="%d" fill="none" stroke="#0b0d13" stroke-width="10"/>' % (SILL - 52))

# ---------- ПОДОКОННИК ----------
o('<polygon points="%s" fill="url(#sillTop)"/>' % pts((0, SILL), (W, SILL), (W, SILL + 34), (0, SILL + 34)))
o('<rect x="0" y="%d" width="%d" height="%d" fill="url(#sillFront)"/>' % (SILL + 34, W, H - SILL - 34))
o('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="#c98a48" stroke-opacity=".45" stroke-width="1.5"/>' % (SILL + 1, W, SILL + 1))
o('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="#000" stroke-opacity=".7" stroke-width="2"/>' % (SILL + 34, W, SILL + 34))
# лунный свет на подоконнике у стекла
o('<rect x="110" y="%d" width="1700" height="10" fill="#9fb2dc" opacity=".12" filter="url(#b3)"/>' % (SILL + 2))

# ---------- КОНФУЦИЙ (рыжий мейн-кун), сидит спиной, смотрит на луну ----------
CX, CY, CS = 560, SILL + 16, 0.92
# единый силуэт: тело + воротник + голова + уши (вид со спины, голова чуть повёрнута к луне)
CAT = ('M -104 0 C -132 -50 -126 -140 -92 -196 C -80 -214 -86 -226 -76 -238 '
       'C -84 -256 -78 -286 -60 -300 L -70 -374 L -28 -318 C -10 -327 14 -327 30 -320 '
       'L 66 -376 L 66 -298 C 82 -284 88 -258 78 -240 C 90 -228 88 -214 98 -198 '
       'C 130 -140 136 -50 108 0 Z')
TAIL = 'M 96 -6 C 156 2 212 -10 236 -40 C 246 -56 238 -72 218 -68 C 204 -64 200 -48 184 -40 C 154 -26 122 -28 96 -36 Z'
o('<clipPath id="catR" clipPathUnits="userSpaceOnUse"><rect x="12" y="-420" width="300" height="408"/></clipPath><linearGradient id="catFur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#090605"/><stop offset=".55" stop-color="#140b06"/><stop offset="1" stop-color="#2e170a"/></linearGradient>')
o('<clipPath id="catL" clipPathUnits="userSpaceOnUse"><rect x="-200" y="-420" width="196" height="250"/></clipPath>')
o('<g transform="translate(%d %d) scale(%.2f)" fill="url(#catFur)" stroke="#0b0806" stroke-width="2" filter="url(#fur)">'
  '<path d="%s"/><path d="%s"/>'
  '<path d="M -70 -374 L -72 -392 M 66 -376 L 70 -394" fill="none" stroke-width="3.5" stroke-linecap="round"/>'
  '</g>' % (CX, CY, CS, CAT, TAIL))
# контровой свет: рыжий справа (лампа в комнате), холодный сверху-слева (луна)
o('<g transform="translate(%d %d) scale(%.2f)" fill="none" stroke-linejoin="round" filter="url(#rimblur)">'
  '<path d="%s" stroke="#e8913f" stroke-opacity=".85" stroke-width="5" clip-path="url(#catR)"/>'
  '<path d="M 96 -6 C 156 2 212 -10 236 -40 C 246 -56 238 -72 218 -68" stroke="#e8913f" stroke-opacity=".75" stroke-width="4.5"/>'
  '<path d="%s" stroke="#aebfe6" stroke-opacity=".55" stroke-width="3.5" clip-path="url(#catL)"/>'
  '</g>' % (CX, CY, CS, CAT, CAT))
# пушистость по контуру: короткие штрихи рыжим справа и холодным слева
fr = random.Random(5)
import re as _re
nums = [float(v) for v in _re.findall(r'-?\d+\.?\d*', CAT)]
pts_cat = list(zip(nums[0::2], nums[1::2]))
for i in range(len(pts_cat) - 1):
    (x1, y1), (x2, y2) = pts_cat[i], pts_cat[i + 1]
    for _ in range(4):
        t = fr.random()
        x, y = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
        if y > -60:
            continue
        col = '#e8913f' if x > 12 else '#aebfe6'
        op = .35 if x > 12 else .25
        X, Y = CX + x * CS, CY + y * CS
        nx = 1 if x > 0 else -1
        o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-opacity="%.2f" stroke-width="1.1" stroke-linecap="round"/>' % (X, Y, X + nx * fr.uniform(2, 6), Y - fr.uniform(3, 8), col, op))

# ---------- БОКАЛ ВИСКИ ----------
GX, GB = 860, SILL + 14
o('<ellipse cx="%d" cy="%d" rx="90" ry="22" fill="url(#glassGlow)" opacity=".8"/>' % (GX, GB))
o('<path d="M %d %d L %d %d L %d %d L %d %d Z" fill="url(#whisky)" opacity=".92"/>' % (GX - 31, GB - 40, GX + 31, GB - 40, GX + 29, GB - 4, GX - 29, GB - 4))
o('<ellipse cx="%d" cy="%d" rx="31" ry="5" fill="#f6c27a" opacity=".85"/>' % (GX, GB - 40))
o('<rect x="%d" y="%d" width="22" height="20" rx="4" fill="#fbe7c8" opacity=".35" transform="rotate(-12 %d %d)"/>' % (GX - 14, GB - 52, GX, GB - 42))
o('<path d="M %d %d L %d %d L %d %d L %d %d Z" fill="#cfe0ff" fill-opacity=".07" stroke="#e6eeff" stroke-opacity=".55" stroke-width="1.6"/>' % (GX - 36, GB - 88, GX + 36, GB - 88, GX + 32, GB, GX - 32, GB))
o('<rect x="%d" y="%d" width="64" height="7" fill="#e6eeff" opacity=".18"/>' % (GX - 32, GB - 7))
o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/>' % (GX - 27, GB - 80, GX - 25, GB - 10))
o('<ellipse cx="%d" cy="%d" rx="36" ry="5" fill="none" stroke="#e6eeff" stroke-opacity=".4" stroke-width="1.2"/>' % (GX, GB - 88))

# ---------- ШЛЯПА-ФЕДОРА ----------
HX, HB = 1395, SILL + 16
o('<ellipse cx="%d" cy="%d" rx="110" ry="17" fill="#000" opacity=".45" filter="url(#b6)"/>' % (HX, HB + 4))
o('<path d="M %d %d C %d %d %d %d %d %d C %d %d %d %d %d %d Z" fill="#0d0a08"/>' % (
    HX - 104, HB - 6, HX - 92, HB - 24, HX + 92, HB - 24, HX + 104, HB - 6, HX + 70, HB + 6, HX - 70, HB + 6, HX - 104, HB - 6))
o('<path d="M %d %d C %d %d %d %d %d %d C %d %d %d %d %d %d C %d %d %d %d %d %d Z" fill="#110d0a"/>' % (
    HX - 54, HB - 18, HX - 60, HB - 70, HX - 30, HB - 86, HX, HB - 76, HX + 30, HB - 88, HX + 60, HB - 70, HX + 54, HB - 18, HX + 20, HB - 12, HX - 20, HB - 12, HX - 54, HB - 18))
o('<path d="M %d %d C %d %d %d %d %d %d" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="3"/>' % (HX - 8, HB - 78, HX - 4, HB - 60, HX + 4, HB - 60, HX + 8, HB - 80))
o('<path d="M %d %d C %d %d %d %d %d %d L %d %d C %d %d %d %d %d %d Z" fill="#3a2414"/>' % (
    HX - 56, HB - 30, HX - 20, HB - 22, HX + 20, HB - 22, HX + 56, HB - 30, HX + 55, HB - 18, HX + 20, HB - 10, HX - 20, HB - 10, HX - 55, HB - 18))
o('<path d="M %d %d C %d %d %d %d %d %d" fill="none" stroke="#e08c3c" stroke-opacity=".55" stroke-width="2"/>' % (HX + 30, HB - 88, HX + 60, HB - 70, HX + 56, HB - 40, HX + 54, HB - 20))
o('<path d="M %d %d C %d %d %d %d %d %d" fill="none" stroke="#e08c3c" stroke-opacity=".5" stroke-width="2"/>' % (HX + 40, HB - 18, HX + 80, HB - 16, HX + 100, HB - 12, HX + 104, HB - 6))

# ---------- ПЕПЕЛЬНИЦА, СИГАРА И ДЫМ ДЯДИ ВИННИ ----------
AX, AB = 1560, SILL + 14
o('<ellipse cx="%d" cy="%d" rx="46" ry="11" fill="#1a1d26" stroke="#7e8aa6" stroke-opacity=".35"/>' % (AX, AB - 6))
o('<path d="M %d %d L %d %d L %d %d L %d %d Z" fill="#11131a"/>' % (AX - 46, AB - 6, AX + 46, AB - 6, AX + 40, AB + 2, AX - 40, AB + 2))
o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#4a2b16" stroke-width="9" stroke-linecap="round"/>' % (AX - 30, AB - 9, AX + 22, AB - 20))
o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#6b3f1f" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>' % (AX - 26, AB - 12, AX + 18, AB - 22))
o('<rect x="%d" y="%d" width="10" height="9" fill="#b07a3c" transform="rotate(-12 %d %d)"/>' % (AX - 12, AB - 17, AX - 7, AB - 13))
ex_, ey_ = AX + 26, AB - 21
o('<circle cx="%d" cy="%d" r="22" fill="url(#ember)"/>' % (ex_, ey_))
o('<circle cx="%d" cy="%d" r="4.2" fill="#ffb05a"/>' % (ex_, ey_))
sm = random.Random(12)
for k in range(5):
    x, y = ex_, ey_ - 4
    d = 'M %.1f %.1f' % (x, y)
    amp = 18 + k * 9
    for j in range(1, 16):
        y2 = ey_ - 4 - j * (34 + k * 2)
        x2 = ex_ + math.sin(j * .7 + k) * amp * (j / 9) + j * (3 + k)
        d += ' Q %.1f %.1f %.1f %.1f' % ((x + x2) / 2 + sm.uniform(-14, 14), (y + y2) / 2, x2, y2)
        x, y = x2, y2
    o('<path d="%s" fill="none" stroke="#e6ebf5" stroke-opacity="%.2f" stroke-width="%.1f" stroke-linecap="round" filter="url(#smoke)"/>' % (d, .26 - k * .035, 6 - k * .6))

# ---------- ОБЩИЙ СВЕТ И ЗЕРНО ----------
o('<rect width="%d" height="%d" fill="url(#lamp)"/>' % (W, H))
o('<rect width="%d" height="%d" fill="url(#vig)"/>' % (W, H))
o('<rect width="%d" height="%d" filter="url(#grain)" opacity=".5"/>' % (W, H))
o('</g></svg>')

open(OUT, 'w', encoding='utf-8').write('\n'.join(out))
print('ok', sum(len(x) for x in out))
