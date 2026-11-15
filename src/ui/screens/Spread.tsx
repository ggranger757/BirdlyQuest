import { useEffect, useState } from 'react';
import { useNav } from '../nav';
import { useGame, speciesOf, updateNote, recordShare } from '../../app/store';
import { photoURL } from '../../app/db';
import { renderFrames } from '../../core/pixel/sprite';
import { HEX, CLEAR, RGB } from '../../core/palette';
import { RARITY_META } from '../../core/rarity';
import { Sprite, TopBar, RarityTag, formatDate, VERIFY_META, Icon } from '../components';
import { sfx } from '../../app/audio';

// COL-4: the journal spread. Left page photo, right page sprite + note. The shareable artifact.
export function Spread({ sightingId }: { sightingId: string }) {
  const nav = useNav();
  const s = useGame((st) => st.sightings.find((x) => x.id === sightingId));
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState(s?.note ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { photoURL(s?.photoId ?? null).then(setPhoto); }, [s?.photoId]);
  if (!s) return <div className="overlay"><TopBar title="Spread" onBack={nav.back} /><p className="screen">That sighting was removed.</p></div>;
  const sp = speciesOf(s);
  const name = sp.common;

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard(s, sp, name, photo, note);
      const file = new File([blob], `pixel-birder-${sp.id}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${name} · BirdlyQuest` });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); }
      recordShare(); sfx.sparkle();
    } catch { /* share sheet dismissed */ }
    setBusy(false);
  };

  return (
    <div className="overlay">
      <TopBar title="Journal spread" onBack={nav.back} right={<button className="icon-btn" onClick={share} disabled={busy} aria-label="Share spread"><Icon name="share" size={20} /></button>} />
      <div className="screen">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 #000' }}>
          <div className="paper" style={{ padding: 12, borderRight: '2px solid #cfc9b8', minHeight: 300 }}>
            <div className="taped tilt-l" style={{ width: '100%' }}>
              {photo ? <img src={photo} alt="Your photo" style={{ aspectRatio: '1/1', objectFit: 'cover', imageRendering: s.mode === 'sketch' ? 'pixelated' : 'auto' }} />
                : <div style={{ aspectRatio: '1/1', display: 'grid', placeItems: 'center', color: 'var(--smoke)', fontSize: 12 }}>Photo removed</div>}
            </div>
            <div className="mt16" style={{ color: 'var(--brick)', transform: 'rotate(-3deg)' }}>
              <span className="stampmark" style={{ fontSize: 11 }}>{formatDate(s.capturedAt, { day: 'numeric', month: 'short', year: 'numeric' })}<br />{s.region}</span>
            </div>
          </div>
          <div className="paper" style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: HEX[s.sprite.bg], border: '2px solid var(--ink)' }}><Sprite species={sp} parts={s.sprite.parts} scale={4} /></div>
            <h3 className="mt8" style={{ fontSize: 12, textAlign: 'center' }}>{name}</h3>
            {sp.sci && <div className="sci" style={{ fontSize: 12, textAlign: 'center' }}>{sp.sci}</div>}
            <div className="small mt8" style={{ color: 'var(--ink)' }}><span aria-hidden>{RARITY_META[s.rarity].glyph}</span> {RARITY_META[s.rarity].label} · {VERIFY_META[s.verification].label}</div>
            <label className="sr-only" htmlFor="note">Field note</label>
            <textarea id="note" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} onBlur={() => updateNote(s.id, note)}
              placeholder="Field note…" rows={5}
              style={{ width: '100%', marginTop: 8, background: 'transparent', border: 0, borderTop: '1px dashed #9a9484', color: 'var(--ink)', fontStyle: 'italic', fontSize: 15, resize: 'none', lineHeight: '22px',
                backgroundImage: 'repeating-linear-gradient(transparent 0 21px, #cfc9b8 21px 22px)' }} />
          </div>
        </div>
        <button className="btn primary big block mt24" onClick={share} disabled={busy}>{busy ? 'Inking the card…' : 'Share spread'}</button>
        <p className="small muted">Sharing is per item and makes an image. Nothing is uploaded by BirdlyQuest, and the card shows the region, never a location.</p>
      </div>
    </div>
  );
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** Render a 1080×1350 share card in FIELD 32. */
export async function renderShareCard(s: ReturnType<typeof Object>, sp: any, name: string, photo: string | null, note: string): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  await document.fonts.load('40px Silkscreen').catch(() => {});
  g.fillStyle = '#14121F'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#E8E4D8'; g.fillRect(60, 160, W - 120, 1000);
  g.fillStyle = '#cfc9b8'; g.fillRect(W / 2 - 1, 160, 2, 1000);
  g.fillStyle = '#000'; g.fillRect(60 + 12, 1160, W - 120, 12);
  g.font = '44px Silkscreen'; g.fillStyle = '#F7F4E9'; g.fillText('BIRDLY', 60, 110); g.fillStyle = '#C6FF1A'; g.fillText('QUEST', 300, 110);
  // photo, taped and tilted
  if (photo) {
    const img = await loadImg(photo);
    if (img) {
      g.save(); g.translate(290, 470); g.rotate(-0.026);
      g.fillStyle = '#F7F4E9'; g.fillRect(-200, -200, 400, 440);
      g.imageSmoothingEnabled = s.mode !== 'sketch';
      g.drawImage(img, -186, -186, 372, 372);
      g.fillStyle = 'rgba(217,194,106,0.8)'; g.fillRect(-220, -214, 140, 30); g.fillRect(90, -214, 140, 30);
      g.restore();
    }
  }
  g.save(); g.translate(130, 820); g.rotate(-0.05); g.strokeStyle = '#A8452F'; g.lineWidth = 5; g.strokeRect(0, 0, 330, 110);
  g.font = '30px Silkscreen'; g.fillStyle = '#A8452F';
  g.fillText(new Date(s.capturedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(), 20, 48);
  g.fillText(s.region, 20, 92); g.restore();
  // sprite
  const f = renderFrames(sp, s.sprite.parts)[0];
  const px = 12, ox = W / 2 + (W / 2 - 60 - 32 * px) / 2, oy = 220;
  g.fillStyle = HEX[s.sprite.bg]; g.fillRect(ox - 8, oy - 8, 32 * px + 16, 32 * px + 16);
  for (let i = 0; i < 1024; i++) { if (f[i] === CLEAR) continue; const [r, gg, b] = RGB[f[i]]; g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(ox + (i % 32) * px, oy + ((i / 32) | 0) * px, px, px); }
  g.fillStyle = '#14121F'; g.font = '34px Silkscreen'; g.textAlign = 'center';
  wrap(g, name.toUpperCase(), W * 0.75 - 30, 690, 420, 42);
  g.font = 'italic 28px Inter'; g.fillStyle = '#4a4660'; if (sp.sci) g.fillText(sp.sci, W * 0.75 - 30, 790);
  g.font = '28px Inter'; g.fillStyle = '#14121F'; g.fillText(`${RARITY_META[s.rarity as keyof typeof RARITY_META].glyph} ${RARITY_META[s.rarity as keyof typeof RARITY_META].label}`, W * 0.75 - 30, 840);
  if (note) { g.font = 'italic 28px Inter'; g.fillStyle = '#2B2440'; wrap(g, note, W * 0.75 - 30, 910, 400, 38); }
  g.textAlign = 'left'; g.font = '24px Silkscreen'; g.fillStyle = '#B9BCC9'; g.fillText('DISCOVER REAL BIRDS WITH YOUR CAMERA', 60, 1260);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) g.fillText(line, x, y);
}
