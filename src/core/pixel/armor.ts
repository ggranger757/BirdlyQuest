// Paints a bird's armor onto every animation frame (v1.37). Frames are lists of part-labelled pixels, so each piece
// finds its place on any species and any pose: the helmet covers the head above the eye, the necklace sits on the
// first row under the head, the chestplate covers the breast, wing guards edge the wings, talons sheathe the legs,
// the back gear hangs behind the shoulder, the sigil marks the chest and the aura sparkles around the outline.
import { THEMES, DYES, GLOWS, type ArmorLook } from '../armor';
import { P } from './archetypes';

type RGB = [number, number, number];
export interface APx { x: number; y: number; part: number; lab: [number, number, number]; rgb?: RGB }
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as RGB;
const HEAD = new Set<number>([P.HEAD, P.CROWN, P.NAPE, P.MASK, P.CHEEK]);
const HEADISH = new Set<number>([P.HEAD, P.CROWN, P.NAPE, P.MASK, P.CHEEK, P.CREST, P.EYE, P.BEAK]);
const BODYISH = new Set<number>([P.BODY, P.BELLY, P.BIB]);
const ARMOR = 99; // part id for pixels the armor adds

/** Extra colours each theme needs for its back gear and helmet details. */
const EXTRA: Record<string, { cape: string; eye?: string; flame?: string }> = {
  arcane: { cape: '#7A2AB8' }, neon: { cape: '#14162A', flame: '#FF3FD8' }, wasteland: { cape: '#3E2C22', flame: '#FF7A1A' },
  mecha: { cape: '#D8343C', eye: '#5BFF8A', flame: '#7FD4FF' }, clockwork: { cape: '#5E3A18' }, shogun: { cape: '#141014' },
  celestial: { cape: '#3A3A7A' }, verdant: { cape: '#2E6A2A' },
};

export function armorize(frames: APx[][], look: ArmorLook, form: { eye: [number, number] | null; shoulder: [number, number]; front: boolean }): APx[][] {
  if (!look || look.pieces <= 0) return frames;
  const th = THEMES[look.theme], dye = DYES[look.dye ?? 'theme'] ?? DYES.theme, ex = EXTRA[look.theme];
  const [mBase, mLight, mDark] = (dye.metal ?? th.metal).map(hex) as [RGB, RGB, RGB];
  const trim = hex(dye.trim ?? th.trim), glow = hex(GLOWS[look.glow ?? 'theme']?.hex ?? th.glow), cape = dye.metal ? mix(hex(dye.metal[2]), hex(ex.cape), 0.35) : hex(ex.cape);
  const n = look.pieces;
  return frames.map((pxs, fi) => paint(pxs, fi));

  function paint(pxs: APx[], fi: number): APx[] {
    const grid = new Map<number, APx>();
    for (const p of pxs) if (p.x >= 0 && p.y >= 0 && p.x < 32 && p.y < 32) grid.set(p.y * 32 + p.x, { ...p });
    const origRgb = new Map<number, RGB | undefined>([...grid].map(([k, p]) => [k, p.rgb]));
    const at = (x: number, y: number) => (x < 0 || y < 0 || x > 31 || y > 31 ? undefined : grid.get(y * 32 + x));
    const set = (x: number, y: number, c: RGB) => { const p = at(x, y); if (p) p.rgb = c; };
    const add = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x > 31 || y > 31 || grid.has(y * 32 + x)) return; grid.set(y * 32 + x, { x, y, part: ARMOR, lab: [0, 0, 0], rgb: c }); };
    const all = [...grid.values()];
    const head = all.filter((p) => HEADISH.has(p.part));
    if (!head.length) return pxs;
    const avg = (ps: APx[], k: 'x' | 'y') => ps.reduce((s, p) => s + p[k], 0) / ps.length;
    const beak = all.filter((p) => p.part === P.BEAK), eyes = all.filter((p) => p.part === P.EYE);
    const hcx = avg(head, 'x');
    const d = form.front ? 0 : beak.length ? Math.sign(avg(beak, 'x') - hcx) || 1 : 1;
    const dir = d || 1;
    const eye = eyes.length ? { x: Math.round(avg(eyes, 'x')), y: Math.round(avg(eyes, 'y')) } : form.eye ? { x: form.eye[0], y: form.eye[1] } : { x: Math.round(hcx), y: Math.round(avg(head, 'y')) };
    const headBottom = new Map<number, number>();
    for (const p of head) if (p.part !== P.BEAK) headBottom.set(p.x, Math.max(headBottom.get(p.x) ?? -1, p.y));
    const body = all.filter((p) => BODYISH.has(p.part));
    const sx = form.shoulder[0];

    // 3 · chestplate: the breast, in front of the shoulder, with plate seams and a lit front edge
    const chest = body.filter((p) => (form.front ? Math.abs(p.x - 15.5) <= 4 : (p.x - sx) * dir >= 1) && p.y > (headBottom.get(p.x) ?? -1));
    if (n >= 3) {
      const frontEdge = new Map<number, number>();
      for (const p of chest) frontEdge.set(p.y, Math.max(frontEdge.get(p.y) ?? -99, p.x * dir));
      // one clean plate: lit top edge and front edge, a single seam across the middle, shaded bottom edge
      const top = Math.min(...chest.map((p) => p.y)), bot = Math.max(...chest.map((p) => p.y)), seam = Math.round((top + bot) / 2);
      for (const p of chest) {
        const front = p.x * dir === frontEdge.get(p.y);
        p.rgb = p.y === top ? mLight : p.y === bot ? mDark : p.y === seam ? (front ? mBase : mDark) : front ? mLight : mBase;
      }
    }
    // 4 · wing guards: a solid pauldron over the shoulder: lit top edge, metal body, trim rim along the bottom
    if (n >= 4) {
      const sy = form.shoulder[1] + (fi >= 8 ? [1, 0, -1, -1, 0, 1, 1, 1][fi - 8] ?? 0 : 0);
      const isWing = (p: APx) => p.part === P.WING || p.part === P.FARWING || (fi >= 8 && p.part === P.BODY);
      const pad = all.filter((p) => isWing(p) && Math.abs(p.x - sx) <= 3 && p.y >= sy - 2 && p.y <= sy + 2 && !HEADISH.has(p.part));
      const inPad = new Set(pad.map((p) => p.y * 32 + p.x));
      for (const p of pad) {
        const up = !inPad.has((p.y - 1) * 32 + p.x), down = !inPad.has((p.y + 1) * 32 + p.x);
        p.rgb = up ? mLight : down ? trim : (p.x * dir) === Math.max(...pad.filter((q) => q.y === p.y).map((q) => q.x * dir)) ? mDark : mBase;
      }
      if (pad.length) { const c = pad.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x * dir > a.x * dir) ? b : a)); c.rgb = mix(mLight, hex('#FFFFFF'), 0.6); }
    }
    // 5 · talons: sheathed legs with bright claws
    if (n >= 5) for (const p of all) if (p.part === P.LEG) {
      const below = at(p.x, p.y + 1);
      p.rgb = !below || below.part !== P.LEG ? trim : p.y % 2 ? mLight : mDark;
    }
    // 2 · helmet: the head above the eye line, lit on top, plus the theme's crest
    if (n >= 2) {
      const helm = head.filter((p) => HEAD.has(p.part) && p.y <= eye.y);
      const cheek = head.filter((p) => HEAD.has(p.part) && p.y === eye.y + 1 && (p.x - eye.x) * dir < 0);
      const topAt = new Map<number, number>();
      for (const p of helm) topAt.set(p.x, Math.min(topAt.get(p.x) ?? 99, p.y));
      for (const p of helm) p.rgb = p.y === topAt.get(p.x) ? mLight : p.y === eye.y ? mDark : p.y === eye.y - 1 ? trim : mBase;
      for (const p of cheek) p.rgb = mDark;
      if (helm.length) { const g = helm.filter((p) => p.y === Math.min(...helm.map((q) => q.y))).reduce((a, b) => (b.x * dir > a.x * dir ? b : a)); g.rgb = mix(mLight, hex('#FFFFFF'), 0.65); }
      if (helm.length) {
        const top = Math.min(...helm.map((p) => p.y));
        const row = helm.filter((p) => p.y === top).map((p) => p.x);
        const xs = helm.map((p) => p.x);
        const fx = d ? (d > 0 ? Math.max(...row) : Math.min(...row)) : Math.round(avg(helm, 'x'));
        const bx = d ? (d > 0 ? Math.min(...row) : Math.max(...row)) : Math.round(avg(helm, 'x')); // back of the top row
        void xs;
        const cx = Math.round((Math.min(...row) + Math.max(...row)) / 2);
        switch (look.theme) {
          case 'arcane': // a flowing plume from the back, and a rune gem on the brow
            // plume: rises from the back of the helm and sweeps backwards
            [[0, -1], [0, -2], [-1, -2], [-1, -3], [-2, -3], [-3, -3], [-2, -2], [-4, -2], [-4, -3]].forEach(([u, v], i) => add(bx + u * dir, top + v, i === 1 || i === 4 ? mix(cape, hex('#FFFFFF'), 0.35) : i >= 7 ? mix(cape, hex('#000000'), 0.3) : cape));
            set(fx, top + 1, glow); break;
          case 'neon': { // a glowing visor across the eye, and an antenna
            for (const p of head) if (p.y === eye.y && (p.x - eye.x) * dir >= -1 && p.part !== P.BEAK) p.rgb = glow;
            for (let k = 1; k <= 3; k++) add(bx, top - k, mLight);
            add(bx, top - 4, trim); break;
          }
          case 'wasteland': { // round goggle, riveted helmet, and a filter over the beak
            set(eye.x, eye.y, glow);
            for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const p = at(eye.x + u, eye.y + v); if (p && HEAD.has(p.part)) p.rgb = mDark; }
            for (const p of helm) if (p.y === eye.y - 1 && p.x % 2 === 0) p.rgb = mDark;
            const near = beak.length ? beak.reduce((a, b) => ((b.x - a.x) * dir < 0 ? b : a)) : null;
            if (near) { set(near.x, near.y, mDark); add(near.x, near.y + 1, mDark); add(near.x, near.y + 2, mLight); }
            break;
          }
          case 'mecha': // the V-fin, a red crest and bright green eyes
            [[-1, -1], [-2, -2], [-3, -3], [1, -1], [2, -2], [3, -3]].forEach(([u, v]) => add(cx + u, top + v, glow));
            add(cx, top - 1, hex('#D8343C')); set(eye.x, eye.y, hex(ex.eye!)); break;
          case 'clockwork': { // brass goggles pushed up on the brow, and a little gear
            const gy = Math.max(top, eye.y - 2);
            set(eye.x, gy, glow); set(eye.x + dir, gy, glow); set(eye.x - dir, gy, trim); set(eye.x + 2 * dir, gy, trim);
            add(bx - dir, top + 1, mLight); add(bx - dir, top + 2, mDark); add(bx - 2 * dir, top + 1, mDark); break;
          }
          case 'shogun': // golden crescent horns and a neck guard
            [[-1, -1], [-2, -2], [-3, -3], [1, -1], [2, -2], [3, -3], [-3, -4], [3, -4]].forEach(([u, v]) => add(cx + u, top + v, glow));
            for (let k = 0; k <= 2; k++) add(bx - dir, eye.y + k, k === 2 ? trim : mDark); break;
          case 'celestial': { // a floating halo and a star on the brow
            const x0 = Math.min(...row) - 1, x1 = Math.max(...row) + 1;
            for (let x = x0; x <= x1; x++) add(x, top - 2, x === x0 || x === x1 ? mix(trim, hex('#FFFFFF'), 0.2) : trim);
            set(fx, top + 1, glow); break;
          }
          case 'verdant': // a crown of leaves with one flower
            for (const x of row) add(x, top - 1, (x + fi) % 2 ? mLight : mBase);
            add(cx, top - 2, glow); break;
        }
      }
    }
    // 1 · necklace: a chain along the first row under the head, with a pendant at the front
    if (n >= 1) {
      const links: APx[] = [];
      for (const [x, yb] of headBottom) { const p = at(x, yb + 1); if (p && BODYISH.has(p.part)) links.push(p); }
      if (links.length) {
        for (const p of links) p.rgb = trim;
        const front = d ? links.reduce((a, b) => (b.x * dir > a.x * dir ? b : a)) : links.reduce((a, b) => (Math.abs(b.x - 15.5) < Math.abs(a.x - 15.5) ? b : a));
        front.rgb = mix(glow, hex('#FFFFFF'), 0.45);
        const below = at(front.x, front.y + 1);
        if (below) below.rgb = look.theme === 'wasteland' ? mLight : glow;
        const below2 = at(front.x, front.y + 2);
        if (below2 && look.theme !== 'wasteland') below2.rgb = mix(glow, hex('#000000'), 0.4);
      }
    }
    // 6 · back gear, hung behind the shoulder (only where nothing of the bird is drawn)
    if (n >= 6) {
      const sy = form.shoulder[1] + (fi >= 8 ? [1, 0, -1, -1, 0, 1, 1, 1][fi - 8] ?? 0 : 0);
      // the back-most pixel of the bird (not tail or wing tips) on the shoulder row: gear hangs just outside it
      const rows = all.filter((p) => p.y === sy && p.part !== P.TAIL && p.part !== ARMOR && (fi < 8 || (p.part !== P.WING && p.part !== P.FARWING)));
      const back = rows.length ? rows.reduce((a, b) => (b.x * dir < a.x * dir ? b : a)) : null;
      const edgeAt = (y: number) => { const r = all.filter((p) => p.y === y && p.part !== ARMOR); return r.length ? r.reduce((a, b) => (b.x * dir < a.x * dir ? b : a)).x : null; };
      if (back) {
        const bx = back.x - dir, by = back.y;
        const flick = fi % 2 === 0;
        switch (look.theme) {
          case 'arcane': case 'verdant': { // a cape: clasped at the shoulder, draped two pixels thick along the back, flaring at the hem
            const shade = mix(cape, hex('#000000'), 0.35), lit = mix(cape, hex('#FFFFFF'), 0.25);
            set(back.x, by, trim);
            for (let k = 0; k < 8; k++) {
              const ex0 = edgeAt(by + k); if (ex0 === null) break;
              const flare = Math.floor(k / 3) + (k >= 6 && fi % 4 < 2 ? 1 : 0);
              for (let w = 1; w <= 1 + Math.min(2, flare); w++) add(ex0 - w * dir, by + k, w === 1 ? (look.theme === 'verdant' && k % 2 ? mLight : lit) : k === 7 ? shade : cape);
            }
            break;
          }
          case 'neon': case 'mecha': { // a jet pack / thruster with a flickering flame
            for (let y = by - 1; y <= by + 2; y++) for (const u of [0, 1]) add(bx - u * dir, y, y === by - 1 ? mLight : y === by ? (look.theme === 'neon' ? glow : trim) : look.theme === 'mecha' ? mBase : mDark);
            add(bx, by + 3, mDark); add(bx - dir, by + 3, mDark);
            add(bx, by + 4, hex(ex.flame!)); if (flick) add(bx - dir, by + 4, hex(ex.flame!)); if (flick) add(bx, by + 5, glow);
            break;
          }
          case 'wasteland': // a fuel tank with hazard stripes
            for (let y = by - 1; y <= by + 2; y++) for (const u of [0, 1]) add(bx - u * dir, y, (y + u) % 2 ? trim : mDark);
            add(bx - dir, by - 2, mLight); break;
          case 'clockwork': // a brass boiler with a chimney puffing steam
            for (let y = by - 1; y <= by + 1; y++) for (const u of [0, 1, 2]) add(bx - u * dir, y, u === 1 && y === by ? glow : y === by - 1 ? mLight : mBase);
            add(bx - 2 * dir, by - 2, mDark); add(bx - 2 * dir, by - 3, mDark);
            if (fi % 4 < 2) { add(bx - 2 * dir, by - 5, hex('#E6E6E6')); add(bx - 3 * dir, by - 6, hex('#C8C8C8')); } break;
          case 'shogun': { // a sashimono war banner on a pole
            const pole = hex('#3A2416');
            for (let k = 1; k <= 9; k++) add(bx, by - k, pole);
            for (let y = by - 9; y <= by - 6; y++) for (const u of [1, 2, 3]) add(bx - u * dir, y, u === 2 && y === by - 8 ? glow : mBase);
            break;
          }
          case 'celestial': { // a star orbiting the bird
            const a = (fi % 8) * (Math.PI / 4), ox = Math.round(15.5 + Math.cos(a) * 12), oy = Math.round(16 + Math.sin(a) * 6) - 4;
            add(ox, oy, hex('#FFFFFF')); for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) add(ox + u, oy + v, trim);
            break;
          }
        }
      }
    }
    // 7 · sigil: an emblem in the middle of the chestplate
    if (n >= 7 && chest.length) {
      const cx = Math.round(avg(chest, 'x')), cy = Math.round(avg(chest, 'y'));
      set(cx, cy, glow); for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const p = at(cx + u, cy + v); if (p && BODYISH.has(p.part)) p.rgb = trim; }
    }
    // outline: a dark edge traced around the armor wherever it meets open sky, so every piece reads at small sizes
    {
      const OUT = mix(mDark, hex('#000000'), 0.62);
      const isArmor = (k: number) => { const p = grid.get(k); return !!p && (p.part === ARMOR || p.rgb !== origRgb.get(k)); };
      const edge: number[] = [];
      for (const k of grid.keys()) if (isArmor(k)) {
        const x = k % 32, y = (k - x) / 32;
        for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nx = x + u, ny = y + v; if (nx >= 0 && ny >= 0 && nx < 32 && ny < 32 && !grid.has(ny * 32 + nx)) edge.push(ny * 32 + nx); }
      }
      for (const k of edge) { const x = k % 32; add(x, (k - x) / 32, OUT); }
      // and a dark seam where the big plates meet feathers, so the plate's shape is clear
      for (const p of [...chest, ...head.filter((q) => HEAD.has(q.part) && q.y <= eye.y)]) {
        const k = p.y * 32 + p.x; if (!isArmor(k)) continue;
        const back = grid.get(p.y * 32 + p.x - dir);
        if (back && !isArmor(p.y * 32 + p.x - dir) && back.part !== P.EYE && back.part !== P.BEAK) p.rgb = mix(mDark, OUT, 0.5);
      }
    }
    // 8 · aura: three four-point stars twinkling around the bird, in the theme's glow
    if (n >= 8) {
      const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const spots: [number, number][] = [[d >= 0 ? x0 - 1 : x1 + 1, y0 + 1], [d >= 0 ? x1 + 1 : x0 - 1, Math.round((y0 + y1) / 2) + 1], [Math.round((x0 + x1) / 2), y0 - 2]];
      const white = hex('#FFFFFF');
      spots.forEach(([x, y], i) => {
        if ((fi + i * 3) % 6 >= 4) return; // each star blinks off now and then
        add(x, y, white);
        for (const [u, v] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) add(x + u, y + v, glow);
      });
      // and the armor itself glows: lit plates catch the theme's light
      for (const p of grid.values()) if (p.rgb && p.rgb === mLight && (p.x + p.y + fi) % 7 === 0) p.rgb = mix(mLight, glow, 0.5);
    }
    return [...grid.values()];
  }
}
