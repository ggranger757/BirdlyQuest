import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Full-screen view of a captured photo. Tap the photo, Escape or ✕ to close.
 *  Double-tap (or double-click) zooms 2.5× at that spot; pinch or the wheel zooms freely; drag to pan when zoomed. */
export function PhotoViewer({ src, fallback, alt, credit, pixelated, onClose }: { src: string; fallback?: string; alt: string; credit?: string; pixelated?: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(src);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ s: number; x: number; y: number; d: number; px: number; py: number } | null>(null);
  const moved = useRef(false), lastTap = useRef(0);
  const clamp = (s: number) => Math.min(5, Math.max(1, s));

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);

  const zoomAt = (s: number, cx: number, cy: number) => setZ((v) => {
    const ns = clamp(s); if (ns === 1) return { s: 1, x: 0, y: 0 };
    const ox = cx - window.innerWidth / 2, oy = cy - window.innerHeight / 2;
    return { s: ns, x: ox - ((ox - v.x) * ns) / v.s, y: oy - ((oy - v.y) * ns) / v.s };
  });
  const snap = () => {
    const ps = [...pts.current.values()];
    const d = ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
    const c = ps.length > 1 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps[0];
    start.current = c ? { ...z, d, px: c.x, py: c.y } : null;
  };

  return createPortal(
    <div className="pview" role="dialog" aria-modal="true" aria-label={alt}
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onWheel={(e) => zoomAt(z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY)}>
      <img src={url} alt={alt} draggable={false} onError={() => { if (fallback && url !== fallback) setUrl(fallback); }}
        className={pixelated ? 'pix' : ''}
        style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, cursor: z.s > 1 ? 'grab' : 'zoom-in' }}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = false; snap(); }}
        onPointerMove={(e) => {
          if (!pts.current.has(e.pointerId) || !start.current) return;
          pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const ps = [...pts.current.values()], st = start.current;
          if (ps.length > 1) {
            const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
            const s = clamp((st.s * d) / Math.max(1, st.d));
            setZ(s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: st.x, y: st.y }); moved.current = true;
          } else if (st.s > 1) {
            const dx = ps[0].x - st.px, dy = ps[0].y - st.py;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
            setZ({ s: st.s, x: st.x + dx, y: st.y + dy });
          }
        }}
        onPointerUp={(e) => {
          pts.current.delete(e.pointerId); snap();
          if (moved.current || pts.current.size) return;
          const now = Date.now();
          if (now - lastTap.current < 300) { lastTap.current = 0; z.s > 1 ? setZ({ s: 1, x: 0, y: 0 }) : zoomAt(2.5, e.clientX, e.clientY); }
          else lastTap.current = now;
        }}
        onPointerCancel={(e) => { pts.current.delete(e.pointerId); snap(); }} />
      <button className="pview-x" onClick={onClose} aria-label="Close photo">✕</button>
      {credit && <p className="pview-credit">Photo: {credit}</p>}
      <p className="pview-hint" aria-hidden>{z.s > 1 ? 'Drag to look around · double-tap to reset' : 'Pinch or double-tap to zoom'}</p>
    </div>,
    document.body,
  );
}
