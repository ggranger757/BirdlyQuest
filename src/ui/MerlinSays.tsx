// Professor Woods' RPG dialogue box (v1.30): framed lamp-lit portrait, name plate, typewriter text and a ▼ when done.
// Tap to finish the line at once. Used in Woods' Shop, the Trainer tab and anywhere else Merlin talks.
import { useEffect, useState, type ReactNode } from 'react';
import { Professor, type WoodsMood } from './Characters';

export function MerlinSays({ text, name = 'Professor Woods', cast = 0, mood = 'curious', children }: { text: string; name?: string; cast?: number; mood?: WoodsMood; children?: ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return; }
    const t = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(t); return v; } return v + 1; }), 18);
    return () => clearInterval(t);
  }, [text]);
  return (
    <div className="shop-npc" onClick={() => setN(text.length)}>
      <div key={cast} className={`shop-npc-portrait woods-frame ${cast ? 'npc-hop' : ''}`}><Professor height={112} mood={mood} /></div>
      <div className="shop-npc-box dialog">
        <span className="dialog-name">{name}</span>
        <p className="dialog-text" aria-live="polite"><span>{text.slice(0, n)}</span><span className="shop-npc-ghost" aria-hidden>{text.slice(n)}</span></p>
        {children}
        {n >= text.length && !children && <span className="shop-npc-next" aria-hidden>▼</span>}
      </div>
    </div>
  );
}
