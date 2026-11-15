// Tiny integer rasteriser for 32×32 part maps. Pixel centres are sampled at +0.5.
export const S = 32;

export type Buf = Uint8Array;

export function newBuf(): Buf {
  return new Uint8Array(S * S);
}

export function set(b: Buf, x: number, y: number, v: number) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && x < S && y >= 0 && y < S) b[y * S + x] = v;
}

export function get(b: Buf, x: number, y: number): number {
  if (x < 0 || x >= S || y < 0 || y >= S) return 0;
  return b[y * S + x];
}

export function ellipse(b: Buf, cx: number, cy: number, rx: number, ry: number, v: number, only?: number[]) {
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
  const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= S || y < 0 || y >= S) continue;
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        if (only && !only.includes(b[y * S + x])) continue;
        b[y * S + x] = v;
      }
    }
  }
}

export type Pt = [number, number];

function inPoly(px: number, py: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function poly(b: Buf, pts: Pt[], v: number, only?: number[]) {
  let x0 = S, x1 = 0, y0 = S, y1 = 0;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, Math.floor(x)); x1 = Math.max(x1, Math.ceil(x));
    y0 = Math.min(y0, Math.floor(y)); y1 = Math.max(y1, Math.ceil(y));
  }
  for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) {
      if (inPoly(x + 0.5, y + 0.5, pts)) {
        if (only && !only.includes(b[y * S + x])) continue;
        b[y * S + x] = v;
      }
    }
  }
  // Thin shapes can miss every pixel centre: stroke the outline so they never vanish.
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    line(b, a[0], a[1], c[0], c[1], v, only);
  }
}

export function line(b: Buf, x0: number, y0: number, x1: number, y1: number, v: number, only?: number[]) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(x0 + (x1 - x0) * t), y = Math.floor(y0 + (y1 - y0) * t);
    if (x < 0 || x >= S || y < 0 || y >= S) continue;
    if (only && !only.includes(b[y * S + x])) continue;
    b[y * S + x] = v;
  }
}
