from PIL import Image
import colorsys, math
import os
SHEET = os.path.join(os.path.dirname(__file__), 'sheet.png')
_im = Image.open(SHEET).convert('RGBA')
CELLS = []
for r in range(6):
    for c in range(6):
        cell = _im.crop((c*32, r*32, c*32+32, r*32+32))
        if cell.split()[3].getbbox(): CELLS.append(cell)
def px(i):
    p = CELLS[i].load(); return {(x, y): p[x, y][:3] for y in range(32) for x in range(32) if p[x, y][3] >= 128}
# parts (same ids as src/core/pixel/archetypes.ts P)
P = dict(NONE=0, BODY=1, BELLY=2, WING=3, TAIL=4, HEAD=5, CROWN=6, CREST=7, BEAK=8, LEG=9, EYE=10, BIB=11, MASK=12, CHEEK=13, WINGBAR=14, FARWING=15, NAPE=16)
PN = {v: k for k, v in P.items()}
CH = {0: '.', 1: 'B', 2: 'Y', 3: 'W', 4: 'T', 5: 'H', 6: 'C', 7: 'X', 8: 'K', 9: 'L', 10: 'E', 11: 'I', 12: 'M', 13: 'Q', 14: 'R', 15: 'F', 16: 'N'}
CHR = {v: k for k, v in CH.items()}
def srgb2lin(c):
    c = c / 255; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lab(rgb):
    r, g, b = (srgb2lin(v) for v in rgb)
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(X), f(Y), f(Z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
PARTCOL = {0: (0, 0, 0), 1: (140, 100, 60), 2: (240, 220, 180), 3: (90, 70, 50), 4: (60, 40, 30), 5: (200, 150, 100), 6: (230, 60, 60), 7: (255, 0, 255), 8: (255, 200, 0), 9: (255, 128, 0), 10: (0, 0, 0), 11: (20, 20, 200), 12: (0, 160, 160), 13: (255, 255, 255), 14: (120, 255, 120), 15: (50, 40, 30), 16: (160, 60, 200)}
def show(labels, path, scale=10):
    im = Image.new('RGB', (32, 32), (24, 24, 30)); p = im.load()
    for (x, y), v in labels.items(): p[x, y] = PARTCOL[v]
    im.resize((32 * scale, 32 * scale), Image.NEAREST).save(path)
