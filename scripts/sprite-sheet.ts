import { writeFileSync } from 'node:fs';
import { encodePNG, Canvas } from './png';
import { SPECIES } from '../src/data/species';
import { renderFrames, defaultParts, silhouette } from '../src/core/pixel/sprite';
import { RGB, CLEAR } from '../src/core/palette';
const args = process.argv.slice(2);
const mode = args[0] ?? 'default';
const out = args[1] ?? 'sheet.png';
const frameIdx = Number(args[2] ?? 0);
const list = args[3] ? SPECIES.filter(s => args[3].split(',').includes(s.id)) : SPECIES;
const scale = 4, cell = 32 * scale + 8, cols = 10;
const rows = Math.ceil(list.length / cols);
const c = new Canvas(cols * cell, rows * cell, mode === 'sil' ? [232, 228, 216] : [43, 36, 64]);
list.forEach((sp, i) => {
  const f = mode === 'sil' ? silhouette(sp) : renderFrames(sp, defaultParts(sp))[frameIdx];
  const ox = (i % cols) * cell + 4, oy = Math.floor(i / cols) * cell + 4;
  if (mode !== 'sil') c.rect(ox, oy, 32 * scale, 32 * scale, [20, 18, 31]);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const v = f[y * 32 + x]; if (v === CLEAR) continue;
    c.rect(ox + x * scale, oy + y * scale, scale, scale, mode === 'sil' ? [20, 18, 31] : RGB[v]);
  }
});
writeFileSync(out, encodePNG(c.w, c.h, c.data));
console.log('wrote', out, list.length);
