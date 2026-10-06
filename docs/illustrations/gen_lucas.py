# Генератор иллюстрации «Лукас — день, улица Нью-Йорка» (SVG, 1600x900).
# Нуарная «чернильная» стилистика в тон обложке: тёплая бумага + сепия-графит.
import random, math

W, H = 1600, 900
VPX, VPY = 860, 430          # точка схода / линия горизонта
F = 800                       # фокусное
EYE = 170                     # высота глаз
random.seed(44)

def P(X, Y, z):
    return (VPX + X * F / z, VPY - (Y - EYE) * F / z)

def pts(*ps):
    return ' '.join('%.1f,%.1f' % p for p in ps)

def mix(c1, c2, t):
    t = max(0.0, min(1.0, t))
    a = [int(c1[i:i+2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i+2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

HAZE = '#d8d1c3'
def fog(col, z, k=3200):
    return mix(col, HAZE, 1 - math.exp(-z / k))

out = []
o = out.append

o('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice">' % (W, H))
o('''<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bdb5a6"/><stop offset=".55" stop-color="#d9d2c4"/><stop offset="1" stop-color="#e6e0d3"/>
  </linearGradient>
  <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#cfc8ba"/><stop offset=".18" stop-color="#8e877b"/><stop offset=".6" stop-color="#4a453e"/><stop offset="1" stop-color="#2a2723"/>
  </linearGradient>
  <linearGradient id="walk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c9c2b4"/><stop offset=".3" stop-color="#7d776c"/><stop offset="1" stop-color="#3b3732"/>
  </linearGradient>
  <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f2ede3" stop-opacity=".75"/><stop offset="1" stop-color="#f2ede3" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="glow" cx="%.0f" cy="%.0f" r="520" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#f4efe5" stop-opacity=".85"/><stop offset="1" stop-color="#f4efe5" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="hazeband" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e2dccf" stop-opacity="0"/><stop offset=".62" stop-color="#e2dccf" stop-opacity=".38"/><stop offset="1" stop-color="#e2dccf" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="vig" cx=".5" cy=".45" r=".75">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#14110d" stop-opacity=".55"/>
  </radialGradient>
  <filter id="ink" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
    <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 .1  0 0 0 0 .09  0 0 0 0 .07  0 0 0 .55 -.18"/>
  </filter>
  <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="blur6" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="6"/></filter>
</defs>''' % (VPX, VPY - 40))

# --- небо и свечение у горизонта
o('<clipPath id="frame"><rect width="%d" height="%d"/></clipPath><g clip-path="url(#frame)">' % (W, H))
o('<rect width="%d" height="%d" fill="url(#sky)"/>' % (W, H))
o('<rect width="%d" height="%d" fill="url(#glow)"/>' % (W, H))

# --- дальний силуэт Манхэттена в дымке (с Эмпайр-стейт)
def skyline(x0, x1, base, hmin, hmax, col, op, seed):
    rnd = random.Random(seed)
    x = x0
    d = ['M %.1f %.1f' % (x0, base)]
    while x < x1:
        w = rnd.uniform(14, 40)
        h = rnd.uniform(hmin, hmax)
        d.append('L %.1f %.1f L %.1f %.1f' % (x, base - h, x + w, base - h))
        x += w
    d.append('L %.1f %.1f Z' % (x1, base))
    o('<path d="%s" fill="%s" opacity="%s"/>' % (' '.join(d), col, op))

skyline(640, 1100, VPY + 6, 20, 70, '#b9b1a2', '.55', 1)
# Эмпайр-стейт — ступенчатый силуэт со шпилем
ex, eb = 905, VPY + 6
es = [(26, 120), (19, 165), (13, 196), (8, 214), (4, 226), (1.2, 262)]   # (полуширина, высота ступени)
left_pts, prev = [], 0
for hw, h in es:
    left_pts += [(ex - hw, eb - prev), (ex - hw, eb - h)]
    prev = h
right_pts = [(2 * ex - x, y) for x, y in reversed(left_pts)]
d = 'M ' + ' L '.join('%.1f %.1f' % p for p in left_pts + right_pts) + ' Z'
o('<path d="%s" fill="#aaa192" opacity=".75"/>' % d)
skyline(700, 1040, VPY + 6, 10, 46, '#a59d8e', '.6', 2)

# --- плоскость земли: дорога и тротуары
ZN, ZF = 120, 40000
LF, LC, RC, RF = -300, -90, 640, 860     # левый фасад, левый бордюр, правый бордюр, правый фасад
o('<polygon points="%s" fill="url(#walk)"/>' % pts(P(LF, 0, ZN), P(LC, 0, ZN), P(LC, 0, ZF), P(LF, 0, ZF)))
o('<polygon points="%s" fill="url(#walk)"/>' % pts(P(RC, 0, ZN), P(RF, 0, ZN), P(RF, 0, ZF), P(RC, 0, ZF)))
o('<polygon points="%s" fill="url(#road)"/>' % pts(P(LC, 0, ZN), P(RC, 0, ZN), P(RC, 0, ZF), P(LC, 0, ZF)))
# бордюры
for X, s in ((LC, 1), (RC, -1)):
    o('<polygon points="%s" fill="#d6cfc1" opacity=".55"/>' % pts(P(X, 14, ZN), P(X + s * 18, 14, ZN), P(X + s * 18, 14, ZF), P(X, 14, ZF)))
# мокрый асфальт: отражение неба полосой к точке схода
o('<polygon points="%s" fill="url(#sheen)" opacity=".55" filter="url(#soft)"/>' % pts(P(120, 0, ZN), P(420, 0, ZN), P(300, 0, ZF), P(240, 0, ZF)))
# разметка
z = 260
while z < 9000:
    a, b = z, z * 1.18
    o('<polygon points="%s" fill="#e4ddcf" opacity="%.2f"/>' % (pts(P(262, 0, a), P(278, 0, a), P(278, 0, b), P(262, 0, b)), 0.5 * math.exp(-z / 6000)))
    z *= 1.45
# швы тротуарной плитки (левый тротуар)
z = 160
while z < 6000:
    o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#2b2824" stroke-opacity="%.2f" stroke-width="1"/>' % (*P(LF, 0, z), *P(LC, 0, z), 0.35 * math.exp(-z / 3000)))
    z *= 1.22

# --- здания
def row(side, zstart, zend, hmin, hmax, seed):
    rnd = random.Random(seed)
    segs = []
    z = zstart
    while z < zend:
        w = rnd.uniform(420, 1000)
        segs.append((z, z + w, rnd.uniform(hmin, hmax), rnd.random()))
        z += w
    return segs

left = row('L', 130, 9000, 1700, 4400, 11)
right = row('R', 130, 9000, 1400, 3300, 12)
# дом под водонапорной башней — пониже, чтобы башня попала в кадр
right = [(zs, ze, (1150 if 2300 < zs < 3600 else h), r) for zs, ze, h, r in right]

def facade_color(z, base):
    return fog(base, z)

def building(side, zs, ze, h, r, items):
    Xf = LF if side == 'L' else RF
    back = Xf - 4000 if side == 'L' else Xf + 4000
    zm = (zs + ze) / 2
    base = '#3a352f' if side == 'L' else '#4a443c'
    col = fog(base, zm)
    frontc = fog('#5d564c' if side == 'L' else '#2f2b26', zs)
    g = []
    # торец к зрителю (виден над более низким соседом)
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, 0, zs), P(Xf, h, zs), P(back, h, zs), P(back, 0, zs)), frontc))
    # фасад вдоль улицы
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, 0, zs), P(Xf, h, zs), P(Xf, h, ze), P(Xf, 0, ze)), col))
    # карниз
    s = 1 if side == 'L' else -1
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, h - 70, zs), P(Xf + s * 45, h - 70, zs), P(Xf + s * 45, h - 70, ze), P(Xf, h - 70, ze)), fog('#1e1b17', zm)))
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf + s * 45, h - 70, zs), P(Xf + s * 45, h, zs), P(Xf + s * 45, h, ze), P(Xf + s * 45, h - 70, ze)), fog('#26221d', zm)))
    # окна
    floor_h = 330
    cols = max(2, int((ze - zs) / 260))
    cw = (ze - zs) / cols
    wincol = fog('#1d1a17', zm, 3600)
    litcol = fog('#9a9283', zm, 3600)
    Y = 420
    fl = 0
    while Y + 190 < h - 120:
        for c in range(cols):
            a = zs + c * cw + cw * 0.22
            b = zs + c * cw + cw * 0.78
            if b - a < 30:
                continue
            fill = litcol if random.random() < 0.12 else wincol
            g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, Y, a), P(Xf, Y + 190, a), P(Xf, Y + 190, b), P(Xf, Y, b)), fill))
            # отлив под окном
            g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, Y - 18, a - 15), P(Xf, Y, a - 15), P(Xf, Y, b + 15), P(Xf, Y - 18, b + 15)), fog('#6d665a', zm)))
        Y += floor_h
        fl += 1
    # кладка: горизонтальные ряды в перспективе (только у ближних домов)
    if zs < 2200:
        step = 46 if zs < 900 else 92
        Yc = 360
        while Yc < h - 80:
            g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-opacity=".28" stroke-width="%.2f"/>' % (*P(Xf, Yc, zs), *P(Xf, Yc, ze), fog('#1b1814', zm), max(.5, 400 / zm)))
            Yc += step
    # пилястры между окнами
    for c in range(cols + 1):
        zz = zs + c * cw
        g.append('<polygon points="%s" fill="%s" opacity=".55"/>' % (pts(P(Xf, 340, zz - 18), P(Xf, h - 70, zz - 18), P(Xf, h - 70, zz + 18), P(Xf, 340, zz + 18)), fog('#6a6357' if side == 'L' else '#5a544a', zm)))
    # междуэтажный пояс над первым этажом
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, 330, zs), P(Xf, 372, zs), P(Xf, 372, ze), P(Xf, 330, ze)), fog('#6f685c', zm)))
    # витрина первого этажа: стёкла с переплётом, блик, дверь
    g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, 40, zs + 60), P(Xf, 310, zs + 60), P(Xf, 310, ze - 60), P(Xf, 40, ze - 60)), fog('#25221e', zm)))
    npan = max(2, int((ze - zs) / 180))
    pw = (ze - zs - 120) / npan
    for k in range(npan):
        a0 = zs + 60 + k * pw
        if k == npan // 2 and zs < 3000:
            g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, 0, a0 + pw * .2), P(Xf, 250, a0 + pw * .2), P(Xf, 250, a0 + pw * .8), P(Xf, 0, a0 + pw * .8)), fog('#0f0d0b', zm)))
            continue
        g.append('<polygon points="%s" fill="%s" opacity="%.2f"/>' % (pts(P(Xf, 60, a0 + pw * .2), P(Xf, 300, a0 + pw * .45), P(Xf, 300, a0 + pw * .55), P(Xf, 60, a0 + pw * .3)), fog('#b9b2a4', zm), .12 if zs < 900 else .28))
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (*P(Xf, 40, a0), *P(Xf, 310, a0), fog('#3a352e', zm), max(.6, 900 / zm)))
    g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (*P(Xf, 200, zs + 60), *P(Xf, 200, ze - 60), fog('#3a352e', zm), max(.5, 600 / zm)))
    g.append('<polygon points="%s" fill="%s" opacity=".5"/>' % (pts(P(Xf, 330, zs + 40), P(Xf + s * 120, 380, zs + 40), P(Xf + s * 120, 380, ze - 40), P(Xf, 330, ze - 40)), fog('#151310', zm)))
    # пожарные лестницы (характерно для Нью-Йорка) — на ближних домах
    if zs < 4200 and r > 0.25:
        za, zb = zs + (ze - zs) * 0.25, zs + (ze - zs) * 0.75
        sw = max(0.6, min(5.0, 1100 / zm))
        ink = fog('#16130f', zm, 4200)
        Y = 760
        k = 0
        while Y < h - 400:
            # площадка
            g.append('<polygon points="%s" fill="%s"/>' % (pts(P(Xf, Y, za), P(Xf + s * 110, Y, za), P(Xf + s * 110, Y, zb), P(Xf, Y, zb)), ink))
            # перила
            g.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%.2f"/>' % (pts(P(Xf, Y + 95, za), P(Xf + s * 110, Y + 95, za), P(Xf + s * 110, Y + 95, zb), P(Xf, Y + 95, zb)), ink, sw))
            for t in [i / 6 for i in range(7)]:
                zz = za + (zb - za) * t
                g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (*P(Xf + s * 110, Y, zz), *P(Xf + s * 110, Y + 95, zz), ink, sw * 0.6))
            # трап на следующий этаж
            if Y + 330 < h - 400:
                z1, z2 = (za + 40, zb - 40) if k % 2 == 0 else (zb - 40, za + 40)
                g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (*P(Xf + s * 60, Y, z1), *P(Xf + s * 60, Y + 330, z2), ink, sw * 1.2))
            Y += 330
            k += 1
    items.append((zs, ''.join(g)))

items = []
for zs, ze, h, r in left:
    building('L', zs, ze, h, r, items)
for zs, ze, h, r in right:
    building('R', zs, ze, h, r, items)

# водонапорная башня на крыше справа
def water_tower(z, X, Y, items):
    s = F / z
    cx, cy = P(X, Y, z)
    ink = fog('#1b1814', z, 4000)
    legs_h, tank_h, rad = 260 * s, 330 * s, 130 * s
    g = []
    top = cy - legs_h
    for dx in (-0.8, -0.3, 0.3, 0.8):
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (cx + dx * rad * 1.15, cy, cx + dx * rad, top, ink, max(1, 9 * s)))
    g.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%.2f"/>' % (pts((cx - rad * .92, cy - legs_h * .1), (cx + rad * .4, top + legs_h * .2), (cx + rad * .92, cy - legs_h * .1)), ink, max(.8, 5 * s)))
    g.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (cx - rad, top - tank_h, 2 * rad, tank_h, ink))
    for i in range(1, 5):
        yy = top - tank_h * i / 5
        g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (cx - rad, yy, cx + rad, yy, fog('#4a443b', z), max(.6, 3 * s)))
    g.append('<polygon points="%s" fill="%s"/>' % (pts((cx - rad * 1.08, top - tank_h), (cx, top - tank_h - rad * 0.9), (cx + rad * 1.08, top - tank_h)), ink))
    g.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (cx, top - tank_h - rad * 0.9, cx, top - tank_h - rad * 1.3, ink, max(.6, 3 * s)))
    items.append((z - 1, ''.join(g)))

# ставим башню на крышу дома справа с подходящей дальностью
for zs, ze, h, r in right:
    if 2300 < zs < 3600:
        water_tower((zs + ze) / 2, RF + 380, h, items)
        break
for zs, ze, h, r in left:
    if 3200 < zs < 5200:
        water_tower((zs + ze) / 2, LF - 420, h, items)
        break

# фонари на левом тротуаре
def lamp(z, items):
    s = F / z
    x0, y0 = P(LC - 30, 0, z)
    x1, y1 = P(LC - 30, 980, z)
    x2, y2 = P(LC + 140, 960, z)
    ink = fog('#15120f', z, 4000)
    g = '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.2f"/>' % (x0, y0, x1, y1, ink, max(1, 16 * s))
    g += '<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f" fill="none" stroke="%s" stroke-width="%.2f"/>' % (x1, y1, x1 + (x2 - x1) * 0.4, y1 - 30 * s, x2, y2, ink, max(.8, 10 * s))
    g += '<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s"/>' % (x2, y2 + 14 * s, 34 * s, 16 * s, ink)
    items.append((z - 0.5, g))
z = 1150
while z < 9000:
    lamp(z, items)
    z *= 1.75

# --- фигуры
def man(x, y, s, col, back=True):
    # силуэт мужчины в длинном пальто и шляпе, вид со спины, в шаге
    return ('<g transform="translate(%.1f %.1f) scale(%.3f)" fill="%s">'
            # ноги в шаге: левая опорная, правая отставлена назад с приподнятой пяткой
            '<path d="M -10 -66 C -11 -44 -12 -22 -13 -6 L -14 -1 L -2 0 L -4 -6 C -3 -24 -1 -46 1 -64 Z"/>'
            '<path d="M 4 -64 C 7 -44 11 -26 14 -12 L 19 -5 L 27 -7 L 21 -14 C 18 -30 15 -48 13 -64 Z"/>'
            # пальто: плечи, талия, расходящиеся полы ниже колен
            '<path d="M -9 -170 C -20 -169 -26 -164 -27 -154 C -28 -136 -26 -120 -24 -104 C -26 -90 -31 -74 -35 -58 C -22 -52 -8 -55 0 -60 C 8 -54 24 -52 34 -57 C 30 -74 26 -90 24 -104 C 26 -120 28 -136 27 -154 C 26 -164 20 -169 9 -170 Z"/>'
            # шлица сзади
            '<path d="M -1 -104 L 1 -104 L 2 -61 L -2 -61 Z" fill-opacity=".0"/>'
            # руки в рукавах, слегка в движении
            '<path d="M -26 -158 C -32 -138 -34 -118 -32 -98 L -25 -96 C -25 -116 -23 -136 -20 -150 Z"/>'
            '<path d="M 26 -158 C 31 -140 33 -122 33 -104 L 26 -102 C 25 -120 23 -138 20 -150 Z"/>'
            '<ellipse cx="-29" cy="-94" rx="4" ry="5"/><ellipse cx="30" cy="-99" rx="4" ry="5"/>'
            # воротник, шея, голова
            '<path d="M -12 -172 L -8 -164 L 8 -164 L 12 -172 L 6 -177 L -6 -177 Z"/>'
            '<ellipse cx="0" cy="-184" rx="8" ry="9"/>'
            # шляпа-федора
            '<path d="M -17 -189 Q 0 -194 17 -189 Q 19 -186 15 -186 L -15 -186 Q -19 -186 -17 -189 Z"/>'
            '<path d="M -10 -190 C -11 -199 -7 -205 0 -205 C 7 -205 11 -199 10 -190 Z"/>'
            '</g>') % (x, y, s, col)

# дальние прохожие
for X, z in ((-200, 2600), (720, 3400), (-160, 5200), (760, 1900)):
    sx, sy = P(X, 0, z)
    items.append((z - 0.2, man(sx, sy, F / z * 0.95, fog('#1f1c18', z, 3000))))

items.sort(key=lambda t: -t[0])
o('<g filter="url(#ink)">' + ''.join(g for _, g in items) + '</g>')

# лёгкая дымка у горизонта поверх города

# главный герой — Лукас, ближе к зрителю на левом тротуаре
LZ = 600
lx, ly = P(-175, 0, LZ)
ls = F / LZ * 0.98
# отражение на мокром тротуаре
o('<g opacity=".22" filter="url(#blur6)" transform="translate(0 %.1f) scale(1 -1) translate(0 %.1f)">%s</g>' % (ly, -ly, man(lx, ly, ls, '#14110d')))
o('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="#14110d" opacity=".35" filter="url(#blur6)"/>' % (lx + 6, ly + 2, 40 * ls, 6 * ls))
o('<g filter="url(#ink)">' + man(lx, ly, ls, '#16130f') + '</g>')

# мазок кистью по левому краю (как на обложке)

o('<rect width="%d" height="%d" fill="url(#vig)"/>' % (W, H))
o('<rect width="%d" height="%d" filter="url(#grain)" opacity=".9"/>' % (W, H))
o('</g></svg>')

open(r'D:\RonnyProject\Roni-Site\assets\img\world-lucas.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('ok', sum(len(x) for x in out))
