# Генератор иллюстрации «Оливия — тёмная комната, лунный свет, призрак» (SVG, 1600x900).
import random, math

W, H = 1600, 900
random.seed(13)
out = []
o = out.append

def pts(*ps):
    return ' '.join('%.1f,%.1f' % p for p in ps)

# окно
WX0, WY0, WX1, WY1 = 330, 120, 650, 590     # проём
FLOOR = 640                                   # линия пола у стены

o('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="xMidYMid slice">' % (W, H))
o('''<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0e1422"/><stop offset=".45" stop-color="#0b1020"/><stop offset="1" stop-color="#05070d"/>
  </linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b0f1b"/><stop offset="1" stop-color="#04060a"/>
  </linearGradient>
  <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#16213c"/><stop offset=".6" stop-color="#2a3a62"/><stop offset="1" stop-color="#3a4d7a"/>
  </linearGradient>
  <radialGradient id="moonglow" cx="560" cy="215" r="210" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#e9efff" stop-opacity=".9"/><stop offset=".18" stop-color="#b9c8ef" stop-opacity=".45"/><stop offset="1" stop-color="#8ea2d6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="moon" cx=".42" cy=".4" r=".7">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e6ecfa"/><stop offset="1" stop-color="#c4d0ee"/>
  </radialGradient>
  <linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="%d" y1="%d" x2="1250" y2="880">
    <stop offset="0" stop-color="#b8c8f2" stop-opacity=".30"/><stop offset=".55" stop-color="#9fb2e6" stop-opacity=".12"/><stop offset="1" stop-color="#9fb2e6" stop-opacity=".03"/>
  </linearGradient>
  <linearGradient id="patch" gradientUnits="userSpaceOnUse" x1="760" y1="690" x2="1300" y2="890">
    <stop offset="0" stop-color="#c4d2f6" stop-opacity=".38"/><stop offset="1" stop-color="#c4d2f6" stop-opacity=".10"/>
  </linearGradient>
  <linearGradient id="curtainL" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#080b14"/><stop offset=".35" stop-color="#141c30"/><stop offset=".55" stop-color="#0a0e18"/><stop offset=".8" stop-color="#1b2540"/><stop offset="1" stop-color="#2a375a"/>
  </linearGradient>
  <linearGradient id="curtainR" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="#05070d"/><stop offset=".4" stop-color="#101727"/><stop offset=".6" stop-color="#090d17"/><stop offset=".85" stop-color="#17203a"/><stop offset="1" stop-color="#25324f"/>
  </linearGradient>
  <linearGradient id="ghostFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eef3ff" stop-opacity=".62"/><stop offset=".45" stop-color="#d4def8" stop-opacity=".42"/><stop offset=".75" stop-color="#b9c8ee" stop-opacity=".16"/><stop offset=".92" stop-color="#b9c8ee" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="aura" cx=".5" cy=".38" r=".55">
    <stop offset="0" stop-color="#cfdcff" stop-opacity=".35"/><stop offset="1" stop-color="#cfdcff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vig" cx=".45" cy=".45" r=".8">
    <stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/>
  </radialGradient>
  <filter id="b2" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="b5" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="b14" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="b40" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="wisp" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
    <feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="3" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.4"/>
  </filter>
  <filter id="fur" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
    <feTurbulence type="turbulence" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" stitchTiles="stitch"/>
    <feColorMatrix values="0 0 0 0 .75  0 0 0 0 .8  0 0 0 0 .95  0 0 0 .5 -.2"/>
  </filter>
  <filter id="g40" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="34"/></filter>
  <filter id="g14" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="g2" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="1.6"/></filter>
  <filter id="gwisp" x="-.5" y="-.5" width="2" height="2">
    <feTurbulence type="fractalNoise" baseFrequency=".02 .05" numOctaves="3" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.1"/>
  </filter>
  <filter id="gfur" x="-.5" y="-.5" width="2" height="2">
    <feTurbulence type="turbulence" baseFrequency=".8" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <clipPath id="frame"><rect width="1600" height="900"/></clipPath>
  <clipPath id="pane"><rect x="%d" y="%d" width="%d" height="%d"/></clipPath>
</defs>''' % (WX0, WY0, WX0, WY0, WX1 - WX0, WY1 - WY0))

o('<g clip-path="url(#frame)">')
# стены и пол
o('<rect width="1600" height="900" fill="url(#wall)"/>')
o('<polygon points="%s" fill="url(#floor)"/>' % pts((0, FLOOR + 40), (1600, FLOOR - 10), (1600, 900), (0, 900)))
# плинтус
o('<polyline points="%s" fill="none" stroke="#1b2338" stroke-width="3" opacity=".8"/>' % pts((0, FLOOR + 40), (1600, FLOOR - 10)))
# доски пола (лёгкие линии к точке схода)
for i in range(-6, 22):
    x0 = i * 95
    o('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="900" stroke="#121a2c" stroke-opacity=".55" stroke-width="1.2"/>' % (500 + (x0 - 500) * 0.35, FLOOR + 40 - (x0 * 0.03), x0 * 1.35 - 120))

# --- вид за окном
o('<g clip-path="url(#pane)">')
o('<rect x="%d" y="%d" width="%d" height="%d" fill="url(#night)"/>' % (WX0, WY0, WX1 - WX0, WY1 - WY0))
o('<rect width="1600" height="900" fill="url(#moonglow)"/>')
# звёзды
rnd = random.Random(2)
for _ in range(26):
    x, y = rnd.uniform(WX0, WX1), rnd.uniform(WY0, WY0 + 260)
    o('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#dfe7ff" opacity="%.2f"/>' % (x, y, rnd.uniform(.5, 1.3), rnd.uniform(.25, .7)))
# луна
o('<circle cx="560" cy="215" r="36" fill="url(#moon)"/>')
o('<circle cx="548" cy="206" r="7" fill="#c9d3ee" opacity=".45"/><circle cx="572" cy="226" r="5" fill="#c9d3ee" opacity=".4"/><circle cx="556" cy="231" r="3.5" fill="#c9d3ee" opacity=".35"/>')
# облачко у луны
o('<path d="M 430 262 Q 470 240 520 252 Q 560 236 610 254 Q 640 258 660 270 L 430 275 Z" fill="#45578a" opacity=".55" filter="url(#b5)"/>')
# крыши Нью-Йорка за окном: дальний и ближний ряды, окна, водонапорная башня
def roofs(base, hmin, hmax, col, seed, lit):
    r = random.Random(seed)
    x = WX0 - 10
    while x < WX1 + 10:
        w = r.uniform(30, 80); h = r.uniform(hmin, hmax)
        o('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (x, base - h, w + 1, h + 200, col))
        if lit:
            for yy in range(int(base - h + 10), int(WY1), 14):
                for xx in range(int(x + 6), int(x + w - 6), 11):
                    if r.random() < 0.07:
                        o('<rect x="%d" y="%d" width="4" height="6" fill="#f2c779" opacity="%.2f"/>' % (xx, yy, r.uniform(.45, .9)))
        x += w
roofs(470, 40, 140, '#1c2745', 21, False)
o('<path d="M 560 330 L 563 318 L 566 330 Z" fill="#1c2745"/>')  # шпиль вдали
roofs(520, 20, 90, '#0c1222', 22, True)
# водонапорная башня на ближней крыше
tx, ty = 420, 470
o('<g fill="#080c17" stroke="#080c17">')
for dx in (-16, -6, 6, 16):
    o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke-width="2.4"/>' % (tx + dx * 1.15, ty, tx + dx, ty - 30))
o('<rect x="%d" y="%d" width="40" height="40"/>' % (tx - 20, ty - 70))
o('<polygon points="%s"/>' % pts((tx - 23, ty - 70), (tx, ty - 90), (tx + 23, ty - 70)))
o('</g>')
o('</g>')  # pane

# --- рама окна: переплёт, подоконник
fc = '#060912'
o('<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="%s" stroke-width="16"/>' % (WX0, WY0, WX1 - WX0, WY1 - WY0, fc))
mx, my = (WX0 + WX1) / 2, WY0 + (WY1 - WY0) * 0.46
o('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="11"/>' % (mx, WY0, mx, WY1, fc))
o('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-width="11"/>' % (WX0, my, WX1, my, fc))
# лунный блик на кромках рамы
o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#8ea3d6" stroke-opacity=".35" stroke-width="2"/>' % (WX1 - 8, WY0 + 6, WX1 - 8, WY1 - 6))
o('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="#8ea3d6" stroke-opacity=".3" stroke-width="2"/>' % (mx + 5, WY0 + 6, mx + 5, WY1 - 6))
# подоконник
o('<polygon points="%s" fill="#0d1322"/>' % pts((WX0 - 40, WY1 + 6), (WX1 + 40, WY1 + 6), (WX1 + 58, WY1 + 24), (WX0 - 22, WY1 + 24)))
o('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#7d93c9" stroke-opacity=".45" stroke-width="2"/>' % (WX0 - 40, WY1 + 6, WX1 + 40, WY1 + 6))

# --- шторы
o('<path d="M %d 60 L %d 60 C %d 260 %d 480 %d 700 L %d 720 C %d 500 %d 300 %d 60 Z" fill="url(#curtainL)"/>' % (WX0 - 150, WX0 + 22, WX0 + 10, WX0 - 4, WX0 + 18, WX0 - 160, WX0 - 140, WX0 - 160, WX0 - 150))
o('<path d="M %d 60 L %d 60 C %d 280 %d 470 %d 700 L %d 720 C %d 520 %d 300 %d 60 Z" fill="url(#curtainR)"/>' % (WX1 - 18, WX1 + 150, WX1 + 160, WX1 + 145, WX1 + 160, WX1 - 26, WX1 - 6, WX1 - 20, WX1 - 18))
o('<rect x="%d" y="48" width="%d" height="12" rx="6" fill="#05070d"/>' % (WX0 - 180, WX1 - WX0 + 360))

# --- лунный луч и световое пятно на полу
o('<polygon points="%s" fill="url(#beam)" filter="url(#b14)"/>' % pts((WX0 + 8, WY0 + 8), (WX1 - 8, WY0 + 8), (1330, 890), (720, 890)))
PX = [(760, 690), (1110, 676), (1300, 890), (820, 900)]
o('<polygon points="%s" fill="url(#patch)" filter="url(#b5)"/>' % pts(*PX))
# тени переплёта на пятне
o('<polygon points="%s" fill="#070a12" opacity=".75" filter="url(#b2)"/>' % pts((930, 684), (946, 683), (1076, 896), (1056, 896)))
o('<polygon points="%s" fill="#070a12" opacity=".75" filter="url(#b2)"/>' % pts((784, 775), (1170, 760), (1178, 772), (790, 788)))
# пылинки в луче
rnd = random.Random(8)
for _ in range(90):
    t = rnd.random(); u = rnd.random()
    x = (WX0 + 20) + (720 - WX0) * t + (WX1 - WX0 - 40 + (1330 - 720 - (WX1 - WX0 - 40)) * t) * u
    y = WY0 + 20 + (880 - WY0) * t
    o('<circle cx="%.1f" cy="%.1f" r="%.2f" fill="#e3ebff" opacity="%.2f"/>' % (x, y, rnd.uniform(.6, 1.8), rnd.uniform(.12, .55)))

# --- кресло справа в тени
o('<path d="M 1340 560 C 1330 500 1360 470 1420 468 L 1560 468 C 1610 470 1620 520 1612 560 L 1620 700 L 1330 700 Z" fill="#05070d"/>')
o('<path d="M 1310 600 C 1300 570 1330 556 1360 566 L 1372 700 L 1316 700 Z" fill="#070a12"/>')
o('<path d="M 1340 470 C 1360 466 1400 466 1420 468" stroke="#2b3a62" stroke-opacity=".5" stroke-width="2" fill="none"/>')
# столик с бокалом виски (отсылка к книге)
o('<rect x="1180" y="560" width="110" height="10" fill="#060912"/><rect x="1196" y="570" width="8" height="90" fill="#060912"/><rect x="1266" y="570" width="8" height="90" fill="#060912"/>')
o('<path d="M 1226 528 L 1250 528 L 1247 560 L 1229 560 Z" fill="#9fb2e6" fill-opacity=".12" stroke="#b8c8f2" stroke-opacity=".55" stroke-width="1.4"/>')
o('<path d="M 1229.6 546 L 1246.4 546 L 1247 560 L 1229 560 Z" fill="#c98a3c" opacity=".55"/>')

# --- призрак Оливии: женщина лет пятидесяти, платье ниже колен, кофта, длинные волосы
GX, GY, GS = 990, 812, 1.12   # точка «стоп» и масштаб

def ghost_shapes():
    return '''
    <path d="M -25 -404 C -30 -428 -14 -440 0 -440 C 14 -440 30 -428 25 -404 C 32 -372 38 -330 36 -298 C 30 -290 24 -294 21 -306 C 19 -330 16 -350 12 -362 C 4 -356 -4 -356 -12 -362 C -16 -350 -19 -330 -21 -306 C -24 -294 -30 -290 -36 -298 C -38 -330 -32 -372 -25 -404 Z"/>
    <ellipse cx="0" cy="-392" rx="21" ry="27"/>
    <path d="M -7 -368 L -7 -350 L 7 -350 L 7 -368 Z"/>
    <path d="M -10 -354 C -40 -352 -54 -342 -57 -318 L -60 -214 Q 0 -200 60 -214 L 57 -318 C 54 -342 40 -352 10 -354 Z"/>
    <path d="M -57 -318 C -68 -276 -70 -236 -66 -200 L -52 -198 C -52 -236 -50 -276 -46 -300 Z"/>
    <path d="M 57 -318 C 68 -276 70 -236 66 -200 L 52 -198 C 52 -236 50 -276 46 -300 Z"/>
    <ellipse cx="-59" cy="-192" rx="7" ry="10"/><ellipse cx="59" cy="-192" rx="7" ry="10"/>
    <path d="M -40 -250 C -50 -180 -66 -112 -78 -62 Q 0 -44 78 -62 C 66 -112 50 -180 40 -250 Z"/>
    <path d="M -22 -60 L -20 -24 L -11 -24 L -10 -58 Z" opacity=".5"/><path d="M 10 -58 L 11 -24 L 20 -24 L 22 -60 Z" opacity=".5"/>
    '''

g = 'translate(%d %d) scale(%.2f)' % (GX, GY, GS)
# аура
o('<ellipse cx="%d" cy="%d" rx="130" ry="230" fill="url(#aura)" opacity=".7" filter="url(#b40)"/>' % (GX, GY - 270 * GS))
# мягкое свечение силуэта
o('<g transform="%s" fill="#c8d6fb" opacity=".4" filter="url(#g40)">%s</g>' % (g, ghost_shapes()))
o('<g transform="%s" fill="#dce6ff" opacity=".32" filter="url(#g14)">%s</g>' % (g, ghost_shapes()))
# сам силуэт: молочный, с «дымными» краями, растворяется к ногам
o('<g transform="%s" fill="url(#ghostFill)" filter="url(#gwisp)">%s</g>' % (g, ghost_shapes()))
# лёгкие детали: линия кофты, пояс, складки платья
o('<g transform="%s" fill="none" stroke="#f3f6ff" stroke-linecap="round" filter="url(#g2)">'
  '<path d="M 0 -350 L 0 -214" stroke-opacity=".35" stroke-width="2"/>'
  '<path d="M -38 -250 Q 0 -244 38 -250" stroke-opacity=".3" stroke-width="2"/>'
  '<path d="M -18 -240 C -24 -180 -34 -120 -40 -64" stroke-opacity=".18" stroke-width="2"/>'
  '<path d="M 18 -240 C 24 -180 34 -120 40 -64" stroke-opacity=".18" stroke-width="2"/>'
  '<path d="M -9 -392 Q 0 -386 9 -392" stroke-opacity=".25" stroke-width="1.6"/>'
  '</g>' % g)
# туманный шлейф у пола
o('<ellipse cx="%d" cy="%d" rx="120" ry="18" fill="#c9d6fa" opacity=".18" filter="url(#b14)"/>' % (GX, GY - 8))

# --- кот Конфуций (мейн-кун), сидит спиной к зрителю и смотрит на призрака
CX, CY, CS = 600, 842, 1.25
cat = ('<g transform="translate(%d %d) scale(%.2f)">' % (CX, CY, CS) +
       '<path d="M -58 0 C -70 -40 -62 -84 -34 -104 C -18 -116 10 -118 26 -106 C 46 -84 54 -44 50 0 Z"/>'
       '<path d="M -30 -100 C -36 -118 -26 -128 -12 -128 L 34 -126 C 44 -116 42 -102 30 -98 Z"/>'
       '<path d="M -14 -118 C -24 -142 -10 -166 14 -166 C 38 -166 50 -146 44 -124 C 38 -110 6 -104 -14 -118 Z"/>'
       '<path d="M -4 -156 L -6 -182 L 12 -162 Z"/><path d="M 24 -163 L 36 -186 L 40 -154 Z"/>'
       '<path d="M -6 -182 L -7 -192 M 36 -186 L 38 -196" stroke-width="2.2" fill="none"/>'
       '<path d="M -56 -6 C -100 -2 -124 -16 -118 -38 C -112 -54 -92 -50 -96 -36 C -100 -22 -80 -16 -54 -18 Z"/>'
       '</g>')
o('<g fill="#03050a" stroke="#03050a" filter="url(#fur)">%s</g>' % cat)
# контровой лунный свет по краю кота
o('<g fill="none" stroke="#8fa6dc" stroke-opacity=".55" stroke-width="1.6" filter="url(#gfur)" transform="translate(%d %d) scale(%.2f)">'
  '<path d="M -58 0 C -70 -40 -62 -84 -34 -104"/><path d="M -14 -118 C -24 -142 -10 -166 14 -166"/><path d="M -4 -156 L -6 -182"/><path d="M 50 0 C 54 -44 46 -84 26 -106" stroke-opacity=".25"/>'
  '</g>' % (CX, CY, CS))

o('<rect width="1600" height="900" fill="url(#vig)"/>')
o('<rect width="1600" height="900" filter="url(#grain)" opacity=".55"/>')
o('</g></svg>')

open(r'D:\RonnyProject\Roni-Site\assets\img\world-olivia.svg', 'w', encoding='utf-8').write('\n'.join(out))
print('ok', sum(len(x) for x in out))
