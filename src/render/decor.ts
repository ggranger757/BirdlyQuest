// Pixel painters for Aviary decor: 10 feeder designs and 10 perch structures, each in 5 colourways (src/core/decor.ts).
// Feeders hang from (x, top) and always keep a tray at trayY (birds stand on it to eat).
import type { FeederDef, PerchDef } from '../core/decor';

type G = CanvasRenderingContext2D;
const rect = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (g: G, cx: number, cy: number, r: number, c: string) => { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); } };
const INK = '#0A0C0F', GLASS = 'rgba(214,238,242,0.38)', SEED = '#E8C04A', SEED2 = '#8A5A35', GLINT = 'rgba(255,255,255,0.6)';

function seeds(g: G, x0: number, y0: number, w: number, h: number) {
  if (h <= 0) return;
  rect(g, x0, y0, w, h, SEED);
  for (let y = y0 + 1; y < y0 + h; y += 2) for (let x = x0 + ((y >> 1) % 2); x < x0 + w; x += 3) rect(g, x, y, 1, 1, SEED2);
}
function tray(g: G, x: number, trayY: number, f: FeederDef, fill: number) {
  rect(g, x - 13, trayY, 27, 2, f.pal.roof); rect(g, x - 13, trayY + 2, 27, 1, f.pal.trim);
  if (fill > 0) for (let i = -11; i < 12; i += 3) rect(g, x + i, trayY - 1, 1, 1, SEED);
}

/** Draw a feeder. `fill` 0–1 shows how much seed is left. */
export function paintFeederDef(g: G, x: number, top: number, trayY: number, fill: number, f: FeederDef) {
  const p = f.pal, k = Math.max(0, Math.min(1, fill));
  rect(g, x, 0, 1, top, INK); // hanging wire
  switch (f.shape) {
    case 'tube': {
      const y = top + 4, h = trayY - y - 2;
      rect(g, x - 8, top, 17, 3, p.roof); rect(g, x - 7, top + 1, 15, 1, p.roofHi);
      rect(g, x - 6, y, 13, h, INK); rect(g, x - 5, y, 11, h, GLASS);
      seeds(g, x - 5, y + h - 1 - Math.round((h - 2) * k), 11, Math.round((h - 2) * k));
      rect(g, x - 4, y + 2, 1, h - 6, GLINT);
      break;
    }
    case 'cottage': {
      for (let i = 0; i < 8; i++) rect(g, x - 12 + i, top + 8 - i, 25 - i * 2, 1, i < 2 ? p.roofHi : p.roof);
      rect(g, x - 10, top + 9, 21, trayY - top - 10, p.body); rect(g, x - 10, top + 9, 21, 1, p.trim);
      rect(g, x - 5, top + 13, 11, 10, INK); rect(g, x - 4, top + 14, 9, 8, GLASS);
      seeds(g, x - 4, top + 22 - Math.round(7 * k), 9, Math.round(7 * k));
      rect(g, x - 1, trayY - 4, 3, 3, INK); // little door
      break;
    }
    case 'platform': {
      for (const dx of [-12, 12]) rect(g, x + dx, top + 2, 1, trayY - top - 2, INK);
      rect(g, x - 13, top, 27, 3, p.roof); rect(g, x - 12, top + 1, 25, 1, p.roofHi);
      seeds(g, x - 10, trayY - 1 - Math.round(5 * k), 21, Math.round(5 * k));
      rect(g, x - 13, trayY - 3, 1, 3, p.trim); rect(g, x + 13, trayY - 3, 1, 3, p.trim);
      break;
    }
    case 'globe': {
      const cy = top + 15;
      rect(g, x - 4, top, 9, 3, p.roof); rect(g, x - 3, top + 1, 7, 1, p.roofHi);
      disc(g, x, cy, 11, INK); disc(g, x, cy, 10, GLASS);
      const lvl = Math.round(19 * k);
      g.save(); g.beginPath(); g.arc(x, cy, 10, 0, Math.PI * 2); g.clip(); seeds(g, x - 10, cy + 10 - lvl, 21, lvl); g.restore();
      rect(g, x - 6, cy - 6, 2, 4, GLINT); rect(g, x - 2, trayY - 4, 5, 4, p.trim);
      break;
    }
    case 'lantern': {
      rect(g, x - 2, top, 5, 2, p.trim); rect(g, x - 9, top + 2, 19, 3, p.roof); rect(g, x - 8, top + 3, 17, 1, p.roofHi);
      const y = top + 5, h = trayY - y - 3;
      rect(g, x - 8, y, 17, h, INK); rect(g, x - 7, y, 15, h, GLASS);
      seeds(g, x - 7, y + h - Math.round(h * 0.9 * k), 15, Math.round(h * 0.9 * k));
      for (const dx of [-8, 0, 8]) rect(g, x + dx, y, 1, h, p.trim);
      rect(g, x - 9, y + h, 19, 2, p.roof);
      break;
    }
    case 'suet': {
      rect(g, x - 9, top, 19, 3, p.roof); rect(g, x - 8, top + 1, 17, 1, p.roofHi);
      const y = top + 4, h = trayY - y - 2, sh = Math.max(2, Math.round(h * k));
      rect(g, x - 8, y + h - sh, 17, sh, '#E8D9B0');
      for (let yy = y + h - sh + 1; yy < y + h; yy += 3) for (let xx = x - 7; xx < x + 8; xx += 4) rect(g, xx, yy, 1, 1, SEED2);
      for (let xx = x - 9; xx <= x + 9; xx += 3) rect(g, xx, y, 1, h, p.trim);
      for (let yy = y; yy < y + h; yy += 4) rect(g, x - 9, yy, 19, 1, p.trim);
      break;
    }
    case 'hopper': {
      for (let i = 0; i < 5; i++) rect(g, x - 13 + i, top + 5 - i, 27 - i * 2, 1, i < 1 ? p.roofHi : p.roof);
      rect(g, x - 11, top + 6, 23, trayY - top - 7, p.body); rect(g, x - 11, top + 6, 1, trayY - top - 7, p.trim); rect(g, x + 11, top + 6, 1, trayY - top - 7, p.trim);
      rect(g, x - 8, top + 9, 17, trayY - top - 13, INK); rect(g, x - 7, top + 10, 15, trayY - top - 15, GLASS);
      seeds(g, x - 7, trayY - 5 - Math.round((trayY - top - 15) * k), 15, Math.round((trayY - top - 15) * k));
      break;
    }
    case 'teacup': {
      rect(g, x - 1, top, 3, 8, INK);
      const cy = trayY - 9;
      rect(g, x - 10, cy, 21, 2, p.roof); for (let i = 0; i < 7; i++) rect(g, x - 9 + Math.floor(i / 2), cy + 2 + i, 19 - Math.floor(i / 2) * 2, 1, i % 3 === 0 ? p.roofHi : p.body);
      rect(g, x + 10, cy + 2, 3, 1, p.roof); rect(g, x + 12, cy + 3, 1, 3, p.roof); rect(g, x + 10, cy + 6, 3, 1, p.roof); // handle
      if (k > 0) seeds(g, x - 8, cy - Math.min(2, Math.round(3 * k)), 17, Math.min(2, Math.round(3 * k)) + 1);
      break;
    }
    case 'gourd': {
      disc(g, x, top + 7, 5, p.roof); disc(g, x, trayY - 11, 10, p.roof); disc(g, x - 2, trayY - 13, 7, p.roofHi);
      disc(g, x + 1, trayY - 10, 4, INK); if (k > 0) disc(g, x + 1, trayY - 10, 3, SEED);
      rect(g, x - 1, top, 3, 3, p.trim);
      for (let i = -6; i <= 6; i += 6) rect(g, x + i, trayY - 18, 1, 1, p.body);
      break;
    }
    case 'tower': {
      for (let t = 0; t < 3; t++) {
        const y = top + t * 10, w = 9 + t * 2;
        rect(g, x - w, y, w * 2 + 1, 2, p.roof); rect(g, x - w + 1, y, w * 2 - 1, 1, p.roofHi);
        rect(g, x - 4, y + 2, 9, 8, INK); rect(g, x - 3, y + 2, 7, 8, GLASS);
        if (k > t / 3) seeds(g, x - 3, y + 4, 7, 6);
      }
      break;
    }
  }
  tray(g, x, trayY, f, k);
}

/** Draw a free-standing perch with its foot at (x, ground). Returns where birds can sit (feet positions). */
export function paintPerchDef(g: G, x: number, ground: number, h: number, d: PerchDef): [number, number][] {
  const p = d.pal, top = ground - h;
  const leaves = (cx: number, cy: number, r: number) => { disc(g, cx, cy, r, p.leaf); disc(g, cx - 1, cy - 1, Math.max(1, r - 2), p.leaf2); };
  switch (d.shape) {
    case 'twig':
      rect(g, x - 1, top, 3, h, p.wood); rect(g, x + 1, top, 1, h, p.dark); rect(g, x - 9, top, 19, 2, p.wood); rect(g, x - 9, top + 2, 19, 1, p.dark);
      rect(g, x - 4, ground - 1, 9, 2, p.dark); leaves(x + 9, top - 2, 2);
      return [[x - 5, top], [x + 6, top]];
    case 'oak':
      rect(g, x - 2, top + 6, 5, h - 6, p.wood); rect(g, x + 2, top + 6, 1, h - 6, p.dark);
      rect(g, x - 15, top + 6, 31, 3, p.wood); rect(g, x - 14, top + 9, 29, 1, p.dark); rect(g, x - 10, top + 2, 2, 4, p.wood);
      leaves(x - 15, top + 3, 5); leaves(x + 15, top + 4, 4); leaves(x - 6, top, 3);
      return [[x - 4, top + 6], [x + 9, top + 6]];
    case 'blossom':
      rect(g, x - 1, top + 4, 3, h - 4, p.wood); rect(g, x - 14, top + 4, 29, 2, p.wood); rect(g, x - 13, top + 6, 27, 1, p.dark);
      for (const [dx, dy] of [[-14, 1], [-8, 0], [6, 1], [13, 0], [0, -1]]) { disc(g, x + dx, top + dy, 2, p.leaf); rect(g, x + dx, top + dy, 1, 1, p.accent); }
      return [[x - 6, top + 4], [x + 8, top + 4]];
    case 'pine':
      rect(g, x - 1, top, 3, h, p.dark);
      for (let i = 0; i < 4; i++) { const w = 6 + i * 3, y = top + 2 + i * 6; for (let j = 0; j < 5; j++) rect(g, x - w + j, y + j, (w - j) * 2 + 1, 1, j % 2 ? p.leaf2 : p.leaf); }
      rect(g, x - 14, top + 14, 29, 2, p.wood);
      return [[x - 10, top + 14], [x + 10, top + 14]];
    case 'driftwood':
      for (let i = 0; i < 26; i++) rect(g, x - 13 + i, ground - 7 - Math.round(Math.sin(i / 4) * 2), 1, 5, i % 5 ? p.wood : p.dark);
      rect(g, x - 13, ground - 2, 26, 2, p.dark); rect(g, x + 6, ground - 14, 3, 8, p.wood); leaves(x - 12, ground - 9, 2);
      return [[x - 6, ground - 8], [x + 7, ground - 14]];
    case 'bamboo':
      for (const dx of [-10, 10]) { rect(g, x + dx - 1, top, 3, h, p.leaf2); for (let y = top + 6; y < ground; y += 8) rect(g, x + dx - 1, y, 3, 1, p.dark); }
      rect(g, x - 12, top + 2, 25, 2, p.leaf2); rect(g, x - 12, top + 4, 25, 1, p.dark); rect(g, x - 11, top + 16, 23, 2, p.leaf2);
      leaves(x - 12, top - 1, 2); leaves(x + 12, top - 1, 2);
      return [[x - 5, top + 2], [x + 5, top + 16]];
    case 'swing':
      rect(g, x - 14, top, 29, 3, p.wood); rect(g, x - 14, top + 3, 29, 1, p.dark);
      for (const dx of [-14, 14]) rect(g, x + dx, top, 2, h, p.dark);
      for (const dx of [-6, 6]) rect(g, x + dx, top + 3, 1, 18, p.accent);
      rect(g, x - 8, top + 21, 17, 2, p.wood); leaves(x - 14, top - 1, 3); leaves(x + 15, top - 1, 3);
      return [[x, top + 21], [x - 8, top]];
    case 'ladder':
      for (const dx of [-7, 7]) rect(g, x + dx, top, 2, h, p.wood);
      for (let y = top + 2, n = 0; y < ground - 4 && n < 3; y += 11, n++) { rect(g, x - 7, y, 16, 2, p.wood); rect(g, x - 7, y + 2, 16, 1, p.dark); }
      leaves(x + 9, top, 2);
      return [[x - 2, top + 2], [x + 3, top + 13], [x - 2, top + 24]];
    case 'pillar':
      rect(g, x - 6, top + 4, 13, h - 4, p.wood); rect(g, x + 4, top + 4, 3, h - 4, p.dark);
      for (let y = top + 8; y < ground; y += 7) rect(g, x - 6, y, 13, 1, p.dark);
      rect(g, x - 9, top, 19, 4, p.wood); rect(g, x - 9, top + 3, 19, 1, p.dark); rect(g, x - 8, top - 1, 9, 1, p.leaf); rect(g, x + 2, top - 1, 5, 1, p.leaf2);
      return [[x - 4, top], [x + 5, top]];
    case 'arch':
      for (const dx of [-14, 13]) rect(g, x + dx, top + 6, 2, h - 6, p.wood);
      for (let i = 0; i <= 28; i++) { const a = Math.PI * (i / 28); rect(g, x - 14 + i, top + 6 - Math.round(Math.sin(a) * 6), 2, 2, p.wood); }
      for (const [dx, dy] of [[-14, 10], [-14, 18], [13, 14], [-8, 2], [6, 1], [13, 22]]) { leaves(x + dx, top + dy, 2); rect(g, x + dx, top + dy, 1, 1, p.accent); }
      return [[x - 6, top + 1], [x + 6, top + 1]];
  }
}

/** Shop thumbnail: the item on a small backdrop. */
export function paintDecorThumb(canvas: HTMLCanvasElement, d: FeederDef | PerchDef) {
  canvas.width = 44; canvas.height = 44;
  const g = canvas.getContext('2d')!; g.imageSmoothingEnabled = false;
  rect(g, 0, 0, 44, 44, '#1B2230'); rect(g, 0, 38, 44, 6, '#2E3A2A');
  if (d.kind === 'feeder') paintFeederDef(g, 22, 4, 37, 0.7, d);
  else paintPerchDef(g, 22, 40, 30, d);
}
