import json, os, statistics
from common import *
from bases import BASES
from forms import DRAWN

SHIFT = {'song': 4, 'duck': 4, 'goose': 1, 'gull': 4, 'humm': 4}
BASEDL = {'Y': 4, 'B': 0, 'W': -2, 'F': -7, 'T': -6, 'H': 2, 'C': 4, 'K': 0, 'L': 0, 'E': 0, 'Q': 6, 'M': 0, 'X': 2, 'I': 2}

def auto_dl(lbl, at):
    x, y = at; v = lbl[at]; d = BASEDL.get(v, 0)
    if (x, y - 1) not in lbl: d += 10
    if (x, y + 1) not in lbl and v in 'BYWTF': d -= 8
    if v == 'W' and y % 4 == 0 and x % 2 == 0: d -= 3
    if v == 'T' and x % 2 == 0: d -= 3
    return d

def sheet_dl(name, lbl, ids, refcell):
    # median of each pixel's lightness relative to its part's mean, across all of the group's sprites
    per = {}
    for i in ids:
        pxs = px(i); means = {}
        for k, c in pxs.items():
            if k in lbl: means.setdefault(lbl[k], []).append(lab(c)[0])
        means = {p: sum(v) / len(v) for p, v in means.items()}
        for k, c in pxs.items():
            if k in lbl: per.setdefault(k, []).append(lab(c)[0] - means[lbl[k]])
    return {k: max(-22, min(22, statistics.median(v))) for k, v in per.items()}

forms = {}
def add(name, lbl, dl, zones, shift=0):
    out = {}
    rows = [['.'] * 32 for _ in range(32)]; drows = [['M'] * 32 for _ in range(32)]
    for (x, y), v in lbl.items():
        yy = y + shift
        if 0 <= yy < 32: rows[yy][x] = v; drows[yy][x] = chr(65 + max(0, min(25, round((dl.get((x, y), auto_dl(lbl, (x, y))) + 26) / 2))))
    def sh(pts): return [c for (x, y) in pts for c in (x, y + shift)]
    z = {k: sh(v) for k, v in zones.items() if isinstance(v, list)}
    forms[name] = {'rows': [''.join(r) for r in rows], 'dl': [''.join(r) for r in drows], 'zones': z,
                   'eye': [zones['eye'][0], zones['eye'][1] + shift] if zones.get('eye') else None,
                   'shoulder': [zones['shoulder'][0], zones['shoulder'][1] + shift], 'front': bool(zones.get('front'))}

def edit(lbl, remove='', add=()):
    out = {k: v for k, v in lbl.items() if v not in remove}
    for pts, v in add:
        for p in pts: out[p] = v
    return out
def line(a, b):
    (x0, y0), (x1, y1) = a, b; n = max(abs(x1 - x0), abs(y1 - y0)); return [(round(x0 + (x1 - x0) * t / n), round(y0 + (y1 - y0) * t / n)) for t in range(n + 1)]

# ── sheet outlines ──
for name, (fn, ids) in BASES.items():
    lbl, zones = fn()
    lbl = {k: CH[P[{'B':'BODY','Y':'BELLY','W':'WING','T':'TAIL','H':'HEAD','C':'CROWN','K':'BEAK','L':'LEG','E':'EYE','X':'CREST','I':'BIB','F':'FARWING'}[v]]] for k, v in lbl.items()}
    if name == 'song':
        for p in zones['crest']: lbl.setdefault(p, 'X')
    dl = sheet_dl(name, lbl, ids, None)
    s = SHIFT[name]
    add(name, lbl, dl, zones, s)
    if name == 'song':
        beak = lambda pts: edit(lbl, 'K', [(pts, 'K')])
        add('song-heavy', edit(beak([(23, 11), (24, 11), (25, 11), (23, 12), (24, 12), (25, 12), (26, 12), (23, 13), (24, 13), (25, 13)]), '', [([(4, 23), (4, 24), (5, 24), (3, 24)], 'T')]), dl, zones, s)
        add('song-thin', beak([(23, 11), (23, 12), (24, 12)]), dl, zones, s)
        add('song-long', beak([(23, 11), (24, 11), (23, 12), (24, 12), (25, 12), (26, 12), (23, 13)]), dl, zones, s)
        add('song-curve', beak([(23, 11), (23, 12), (24, 12), (25, 12), (25, 13), (26, 13), (27, 14)]), dl, zones, s)
        tail = line((5, 23), (1, 27)) + line((6, 23), (2, 27)) + line((4, 23), (1, 26))
        add('song-tail', edit(lbl, '', [(tail, 'T')]), dl, zones, s)
        add('song-tail-thin', edit(beak([(23, 11), (23, 12), (24, 12)]), '', [(tail, 'T')]), dl, zones, s)
        add('song-tail-long', edit(beak([(23, 11), (24, 11), (23, 12), (24, 12), (25, 12), (26, 12), (23, 13)]), '', [(tail, 'T')]), dl, zones, s)
        add('song-heavy-tail', edit(beak([(23, 11), (24, 11), (25, 11), (23, 12), (24, 12), (25, 12), (26, 12), (23, 13), (24, 13), (25, 13)]), '', [(tail, 'T')]), dl, zones, s)
        dove = {k: v for k, v in beak([(23, 12), (24, 12)]).items() if not (k[1] == 9 and v == 'C')}
        add('song-dove', edit(dove, '', [(line((5, 23), (2, 26)) + line((6, 23), (3, 26)), 'T')]), dl, zones, s)
    if name == 'duck':
        add('duck-loon', edit(lbl, 'K', [([(24, 13), (25, 13), (26, 13), (27, 13), (28, 13), (24, 14), (25, 14), (26, 14)], 'K')]), dl, zones, s)
    if name == 'gull':
        add('gull-plover', edit(lbl, 'K', [([(23, 9), (24, 9)], 'K')]), dl, zones, s)

# ── drawn outlines ──
for name, (lbl, zones) in DRAWN.items():
    add(name, lbl, {}, zones)
    if name == 'raptor':
        add('raptor-chisel', edit(lbl, 'K', [([(23, 9), (24, 9), (25, 9), (26, 9), (23, 10), (24, 10)], 'K')]), {}, zones)
        add('raptor-parrot', edit(lbl, 'K', [([(23, 9), (24, 9), (23, 10), (24, 10), (25, 10), (24, 11), (25, 11)], 'K'), (line((6, 29), (3, 31)) + line((7, 29), (4, 31)) + [(6, 30), (5, 30)], 'T')]), {}, zones)
        add('raptor-kooka', edit(lbl, 'K', [([(23, 9), (24, 9), (25, 9), (26, 9), (27, 9), (23, 10), (24, 10), (25, 10), (26, 10), (23, 11), (24, 11)], 'K')]), {}, zones)
    if name == 'heron':
        add('heron-ibis', edit(lbl, 'K', [([(22, 4), (23, 4), (24, 5), (25, 5), (26, 6), (27, 7), (22, 5), (23, 5)], 'K')]), {}, zones)
        add('heron-short', edit(lbl, 'K', [([(22, 4), (23, 4), (24, 4), (25, 4), (22, 5), (23, 5)], 'K')]), {}, zones)

# ── the owner's original sprites, for species that are on the sheet ──
group_of = {i: n for n, (_, ids) in BASES.items() for i in ids}
sheet = []
for i, cell in enumerate(CELLS):
    pxs = px(i); pal = sorted(set(pxs.values())); s = SHIFT[group_of[i]]
    keys = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    rows = [['.'] * 32 for _ in range(32)]
    for (x, y), c in pxs.items():
        if 0 <= y + s < 32: rows[y + s][x] = keys[pal.index(c)]
    sheet.append({'base': group_of[i], 'pal': ['%02x%02x%02x' % c for c in pal], 'rows': [''.join(r) for r in rows]})

ts = ['// GENERATED by tools/birds/export.py from the owner\'s 32-bit bird sprite sheet. Do not edit by hand.',
      '// Forms: part letters (B back, Y belly, W wing, F flight feathers, T tail, H head, C crown, X crest, K beak, L legs, E eye,',
      '// I throat, M mask, Q cheek); dl: shading offset per pixel, A..Z = −26..+24 lightness. Zones: [x,y,…] for markings.',
      'export interface Form { rows: string[]; dl: string[]; zones: Record<string, number[]>; eye: [number, number] | null; shoulder: [number, number]; front: boolean }',
      'export interface SheetSprite { base: string; pal: string[]; rows: string[] }',
      'export const FORMS: Record<string, Form> = ' + json.dumps(forms, separators=(',', ':')) + ';',
      'export const SHEET: SheetSprite[] = ' + json.dumps(sheet, separators=(',', ':')) + ';', '']
open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'core', 'pixel', 'birdart.ts'), 'w').write('\n'.join(ts))
print(len(forms), 'forms:', ', '.join(forms), '|', len(sheet), 'sheet sprites |', round(len('\n'.join(ts)) / 1024), 'KB')
