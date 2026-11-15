"""Generate BirdlyQuest achievement badges: 32x32 pixel art, exported at 64x64 (nearest).

Each badge = category frame (shape) + tier metal (palette ramp) + a hand-drawn emblem.
Run:  python3 scripts/gen-badges.py   → writes public/badges/b-<id>.png and a preview sheet.
"""
import os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'badges')
S = 32

def hx(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

INK = hx('#14121F')
# tier ramps: deep, base, light, glint
TIERS = {
    'bronze':   [hx('#4A3426'), hx('#8C5A2B'), hx('#C2622F'), hx('#E8A33D')],
    'silver':   [hx('#3F3B57'), hx('#8A8BA3'), hx('#B9BCC9'), hx('#F7F4E9')],
    'gold':     [hx('#8C5A2B'), hx('#E8A33D'), hx('#F2C14E'), hx('#FFF4B8')],
    'platinum': [hx('#1F3F6E'), hx('#5AA9C9'), hx('#9FD3E0'), hx('#F2FCFF')],
}
FIELD_BG = {  # inner disc colour per category
    'Firsts': hx('#2B2440'), 'Taxonomy': hx('#2A3340'), 'Place': hx('#1F3F6E'), 'Craft': hx('#4A3F8F'),
    'Time': hx('#2B2440'), 'Dedication': hx('#4A3426'), 'Care': hx('#5C1F3A'),
}
RIBBON = {'bronze': (hx('#A8452F'), hx('#C94F7C')), 'silver': (hx('#2E6F9E'), hx('#5AA9C9')),
          'gold': (hx('#A8452F'), hx('#E86A4A')), 'platinum': (hx('#7B4FA8'), hx('#C94F7C'))}


def blank():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def mask_from(fn):
    return [[fn(x + 0.5, y + 0.5) for x in range(S)] for y in range(S)]


def circle(cx, cy, r):
    return lambda x, y: (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def poly(pts):
    def inside(px, py):
        c = False
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[i - 1]
            if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: c = not c
        return c
    return inside


def heart(cx, cy, s):
    def f(x, y):
        X, Y = (x - cx) / s, -(y - cy) / s
        return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0
    return f


def star_poly(cx, cy, R, r, n=5, rot=-90):
    import math
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n); rr = R if i % 2 == 0 else r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def frame_shape(cat):
    """Returns (outer shape fn, emblem center)."""
    import math
    if cat == 'Firsts':      # medal: disc on ribbons
        return circle(16, 13.5, 11.5), (16, 13)
    if cat == 'Taxonomy':    # gem / diamond
        return poly([(16, 1.5), (29.5, 13), (16, 30.5), (2.5, 13)]), (16, 14)
    if cat == 'Place':       # shield
        return poly([(4, 3), (28, 3), (28, 15), (22, 25), (16, 30), (10, 25), (4, 15)]), (16, 14)
    if cat == 'Craft':       # hexagon
        pts = [(16 + 14 * math.cos(math.radians(a)), 16 + 14 * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
        return poly(pts), (16, 16)
    if cat == 'Time':        # sun: disc + rays
        disc = circle(16, 16, 10.5)
        rays = poly(star_poly(16, 16, 15.5, 9, 8, -90))
        return (lambda x, y: disc(x, y) or rays(x, y)), (16, 16)
    if cat == 'Care':        # heart
        return heart(16, 15.5, 13.2), (16, 14)
    # Dedication: laurel roundel
    return circle(16, 16, 12.5), (16, 16)


def draw_frame(img, cat, tier):
    deep, base, light, glint = TIERS[tier]
    shape, _ = frame_shape(cat)
    m = mask_from(shape)
    px = img.load()
    # ribbon tails behind medal
    if cat == 'Firsts':
        a, b = RIBBON[tier]
        tails = [poly([(9, 18), (14, 20), (12, 31), (10, 28), (7, 30)]), poly([(23, 18), (18, 20), (20, 31), (22, 28), (25, 30)])]
        for t in tails:
            tm = mask_from(t)
            for y in range(S):
                for x in range(S):
                    if tm[y][x]: px[x, y] = a if x % 3 else b
    # metal rim (outer 2px) and inner field
    inner = [[False] * S for _ in range(S)]
    for y in range(S):
        for x in range(S):
            if not m[y][x]: continue
            d = min(abs(dx) + abs(dy) for dx in range(-3, 4) for dy in range(-3, 4)
                    if not (0 <= x + dx < S and 0 <= y + dy < S and m[y + dy][x + dx])) if any(
                not (0 <= x + dx < S and 0 <= y + dy < S and m[y + dy][x + dx]) for dx in range(-3, 4) for dy in range(-3, 4)) else 9
            if d <= 2:
                # light from top-left: rim pixels facing up/left are lighter
                up = (y < 16 and x < 20) or y < 10
                px[x, y] = (light if up else base) if d == 2 else (base if up else deep)
            else:
                inner[y][x] = True
                px[x, y] = FIELD_BG[cat]
    # inner field: subtle 2-tone vignette + glint
    for y in range(S):
        for x in range(S):
            if inner[y][x] and (x + y) % 2 == 0 and y > 20:
                r, g, b, _ = FIELD_BG[cat]; px[x, y] = (max(0, r - 14), max(0, g - 14), max(0, b - 14), 255)
    # Dedication laurel: leaves on the rim
    if cat == 'Dedication':
        import math
        for k in range(14):
            ang = math.radians(110 + k * 23) if k < 7 else math.radians(70 - (k - 7) * 23)
            lx, ly = int(round(16 + 11 * math.cos(ang))), int(round(16 + 11 * math.sin(ang)))
            for dx, dy in ((0, 0), (1, 0), (0, 1)):
                if 0 <= lx + dx < S and 0 <= ly + dy < S: px[lx + dx, ly + dy] = hx('#6FA84B') if k % 2 else hx('#3F7A3F')
    # Time rays get alternate shading
    # outline (1px ink) around everything opaque
    alpha = [[px[x, y][3] > 0 for x in range(S)] for y in range(S)]
    for y in range(S):
        for x in range(S):
            if alpha[y][x]: continue
            if any(0 <= x + dx < S and 0 <= y + dy < S and alpha[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = INK
    # glint
    gx, gy = (9, 7) if cat != 'Taxonomy' else (12, 7)
    for dx, dy in ((0, 0), (1, 0), (0, 1)):
        if inner[gy + dy][gx + dx] or alpha[gy + dy][gx + dx]: px[gx + dx, gy + dy] = glint
    return frame_shape(cat)[1]


# ─── emblems: ASCII art, '.' transparent; colour keys below ───
K = {
    'k': hx('#14121F'), 'w': hx('#F7F4E9'), 'p': hx('#E8E4D8'), 's': hx('#B9BCC9'), 'a': hx('#8A8BA3'),
    'u': hx('#4A3426'), 'b': hx('#8C5A2B'), 'r': hx('#C2622F'), 'R': hx('#A8452F'), 'o': hx('#E86A4A'),
    'y': hx('#F2C14E'), 'Y': hx('#E8A33D'), 'g': hx('#6FA84B'), 'G': hx('#3F7A3F'), 'l': hx('#A8C66C'),
    'c': hx('#5AA9C9'), 'C': hx('#2E6F9E'), 'i': hx('#D6EEF2'), 'v': hx('#7B4FA8'), 'V': hx('#4A3F8F'),
    'm': hx('#F2A0B5'), 'M': hx('#C94F7C'), 'n': hx('#C6FF1A'), 'e': hx('#1A1A1A'), 'q': hx('#D9C26A'),
}

E = {}
E['owl'] = '''
..u........u..
..uu......uu..
.ubbbbbbbbbbu.
ubwwwbbbbwwwbu
ubwkywbbwykwbu
ubwkywbbwykwbu
ubbwwbYYbwwbbu
.ubbbbbYbbbbu.
.ubqbqbbqbqbu.
..ubqbbbbqbu..
...ubbbbbbu...
....uuuuuu....
'''
E['woodpecker'] = '''
....RRR.......
...RRRRk......
..kRRkkkk.....
..kwwwwwwk....
.kwkkkkekwsssss
.kwwwwwwwwssss.
.kkkkkkwwk.....
..kwwwwwwk.....
...kkwwwk......
....kwwk.......
'''
E['duck'] = '''
....GGGG......
...GGGGGG.....
..GGGeGGGYYY..
..GGGGGGGYYYY.
...GGGGGG.....
....www.......
...uuuuuuu....
.uuuuuaaaauu..
uuuaaaaaaaaau.
.uaaaaaaaaaau.
..uuuuuuuuuu..
cccccccccccccc
.c.c.c.c.c.c.c
'''
E['hummingbird'] = '''
.............s
............ss
...........ss.
GG........ss..
GGG......ss...
.GGGG...ss....
..GGGGGGGkk...
...GGGGGekkkk.
...GMMMGGGkk..
....MMMGGG....
.....GGGG.....
......GG......
.......G......
'''
E['globe'] = '''
....kkkkkk....
..kkCCgGCCkk..
.kCCgggGGCCCk.
.kCggggCCCgCk.
kCCCgggCCCggCk
kCCCCgCCCgggCk
kCCCCCCCCggCCk
kCCgCCCCCCCCCk
.kCggCCCCCgCk.
.kCCgCCCCCCCk.
..kkCCCCCCkk..
....kkkkkk....
'''
E['flight'] = '''
ww..........ww
www........www
.wwww....wwww.
..wwwwwwwwww..
...wwwkwwww...
.....wwwwyy...
......www.....
.....ww.ww....
'''
E['morph'] = '''
......y.......
.....yyy......
......y...wwww
.........wwwwwm
.......wwwwwwwyy
..wwwwwwwwwww..
.wwpwwwwwwww...
wwppwwwwwww....
.wpppwwww......
..ww.www.......
.....s.s.......
'''
E['notes'] = '''
.kkkkkkkkk..yy
.kwwwwwwwwk.yY
.kwaaaaaawkyY.
.kwwwwwwwwyY..
.kwaaaaaayYk..
.kwwwwwwyYwk..
.kwaaaaaRaak..
.kwwwwwwwwwk..
.kwaaaaaawwk..
.kwwwwwwwwwk..
.kkkkkkkkkkk..
'''
E['share'] = '''
...kkkk.......
.kkkwwkkkkkk..
kaaaaaaaaaaak.
kaakkkkkkaaak.
kaakcccckaayk.
kaakcwcckaaak.
kaakcccckaaak.
kaakkkkkkaaak.
kaaaaaaaaaaak.
.kkkkkkkkkkk..
'''
E['seedbag'] = '''
.....k..k.....
.....kkkk.....
....kqbbqk....
...kqqqqqqk...
..kqqqqqqqqk..
..kqqbbbbqqk..
.kqqbyyyybqqk.
.kqqbyYYybqqk.
.kqqqbbbbqqqk.
.kqqqqqqqqqqk.
..kkkkkkkkkk..
....yYy.Yy....
'''
E['heart'] = '''
..kkk...kkk...
.kmmmk.kMMMk..
kmwmmmkmMMMMk.
kmmmmmmmMMMMk.
kmmmmmMMMMMMk.
.kmmmMMMMMMk..
..kmMMMMMMk...
...kMMMMMk....
....kMMMk.....
.....kMk......
......k.......
'''
E['house'] = '''
......kk......
.....kRRk.....
....kRRRRk....
...kRRRRRRk...
..kRRRRRRRRk..
.kkkkkkkkkkkk.
..kbbbbbbbbk..
..kbbbkkbbbk..
..kbbkeekbbk..
..kbbbkkbbbk..
..kbbbbbbbbk..
..kkkkkkkkkk..
.....kuuk.....
.....kuuk.....
'''
E['coins'] = '''
.....kkkk.....
...kkyyyykk...
..kyyYYYYyyk..
..kkyyyyyykk..
..kYkkkkkkYk..
..kyyYYYYyyk..
..kkyyyyyykk..
..kYkkkkkkYk..
..kyyYYYYyyk..
...kkyyyykk...
.....kkkk.....
'''
E['moon'] = '''
.....kkkk..y..
...kkiiik....y
..kiiiik......
.kiiiik...y...
.kiiik........
kiiiik........
kiiiik.....y..
kiiiik........
.kiiiik.......
.kiiiiikk..kk.
..kiiiiiiiik..
...kkiiiikk...
.....kkkk.....
'''
E['calendar'] = '''
..k.k....k.k..
.kkkkkkkkkkkk.
.kRRRRRRRRRRk.
.kRRRRRRRRRRk.
.kwwwwwwwwwwk.
.kwakawakawak.
.kwwwwwwwwwwk.
.kwakawanknnk.
.kwwwwwwnnnnk.
.kwakawanknnk.
.kkkkkkkkkkkk.
'''
E['scroll'] = '''
.kkkkkkkkkk...
kpwwwwwwwwpk..
kpkkkkkkkkpk..
.kwwwwwwwwk...
.kwaaaaaawk...
.kwwwwwwwwk...
.kwaaaaawwk...
.kwwwwwwwwk...
.kwaaaaaawk...
kpkkkkkkkkpk..
kpwwwwwwwwpk..
.kkkkkkkkkk...
'''
E['trophy'] = '''
.kkkkkkkkkkkk.
kkyyyyyyyyyykk
kykyyyyyyyyky.k
kyky.YyyyyYkyk.
.kkyYyyyyyYkk.
...kYyyyyYk...
....kYyyYk....
.....kyyk.....
.....kYYk.....
....kyyyyk....
...kkkkkkkk...
...kuuuuuuk...
...kkkkkkkk...
'''
E['star'] = '''
......kk......
......kck.....
.....kcck.....
kkkkkcccckkkk.
kcccccccccccck
.kcccccicccck.
..kccccccccK..
..kcccckcccck.
.kccck..kccck.
.kckk....kkck.
.kk........kk.
'''
E['gem'] = '''
...kkkkkkkk...
..kvVvVvVvVk..
.kvvVvvVvvVvk.
kvvvvVvvVvvvvk
kkkkkkkkkkkkkk
.kvVvvvvvvVvk.
..kvVvvvvVvk..
...kvVvvVvk...
....kvVVvk....
.....kvvk.....
......kk......
'''
E['crown'] = '''
.y....y....y..
.yy..yyy..yy..
.yYy.yYy.yYy..
.yYYyYYYyYYy..
.yYYYYYYYYYy..
.yyMyyyyyMyy..
.yYYYYYYYYYy..
.kkkkkkkkkkk..
'''
E['pct'] = None  # numbers are rendered with the digit font

DIG = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
    '5': ['111', '100', '111', '001', '111'], '%': ['101', '001', '010', '100', '101'],
}


def draw_text(img, text, cx, cy, col=K['w']):
    w = len(text) * 4 - 1
    x0, y0 = int(cx - w / 2), int(cy - 2.5)
    px = img.load()
    for i, ch in enumerate(text):
        for r, row in enumerate(DIG[ch]):
            for c, v in enumerate(row):
                if v == '1':
                    x, y = x0 + i * 4 + c, y0 + r
                    for dx, dy in ((1, 1),):  # drop shadow
                        if px[x + dx, y + dy][3] and px[x + dx, y + dy] != col: px[x + dx, y + dy] = INK
                    px[x, y] = col


def draw_emblem(img, name, cx, cy):
    rows = [r for r in E[name].strip('\n').split('\n')]
    h = len(rows); w = max(len(r) for r in rows)
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch not in K: continue
            X, Y = x0 + x, y0 + y
            if 0 <= X < S and 0 <= Y < S: px[X, Y] = K[ch]


BADGES = [
    # id, category, tier, emblem or text
    ('two-fifty', 'Firsts', 'platinum', 'T:250'),
    ('rare-find', 'Firsts', 'silver', 'star'),
    ('epic-find', 'Firsts', 'gold', 'gem'),
    ('legendary-find', 'Firsts', 'platinum', 'crown'),
    ('night-owls', 'Taxonomy', 'silver', 'owl'),
    ('woodpecker-works', 'Taxonomy', 'bronze', 'woodpecker'),
    ('waterfowl-wing', 'Taxonomy', 'silver', 'duck'),
    ('jewel-thieves', 'Taxonomy', 'gold', 'hummingbird'),
    ('dex-10', 'Place', 'bronze', 'T:10%'),
    ('dex-25', 'Place', 'silver', 'T:25%'),
    ('dex-50', 'Place', 'gold', 'T:50%'),
    ('globetrotter', 'Place', 'platinum', 'globe'),
    ('flight-shot', 'Craft', 'gold', 'flight'),
    ('rare-morph', 'Craft', 'platinum', 'morph'),
    ('field-notes', 'Craft', 'bronze', 'notes'),
    ('storyteller', 'Craft', 'silver', 'share'),
    ('first-fill', 'Care', 'bronze', 'seedbag'),
    ('well-fed', 'Care', 'silver', 'heart'),
    ('full-house', 'Care', 'gold', 'house'),
    ('big-spender', 'Care', 'platinum', 'coins'),
    ('midnight', 'Time', 'gold', 'moon'),
    ('weekender', 'Time', 'bronze', 'calendar'),
    ('quest-starter', 'Dedication', 'bronze', 'scroll'),
    ('questmaster', 'Dedication', 'gold', 'trophy'),
]


def render(cat, tier, emb):
    img = blank()
    cx, cy = draw_frame(img, cat, tier)
    if emb.startswith('T:'): draw_text(img, emb[2:], cx, cy + (1 if cat != 'Firsts' else 0))
    else: draw_emblem(img, emb, cx, cy)
    return img.resize((64, 64), Image.NEAREST)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for bid, cat, tier, emb in BADGES:
        im = render(cat, tier, emb)
        im.save(os.path.join(OUT, f'b-{bid}.png'), optimize=True)
        tiles.append(im)
    if len(sys.argv) > 1:  # preview sheet
        cols = 8; sheet = Image.new('RGBA', (cols * 80, ((len(tiles) + cols - 1) // cols) * 80), (17, 21, 26, 255))
        for i, t in enumerate(tiles):
            big = t.resize((64, 64), Image.NEAREST)
            sheet.paste(big, ((i % cols) * 80 + 8, (i // cols) * 80 + 8), big)
        sheet.save(sys.argv[1])
    print('wrote', len(tiles), 'badges')
