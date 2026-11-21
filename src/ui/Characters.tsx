// Owner-supplied character sprite sheets, drawn on a fixed grid so animation frames stay aligned.
//   Professor Woods:    public/chars/woods-{curious,focused,delighted}.webp — 300×400 illustrations (not a sheet).
//   Rowan the druid:    public/chars/druid.png  — 84px cells (art drawn at 2×):
//     row 0 idle (4) · row 1 run (6) · row 2 hurt (3) · row 3 vanish (5) · row 4 staff sweep (6) · row 5 leap (6)
import { useEffect, useRef, useState } from 'react';
import { onTick, reducedMotionNow } from './components';

interface Sheet { img: HTMLImageElement; cell: number; frames: Record<number, number[]> }
const sheets = new Map<string, Promise<Sheet | null>>();

function loadSheet(src: string, cell: number): Promise<Sheet | null> {
  const key = `${src}|${cell}`;
  if (!sheets.has(key)) {
    sheets.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const frames: Record<number, number[]> = {};
          const rows = Math.floor(c.height / cell), cols = Math.floor(c.width / cell);
          for (let r = 0; r < rows; r++) {
            frames[r] = [];
            for (let k = 0; k < cols; k++) {
              let filled = 0;
              for (let y = r * cell; y < (r + 1) * cell && filled < 12; y += 2) for (let x = k * cell; x < (k + 1) * cell; x += 2) if (d[(y * c.width + x) * 4 + 3] > 60) filled++;
              if (filled >= 12) frames[r].push(k); // keep cells that hold a real frame
            }
          }
          resolve({ img, cell, frames });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return sheets.get(key)!;
}

/** Play one row of a sheet. `once` plays it a single time then calls onEnd and falls back to `idleRow`. */
export function SheetSprite({ src, cell, row, fps = 8, scale = 2, label, once, idleRow = 0, onEnd, flip }: {
  src: string; cell: number; row: number; fps?: number; scale?: number; label: string; once?: boolean; idleRow?: number; onEnd?: () => void; flip?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [sheet, setSheet] = useState<Sheet | null | undefined>(undefined);
  useEffect(() => { loadSheet(src, cell).then(setSheet); }, [src, cell]);
  useEffect(() => {
    if (!sheet || !ref.current) return;
    const g = ref.current.getContext('2d')!; g.imageSmoothingEnabled = false;
    const list = sheet.frames[row]?.length ? sheet.frames[row] : sheet.frames[idleRow] ?? [0];
    const paint = (k: number) => { g.clearRect(0, 0, cell, cell); g.drawImage(sheet.img, k * cell, row * cell, cell, cell, 0, 0, cell, cell); };
    const paintRow = (r: number, k: number) => { g.clearRect(0, 0, cell, cell); g.drawImage(sheet.img, k * cell, r * cell, cell, cell, 0, 0, cell, cell); };
    if (reducedMotionNow()) { paint(list[0]); if (once) onEnd?.(); return; }
    const t0 = performance.now(); let last = -1; let done = false;
    return onTick((t) => {
      const i = Math.floor(((t - t0) / 1000) * fps);
      if (once && i >= list.length) {
        if (!done) { done = true; onEnd?.(); }
        const idle = sheet.frames[idleRow] ?? [0]; const j = Math.floor((t / 1000) * 6) % idle.length;
        if (j !== last) { last = j; paintRow(idleRow, idle[j]); }
        return;
      }
      const f = list[i % list.length];
      if (f !== last) { last = f; paint(f); }
    });
  }, [sheet, row, once]);
  if (sheet === null) return null;
  return <canvas ref={ref} width={cell} height={cell} className="pix" role="img" aria-label={label}
    style={{ width: cell * scale, height: cell * scale, transform: flip ? 'scaleX(-1)' : undefined }} />;
}

/** Professor Woods (v1.31): the owner's illustrated mentor, in three expressions on the same 3:4 canvas.
 *  Always shown whole (never cropped) and bottom-aligned; `height` is the picture's height in px (width = 3/4 of it). */
export type WoodsMood = 'curious' | 'focused' | 'delighted';
export const WOODS_RATIO = 0.75;
const MOODS: WoodsMood[] = ['curious', 'focused', 'delighted'];
if (typeof window !== 'undefined') for (const m of MOODS) { const i = new Image(); i.src = `chars/woods-${m}.webp`; } // no flicker when she changes expression
export function Professor({ height = 144, mood = 'curious', framed }: { height?: number; mood?: WoodsMood; framed?: boolean }) {
  const w = Math.round(height * WOODS_RATIO);
  const img = <img className="woods" src={`chars/woods-${mood}.webp`} alt="Professor Woods" width={w} height={height} style={{ width: w, height }} draggable={false} />;
  return framed ? <span className="woods-frame">{img}</span> : img;
}
