"""
Draws the guide covers and diagrams as SVG (public/guides/img/*.svg).
Run: python3 scripts/guide-art.py   (then scripts/guide-art-png.mjs renders the PNGs for social cards)

One visual language for every picture: dark stage, a lime glow, a warm
"camera picture" scene, and simple phone / laptop / meeting shapes.
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'guides', 'img')
LIME = '#dff25a'
INK = '#161a04'
W, H = 1200, 630
FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"


def defs(glow_x=0.75, glow_y=0.15):
    return f'''<defs>
  <radialGradient id="glow" cx="{glow_x}" cy="{glow_y}" r="0.75">
    <stop offset="0" stop-color="{LIME}" stop-opacity="0.22"/>
    <stop offset="0.45" stop-color="{LIME}" stop-opacity="0.05"/>
    <stop offset="1" stop-color="{LIME}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="room" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3a3046"/><stop offset="0.7" stop-color="#4f4150"/><stop offset="0.7" stop-color="#2a2220"/><stop offset="1" stop-color="#231c1a"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.55"/></filter>
  <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#ffffff" fill-opacity="0.05"/></pattern>
  <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="{LIME}"/></marker>
</defs>'''


def stage(body, glow=(0.75, 0.15)):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}">
{defs(*glow)}
<rect width="{W}" height="{H}" fill="#0d1016"/>
<rect width="{W}" height="{H}" fill="url(#dots)"/>
<rect width="{W}" height="{H}" fill="url(#glow)"/>
{body}
</svg>'''


def scene(x, y, w, h, r=0, uid='s', blurry=False):
    """The warm room the camera is looking at: bokeh lights, a lamp and a plant."""
    clip = f'clip{uid}'
    s = min(w, h)
    lights = [(0.22, 0.28, 0.16, '#ffc478'), (0.68, 0.2, 0.13, '#aac8ff'), (0.55, 0.55, 0.18, '#ffaa5a'), (0.86, 0.62, 0.11, '#96d28c'), (0.1, 0.6, 0.1, '#ffc478')]
    dots = ''.join(f'<circle cx="{x + w * cx:.1f}" cy="{y + h * cy:.1f}" r="{s * rr:.1f}" fill="{c}" fill-opacity="0.55"/>' for cx, cy, rr, c in lights)
    sharp = '' if blurry else ''
    return f'''<clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath>
<g clip-path="url(#{clip})">
  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#room)"/>
  <g filter="url(#soft)">{dots}</g>
  <g{' filter="url(#blur)"' if blurry else ''}>
    <rect x="{x + w * 0.12:.1f}" y="{y + h * 0.56:.1f}" width="{w * 0.24:.1f}" height="{h * 0.16:.1f}" rx="{s * 0.02:.1f}" fill="#e2d6c4"/>
    <rect x="{x + w * 0.14:.1f}" y="{y + h * 0.5:.1f}" width="{w * 0.2:.1f}" height="{h * 0.08:.1f}" rx="{s * 0.02:.1f}" fill="#f5ecdf"/>
    <ellipse cx="{x + w * 0.8:.1f}" cy="{y + h * 0.52:.1f}" rx="{w * 0.08:.1f}" ry="{h * 0.17:.1f}" fill="#3b7444"/>
    <rect x="{x + w * 0.78:.1f}" y="{y + h * 0.6:.1f}" width="{w * 0.04:.1f}" height="{h * 0.1:.1f}" fill="#7a503a"/>
  </g>
</g>{sharp}'''


def phone(x, y, w, kind='island', screen=None, uid='p', live=True, label=None):
    h = w * 2.05
    r = w * 0.16
    pad = w * 0.045
    sx, sy, sw, sh = x + pad, y + pad, w - 2 * pad, h - 2 * pad
    inner = screen(sx, sy, sw, sh) if screen else scene(sx, sy, sw, sh, r * 0.78, uid)
    if kind == 'island':
        notch = f'<rect x="{x + w / 2 - w * 0.16:.1f}" y="{sy + w * 0.05:.1f}" width="{w * 0.32:.1f}" height="{w * 0.075:.1f}" rx="{w * 0.04:.1f}" fill="#05060a"/>'
    else:
        notch = f'<circle cx="{x + w / 2:.1f}" cy="{sy + w * 0.09:.1f}" r="{w * 0.035:.1f}" fill="#05060a"/>'
    pill = ''
    if live:
        pw = w * 0.62
        pill = f'''<g><rect x="{x + w / 2 - pw / 2:.1f}" y="{sy + w * 0.2:.1f}" width="{pw:.1f}" height="{w * 0.12:.1f}" rx="{w * 0.06:.1f}" fill="#0c0e12" fill-opacity="0.72"/>
<circle cx="{x + w / 2 - pw / 2 + w * 0.08:.1f}" cy="{sy + w * 0.26:.1f}" r="{w * 0.022:.1f}" fill="#ff4b63"/>
<text x="{x + w / 2 - pw / 2 + w * 0.13:.1f}" y="{sy + w * 0.283:.1f}" font-size="{w * 0.062:.1f}" font-weight="650" fill="#f4f6f8">{label or 'Live on your laptop'}</text></g>'''
    return f'''<g filter="url(#shadow)">
  <rect x="{x}" y="{y}" width="{w}" height="{h:.1f}" rx="{r:.1f}" fill="#1d222c" stroke="#2c3240" stroke-width="2"/>
  {inner}
  {notch}
  {pill}
</g>'''


def stand(cx, top, w):
    return f'''<g stroke="#5d6b7e" stroke-width="7" stroke-linecap="round" fill="none">
  <path d="M{cx} {top} L{cx} {top + w * 0.55}"/>
  <path d="M{cx} {top + w * 0.5} L{cx - w * 0.42} {top + w * 1.05}"/>
  <path d="M{cx} {top + w * 0.5} L{cx + w * 0.42} {top + w * 1.05}"/>
  <path d="M{cx} {top + w * 0.5} L{cx} {top + w * 1.08}"/>
</g>
<rect x="{cx - w * 0.36}" y="{top - 12}" width="{w * 0.72}" height="16" rx="8" fill="#5d6b7e"/>'''


def laptop(x, y, w, screen):
    h = w * 0.62
    bezel = w * 0.03
    return f'''<g filter="url(#shadow)">
  <rect x="{x}" y="{y}" width="{w}" height="{h:.1f}" rx="{w * 0.03:.1f}" fill="#1a1e27" stroke="#2c3240" stroke-width="2"/>
  {screen(x + bezel, y + bezel * 1.4, w - 2 * bezel, h - bezel * 2.4)}
  <circle cx="{x + w / 2:.1f}" cy="{y + bezel * 0.72:.1f}" r="{w * 0.006:.1f}" fill="#3a4150"/>
  <path d="M{x - w * 0.07:.1f} {y + h + 4:.1f} L{x + w * 1.07:.1f} {y + h + 4:.1f} L{x + w * 1.0:.1f} {y + h + w * 0.05:.1f} L{x:.1f} {y + h + w * 0.05:.1f} Z" fill="#2a303c"/>
</g>'''


def tile_label(x, y, text, size=15):
    w = len(text) * size * 0.56 + size * 2.4
    return f'''<rect x="{x}" y="{y}" width="{w:.1f}" height="{size * 1.9:.1f}" rx="{size * 0.95:.1f}" fill="#0c0e12" fill-opacity="0.78"/>
<circle cx="{x + size * 0.95:.1f}" cy="{y + size * 0.95:.1f}" r="{size * 0.28:.1f}" fill="#ff4b63"/>
<text x="{x + size * 1.55:.1f}" y="{y + size * 1.3:.1f}" font-size="{size}" font-weight="650" fill="#f4f6f8">{text}</text>'''


def camera_menu(x, y, w, size=15):
    return f'''<g filter="url(#shadow)">
  <rect x="{x}" y="{y}" width="{w}" height="{size * 7.2:.1f}" rx="{size * 0.9:.1f}" fill="#151922" stroke="#2c3240"/>
  <text x="{x + size}" y="{y + size * 1.6:.1f}" font-size="{size * 0.72:.1f}" font-weight="700" letter-spacing="1.5" fill="#a7b0bd">CAMERA</text>
  <text x="{x + size}" y="{y + size * 3.45:.1f}" font-size="{size}" fill="#f4f6f8">Built-in camera</text>
  <rect x="{x + size * 0.5:.1f}" y="{y + size * 4.35:.1f}" width="{w - size:.1f}" height="{size * 2.3:.1f}" rx="{size * 0.6:.1f}" fill="{LIME}" fill-opacity="0.12" stroke="{LIME}" stroke-opacity="0.6"/>
  <text x="{x + size}" y="{y + size * 5.85:.1f}" font-size="{size}" font-weight="700" fill="{LIME}">PhoneCam</text>
  <path d="M{x + w - size * 2.1:.1f} {y + size * 5.45:.1f} l{size * 0.35:.1f} {size * 0.35:.1f} l{size * 0.7:.1f} -{size * 0.75:.1f}" stroke="{LIME}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</g>'''


def qr(x, y, s):
    cells = 21
    c = s / cells
    out = [f'<rect x="{x - c}" y="{y - c}" width="{s + 2 * c}" height="{s + 2 * c}" rx="{c * 1.5}" fill="#fff"/>']
    import random
    rnd = random.Random(7)
    for i in range(cells):
        for j in range(cells):
            finder = (i < 7 and j < 7) or (i < 7 and j >= cells - 7) or (i >= cells - 7 and j < 7)
            if finder:
                continue
            if rnd.random() < 0.45:
                out.append(f'<rect x="{x + j * c:.1f}" y="{y + i * c:.1f}" width="{c:.1f}" height="{c:.1f}" fill="#111"/>')
    for fx, fy in [(0, 0), (cells - 7, 0), (0, cells - 7)]:
        out.append(f'<rect x="{x + fx * c:.1f}" y="{y + fy * c:.1f}" width="{7 * c:.1f}" height="{7 * c:.1f}" fill="#111"/>')
        out.append(f'<rect x="{x + (fx + 1) * c:.1f}" y="{y + (fy + 1) * c:.1f}" width="{5 * c:.1f}" height="{5 * c:.1f}" fill="#fff"/>')
        out.append(f'<rect x="{x + (fx + 2) * c:.1f}" y="{y + (fy + 2) * c:.1f}" width="{3 * c:.1f}" height="{3 * c:.1f}" fill="#111"/>')
    return ''.join(out)


def chip(x, y, text, accent=False, size=20):
    w = len(text) * size * 0.56 + size * 1.6
    fill = LIME if accent else '#151922'
    color = INK if accent else '#f4f6f8'
    stroke = 'none' if accent else '#2c3240'
    return f'<g><rect x="{x}" y="{y}" width="{w:.1f}" height="{size * 2:.1f}" rx="{size:.1f}" fill="{fill}" stroke="{stroke}"/><text x="{x + size * 0.8:.1f}" y="{y + size * 1.36:.1f}" font-size="{size}" font-weight="700" fill="{color}">{text}</text></g>'


def flow_arrow(x1, y1, x2, y2, bend=0):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - bend
    return f'<path d="M{x1} {y1} Q{mx} {my} {x2} {y2}" stroke="{LIME}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" fill="none" marker-end="url(#arrow)"/>'


def meeting_screen(highlight='phone', blur=False):
    def draw(x, y, w, h):
        g = w * 0.02
        big_w, big_h = w * 0.64, h - 2 * g
        side_w = w - big_w - 3 * g
        side_h = (h - 3 * g) / 2
        tiles = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#0f1218"/>'
        tiles += scene(x + g, y + g, big_w, big_h, w * 0.015, uid=f'm{int(x)}{int(y)}', blurry=blur)
        tiles += tile_label(x + g * 2, y + big_h - g * 1.6, 'You · PhoneCam' if highlight == 'phone' else 'You · Built-in camera', size=w * 0.022)
        for k, initials in enumerate(['AK', 'JS']):
            ty = y + g + k * (side_h + g)
            tiles += f'<rect x="{x + 2 * g + big_w:.1f}" y="{ty:.1f}" width="{side_w:.1f}" height="{side_h:.1f}" rx="{w * 0.015:.1f}" fill="#1a1f2b"/>'
            tiles += f'<circle cx="{x + 2 * g + big_w + side_w / 2:.1f}" cy="{ty + side_h / 2:.1f}" r="{side_h * 0.2:.1f}" fill="#2a3142"/>'
            tiles += f'<text x="{x + 2 * g + big_w + side_w / 2:.1f}" y="{ty + side_h / 2 + side_h * 0.07:.1f}" text-anchor="middle" font-size="{side_h * 0.17:.1f}" font-weight="700" fill="#a7b0bd">{initials}</text>'
        return tiles
    return draw


def write(name, svg):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
        f.write(svg)


# ── Covers ──────────────────────────────────────────────────────────────

def cover_webcam():
    webcam = f'''<g filter="url(#shadow)">
  <rect x="150" y="235" width="250" height="120" rx="40" fill="#20252f" stroke="#2c3240" stroke-width="2"/>
  <circle cx="275" cy="295" r="40" fill="#0a0c10" stroke="#3a4150" stroke-width="6"/>
  <circle cx="275" cy="295" r="16" fill="#1d2a3e"/><circle cx="267" cy="287" r="5" fill="#5d6b7e"/>
  <path d="M240 355 L310 355 L300 395 L250 395 Z" fill="#20252f"/>
  <rect x="200" y="395" width="150" height="18" rx="9" fill="#20252f"/>
</g>
{chip(170, 450, 'New webcam  $60–$100', size=20)}
<path d="M168 470 L420 470" stroke="#ff4b63" stroke-width="4" stroke-linecap="round"/>'''
    right = phone(735, 100, 190, uid='w') + stand(830, 500, 120)
    body = f'''{webcam}
<text x="560" y="335" text-anchor="middle" font-size="44" font-weight="800" fill="#5d6b7e">vs</text>
{right}
{chip(920, 170, 'Your phone', accent=True)}
{chip(960, 470, '$3 stand')}'''
    write('webcam', stage(body, (0.78, 0.25)))


def cover_use_phone():
    body = f'''{phone(130, 120, 175, uid='u')}
{stand(217, 498, 110)}
{flow_arrow(345, 300, 560, 270, bend=70)}
{chip(372, 160, 'Scan, tap Start', accent=True)}
{laptop(600, 150, 470, meeting_screen())}
{camera_menu(860, 330, 240, size=16)}'''
    write('use-phone-as-webcam', stage(body, (0.6, 0.2)))


def cover_phone_os(name, kind, browser):
    body = f'''{phone(470, 40, 260, kind=kind, uid=name)}
{chip(140, 200, browser, size=24)}
{chip(140, 270, 'No app to install', accent=True, size=24)}
{chip(140, 340, 'Keep the screen on', size=24)}
{flow_arrow(760, 300, 960, 300, bend=50)}
{laptop(930, 230, 230, meeting_screen())}'''
    write(name, stage(body, (0.5, 0.3)))


def cover_meeting():
    body = f'''{laptop(150, 70, 760, meeting_screen())}
{camera_menu(780, 300, 300, size=20)}
{phone(990, 70, 120, uid='mt', live=False)}'''
    write('meeting-webcam', stage(body, (0.35, 0.15)))


def cover_obs():
    def card(x, y, w, title, sub):
        return f'''<g filter="url(#shadow)"><rect x="{x}" y="{y}" width="{w}" height="120" rx="20" fill="#151922" stroke="#2c3240" stroke-width="2"/>
<text x="{x + 24}" y="{y + 50}" font-size="24" font-weight="750" fill="#f4f6f8">{title}</text>
<text x="{x + 24}" y="{y + 84}" font-size="18" fill="#a7b0bd">{sub}</text></g>'''
    body = f'''{phone(90, 130, 160, uid='o')}
{flow_arrow(275, 300, 365, 300)}
{card(380, 240, 300, 'Browser source', 'The PhoneCam OBS link')}
{flow_arrow(700, 300, 790, 300)}
{card(805, 160, 320, 'Virtual Camera', 'Every app sees a camera')}
{chip(830, 330, 'Zoom app')}{chip(990, 330, 'Teams app')}
{chip(830, 400, 'Streaming')}{chip(990, 400, 'Any app', accent=True)}
<rect x="380" y="380" width="300" height="168" rx="16" fill="#0f1218" stroke="#2c3240"/>
{scene(392, 392, 276, 144, 10, uid='obs')}
{tile_label(404, 500, 'PhoneCam source', size=14)}'''
    write('obs-phone-camera', stage(body, (0.55, 0.2)))


def cover_blurry():
    body = f'''{laptop(110, 150, 520, meeting_screen(highlight='laptop', blur=True))}
<circle cx="370" cy="161" r="16" fill="none" stroke="#ff4b63" stroke-width="4"/>
{chip(260, 85, 'Lid camera: low, small, soft', size=18)}
{flow_arrow(660, 330, 760, 330)}
{phone(800, 90, 190, uid='b')}
{stand(895, 488, 115)}
{chip(1000, 200, 'Sharp', accent=True)}'''
    write('blurry-laptop-webcam', stage(body, (0.8, 0.2)))


def cover_guides():
    body = f'''{laptop(140, 120, 520, meeting_screen())}
{phone(770, 70, 200, uid='g')}
{stand(870, 492, 120)}
{chip(980, 160, 'Guides', accent=True, size=26)}
{chip(980, 240, 'Setup')}{chip(980, 300, 'Meetings')}{chip(980, 360, 'Streaming')}'''
    write('guides', stage(body, (0.7, 0.2)))


def cover_about():
    shield = f'''<g filter="url(#shadow)"><path d="M600 150 L740 205 L740 330 C740 420 670 475 600 500 C530 475 460 420 460 330 L460 205 Z" fill="#151922" stroke="{LIME}" stroke-width="4"/>
<path d="M545 330 l38 38 l78 -86" stroke="{LIME}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>'''
    body = f'''{phone(140, 110, 190, uid='a')}
{flow_arrow(360, 320, 440, 320)}
{shield}
{flow_arrow(760, 320, 840, 320)}
{laptop(860, 220, 260, meeting_screen())}
{chip(470, 535, 'Straight from your phone to your computer', size=18)}'''
    write('about', stage(body, (0.5, 0.25)))


# ── In-article diagram ──────────────────────────────────────────────────

def diagram_eye_level():
    def head(cx, cy):
        return f'<circle cx="{cx}" cy="{cy}" r="46" fill="#2a3142"/><path d="M{cx - 70} {cy + 150} Q{cx} {cy + 40} {cx + 70} {cy + 150}" fill="#2a3142"/>'
    body = f'''<text x="300" y="70" text-anchor="middle" font-size="26" font-weight="750" fill="#f4f6f8">Laptop camera</text>
<text x="900" y="70" text-anchor="middle" font-size="26" font-weight="750" fill="#f4f6f8">Phone on a stand</text>
<line x1="600" y1="40" x2="600" y2="590" stroke="#2c3240" stroke-width="2" stroke-dasharray="6 10"/>
{head(170, 260)}
<path d="M260 470 L470 470 L440 330 L470 330" stroke="#5d6b7e" stroke-width="10" fill="none" stroke-linejoin="round"/>
<circle cx="470" cy="330" r="9" fill="#ff4b63"/>
<path d="M462 334 L222 252" stroke="#ff4b63" stroke-width="4" stroke-dasharray="3 10" stroke-linecap="round"/>
{chip(320, 520, 'Looks up at you', size=18)}
{head(770, 260)}
{stand(1010, 360, 100)}
<rect x="990" y="200" width="40" height="150" rx="8" fill="#1d222c" stroke="#3a4150" stroke-width="3"/>
<circle cx="1010" cy="214" r="6" fill="{LIME}"/>
<path d="M1000 216 L822 254" stroke="{LIME}" stroke-width="4" stroke-dasharray="3 10" stroke-linecap="round"/>
{chip(850, 520, 'Eye level', accent=True, size=18)}'''
    write('diagram-eye-level', stage(body, (0.8, 0.1)))


if __name__ == '__main__':
    cover_webcam()
    cover_use_phone()
    cover_phone_os('iphone-as-webcam', 'island', 'Safari')
    cover_phone_os('android-as-webcam', 'hole', 'Chrome')
    cover_meeting()
    cover_obs()
    cover_blurry()
    cover_guides()
    cover_about()
    diagram_eye_level()
    print('covers written to', os.path.normpath(OUT))
