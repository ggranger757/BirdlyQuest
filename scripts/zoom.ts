import { writeFileSync } from 'node:fs';
import { encodePNG, Canvas } from './png';
import { SPECIES_BY_ID } from '../src/data/species';
import { renderFrames, defaultParts } from '../src/core/pixel/sprite';
import { RGB, CLEAR } from '../src/core/palette';
const [ids, out, framesArg] = process.argv.slice(2);
const list: any[] = ids.split(',').map(i => SPECIES_BY_ID[i]);
const frames = (framesArg ?? '0').split(',').map(Number);
const scale = 6, cell = 32 * scale + 6;
const c = new Canvas(frames.length * cell, list.length * cell, [43, 36, 64]);
list.forEach((sp: any, r: number) => {
  const fs = renderFrames(sp, defaultParts(sp));
  frames.forEach((fi: number, col: number) => {
    const f = fs[fi]; const ox = col * cell + 3, oy = r * cell + 3;
    c.rect(ox, oy, 32 * scale, 32 * scale, [63, 59, 87]);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = f[y * 32 + x]; if (v !== CLEAR) c.rect(ox + x * scale, oy + y * scale, scale, scale, RGB[v]); }
  });
});
writeFileSync(out, encodePNG(c.w, c.h, c.data));
