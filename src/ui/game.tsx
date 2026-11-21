import { lensOf } from '../core/lenses';
// Collector-RPG UI kit: dialogue box, cursor menu, type chips, the Snap Capsule, real-bird thumbnails.
import { ReactNode, useEffect, useRef, useState } from 'react';
import type { Species } from '../data/types';
import { typesOf, TYPE_COLOR, TYPE_LABEL, BirdType } from '../core/rarity';
import { sfx } from '../app/audio';
import { useRefPhoto, reducedMotionNow } from './components';

/** Typewriter dialogue box. Tap to finish the line, tap again to advance. */
export function Dialog({ lines, onDone, speaker, children, auto, onLine }: { lines: string[]; onDone?: () => void; speaker?: string; children?: ReactNode; auto?: number; onLine?: (i: number) => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[Math.min(i, lines.length - 1)] ?? '';
  const done = shown >= line.length;
  useEffect(() => { setI(0); setShown(0); }, [lines.join('|')]);
  useEffect(() => { onLine?.(i); }, [i, lines.join('|')]);
  useEffect(() => {
    if (reducedMotionNow()) { setShown(line.length); return; }
    if (shown >= line.length) return;
    const t = setTimeout(() => { setShown((n) => n + 1); if (shown % 2 === 0 && line[shown] !== ' ') sfx.blip(); }, 24);
    return () => clearTimeout(t);
  }, [shown, line]);
  useEffect(() => {
    if (!done || !auto) return;
    const t = setTimeout(() => advance(), auto);
    return () => clearTimeout(t);
  }, [done, i]);
  const advance = () => {
    if (!done) { setShown(line.length); return; }
    if (i < lines.length - 1) { sfx.move(); setI(i + 1); setShown(0); }
    else onDone?.();
  };
  const last = i >= lines.length - 1;
  return (
    <div className="dialog" onClick={advance} role="dialog" aria-live="polite">
      {speaker && <div className="dialog-name">{speaker}</div>}
      <p className="dialog-text">{line.slice(0, shown)}<span className="sr-only">{line.slice(shown)}</span></p>
      {done && !children && (!last || onDone) && <span className="dialog-more" aria-hidden>▼</span>}
      {done && last && children}
    </div>
  );
}

/** Cursor menu (▶). Arrow keys or taps. */
export function Menu<T>({ items, render, onPick, label }: { items: T[]; render: (t: T) => ReactNode; onPick: (t: T) => void; label: string }) {
  const [cur, setCur] = useState(0);
  const ref = useRef<HTMLUListElement>(null);
  return (
    <ul className="menu" role="listbox" aria-label={label} ref={ref} tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { setCur((c) => Math.min(items.length - 1, c + 1)); sfx.move(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { setCur((c) => Math.max(0, c - 1)); sfx.move(); e.preventDefault(); }
        if (e.key === 'Enter') { sfx.select(); onPick(items[cur]); }
      }}>
      {items.map((t, k) => (
        <li key={k} role="option" aria-selected={k === cur}>
          <button className="menu-item" onPointerEnter={() => { if (k !== cur) { setCur(k); } }} onClick={() => { sfx.select(); onPick(t); }}>
            <span className="cursor" aria-hidden>{k === cur ? '▶' : ''}</span>{render(t)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TypeChip({ t }: { t: BirdType }) {
  return <span className="type-chip" style={{ background: TYPE_COLOR[t] }}>{TYPE_LABEL[t]}</span>;
}
export function Types({ sp }: { sp: Species }) {
  return <span className="row" style={{ gap: 4, display: 'inline-flex' }}>{typesOf(sp).map((t) => <TypeChip key={t} t={t} />)}</span>;
}

export const dexNo = (n?: number) => (n ? `#${String(n).padStart(3, '0')}` : '#???');

// The Snap Capsule: an original film-canister capture device (not a ball). 12×16 pixel art.
// Lens bodies: one shape per tier (16×16). A shell · a shade · k outline · w body · L lens ring · e lens dark · g glass · t trim · s gem
const BODIES: Record<string, string[]> = {
  common: [
    '...aaaaaaaa.....', '..aAAAAAAAAa....', '..aAAAAAAAAa....', '..kkkkkkkkkk....', '..wwwwwwwwww....', '..wkkkkkkkkw....', '..wkLLLLLLkw....', '..wkLeeeeLkw....',
    '..wkLeggeLkw....', '..wkLeggeLkw....', '..wkLeeeeLkw....', '..wkLLLLLLkw....', '..wkkkkkkkkw....', '..wwwwwwwwww....', '..kkkkkkkkkk....', '...kkkkkkkk.....',
  ].map((r) => `.${r.slice(0, 15)}`),
  rare: [
    '................', '....aaaaaaaa....', '...aAAAAAAAAa...', '...aAAAAAAAAa...', '.ttkkkkkkkkkktt.', '.twwwwwwwwwwwwt.', '..wkkkkkkkkkkw..', '..wkLLLLLLLLkw..',
    '..wkLeeeeeeLkw..', '..wkLeggggeLkw..', '..wkLeggggeLkw..', '..wkLeeeeeeLkw..', '..wkLLLLLLLLkw..', '..wkkkkkkkkkkw..', '..wwwwwwwwwwww..', '...kkkkkkkkkk...',
  ],
  epic: [
    '.......ss.......', '......aAAa......', '....aaAAAAaa....', 't..aAAAAAAAAa..t', 'tt.kkkkkkkkkk.tt', 'ttwwwwwwwwwwwwtt', '.twkkkkkkkkkkwt.', '..wkLLLLLLLLkw..',
    '..wkLeeeeeeLkw..', '..wkLegggseLkw..', '..wkLeggggeLkw..', '..wkLeeeeeeLkw..', '..wkLLLLLLLLkw..', '..wkkkkkkkkkkw..', '...wwwwwwwwww...', '....kkkkkkkk....',
  ],
};
const BODY_COL: Record<string, Record<string, string>> = {
  common: { k: '#0A0C0F', w: '#2F3A45', L: '#B6C0C9', e: '#1B2229', t: '#B6C0C9', s: '#FFFFFF' },
  rare: { k: '#0A0C0F', w: '#3A5A80', L: '#DDE6F0', e: '#14243A', t: '#C9D1D8', s: '#FFFFFF' },
  epic: { k: '#120A1F', w: '#4A2A78', L: '#E6D4FF', e: '#1E1033', t: '#B48BE0', s: '#FFFFFF' },
};
const CAP_COL: Record<string, string> = { a: '#8DB80F', A: '#C6FF1A', g: '#C6FF1A' };
export function Capsule({ size = 48, glow, className, style, lens }: { size?: number; glow?: boolean; className?: string; style?: React.CSSProperties; lens?: string }) {
  const L = lens ? lensOf(lens) : null;
  const tier = L?.tier ?? 'common';
  const body = BODIES[tier];
  // Rare lenses wear their own colour on the whole body (frame, rim and trim), so each one is easy to tell apart.
  const bc = L && tier === 'rare' ? { ...BODY_COL.rare, w: L.colors.a, t: L.colors.A, L: L.colors.g } : BODY_COL[tier];
  const col = (ch: string) => (L && (ch === 'A' || ch === 'a' || ch === 'g') ? L.colors[ch as 'A' | 'a' | 'g'] : CAP_COL[ch] ?? bc[ch]);
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" className={className} style={style} aria-hidden>
      {body.flatMap((row, y) => [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={glow && ch === 'g' ? '#F7F4E9' : col(ch)} />)))}
    </svg>
  );
}

// little pixel shapes for lens particle bursts (7×7)
const SHAPES: Record<string, string[]> = {
  star: ['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'x.....x'],
  heart: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...', '.......'],
  drop: ['...x...', '..xxx..', '..xxx..', '.xxxxx.', '.xxxxx.', '..xxx..', '.......'],
  leaf: ['.....xx', '...xxxx', '..xxxx.', '.xxxx..', '.xxx...', 'x......', '.......'],
  snow: ['...x...', '.x.x.x.', '..xxx..', 'xxxxxxx', '..xxx..', '.x.x.x.', '...x...'],
  diamond: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  bolt: ['....xx.', '...xx..', '..xxxx.', '....xx.', '...xx..', '..xx...', '.x.....'],
  feather: ['.....xx', '....xxx', '...xxx.', '..xxx..', '.xxx...', '.x.....', 'x......'],
  sparkle: ['...x...', '...x...', '..x.x..', 'xx...xx', '..x.x..', '...x...', '...x...'],
  ring: ['..xxx..', '.x...x.', 'x.....x', 'x.....x', 'x.....x', '.x...x.', '..xxx..'],
};
function PixelShape({ shape, color, size }: { shape: string; color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden style={{ display: 'block' }}>
      {SHAPES[shape].flatMap((r, y) => [...r].map((c, x) => (c === 'x' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  );
}
/** A burst of pixel particles flying out from the bird. */
export function ParticleBurst({ shape, colors, count, radius = 90, size = 14 }: { shape: string; colors: string[]; count: number; radius?: number; size?: number }) {
  if (reducedMotionNow()) return null;
  return (
    <div aria-hidden style={{ position: 'relative', width: 0, height: 0 }}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 2) * 0.3, r = radius * (0.65 + ((i * 37) % 10) / 28);
        return (
          <div key={i} className="particle" style={{ ['--dx' as any]: `${Math.cos(a) * r}px`, ['--dy' as any]: `${Math.sin(a) * r}px`, animationDelay: `${(i % 4) * 40}ms`, left: -size / 2, top: -size / 2 }}>
            <PixelShape shape={shape} color={colors[i % colors.length]} size={size + (i % 3) * 3} />
          </div>
        );
      })}
    </div>
  );
}

/** Real photo of the species: live list photo first, then the iNaturalist reference. */
export function BirdThumb({ sp, size = 48 }: { sp: Species; size?: number }) {
  const ref = useRefPhoto(sp.photo ? null : sp);
  const src = sp.photo ?? ref?.square;
  if (!src) return <span style={{ width: size, height: size, flex: 'none', background: 'var(--slate)', border: '2px solid #000', display: 'inline-block' }} aria-hidden />;
  return <img src={src} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size, objectFit: 'cover', border: '2px solid #000', boxShadow: '0 0 0 1px var(--smoke)', flex: 'none', background: 'var(--slate)' }} />;
}

/** Battle-style horizontal wipe (encounter transition). */
export function Wipe({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, reducedMotionNow() ? 50 : 650); return () => clearTimeout(t); }, []);
  return <div className="wipe" aria-hidden>{Array.from({ length: 10 }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 2 ? 9 - i : i) * 30}ms` }} />)}</div>;
}

/** Badge icon (owner-supplied 64×64 pixel art). Unearned badges show as a silhouette. */
export function BadgeIcon({ icon, earned, size = 48, label }: { icon?: string; earned: boolean; size?: number; label?: string }) {
  if (!icon) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return (
    <img src={`badges/${icon}.png`} alt={label ?? ''} width={size} height={size} className="pix"
      style={{ width: size, height: size, imageRendering: 'pixelated', filter: earned ? 'drop-shadow(2px 2px 0 #000)' : 'brightness(0) opacity(0.45)' }} />
  );
}

/** One-shot magic hit effect from the owner's fx sheet (8 frames, 128×96). */
export function FxHit({ size = 96 }: { size?: number }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (reducedMotionNow()) { setF(8); return; }
    let i = 0; const t = setInterval(() => { i++; setF(i); if (i >= 8) clearInterval(t); }, 70);
    return () => clearInterval(t);
  }, []);
  if (f >= 8) return null;
  const k = size / 96;
  return (
    <div aria-hidden style={{ width: 128 * k, height: 96 * k, backgroundImage: 'url(badges/fx_magic_hit.png)', backgroundRepeat: 'no-repeat',
      backgroundSize: `${1024 * k}px ${96 * k}px`, backgroundPosition: `${-f * 128 * k}px 0`, imageRendering: 'pixelated' }} />
  );
}

/** One sprite-sheet effect that plays once (frames laid out left to right). */
function FxSheet({ src, fw, fh, frames, fps, scale, delay = 0, style }: { src: string; fw: number; fh: number; frames: number; fps: number; scale: number; delay?: number; style?: React.CSSProperties }) {
  const [f, setF] = useState(-1);
  useEffect(() => {
    if (reducedMotionNow()) { setF(frames); return; }
    let i = -1; let t: ReturnType<typeof setInterval>;
    const d = setTimeout(() => { t = setInterval(() => { i++; setF(i); if (i >= frames) clearInterval(t); }, 1000 / fps); }, delay);
    return () => { clearTimeout(d); clearInterval(t); };
  }, []);
  if (f < 0 || f >= frames) return null;
  return <div aria-hidden style={{ position: 'absolute', width: fw * scale, height: fh * scale, backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat',
    backgroundSize: `${fw * frames * scale}px ${fh * scale}px`, backgroundPosition: `${-f * fw * scale}px 0`, imageRendering: 'pixelated', ...style }} />;
}

/** The equipped Snap Lens's recording effect, centred on (0,0) of its parent. */
export function LensFx({ lens, size = 140 }: { lens?: string; size?: number }) {
  const L = lensOf(lens); const { fx } = L;
  const big = Math.max(fx.fw, fx.fh);
  const at = (x: number, y: number, sc: number, key: string | number, extra: { delay?: number; rot?: number; filter?: string; cls?: string; style?: React.CSSProperties } = {}) => (
    <div key={key} className={extra.cls} style={{ position: 'absolute', left: x, top: y, transform: extra.rot ? `rotate(${extra.rot}deg)` : undefined, filter: extra.filter ?? L.filter, ...extra.style }}>
      <FxSheet {...fx} scale={sc} delay={extra.delay ?? 0} style={{ left: -fx.fw * sc / 2, top: -fx.fh * sc / 2 }} />
    </div>
  );
  const small = Math.max(2, Math.round(size / 3 / big * (fx.fw > 30 ? 1.4 : 1)));
  const ring = (n: number, r: number, rainbow = false) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 360;
    return at(Math.cos((a - 90) * Math.PI / 180) * r, Math.sin((a - 90) * Math.PI / 180) * r, small, i,
      { delay: i * 60, rot: fx.fw < 30 ? a : 0, filter: rainbow ? `hue-rotate(${(i * 360) / n}deg) ${L.filter ?? ''}` : undefined });
  });
  let body: React.ReactNode;
  switch (L.pattern) {
    case 'single': body = at(0, 0, size / big, 0); break;
    case 'double': body = <>{at(0, 0, size * 0.7 / big, 'a')}{at(0, 0, size * 1.05 / big, 'b', { delay: 220 })}</>; break;
    case 'ring3': body = ring(3, size * 0.38); break;
    case 'ring6': body = ring(6, size * 0.42); break;
    case 'rainbow': body = ring(6, size * 0.42, true); break;
    case 'orbit': body = <div className="fx-orbit" style={{ position: 'absolute', left: 0, top: 0 }}>{ring(5, size * 0.4)}</div>; break;
    case 'rain': {
      const sc = Math.max(2, Math.round(size / 40));
      body = [-55, -30, -8, 14, 36, 58, -42, 24].map((x, i) => at(x * size / 140, -size * 0.55, sc, i, { delay: i * 70, cls: 'fx-fall', style: { animationDelay: `${i * 70}ms` } }));
      break;
    }
    default: { // swarm: rising from around the bird
      const sc = Math.max(2, Math.round(size / 40 * (big > 30 ? 0.25 : 1)));
      body = [[-50, 20], [-24, -30], [10, 34], [36, -10], [52, 26], [-8, -56], [28, -48], [-46, -18], [0, 0]].map(([x, y], i) =>
        at(x * size / 140, y * size / 140, sc, i, { delay: i * 60, cls: 'fx-rise', style: { animationDelay: `${i * 60}ms` } }));
    }
  }
  return (
    <div aria-hidden style={{ position: 'relative', width: 0, height: 0 }}>
      {body}
      {L.particles && <ParticleBurst {...L.particles} radius={size * 0.62} size={L.tier === 'epic' ? 14 : 12} />}
    </div>
  );
}

/** Collector-style HP bar: green → amber → red. */
export function HpBar({ hp, compact }: { hp: number; compact?: boolean }) {
  const col = hp >= 50 ? '#6FA84B' : hp >= 25 ? '#E8A33D' : '#A8452F';
  return (
    <div className="row" style={{ gap: 6, width: '100%' }} role="meter" aria-label="Health" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}>
      {!compact && <span style={{ fontFamily: 'var(--px)', fontSize: 10, color: 'var(--accent)' }}>HP</span>}
      <div style={{ flex: 1, height: compact ? 5 : 8, background: '#000', border: '2px solid #000', position: 'relative', minWidth: 30 }}>
        <i style={{ position: 'absolute', inset: '0 auto 0 0', width: `${hp}%`, background: col, transition: 'width 500ms steps(10)' }} />
      </div>
      {!compact && <span className="num" style={{ fontSize: 11, minWidth: 44, textAlign: 'right' }}>{hp}/100</span>}
    </div>
  );
}
