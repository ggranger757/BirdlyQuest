# Canonical part maps for the five outlines on the owner's sheet, plus marking zones.
from common import *

def song():
    ref = px(30)  # cardinal: has the crest rows; others are the same outline minus rows 7-8
    out = {}
    for (x, y), c in px(32).items():
        L = lab(c)[0]
        if y >= 23 and x >= 14: v = 'L'
        elif (x <= 10 and y >= 18) or (y >= 21 and x <= 11): v = 'T'
        elif c == (0, 0, 0): v = 'E'
        elif x >= 23 and 11 <= y <= 13: v = 'K'
        elif y <= 10 and x >= 18: v = 'C'
        elif (y <= 12 and x >= 17) or (y == 13 and x >= 19) or (y == 14 and x >= 19): v = 'H'
        elif y <= 14: v = 'B'
        elif x >= 20 or (x >= 18 and y >= 19) or (L > 85): v = 'Y'
        elif 15 <= y <= 17 and x >= 15: v = 'B'
        else: v = 'W'
        out[(x, y)] = v
    crest = {(x, y) for (x, y) in ref if y <= 9 and (x, y) not in out}
    crest |= {(x, y) for (x, y) in ref if y <= 8}
    return out, {
        'crest': sorted(crest),
        'nape': [(17, 11), (17, 12), (16, 13), (17, 13), (18, 13)],
        'maskThin': [(19, 11), (21, 11), (22, 11), (19, 12), (21, 12), (22, 12)],
        'maskBold': [(19, 11), (21, 11), (22, 11), (19, 12), (21, 12), (22, 12), (20, 10), (21, 10), (19, 13), (20, 13), (21, 13), (22, 13), (18, 11), (18, 12)],
        'cheek': [(18, 12), (18, 13), (19, 13), (20, 13), (21, 13), (19, 14), (20, 14)],
        'throat': [(x, y) for y in range(13, 16) for x in range(20, 24)],
        'full': [(x, y) for y in range(13, 19) for x in range(19, 24)],
        'bar1': [(x, 18) for x in range(12, 17)],
        'bar2': [(x, 16) for x in range(12, 16)] + [(x, 18) for x in range(12, 17)],
        'shoulder': (15, 15), 'eye': (20, 11),
    }

def duck():
    out = {}
    for (x, y), c in px(3).items():
        if c == (0, 0, 0): v = 'E'
        elif x >= 24 and 12 <= y <= 15 and lab(c)[1] > 0 and c not in [(0x17, 0x8b, 0x47), (0x8b, 0xc5, 0xa3)]: v = 'K'
        elif y <= 12 and x >= 20: v = 'C'
        elif x >= 19 and y <= 16: v = 'H'
        elif y >= 21: v = 'Y'
        elif x <= 11 and y <= 20: v = 'T'
        elif x >= 19 and y >= 17: v = 'Y'
        elif 17 <= y <= 19 and 10 <= x <= 16: v = 'W'
        else: v = 'B'
        out[(x, y)] = v
    return out, {
        'nape': [(19, 13), (19, 14), (19, 15), (20, 16)], 'maskThin': [(21, 13), (23, 13)], 'maskBold': [(21, 13), (23, 13), (21, 14), (22, 14), (23, 14), (21, 12), (22, 12)],
        'cheek': [(21, 14), (22, 14), (23, 14), (22, 15), (23, 15)], 'throat': [(x, 17) for x in range(19, 23)], 'full': [(x, y) for y in range(17, 20) for x in range(19, 24)],
        'bar1': [(x, 19) for x in range(11, 15)], 'bar2': [(x, 19) for x in range(11, 15)] + [(x, 17) for x in range(12, 15)], 'crest': [(22, 10), (23, 10), (21, 10)],
        'shoulder': (15, 16), 'eye': (22, 13),
    }

def goose():
    out = {}
    for (x, y), c in px(8).items():
        if c == (0, 0, 0): v = 'E'
        elif x >= 25 and 10 <= y <= 13: v = 'K'
        elif y <= 9 and x >= 21: v = 'C'
        elif x >= 20 and y <= 17: v = 'H'
        elif y >= 23: v = 'Y'
        elif x >= 18 and y >= 18: v = 'Y'
        elif x <= 5: v = 'T'
        elif 8 <= x <= 17 and y >= 18 and c not in [(0x5e, 0x3d, 0x32), (0xae, 0x9e, 0x98)]: v = 'W'
        else: v = 'B'
        out[(x, y)] = v
    return out, {
        'nape': [(20, 12), (20, 13), (20, 14), (20, 15), (20, 16)], 'maskThin': [(22, 10), (24, 10)], 'maskBold': [(22, 10), (24, 10), (21, 10), (22, 11), (23, 11), (24, 11)],
        'cheek': [(22, 11), (23, 11), (24, 11), (22, 12), (23, 12), (24, 12)], 'throat': [(x, y) for y in range(13, 18) for x in range(21, 24)], 'full': [(x, y) for y in range(18, 22) for x in range(18, 25)],
        'bar1': [(x, 20) for x in range(10, 16)], 'bar2': [(x, 20) for x in range(10, 16)] + [(x, 22) for x in range(10, 16)], 'crest': [(22, 7), (23, 7)],
        'shoulder': (13, 18), 'eye': (23, 10),
    }

def gull():
    out = {}
    for (x, y), c in px(12).items():
        if c == (0, 0, 0): v = 'E'
        elif y >= 22 and x >= 13: v = 'L'
        elif x >= 23 and 8 <= y <= 10: v = 'K'
        elif y <= 7: v = 'C'
        elif x >= 19 and y <= 12: v = 'H'
        elif x <= 9 and y >= 20: v = 'T'
        elif y == 21 and x >= 10: v = 'Y'
        elif x >= 20 or (x == 19 and y >= 16): v = 'Y'
        elif c[0] < 0x60 and y >= 18: v = 'F' if y == 20 else 'W'
        else: v = 'W' if y >= 15 else 'B'
        out[(x, y)] = v
    return out, {
        'nape': [(19, 10), (19, 11), (19, 12), (20, 12)], 'maskThin': [(20, 9), (22, 9)], 'maskBold': [(20, 9), (22, 9), (20, 8), (21, 8), (22, 8), (20, 10), (21, 10), (22, 10)],
        'cheek': [(20, 10), (21, 10), (22, 10)], 'throat': [(x, y) for y in range(11, 14) for x in range(20, 23)], 'full': [(x, y) for y in range(11, 18) for x in range(20, 24)],
        'bar1': [(x, 18) for x in range(11, 17)], 'bar2': [(x, 18) for x in range(11, 17)] + [(x, 16) for x in range(13, 18)], 'crest': [(20, 6), (21, 6)],
        'shoulder': (16, 14), 'eye': (21, 9),
    }

def humm():
    out = {}
    for (x, y), c in px(18).items():
        if c == (0, 0, 0): v = 'K'
        elif y <= 16 and x <= 16 and not (x >= 14 and y >= 14): v = 'W'
        elif y >= 19: v = 'T'
        elif x >= 17 and y <= 12: v = 'C' if y <= 11 else 'H'
        elif x >= 18 and 13 <= y <= 15: v = 'I' if c[0] > 0x70 else 'H'
        elif c[0] > 0xe0: v = 'Y'
        else: v = 'B'
        out[(x, y)] = v
    return out, {
        'nape': [(16, 12), (17, 12)], 'maskThin': [(19, 12)], 'maskBold': [(19, 12), (18, 12), (20, 12)], 'cheek': [(18, 13)],
        'throat': [(18, 13), (19, 13), (18, 14), (19, 14), (18, 15)], 'full': [(18, 13), (19, 13), (18, 14), (19, 14), (18, 15), (17, 15), (17, 16)],
        'bar1': [(12, 12), (13, 13)], 'bar2': [(12, 12), (13, 13), (11, 11)], 'crest': [(19, 10)],
        'shoulder': (15, 14), 'eye': None,
    }

BASES = {'song': (song, [22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33]), 'duck': (duck, [0, 1, 2, 3, 4, 5, 6]), 'goose': (goose, [7, 8, 9]), 'gull': (gull, [10, 11, 12, 13]), 'humm': (humm, list(range(14, 22)))}

if __name__ == '__main__':
    tiles = []
    for name, (fn, ids) in BASES.items():
        lbl, zones = fn()
        l = {k: CHR[v] for k, v in lbl.items()}
        show(l, f'/tmp/lbl-{name}.png'); tiles += [CELLS[ids[0] if name != 'song' else 32].resize((320, 320), Image.NEAREST).convert('RGB'), Image.open(f'/tmp/lbl-{name}.png')]
        print(name, len(lbl), {v: sum(1 for x in lbl.values() if x == v) for v in sorted(set(lbl.values()))})
    s = Image.new('RGB', (len(tiles) * 165, 330), 'white')
    for i, t in enumerate(tiles): s.paste(t.resize((160, 160), Image.NEAREST), ((i // 2) * 330 + (i % 2) * 165, 0))
    s.save('/home/claude/qa/bases-labels.png')
