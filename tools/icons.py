# Draws the app icons (home screen / offline app): a red sun behind a black torii on vermilion paper.
import os
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root, 'icons'), exist_ok=True)

def icon(size, pad=0.0):
    S = size * 4                                   # drawn big, then scaled down for smooth edges
    im = Image.new('RGB', (S, S), '#b8342a')
    d = ImageDraw.Draw(im)
    u = S * (1 - 2 * pad) / 100; o = S * pad       # a 100×100 design space inside the safe area
    P = lambda x, y: (o + x * u, o + y * u)
    d.rectangle([0, 0, S, S], fill='#b8342a')
    d.ellipse([*P(22, 12), *P(78, 68)], fill='#f4ecdb')                       # the sun
    ink = '#1c1a17'
    d.polygon([P(12, 36), P(88, 36), P(84, 44), P(16, 44)], fill=ink)         # kasagi, the top beam
    d.rectangle([*P(20, 52), *P(80, 57)], fill=ink)                           # nuki, the tie beam
    d.rectangle([*P(47, 44), *P(53, 52)], fill=ink)                           # the plaque post
    for x in (27, 67):
        d.polygon([P(x, 44), P(x + 6, 44), P(x + 7, 88), P(x - 1, 88)], fill=ink)   # the two pillars
    d.rectangle([*P(8, 88), *P(92, 91)], fill=ink)                            # the ground
    return im.resize((size, size), Image.LANCZOS)

for name, size, pad in [('icon-192.png', 192, 0), ('icon-512.png', 512, 0), ('maskable-512.png', 512, 0.1), ('apple-touch-icon.png', 180, 0)]:
    icon(size, pad).save(os.path.join(root, 'icons', name))
print('icons written')
