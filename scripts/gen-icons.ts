// Generates PWA icons from the real sprite pipeline (a cardinal on FIELD 32).
import { writeFileSync, mkdirSync } from 'node:fs';
import { encodePNG, Canvas } from './png';
import { SPECIES_BY_ID } from '../src/data/species';
import { renderFrames, defaultParts } from '../src/core/pixel/sprite';
import { RGB, CLEAR, hexToRgb } from '../src/core/palette';
mkdirSync('public/icons', { recursive: true });
const sp = SPECIES_BY_ID.norcar;
const f = renderFrames(sp, defaultParts(sp))[0];
function icon(size: number, pad: number, out: string) {
  const c = new Canvas(size, size, hexToRgb('#0A0C0F'));
  // sun disc behind the bird
  const r = size * 0.36, cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < r * r) c.rect(x, y, 1, 1, d > (r - Math.max(2, size / 64)) ** 2 ? hexToRgb('#C6FF1A') : hexToRgb('#11151A')); }
  const scale = Math.floor((size - pad * 2) / 32);
  const ox = Math.floor((size - 32 * scale) / 2), oy = Math.floor((size - 32 * scale) / 2);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = f[y * 32 + x]; if (v !== CLEAR) c.rect(ox + x * scale, oy + y * scale, scale, scale, RGB[v]); }
  writeFileSync(out, encodePNG(size, size, c.data));
}
icon(192, 16, 'public/icons/icon-192.png');
icon(512, 40, 'public/icons/icon-512.png');
icon(512, 96, 'public/icons/icon-maskable-512.png');
icon(180, 14, 'public/icons/apple-touch-icon.png');
icon(64, 2, 'public/favicon.png');
console.log('icons written');
