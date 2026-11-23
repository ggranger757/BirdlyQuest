import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, ReactNode, useSyncExternalStore } from 'react';
import type { Species } from '../data/types';
import { renderFrames, defaultParts, silhouette, type Frame } from '../core/pixel/sprite';
import { FLY_FRAMES, FLY_MS } from '../core/pixel/birds';
import { armorKey, type ArmorLook } from '../core/armor';
import { RGB, CLEAR } from '../core/palette';
import { RARITY_META, Rarity } from '../core/rarity';
import type { Verification } from '../core/model';
import { refPhoto, RefPhoto } from '../app/net';
import { getState, useGame } from '../app/store';

// ─── motion preference ───
const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export function useReducedMotion(): boolean {
  const pref = useGame((s) => s.settings.motion);
  const sys = useSyncExternalStore((cb) => { mq?.addEventListener('change', cb); return () => mq?.removeEventListener('change', cb); }, () => !!mq?.matches);
  return pref === 'reduced' || (pref === 'system' && sys);
}
export function reducedMotionNow(): boolean {
  const p = getState().settings.motion;
  return p === 'reduced' || (p === 'system' && !!mq?.matches);
}

// ─── shared animation clock (one rAF for every sprite on screen) ───
type Tick = (t: number) => void;
const ticks = new Set<Tick>();
let rafId = 0;
function loop(t: number) { ticks.forEach((f) => f(t)); rafId = ticks.size ? requestAnimationFrame(loop) : 0; }
export function onTick(f: Tick): () => void {
  ticks.add(f);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => { ticks.delete(f); };
}

// ─── drawing ───
const imgCache = new WeakMap<Uint8Array, ImageData>();
export function frameImage(f: Uint8Array, eyeOverride?: number): ImageData {
  const hit = imgCache.get(f);
  if (hit && eyeOverride === undefined) return hit;
  const img = new ImageData(32, 32);
  const pal = (f as Frame).pal ?? RGB;
  for (let i = 0; i < 1024; i++) {
    const v = f[i];
    if (v === CLEAR) continue;
    const c = pal[v];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  if (eyeOverride === undefined) imgCache.set(f, img);
  return img;
}

const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (scratch) { scratch.width = 32; scratch.height = 32; }
/** Draw a 32×32 frame onto any context at integer position/scale, optionally mirrored. */
export function drawFrame(ctx: CanvasRenderingContext2D, f: Uint8Array, x: number, y: number, scale = 1, flip = false) {
  const sctx = scratch!.getContext('2d')!;
  sctx.clearRect(0, 0, 32, 32);
  sctx.putImageData(frameImage(f), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (flip) { ctx.translate(Math.round(x) + 32 * scale, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(scratch!, 0, 0, 32 * scale, 32 * scale); }
  else ctx.drawImage(scratch!, Math.round(x), Math.round(y), 32 * scale, 32 * scale);
  ctx.restore();
}

export type SpriteMode = 'idle' | 'fly' | 'static' | 'silhouette';

/** Animated sprite: idle head-bob, blink every 4–7s, tail flick / peck now and then; flight is an 8-frame wingbeat (`flapMs` per frame). */
export function Sprite({ species, parts, mode = 'idle', scale = 4, bg, label, flip, className, flapMs = FLY_MS, armor }: {
  species: Species; parts?: number[]; mode?: SpriteMode; armor?: ArmorLook | null; scale?: number; bg?: string; label?: string; flip?: boolean; className?: string; flapMs?: number;
}) {
  const flapRef = useRef(flapMs); flapRef.current = flapMs;
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const frames = mode === 'silhouette' ? [silhouette(species)] : renderFrames(species, parts ?? defaultParts(species), { armor });
    const paint = (i: number) => {
      ctx.clearRect(0, 0, 32, 32);
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, 32, 32); }
      const img = frameImage(frames[i] ?? frames[0]);
      if (bg) { const s = scratch!.getContext('2d')!; s.clearRect(0, 0, 32, 32); s.putImageData(img, 0, 0); ctx.drawImage(scratch!, 0, 0); }
      else ctx.putImageData(img, 0, 0);
    };
    if (mode === 'static' || mode === 'silhouette' || reduced) { paint(mode === 'fly' ? 10 : 0); return; }
    // per-instance randomness only affects timing, never pixels
    let nextBlink = performance.now() + 4000 + Math.random() * 3000;
    let nextAction = performance.now() + 6000 + Math.random() * 6000;
    let actionUntil = 0, action = 5, last = -1;
    const stop = onTick((t) => {
      let i: number;
      if (mode === 'fly') { const ms = flapRef.current; i = 8 + (Math.floor(t / ms) % FLY_FRAMES); }
      else {
        if (t > nextBlink) { if (t > nextBlink + 170) nextBlink = t + 4000 + Math.random() * 3000; }
        if (t > nextAction && !actionUntil) { actionUntil = t + 340; action = Math.random() < 0.5 ? 5 : 6; }
        if (actionUntil && t > actionUntil) { actionUntil = 0; nextAction = t + 6000 + Math.random() * 6000; }
        if (actionUntil) i = action;
        else if (t > nextBlink && t < nextBlink + 170) i = 4;
        else i = Math.floor(t / 166) % 4;
      }
      if (i !== last) { paint(i); last = i; }
    });
    return stop;
  }, [species, parts?.join(','), mode, reduced, bg, armorKey(armor)]);
  return (
    <canvas ref={ref} width={32} height={32} className={`pix ${className ?? ''}`} role="img" aria-label={label ?? species.common}
      style={{ width: 32 * scale, height: 32 * scale, transform: flip ? 'scaleX(-1)' : undefined }} />
  );
}

// ─── pixel icons (12×12 bitmaps; inactive = auto outline) ───
const ICONS: Record<string, string[]> = {
  field: ['............', '.##......##.', '####....####', '####....####', '############', '############', '###.####.###', '###..##..###', '.##......##.', '.##......##.', '............', '............'],
  journal: ['............', '.##########.', '.#.#######..', '.#.#######..', '.#.#....##..', '.#.#######..', '.#.#....##..', '.#.#######..', '.#.#######..', '.##########.', '............', '............'],
  map: ['............', '....####....', '...######...', '..###..###..', '..###..###..', '..########..', '...######...', '....####....', '.....##.....', '.....##.....', '............', '............'],
  habitat: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '...######...', '..########..', '.##########.', '.....##.....', '.....##.....', '.##########.', '............'],
  you: ['............', '....####....', '...######...', '...######...', '...######...', '....####....', '............', '..########..', '.##########.', '.##########.', '.##########.', '............'],
  feather: ['.........##.', '........###.', '.......####.', '......####..', '.....####...', '....####....', '...####.....', '..####......', '..###.......', '.##.........', '.#..........', '............'],
  flame: ['.....#......', '.....##.....', '....###.....', '....####....', '...#####....', '...######...', '..###.###...', '..##...##...', '..##...##...', '...##.##....', '....###.....', '............'],
  back: ['............', '.....#......', '....##......', '...###......', '..##########', '.###########', '..##########', '...###......', '....##......', '.....#......', '............', '............'],
  close: ['............', '.##......##.', '.###....###.', '..###..###..', '...######...', '....####....', '....####....', '...######...', '..###..###..', '.###....###.', '.##......##.', '............'],
  grid: ['............', '...#....#...', '...#....#...', '############', '...#....#...', '...#....#...', '...#....#...', '############', '...#....#...', '...#....#...', '............', '............'],
  gear: ['.....##.....', '.##.####.##.', '.##########.', '..###..###..', '.###....###.', '####....####', '####....####', '.###....###.', '..###..###..', '.##########.', '.##.####.##.', '.....##.....'],
  share: ['.....##.....', '....####....', '...######...', '.....##.....', '.....##.....', '.....##.....', '.##..##..##.', '.##......##.', '.##......##.', '.##########.', '.##########.', '............'],
  photo: ['............', '...####.....', '############', '#..........#', '#...####...#', '#..#....#..#', '#..#....#..#', '#...####...#', '#..........#', '############', '............', '............'],
  pencil: ['.........##.', '........####', '.......####.', '......####..', '.....####...', '....####....', '...####.....', '..####......', '.####.......', '.###........', '.##.........', '............'],
  window: ['############', '#....##....#', '#....##....#', '#....##....#', '#....##....#', '############', '#....##....#', '#....##....#', '#....##....#', '#....##....#', '############', '............'],
  sun: ['.....##.....', '.#...##...#.', '..#......#..', '....####....', '...######...', '##.######.##', '##.######.##', '...######...', '....####....', '..#......#..', '.#...##...#.', '.....##.....'],
  house: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '############', '.##......##.', '.##.##....#.', '.##.##.##.#.', '.##.##.##.#.', '.##.##....#.', '.##########.'],
  tree: ['.....##.....', '....####....', '...######...', '..########..', '...######...', '..########..', '.##########.', '..########..', '.....##.....', '.....##.....', '.....##.....', '...######...'],
  wave: ['............', '..##....##..', '.#..#..#..#.', '#....##....#', '............', '..##....##..', '.#..#..#..#.', '#....##....#', '............', '..##....##..', '.#..#..#..#.', '#....##....#'],
  talon: ['.#...#...#..', '.#...#...#..', '##..##..##..', '##..##..##..', '.##.##.##...', '..#######...', '...#####....', '....###.....', '....###.....', '....##......', '...##.......', '..##........'],
  star: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..########..', '..###..###..', '.###....###.', '.##......##.', '............'],
  bag: ['....####....', '...#....#...', '...#....#...', '.##########.', '.#........#.', '.#.######.#.', '.#........#.', '.#........#.', '.#........#.', '.#........#.', '.##########.', '............'],
  chest: ['............', '.##########.', '#..........#', '#..........#', '############', '#....##....#', '#...#..#...#', '#....##....#', '#..........#', '#..........#', '############', '............'],
  chestOpen: ['.##########.', '#..........#', '.##########.', '............', '############', '#..........#', '#....##....#', '#...####...#', '#..........#', '#..........#', '############', '............'],
  zoom: ['............', '..#####.....', '.##...##....', '##..#..##...', '##.###.##...', '##..#..##...', '.##...##....', '..#######...', '.......###..', '........###.', '.........##.', '............'],
};

export function Icon({ name, size = 24, filled = true, color = 'currentColor', title }: { name: keyof typeof ICONS | string; size?: number; filled?: boolean; color?: string; title?: string }) {
  const rows = ICONS[name] ?? ICONS.close;
  const on = (x: number, y: number) => rows[y]?.[x] === '#';
  const rects: ReactNode[] = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '#') return;
    if (!filled && on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) return;
    rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
  }));
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill={color} shapeRendering="crispEdges" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}{rects}
    </svg>
  );
}

// ─── small pieces ───
export function RarityTag({ rarity, showLabel = true }: { rarity: Rarity; showLabel?: boolean }) {
  const m = RARITY_META[rarity];
  return (
    <span className="rar" aria-label={m.label}>
      <b style={{ color: rarity === 'mega' ? '#B48BE0' : m.color }} aria-hidden>{m.glyph}</b>{showLabel && <span>{m.label}</span>}
    </span>
  );
}

/** Opening-screen sky (the valley scene, flattened) used behind pixel birds on plates. */
export const SKY_PLATE_SRC = 'bg/valley/plate.png';
export const SKY_PLATE: import('react').CSSProperties = {
  backgroundImage: `url(${SKY_PLATE_SRC})`, backgroundSize: 'cover', backgroundPosition: '62% 100%', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated',
};

export const VERIFY_META: Record<Verification, { label: string; short: string; cls: string }> = {
  verified: { label: 'Verified', short: '✓', cls: 'moss' },
  'self-reported': { label: 'Self-reported', short: 'SR', cls: 'ash' },
  unverified: { label: 'Unidentified', short: '?', cls: 'ash' },
  vagrant: { label: 'Vagrant · pending', short: 'V', cls: 'rust' },
};

export function Meter({ value, max = 100, tone = '', label }: { value: number; max?: number; tone?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // stepped in 10% increments — no smooth bars in a pixel world
  const stepped = Math.round(pct / 5) * 5;
  return (
    <div className={`meter ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${stepped}%` }} />
    </div>
  );
}

export function TopBar({ title, onBack, right, backIcon = 'back' }: { title: string; onBack?: () => void; right?: ReactNode; backIcon?: 'back' | 'close' }) {
  return (
    <div className="topbar">
      {onBack ? <button className="icon-btn" onClick={onBack} aria-label={backIcon === 'close' ? 'Close' : 'Back'}><Icon name={backIcon} size={20} /></button> : <span style={{ width: 8 }} />}
      <h2>{title}</h2>
      {right}
    </div>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  // render at the app root so the sheet always sits at the bottom of the screen, whatever is scrolled
  const host = typeof document !== 'undefined' ? document.querySelector('.app') : null;
  const body = (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} style={{ transform: drag ? `translateY(${drag}px)` : undefined }}>
        <div className="grab"
          onPointerDown={(e) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) { const d = e.clientY - start.current; setDrag(d > 0 ? d : -Math.sqrt(-d) * 2); } }}
          onPointerUp={() => { if (drag > 90) onClose(); setDrag(0); start.current = null; }} />
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
  return host ? createPortal(body, host) : body;
}

export function useRefPhoto(sp: Species | null): RefPhoto | null | undefined {
  const enabled = useGame((s) => s.settings.refPhotos);
  const [r, setR] = useState<RefPhoto | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setR(undefined);
    if (!sp || !enabled) { setR(null); return; }
    refPhoto(sp).then((x) => live && setR(x));
    return () => { live = false; };
  }, [sp?.id, enabled]);
  return r;
}

/** Reference photo of the real species (iNaturalist, CC-licensed, attributed). Shown as a taped print. */
export function RefPhotoCard({ sp, compact }: { sp: Species; compact?: boolean }) {
  const r = useRefPhoto(sp);
  const enabled = useGame((s) => s.settings.refPhotos);
  if (!enabled) return null;
  if (r === undefined) return <div className="small muted">Loading a reference photo…</div>;
  if (r === null) return <div className="small muted">{navigator.onLine ? 'No openly licensed reference photo found for this species.' : 'Reference photo needs a connection once; then it is kept offline.'}</div>;
  return (
    <figure style={{ margin: 0 }}>
      <div className={`taped tilt-r`} style={{ width: compact ? 120 : '72%', maxWidth: 300 }}>
        <img src={r.url} alt={`Reference photo of a ${sp.common}`} loading="lazy" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
      </div>
      <figcaption className="small muted mt8">
        Reference photo: {r.attribution.replace(/\(c\)/i, '©')} · {r.license} · <a href={r.taxonUrl} target="_blank" rel="noopener">iNaturalist</a>
      </figcaption>
    </figure>
  );
}

export function RefThumb({ sp, size = 44 }: { sp: Species; size?: number }) {
  const r = useRefPhoto(sp);
  if (!r) return null;
  return <img src={r.square} alt="" width={size} height={size} loading="lazy" style={{ border: '2px solid var(--cream)', objectFit: 'cover', flex: 'none' }} />;
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [text]);
  return <div className="toast" role="status">{text}</div>;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString(undefined, opts);
}
