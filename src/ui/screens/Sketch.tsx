import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { TopBar, Icon } from '../components';
import { HEX, NAMES } from '../../core/palette';
import { normalize, canvas } from '../../app/photo';
import { sfx } from '../../app/audio';

// CAM-10: a three-colour, 32×32 sketch. Counts as a catch at 40% XP, never earns photo badges.
export function Sketch() {
  const nav = useNav();
  const [cells, setCells] = useState<number[]>(() => new Array(1024).fill(-1));
  const [colors, setColors] = useState<number[]>([1, 9, 30]); // plum, bark, belly
  const [active, setActive] = useState(0);
  const [erase, setErase] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const g = ref.current!.getContext('2d')!;
    g.fillStyle = HEX[23]; g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 1024; i++) {
      if (cells[i] < 0) { if (((i % 32) + ((i / 32) | 0)) % 2) { g.fillStyle = '#C9E6EC'; g.fillRect(i % 32, (i / 32) | 0, 1, 1); } continue; }
      g.fillStyle = HEX[cells[i]]; g.fillRect(i % 32, (i / 32) | 0, 1, 1);
    }
  }, [cells]);

  const paint = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * 32), y = Math.floor(((e.clientY - r.top) / r.height) * 32);
    if (x < 0 || y < 0 || x > 31 || y > 31) return;
    setCells((c) => { const n = c.slice(); n[y * 32 + x] = erase ? -1 : colors[active]; return n; });
  };

  const done = async () => {
    const c = canvas(32, 32); const g = c.getContext('2d')!;
    g.fillStyle = HEX[23]; g.fillRect(0, 0, 32, 32);
    cells.forEach((v, i) => { if (v >= 0) { g.fillStyle = HEX[v]; g.fillRect(i % 32, (i / 32) | 0, 1, 1); } });
    const big = canvas(512, 512); const bg = big.getContext('2d')!; bg.imageSmoothingEnabled = false; bg.drawImage(c, 0, 0, 512, 512);
    const shot = await normalize(big, 512, 512);
    sfx.page();
    nav.replace({ name: 'catch', job: { mode: 'sketch', shot, returnTo: 'journal' } });
  };

  const filled = cells.filter((v) => v >= 0).length;
  return (
    <div className="overlay">
      <TopBar title="Sketch it" onBack={nav.back} backIcon="close" />
      <div className="screen">
        <p className="small muted" style={{ marginTop: 0 }}>Draw the bird’s shape in three colours. Sketches count as discoveries at 40% XP.</p>
        <canvas ref={ref} width={32} height={32} className="pix" style={{ width: '100%', aspectRatio: '1/1', height: 'auto', border: '2px solid var(--ink)', touchAction: 'none' }}
          onPointerDown={(e) => { drawing.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); paint(e); }}
          onPointerMove={(e) => drawing.current && paint(e)} onPointerUp={() => (drawing.current = false)} aria-label="32 by 32 drawing grid" />
        <div className="row mt16" style={{ gap: 8 }}>
          {colors.map((c, i) => (
            <button key={i} onClick={() => { setActive(i); setErase(false); }} onDoubleClick={() => setPicking(i)} aria-pressed={active === i && !erase}
              aria-label={`Colour ${i + 1}: ${NAMES[c]}`} style={{ width: 48, height: 48, background: HEX[c], border: active === i && !erase ? '3px solid var(--accent)' : '2px solid var(--ink)' }} />
          ))}
          <button className="btn small ghost" aria-pressed={erase} onClick={() => setErase((v) => !v)}>Erase</button>
          <button className="btn small ghost" onClick={() => setCells(new Array(1024).fill(-1))}>Clear</button>
        </div>
        <button className="link" onClick={() => setPicking(active)}>Change colour {active + 1}</button>
        {picking !== null && (
          <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
            {HEX.slice(0, 31).map((h, i) => (
              <button key={i} aria-label={NAMES[i]} onClick={() => { setColors((cs) => cs.map((c, j) => (j === picking ? i : c))); setPicking(null); }}
                style={{ aspectRatio: '1', minHeight: 36, background: h, border: '2px solid var(--ink)' }} />
            ))}
          </div>
        )}
        <button className="btn primary big block mt16" disabled={filled < 30} onClick={done}><Icon name="pencil" size={18} color="var(--ink)" /> File the sketch</button>
        {filled < 30 && <p className="small muted">Fill in a little more of the bird first.</p>}
      </div>
    </div>
  );
}
