import json, sys
from PIL import Image, ImageDraw
d = json.load(open('tools/decor/out.json'))
kind = sys.argv[1]; items = d[kind]; S = 3; cols = 5
cw, ch = 56 * S, 56 * S + 14
im = Image.new('RGB', (cols * cw, ((len(items) + cols - 1) // cols) * ch), (24, 28, 36)); dr = ImageDraw.Draw(im)
for n, it in enumerate(items):
    x0, y0 = (n % cols) * cw, (n // cols) * ch
    bg = Image.new('RGBA', (56, 56), (52, 74, 96, 255))
    for y in range(51, 56):
        for x in range(56): bg.putpixel((x, y), (62, 106, 58, 255))
    t = Image.new('RGBA', (it['w'], it['h'])); t.putdata([tuple(it['px'][i:i + 4]) for i in range(0, len(it['px']), 4)])
    ox = (56 - it['w']) // 2; oy = 52 - it['h'] if kind == 'perches' else 6
    bg.alpha_composite(t, (ox, oy))
    if kind == 'perches':
        for sx, sy in it['spots']: bg.putpixel((ox + sx, oy + sy), (255, 0, 0, 255))
    im.paste(bg.resize((56 * S, 56 * S), Image.NEAREST), (x0, y0))
    dr.text((x0 + 4, y0 + 56 * S), it['name'][:28], fill=(220, 225, 235))
im.save(f'tools/decor/sheet-{kind}.png'); print(im.size)
