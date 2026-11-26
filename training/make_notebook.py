# Builds training/birdid_colab.ipynb (run: python3 training/make_notebook.py <app.json> training/birdid_colab.ipynb).
import json, sys, textwrap

app = json.load(open(sys.argv[1]))
out = sys.argv[2]

def md(s): return {"cell_type": "markdown", "metadata": {}, "source": textwrap.dedent(s).strip("\n")}
def code(s): return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": textwrap.dedent(s).strip("\n")}

cells = []
cells.append(md("""
# BirdlyQuest · bird photo ID model

This notebook trains the small on-phone model that powers **✨ Identify it** in BirdlyQuest.

**How to run it**
1. **Runtime → Change runtime type → T4 GPU**, then **Save**.
2. **Runtime → Run all**. Say *yes* when it asks to connect Google Drive. Progress is saved there, so if Colab disconnects you can just **Run all** again and it picks up where it stopped.
3. Wait about **3–5 hours**. You can close the tab, but keep the browser running if you can.
4. At the end a file called **`birdlyquest-birdid.zip`** downloads (it is also saved in your Drive under `BirdlyQuest-birdid/`). Send that zip back to Claude.

**What it does (and why it is safe to sell)**
* It picks about 800 species: your 122 BirdDex birds plus the most-seen birds in each of the app's regions.
* It downloads only iNaturalist photos licensed **CC0** (public domain) or **CC BY** (free to use commercially with credit). Photos with a *non-commercial* licence are never downloaded.
* It records every photographer, so the app can show the credits that CC BY requires.
* It fine-tunes a small, phone-friendly image model (EfficientNet-B0) and exports it for the browser.
"""))

cells.append(code("""
# ① Setup ───────────────────────────────────────────────────────────────────────────
!pip -q install timm onnx onnxruntime
import os, json, time, random, re, csv, math, shutil, zipfile, io, concurrent.futures as cf
import requests, torch
from PIL import Image
print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NONE: switch Runtime → Change runtime type → T4 GPU, then Run all again')
assert torch.cuda.is_available(), 'No GPU. Runtime → Change runtime type → T4 GPU'

from google.colab import drive
drive.mount('/content/drive')
WORK = '/content/drive/MyDrive/BirdlyQuest-birdid'
os.makedirs(WORK, exist_ok=True)
FAST = '/content/data'                      # images are copied here for fast training
print('Saving progress to', WORK)
"""))

cells.append(code(f"""
# ② Settings ────────────────────────────────────────────────────────────────────────
TOP_PER_REGION = 150        # most-seen species per region
PHOTOS_PER_SPECIES = 120    # max training photos per species (one per observation)
MIN_PHOTOS = 25             # species with fewer usable photos are left out
LICENSES = ['cc0', 'cc-by'] # ONLY commercially usable licences. Do not add cc-by-nc or cc-by-sa.
EPOCHS = 14
IMG = 224
SEED = 7
UA = {{'User-Agent': 'BirdlyQuest-birdid-training (github.com/ggranger757/BirdlyQuest)'}}

# The app's BirdDex species and regions (generated from the app's code)
APP_SPECIES = {json.dumps(app['species'], ensure_ascii=False)}
APP_REGIONS = {json.dumps(app['regions'], ensure_ascii=False)}
print(len(APP_SPECIES), 'BirdDex species,', len(APP_REGIONS), 'regions')
"""))

cells.append(code("""
# ③ iNaturalist API helper: polite (about 1 request a second) and retries on errors ─────────────
API = 'https://api.inaturalist.org/v1'
_last = [0.0]
def api(path, **params):
    for attempt in range(6):
        wait = 1.05 - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            r = requests.get(f'{API}/{path}', params=params, headers=UA, timeout=60)
            if r.status_code == 200: return r.json()
            if r.status_code in (429, 500, 502, 503, 504): time.sleep(10 * (attempt + 1)); continue
            r.raise_for_status()
        except requests.RequestException as e:
            print('  retrying after', e); time.sleep(10 * (attempt + 1))
    raise RuntimeError(f'iNaturalist API kept failing for {path}')

def load(name, default=None):
    p = os.path.join(WORK, name)
    return json.load(open(p)) if os.path.exists(p) else default
def save(name, obj):
    json.dump(obj, open(os.path.join(WORK, name), 'w'), ensure_ascii=False)
"""))

cells.append(code("""
# ④ Pick the species ────────────────────────────────────────────────────────────────
species = load('species.json')
if species is None:
    species = {}   # iNat taxon id → {sci, common, app_id}
    print('BirdDex birds…')
    for s in APP_SPECIES:
        j = api('taxa', q=s['sci'], rank='species', taxon_id=3, per_page=10)
        hit = next((t for t in j['results'] if t['name'].lower() == s['sci'].lower()), None)
        if not hit: print('  not found on iNaturalist:', s['sci']); continue
        species[str(hit['id'])] = {'sci': hit['name'], 'common': s['common'], 'app_id': s['id']}
    for r in APP_REGIONS:
        print('Most-seen birds in', r['name'], '…')
        dy, dx = 1.5, 2.0
        j = api('observations/species_counts', taxon_id=3, quality_grade='research', per_page=TOP_PER_REGION,
                nelat=r['lat'] + dy, nelng=r['lng'] + dx, swlat=r['lat'] - dy, swlng=r['lng'] - dx)
        for row in j['results']:
            t = row['taxon']
            if t.get('rank') != 'species': continue
            species.setdefault(str(t['id']), {'sci': t['name'], 'common': t.get('preferred_common_name') or t['name'], 'app_id': None})
    save('species.json', species)
print(len(species), 'species to learn')
"""))

cells.append(code("""
# ⑤ Find commercially usable photos (CC0 / CC BY only) ───────────────────────────────
photos = load('photos.json', {})      # taxon id → [{id, url, attribution, license, obs, user}]
todo = [t for t in species if t not in photos]
print(len(todo), 'species left to search')
for n, tid in enumerate(todo):
    got, seen_obs, page = [], set(), 1
    while len(got) < PHOTOS_PER_SPECIES and page <= 4:
        j = api('observations', taxon_id=tid, quality_grade='research', photos='true', photo_license=','.join(LICENSES),
                per_page=200, page=page, order_by='votes')
        if not j['results']: break
        for o in j['results']:
            if o['id'] in seen_obs: continue
            for p in o.get('photos', []):
                lic = (p.get('license_code') or '').lower()
                if lic in LICENSES and p.get('url'):
                    got.append({'id': p['id'], 'url': p['url'].replace('/square.', '/medium.'), 'attribution': p.get('attribution', ''),
                                'license': lic, 'obs': o['id'], 'user': (o.get('user') or {}).get('login', '')})
                    seen_obs.add(o['id']); break
            if len(got) >= PHOTOS_PER_SPECIES: break
        if len(j['results']) < 200: break
        page += 1
    photos[tid] = got
    if n % 20 == 0 or n == len(todo) - 1:
        save('photos.json', photos); print(f'  {n + 1}/{len(todo)}  {species[tid]["common"]}: {len(got)} photos')
save('photos.json', photos)
assert all(p['license'] in LICENSES for ps in photos.values() for p in ps), 'non-commercial photo slipped in'
print('Usable photos:', sum(len(v) for v in photos.values()))
"""))

cells.append(code("""
# ⑥ Download the photos (resized to 256 px, saved to Drive so a restart doesn't re-download) ─────────
IMGDIR = os.path.join(WORK, 'images')
def fetch(tid, p):
    path = os.path.join(IMGDIR, tid, f"{p['id']}.jpg")
    if os.path.exists(path): return True
    for attempt in range(3):
        try:
            r = requests.get(p['url'], headers=UA, timeout=60)
            if r.status_code != 200: time.sleep(2); continue
            im = Image.open(io.BytesIO(r.content)).convert('RGB')
            s = 256 / min(im.size); im = im.resize((max(256, round(im.width * s)), max(256, round(im.height * s))), Image.BICUBIC)
            os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path, quality=90)
            return True
        except Exception: time.sleep(2)
    return False

jobs = [(t, p) for t, ps in photos.items() for p in ps]
print(len(jobs), 'photos…')
ok = 0
with cf.ThreadPoolExecutor(16) as ex:
    for i, done in enumerate(ex.map(lambda a: fetch(*a), jobs)):
        ok += done
        if i % 5000 == 0: print(f'  {i}/{len(jobs)}')
print(ok, 'photos ready')
"""))

cells.append(code("""
# ⑦ Final class list and a train / check split ────────────────────────────────────────
random.seed(SEED)
items = {}
for tid, ps in photos.items():
    have = [p for p in ps if os.path.exists(os.path.join(IMGDIR, tid, f"{p['id']}.jpg"))]
    if len(have) >= MIN_PHOTOS: items[tid] = have
dropped = sorted(set(species) - set(items), key=lambda t: species[t]['common'])
CLASSES = sorted(items, key=lambda t: species[t]['sci'])
print(len(CLASSES), 'species kept;', len(dropped), 'left out for too few CC0/CC BY photos')
missing_birddex = [species[t]['common'] for t in dropped if species[t]['app_id']]
if missing_birddex: print('BirdDex birds left out:', ', '.join(missing_birddex))

# copy to fast local disk
if os.path.exists(FAST): shutil.rmtree(FAST)
train, val = [], []
for ci, tid in enumerate(CLASSES):
    ps = items[tid][:]; random.shuffle(ps)
    k = max(3, len(ps) // 10)
    for j, p in enumerate(ps):
        src = os.path.join(IMGDIR, tid, f"{p['id']}.jpg"); dst = os.path.join(FAST, tid, f"{p['id']}.jpg")
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(src, dst)
        (val if j < k else train).append((dst, ci))
print(len(train), 'training photos,', len(val), 'check photos')
"""))

cells.append(code("""
# ⑧ Train ────────────────────────────────────────────────────────────────────────────
import timm, torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import torchvision.transforms as T

MEAN, STD = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
tf_train = T.Compose([T.RandomResizedCrop(IMG, scale=(0.35, 1.0)), T.RandomHorizontalFlip(), T.ColorJitter(0.2, 0.2, 0.2, 0.02), T.ToTensor(), T.Normalize(MEAN, STD)])
tf_val = T.Compose([T.Resize(256), T.CenterCrop(IMG), T.ToTensor(), T.Normalize(MEAN, STD)])
class DS(Dataset):
    def __init__(s, rows, tf): s.rows, s.tf = rows, tf
    def __len__(s): return len(s.rows)
    def __getitem__(s, i): p, y = s.rows[i]; return s.tf(Image.open(p).convert('RGB')), y
dl_train = DataLoader(DS(train, tf_train), batch_size=96, shuffle=True, num_workers=2, pin_memory=True, drop_last=True, persistent_workers=True)
dl_val = DataLoader(DS(val, tf_val), batch_size=128, num_workers=2, pin_memory=True)

torch.manual_seed(SEED)
model = timm.create_model('efficientnet_b0', pretrained=True, num_classes=len(CLASSES)).cuda()
ckpt_path = os.path.join(WORK, 'checkpoint.pt')
start, best = 0, 0.0
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=0.02)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=EPOCHS * len(dl_train), pct_start=0.1)
scaler = torch.amp.GradScaler()
if os.path.exists(ckpt_path):
    ck = torch.load(ckpt_path, map_location='cuda')
    if ck['classes'] == CLASSES:
        model.load_state_dict(ck['model']); opt.load_state_dict(ck['opt']); sched.load_state_dict(ck['sched']); start, best = ck['epoch'] + 1, ck['best']
        print('Resuming at epoch', start + 1)
lossf = nn.CrossEntropyLoss(label_smoothing=0.1)

def evaluate():
    model.eval(); c1 = c5 = n = 0
    with torch.no_grad(), torch.autocast('cuda', dtype=torch.float16):
        for x, y in dl_val:
            x, y = x.cuda(non_blocking=True), y.cuda(non_blocking=True)
            top = model(x).topk(5, 1).indices
            c1 += (top[:, 0] == y).sum().item(); c5 += (top == y[:, None]).any(1).sum().item(); n += len(y)
    return c1 / n, c5 / n

for ep in range(start, EPOCHS):
    model.train(); t0 = time.time(); tot = 0
    for i, (x, y) in enumerate(dl_train):
        x, y = x.cuda(non_blocking=True), y.cuda(non_blocking=True)
        with torch.autocast('cuda', dtype=torch.float16): loss = lossf(model(x), y)
        opt.zero_grad(set_to_none=True); scaler.scale(loss).backward(); scaler.step(opt); scaler.update(); sched.step(); tot += loss.item()
    top1, top5 = evaluate()
    print(f'epoch {ep + 1}/{EPOCHS}  loss {tot / len(dl_train):.3f}  check top-1 {top1:.1%}  top-5 {top5:.1%}  ({(time.time() - t0) / 60:.1f} min)')
    if top1 >= best: best = top1; torch.save(model.state_dict(), os.path.join(WORK, 'best.pt'))
    torch.save({'model': model.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'epoch': ep, 'best': best, 'classes': CLASSES}, ckpt_path)
print('Best check accuracy (top-1):', f'{best:.1%}')
"""))

cells.append(code("""
# ⑨ Export for the browser, and check the exported model gives the same answers ─────────────
import numpy as np, onnxruntime as ort
model.load_state_dict(torch.load(os.path.join(WORK, 'best.pt'))); model.eval().cpu()
OUT = '/content/out'; os.makedirs(OUT, exist_ok=True)
onnx_path = os.path.join(OUT, 'birdid.onnx')
dummy = torch.randn(1, 3, IMG, IMG)
try: torch.onnx.export(model, dummy, onnx_path, input_names=['image'], output_names=['logits'], opset_version=17, dynamo=False)
except TypeError: torch.onnx.export(model, dummy, onnx_path, input_names=['image'], output_names=['logits'], opset_version=17)
sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
agree = n = c1 = 0
for x, y in DataLoader(DS(val[:600], tf_val), batch_size=1):
    a = sess.run(None, {'image': x.numpy()})[0][0]
    with torch.no_grad(): b = model(x)[0].numpy()
    agree += int(a.argmax() == b.argmax()); c1 += int(a.argmax() == y.item()); n += 1
print(f'exported model agrees with PyTorch on {agree}/{n}; top-1 on these: {c1 / n:.1%}')
assert agree / n > 0.98, 'export mismatch'
print('model size:', round(os.path.getsize(onnx_path) / 1e6, 1), 'MB')
top1, top5 = best, None
"""))

cells.append(code("""
# ⑩ Labels, credits and settings for the app ──────────────────────────────────────────
def who(attr):  # "(c) Jane Doe, some rights reserved (CC BY)" → "Jane Doe"
    m = re.match(r'\\s*(?:\\(c\\)\\s*)?(.*?),\\s*(some|no) rights reserved', attr or '', re.I)
    return (m.group(1) if m and m.group(1).strip() else 'Unknown photographer').strip()
labels = [{'i': i, 'inat': int(t), 'sci': species[t]['sci'], 'common': species[t]['common'], 'app': species[t]['app_id']} for i, t in enumerate(CLASSES)]
used = [(t, p) for t in CLASSES for p in items[t]]
people = {}
for t, p in used:
    k = who(p['attribution']); e = people.setdefault(k, {'name': k, 'photos': 0, 'licenses': set()})
    e['photos'] += 1; e['licenses'].add(p['license'])
credits = {
    'source': 'iNaturalist (inaturalist.org) research-grade observations',
    'licenses': {'cc0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'cc-by': 'https://creativecommons.org/licenses/by/4.0/'},
    'note': 'Photos were resized and cropped to train the BirdlyQuest bird ID model. They are not shown in the app.',
    'photographers': sorted(({'name': e['name'], 'photos': e['photos'], 'licenses': sorted(e['licenses'])} for e in people.values()), key=lambda e: e['name'].lower()),
}
with open(os.path.join(OUT, 'credits_photos.csv'), 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['photo_id', 'photo_url', 'observation_url', 'attribution', 'license', 'species'])
    for t, p in used: w.writerow([p['id'], f"https://www.inaturalist.org/photos/{p['id']}", f"https://www.inaturalist.org/observations/{p['obs']}", p['attribution'], p['license'], species[t]['sci']])
json.dump(labels, open(os.path.join(OUT, 'labels.json'), 'w'), ensure_ascii=False)
json.dump(credits, open(os.path.join(OUT, 'credits.json'), 'w'), ensure_ascii=False)
json.dump({'model': 'efficientnet_b0 (timm, ImageNet-1k start) fine-tuned', 'input': IMG, 'resize': 256, 'mean': MEAN, 'std': STD,
           'classes': len(CLASSES), 'check_top1': round(best, 4), 'photos': len(used), 'photographers': len(people),
           'licenses': LICENSES, 'trained': time.strftime('%Y-%m-%d')}, open(os.path.join(OUT, 'config.json'), 'w'), indent=1)
zip_path = os.path.join(WORK, 'birdlyquest-birdid.zip')
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['birdid.onnx', 'labels.json', 'credits.json', 'credits_photos.csv', 'config.json']: z.write(os.path.join(OUT, name), name)
print(f'{len(CLASSES)} species · {len(used)} photos · {len(people)} photographers · check top-1 {best:.1%}')
print('Saved to Drive:', zip_path, f'({os.path.getsize(zip_path) / 1e6:.1f} MB)')
from google.colab import files
files.download(zip_path)
"""))

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4"},
      "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}},
      "nbformat": 4, "nbformat_minor": 0}
json.dump(nb, open(out, 'w'), indent=1, ensure_ascii=False)
print('cells:', len(cells))
