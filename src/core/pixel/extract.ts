// PIX-2, PIX-5, CAM-6/7: photo analysis. Pure TS on RGBA bytes — runs in a worker.
import { rgbToLabFast, deltaE2000, Lab } from '../color';
import { fnv1a, PhotoPalette } from './sprite';

export interface FieldcraftScore {
  total: number;
  sharpness: number; exposure: number; size: number; framing: number; separation: number;
  coaching: string[];
  tooDark: boolean;
}

export interface Analysis {
  palette: PhotoPalette;
  bbox: { x: number; y: number; w: number; h: number }; // normalised 0–1
  maskArea: number;
  score: FieldcraftScore;
  hash: string;
  timings: Record<string, number>;
}

const A = 128; // analysis resolution

function downsample(rgba: Uint8ClampedArray | Uint8Array, size: number, to: number): Uint8Array {
  const out = new Uint8Array(to * to * 4);
  const f = size / to;
  for (let y = 0; y < to; y++) {
    for (let x = 0; x < to; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.floor(x * f), x1 = Math.floor((x + 1) * f), y0 = Math.floor(y * f), y1 = Math.floor((y + 1) * f);
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * size + xx) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
      }
      const o = (y * to + x) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = 255;
    }
  }
  return out;
}

/** Deterministic weighted k-means in Lab (max-min init, fixed iterations). */
export function kmeans(points: Lab[], weights: number[], k: number, iters = 10): { lab: Lab; weight: number }[] {
  if (!points.length) return [];
  k = Math.min(k, points.length);
  // init: weighted mean, then farthest points
  const mean: Lab = [0, 0, 0]; let ws = 0;
  points.forEach((p, i) => { const w = weights[i]; mean[0] += p[0] * w; mean[1] += p[1] * w; mean[2] += p[2] * w; ws += w; });
  mean[0] /= ws; mean[1] /= ws; mean[2] /= ws;
  const centers: Lab[] = [];
  let first = 0, fd = Infinity;
  points.forEach((p, i) => { const d = dist2(p, mean); if (d < fd) { fd = d; first = i; } });
  centers.push([...points[first]] as Lab);
  const minD = points.map((p) => dist2(p, centers[0]));
  while (centers.length < k) {
    let bi = 0, bd = -1;
    for (let i = 0; i < points.length; i++) if (minD[i] > bd) { bd = minD[i]; bi = i; }
    if (bd <= 1) break;
    centers.push([...points[bi]] as Lab);
    for (let i = 0; i < points.length; i++) minD[i] = Math.min(minD[i], dist2(points[i], centers[centers.length - 1]));
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < points.length; i++) {
      let b = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) { const d = dist2(points[i], centers[c]); if (d < bd) { bd = d; b = c; } }
      assign[i] = b;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]], w = weights[i], p = points[i];
      s[0] += p[0] * w; s[1] += p[1] * w; s[2] += p[2] * w; s[3] += w;
    }
    sums.forEach((s, c) => { if (s[3] > 0) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const tw = weights.reduce((a, b) => a + b, 0);
  const cw = centers.map(() => 0);
  for (let i = 0; i < points.length; i++) cw[assign[i]] += weights[i];
  return centers.map((lab, c) => ({ lab, weight: cw[c] / tw }))
    .filter((c) => c.weight > 0.01)
    .sort((a, b) => a.lab[0] - b.lab[0]); // sorted by luminance (PIX-5)
}

function dist2(a: Lab, b: Lab) { const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }

/** Otsu threshold over values in [0, max]. */
function otsu(vals: Float32Array, max: number): number {
  const bins = 64, hist = new Float64Array(bins);
  for (const v of vals) hist[Math.min(bins - 1, Math.floor((v / max) * bins))]++;
  const total = vals.length;
  let sum = 0; for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestT = 0;
  for (let t = 0; t < bins; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; bestT = t; }
  }
  return ((bestT + 0.5) / bins) * max;
}

export function analyzePhoto(rgba: Uint8ClampedArray | Uint8Array, size: number, opts: { centerHint?: [number, number] } = {}): Analysis {
  const t0 = now();
  const timings: Record<string, number> = {};
  const img = downsample(rgba, size, A);
  const lab: Lab[] = new Array(A * A);
  for (let i = 0; i < A * A; i++) lab[i] = rgbToLabFast(img[i * 4], img[i * 4 + 1], img[i * 4 + 2]);

  // hash: quantised 64×64 → robust to tiny decode differences
  const h64 = downsample(rgba, size, 64);
  const q = new Uint8Array(64 * 64 * 3);
  for (let i = 0; i < 64 * 64; i++) { q[i * 3] = h64[i * 4] >> 3; q[i * 3 + 1] = h64[i * 4 + 1] >> 3; q[i * 3 + 2] = h64[i * 4 + 2] >> 3; }
  const hash = fnv1a(q) + fnv1a(q.subarray(0, q.length >> 1));
  timings.normalize = now() - t0;

  // ── isolation: border colours = background; saliency = distance from bg × centre prior
  const t1 = now();
  const border: Lab[] = [];
  for (let i = 0; i < A; i += 2) {
    border.push(lab[i], lab[(A - 1) * A + i], lab[i * A], lab[i * A + A - 1]);
    border.push(lab[A + i], lab[(A - 2) * A + i], lab[i * A + 1], lab[i * A + A - 2]);
  }
  const bgClusters = kmeans(border, border.map(() => 1), 3, 6);
  const bgMain = bgClusters.slice().sort((a, b) => b.weight - a.weight)[0]?.lab ?? [50, 0, 0];
  const [hx, hy] = opts.centerHint ?? [0.5, 0.5];
  const sal = new Float32Array(A * A);
  let maxS = 1;
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < A; x++) {
      const p = lab[y * A + x];
      let d = Infinity;
      for (const c of bgClusters) d = Math.min(d, Math.sqrt(dist2(p, c.lab)));
      const dx = x / A - hx, dy = y / A - hy;
      const prior = Math.exp(-(dx * dx + dy * dy) / (2 * 0.3 * 0.3));
      const v = d * (0.35 + 0.65 * prior);
      sal[y * A + x] = v; if (v > maxS) maxS = v;
    }
  }
  const thr = Math.max(otsu(sal, maxS), maxS * 0.12);
  let mask: Uint8Array = new Uint8Array(A * A);
  for (let i = 0; i < A * A; i++) mask[i] = sal[i] > thr ? 1 : 0;
  mask = largestComponentNear(mask, Math.round(hx * A), Math.round(hy * A));
  let area = mask.reduce((a, b) => a + b, 0) / (A * A);
  if (area < 0.01 || area > 0.85) {
    // fallback: centre-weighted ellipse
    mask = new Uint8Array(A * A);
    for (let y = 0; y < A; y++) for (let x = 0; x < A; x++) {
      const dx = (x + 0.5) / A - hx, dy = (y + 0.5) / A - hy;
      if ((dx * dx) / 0.09 + (dy * dy) / 0.09 <= 1) mask[y * A + x] = 1;
    }
    area = mask.reduce((a, b) => a + b, 0) / (A * A);
  }
  let x0 = A, y0 = A, x1 = 0, y1 = 0;
  for (let y = 0; y < A; y++) for (let x = 0; x < A; x++) if (mask[y * A + x]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const bbox = { x: x0 / A, y: y0 / A, w: (x1 - x0 + 1) / A, h: (y1 - y0 + 1) / A };
  timings.isolate = now() - t1;

  // ── palette: k=6 over the masked subject, weighted by approximate part map
  const t2 = now();
  const pts: Lab[] = [], ws: number[] = [];
  const mean: Lab = [0, 0, 0]; let mw = 0;
  for (let y = 0; y < A; y++) for (let x = 0; x < A; x++) {
    if (!mask[y * A + x]) continue;
    const ry = (y - y0) / Math.max(1, y1 - y0);
    const w = ry < 0.3 ? 1.4 : ry < 0.6 ? 1.2 : ry < 0.85 ? 1.0 : 0.6;
    const p = lab[y * A + x];
    pts.push(p); ws.push(w);
    mean[0] += p[0] * w; mean[1] += p[1] * w; mean[2] += p[2] * w; mw += w;
  }
  if (mw) { mean[0] /= mw; mean[1] /= mw; mean[2] /= mw; }
  const clusters = kmeans(pts, ws, 6, 10);
  timings.reduce = now() - t2;

  // ── Fieldcraft score
  const t3 = now();
  const score = fieldcraft(rgba, size, lab, mask, bbox, area);
  timings.score = now() - t3;
  timings.total = now() - t0;

  return {
    palette: { clusters, mean, bg: bgMain, aspect: (bbox.w || 1) / (bbox.h || 1) },
    bbox, maskArea: area, score, hash, timings,
  };
}

function largestComponentNear(mask: Uint8Array, cx: number, cy: number): Uint8Array {
  const label = new Int32Array(A * A);
  let next = 1;
  let best = 0, bestScore = -Infinity;
  const sizes: number[] = [0];
  const stack: number[] = [];
  for (let i = 0; i < A * A; i++) {
    if (!mask[i] || label[i]) continue;
    let n = 0, sx = 0, sy = 0;
    stack.push(i); label[i] = next;
    while (stack.length) {
      const j = stack.pop()!; n++;
      const x = j % A, y = (j / A) | 0; sx += x; sy += y;
      if (x > 0 && mask[j - 1] && !label[j - 1]) { label[j - 1] = next; stack.push(j - 1); }
      if (x < A - 1 && mask[j + 1] && !label[j + 1]) { label[j + 1] = next; stack.push(j + 1); }
      if (y > 0 && mask[j - A] && !label[j - A]) { label[j - A] = next; stack.push(j - A); }
      if (y < A - 1 && mask[j + A] && !label[j + A]) { label[j + A] = next; stack.push(j + A); }
    }
    sizes.push(n);
    const d = Math.hypot(sx / n - cx, sy / n - cy) / A;
    const sc = Math.log(n + 1) - d * 6;
    if (sc > bestScore) { bestScore = sc; best = next; }
    next++;
  }
  const out = new Uint8Array(A * A);
  for (let i = 0; i < A * A; i++) out[i] = label[i] === best ? 1 : 0;
  // close small holes: fill pixels with ≥3 masked neighbours
  for (let pass = 0; pass < 2; pass++) {
    const c = out.slice();
    for (let y = 1; y < A - 1; y++) for (let x = 1; x < A - 1; x++) {
      const i = y * A + x; if (c[i]) continue;
      if (c[i - 1] + c[i + 1] + c[i - A] + c[i + A] >= 3) out[i] = 1;
    }
  }
  return out;
}

const COACH = {
  sharpness: 'Soft focus — brace your elbows.',
  exposureHi: 'Backlit — put the sun behind you.',
  exposureLo: 'Underexposed — find the bright side of the bird.',
  sizeSmall: 'Small in frame — get closer if you can, without flushing it.',
  sizeBig: 'Very tight — leave a little room around the bird.',
  framing: 'Off-balance — try the eye on a grid line.',
  separation: 'Busy background — wait for open sky or clear water behind it.',
};

function fieldcraft(rgba: Uint8ClampedArray | Uint8Array, size: number, lab: Lab[], mask: Uint8Array, bbox: Analysis['bbox'], area: number): FieldcraftScore {
  // sharpness: Laplacian variance on the subject crop at 256px
  const G = 256, gimg = downsample(rgba, size, G);
  const gray = new Float32Array(G * G);
  let hi = 0, lo = 0, lsum = 0;
  for (let i = 0; i < G * G; i++) {
    const v = 0.299 * gimg[i * 4] + 0.587 * gimg[i * 4 + 1] + 0.114 * gimg[i * 4 + 2];
    gray[i] = v; lsum += v;
    if (v > 250) hi++; if (v < 6) lo++;
  }
  const meanLuma = lsum / (G * G);
  const bx0 = Math.max(1, Math.floor(bbox.x * G)), by0 = Math.max(1, Math.floor(bbox.y * G));
  const bx1 = Math.min(G - 2, Math.ceil((bbox.x + bbox.w) * G)), by1 = Math.min(G - 2, Math.ceil((bbox.y + bbox.h) * G));
  let m = 0, m2 = 0, n = 0;
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const i = y * G + x;
    const l = gray[i - 1] + gray[i + 1] + gray[i - G] + gray[i + G] - 4 * gray[i];
    m += l; m2 += l * l; n++;
  }
  const lapVar = n ? m2 / n - (m / n) ** 2 : 0;
  const sharp = 30 * clamp01((Math.log(lapVar + 1) - Math.log(12)) / (Math.log(500) - Math.log(12)));

  // exposure
  const hiF = hi / (G * G), loF = lo / (G * G);
  let expPen = hiF * 3 + loF * 2;
  if (meanLuma < 55) expPen += (55 - meanLuma) / 55;
  if (meanLuma > 215) expPen += (meanLuma - 215) / 40;
  const exposure = 20 * (1 - clamp01(expPen));

  // subject size: ideal bbox 8–45% of the frame
  const a = bbox.w * bbox.h;
  const sizeS = a < 0.08 ? 20 * clamp01(a / 0.08) : a > 0.45 ? 20 * clamp01(1 - (a - 0.45) / 0.4) : 20;

  // framing: centroid to nearest thirds intersection (centre allowed at 70%) + headroom
  const cxn = bbox.x + bbox.w / 2, cyn = bbox.y + bbox.h / 2;
  let dmin = Infinity;
  for (const tx of [1 / 3, 2 / 3]) for (const ty of [1 / 3, 2 / 3]) dmin = Math.min(dmin, Math.hypot(cxn - tx, cyn - ty));
  const centre = Math.hypot(cxn - 0.5, cyn - 0.5);
  const fThirds = 1 - clamp01(dmin / 0.22), fCentre = 0.7 * (1 - clamp01(centre / 0.25));
  const headroom = bbox.y > 0.04 && bbox.y + bbox.h < 0.98 && bbox.x > 0.02 && bbox.x + bbox.w < 0.98 ? 1 : 0.4;
  const framing = 15 * (Math.max(fThirds, fCentre) * 0.7 + headroom * 0.3);

  // separation: ΔE across the mask edge
  let sep = 0, sn = 0;
  for (let y = 1; y < A - 1; y++) for (let x = 1; x < A - 1; x++) {
    const i = y * A + x; if (!mask[i]) continue;
    for (const j of [i - 1, i + 1, i - A, i + A]) if (!mask[j]) { sep += deltaE2000(lab[i], lab[j]); sn++; }
    if (sn > 4000) break;
  }
  const separation = 15 * clamp01((sn ? sep / sn : 0) / 25);

  const subs = { sharpness: sharp, exposure, size: sizeS, framing, separation };
  const norm: [keyof typeof subs, number][] = [
    ['sharpness', sharp / 30], ['exposure', exposure / 20], ['size', sizeS / 20], ['framing', framing / 15], ['separation', separation / 15],
  ];
  norm.sort((x, y) => x[1] - y[1]);
  const coaching: string[] = [];
  for (const [k, v] of norm.slice(0, 2)) {
    if (v > 0.85) continue;
    if (k === 'exposure') coaching.push(hiF * 3 > loF * 2 && meanLuma > 100 ? COACH.exposureHi : COACH.exposureLo);
    else if (k === 'size') coaching.push(a < 0.08 ? COACH.sizeSmall : COACH.sizeBig);
    else coaching.push(COACH[k]);
  }
  if (!coaching.length) coaching.push('Sharp. Good light. Good headroom.');
  const total = Math.round(sharp + exposure + sizeS + framing + separation);
  return {
    total, sharpness: Math.round(sharp), exposure: Math.round(exposure), size: Math.round(sizeS),
    framing: Math.round(framing), separation: Math.round(separation), coaching, tooDark: meanLuma < 22,
  };
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

/** Cheap live estimate for the viewfinder distance cue (CAM-4). */
export function estimateSubjectSize(rgba: Uint8ClampedArray | Uint8Array, size: number): number {
  const a = analyzePhoto(rgba, size);
  return a.bbox.w * a.bbox.h;
}
