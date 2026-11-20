// Sprite grammar: 12 body archetypes → 32×32 part maps, per animation frame.
// "Anatomy from the species." The photo never touches this file.
import { Buf, newBuf, ellipse, poly, line, set, get, S, Pt } from './raster';

export const P = {
  NONE: 0, BODY: 1, BELLY: 2, WING: 3, TAIL: 4, HEAD: 5, CROWN: 6, CREST: 7, BEAK: 8,
  LEG: 9, EYE: 10, BIB: 11, MASK: 12, CHEEK: 13, WINGBAR: 14, FARWING: 15, NAPE: 16,
} as const;
export const PART_COUNT = 17;

export type Archetype =
  | 'passerine' | 'corvid' | 'raptor' | 'owl' | 'waterfowl' | 'wader'
  | 'seabird' | 'woodpecker' | 'hummingbird' | 'gamebird' | 'parrot' | 'kingfisher';

export type Beak = 'cone' | 'hooked' | 'needle' | 'chisel' | 'spatula' | 'dagger' | 'tubular' | 'decurved' | 'stout';
export type Tail = 'square' | 'notched' | 'forked' | 'rounded' | 'long' | 'cocked' | 'wedge' | 'fan' | 'stiff' | 'short';
export type Legs = 'perching' | 'wading' | 'webbed' | 'taloned';

export interface Shape {
  bx: number; by: number; brx: number; bry: number; // body ellipse
  tilt: number;          // body lean, px of top shift (upright birds)
  hx: number; hy: number; hr: number;               // head circle
  neck: number;          // neck length px (waders, waterfowl)
  beak: Beak; beakLen: number;
  tail: Tail; tailLen: number; tailAngle: number;   // degrees, y-down, 180 = straight back
  legs: Legs; legLen: number;
  front: boolean;        // owl faces the viewer
  wingSpan: number;      // flight wing length
}

export interface Marks {
  crown?: boolean; crest?: 'small' | 'prominent' | 'tufts'; bib?: 'throat' | 'full';
  mask?: 'thin' | 'bold'; cheek?: boolean; wingbar?: 'single' | 'double'; nape?: boolean;
}

const BASE: Record<Archetype, Shape> = {
  passerine: { bx: 14, by: 19, brx: 6.5, bry: 5, tilt: 0, hx: 20.5, hy: 12.5, hr: 4, neck: 0, beak: 'cone', beakLen: 3, tail: 'square', tailLen: 8, tailAngle: 145, legs: 'perching', legLen: 4, front: false, wingSpan: 11 },
  corvid: { bx: 14, by: 18.5, brx: 7.5, bry: 5.5, tilt: 0, hx: 21.5, hy: 11.5, hr: 4.2, neck: 0, beak: 'stout', beakLen: 4.5, tail: 'wedge', tailLen: 9, tailAngle: 150, legs: 'perching', legLen: 5, front: false, wingSpan: 13 },
  raptor: { bx: 15, by: 17.5, brx: 5.8, bry: 7.5, tilt: 2, hx: 18, hy: 8.5, hr: 4, neck: 0, beak: 'hooked', beakLen: 3, tail: 'fan', tailLen: 8, tailAngle: 110, legs: 'taloned', legLen: 4, front: false, wingSpan: 14 },
  owl: { bx: 16, by: 19.5, brx: 7, bry: 8, tilt: 0, hx: 16, hy: 10, hr: 6, neck: 0, beak: 'hooked', beakLen: 2, tail: 'short', tailLen: 3, tailAngle: 100, legs: 'taloned', legLen: 2, front: true, wingSpan: 13 },
  waterfowl: { bx: 14, by: 20, brx: 9.5, bry: 5, tilt: 0, hx: 24.5, hy: 10.5, hr: 3.6, neck: 6, beak: 'spatula', beakLen: 4, tail: 'short', tailLen: 4, tailAngle: 200, legs: 'webbed', legLen: 3, front: false, wingSpan: 13 },
  wader: { bx: 13, by: 15, brx: 6.5, bry: 4.2, tilt: 0, hx: 22, hy: 5.5, hr: 3, neck: 7, beak: 'dagger', beakLen: 6, tail: 'short', tailLen: 4, tailAngle: 160, legs: 'wading', legLen: 11, front: false, wingSpan: 14 },
  seabird: { bx: 14, by: 18.5, brx: 8.5, bry: 5, tilt: 0, hx: 23, hy: 12, hr: 3.8, neck: 0, beak: 'hooked', beakLen: 3.5, tail: 'square', tailLen: 5, tailAngle: 175, legs: 'webbed', legLen: 4, front: false, wingSpan: 15 },
  woodpecker: { bx: 15.5, by: 17.5, brx: 4.8, bry: 7, tilt: 2, hx: 18.5, hy: 8.5, hr: 3.7, neck: 0, beak: 'chisel', beakLen: 4, tail: 'stiff', tailLen: 7, tailAngle: 110, legs: 'perching', legLen: 2, front: false, wingSpan: 11 },
  hummingbird: { bx: 14.5, by: 19, brx: 4.5, bry: 3.5, tilt: 0, hx: 19.5, hy: 15, hr: 2.8, neck: 0, beak: 'tubular', beakLen: 7, tail: 'notched', tailLen: 5, tailAngle: 150, legs: 'perching', legLen: 2, front: false, wingSpan: 8 },
  gamebird: { bx: 14.5, by: 20.5, brx: 8.5, bry: 6, tilt: 0, hx: 23, hy: 14, hr: 3.4, neck: 0, beak: 'cone', beakLen: 2.5, tail: 'rounded', tailLen: 4, tailAngle: 160, legs: 'perching', legLen: 4, front: false, wingSpan: 11 },
  parrot: { bx: 15, by: 17.5, brx: 5.5, bry: 7, tilt: 2, hx: 18.5, hy: 9, hr: 4.2, neck: 0, beak: 'hooked', beakLen: 3, tail: 'long', tailLen: 11, tailAngle: 112, legs: 'perching', legLen: 3, front: false, wingSpan: 12 },
  kingfisher: { bx: 13.5, by: 19, brx: 6, bry: 5, tilt: 1, hx: 19.5, hy: 12, hr: 5, neck: 0, beak: 'dagger', beakLen: 7, tail: 'short', tailLen: 5, tailAngle: 140, legs: 'perching', legLen: 3, front: false, wingSpan: 12 },
};

export function shapeFor(arch: Archetype, over: Partial<Shape> = {}): Shape {
  return { ...BASE[arch], ...over };
}

export type FrameName =
  | 'idle0' | 'idle1' | 'idle2' | 'idle3' | 'blink' | 'flick' | 'peck' | 'hop'
  | 'fly0' | 'fly1' | 'fly2' | 'fly3' | 'fly4' | 'fly5';

export const FRAMES: FrameName[] = [
  'idle0', 'idle1', 'idle2', 'idle3', 'blink', 'flick', 'peck', 'hop',
  'fly0', 'fly1', 'fly2', 'fly3', 'fly4', 'fly5',
];

interface Anim {
  headDy: number; headDx: number; bodyDy: number; breath: number; tailDa: number;
  blink: boolean; liftY: number; legsTucked: boolean;
}

function animFor(f: FrameName): Anim {
  const a: Anim = { headDy: 0, headDx: 0, bodyDy: 0, breath: 0, tailDa: 0, blink: false, liftY: 0, legsTucked: false };
  switch (f) {
    case 'idle1': a.breath = 0.5; break;
    case 'idle2': a.breath = 1; a.headDy = 1; a.bodyDy = 0; break;
    case 'idle3': a.breath = 0.5; a.headDy = 1; break;
    case 'blink': a.blink = true; break;
    case 'flick': a.tailDa = 28; break;
    case 'peck': a.headDy = 2; a.headDx = 1; break;
    case 'hop': a.liftY = -2; a.legsTucked = true; a.tailDa = 10; break;
  }
  return a;
}

const rad = (d: number) => (d * Math.PI) / 180;

function drawTail(b: Buf, s: Shape, rootX: number, rootY: number, angle: number, len: number) {
  const dx = Math.cos(rad(angle)), dy = Math.sin(rad(angle));
  const nx = -dy, ny = dx; // perpendicular
  let w0 = 2.2, w1 = 2;
  switch (s.tail) {
    case 'fan': case 'wedge': w0 = 2; w1 = 3.2; break;
    case 'stiff': w0 = 2.2; w1 = 0.8; break;
    case 'long': w0 = 2; w1 = 1.4; break;
    case 'rounded': w0 = 2.6; w1 = 2.4; break;
    case 'short': w0 = 2.4; w1 = 2; break;
    case 'cocked': w0 = 2; w1 = 1.8; break;
  }
  const tx = rootX + dx * len, ty = rootY + dy * len;
  const pts: Pt[] = [
    [rootX + nx * w0, rootY + ny * w0], [tx + nx * w1, ty + ny * w1],
    [tx - nx * w1, ty - ny * w1], [rootX - nx * w0, rootY - ny * w0],
  ];
  poly(b, pts, P.TAIL);
  if (s.tail === 'notched' || s.tail === 'forked') {
    const depth = s.tail === 'forked' ? 3 : 1.4;
    line(b, tx, ty, tx - dx * depth, ty - dy * depth, P.NONE);
  }
}

function drawBeak(b: Buf, s: Shape, hx: number, hy: number, front: boolean) {
  if (front) {
    poly(b, [[hx - 1, hy + 1], [hx + 1, hy + 1], [hx, hy + 1 + s.beakLen]], P.BEAK);
    return;
  }
  const bx = hx + s.hr - 1.2, L = s.beakLen;
  switch (s.beak) {
    case 'cone':
      poly(b, [[bx, hy - 1.3], [bx + L, hy + 0.6], [bx, hy + 1.8]], P.BEAK);
      line(b, bx, hy, bx + L - 0.5, hy + 0.5, P.BEAK); break;
    case 'stout':
      poly(b, [[bx, hy - 1.6], [bx + L, hy + 0.4], [bx, hy + 1.8]], P.BEAK);
      line(b, bx, hy, bx + L, hy + 0.5, P.BEAK); break;
    case 'hooked':
      poly(b, [[bx, hy - 1.4], [bx + L, hy - 0.2], [bx, hy + 1.6]], P.BEAK);
      line(b, bx, hy, bx + L, hy, P.BEAK); set(b, bx + L - 0.5, hy + 1, P.BEAK); break;
    case 'needle': case 'tubular':
      line(b, bx, hy + 0.5, bx + L, hy + 0.5, P.BEAK); set(b, bx, hy - 0.5, P.BEAK); break;
    case 'chisel':
      poly(b, [[bx, hy - 1], [bx + L, hy], [bx + L, hy + 0.9], [bx, hy + 1.6]], P.BEAK); break;
    case 'spatula':
      poly(b, [[bx, hy - 0.6], [bx + L, hy + 0.2], [bx + L, hy + 1.9], [bx, hy + 1.9]], P.BEAK); break;
    case 'dagger':
      poly(b, [[bx, hy - 1.2], [bx + L, hy + 0.5], [bx, hy + 1.8]], P.BEAK);
      line(b, bx, hy + 0.5, bx + L, hy + 0.5, P.BEAK); break;
    case 'decurved':
      line(b, bx, hy + 0.5, bx + L * 0.6, hy + 0.5, P.BEAK);
      line(b, bx + L * 0.6, hy + 0.5, bx + L, hy + 2, P.BEAK); set(b, bx, hy - 0.5, P.BEAK); break;
  }
}

function drawLegs(b: Buf, s: Shape, cx: number, footY: number, topY: number) {
  const xs = s.front ? [cx - 2, cx + 1] : [cx - 1, cx + 2];
  for (const x of xs) {
    line(b, x, topY, x, footY, P.LEG);
    if (s.legs === 'taloned') { line(b, x + 1, topY + 1, x + 1, footY, P.LEG); line(b, x - 1, footY, x + 2, footY, P.LEG); }
    else if (s.legs === 'webbed') line(b, x - 1, footY, x + 2, footY, P.LEG);
    else if (s.legs === 'wading') line(b, x, footY, x + 2, footY, P.LEG);
    else line(b, x, footY, x + 1, footY, P.LEG);
  }
}

function drawHeadMarks(b: Buf, s: Shape, m: Marks, hx: number, hy: number) {
  const r = s.hr;
  const H = [P.HEAD];
  if (s.front) {
    // facial disk + ear tufts
    if (m.cheek !== false) ellipse(b, hx, hy + 0.5, r - 1, r - 1.6, P.CHEEK, H);
    if (m.crown) ellipse(b, hx, hy - r + 1, r, 2, P.CROWN, H);
    return;
  }
  if (m.crown) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
      if (get(b, x, y) === P.HEAD && y + 0.5 < hy - r * 0.15) b[y * S + x] = P.CROWN;
  }
  if (m.nape) ellipse(b, hx - r + 1, hy + 0.5, 1.6, 2, P.NAPE, H);
  if (m.cheek) ellipse(b, hx - 0.2, hy + 1.2, r * 0.55, r * 0.45, P.CHEEK, H);
  if (m.mask) {
    const th = m.mask === 'bold' ? 1.8 : 0.9;
    poly(b, [[hx - r * 0.6, hy - th + 0.2], [hx + r + 0.5, hy - th], [hx + r + 0.5, hy + th], [hx - r * 0.6, hy + th * 0.6]], P.MASK, [P.HEAD, P.CROWN, P.CHEEK]);
  }
  if (m.bib) {
    const big = m.bib === 'full';
    ellipse(b, hx + r * 0.25, hy + r * 0.85, r * (big ? 0.8 : 0.55), r * (big ? 0.75 : 0.45), P.BIB, [P.HEAD, P.CHEEK, P.BELLY, P.BODY]);
  }
}

function drawCrest(b: Buf, s: Shape, m: Marks, hx: number, hy: number) {
  const r = s.hr;
  if (!m.crest) return;
  if (m.crest === 'tufts') {
    poly(b, [[hx - r + 0.5, hy - r + 2], [hx - r + 0.8, hy - r - 2.5], [hx - r + 3, hy - r + 1]], P.CREST);
    poly(b, [[hx + r - 3, hy - r + 1], [hx + r - 0.8, hy - r - 2.5], [hx + r - 0.5, hy - r + 2]], P.CREST);
    return;
  }
  const h = m.crest === 'prominent' ? 5 : 2.6;
  poly(b, [[hx - r * 0.8, hy - r * 0.4], [hx - r * 0.7 - 1, hy - r - h], [hx + r * 0.2, hy - r + 0.2], [hx + r * 0.5, hy - r * 0.4]], P.CREST);
}

function drawEye(b: Buf, s: Shape, hx: number, hy: number, blink: boolean) {
  const v = blink ? P.HEAD : P.EYE;
  if (s.front) {
    const ex = 2.4;
    for (const sx of [-1, 1]) {
      const x = Math.round(hx + sx * ex - 0.5), y = Math.round(hy - 0.5);
      if (blink) { set(b, x, y, P.MASK); set(b, x + 1, y, P.MASK); continue; }
      set(b, x, y, P.EYE); set(b, x + 1, y, P.EYE); set(b, x, y + 1, P.EYE); set(b, x + 1, y + 1, P.EYE);
      // ring
      for (const [dx, dy] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]])
        if (get(b, x + dx, y + dy) !== P.EYE) set(b, x + dx, y + dy, P.MASK);
    }
    return;
  }
  const ex = Math.round(hx + s.hr * 0.3), ey = Math.round(hy - s.hr * 0.25 - 0.4);
  const cur = get(b, ex, ey);
  const lid = blink ? (cur === P.MASK ? P.MASK : cur === P.CROWN ? P.CROWN : P.HEAD) : v;
  set(b, ex, ey, lid);
  if (s.hr >= 4.5 && !blink) set(b, ex, ey + 1, P.EYE);
}

/** Perched/ground frames. */
function perched(s: Shape, m: Marks, a: Anim): Buf {
  const b = newBuf();
  const lift = a.liftY;
  const cx = s.bx, cy = s.by + lift + a.bodyDy;
  const hx = s.hx + a.headDx, hy = s.hy + lift + a.headDy;
  const bottom = cy + s.bry;

  // legs first (body overlaps the tops)
  const groundY = Math.min(31, Math.round(s.by + s.bry + s.legLen - 1));
  if (!a.legsTucked) drawLegs(b, s, Math.round(cx), groundY, Math.round(bottom - 2));
  else drawLegs(b, s, Math.round(cx), Math.round(bottom + 1), Math.round(bottom - 1));

  // tail
  const rootX = cx - s.brx * (s.front ? 0 : 0.7);
  const rootY = cy + s.bry * (s.tilt > 0 ? 0.55 : 0.1);
  if (s.front) drawTail(b, s, cx, bottom - 1, 90, s.tailLen);
  else drawTail(b, s, rootX, rootY, s.tailAngle - a.tailDa * (s.tailAngle > 180 ? -1 : 1), s.tailLen);

  // body (+ breathing: bottom half swells by `breath`)
  ellipse(b, cx + s.tilt * 0.3, cy, s.brx + a.breath * 0.3, s.bry + a.breath * 0.5, P.BODY);
  if (s.tilt) ellipse(b, cx + s.tilt * 0.6, cy - s.bry * 0.5, s.brx * 0.85, s.bry * 0.55, P.BODY);

  // neck
  if (s.neck > 0) {
    const nx0 = cx + s.brx * 0.6, ny0 = cy - s.bry * 0.3;
    const w = s.hr * 0.75;
    poly(b, [[nx0 - w, ny0 + 1], [hx - w * 0.8, hy], [hx + w * 0.6, hy + 1], [nx0 + w + 0.5, ny0 + 2]], P.BODY);
  }

  // belly: lower-front of body
  if (s.front) ellipse(b, cx, cy + s.bry * 0.25, s.brx * 0.68, s.bry * 0.75, P.BELLY, [P.BODY]);
  else ellipse(b, cx + s.brx * 0.3, cy + s.bry * 0.45, s.brx * 0.75, s.bry * 0.7, P.BELLY, [P.BODY]);

  // wing: upper-back of body
  if (s.front) {
    ellipse(b, cx - s.brx + 1.2, cy + 1, 2, s.bry * 0.75, P.WING, [P.BODY, P.BELLY]);
    ellipse(b, cx + s.brx - 1.2, cy + 1, 2, s.bry * 0.75, P.WING, [P.BODY, P.BELLY]);
  } else {
    ellipse(b, cx - s.brx * 0.18, cy - s.bry * 0.05, s.brx * 0.78, s.bry * 0.62, P.WING, [P.BODY, P.BELLY]);
    // primaries spill a little over the tail root
    poly(b, [[cx - s.brx * 0.5, cy - 1], [cx - s.brx - 2, cy + s.bry * 0.5], [cx - s.brx * 0.3, cy + s.bry * 0.45]], P.WING, [P.BODY, P.BELLY, P.TAIL, P.NONE]);
    if (m.wingbar) {
      // short diagonal coverts bar(s) on the front half of the wing
      const x0 = cx - s.brx * 0.1, y0 = cy - s.bry * 0.15;
      line(b, x0, y0, x0 + 2.5, y0 - 1.5, P.WINGBAR, [P.WING]);
      if (m.wingbar === 'double') line(b, x0 - 1.5, y0 + 1.5, x0 + 1, y0, P.WINGBAR, [P.WING]);
    }
  }

  // head
  ellipse(b, hx, hy, s.hr, s.hr * (s.front ? 0.92 : 1), P.HEAD);
  drawCrest(b, s, m, hx, hy);
  drawHeadMarks(b, s, m, hx, hy);
  drawBeak(b, s, hx, hy + (s.front ? 0.5 : 0), s.front);
  drawEye(b, s, hx, hy, a.blink);
  return b;
}

/** Flight frames: side-on, wing tip sweeps up → level → down → level. */
// tip offsets from the shoulder for a 12px wing, in stroke order
const WING_TIP: [number, number][] = [[-3, -12], [-7, -8], [-11, -2], [-7, 5], [-3, 9], [-11, -1]];
function flight(s: Shape, m: Marks, i: number): Buf {
  const b = newBuf();
  const cx = 14, cy = 17;
  const brx = Math.min(s.brx, 8), bry = Math.min(s.bry * 0.7, 3.6);
  const hr = Math.min(s.hr, 4.2) * (s.front ? 0.85 : 1);
  const hx = cx + brx + hr * 0.35 + (s.neck > 0 && s.legs !== 'wading' ? 2 : -0.5), hy = cy - 1.5;
  const k = s.wingSpan / 12;
  const [tx, ty] = WING_TIP[i];
  const sx = cx + 1, sy = cy - 1; // shoulder

  // far wing: only visible above the body on the upstroke
  if (ty < -4) poly(b, [[sx + 3, sy], [sx + tx * k + 3, sy + ty * k + 1], [sx - 2, sy]], P.FARWING);

  if (s.legs === 'wading') line(b, cx - brx + 1, cy + 1, cx - brx - 7, cy + 2, P.LEG);
  drawTail(b, { ...s, tail: s.tail === 'cocked' || s.tail === 'rounded' || s.tail === 'short' ? 'stiff' : s.tail }, cx - brx + 2, cy - 0.5, 182, Math.min(s.tailLen * 0.6, 7));

  ellipse(b, cx, cy, brx, bry, P.BODY);
  ellipse(b, cx + 1, cy + bry * 0.5, brx * 0.85, bry * 0.6, P.BELLY, [P.BODY]);
  if (s.neck > 0 && s.legs !== 'wading') poly(b, [[cx + brx - 2, cy - 2], [hx - 1, hy - 1], [hx, hy + 2], [cx + brx - 1, cy + 1.5]], P.HEAD);

  ellipse(b, hx, hy, hr, hr, P.HEAD);
  drawCrest(b, { ...s, hr }, { ...m, crest: m.crest === 'prominent' ? 'small' : m.crest === 'tufts' ? undefined : m.crest }, hx, hy);
  drawHeadMarks(b, { ...s, hr, front: false }, { ...m, crest: undefined }, hx, hy);
  drawBeak(b, { ...s, hr, beakLen: Math.min(s.beakLen, 7) }, hx, hy, false);
  drawEye(b, { ...s, hr, front: false }, hx, hy, false);

  // near wing: broad at the shoulder, tapering to a point
  const tipX = sx + tx * k, tipY = sy + ty * k;
  const back = ty > 3 ? 4 : 5;
  poly(b, [[sx + 3, sy], [tipX, tipY], [sx - back, sy + (ty > 3 ? 1 : 0.5)]], P.WING);
  if (m.wingbar) line(b, sx + 1, sy, sx + tx * k * 0.35, sy + ty * k * 0.35, P.WINGBAR, [P.WING]);
  return b;
}

export function buildFrame(s: Shape, m: Marks, f: FrameName): Buf {
  if (f.startsWith('fly')) return flight(s, m, Number(f.slice(3)));
  const a = animFor(f);
  if (s.front && f === 'flick') a.tailDa = 0, a.headDx = 1; // owls swivel instead
  if (s.front && f === 'peck') a.headDx = -1, a.headDy = 0;
  return perched(s, m, a);
}
