import { useEffect, useRef, useState } from 'react';
import type { Likely } from '../core/rarity';
import { useGame, counts } from '../app/store';
import { taxonSummary } from '../data/provider';
import { Icon, RarityTag } from './components';
import { refPhoto, type RefPhoto } from '../app/net';
import type { Species } from '../data/types';
import { Types } from './game';
import { sfx, haptic } from '../app/audio';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ─── real reference photos for the camera's Likely birds ───
// The tap is an explicit "show me this bird", so the card always fetches the photo (the
// Settings toggle only governs passive photos elsewhere). Photos are warmed when the camera
// opens so a tap shows the real bird immediately.
const peekCache = new Map<string, RefPhoto | null>();
const warmed = new Set<string>();
const toMedium = (u: string) => u.replace(/\/(square|small|thumb)\./, '/medium.');

async function loadPeekPhoto(sp: Species): Promise<RefPhoto | null> {
  if (peekCache.get(sp.id)) return peekCache.get(sp.id)!;
  let r = await refPhoto(sp).catch(() => null);
  // live iNaturalist species carry their own photo URL; use it when the licensed lookup comes back empty
  if (!r && sp.photo) r = { url: toMedium(sp.photo), square: sp.photo, attribution: '', license: '', taxonUrl: sp.inatId ? `https://www.inaturalist.org/taxa/${sp.inatId}` : '' };
  if (r) peekCache.set(sp.id, r);
  return r;
}

/** Fetch and decode the photos for the Likely birds in the background (called when the camera opens). */
export function warmPeekPhotos(list: Species[]) {
  for (const sp of list) {
    if (warmed.has(sp.id)) continue;
    warmed.add(sp.id);
    loadPeekPhoto(sp).then((r) => {
      if (!r) { warmed.delete(sp.id); return; } // try again next time
      for (const u of [r.square, r.url]) { const im = new Image(); im.decoding = 'async'; im.src = u; }
    });
  }
}

type PhotoState = { status: 'loading' | 'ok' | 'none' | 'offline'; photo?: RefPhoto };
function usePeekPhoto(sp: Species): [PhotoState, () => void] {
  const [st, setSt] = useState<PhotoState>(() => { const c = peekCache.get(sp.id); return c ? { status: 'ok', photo: c } : { status: 'loading' }; });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const c = peekCache.get(sp.id);
    setSt(c ? { status: 'ok', photo: c } : { status: 'loading' });
    if (!c) loadPeekPhoto(sp).then((r) => { if (live) setSt(r ? { status: 'ok', photo: r } : { status: navigator.onLine ? 'none' : 'offline' }); });
    return () => { live = false; };
  }, [sp.id, attempt]);
  // came back online while the card is open: try again automatically
  useEffect(() => {
    if (st.status !== 'offline') return;
    const on = () => setAttempt((a) => a + 1);
    window.addEventListener('online', on); return () => window.removeEventListener('online', on);
  }, [st.status]);
  return [st, () => setAttempt((a) => a + 1)];
}

/** The real bird: the small square shows at once (usually already cached), the full photo fades in over it. */
function PeekPhoto({ sp, state, retry }: { sp: Species; state: PhotoState; retry: () => void }) {
  const [big, setBig] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [small, setSmall] = useState(true);
  const p = state.photo;
  useEffect(() => { setBig('loading'); setSmall(true); }, [p?.url]);
  if (state.status === 'loading') return <div className="cam-peek-photo loading" aria-label={`Loading a photo of a ${sp.common}`}><span className="px small">Loading photo…</span></div>;
  if (!p) {
    return (
      <div className="cam-peek-photo empty">
        <span className="small">{state.status === 'offline' ? 'Photo needs a connection' : 'No open-licence photo yet'}</span>
        <button className="btn small" onClick={retry}>Try again</button>
      </div>
    );
  }
  return (
    <div className="cam-peek-photo">
      {small && <img className="lo" src={p.square} alt="" aria-hidden draggable={false} onError={() => setSmall(false)} />}
      {big !== 'failed' && (
        <img className={`hi${big === 'ok' ? ' in' : ''}`} src={p.url} alt={`Photo of a real ${sp.common}`} draggable={false}
          onLoad={() => setBig('ok')} onError={() => setBig('failed')} />
      )}
      {big === 'failed' && !small && (
        <div className="cam-peek-photo-fail"><span className="small">Photo didn’t load</span><button className="btn small" onClick={retry}>Try again</button></div>
      )}
    </div>
  );
}

/**
 * Vertical drag rail used for both zoom and brightness, so they feel identical:
 * drag up = more, drag down = less. The drag is relative (the thumb never jumps under
 * your finger), double-tap resets, arrow keys work, and it is a proper ARIA slider.
 * `log` maps the track logarithmically (zoom: 1→2× gets the same travel as 2→4×).
 */
export function CamRail({ label, icon, value, min, max, step, reset, log, format, onChange, side, travel = 170, idle, onActive }: {
  label: string; icon: string; value: number; min: number; max: number; step: number; reset: number; log?: boolean;
  format: (v: number) => string; onChange: (v: number) => void; side: 'left' | 'right'; travel?: number;
  /** hidden until used: faded out and not touchable (keyboard focus still reveals it) */
  idle?: boolean;
  /** told when a finger goes down on / lifts off the rail, so the parent can keep it shown */
  onActive?: (active: boolean) => void;
}) {
  const toT = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromT = (t: number) => { const tt = clamp(t, 0, 1); return log ? min * Math.pow(max / min, tt) : min + tt * (max - min); };
  const snap = (v: number) => clamp(Math.round(v / step) * step, min, max);
  const drag = useRef<{ y0: number; t0: number; id: number } | null>(null);
  const lastTap = useRef(0);
  const [active, setActive] = useState(false);
  const t = clamp(toT(value), 0, 1);
  const lastDetent = useRef(value);

  const set = (v: number) => {
    const nv = snap(v);
    if (nv === value) return;
    // a light tick when crossing the reset point or a whole step (1×, 2×, 0 EV…)
    if (Math.floor(nv) !== Math.floor(lastDetent.current) || (nv === reset && lastDetent.current !== reset)) haptic(4);
    lastDetent.current = nv;
    onChange(nv);
  };

  return (
    <div className={`cam-rail ${side}${active ? ' active' : ''}${idle && !active ? ' idle' : ''}`}
      role="slider" tabIndex={0} aria-label={label} aria-orientation="vertical"
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number(value.toFixed(2))} aria-valuetext={format(value)}
      onKeyDown={(e) => {
        const k = e.key;
        if (k === 'ArrowUp' || k === 'ArrowRight') { e.preventDefault(); set(log ? value * 1.1 : value + step); }
        else if (k === 'ArrowDown' || k === 'ArrowLeft') { e.preventDefault(); set(log ? value / 1.1 : value - step); }
        else if (k === 'Home') { e.preventDefault(); set(min); }
        else if (k === 'End') { e.preventDefault(); set(max); }
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        const now = performance.now();
        if (now - lastTap.current < 300) { set(reset); sfx.tap(); lastTap.current = 0; return; }
        lastTap.current = now;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { y0: e.clientY, t0: t, id: e.pointerId };
        setActive(true); onActive?.(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d || d.id !== e.pointerId) return;
        set(fromT(d.t0 + (d.y0 - e.clientY) / travel));
      }}
      onPointerUp={() => { drag.current = null; setActive(false); onActive?.(false); }}
      onPointerCancel={() => { drag.current = null; setActive(false); onActive?.(false); }}
      onFocus={() => onActive?.(true)} onBlur={() => onActive?.(false)}>
      <span className="cam-rail-icon" aria-hidden><Icon name={icon} size={18} /></span>
      <span className="cam-rail-track" style={{ height: travel }} aria-hidden>
        <span className="cam-rail-fill" style={{ height: `${t * 100}%` }} />
        {reset > min && reset < max && <span className="cam-rail-zero" style={{ bottom: `${toT(reset) * 100}%` }} />}
        <span className="cam-rail-thumb" style={{ bottom: `${t * 100}%` }}>
          <span className="cam-rail-value">{format(value)}</span>
        </span>
      </span>
    </div>
  );
}

/**
 * Bird card that slides over the live camera when you tap a Likely bird. The camera keeps
 * running above it, so getting back is instant: the big "Back to camera" button, a tap on
 * the live view, a swipe down, Esc, or the phone's Back gesture.
 */
export function BirdPeek({ list, index, onIndex, onClose, onMore }: {
  list: Likely[]; index: number; onIndex: (i: number) => void; onClose: () => void; onMore: (id: string) => void;
}) {
  const item = list[index];
  const sp = item.sp;
  const [photo, retryPhoto] = usePeekPhoto(sp);
  const ref = photo.photo;
  const found = useGame((s) => s.sightings.some((x) => x.speciesId === sp.id && counts(x)));
  const [summary, setSummary] = useState<string | null>(sp.summary ?? null);
  const [dy, setDy] = useState(0);
  const [dx, setDx] = useState(0);
  const g = useRef<{ x0: number; y0: number; axis: 'x' | 'y' | null; id: number } | null>(null);
  const backBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => { setSummary(sp.summary ?? null); if (!sp.fact && !sp.summary && sp.inatId) { let live = true; taxonSummary(sp.inatId).then((s) => live && setSummary(s)); return () => { live = false; }; } }, [sp.id]);
  useEffect(() => { backBtn.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < list.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [index, list.length, onClose, onIndex]);

  const go = (d: number) => { const n = index + d; if (n >= 0 && n < list.length) { sfx.move(); onIndex(n); } };

  // swipe down anywhere on the header/photo to close; swipe sideways to flip through the Likely birds
  const gesture = {
    onPointerDown: (e: React.PointerEvent) => { g.current = { x0: e.clientX, y0: e.clientY, axis: null, id: e.pointerId }; },
    onPointerMove: (e: React.PointerEvent) => {
      const s = g.current; if (!s || s.id !== e.pointerId) return;
      const mx = e.clientX - s.x0, my = e.clientY - s.y0;
      if (!s.axis && Math.hypot(mx, my) > 10) { s.axis = Math.abs(my) > Math.abs(mx) ? 'y' : 'x'; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      if (s.axis === 'y') setDy(Math.max(0, my));
      if (s.axis === 'x') setDx(mx);
    },
    onPointerUp: () => {
      const s = g.current; g.current = null;
      if (s?.axis === 'y' && dy > 70) onClose();
      if (s?.axis === 'x' && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      setDy(0); setDx(0);
    },
    onPointerCancel: () => { g.current = null; setDy(0); setDx(0); },
  };

  const blurb = sp.fact || summary;

  return (
    <div className="cam-peek" role="dialog" aria-modal="false" aria-label={`${sp.common}, likely bird ${index + 1} of ${list.length}`}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined }}>
      <div className="cam-peek-head" {...gesture}>
        <span className="cam-peek-grab" aria-hidden />
        <div className="row between" style={{ alignItems: 'center' }}>
          <span className="px small cam-peek-count">Likely · {index + 1} of {list.length}</span>
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn cam-peek-arrow" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous likely bird">‹</button>
            <button className="icon-btn cam-peek-arrow" onClick={() => go(1)} disabled={index === list.length - 1} aria-label="Next likely bird">›</button>
          </div>
        </div>
      </div>

      <div className="cam-peek-body">
        <div className="cam-peek-top" {...gesture} style={{ transform: dx ? `translateX(${dx * 0.4}px)` : undefined }}>
          <PeekPhoto sp={sp} state={photo} retry={retryPhoto} />
          <div className="cam-peek-id">
            <h3 className="cam-peek-name">{sp.common}</h3>
            {sp.sci && <div className="sci">{sp.sci}</div>}
            <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
              <RarityTag rarity={item.rarity} />
              <span className={`chip cam-peek-status${found ? ' moss' : ''}`}>{found ? '✓ In your BirdDex' : 'Not found yet'}</span>
            </div>
            {sp.sizeCm > 0 && <div className="small muted" style={{ marginTop: 6 }}>{sp.sizeCm} cm{sp.wingspanCm ? ` · wingspan ${sp.wingspanCm} cm` : ''} · {sp.familyName}</div>}
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10 }}><Types sp={sp} /></div>
        {blurb && <p className="small cam-peek-blurb">{sp.fact ? `“${sp.fact}”` : <>{summary}… <span className="muted">— Wikipedia, via iNaturalist</span></>}</p>}
        {ref && (ref.attribution || ref.license) && <p className="small muted cam-peek-credit">Photo: {[ref.attribution.replace(/\(c\)/i, '©'), ref.license].filter(Boolean).join(' · ')}{ref.taxonUrl && <> · <a href={ref.taxonUrl} target="_blank" rel="noopener">iNaturalist</a></>}</p>}
        <button className="link" onClick={() => onMore(sp.id)}>Full field guide page ›</button>
      </div>

      <div className="cam-peek-foot">
        <button ref={backBtn} className="btn primary big block" onClick={onClose}>
          <Icon name="photo" size={20} color="var(--accent-ink)" /> Back to camera
        </button>
      </div>
    </div>
  );
}
