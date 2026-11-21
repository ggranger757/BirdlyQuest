// Pixel art for Aviary decor (v1.29), drawn with the pixel kit: 10 feeder designs and 10 perches, each in 5 colourways.
// Feeders: 32×40 sprites hung from (16, 0) with the tray (where birds eat) at y 32.
// Perches: 48×52 sprites standing on the ground at (24, 51), with landing spots for birds.
import { Spr, type Mat } from './pixelkit';
import type { FeederDef, PerchDef } from '../core/decor';

export const FEEDER_W = 32, FEEDER_H = 40, FEEDER_TRAY = 32;
export const PERCH_W = 48, PERCH_H = 52, PERCH_GROUND = 51;

const SEED: Mat = { base: '#D9AE4A', light: '#F2D27A', dark: '#8A5A2A', tex: 'seed' };
const SUET: Mat = { base: '#E8D8AE', light: '#FFF4D2', dark: '#B89A66', tex: 'seed' };
const WIRE: Mat = { base: '#3A3E48', light: '#6A7080', dark: '#1E2028', flat: true };
const GRASS: (c: string) => Mat = (c) => ({ base: c, tex: 'leaf' });

function feeder(d: FeederDef, fill: number): Spr {
  const s = new Spr(FEEDER_W, FEEDER_H), p = d.pal, cx = 16, k = Math.max(0, Math.min(1, fill));
  const roof: Mat = { base: p.roof, light: p.roofHi, tex: 'wood' };
  const roofM: Mat = { base: p.roof, light: p.roofHi, cyl: true, tex: 'metal' };
  const body: Mat = { base: p.body, tex: 'wood' };
  const trim: Mat = { base: p.trim, light: p.roof };
  const glass: Mat = { base: '#BFE6EE', light: '#F2FFFF', dark: '#7FB8C8', tex: 'glass', alpha: 0.55, cyl: true };
  s.rect(cx, 0, 1, 3, WIRE);
  const tray = () => { s.rect(3, FEEDER_TRAY, 27, 2, roof); s.rect(4, FEEDER_TRAY + 2, 25, 1, trim); s.rect(3, FEEDER_TRAY - 1, 2, 1, trim); s.rect(28, FEEDER_TRAY - 1, 2, 1, trim); if (k > 0) for (let x = 6; x < 27; x += 3) s.dot(x, FEEDER_TRAY - 1, '#D9AE4A'); };
  const seedsIn = (x: number, y: number, w: number, h: number) => { const n = Math.round(h * k); if (n > 0) s.rect(x, y + h - n, w, n, SEED); };
  switch (d.shape) {
    case 'tube':
      s.ellipse(cx, 4, 7, 2.5, roofM).rect(cx - 8, 5, 17, 2, roofM);
      s.rect(cx - 6, 7, 13, 21, glass); seedsIn(cx - 5, 8, 11, 19);
      s.rect(cx - 7, 28, 15, 3, roofM);
      s.rect(cx - 9, 13, 3, 1, trim).rect(cx + 7, 20, 3, 1, trim);   // perch ports
      s.dot(cx - 7, 12, '#1E2028').dot(cx + 7, 19, '#1E2028');
      break;
    case 'cottage':
      s.poly([[2, 14], [cx, 2], [30, 14]], roof).rect(2, 13, 28, 2, trim);
      s.rect(22, 3, 3, 7, trim).rect(21, 2, 5, 2, roof); // chimney
      s.rect(6, 15, 21, 16, body);
      s.rect(11, 18, 11, 9, trim).rect(12, 19, 9, 7, glass); seedsIn(12, 19, 9, 7);
      s.rect(15, 26, 3, 5, trim).dot(16, 28, '#1E1408');
      for (let x = 4; x < 29; x += 4) s.dot(x, 12, p.roofHi);
      break;
    case 'platform':
      s.poly([[1, 9], [31, 9], [27, 2], [5, 2]], roof).rect(1, 9, 30, 2, trim);
      s.rect(4, 11, 2, 21, trim).rect(26, 11, 2, 21, trim);
      if (k > 0) s.ellipse(cx, FEEDER_TRAY - 1, 3 + 8 * k, 1 + 3 * k, SEED);
      break;
    case 'globe':
      s.ellipse(cx, 4, 5, 3, roofM).rect(cx - 2, 7, 5, 2, trim);
      s.ellipse(cx, 18, 11, 10, glass);
      for (let y = 8; y <= 28; y++) for (let x = cx - 11; x <= cx + 11; x++) {
        const dx = (x + 0.5 - cx) / 11, dy = (y + 0.5 - 18) / 10;
        if (dx * dx + dy * dy <= 0.82 && y >= 28 - Math.round(19 * k)) s.px(x, y, SEED);
      }
      s.rect(cx - 3, 28, 7, 4, roofM);
      s.dot(cx - 6, 12, '#FFFFFF').dot(cx - 5, 11, '#FFFFFF').dot(cx - 7, 14, '#FFFFFF', 0.7);
      break;
    case 'lantern':
      s.ellipse(cx, 2, 2, 2, WIRE).rect(cx - 2, 3, 5, 2, trim);
      s.poly([[cx - 9, 10], [cx + 10, 10], [cx + 6, 5], [cx - 5, 5]], roofM);
      s.rect(cx - 8, 10, 17, 17, glass); seedsIn(cx - 7, 11, 15, 16);
      for (const x of [cx - 8, cx, cx + 8]) s.rect(x, 10, 1, 17, { base: p.trim, light: p.roof, flat: true });
      s.rect(cx - 9, 27, 19, 3, roofM).rect(cx - 6, 30, 13, 1, trim);
      break;
    case 'suet':
      s.rect(cx - 10, 3, 21, 3, roof).rect(cx - 9, 6, 19, 1, trim);
      s.rect(cx - 8, 8, 17, 21, { base: '#2A2A30', alpha: 0.3, flat: true });
      { const n = Math.max(3, Math.round(20 * k)); s.rect(cx - 8, 28 - n + 1, 17, n, SUET); }
      for (let x = cx - 9; x <= cx + 9; x += 3) s.rect(x, 7, 1, 23, WIRE);
      for (let y = 7; y <= 29; y += 4) s.rect(cx - 9, y, 19, 1, WIRE);
      break;
    case 'hopper':
      s.poly([[1, 10], [31, 10], [26, 3], [6, 3]], roof).rect(1, 10, 30, 2, trim);
      s.rect(5, 12, 23, 19, body);
      s.rect(5, 12, 2, 19, trim).rect(26, 12, 2, 19, trim);
      s.rect(9, 14, 15, 14, trim).rect(10, 15, 13, 12, glass); seedsIn(10, 15, 13, 12);
      s.rect(9, 28, 15, 2, trim);
      break;
    case 'teacup': {
      const china: Mat = { base: p.body, light: '#FFFFFF', cyl: true }, paint: Mat = { base: p.roof, light: p.roofHi, cyl: true };
      s.rect(cx, 0, 1, 15, WIRE);
      s.ellipse(cx, 29, 14, 2.5, paint);                                                     // saucer
      s.poly([[cx - 11, 17], [cx + 12, 17], [cx + 8, 28], [cx - 7, 28]], china);             // cup
      s.rect(cx - 10, 20, 21, 2, paint);                                                      // painted band
      s.ellipse(cx + 14, 22, 3.5, 3.5, china); s.ellipse(cx + 14, 22, 1.6, 1.6, { base: '#000000', alpha: 0, flat: true }); // handle ring
      for (let y = 20; y <= 24; y++) for (let x = cx + 13; x <= cx + 15; x++) if (Math.hypot(x + 0.5 - cx - 14, y + 0.5 - 22) < 1.8) s.clear(x, y);
      s.ellipse(cx + 0.5, 17, 11.5, 2.5, { base: p.body, light: '#FFFFFF' });                 // rim
      s.ellipse(cx + 0.5, 17, 9.5, 1.5, { base: '#5A4030', flat: true });                     // inside
      if (k > 0) s.ellipse(cx + 0.5, 17, 9 * Math.max(0.5, k), 1.3, SEED);
      for (let x = cx - 6; x < cx + 9; x += 5) s.dot(x, 25, p.roofHi);
      break;
    }
    case 'gourd':
      s.rect(cx, 0, 1, 4, WIRE).rect(cx - 1, 4, 3, 2, { base: '#6A5A30', tex: 'wood' });
      s.ellipse(cx, 10, 5, 5, { base: p.roof, light: p.roofHi, cyl: true });
      s.ellipse(cx, 21, 11, 10, { base: p.roof, light: p.roofHi, cyl: true });
      for (let x = cx - 8; x <= cx + 8; x += 4) s.dot(x, 15, p.body).dot(x + 2, 27, p.body);
      s.ellipse(cx + 1, 21, 4, 4, { base: '#1E1408', flat: true });
      if (k > 0) s.ellipse(cx + 1, 22, 3, 2 + k, SEED);
      s.rect(cx - 1, 25, 5, 1, trim);
      break;
    case 'tower':
      for (let t = 0; t < 3; t++) {
        const y = 1 + t * 10, w = 7 + t * 2;
        s.poly([[cx - w, y + 3], [cx + w + 1, y + 3], [cx + w - 2, y], [cx - w + 3, y]], roofM);
        s.rect(cx - 4, y + 3, 9, 7, glass);
        if (k > t / 3) s.rect(cx - 3, y + 5, 7, 5, SEED);
      }
      break;
  }
  tray();
  return s;
}

function perch(d: PerchDef): { s: Spr; spots: [number, number][] } {
  const s = new Spr(PERCH_W, PERCH_H), p = d.pal, g = PERCH_GROUND, cx = 24;
  let spots: [number, number][] = [];
  const grass = (x0: number, x1: number, c = '#5FA445') => { for (let x = x0; x <= x1; x++) { const hh = 1 + ((x * 7) % 3); s.rect(x, g - hh + 1, 1, hh, GRASS(c)); } };
  switch (d.shape) {
    case 'fence': {
      const wood: Mat = { base: p.a, light: p.d, tex: 'wood', cyl: true };
      for (const [x, top] of [[9, 20], [21, 14], [33, 20]] as [number, number][]) {
        s.poly([[x, top + 3], [x + 3, top], [x + 6, top + 3]], wood).rect(x, top + 3, 6, g - top - 2, wood);
        spots.push([x + 3, top]);
      }
      s.rect(5, 26, 38, 3, { base: p.a, light: p.d, tex: 'wood' }).rect(5, 40, 38, 3, { base: p.a, light: p.d, tex: 'wood' });
      grass(4, 44, p.b);
      for (const [x, y] of [[7, 46], [17, 47], [29, 46], [40, 47]]) { s.dot(x, y, p.c).dot(x + 1, y - 1, p.c).dot(x - 1, y - 1, p.c).dot(x, y - 2, p.c).dot(x, y - 1, '#F7E26B'); }
      break;
    }
    case 'statue': {
      const stone: Mat = { base: p.a, light: p.d }, plinth: Mat = { base: p.b, tex: 'stone' };
      s.rect(13, 41, 22, 10, plinth).rect(11, 38, 26, 4, { base: p.b, light: p.d });
      s.rect(19, 31, 10, 8, { ...stone, cyl: true });
      s.ellipse(cx, 21, 10, 12, { ...stone, cyl: true });
      // curls
      for (const [x, y] of [[17, 11], [21, 9], [26, 9], [30, 11], [15, 15], [32, 15]]) s.ellipse(x, y, 3, 3, stone);
      // face: brow, closed eyes, nose, mouth, ear
      // face: brow ridge, closed eyes (curved lids with lashes), a nose with a shadow side, lips
      const ink = d.variant === 3 ? '#14101C' : d.variant === 4 ? '#7A5418' : '#4A4438';
      s.rect(17, 18, 5, 1, { base: p.d, flat: true }).rect(26, 18, 5, 1, { base: p.d, flat: true });
      for (const ex of [17, 26]) { s.dot(ex, 21, ink).dot(ex + 1, 22, ink).dot(ex + 2, 22, ink).dot(ex + 3, 22, ink).dot(ex + 4, 21, ink); s.dot(ex + 1, 23, ink, 0.45).dot(ex + 3, 23, ink, 0.45); }
      s.rect(23, 20, 2, 6, { base: p.d, flat: true }).rect(25, 21, 1, 5, { base: p.c, flat: true }).rect(22, 26, 5, 1, { base: p.c, flat: true });
      s.dot(21, 29, ink).rect(22, 29, 5, 1, { base: p.c, flat: true }).dot(27, 29, ink).rect(22, 30, 5, 1, { base: p.d, flat: true });
      s.ellipse(14.5, 22, 1.5, 3, stone);                                                                  // ear
      if (d.variant === 1) { s.dot(16, 26, p.c).dot(17, 27, p.c).dot(31, 33, p.c).dot(30, 34, p.c); }    // verdigris
      if (d.variant === 3) for (const ex of [17, 26]) for (let i = 1; i < 4; i++) s.dot(ex + i, 22, p.c);   // glowing eyes
      spots = [[cx - 3, 7], [cx + 4, 7]];
      grass(10, 38, '#5FA445');
      break;
    }
    case 'ruins': {
      const stone: Mat = { base: p.a, light: p.d, tex: 'stone', cyl: true }, block: Mat = { base: p.b, light: p.a, tex: 'stone' };
      s.rect(7, 17, 13, 34, stone);
      for (const x of [10, 13, 16]) s.rect(x, 19, 1, 31, { base: p.b, flat: true });               // fluting
      s.rect(5, 14, 17, 4, { base: p.a, light: p.d, tex: 'stone' });
      s.poly([[5, 14], [9, 10], [12, 13], [15, 9], [19, 12], [22, 14]], { base: p.a, light: p.d, tex: 'stone' }); // broken top
      s.poly([[24, 51], [25, 38], [44, 36], [46, 51]], block);
      s.line(33, 39, 36, 46, { base: p.b, flat: true, dark: p.b }).line(36, 46, 35, 50, { base: p.b, flat: true });
      s.ellipse(10, 49, 3, 2, block).ellipse(46, 50, 2, 1.5, block);
      for (const [x, y, r] of [[8, 16, 2], [28, 38, 3], [40, 37, 2], [12, 50, 3]] as [number, number, number][]) s.ellipse(x, y, r, 1.4, { base: p.c, tex: 'moss' });
      spots = [[13, 9], [35, 36]];
      break;
    }
    case 'glow': {
      const rock: Mat = { base: p.b, tex: 'stone' };
      const crystal: Mat = { base: p.a, light: p.c, tex: 'glow', glow: p.d };
      s.ellipse(cx, 46, 16, 6, rock).rect(9, 46, 31, 5, rock);
      for (const [x, top, w] of [[14, 20, 3], [cx - 2, 7, 4], [32, 24, 3], [19, 30, 2]] as [number, number, number][]) {
        s.poly([[x, 46], [x + w, 46], [x + w - 1, top + 3], [x + w / 2, top], [x + 1, top + 3]], crystal);
      }
      for (const [x, y] of [[8, 14], [40, 10], [30, 4], [11, 30], [38, 30]]) s.dot(x, y, p.c, 0.9);
      spots = [[15, 20], [cx, 7], [33, 24]];
      break;
    }
    case 'toadstool': {
      const stem: Mat = { base: p.b, cyl: true }, cap: Mat = { base: p.a, light: p.d };
      s.rect(19, 26, 10, 25, stem).ellipse(cx, 50, 8, 2, stem);
      s.ellipse(cx, 24, 21, 12, cap);
      for (let y = 25; y < 37; y++) for (let x = 0; x < PERCH_W; x++) s.clear(x, y);
      s.rect(19, 25, 10, 26, stem);
      s.rect(7, 23, 34, 2, { base: p.b, dark: p.a, flat: true });                                      // gills
      for (const [x, y, r] of [[14, 18, 2], [24, 14, 3], [33, 18, 2], [19, 21, 1], [30, 22, 1]] as [number, number, number][]) s.ellipse(x, y, r, r * 0.8, { base: p.c, flat: true });
      if (d.variant === 2) s.rect(19, 25, 10, 26, { base: p.b, cyl: true, glow: p.d });               // glowing stem
      s.rect(36, 42, 3, 9, stem).ellipse(37.5, 41, 5, 3, cap);                                          // small one
      grass(5, 44);
      spots = [[cx - 6, 12], [cx + 6, 12]];
      break;
    }
    case 'lamp': {
      const iron: Mat = { base: p.a, light: p.b, tex: 'metal', cyl: true };
      s.rect(19, 44, 10, 7, iron).rect(17, 49, 14, 2, iron);
      s.rect(22, 15, 4, 30, iron);
      s.rect(21, 26, 6, 2, iron);
      s.poly([[16, 7], [32, 7], [28, 3], [20, 3]], iron).rect(23, 0, 2, 3, iron);
      s.rect(18, 7, 12, 9, { base: p.c, light: '#FFFFFF', tex: 'glow', glow: p.d });
      for (const x of [18, 23, 29]) s.rect(x, 7, 1, 9, { base: p.a, flat: true });
      s.rect(17, 16, 14, 2, iron);
      s.line(26, 30, 34, 22, iron).rect(33, 22, 6, 2, iron);                                            // sign arm
      spots = [[cx, 2], [36, 22]];
      break;
    }
    case 'stump': {
      const bark: Mat = { base: p.a, light: p.d, tex: d.variant === 1 ? 'plain' : 'bark', cyl: true };
      s.poly([[8, 51], [11, 44], [11, 26], [37, 26], [37, 44], [41, 51]], bark);
      s.ellipse(cx, 26, 13, 4, { base: p.b, light: '#FFF0D0', tex: 'wood' });
      for (const r of [4, 8]) for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; s.dot(cx + Math.cos(t) * r, 26 + Math.sin(t) * r * 0.32, p.a, 0.55); }
      if (d.variant === 1) for (const [x, y] of [[14, 31], [20, 37], [30, 33], [33, 42], [15, 44], [26, 46]]) s.rect(x, y, 3, 1, { base: p.c, flat: true });
      if (d.variant === 2) for (const [x, y, r] of [[13, 30, 3], [34, 40, 3], [20, 48, 4]] as [number, number, number][]) s.ellipse(x, y, r, 2, { base: p.c, light: p.d, tex: 'moss' });
      if (d.variant === 3) s.ellipse(cx, 40, 4, 5, { base: p.c, flat: true });
      if (d.variant === 4) for (const [x, y] of [[6, 50], [42, 49], [16, 50], [36, 51], [28, 50]]) { s.dot(x, y, p.c).dot(x + 1, y, p.d).dot(x, y - 1, p.c); }
      s.ellipse(39, 46, 3, 2, { base: '#E8D8C0' }).rect(39, 47, 1, 4, { base: '#E8D8C0' });               // little mushroom
      spots = [[cx - 6, 23], [cx + 6, 23]];
      break;
    }
    case 'bath': {
      const stone: Mat = { base: p.a, light: p.d, tex: d.variant === 4 ? 'cloth' : 'stone', cyl: true };
      s.ellipse(cx, 49, 11, 3, stone).rect(19, 30, 10, 18, stone).ellipse(cx, 31, 7, 2, stone);
      s.ellipse(cx, 25, 19, 6, { base: p.a, light: p.d, tex: d.variant === 4 ? 'cloth' : 'stone' });
      s.ellipse(cx, 24, 15, 3.4, { base: p.b, light: '#E8FAFF', tex: 'water' });
      s.dot(cx - 7, 23, '#FFFFFF').dot(cx - 6, 23, '#FFFFFF').dot(cx + 5, 25, '#FFFFFF', 0.8);
      if (d.variant === 3) for (const [x, y] of [[18, 34], [27, 40], [21, 45]]) s.dot(x, y, p.c);
      if (d.variant === 4) for (let x = 8; x < 41; x += 3) s.dot(x, 28, p.c);
      grass(9, 39);
      spots = [[8, 22], [40, 22]];
      break;
    }
    case 'rune': {
      const stone: Mat = { base: p.a, tex: 'stone' };
      s.poly([[12, 51], [10, 26], [14, 10], [22, 4], [31, 5], [37, 16], [38, 34], [36, 51]], stone);
      const rune: Mat = { base: p.c, light: '#FFFFFF', flat: true, glow: p.d };
      for (const [x0, y0, x1, y1] of [[21, 14, 21, 22], [21, 14, 25, 17], [27, 24, 31, 24], [29, 22, 29, 30], [18, 30, 22, 34], [22, 30, 18, 34], [25, 38, 29, 42], [29, 38, 29, 44]]) s.line(x0, y0, x1, y1, rune);
      for (const [x, y, r] of [[13, 47, 4], [35, 48, 3], [33, 12, 2]] as [number, number, number][]) s.ellipse(x, y, r, 2, { base: p.b, tex: 'moss' });
      grass(8, 40);
      spots = [[22, 4], [30, 5]];
      break;
    }
    case 'blossom': {
      const wood: Mat = { base: p.a, tex: 'bark', cyl: true };
      s.poly([[20, 51], [22, 30], [26, 30], [28, 51]], wood).ellipse(cx, 50, 7, 2, wood);
      s.line(23, 32, 11, 22, { base: p.a, tex: 'bark' }, 2).line(25, 30, 37, 18, { base: p.a, tex: 'bark' }, 2).line(24, 30, 24, 14, { base: p.a, tex: 'bark' }, 2);
      const bloom: Mat = { base: p.b, light: p.c, dark: undefined, tex: 'leaf' };
      for (const [x, y, rx, ry] of [[10, 18, 7, 5], [24, 11, 9, 6], [38, 14, 7, 5], [17, 13, 6, 4], [32, 9, 6, 4]] as [number, number, number, number][]) s.ellipse(x, y, rx, ry, bloom);
      for (const [x, y] of [[8, 16], [14, 20], [22, 8], [27, 13], [35, 12], [41, 16], [19, 11], [31, 7]]) s.dot(x, y, p.d);
      for (const [x, y] of [[8, 49], [14, 50], [33, 50], [40, 49], [44, 51], [5, 51]]) s.dot(x, y, p.b);
      if (d.variant === 3) for (const [x, y] of [[8, 22], [12, 23], [36, 19], [40, 20], [22, 17], [26, 17]]) { s.dot(x, y, p.b).dot(x, y + 1, p.c).dot(x, y + 2, p.b); } // hanging wisteria
      spots = [[12, 22], [36, 18]];
      break;
    }
  }
  // land on the art: snap each spot down (or up a little) onto the first solid pixel
  spots = spots.map(([x, y]) => { let yy = Math.max(0, y - 3); while (yy < PERCH_GROUND && !s.has(x, yy)) yy++; return [x, yy] as [number, number]; });
  return { s, spots };
}

// ─── canvases, cached ───
const cache = new Map<string, HTMLCanvasElement>();
function toCanvas(key: string, spr: Spr): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
  const g = c.getContext('2d')!, img = g.createImageData(spr.w, spr.h);
  img.data.set(spr.render()); g.putImageData(img, 0, 0);
  if (cache.size > 200) cache.clear();
  cache.set(key, c);
  return c;
}
/** RGBA pixels, for tests and tools. */
export const feederPixels = (d: FeederDef, fill: number) => feeder(d, fill).render();
export const perchPixels = (d: PerchDef) => { const { s, spots } = perch(d); return { rgba: s.render(), spots }; };
export const perchSpots = (d: PerchDef) => perch(d).spots;

/** Draw a feeder hanging from (x, top); `fill` 0–1 is how much seed is left. */
export function paintFeederDef(g: CanvasRenderingContext2D, x: number, top: number, trayY: number, fill: number, f: FeederDef) {
  const lvl = Math.round(Math.max(0, Math.min(1, fill)) * 4) / 4;
  const c = toCanvas(`${f.id}|${lvl}`, feeder(f, lvl));
  g.fillStyle = '#1E2028'; g.fillRect(Math.round(x), 0, 1, Math.max(0, top)); // the hanging wire
  g.drawImage(c, Math.round(x - 16), Math.round(trayY - FEEDER_TRAY));
}
/** Draw a perch standing on (x, ground). Returns where birds can land (their feet). */
export function paintPerchDef(g: CanvasRenderingContext2D, x: number, ground: number, _h: number, d: PerchDef): [number, number][] {
  const { s, spots } = perch(d);
  const ox = Math.round(x - PERCH_W / 2), oy = Math.round(ground - PERCH_GROUND);
  g.drawImage(toCanvas(d.id, s), ox, oy);
  return spots.map(([px, py]) => [ox + px, oy + py]);
}

/** Shop preview: the item on a small scene, drawn at native size (show it at 2× with crisp pixels). */
export function paintDecorThumb(canvas: HTMLCanvasElement, d: FeederDef | PerchDef) {
  canvas.width = 56; canvas.height = 56;
  const g = canvas.getContext('2d')!; g.imageSmoothingEnabled = false;
  const sky = g.createLinearGradient(0, 0, 0, 56); sky.addColorStop(0, '#2A3A5A'); sky.addColorStop(1, '#3E5A6E');
  g.fillStyle = sky; g.fillRect(0, 0, 56, 56);
  g.fillStyle = '#3E6A3A'; g.fillRect(0, 51, 56, 5); g.fillStyle = '#5E8E4A'; g.fillRect(0, 51, 56, 1);
  if (d.kind === 'feeder') paintFeederDef(g, 28, 5, 5 + FEEDER_TRAY + 4, 0.75, d);
  else paintPerchDef(g, 28, 52, 0, d);
}
