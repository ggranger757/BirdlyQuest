// A tiny pixel-art kit (v1.29): draw shapes in materials, then shade them the way a pixel artist would.
// Light comes from the top-left; every shape gets a selective outline (a darker tone of its own colour), a lit rim,
// a shadowed underside, rounded volume on cylinders, material texture (wood grain, stone speckle, moss, metal sheen,
// glass glints) and soft halos for anything that glows. Pure RGBA output, so it runs in tests and tools too.

export type Tex = 'plain' | 'wood' | 'stone' | 'metal' | 'glass' | 'moss' | 'leaf' | 'glow' | 'seed' | 'cloth' | 'water' | 'bark';
export interface Mat { base: string; light?: string; dark?: string; line?: string; tex?: Tex; cyl?: boolean; alpha?: number; glow?: string; flat?: boolean }
type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k].map(Math.round) as RGB;
/** Shift towards warm light or cool shadow (pixel artists hue-shift rather than just darken). */
const lit = (c: RGB, k: number): RGB => mix(c, [255, 246, 214], k);
const shade = (c: RGB, k: number): RGB => mix(c, [24, 18, 46], k);
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const BAYER = [0, 2, 3, 1];

interface MatX { base: RGB; light: RGB; hi: RGB; dark: RGB; deep: RGB; line: RGB; tex: Tex; cyl: boolean; alpha: number; glow: RGB | null; flat: boolean }

export class Spr {
  readonly w: number; readonly h: number;
  private cell: Int16Array;
  private mats: MatX[] = [];
  private keyOf = new Map<Mat, number>();
  /** extra decoration pixels painted after shading (eyes, runes, seeds…) */
  private dots: { x: number; y: number; c: RGB; a: number }[] = [];
  constructor(w: number, h: number) { this.w = w; this.h = h; this.cell = new Int16Array(w * h).fill(-1); }

  private m(mat: Mat): number {
    let i = this.keyOf.get(mat);
    if (i != null) return i;
    const base = hex(mat.base);
    const x: MatX = {
      base, light: mat.light ? hex(mat.light) : lit(base, 0.28), hi: lit(mat.light ? hex(mat.light) : lit(base, 0.28), 0.35),
      dark: mat.dark ? hex(mat.dark) : shade(base, 0.32), deep: shade(mat.dark ? hex(mat.dark) : shade(base, 0.32), 0.3),
      line: mat.line ? hex(mat.line) : shade(base, 0.68), tex: mat.tex ?? 'plain', cyl: !!mat.cyl, alpha: mat.alpha ?? 1, glow: mat.glow ? hex(mat.glow) : null, flat: !!mat.flat,
    };
    i = this.mats.length; this.mats.push(x); this.keyOf.set(mat, i);
    return i;
  }
  px(x: number, y: number, mat: Mat) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cell[y * this.w + x] = this.m(mat); return this; }
  clear(x: number, y: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cell[y * this.w + x] = -1; return this; }
  rect(x: number, y: number, w: number, h: number, mat: Mat) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, mat); return this; }
  ellipse(cx: number, cy: number, rx: number, ry: number, mat: Mat) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / (rx + 0.01), dy = (y + 0.5 - cy) / (ry + 0.01);
      if (dx * dx + dy * dy <= 1) this.px(x, y, mat);
    }
    return this;
  }
  poly(pts: [number, number][], mat: Mat) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, mat);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, mat: Mat, thick = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; this.rect(Math.round(x - (thick - 1) / 2), Math.round(y - (thick - 1) / 2), thick, thick, mat); }
    return this;
  }
  /** A decoration pixel on top of the shading (eyes, runes, sparkles, seeds). */
  dot(x: number, y: number, color: string, a = 1) { this.dots.push({ x: Math.round(x), y: Math.round(y), c: hex(color), a }); return this; }
  has(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.cell[y * this.w + x] >= 0; }

  /** Shade everything and return RGBA pixels. */
  render(): Uint8ClampedArray {
    const { w, h, cell } = this, out = new Uint8ClampedArray(w * h * 4);
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : cell[y * w + x]);
    // per-row runs for cylinder shading
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y); if (i < 0) continue;
      const M = this.mats[i];
      const up = at(x, y - 1), dn = at(x, y + 1), lf = at(x - 1, y), rt = at(x + 1, y);
      const edge = up < 0 || dn < 0 || lf < 0 || rt < 0;
      let c = M.base;
      if (M.flat) { c = M.base; }
      else if (edge && (dn < 0 || rt < 0) && !(up < 0 && lf < 0)) c = M.line;                       // outline, heavier bottom-right
      else if (edge && (up < 0 || lf < 0)) c = M.tex === 'glass' ? M.hi : shade(M.light, 0.05);       // lit top-left edge
      else {
        // distance to the top and bottom of this material (volume), and to the left/right (cylinders)
        let t = 0; while (t < 4 && at(x, y - t - 1) === i) t++;
        let b = 0; while (b < 4 && at(x, y + b + 1) === i) b++;
        let l = 0; while (l < 12 && at(x - l - 1, y) === i) l++;
        let r = 0; while (r < 12 && at(x + r + 1, y) === i) r++;
        const d = BAYER[(x & 1) + ((y & 1) << 1)];
        if (M.cyl) {
          const k = l / Math.max(1, l + r);
          c = k < 0.18 ? M.light : k < 0.3 ? (d < 2 ? M.hi : M.light) : k > 0.82 ? M.dark : k > 0.7 ? (d < 2 ? M.dark : M.base) : M.base;
        } else {
          c = t === 0 ? M.light : t === 1 && d < 2 ? M.light : b === 0 ? M.dark : b === 1 && d < 2 ? M.dark : M.base;
        }
        if (up >= 0 && up !== i && this.mats[up].alpha === 1 && M.tex !== 'glow') c = shade(c, 0.22); // contact shadow under another material
        // material texture
        const hsh = hash(x, y);
        switch (M.tex) {
          case 'wood': if (M.cyl ? x % 3 === 1 && hsh % 5 !== 0 : (y % 3 === 1 && (x + (y >> 1)) % 7 < 4)) c = mix(c, M.dark, 0.32); if (hsh % 61 === 0) c = mix(c, M.deep, 0.6); break;
          case 'bark': if (x % 3 === 0 && hsh % 3) c = mix(c, M.dark, 0.8); if (hsh % 29 === 0) c = M.light; break;
          case 'stone': if (hsh % 9 === 0) c = mix(c, M.dark, 0.6); else if (hsh % 13 === 0) c = mix(c, M.light, 0.6); break;
          case 'moss': case 'leaf': c = hsh % 4 === 0 ? M.light : hsh % 5 === 0 ? M.dark : c; break;
          case 'metal': if (l === 1 || l === 2) c = M.hi; break;
          case 'glass': if ((x + y) % 7 === 0 && t < 4) c = M.hi; break;
          case 'seed': c = hsh % 3 === 0 ? M.dark : hsh % 5 === 0 ? M.light : c; break;
          case 'cloth': if ((x + y) % 4 === 0) c = mix(c, M.dark, 0.4); break;
          case 'water': c = (x + (y >> 1)) % 5 === 0 ? M.hi : c; break;
          case 'glow': c = t > 0 && b > 0 && l > 0 && r > 0 ? M.hi : M.light; break;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = Math.round(255 * M.alpha);
    }
    // glows: soft halo around emissive materials, behind the pixels
    const halo = new Float32Array(w * h * 3), ha = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y); if (i < 0 || !this.mats[i].glow) continue;
      const g = this.mats[i].glow!;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const dd = Math.hypot(dx, dy); if (dd > 4.2 || dd === 0) continue;
        const k = 0.09 * (1 - dd / 4.4), j = Y * w + X;
        halo[j * 3] += g[0] * k; halo[j * 3 + 1] += g[1] * k; halo[j * 3 + 2] += g[2] * k; ha[j] += k;
      }
    }
    for (let j = 0; j < w * h; j++) {
      if (ha[j] <= 0 || out[j * 4 + 3] > 0) continue;
      const a = Math.min(0.55, ha[j]);
      out[j * 4] = halo[j * 3] / ha[j]; out[j * 4 + 1] = halo[j * 3 + 1] / ha[j]; out[j * 4 + 2] = halo[j * 3 + 2] / ha[j];
      out[j * 4 + 3] = Math.round(255 * (BAYER[(j % w & 1) + ((((j / w) | 0) & 1) << 1)] < 4 * a / 0.55 ? a : a * 0.6));
    }
    for (const d of this.dots) {
      if (d.x < 0 || d.y < 0 || d.x >= w || d.y >= h) continue;
      const o = (d.y * w + d.x) * 4;
      out[o] = d.c[0]; out[o + 1] = d.c[1]; out[o + 2] = d.c[2]; out[o + 3] = Math.round(255 * d.a);
    }
    return out;
  }
}
