// Professor Woods' RPG dialogue box (v1.30): framed lamp-lit portrait, name plate, typewriter text and a ▼ when done.
// Tap to finish the line at once. Used in Woods' Shop, the Trainer tab and anywhere else Merlin talks.
// `fit` (v1.51): the box is exactly as tall as her portrait and the text scrolls inside it. Tap to page down;
// at the end, a tap goes back to the top. ▼ shows while there is more below, ▲ at the end.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Professor, type WoodsMood } from './Characters';

export function MerlinSays({ text, name = 'Professor Woods', cast = 0, mood = 'curious', fit = false, children }: { text: string; name?: string; cast?: number; mood?: WoodsMood; fit?: boolean; children?: ReactNode }) {
  const [n, setN] = useState(0);
  const portrait = useRef<HTMLDivElement>(null), body = useRef<HTMLParagraphElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [more, setMore] = useState<'down' | 'top' | null>(null);

  useEffect(() => {
    setN(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(text.length); return; }
    const t = setInterval(() => setN((v) => { if (v >= text.length) { clearInterval(t); return v; } return v + 1; }), 18);
    return () => clearInterval(t);
  }, [text]);

  // fit: match the box to the portrait's height
  useLayoutEffect(() => {
    if (!fit || !portrait.current) return;
    const el = portrait.current, set = () => setH(el.getBoundingClientRect().height);
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // fit: keep the newest typed words in view while typing, and work out whether there's more to read
  const check = () => {
    const b = body.current; if (!b) return;
    const over = b.scrollHeight - b.clientHeight > 2;
    setMore(!over ? null : b.scrollTop + b.clientHeight >= b.scrollHeight - 2 ? 'top' : 'down');
  };
  useEffect(() => {
    if (!fit || !body.current) return;
    const b = body.current, typed = b.firstElementChild as HTMLElement | null;
    if (typed && n < text.length) { const bottom = typed.offsetTop + typed.offsetHeight; if (bottom > b.scrollTop + b.clientHeight) b.scrollTop = bottom - b.clientHeight; }
    check();
  }, [n, h, fit, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = () => {
    if (n < text.length) { setN(text.length); return; }
    const b = body.current; if (!fit || !b) return;
    if (b.scrollHeight - b.clientHeight <= 2) return;
    const atEnd = b.scrollTop + b.clientHeight >= b.scrollHeight - 2;
    b.scrollTo({ top: atEnd ? 0 : b.scrollTop + b.clientHeight - 20, behavior: 'smooth' });
  };
  const done = n >= text.length;

  return (
    <div className={`shop-npc ${fit ? 'npc-fit' : ''}`} onClick={tap}>
      <div ref={portrait} key={cast} className={`shop-npc-portrait woods-frame ${cast ? 'npc-hop' : ''}`}><Professor height={112} mood={mood} /></div>
      <div className="shop-npc-box dialog" style={fit && h ? { height: h } : undefined}>
        <span className="dialog-name">{name}</span>
        <p ref={body} className="dialog-text" aria-live="polite" onScroll={fit ? check : undefined}
          tabIndex={fit && more ? 0 : undefined} aria-label={fit && more ? `${name}. Tap to read more.` : undefined}>
          <span>{text.slice(0, n)}</span><span className="shop-npc-ghost" aria-hidden>{text.slice(n)}</span>
        </p>
        {children}
        {fit ? (done && more && <span className="shop-npc-next" aria-hidden>{more === 'down' ? '▼' : '▲'}</span>)
          : (done && !children && <span className="shop-npc-next" aria-hidden>▼</span>)}
      </div>
    </div>
  );
}
