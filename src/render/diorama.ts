// GAM-9 / GAM-10: layered pixel diorama on hand-painted parallax backgrounds.
// Each scene is a stack of PNG layers (back → front) at native resolution; we draw at an integer scale.
import type { Habitat, Species } from '../data/types';
import type { DayPhase } from '../core/sun';
import { HEX, IDX } from '../core/palette';
import { renderFrames } from '../core/pixel/sprite';
import { FLY_FRAMES, FLY_MS } from '../core/pixel/birds';
import { drawFrame, onTick } from '../ui/components';
import { feederOf, perchOf } from '../core/decor';
import { paintFeederDef, paintPerchDef, mixKey, type FeederMix } from './decor';
import type { Food } from '../core/pets';

const C = (n: keyof typeof IDX) => HEX[IDX[n]];

export interface SceneDef {
  id: string; label: string; layers: number; w: number; h: number;
  ground: number;                 // y where birds stand, in scene pixels
  water?: [number, number, number?, number?]; // y0, y1, x0, x1 of open water
  tint?: string;                  // phase grade laid over the scene
  level: number;                  // trainer level that unlocks this Bird Home
  props: ('branchL' | 'branchR' | 'wire' | 'feeder' | 'post')[];
}

export const SCENES: Record<string, SceneDef> = {
  skyday: { id: 'skyday', label: "Sky meadow", level: 1, layers: 1, w: 384, h: 154, ground: 146, props: ['branchL', 'post'] },
  crimson: { id: 'crimson', label: "Crimson castle", level: 9, layers: 1, w: 384, h: 216, ground: 206, props: ['branchL', 'branchR'] },
  moonkeep: { id: 'moonkeep', label: "Moonlit keep", level: 13, layers: 1, w: 384, h: 216, ground: 208, props: ['branchL', 'branchR'] },
  chapel: { id: 'chapel', label: "Ivy chapel", level: 17, layers: 1, w: 281, h: 245, ground: 230, props: ['branchL', 'post'] },
  valley: { id: 'valley', label: "Valley pond", level: 1, layers: 6, w: 768, h: 300, ground: 286, water: [246, 264, 350, 620], props: ['branchL', 'post'] },
  pine: { id: 'pine', label: "Pine forest", level: 1, layers: 14, w: 640, h: 300, ground: 260, props: ['branchL', 'branchR'] },
  n3: { id: 'n3', label: "Palm shore", level: 1, layers: 4, w: 576, h: 324, ground: 312, water: [218, 280], props: ['branchL', 'post'] },
  n1: { id: 'n1', label: "Lone tree at sunrise", level: 2, layers: 4, w: 576, h: 324, ground: 262, props: ['branchL', 'branchR'] },
  nfb: { id: 'nfb', label: "Misty wood", level: 2, layers: 6, w: 620, h: 300, ground: 262, props: ['branchL', 'branchR'] },
  c4: { id: 'c4', label: "Old town square", level: 3, layers: 7, w: 480, h: 270, ground: 222, props: ['branchL', 'wire', 'feeder'] },
  b3: { id: 'b3', label: "Old-growth path", level: 3, layers: 8, w: 480, h: 270, ground: 215, props: ['branchL', 'branchR'] },
  dusk: { id: 'dusk', label: "Mountain dusk", level: 4, layers: 6, w: 320, h: 240, ground: 230, props: ['branchL', 'branchR'] },
  a4: { id: 'a4', label: "Mountain shrine", level: 4, layers: 6, w: 576, h: 324, ground: 302, props: ['branchL', 'branchR'] },
  v_downs: { id: 'v_downs', label: "Rolling downs", level: 5, layers: 4, w: 384, h: 216, ground: 200, props: ['branchL', 'branchR'] },
  violet: { id: 'violet', label: "Violet wood", level: 5, layers: 6, w: 640, h: 300, ground: 290, props: ['branchL', 'branchR'] },
  skyline: { id: 'skyline', label: "Smog skyline", level: 6, layers: 8, w: 630, h: 320, ground: 298, props: ['branchL', 'wire', 'feeder'] },
  a1: { id: 'a1', label: "Desert town", level: 6, layers: 5, w: 576, h: 324, ground: 300, props: ['branchL', 'wire', 'feeder'] },
  reef: { id: 'reef', label: "Jungle ruins", level: 7, layers: 4, w: 1920, h: 240, ground: 228, props: ['branchL', 'branchR'] },
  w2: { id: 'w2', label: "Treehouse village", level: 7, layers: 4, w: 576, h: 324, ground: 314, props: ['branchL', 'branchR'] },
  nfa: { id: 'nfa', label: "Night forest", level: 8, layers: 6, w: 440, h: 240, ground: 197, props: ['branchL', 'branchR'] },
  neoncity: { id: 'neoncity', label: "Neon night", level: 8, layers: 6, w: 1152, h: 216, ground: 194, props: ['branchL', 'wire', 'feeder'] },
  b1: { id: 'b1', label: "Statue garden", level: 9, layers: 7, w: 480, h: 270, ground: 250, props: ['branchL', 'branchR'] },
  a3: { id: 'a3', label: "Haunted hamlet", level: 9, layers: 5, w: 576, h: 324, ground: 272, props: ['branchL', 'branchR'] },
  pfor: { id: 'pfor', label: "Pine ridge", level: 10, layers: 11, w: 900, h: 240, ground: 225, props: ['branchL', 'branchR'] },
  v_tundra: { id: 'v_tundra', label: "Tundra night", level: 10, layers: 4, w: 384, h: 216, ground: 202, props: ['branchL', 'branchR'] },
  c3: { id: 'c3', label: "Neon arcade", level: 11, layers: 6, w: 480, h: 270, ground: 260, props: ['branchL', 'wire', 'feeder'] },
  miami: { id: 'miami', label: "Sunset boulevard", level: 11, layers: 5, w: 896, h: 240, ground: 222, props: ['branchL', 'wire', 'feeder'] },
  v_mesa: { id: 'v_mesa', label: "Mesa", level: 12, layers: 4, w: 384, h: 216, ground: 200, props: ['branchL', 'branchR'] },
  v_kiln: { id: 'v_kiln', label: "Red canyon", level: 12, layers: 4, w: 384, h: 216, ground: 200, props: ['branchL', 'branchR'] },
  s2: { id: 's2', label: "Overgrown city", level: 13, layers: 9, w: 480, h: 270, ground: 245, props: ['branchL', 'wire', 'feeder'] },
  w3: { id: 'w3', label: "Old bus stop", level: 13, layers: 4, w: 576, h: 324, ground: 290, props: ['branchL', 'wire', 'feeder'] },
  n4: { id: 'n4', label: "Stony ridge", level: 14, layers: 4, w: 576, h: 324, ground: 299, props: ['branchL', 'branchR'] },
  v_cairn: { id: 'v_cairn', label: "Snowy cairn", level: 14, layers: 4, w: 384, h: 216, ground: 200, props: ['branchL', 'branchR'] },
  b2: { id: 'b2', label: "Gargoyle hall", level: 15, layers: 7, w: 480, h: 270, ground: 260, props: ['branchL', 'wire', 'feeder'] },
  gothic: { id: 'gothic', label: "Gothic town", level: 15, layers: 7, w: 1920, h: 216, ground: 206, props: ['branchL', 'wire', 'feeder'] },
  w1: { id: 'w1', label: "Scrapyard outpost", level: 16, layers: 3, w: 576, h: 324, ground: 280, props: ['branchL', 'wire', 'feeder'] },
  w4: { id: 'w4', label: "Frozen market", level: 16, layers: 4, w: 576, h: 324, ground: 290, props: ['branchL', 'wire', 'feeder'] },
  s1: { id: 's1', label: "Ruined shacks", level: 17, layers: 7, w: 480, h: 270, ground: 240, props: ['branchL', 'wire', 'feeder'] },
  s1n: { id: 's1n', label: "Ruined shacks by night", level: 17, layers: 7, w: 480, h: 270, ground: 240, props: ['branchL', 'wire', 'feeder'] },
  a2: { id: 'a2', label: "Abandoned playground", level: 18, layers: 6, w: 576, h: 324, ground: 300, props: ['branchL', 'wire', 'feeder'] },
  c1: { id: 'c1', label: "Back alley", level: 18, layers: 7, w: 480, h: 270, ground: 211, props: ['branchL', 'wire', 'feeder'] },
  v_hollow: { id: 'v_hollow', label: "Misty hollow", level: 19, layers: 4, w: 384, h: 216, ground: 195, props: ['branchL', 'branchR'] },
  v_flue: { id: 'v_flue', label: "Factory haze", level: 19, layers: 4, w: 384, h: 216, ground: 200, props: ['branchL', 'wire', 'feeder'] },
  s3: { id: 's3', label: "Moonlit dunes", level: 20, layers: 7, w: 480, h: 270, ground: 240, props: ['branchL', 'branchR'] },
  v_sodium: { id: 'v_sodium', label: "Sodium city", level: 20, layers: 4, w: 384, h: 216, ground: 205, props: ['branchL', 'wire', 'feeder'] },
  s4: { id: 's4', label: "Train yard", level: 21, layers: 7, w: 480, h: 270, ground: 234, props: ['branchL', 'wire', 'feeder'] },
  s4n: { id: 's4n', label: "Train yard at night", level: 21, layers: 7, w: 480, h: 270, ground: 234, props: ['branchL', 'wire', 'feeder'] },
  fort: { id: 'fort', label: "Castle wall", level: 22, layers: 3, w: 895, h: 272, ground: 208, props: ['branchL', 'wire', 'feeder'] },
  cold: { id: 'cold', label: "Frozen hall", level: 22, layers: 5, w: 224, h: 224, ground: 214, props: ['branchL', 'wire', 'feeder'] },
  ind: { id: 'ind', label: "Industrial district", level: 23, layers: 4, w: 544, h: 300, ground: 236, props: ['branchL', 'wire', 'feeder'] },
  b4: { id: 'b4', label: "Witch's ruin", level: 23, layers: 8, w: 480, h: 270, ground: 250, props: ['branchL', 'branchR'] },
  cave: { id: 'cave', label: "Crystal cave", level: 24, layers: 9, w: 480, h: 270, ground: 255, props: ['branchL', 'branchR'] },
  lab: { id: 'lab', label: "Secret lab", level: 24, layers: 3, w: 320, h: 240, ground: 230, props: ['branchL', 'wire', 'feeder'] },
  bulk: { id: 'bulk', label: "Bulkhead tunnel", level: 25, layers: 4, w: 352, h: 224, ground: 214, props: ['branchL', 'wire', 'feeder'] },
};

// New players start with two homes (the default day/night pair); every other home unlocks one level later,
// and then has to be bought with Feather Coins in Woods' Shop (v1.28).
// v1.50: stretched across the climb to the Lv50 cap (Lv2 → Lv49), same order as before.
for (const sc of Object.values(SCENES)) sc.level = sc.id === 'skyday' || sc.id === 'dusk' ? 1 : Math.round(2 + (sc.level - 1) * 47 / 24);
export const FREE_HOMES = ['skyday', 'dusk'];
/** Price of a Bird Home in Feather Coins: grows with the level it unlocks at. */
export const homePrice = (id: string) => (FREE_HOMES.includes(id) ? 0 : Math.round((40 + (SCENES[id]?.level ?? 1) * 25) / 5) * 5);

const BY_PHASE: Record<Habitat, Record<DayPhase, [string, string?]>> = {
  urban: { dawn: ['skyline'], morning: ['c4'], day: ['c4'], golden: ['c4', 'rgba(255,170,60,0.14)'], dusk: ['c4', 'rgba(60,20,70,0.28)'], night: ['neoncity'] },
  woodland: { dawn: ['n1'], morning: ['nfb'], day: ['pine'], golden: ['b3', 'rgba(255,170,60,0.14)'], dusk: ['dusk'], night: ['nfa'] },
  water: { dawn: ['valley', 'rgba(255,140,120,0.18)'], morning: ['valley'], day: ['n3'], golden: ['n3', 'rgba(255,150,40,0.18)'], dusk: ['valley', 'rgba(110,40,100,0.34)'], night: ['v_tundra', 'rgba(6,8,30,0.45)'] },
};

/** The default Bird Home for a time of day. */
export const defaultHome = (phase: DayPhase) => (phase === 'dusk' || phase === 'night' ? 'dusk' : 'skyday');

export function sceneFor(biome: Habitat, phase: DayPhase): SceneDef {
  const [id, tint] = BY_PHASE[biome][phase];
  return { ...SCENES[id], tint: tint ?? SCENES[id].tint };
}

// ─── loading ───
const imgCache = new Map<string, Promise<HTMLImageElement[]>>();
export function loadScene(s: SceneDef): Promise<HTMLImageElement[]> {
  if (!imgCache.has(s.id)) {
    imgCache.set(s.id, Promise.all(Array.from({ length: s.layers }, (_, i) => new Promise<HTMLImageElement>((res) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(im);
      im.src = `bg/${s.id}/${i}.png`;
    }))));
  }
  return imgCache.get(s.id)!;
}

/** Draw a scene's layers into a view window. `pan` shifts back layers for parallax. */
function paintLayers(g: CanvasRenderingContext2D, imgs: HTMLImageElement[], s: SceneDef, viewW: number, viewH: number, pan = 0, frontStatic = 2, vx0?: number) {
  const top = s.h - viewH;
  const vx = vx0 ?? Math.max(0, Math.floor((s.w - viewW) / 2));
  g.imageSmoothingEnabled = false;
  const n = imgs.length;
  imgs.forEach((im, k) => {
    if (!im.naturalWidth) return;
    const back = k < n - frontStatic;
    const off = back ? Math.round(pan * (1 - k / Math.max(1, n - frontStatic))) : 0;
    const y = s.h - im.naturalHeight - top;
    // tile horizontally (some layers are narrow strips)
    let x = -(((vx + off) % im.naturalWidth) + im.naturalWidth) % im.naturalWidth;
    for (; x < viewW; x += im.naturalWidth) g.drawImage(im, x, y);
  });
  if (s.tint) { g.fillStyle = s.tint; g.fillRect(0, 0, viewW, viewH); }
}

/** Backdrops for the lens step after a discovery: they change every 3 discoveries (v1.47). Outdoor scenes only,
 *  with night versions after dark so the sky still matches the time of day. */
const LENS_DAY = ['pine', 'valley', 'c4', 'n3', 'nfb', 'b3', 'v_downs', 'n1', 'a4', 'w2', 'v_mesa', 'pfor', 'b1'];
const LENS_NIGHT = ['nfa', 'neoncity', 'dusk', 'moonkeep', 'v_tundra', 'v_hollow'];
export const LENS_EVERY = 3;
export function lensScene(discoveries: number, phase: DayPhase): SceneDef {
  const list = phase === 'dusk' || phase === 'night' ? LENS_NIGHT : LENS_DAY;
  const id = list[Math.floor(Math.max(0, discoveries) / LENS_EVERY) % list.length];
  const tint = phase === 'golden' ? 'rgba(255,170,60,0.14)' : phase === 'dawn' ? 'rgba(255,140,120,0.14)' : undefined;
  return { ...SCENES[id], tint: tint ?? SCENES[id].tint };
}

/** Static thumbnail of a scene (onboarding cards, Field hero). Draws at native pixels; scale with CSS. */
export async function paintSceneThumb(canvas: HTMLCanvasElement, biome: Habitat | SceneDef, phase: DayPhase, viewW: number, viewH: number) {
  const s = typeof biome === 'string' ? sceneFor(biome, phase) : biome;
  const imgs = await loadScene(s);
  canvas.width = viewW; canvas.height = Math.min(viewH, s.h);
  paintLayers(canvas.getContext('2d')!, imgs, s, viewW, canvas.height);
}

/**
 * Full-screen living backdrop (onboarding): fits the scene to the canvas's on-screen shape,
 * frames it around `focus` (0–1 across the scene) and drifts the back layers slowly.
 */
export function runBackdrop(canvas: HTMLCanvasElement, id: string, opts: { focus?: number; reduced?: boolean } = {}): () => void {
  const s = SCENES[id]; if (!s) return () => {};
  let imgs: HTMLImageElement[] = [];
  const g = canvas.getContext('2d')!;
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    canvas.height = s.h; canvas.width = Math.max(60, Math.round(s.h * (r.width || 390) / Math.max(1, r.height || 844)));
  };
  const paint = (t: number) => {
    if (!imgs.length) return;
    const W = canvas.width, vx = Math.max(0, Math.min(Math.max(0, s.w - W), Math.round((opts.focus ?? 0.5) * s.w - W / 2)));
    g.fillStyle = '#07090B'; g.fillRect(0, 0, W, canvas.height);
    paintLayers(g, imgs, s, W, canvas.height, opts.reduced ? 0 : Math.sin(t / 9000) * 12, 2, vx);
  };
  fit();
  const ro = new ResizeObserver(() => { fit(); paint(performance.now()); }); ro.observe(canvas);
  let last = 0;
  const stop = onTick((t) => { if (t - last < 60) return; last = t; paint(t); });
  loadScene(s).then((i) => { imgs = i; paint(performance.now()); });
  return () => { stop(); ro.disconnect(); };
}

/** Thumbnail of one Bird Home by scene id. */
export async function paintHomeThumb(canvas: HTMLCanvasElement, id: string, viewW: number) {
  const s = SCENES[id]; if (!s) return;
  const imgs = await loadScene(s);
  const h = Math.round(viewW * 0.56);
  canvas.width = viewW; canvas.height = Math.min(h, s.h);
  paintLayers(canvas.getContext('2d')!, imgs, s, viewW, canvas.height);
}

// ─── perches & props ───
export type PerchKind = 'perch' | 'ground' | 'water';
export interface Perch { x: number; y: number; kind: PerchKind }


interface Layout { perches: Perch[]; gy: number; branchL?: number; branchR?: number; wire?: number; feeder?: [number, number]; post?: [number, number]; slots: Record<string, [number, number]> }

function layout(s: SceneDef, W: number, H: number): Layout {
  const top = s.h - H;
  const vx = Math.max(0, Math.floor((s.w - W) / 2));
  const gy = Math.min(H - 2, s.ground - top);
  const P: Perch[] = [];
  const L: Layout = { perches: P, gy, slots: { hang: [Math.round(W * 0.66), Math.round(H * 0.16)], left: [Math.round(W * 0.13), gy], mid: [Math.round(W * 0.5), gy], right: [Math.round(W * 0.87), gy] } };
  if (s.props.includes('wire')) { L.wire = Math.round(H * 0.24); P.push({ x: Math.round(W * 0.52), y: L.wire, kind: 'perch' }, { x: Math.round(W * 0.8), y: L.wire, kind: 'perch' }); }
  if (s.props.includes('branchL')) { L.branchL = Math.round(H * 0.42); P.push({ x: Math.round(W * 0.27), y: L.branchL, kind: 'perch' }); }
  if (s.props.includes('branchR')) { L.branchR = Math.round(H * 0.6); P.push({ x: Math.round(W * 0.76), y: L.branchR, kind: 'perch' }); }
  if (s.props.includes('feeder')) { L.feeder = [Math.round(W * 0.74), Math.round(H * 0.56)]; P.push({ x: L.feeder[0], y: L.feeder[1], kind: 'perch' }); }
  if (s.props.includes('post')) {
    const base = s.water ? Math.min(gy, s.water[1] - top) : gy;
    L.post = [Math.round(W * 0.84), Math.round(base - Math.min(70, H * 0.3))];
    P.push({ x: L.post[0] + 1, y: L.post[1], kind: 'perch' });
  }
  if (s.water) {
    const [y0, y1, x0 = 0, x1 = s.w] = s.water;
    const wy = Math.round((y0 + y1) / 2) - top;
    for (const f of [0.22, 0.5, 0.68]) {
      const x = Math.round(W * f);
      if (x + vx > x0 + 10 && x + vx < x1 - 10 && wy > 30 && wy < H) P.push({ x, y: wy + Math.round((f - 0.5) * 10), kind: 'water' });
    }
  }
  if (gy < H) for (const f of [0.18, 0.46]) P.push({ x: Math.round(W * f), y: gy, kind: 'ground' });
  return L;
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2, 1); }
}

function paintProps(g: CanvasRenderingContext2D, L: Layout, W: number, H: number, night: boolean) {
  const bark = night ? C('umber') : C('bark'), dark = C('umber'), leaf = night ? C('pine') : C('fern'), leaf2 = night ? C('fern') : C('moss');
  if (L.wire !== undefined) {
    rect(g, Math.round(W * 0.36), L.wire - 30, 3, H, dark); rect(g, Math.round(W * 0.36) - 5, L.wire - 28, 13, 2, dark);
    for (let x = Math.round(W * 0.36); x < W; x++) rect(g, x, L.wire + Math.round(Math.sin((x / W) * Math.PI) * 2), 1, 1, C('ink'));
  }
  if (L.branchL !== undefined) {
    const y = L.branchL, len = Math.round(W * 0.42);
    rect(g, 0, y, len, 3, bark); rect(g, 0, y + 3, len - 4, 1, dark);
    rect(g, len - 10, y - 4, 2, 4, bark); rect(g, Math.round(len * 0.45), y - 6, 2, 6, bark);
    disc(g, 4, y - 6, 10, leaf); disc(g, 14, y - 3, 6, leaf2); disc(g, len - 6, y - 6, 4, leaf); disc(g, Math.round(len * 0.45), y - 9, 4, leaf2);
  }
  if (L.branchR !== undefined) {
    const y = L.branchR, x0 = Math.round(W * 0.6);
    rect(g, x0, y, W - x0, 3, bark); rect(g, x0 + 4, y + 3, W - x0, 1, dark);
    disc(g, W - 4, y - 5, 9, leaf); disc(g, x0 + 4, y - 4, 4, leaf2);
  }
  if (L.feeder) {
    const [x, y] = L.feeder;
    rect(g, x - 1, y, 2, L.gy - y, C('smoke')); rect(g, x - 10, y, 20, 2, C('rust')); rect(g, x - 10, y + 2, 20, 1, C('brick'));
    for (let i = -8; i < 8; i += 3) rect(g, x + i, y - 1, 1, 1, C('warbler'));
  }
  if (L.post) { const [x, y] = L.post; rect(g, x - 3, y, 7, H - y, dark); rect(g, x - 3, y, 7, 2, bark); rect(g, x - 2, y + 6, 1, H - y, bark); }
}

const sumMix = (m: FeederMix) => m.reduce((n, l) => n + l.k, 0);
/** Take `k` off the top of the layers. */
function eatMix(m: FeederMix, k: number): FeederMix {
  const out = m.map((l) => ({ ...l })); let left = Math.max(0, k);
  while (left > 1e-9 && out.length) { const top = out[out.length - 1], bite = Math.min(top.k, left); top.k -= bite; left -= bite; if (top.k <= 1e-9) out.pop(); }
  return out;
}
function feederGeom(W: number, H: number) {
  const x = Math.round(W * 0.64), top = Math.round(H * 0.1);
  return { x, top, tubeY: top + 4, tubeH: 26, trayY: top + 32 };
}
function paintFeeder(g: CanvasRenderingContext2D, W: number, H: number, fill: number | FeederMix, style?: string) {
  const { x, top, trayY } = feederGeom(W, H);
  paintFeederDef(g, x, top, trayY, fill, feederOf(style));
}
/** Where the player's perch stands, and its size. */
function perchGeom(L: Layout, W: number, H: number) { return { x: Math.round(W * 0.42), ground: L.gy, h: Math.max(26, Math.min(44, Math.round(H * 0.36))) }; }

function paintWindowFrame(g: CanvasRenderingContext2D, W: number, H: number) {
  const f = '#12161B', d = '#07090B';
  rect(g, 0, 0, W, 4, f); rect(g, 0, 0, 4, H, f); rect(g, W - 4, 0, 4, H, f); rect(g, 0, H - 5, W, 5, f);
  rect(g, 4, 4, W - 8, 1, d); rect(g, 4, 4, 1, H - 9, d); rect(g, W - 5, 4, 1, H - 9, d); rect(g, 4, H - 6, W - 8, 1, '#2A333D');
  rect(g, 9, 9, 1, 7, 'rgba(214,238,242,0.7)'); rect(g, 11, 9, 1, 4, 'rgba(214,238,242,0.7)');
}

function perchFor(sp: Species): PerchKind[] {
  switch (sp.archetype) {
    case 'waterfowl': return ['water', 'ground'];
    case 'wader': return ['ground', 'water'];
    case 'gamebird': return ['ground'];
    case 'seabird': return ['water', 'ground', 'perch'];
    default: return ['perch', 'ground'];
  }
}

// ─── live scene ───
export interface Bird {
  key: string; sp: Species; frames: Uint8Array[]; perch: Perch;
  x: number; y: number; state: 'arriving' | 'perched' | 'leaving' | 'gone';
  t0: number; from: [number, number]; leaveAt: number; flip: boolean; settledAt: number; seed: number;
  blinkAt: number; actionAt: number;
  home?: Perch; eatUntil?: number; eat?: number; eatT0?: number; // share of the feeder this bird eats, and when it starts pecking
  hp?: number; hpFrom?: number; hpTo?: number; hpT0?: number; hpT1?: number; // small HP bar, animates while eating
  returnAt?: number; arc?: number; pokeAt?: number; // fly-about: when to head home, and how high the flight arcs
}

export interface DioramaOpts { sceneId?: string; frame?: boolean; hpBars?: boolean; wander?: boolean; reduced?: boolean; viewW: number; viewH: number; feeder?: number | FeederMix /* 0–1 seed level, or the food layers inside */; feederStyle?: string; perch?: string }

export class Diorama {
  private ctx: CanvasRenderingContext2D;
  private stop: (() => void) | null = null;
  private imgs: HTMLImageElement[] = [];
  private static_ = document.createElement('canvas'); // front layers + props + decor, cached
  readonly scene: SceneDef;
  readonly W: number; readonly H: number;
  private L: Layout;
  birds: Bird[] = [];
  onChange?: () => void;
  constructor(private canvas: HTMLCanvasElement, biome: Habitat, private phase: DayPhase, private opts: DioramaOpts) {
    // no chosen home: the default changes with the day (Sky meadow by day, Mountain dusk at dusk and night)
    const id = opts.sceneId && SCENES[opts.sceneId] ? opts.sceneId : defaultHome(phase);
    this.scene = { ...SCENES[id], tint: id === opts.sceneId && phase === 'night' && !/night|neon|tundra|nfa|moonkeep|dusk/.test(id) ? 'rgba(6,8,30,0.35)' : undefined };
    void biome;
    this.W = opts.viewW;
    this.H = Math.min(opts.viewH, this.scene.h);
    canvas.width = this.W; canvas.height = this.H;
    this.ctx = canvas.getContext('2d')!;
    this.L = layout(this.scene, this.W, this.H);
    // the player's own perch (from Woods' Shop): birds can land on it
    const pd = perchOf(opts.perch);
    if (pd) {
      const { x, ground, h } = perchGeom(this.L, this.W, this.H), scratch = document.createElement('canvas');
      scratch.width = this.W; scratch.height = this.H;
      for (const [px, py] of paintPerchDef(scratch.getContext('2d')!, x, ground, h, pd)) this.L.perches.push({ x: px, y: py, kind: 'perch' });
    }
    loadScene(this.scene).then((imgs) => { this.imgs = imgs; this.bakeFront(); });
  }
  private bakeFront() {
    const c = this.static_; c.width = this.W; c.height = this.H;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    // front two layers are static; props and decor sit on them
    const n = this.imgs.length;
    paintLayers(g, this.imgs.slice(Math.max(0, n - 2)), { ...this.scene, tint: undefined }, this.W, this.H, 0, 2);
    paintProps(g, this.L, this.W, this.H, this.phase === 'night');
    const pd = perchOf(this.opts.perch);
    if (pd) { const { x, ground, h } = perchGeom(this.L, this.W, this.H); paintPerchDef(g, x, ground, h, pd); }
    if (this.opts.feeder !== undefined) paintFeeder(g, this.W, this.H, this.shownMix(), this.opts.feederStyle);
  }
  private mixNow(): FeederMix { const f = this.opts.feeder; return f === undefined ? [] : typeof f === 'number' ? (f > 0 ? [{ food: 'seeds' as Food, k: f }] : []) : f; }
  // A meal in progress: the feeder shows `base` and drops toward the new contents while birds peck.
  private meal: { base: FeederMix; total: number; owed: number } | null = null;
  private mealKey = '';
  /** What the feeder shows right now. */
  private shownMix(): FeederMix {
    if (!this.meal) return this.mixNow();
    const t = performance.now(); let left = this.meal.owed;
    for (const b of this.birds) if (b.eat) left += b.eat * (1 - Math.max(0, Math.min(1, (t - (b.eatT0 ?? t)) / Math.max(1, (b.eatUntil ?? t) - (b.eatT0 ?? t)))));
    return eatMix(this.meal.base, this.meal.total - left);
  }
  private feederStep() {
    if (!this.meal) return;
    const busy = this.meal.owed > 1e-6 || this.birds.some((b) => b.eat);
    if (!busy) { this.meal = null; this.mealKey = ''; if (this.imgs.length) this.bakeFront(); return; }
    const key = mixKey(this.shownMix().map((l) => ({ food: l.food, k: Math.round(l.k * 80) / 80 })));
    if (key !== this.mealKey) { this.mealKey = key; if (this.imgs.length) this.bakeFront(); }
  }
  /**
   * Update what's in the feeder. With `from` (the contents before birds ate), the feeder keeps showing the old level
   * and drops bite by bite as each bird pecks, via `visit(…, { eat })`. Food that was eaten without a visit is settled.
   */
  setFeeder(fill: number | FeederMix, from?: FeederMix) {
    const norm = (m: FeederMix) => mixKey(m.map((l) => ({ food: l.food, k: Math.round(l.k * 80) / 80 })));
    const asM = (f: number | FeederMix): FeederMix => typeof f === 'number' ? (f > 0 ? [{ food: 'seeds' as Food, k: f }] : []) : f;
    if (!from && norm(asM(fill)) === norm(this.mixNow())) return; // nothing new (e.g. the screen re-rendering mid-meal)
    const before = this.meal ? this.shownMix() : from;
    this.opts.feeder = fill;
    const total = before ? sumMix(before) - sumMix(this.mixNow()) : 0;
    if (from && total > 1e-6) { this.meal = { base: before!, total, owed: total }; for (const b of this.birds) { b.eat = undefined; } }
    else { this.meal = null; for (const b of this.birds) b.eat = undefined; }
    this.mealKey = ''; if (this.imgs.length) this.bakeFront();
  }
  /** Food a bird ate without being seen at the feeder (no free spot): take it off at once. */
  settle(eat: number) { if (this.meal) this.meal.owed = Math.max(0, this.meal.owed - eat); }

  /** A bird flies to the feeder, pecks for a while, then flies home. With `hp`, its bar fills while it eats. */
  visit(key: string, opts: { ms?: number; hp?: [number, number]; eat?: number } = {}) {
    const b = this.birds.find((x) => x.key === key);
    if (!b || this.opts.feeder === undefined || b.eatUntil || b.state !== 'perched') return false;
    const { x, trayY } = feederGeom(this.W, this.H);
    const used = new Set(this.birds.filter((o) => o.eatUntil).map((o) => o.perch.x));
    const spotX = [x - 8, x + 9, x - 1].find((sx) => !used.has(sx));
    if (spotX === undefined) return false; // the tray holds three
    const ms = opts.ms ?? 2600;
    if (b.returnAt) { b.returnAt = undefined; }
    b.home = b.home ?? b.perch; b.from = [b.x, b.y]; b.perch = { x: spotX, y: trayY, kind: 'perch' }; b.state = 'arriving'; b.t0 = performance.now(); b.arc = 10;
    const fly = this.opts.reduced ? 200 : 1800;
    b.eatUntil = b.t0 + fly + ms; b.flip = spotX < b.x;
    if (opts.eat && this.meal) { const e = Math.min(opts.eat, this.meal.owed); this.meal.owed -= e; b.eat = e; b.eatT0 = b.t0 + fly; }
    if (opts.hp) { b.hpFrom = opts.hp[0]; b.hpTo = opts.hp[1]; b.hp = opts.hp[0]; b.hpT0 = b.t0 + fly; b.hpT1 = b.eatUntil; }
    this.onChange?.();
    return true;
  }
  /** A tapped bird hops, faces you and flaps once. */
  poke(key: string) { const b = this.birds.find((x) => x.key === key); if (b && b.state === 'perched' && !b.eatUntil && !b.returnAt) { b.pokeAt = performance.now(); b.flip = !b.flip; } }
  /** Where a bird is, in canvas pixels (for labels drawn over the canvas). */
  where(key: string) { const b = this.birds.find((x) => x.key === key); return b ? { x: b.x, y: b.y } : null; }
  /** Set a bird's HP bar without animation. */
  setHp(key: string, hp: number) { const b = this.birds.find((x) => x.key === key); if (b) b.hp = hp; }

  /** Ambient life: now and then a bird flies a loop, swaps perch, or two birds snack together. */
  private wanderAt = 0;
  private wander(t: number) {
    if (!this.opts.wander || this.opts.reduced) return;
    if (!this.wanderAt) { this.wanderAt = t + 3000; return; }
    if (t < this.wanderAt) return;
    this.wanderAt = t + 4500 + Math.random() * 5000;
    const idle = this.birds.filter((b) => b.state === 'perched' && !b.eatUntil && !b.returnAt);
    if (!idle.length) return;
    const b = idle[Math.floor(Math.random() * idle.length)];
    const r = Math.random();
    if (r < 0.4) {
      // fly a lap around the aviary, then come back
      const sky: Perch = { x: Math.round(this.W * (0.15 + Math.random() * 0.7)), y: Math.round(this.H * (0.12 + Math.random() * 0.2)), kind: 'perch' };
      b.home = b.home ?? b.perch; b.from = [b.x, b.y]; b.perch = sky; b.state = 'arriving'; b.t0 = t; b.arc = 24; b.flip = sky.x < b.x;
      b.returnAt = t + 1800 + 300;
    } else {
      // move to another free spot
      const free = this.freePerches(b.sp).filter((p) => p !== b.perch);
      if (!free.length) return;
      const p = free[Math.floor(Math.random() * free.length)];
      b.home = undefined; b.from = [b.x, b.y]; b.perch = p; b.state = 'arriving'; b.t0 = t; b.arc = 18; b.flip = p.x < b.x;
    } // (no pretend snacks since v1.33: a bird at the feeder is always really eating, so the food visibly goes down)
    this.onChange?.();
  }

  start() {
    let last = 0;
    this.stop = onTick((t) => { if (t - last < 40) return; last = t; this.step(t); this.draw(t); });
  }
  dispose() { this.stop?.(); this.stop = null; }

  freePerches(sp: Species): Perch[] {
    const kinds = perchFor(sp);
    const taken = new Set(this.birds.filter((b) => b.state !== 'gone').map((b) => b.perch));
    for (const k of kinds) {
      const p = this.L.perches.filter((q) => q.kind === k && !taken.has(q));
      if (p.length) return p;
    }
    return this.L.perches.filter((q) => !taken.has(q) && q.kind !== 'water');
  }

  add(key: string, sp: Species, parts: number[], opts: { arrive?: boolean; stay?: number; seed?: number; hp?: number } = {}): Bird | null {
    let free = this.freePerches(sp);
    const seed = opts.seed ?? 0;
    if (!free.length) { // every perch taken: make room on the ground
      const p: Perch = { x: Math.round(this.W * (0.08 + ((seed * 37) % 84) / 100)), y: this.L.gy, kind: 'ground' };
      this.L.perches.push(p); free = [p];
    }
    const perch = free[seed % free.length];
    const now = performance.now();
    const fromLeft = (seed >> 3) % 2 === 0;
    const from: [number, number] = [fromLeft ? -40 : this.W + 8, Math.max(10, perch.y - 90)];
    const placed = opts.arrive === false;
    const b: Bird = {
      key, sp, frames: renderFrames(sp, parts), perch, x: placed ? perch.x : from[0], y: placed ? perch.y : from[1],
      state: placed ? 'perched' : 'arriving', t0: now, from, leaveAt: opts.stay ? now + opts.stay : Infinity,
      flip: placed ? seed % 2 === 1 : !fromLeft, settledAt: placed ? now : 0, seed,
      blinkAt: now + 2000 + (seed % 5000), actionAt: now + 4000 + (seed % 7000), hp: opts.hp,
    };
    this.birds.push(b);
    this.onChange?.();
    return b;
  }

  /** Keys of the birds still in the scene (not flown off). */
  keys(): string[] { return this.birds.filter((b) => b.state !== 'gone' && b.state !== 'leaving').map((b) => b.key); }
  /** Send one bird flying off (Aviary swaps). */
  dismiss(key: string) { const b = this.birds.find((x) => x.key === key && x.state !== 'gone'); if (b) this.leave(b); }

  leave(b: Bird) { if (b.state === 'gone' || b.state === 'leaving') return; b.state = 'leaving'; b.t0 = performance.now(); b.flip = b.perch.x < this.W / 2; this.onChange?.(); }

  private step(t: number) {
    let changed = false;
    for (const b of this.birds) {
      if (b.state === 'arriving') {
        const k = Math.min(1, (t - b.t0) / (this.opts.reduced ? 200 : 1800));
        const e = 1 - (1 - k) * (1 - k);
        b.x = b.from[0] + (b.perch.x - b.from[0]) * e;
        b.y = b.from[1] + (b.perch.y - b.from[1]) * e - Math.sin(k * Math.PI) * (b.arc ?? 0);
        if (k >= 1) { b.state = 'perched'; b.settledAt = t; b.arc = 0; changed = true; }
      } else if (b.state === 'perched' && b.returnAt && t > b.returnAt && b.home) {
        b.from = [b.x, b.y]; b.perch = b.home; b.home = undefined; b.returnAt = undefined; b.state = 'arriving'; b.t0 = t; b.arc = 16; b.flip = b.perch.x < b.x; changed = true;
      } else if (b.state === 'perched' && b.eatUntil && t > b.eatUntil && b.home) {
        b.from = [b.x, b.y]; b.perch = b.home; b.home = undefined; b.eatUntil = undefined; b.eat = undefined; b.state = 'arriving'; b.t0 = t; b.arc = 12; b.flip = b.perch.x < b.x;
        if (b.hpTo !== undefined) { b.hp = b.hpTo; b.hpTo = undefined; }
        changed = true;
      } else if (b.state === 'perched' && t > b.leaveAt) { this.leave(b); changed = true; }
      else if (b.state === 'leaving') {
        const k = (t - b.t0) / 1500;
        b.x = b.perch.x + (b.flip ? -1 : 1) * k * 160;
        b.y = b.perch.y - k * k * 140;
        if (k >= 1) { b.state = 'gone'; changed = true; }
      }
    }
    // HP bars fill while eating
    for (const b of this.birds) if (b.hpTo !== undefined && b.hpT0 && b.hpT1 && t >= b.hpT0) b.hp = b.hpFrom! + (b.hpTo - b.hpFrom!) * Math.min(1, (t - b.hpT0) / (b.hpT1 - b.hpT0));
    this.feederStep();
    this.wander(t);
    if (changed) { this.birds = this.birds.filter((b) => b.state !== 'gone'); this.onChange?.(); }
  }

  frameFor(b: Bird, t: number): number {
    if (b.state !== 'perched' || b.returnAt) return 8 + (Math.floor((t + b.seed * 37) / FLY_MS) % FLY_FRAMES);
    if (b.pokeAt && t - b.pokeAt < 420) return 8 + (Math.floor((t - b.pokeAt) / FLY_MS) % FLY_FRAMES);
    if (b.eatUntil && t < b.eatUntil) return Math.floor(t / 180) % 2 ? 6 : 0; // pecking at the feeder
    if (this.opts.reduced) return 0;
    if (t > b.blinkAt) { if (t > b.blinkAt + 170) b.blinkAt = t + 4000 + ((b.seed * 7919 + t) % 3000); else return 4; }
    if (t > b.actionAt) {
      if (t < b.actionAt + 340) return b.seed % 3 === 0 ? 7 : 5 + (Math.floor(b.actionAt) % 2);
      b.actionAt = t + 5000 + ((b.seed * 104729 + t) % 7000);
    }
    return Math.floor((t + b.seed * 37) / 166) % 4;
  }

  spriteBox(b: Bird) {
    const k = b.pokeAt ? (performance.now() - b.pokeAt) / 420 : 1;
    const hop = k < 1 ? Math.round(Math.sin(k * Math.PI) * 7) : 0;
    return { x: Math.round(b.x - 16), y: Math.round(b.y - 30 - hop) };
  }

  /** Draw the background only (no birds) — used as the photo backdrop for palette sampling. */
  drawScene(g: CanvasRenderingContext2D, t: number) {
    const n = this.imgs.length;
    const pan = this.opts.reduced ? 0 : Math.sin((t / 40000) * Math.PI * 2) * 10;
    g.fillStyle = '#07090B'; g.fillRect(0, 0, this.W, this.H);
    if (n) {
      paintLayers(g, this.imgs.slice(0, Math.max(0, n - 2)), { ...this.scene, tint: undefined }, this.W, this.H, pan, 0);
      g.drawImage(this.static_, 0, 0);
    }
  }

  draw(t: number) {
    const g = this.ctx;
    g.imageSmoothingEnabled = false;
    this.drawScene(g, t);
    const sorted = this.birds.slice().sort((a, b) => a.y - b.y);
    for (const b of sorted) {
      const { x, y } = this.spriteBox(b);
      const f = b.frames[this.frameFor(b, t)];
      if (b.state === 'perched' && b.perch.kind === 'water') {
        g.save(); g.beginPath(); g.rect(x, y, 32, 27); g.clip();
        drawFrame(g, f, x, y, 1, b.flip); g.restore();
        g.fillStyle = 'rgba(214,238,242,0.8)'; g.fillRect(x + 6, y + 27, 20, 1); g.fillRect(x + 3, y + 28, 4, 1); g.fillRect(x + 25, y + 28, 4, 1);
      } else drawFrame(g, f, x, y, 1, b.flip);
    }
    if (this.scene.tint) { g.fillStyle = this.scene.tint; g.fillRect(0, 0, this.W, this.H); }
    if (this.opts.hpBars) {
      const placed: [number, number][] = [];
      for (const b of sorted.slice().sort((a, c) => a.x - c.x)) {
        let lift = 0; const bx = Math.round(b.x), by = Math.round(b.y);
        while (placed.some(([px, py]) => Math.abs(px - bx) < 16 && Math.abs(py - (by - lift)) < 4) && lift < 12) lift += 4;
        placed.push([bx, by - lift]);
        this.drawHp(g, b, t, lift);
      }
    }
    if (this.opts.frame) paintWindowFrame(g, this.W, this.H);
  }

  /** Tiny floating HP bar over the bird's head; glows and shows a "+" while it fills. */
  private drawHp(g: CanvasRenderingContext2D, b: Bird, t: number, lift = 0) {
    if (b.hp === undefined || b.state === 'gone') return;
    const w = 18, x = Math.round(b.x - w / 2), y = Math.max(2, Math.round(b.y - 37 - lift + (b.state === 'perched' && !b.returnAt ? Math.floor(t / 500) % 2 : 0)));
    const v = Math.max(0, Math.min(100, b.hp)) / 100;
    const filling = b.hpTo !== undefined && b.hpT0 !== undefined && t >= b.hpT0;
    const col = v > 0.5 ? '#7CE85A' : v > 0.25 ? '#F2C230' : '#E8533C';
    g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, 5);
    g.fillStyle = '#2A333D'; g.fillRect(x, y, w, 3);
    g.fillStyle = filling && Math.floor(t / 120) % 2 ? '#E9FF70' : col; g.fillRect(x, y, Math.max(v > 0 ? 1 : 0, Math.round(w * v)), 3);
    if (filling) { // little rising "+"
      const k = ((t - b.hpT0!) % 700) / 700, py = Math.round(y - 3 - k * 6);
      g.fillStyle = `rgba(233,255,112,${1 - k})`; g.fillRect(x + w + 2, py, 3, 1); g.fillRect(x + w + 3, py - 1, 1, 3);
    }
  }

  hit(lx: number, ly: number): Bird | null {
    let best: Bird | null = null, bd = Infinity;
    for (const b of this.birds) {
      if (b.state === 'gone') continue;
      const d = Math.hypot(lx - b.x, ly - (b.y - 12));
      if (d < 26 && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  /** CAM-5 for Window Mode: the actual frame around the bird is the "photo". */
  snapshot(b: Bird, size = 64): HTMLCanvasElement {
    this.draw(performance.now());
    const out = document.createElement('canvas'); out.width = 512; out.height = 512;
    const g = out.getContext('2d')!; g.imageSmoothingEnabled = false;
    const sx = Math.max(0, Math.min(this.W - size, Math.round(b.x - size / 2)));
    const sy = Math.max(0, Math.min(this.H - size, Math.round(b.y - 12 - size / 2)));
    g.drawImage(this.canvas, sx, sy, size, size, 0, 0, 512, 512);
    return out;
  }

  /**
   * Clean plate for palette extraction: the bird alone over the scene's average colour,
   * with the scene's light grade. Keeps busy painted backgrounds from bleeding into the sprite.
   */
  palettePlate(b: Bird): HTMLCanvasElement {
    const out = document.createElement('canvas'); out.width = 512; out.height = 512;
    const g = out.getContext('2d')!; g.imageSmoothingEnabled = false;
    const tmp = document.createElement('canvas'); tmp.width = 1; tmp.height = 1;
    const tg = tmp.getContext('2d')!; tg.drawImage(this.canvas, 0, 0, this.W, this.H, 0, 0, 1, 1);
    const [r, gg, bb] = tg.getImageData(0, 0, 1, 1).data;
    g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(0, 0, 512, 512);
    const plate = document.createElement('canvas'); plate.width = 64; plate.height = 64;
    const pg = plate.getContext('2d')!;
    pg.fillStyle = `rgb(${r},${gg},${bb})`; pg.fillRect(0, 0, 64, 64);
    drawFrame(pg, b.frames[0], 16, 16, 1, false);
    if (this.scene.tint) { pg.fillStyle = this.scene.tint; pg.fillRect(0, 0, 64, 64); }
    g.drawImage(plate, 0, 0, 512, 512);
    return out;
  }
}
