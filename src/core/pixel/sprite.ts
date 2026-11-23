// Sprite assembly: shape from the owner's sprite sheet (see birds.ts), colour from the species and the photo.
import { P, PART_COUNT, shapeFor, Shape } from './archetypes';
import { IDX, CLEAR, RGB, ColorName } from '../palette';
import { birdFrames, type Frame } from './birds';
export type { Frame } from './birds';
import { Lab, PAL_LAB, snapToPalette, darker, deltaE2000, mixLab } from '../color';
import type { Species } from '../../data/types';

export const PIPELINE_VERSION = 4; // v4: sprites from the owner's 32-bit sheet

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

import { armorKey, type ArmorLook } from '../armor';
export interface RenderOpts { silhouette?: boolean; armor?: ArmorLook | null }

const cache = new Map<string, Frame[]>();

/** Render all FRAMES for a species + part palette (v1.27: built from the owner's sprite sheet). Deterministic. */
export function renderFrames(sp: Species, parts0: number[] | undefined, opts: RenderOpts = {}): Frame[] {
  const parts = parts0?.length ? parts0 : defaultParts(sp); // older or partial records fall back to field-guide colours
  const key = `${sp.id}|${parts.join(',')}|${opts.silhouette ? 1 : 0}|${armorKey(opts.armor)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let frames = birdFrames(sp, parts, defaultParts(sp), opts.silhouette ? null : opts.armor);
  if (opts.silhouette) {
    const [r, g, b] = RGB[IDX.slate];
    frames = frames.map((f) => { const o = f.map((v) => (v === CLEAR ? CLEAR : 0)) as Frame; o.pal = [[r, g, b]]; return o; });
  }
  if (cache.size > 400) cache.clear();
  cache.set(key, frames);
  return frames;
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
  let opaque = 0;
  for (const c of f) if (c !== CLEAR) opaque++;
  return opaque > 60;
}

export function silhouette(sp: Species): Uint8Array {
  return renderFrames(sp, defaultParts(sp), { silhouette: true })[0];
}
