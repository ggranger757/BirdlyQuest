// Owner-supplied character sprite sheets, drawn on a fixed grid so animation frames stay aligned.
//   Merlin (Professor): public/chars/merlin.png — 48px cells, row 0 = 4-frame wing-flap hover.
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

/** Professor Merlin: hovers on a 4-frame wing-flap loop. */
export function Professor({ height = 144 }: { height?: number }) {
  const scale = Math.max(1, Math.floor(height / 48));
  return <div className="hover-bob"><SheetSprite src="chars/merlin.png" cell={48} row={0} fps={6} scale={scale} label="Professor Merlin" /></div>;
}
