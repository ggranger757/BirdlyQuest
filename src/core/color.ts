// CIELAB + CIEDE2000. Pure math, deterministic, no DOM.
import { RGB } from './palette';

export type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function f(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Precomputed LUT for 0..255 → linear speeds up the pipeline ~3x.
const LIN = new Float64Array(256);
for (let i = 0; i < 256; i++) LIN[i] = srgbToLinear(i);
export function rgbToLabFast(r: number, g: number, b: number): Lab {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const DEG = Math.PI / 180;

export function deltaE2000(a: Lab, b: Lab): number {
  const [L1, a1, b1] = a;
  const [L2, a2, b2] = b;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) / DEG + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) / DEG + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * DEG);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * DEG) + 0.24 * Math.cos(2 * hbp * DEG)
    + 0.32 * Math.cos((3 * hbp + 6) * DEG) - 0.2 * Math.cos((4 * hbp - 63) * DEG);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * DEG) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

export const PAL_LAB: Lab[] = RGB.map(([r, g, b]) => rgbToLab(r, g, b));

/** Palette indices allowed for sprite fills (Eye #32 is reserved for eyes). */
const FILLABLE = PAL_LAB.map((_, i) => i).filter((i) => i !== 31);

/**
 * Snap a Lab colour to FIELD 32. Prefers hue match over lightness match
 * (PIX-5): lightness differences are down-weighted before ΔE2000.
 */
export function snapToPalette(lab: Lab, exclude: number[] = []): number {
  let best = 0, bestD = Infinity;
  for (const i of FILLABLE) {
    if (exclude.includes(i)) continue;
    const p = PAL_LAB[i];
    // lightness difference counts at 60% → hue/chroma match wins ties
    const d = deltaE2000([p[0] + (lab[0] - p[0]) * 0.6, lab[1], lab[2]], p);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Nearest palette entry noticeably darker than `idx`, same hue family. */
export function darker(idx: number, amount = 16): number {
  const [L, a, b] = PAL_LAB[idx];
  const target: Lab = [Math.max(4, L - amount), a * 0.9, b * 0.9];
  let best = idx, bestD = Infinity;
  for (const i of FILLABLE) {
    if (i === idx) continue;
    const p = PAL_LAB[i];
    if (p[0] >= L - 4) continue;
    const d = deltaE2000(target, p);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best === idx ? 0 : best;
}

/** Nearest palette entry noticeably lighter than `idx`. */
export function lighter(idx: number, amount = 14): number {
  const [L, a, b] = PAL_LAB[idx];
  const target: Lab = [Math.min(98, L + amount), a * 0.9, b * 0.9];
  let best = idx, bestD = Infinity;
  for (const i of FILLABLE) {
    if (i === idx) continue;
    const p = PAL_LAB[i];
    if (p[0] <= L + 4) continue;
    const d = deltaE2000(target, p);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function mixLab(a: Lab, b: Lab, t: number): Lab {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
