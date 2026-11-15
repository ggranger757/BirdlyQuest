// PIX-1 capture + normalise. Re-encoding through a canvas strips all EXIF, including GPS (TEC-6, DOD-11).
import type { Analysis } from '../core/pixel/extract';

export const WORK = 512;

export interface Shot {
  blob: Blob;                 // stored original (≤2048px JPEG 0.9, no EXIF)
  rgba: Uint8ClampedArray;    // 512×512 working copy for the pipeline
  preview: string;            // object URL of the square crop for the reveal
  takenAt: Date;
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Normalise any drawable into a stored original + 512² working copy (square crop). */
export async function normalize(src: CanvasImageSource, sw: number, sh: number, crop?: { x: number; y: number; s: number }, filter?: string): Promise<Shot> {
  const s = crop ?? { x: (sw - Math.min(sw, sh)) / 2, y: (sh - Math.min(sw, sh)) / 2, s: Math.min(sw, sh) };
  const outS = Math.min(2048, Math.round(s.s));
  const big = canvas(outS, outS);
  const bctx = big.getContext('2d')!;
  if (filter) bctx.filter = filter;
  bctx.drawImage(src, s.x, s.y, s.s, s.s, 0, 0, outS, outS);
  const blob: Blob = await new Promise((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.9));
  const work = canvas(WORK, WORK);
  const wctx = work.getContext('2d', { willReadFrequently: true })!;
  wctx.imageSmoothingQuality = 'high';
  wctx.drawImage(big, 0, 0, WORK, WORK);
  const rgba = wctx.getImageData(0, 0, WORK, WORK).data;
  return { blob, rgba, preview: URL.createObjectURL(blob), takenAt: new Date() };
}

export async function fromFile(file: File): Promise<{ bmp: ImageBitmap; w: number; h: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  return { bmp, w: bmp.width, h: bmp.height };
}

/** Read EXIF DateTimeOriginal from a JPEG (CAM-8 anti-cheat). Returns null if absent. */
export async function exifDate(file: File): Promise<Date | null> {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;
    let off = 2;
    while (off < buf.byteLength - 4) {
      const marker = buf.getUint16(off);
      const len = buf.getUint16(off + 2);
      if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return parseTiff(buf, off + 10);
      off += 2 + len;
    }
  } catch { /* ignore */ }
  return null;
}

function parseTiff(v: DataView, t: number): Date | null {
  const le = v.getUint16(t) === 0x4949;
  const u16 = (o: number) => v.getUint16(t + o, le), u32 = (o: number) => v.getUint32(t + o, le);
  const readIfd = (o: number, want: number[]): Record<number, number> => {
    const n = u16(o), out: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12, tag = u16(e);
      if (want.includes(tag)) out[tag] = e;
    }
    return out;
  };
  const ifd0 = readIfd(u32(4), [0x8769, 0x0132]);
  let dateEntry: number | undefined;
  if (ifd0[0x8769]) {
    const exifIfd = readIfd(u32(ifd0[0x8769] + 8), [0x9003, 0x9004]);
    dateEntry = exifIfd[0x9003] ?? exifIfd[0x9004];
  }
  dateEntry ??= ifd0[0x0132];
  if (dateEntry === undefined) return null;
  const strOff = u32(dateEntry + 8);
  let s = '';
  for (let i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(t + strOff + i));
  const m = s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// ─── worker bridge ───
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: { analysis?: Analysis; error?: string }) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../core/pixel/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const cb = pending.get(e.data.id); pending.delete(e.data.id); cb?.(e.data); };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }
  return worker;
}

export async function analyze(rgba: Uint8ClampedArray, size = WORK, centerHint?: [number, number]): Promise<Analysis> {
  const w = getWorker();
  if (w) {
    const id = ++seq;
    const copy = rgba.slice();
    const res = await new Promise<{ analysis?: Analysis; error?: string }>((resolve) => {
      pending.set(id, resolve);
      w.postMessage({ id, rgba: copy.buffer, size, centerHint }, [copy.buffer]);
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ error: 'timeout' }); } }, 6000);
    });
    if (res.analysis) return res.analysis;
  }
  const { analyzePhoto } = await import('../core/pixel/extract');
  return analyzePhoto(rgba, size, { centerHint });
}
