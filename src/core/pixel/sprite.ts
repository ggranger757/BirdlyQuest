// Sprite assembly: anatomy from the species, colour from the photo, pattern from the trait.
import { P, PART_COUNT, buildFrame, shapeFor, FrameName, FRAMES, Marks, Shape } from './archetypes';
import { S, Buf } from './raster';
import { IDX, CLEAR, ColorName } from '../palette';
import { Lab, PAL_LAB, snapToPalette, darker, lighter, deltaE2000, mixLab } from '../color';
import type { Species } from '../../data/types';

export const PIPELINE_VERSION = 3;

export type Variant = 'normal' | 'leucistic' | 'melanistic' | 'albino';
export type Pose = 'perched' | 'flight';

/** What gets persisted per catch. Frames are regenerated deterministically from this. */
export interface SpriteRecord {
  speciesId: string;
  parts: number[];      // palette index per part (length PART_COUNT)
  variant: Variant;
  pose: Pose;
  bg: number;           // palette index of the photo's background, for the card backdrop
  hash: string;         // photo hash
  spriteHash: string;   // hash of rendered idle0, for cross-device determinism checks
  version: number;
}

export interface PhotoPalette {
  clusters: { lab: Lab; weight: number }[];
  mean: Lab;
  bg: Lab;
  aspect: number;
}

const PHOTO_PARTS: number[] = [P.BODY, P.BELLY, P.WING, P.TAIL, P.HEAD, P.CROWN, P.CREST, P.BIB, P.MASK, P.CHEEK, P.WINGBAR, P.NAPE];
const HOST: Partial<Record<number, number>> = {
  [P.CROWN]: P.HEAD, [P.CREST]: P.HEAD, [P.BIB]: P.HEAD, [P.MASK]: P.HEAD, [P.CHEEK]: P.HEAD,
  [P.NAPE]: P.HEAD, [P.WINGBAR]: P.WING, [P.BELLY]: P.BODY, [P.WING]: P.BODY,
};
// Area weights per part when computing the species' mean colour (PIX-5 region weights).
const PART_WEIGHT: Partial<Record<number, number>> = {
  [P.HEAD]: 1.4, [P.CROWN]: 1.4, [P.BODY]: 1.2, [P.WING]: 1.2, [P.BELLY]: 1.0, [P.TAIL]: 0.8, [P.BIB]: 1.0,
};

function marksFor(sp: Species): Marks {
  const l = sp.look;
  return {
    crown: !!l.crown, nape: !!l.nape, cheek: sp.archetype === 'owl' ? true : !!l.cheek,
    crest: l.crest?.[0], bib: l.bib?.[0], mask: l.mask?.[0], wingbar: l.wingbar?.[0],
  };
}

export function speciesShape(sp: Species): Shape {
  return shapeFor(sp.archetype, sp.shape ?? {});
}

/** Default (field-guide) colours for each part. */
export function defaultParts(sp: Species): number[] {
  const l = sp.look;
  const c = (n: ColorName | undefined, fb: ColorName) => IDX[n ?? fb];
  const parts = new Array(PART_COUNT).fill(0);
  parts[P.BODY] = c(l.back, 'smoke');
  parts[P.BELLY] = c(l.belly, 'stone');
  parts[P.WING] = c(l.wing, l.back);
  parts[P.TAIL] = l.tail ? IDX[l.tail] : darker(IDX[l.wing], 8);
  parts[P.HEAD] = c(l.head, l.back);
  parts[P.CROWN] = c(l.crown, l.head);
  parts[P.CREST] = l.crest ? IDX[l.crest[1]] : parts[P.CROWN];
  parts[P.BEAK] = c(l.beak, 'slate');
  parts[P.LEG] = c(l.legs, 'umber');
  parts[P.EYE] = IDX.eye;
  parts[P.BIB] = l.bib ? IDX[l.bib[1]] : parts[P.HEAD];
  parts[P.MASK] = l.mask ? IDX[l.mask[1]] : sp.archetype === 'owl' ? IDX.sun : parts[P.HEAD];
  parts[P.CHEEK] = c(l.cheek, l.head);
  parts[P.WINGBAR] = l.wingbar ? IDX[l.wingbar[1]] : parts[P.WING];
  parts[P.FARWING] = darker(parts[P.WING], 12);
  parts[P.NAPE] = c(l.nape, l.head);
  // Ink is reserved for outlines and small markings: big black areas render as Plum
  // so a crow still reads against a dark journal page.
  for (const p of [P.BODY, P.BELLY, P.WING, P.TAIL, P.HEAD]) if (parts[p] === IDX.ink) parts[p] = IDX.plum;
  if (parts[P.CROWN] === IDX.ink && parts[P.HEAD] === IDX.plum) parts[P.CROWN] = IDX.ink;
  return parts;
}

function clampLab(l: Lab): Lab {
  return [Math.max(0, Math.min(100, l[0])), Math.max(-100, Math.min(100, l[1])), Math.max(-100, Math.min(100, l[2]))];
}

/**
 * PIX-5: map photo clusters onto the species' palette slots.
 * Each default slot colour pulls toward the photo cluster nearest to it, plus a
 * global light/white-balance shift. Then everything snaps back into FIELD 32.
 */
export function photoParts(sp: Species, photo: PhotoPalette): number[] {
  const def = defaultParts(sp);
  const out = def.slice();
  // weighted mean of the species' default colours
  let wsum = 0; const dm: Lab = [0, 0, 0];
  for (const p of PHOTO_PARTS) {
    const w = PART_WEIGHT[p] ?? 0.4; const lab = PAL_LAB[def[p]];
    dm[0] += lab[0] * w; dm[1] += lab[1] * w; dm[2] += lab[2] * w; wsum += w;
  }
  dm[0] /= wsum; dm[1] /= wsum; dm[2] /= wsum;
  const g: Lab = [
    Math.max(-14, Math.min(14, (photo.mean[0] - dm[0]) * 0.3)),
    Math.max(-10, Math.min(10, (photo.mean[1] - dm[1]) * 0.35)),
    Math.max(-10, Math.min(10, (photo.mean[2] - dm[2]) * 0.35)),
  ];
  const shifted: Record<number, Lab> = {};
  for (const p of PHOTO_PARTS) {
    const D = PAL_LAB[def[p]];
    const Dg: Lab = clampLab([D[0] + g[0], D[1] + g[1], D[2] + g[2]]);
    let best = photo.clusters[0], bestD = Infinity;
    for (const c of photo.clusters) {
      // prefer populous clusters a little
      const d = deltaE2000(Dg, c.lab) - Math.min(6, c.weight * 12);
      if (d < bestD) { bestD = d; best = c; }
    }
    const t = best ? Math.max(0.1, Math.min(0.75, 0.8 - Math.max(0, bestD) / 55)) : 0;
    const lab = best ? mixLab(Dg, best.lab, t) : Dg;
    shifted[p] = lab;
    out[p] = snapToPalette(lab, [IDX.eye]);
  }
  // Protect markings: a cap must not melt into the head that carries it.
  for (const p of PHOTO_PARTS) {
    const h = HOST[p];
    if (h === undefined || def[p] === def[h]) continue;
    if (out[p] === out[h]) {
      const alt = snapToPalette(shifted[p], [out[h], IDX.eye]);
      out[p] = deltaE2000(PAL_LAB[alt], PAL_LAB[def[p]]) < 30 ? alt : def[p];
    }
  }
  out[P.FARWING] = darker(out[P.WING], 12);
  return out;
}

export function applyVariant(parts: number[], v: Variant): number[] {
  if (v === 'normal') return parts;
  const out = parts.slice();
  for (const p of PHOTO_PARTS.concat([P.FARWING, P.BEAK, P.LEG])) {
    const [L, a, b] = PAL_LAB[parts[p]];
    let lab: Lab;
    if (v === 'leucistic') lab = [Math.min(96, L * 0.6 + 40), a * 0.2, b * 0.2];
    else if (v === 'melanistic') lab = [L * 0.6, a * 0.7, b * 0.7];
    else lab = p === P.BEAK || p === P.LEG ? [80, 20, 8] : [Math.min(97, 88 + L * 0.08), 1, 8];
    out[p] = snapToPalette(lab, [IDX.eye]);
  }
  if (v === 'albino') out[P.EYE] = IDX.robin;
  return out;
}

/** PIX-11: natural morphs only, seeded from the photo hash. */
export function rollVariant(hash: string): Variant {
  const n = parseInt(hash.slice(0, 8), 16) % 4096;
  if (n === 0) return 'albino';
  if (n <= 2) return 'melanistic';
  if (n <= 10) return 'leucistic';
  return 'normal';
}

// ─── frame rendering ───

function iridescentAlt(idx: number, k: number): number {
  const [L, a, b] = PAL_LAB[idx];
  const lab: Lab = k ? [Math.min(70, L + 10), a + 22, b - 28] : [Math.min(70, L + 8), a - 22, b + 6];
  return snapToPalette(lab, [IDX.eye, idx]);
}

function patternHit(pattern: Species['pattern'], part: number, x: number, y: number, ox: number, oy: number): number {
  // returns 0 none, 1 dark, 2 light/alt
  const u = x - ox + 64, v = y - oy + 64;
  switch (pattern) {
    case 'streaked':
      if (part === P.BELLY) return u % 2 === 0 && v % 3 !== 0 ? 1 : 0;
      if (part === P.BODY || part === P.WING) return u % 3 === 0 && v % 2 === 0 ? 1 : 0;
      return 0;
    case 'barred':
      if (part === P.BELLY || part === P.TAIL) return v % 2 === 0 ? 1 : 0;
      if (part === P.WING) return v % 3 === 0 ? 1 : 0;
      return 0;
    case 'spotted':
      if (part === P.WING || part === P.BODY || part === P.BELLY) return (u + (v % 4 === 0 ? 2 : 0)) % 4 === 0 && v % 2 === 0 ? 2 : 0;
      return 0;
    case 'mottled': {
      if (part !== P.WING && part !== P.BODY && part !== P.BELLY && part !== P.HEAD) return 0;
      const h = ((u * 73856093) ^ (v * 19349663)) >>> 0;
      return h % 5 === 0 ? 1 : h % 7 === 0 ? 2 : 0;
    }
    case 'iridescent':
      if (part === P.WING || part === P.BODY) return (u + v) % 5 === 0 && v % 2 === 0 ? 2 : 0;
      if (part === P.HEAD) return (u + v) % 6 === 0 ? 1 : 0;
      return 0;
  }
  return 0;
}

export interface RenderOpts { silhouette?: boolean }

const cache = new Map<string, Uint8Array[]>();

/** Render all FRAMES for a species + part palette. Deterministic. */
export function renderFrames(sp: Species, parts: number[], opts: RenderOpts = {}): Uint8Array[] {
  const key = `${sp.id}|${parts.join(',')}|${opts.silhouette ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const shape = speciesShape(sp);
  const marks = marksFor(sp);
  const raw = FRAMES.map((f) => renderOne(sp, shape, marks, parts, f, !!opts.silhouette));
  const merged = opts.silhouette ? raw : limitColors(raw, 12);
  if (cache.size > 400) cache.clear();
  cache.set(key, merged);
  return merged;
}

function renderOne(sp: Species, shape: Shape, marks: Marks, parts: number[], f: FrameName, sil: boolean): Uint8Array {
  const pm: Buf = buildFrame(shape, marks, f);
  const out = new Uint8Array(S * S).fill(CLEAR);
  const flying = f.startsWith('fly');
  const ox = flying ? 14 : shape.bx, oy = flying ? 17 : shape.by;

  if (sil) {
    for (let i = 0; i < S * S; i++) if (pm[i]) out[i] = IDX.slate;
    outline(out, pm, () => IDX.plum);
    return out;
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const part = pm[y * S + x];
      if (!part) continue;
      let c = parts[part];
      const hit = patternHit(sp.pattern, part, x, y, ox, oy);
      if (hit) {
        if (sp.pattern === 'iridescent') c = iridescentAlt(c, hit === 2 ? 1 : 0);
        else if (hit === 2 || sp.look.patternLight) c = lighter(c, 22);
        else c = darker(c, 16);
      }
      out[y * S + x] = c;
    }
  }
  // shading: lit from above
  const lit = new Set<number>([P.HEAD, P.CROWN, P.BODY, P.WING]);
  const shaded = new Set<number>([P.BELLY, P.BODY, P.TAIL, P.WING]);
  const copy = out.slice();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const part = pm[y * S + x];
      if (!part) continue;
      const above = y > 0 ? pm[(y - 1) * S + x] : 0;
      const below = y < S - 1 ? pm[(y + 1) * S + x] : 0;
      if (lit.has(part) && above === P.NONE && copy[y * S + x] === parts[part]) out[y * S + x] = lighter(parts[part], 10);
      else if (shaded.has(part) && (below === P.NONE || below === P.LEG) && copy[y * S + x] === parts[part]) out[y * S + x] = darker(parts[part], 12);
    }
  }
  // eye ring
  const ring = sp.look.eyeRing ? IDX[sp.look.eyeRing] : -1;
  if (ring >= 0 && shape.front === false) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (pm[y * S + x] !== P.EYE) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        const np = pm[ny * S + nx];
        if (np === P.HEAD || np === P.CROWN || np === P.MASK || np === P.CHEEK) out[ny * S + nx] = ring;
      }
    }
  }
  outline(out, pm, (nIdx, dir) => darker(nIdx, dir < 0 ? 18 : 30));
  return out;
}

/** Selective 1px outline in a darkened local hue. Thin parts (beak, legs) stay un-outlined. */
function outline(out: Uint8Array, pm: Buf, colorFor: (neighbour: number, dir: number) => number) {
  const add: [number, number][] = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (pm[y * S + x]) continue;
      const counts = new Map<number, number>();
      let dir = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const np = pm[ny * S + nx];
        if (!np || np === P.LEG || np === P.BEAK) continue;
        const c = out[ny * S + nx];
        counts.set(c, (counts.get(c) ?? 0) + 1);
        dir += dy; // neighbour below → we are above the bird (lit side)
      }
      if (!counts.size) continue;
      let best = 0, bc = -1;
      for (const [c, n] of counts) if (n > bc) { bc = n; best = c; }
      add.push([y * S + x, colorFor(best, dir > 0 ? -1 : 1)]);
    }
  }
  for (const [i, c] of add) out[i] = c;
}

/** PIX-7: cap distinct colours. Merge rarest into nearest, using one map for all frames. */
function limitColors(frames: Uint8Array[], max: number): Uint8Array[] {
  const counts = new Map<number, number>();
  for (const f of frames) for (const c of f) if (c !== CLEAR) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (counts.size <= max) return frames;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const keep = sorted.slice(0, max).map((e) => e[0]);
  if (!keep.includes(IDX.eye) && counts.has(IDX.eye)) keep[keep.length - 1] = IDX.eye;
  const map = new Map<number, number>();
  for (const [c] of sorted) {
    if (keep.includes(c)) continue;
    let best = keep[0], bd = Infinity;
    for (const k of keep) { if (k === IDX.eye) continue; const d = deltaE2000(PAL_LAB[c], PAL_LAB[k]); if (d < bd) { bd = d; best = k; } }
    map.set(c, best);
  }
  return frames.map((f) => f.map((c) => (map.has(c) ? map.get(c)! : c)));
}

export function fnv1a(bytes: ArrayLike<number>): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function choosePose(sp: Species, aspect: number): Pose {
  const wide = sp.archetype === 'waterfowl' || sp.archetype === 'seabird' || sp.archetype === 'wader' ? 2.6 : 1.8;
  return aspect > wide ? 'flight' : 'perched';
}

/** PIX-6 + PIX-7 + PIX-8: full deterministic assembly. */
export function assembleSprite(sp: Species, photo: PhotoPalette | null, hash: string): SpriteRecord {
  const variant = rollVariant(hash);
  let parts = photo && photo.clusters.length ? photoParts(sp, photo) : defaultParts(sp);
  parts = applyVariant(parts, variant);
  // quality gate: a broken render falls back to the default palette, tinted
  let frames = renderFrames(sp, parts);
  if (!passesGate(frames[0])) { parts = applyVariant(defaultParts(sp), variant); frames = renderFrames(sp, parts); }
  const bg = photo ? snapToPalette(photo.bg, [IDX.eye]) : IDX.plum;
  return {
    speciesId: sp.id, parts, variant, pose: photo ? choosePose(sp, photo.aspect) : 'perched', bg,
    hash, spriteHash: fnv1a(frames[0]), version: PIPELINE_VERSION,
  };
}

export function passesGate(f: Uint8Array): boolean {
  const distinct = new Set<number>();
  let opaque = 0;
  for (const c of f) if (c !== CLEAR) { distinct.add(c); opaque++; }
  return distinct.size <= 12 && opaque > 60;
}

export function silhouette(sp: Species): Uint8Array {
  return renderFrames(sp, defaultParts(sp), { silhouette: true })[0];
}
