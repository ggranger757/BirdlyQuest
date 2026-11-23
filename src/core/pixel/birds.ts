// Bird sprites built from the owner's 32-bit sprite sheet (v1.27).
// Species on the sheet use the original pixels; every other species is recoloured from the closest base shape,
// keeping the sheet's shading (per-pixel lightness offsets), with its own markings, pattern and photo tint.
// All animation frames (idle, blink, flick, peck, hop and an 8-frame wing flap) are generated from the base shape.
import { FORMS, SHEET, type Form } from './birdart';
import { P } from './archetypes';
import { IDX } from '../palette';
import { PAL_LAB, rgbToLab, type Lab } from '../color';
import type { Species } from '../../data/types';
import type { ArmorLook } from '../armor';
import { armorize } from './armor';

/** A 32×32 frame: indices into its own colour table (`pal`); 255 = clear. */
export type Frame = Uint8Array & { pal: [number, number, number][] };
export const CLEAR_PX = 255;
export const FLY_FRAMES = 8;
export const FLY_MS = 62;

const PART: Record<string, number> = {
  B: P.BODY, Y: P.BELLY, W: P.WING, F: P.FARWING, T: P.TAIL, H: P.HEAD, C: P.CROWN, X: P.CREST, K: P.BEAK,
  L: P.LEG, E: P.EYE, I: P.BIB, M: P.MASK, Q: P.CHEEK,
};
/** Shading value meaning 'white highlight' ('*' in a form's dl map). */
const GLINT = 999;
const HEADISH = new Set<number>([P.HEAD, P.CROWN, P.CREST, P.BEAK, P.EYE, P.MASK, P.CHEEK, P.NAPE]);

// ─── which shape each species uses ───
/** Species drawn on the owner's sheet → sheet index. */
export const DIRECT: Record<string, number> = {
  amegfi: 22, amerob: 23, balori: 24, cedwax: 26, daejun: 27, houspa: 29, norcar: 30, rewbla: 31, tuftit: 33,
  mallar: 3, cangoo: 7, ribgul: 10, rthhum: 18,
  grhowl: 34, snoowl: 35,   // the owner's owl sprites (tufted and round-headed)
};
const FORM_OF: Record<string, string> = {
  blujay: 'song-heavy', amecro: 'song-heavy', carcro: 'song-heavy', hoocro: 'song-heavy', eurjay: 'song-heavy', houcro: 'song-heavy', labcro: 'song-heavy',
  eurmag: 'song-heavy-tail', ausmag: 'song-heavy', copbar: 'song-heavy',
  moudov: 'song-dove', rocpig: 'song-dove', cowpig: 'song-dove', crepig: 'song-dove', ortdov: 'song-dove', picpig: 'song-dove', eardov: 'song-dove', laudov: 'song-dove', reedov: 'song-dove',
  eursta: 'song-long', commyn: 'song-long', cagsta: 'song-long', grekis: 'song-long', trokin: 'song-long', rufhor: 'song-long', shicow: 'song-long', noimin: 'song-long', whbnut: 'song-long',
  comgra: 'song-tail-long', asikoe: 'song-tail-long', maglar: 'song-tail-long', bladro: 'song-tail',
  yelwar: 'song-thin', yerwar: 'song-thin', comyel: 'song-thin', amered: 'song-thin', bawwar: 'song-thin', ovenbi: 'song-thin', comchi: 'song-thin', wlwwar: 'song-thin',
  blackc: 'song-thin', comnig: 'song-thin', eurwre: 'song-thin', warwhe: 'song-thin', eurrob: 'song-thin',
  lottit: 'song-tail-thin', whiwag: 'song-tail-thin', wilwag: 'song-tail-thin', supfai: 'song-tail-thin',
  pursun: 'song-curve', sdcsun: 'song-curve', afrhoo: 'song-curve', banana: 'song-curve',
  dowwoo: 'raptor-chisel', norfli: 'raptor-chisel', pilwoo: 'raptor-chisel', grswoo: 'raptor-chisel',
  roripa: 'raptor-parrot', railor: 'raptor-parrot', succoc: 'raptor-parrot', galah: 'raptor-parrot', laukoo: 'raptor-kooka',
  comloo: 'duck-loon', egygoo: 'goose', killde: 'gull-plover', soulap: 'gull-plover',
  categr: 'heron-short', inpher: 'heron-short', auwibi: 'heron-ibis', hadibi: 'heron-ibis', helgui: 'guinea',
};
const BY_FAMILY: Record<string, string> = {
  Columbidae: 'song-dove', Corvidae: 'song-heavy', Sturnidae: 'song-long', Icteridae: 'song-long', Mimidae: 'song-long', Tyrannidae: 'song-long',
  Parulidae: 'song-thin', Sylviidae: 'song-thin', Phylloscopidae: 'song-thin', Regulidae: 'song-thin', Troglodytidae: 'song-thin', Zosteropidae: 'song-thin',
  Muscicapidae: 'song-thin', Motacillidae: 'song-tail-thin', Aegithalidae: 'song-tail-thin', Maluridae: 'song-tail-thin', Rhipiduridae: 'song-tail-thin',
  Nectariniidae: 'song-curve', Upupidae: 'song-curve', Picidae: 'raptor-chisel', Psittacidae: 'raptor-parrot', Psittaculidae: 'raptor-parrot', Cacatuidae: 'raptor-parrot',
  Strigidae: 'owl', Tytonidae: 'owl', Accipitridae: 'raptor', Falconidae: 'raptor', Pandionidae: 'raptor', Cathartidae: 'raptor', Trochilidae: 'humm',
  Numididae: 'guinea', Phasianidae: 'guinea', Odontophoridae: 'guinea', Alcedinidae: 'raptor-kooka', Gaviidae: 'duck-loon', Laridae: 'gull',
  Charadriidae: 'gull-plover', Scolopacidae: 'gull-plover', Ardeidae: 'heron', Threskiornithidae: 'heron-ibis', Ciconiidae: 'heron', Gruidae: 'heron',
};
const BY_ARCH: Record<string, string> = {
  passerine: 'song', corvid: 'song-heavy', raptor: 'raptor', owl: 'owl', waterfowl: 'duck', wader: 'heron', seabird: 'gull',
  woodpecker: 'raptor-chisel', hummingbird: 'humm', gamebird: 'guinea', parrot: 'raptor-parrot', kingfisher: 'raptor-kooka',
};
export function formFor(sp: Species): string {
  if (DIRECT[sp.id] != null) return SHEET[DIRECT[sp.id]].base;
  if (FORM_OF[sp.id]) return FORM_OF[sp.id];
  if (sp.family === 'Anatidae') return (sp.sizeCm ?? 0) >= 55 ? 'goose' : 'duck';
  const f = BY_FAMILY[sp.family] ?? BY_ARCH[sp.archetype] ?? 'song';
  return f === 'owl' && !sp.look?.crest ? 'owl-round' : f;     // owls without ear tufts get the round-headed shape
}

// ─── colour helpers ───
function labToRgb([L, a, b]: Lab): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = f(fx) * 0.95047, Y = f(fy), Z = f(fz) * 1.08883;
  const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return lin.map((c) => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)))) as [number, number, number];
}
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sheetLab = (s: { pal: string[] }, k: string) => hexLab(s.pal[KEYS.indexOf(k)]);
const sheetRgb = (s: { pal: string[] }, k: string): [number, number, number] => { const h = s.pal[KEYS.indexOf(k)]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const still = (d: Lab) => Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) < 0.5;
const hexLab = (h: string): Lab => rgbToLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
const add = (a: Lab, d: Lab, k = 1): Lab => [Math.max(2, Math.min(99, a[0] + d[0] * k)), a[1] + d[1] * k, a[2] + d[2] * k];
const sub = (a: Lab, b: Lab): Lab => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ─── one bird, as coloured pixels ───
interface Px { x: number; y: number; part: number; lab: Lab; rgb?: [number, number, number] }

function patternLab(pattern: Species['pattern'], part: number, x: number, y: number, lab: Lab): Lab {
  const u = x + 64, v = y + 64;
  let hit = 0;
  switch (pattern) {
    case 'streaked': if (part === P.BELLY) hit = u % 2 === 0 && v % 3 !== 0 ? 1 : 0; else if (part === P.BODY || part === P.WING) hit = u % 3 === 0 && v % 2 === 0 ? 1 : 0; break;
    case 'barred': if (part === P.BELLY || part === P.TAIL) hit = v % 2 === 0 ? 1 : 0; else if (part === P.WING) hit = v % 3 === 0 ? 1 : 0; break;
    case 'spotted': if (part === P.WING || part === P.BODY || part === P.BELLY) hit = (u + (v % 4 === 0 ? 2 : 0)) % 4 === 0 && v % 2 === 0 ? 2 : 0; break;
    case 'mottled': if (part === P.WING || part === P.BODY || part === P.BELLY || part === P.HEAD) { const h = ((u * 73856093) ^ (v * 19349663)) >>> 0; hit = h % 5 === 0 ? 1 : h % 7 === 0 ? 2 : 0; } break;
    case 'iridescent': if (part === P.WING || part === P.BODY) hit = (u + v) % 5 === 0 && v % 2 === 0 ? 3 : 0; break;
  }
  if (hit === 1) return [lab[0] - 16, lab[1], lab[2]];
  if (hit === 2) return [Math.min(97, lab[0] + 24), lab[1] * 0.6, lab[2] * 0.6];
  if (hit === 3) return [Math.min(80, lab[0] + 14), lab[1] - 22, lab[2] - 18];
  return lab;
}

function zone(f: Form, k: string): [number, number][] {
  const z = f.zones[k] ?? [];
  const out: [number, number][] = [];
  for (let i = 0; i < z.length; i += 2) out.push([z[i], z[i + 1]]);
  return out;
}

export function birdPixels(sp: Species, parts: number[], defaults: number[]): Px[] {
  const fname = formFor(sp), f = FORMS[fname] ?? FORMS.song;
  const direct = DIRECT[sp.id] != null ? SHEET[DIRECT[sp.id]] : null;
  const look = sp.look ?? ({} as Species['look']);
  const col = (p: number) => PAL_LAB[parts[p] ?? parts[P.BODY]];
  // part per pixel, from the form, then the species' markings on top
  const part = new Map<number, number>(), dl = new Map<number, number>();
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const ch = f.rows[y][x];
    if (ch === '.') continue;
    if (ch === 'X' && !look.crest && !direct) continue;          // crest only on crested species
    part.set(y * 32 + x, PART[ch] ?? P.BODY);
    dl.set(y * 32 + x, f.dl[y][x] === '*' ? GLINT : (f.dl[y].charCodeAt(x) - 65) * 2 - 26);
  }
  if (!direct) {
    const mark = (k: string, p: number, only?: Set<number>) => { for (const [x, y] of zone(f, k)) { const i = y * 32 + x; if (part.has(i) && (!only || only.has(part.get(i)!))) part.set(i, p); } };
    if (look.crest) for (const [x, y] of zone(f, 'crest')) { const i = y * 32 + x; if (!part.has(i)) { part.set(i, P.CREST); dl.set(i, 4); } }
    const notEye = new Set([P.HEAD, P.CROWN, P.BELLY, P.BODY, P.BIB, P.CHEEK]);
    if (look.cheek) mark('cheek', P.CHEEK, notEye);
    if (look.nape) mark('nape', P.NAPE, new Set([P.HEAD, P.BODY, P.CROWN]));
    if (look.bib) mark(look.bib[0] === 'full' ? 'full' : 'throat', P.BIB, notEye);
    if (look.mask) mark(look.mask[0] === 'bold' ? 'maskBold' : 'maskThin', P.MASK, new Set([P.HEAD, P.CROWN, P.CHEEK, P.BIB, P.NAPE]));
    if (look.wingbar) mark(look.wingbar[0] === 'double' ? 'bar2' : 'bar1', P.WINGBAR, new Set([P.WING]));
  }
  const ring = !direct && look.eyeRing && f.eye ? PAL_LAB[IDX[look.eyeRing]] : null;
  const ringAt = new Set<number>();
  if (ring && f.eye) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const i = (f.eye[1] + dy) * 32 + f.eye[0] + dx; if (HEADISH.has(part.get(i) ?? -1) && part.get(i) !== P.BEAK) ringAt.add(i); }

  const out: Px[] = [];
  for (const [i, p] of part) {
    const x = i % 32, y = (i / 32) | 0;
    let lab: Lab;
    if (direct) {
      const k = direct.rows[y]?.[x];
      if (!k || k === '.') continue;
      // photo tint and colour morphs: shift the original by how far this catch's colour moved from the field-guide colour
      const d = sub(PAL_LAB[parts[p]], PAL_LAB[defaults[p]]);
      if (still(d)) { out.push({ x, y, part: p, lab: sheetLab(direct, k), rgb: sheetRgb(direct, k) }); continue; }
      lab = add(sheetLab(direct, k), d, 0.85);
    } else if (ringAt.has(i)) lab = ring!;
    else {
      const base = col(p), d = dl.get(i) ?? 0;
      if (d === GLINT) { out.push({ x, y, part: p, lab: [97, 0, 0] }); continue; } // a white catch-light (owl eyes)
      const k = p === P.EYE || p === P.BEAK || p === P.LEG ? 0.5 : base[0] < 22 ? 0.7 : 1;
      lab = [Math.max(3, Math.min(98, base[0] + d * k)), base[1] * (d > 8 ? 0.85 : 1), base[2] * (d > 8 ? 0.85 : 1)];
      if (sp.pattern && sp.pattern !== 'solid' && p !== P.EYE && p !== P.BEAK && p !== P.LEG) lab = patternLab(sp.pattern, p, x, y, lab);
    }
    out.push({ x, y, part: p, lab });
  }
  // direct sprites may have pixels the base map doesn't (a crest): keep them as head
  if (direct) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const k = direct.rows[y][x];
    if (k === '.' || part.has(y * 32 + x)) continue;
    const d = sub(PAL_LAB[parts[P.CREST]], PAL_LAB[defaults[P.CREST]]);
    out.push(still(d) ? { x, y, part: P.CREST, lab: sheetLab(direct, k), rgb: sheetRgb(direct, k) } : { x, y, part: P.CREST, lab: add(sheetLab(direct, k), d, 0.85) });
  }
  return out;
}

// ─── wings for flight ───
const WING_LEN: Record<string, number> = { song: 11, duck: 13, goose: 15, gull: 15, humm: 8, raptor: 15, owl: 12, heron: 15, guinea: 10 };
/** Wing angle per flight frame (degrees; 90 = straight up, −90 = straight down), eased like a real wingbeat. */
const FLAP = [82, 64, 30, -12, -48, -30, 8, 50];
const BOB = [1, 0, -1, -1, 0, 1, 1, 1];

function wingPixels(cx: number, cy: number, ang: number, len: number, dir: 1 | -1, colors: { lead: Lab; cov: Lab; prim: Lab; bar: Lab | null }, far: boolean): Px[] {
  const a = (ang * Math.PI) / 180;
  const ux = -Math.cos(a) * dir, uy = -Math.sin(a);           // along the wing (towards the back when level)
  const vx = uy * dir, vy = -ux * dir;                          // across, towards the trailing edge
  const chord = len * 0.46, out: Px[] = [];
  for (let y = Math.floor(cy - len - 2); y <= cy + len + 2; y++) for (let x = Math.floor(cx - len - 2); x <= cx + len + 2; x++) {
    const rx = x + 0.5 - cx, ry = y + 0.5 - cy;
    const t = rx * ux + ry * uy, s = rx * vx + ry * vy;
    if (t < -0.5 || t > len) continue;
    const k = Math.max(0, t) / len, w = chord * (1 - k ** 1.7) + 0.6;
    if (s < -1.1 || s > w) continue;
    if (s > w - 1.6 && k > 0.35 && Math.floor(t) % 3 === 2) continue; // separated flight-feather tips
    let lab = s < -0.2 ? colors.lead : k > 0.55 || s > w - 1.4 ? colors.prim : colors.cov;
    if (colors.bar && k > 0.3 && k < 0.42 && s > -0.2) lab = colors.bar;
    if (far) lab = [lab[0] * 0.78, lab[1] * 0.85, lab[2] * 0.85];
    out.push({ x, y, part: P.WING, lab });
  }
  return out;
}

// ─── frames ───
export const FRAME_NAMES = ['idle0', 'idle1', 'idle2', 'idle3', 'blink', 'flick', 'peck', 'hop', ...Array.from({ length: FLY_FRAMES }, (_, i) => `fly${i}`)] as const;

function pack(frames: Px[][]): Frame[] {
  const pal: [number, number, number][] = [], seen = new Map<string, number>();
  return frames.map((pxs) => {
    const f = new Uint8Array(1024).fill(CLEAR_PX) as Frame;
    for (const p of pxs) {
      if (p.x < 0 || p.y < 0 || p.x > 31 || p.y > 31) continue;
      const rgb = p.rgb ?? labToRgb(p.lab), key = rgb.join(',');
      let i = seen.get(key);
      if (i == null) { i = pal.length < 254 ? pal.length : nearest(pal, rgb); if (i === pal.length) { pal.push(rgb); seen.set(key, i); } }
      f[p.y * 32 + p.x] = i;
    }
    f.pal = pal;
    return f;
  });
}
function nearest(pal: [number, number, number][], c: [number, number, number]) {
  let best = 0, bd = Infinity;
  pal.forEach((p, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}
/** An owl's eyelid takes the colour of the face around the eyes (the sheet colour on hand-drawn owls). */
function lidColour(base: Px[], fallback: Lab): Lab {
  const face = base.filter((p) => p.part === P.HEAD && p.lab[0] > 12);
  if (!face.length) return fallback;
  const m = [0, 1, 2].map((k) => face.reduce((n, p) => n + p.lab[k], 0) / face.length) as Lab;
  return [Math.max(4, m[0] - 6), m[1], m[2]];
}
const shift = (pxs: Px[], dx: number, dy: number, which: (p: Px) => boolean, keep = true): Px[] => {
  const moved = pxs.filter(which).map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
  return [...(keep ? pxs : pxs.filter((p) => !which(p))), ...moved];
};

export function birdFrames(sp: Species, parts: number[], defaults: number[], armor?: ArmorLook | null): Frame[] {
  const fname = formFor(sp), f = FORMS[fname] ?? FORMS.song, family = fname.split('-')[0];
  const base = birdPixels(sp, parts, defaults);
  const isHead = (p: Px) => HEADISH.has(p.part) || (p.part === P.BIB && f.eye != null && p.y <= f.eye[1] + 3);
  const headLab = PAL_LAB[parts[P.HEAD]];
  const frames: Px[][] = [];
  frames.push(base, base, shift(base, 0, -1, isHead), shift(base, 0, -1, isHead));            // idle: head bob
  // blink: the eye closes to the face colour (on owls the coloured iris closes too, the pale ring stays)
  const lid = (p: Px) => p.part === P.EYE || (family === 'owl' && p.part === P.MASK);
  const lidLab = family === 'owl' ? lidColour(base, headLab) : headLab;
  frames.push(base.map((p) => (lid(p) ? { ...p, lab: lidLab, rgb: undefined } : p)));
  frames.push(shift(base, 0, -1, (p) => p.part === P.TAIL, false));                                // tail flick
  frames.push(shift(base, 1, 1, isHead));                                                           // peck
  frames.push(base.filter((p) => p.part !== P.LEG).map((p) => ({ ...p, y: p.y - 2 })));             // hop
  // flight: legs tucked, folded wing becomes back, wings beat around the shoulder
  const body = base.filter((p) => p.part !== P.LEG && !(family === 'humm' && p.part === P.WING))
    .map((p) => (p.part === P.WING || p.part === P.FARWING ? { ...p, part: P.BODY, lab: [p.lab[0] + 4, p.lab[1], p.lab[2]] as Lab, rgb: undefined } : p));
  // open wings take their colours from the folded wing as drawn (so sheet sprites keep the artist's colours)
  const mean = (ps: Px[]): Lab | null => ps.length ? [0, 1, 2].map((k) => ps.reduce((n, p) => n + p.lab[k], 0) / ps.length) as Lab : null;
  const folded = base.filter((p) => p.part === P.WING), tips = base.filter((p) => p.part === P.FARWING || (p.part === P.TAIL && !folded.length));
  const w = mean(folded) ?? PAL_LAB[parts[P.WING]], pr = mean(tips) ?? [w[0] - 14, w[1], w[2]];
  const wingCols = {
    lead: [Math.min(96, w[0] + 12), w[1] * 0.9, w[2] * 0.9] as Lab, cov: w, prim: [Math.min(pr[0], w[0] - 6), pr[1], pr[2]] as Lab,
    bar: sp.look?.wingbar && !DIRECT[sp.id] ? PAL_LAB[parts[P.WINGBAR]] : null,
  };
  const len = WING_LEN[family] ?? 12, [sx, sy] = f.shoulder;
  for (let i = 0; i < FLY_FRAMES; i++) {
    const ang = family === 'humm' ? [70, 35, -10, -40, -10, 35, 70, 50][i] : FLAP[i], dy = BOB[i];
    const b = body.map((p) => ({ ...p, y: p.y + dy }));
    if (f.front) {
      const L = wingPixels(sx, sy + dy, ang, len, 1, wingCols, false), R = wingPixels(31 - sx, sy + dy, ang, len, -1, wingCols, false);
      frames.push([...b, ...L, ...R]);
    } else {
      const farW = wingPixels(sx + 2, sy + dy - 1, ang + 6, len * 0.85, 1, wingCols, true);
      const occupied = new Set(b.map((p) => p.y * 32 + p.x));
      frames.push([...farW.filter((p) => !occupied.has(p.y * 32 + p.x)), ...b, ...wingPixels(sx, sy + dy, ang, len, 1, wingCols, false)]);
    }
  }
  return pack(armor && armor.pieces > 0 ? (armorize(frames, armor, f) as Px[][]) : frames);
}
