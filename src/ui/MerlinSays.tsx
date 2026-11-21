// Professor Merlin's RPG dialogue box (v1.30): framed lamp-lit portrait, name plate, typewriter text and a ▼ when done.
// Tap to finish the line at once. Used in Merlin's Shop, the Trainer tab and anywhere else Merlin talks.
import { useEffect, useState, type ReactNode } from 'react';
import { Professor } from './Characters';

export function MerlinSays({ text, name = 'Professor Merlin', cast = 0, children }: { text: string; name?: string; cast?: number; children?: ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return; }
    const t = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(t); return v; } return v + 1; }), 18);
    return () => clearInterval(t);
  }, [text]);
  return (
    <div className="shop-npc" onClick={() => setN(text.length)}>
      <div key={cast} className={`shop-npc-portrait ${cast ? 'npc-hop' : ''}`}><Professor height={104} /></div>
      <div className="shop-npc-box dialog">
        <span className="dialog-name">{name}</span>
        <p className="dialog-text" aria-live="polite"><span>{text.slice(0, n)}</span><span className="shop-npc-ghost" aria-hidden>{text.slice(n)}</span></p>
        {children}
        {n >= text.length && !children && <span className="shop-npc-next" aria-hidden>▼</span>}
      </div>
    </div>
  );
}
