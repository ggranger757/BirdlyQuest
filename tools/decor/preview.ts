import { writeFileSync } from 'node:fs';
import { FEEDERS, PERCHES } from '../../src/core/decor';
import { feederPixels, perchPixels, FEEDER_W, FEEDER_H, PERCH_W, PERCH_H } from '../../src/render/decor';
const out = {
  feeders: FEEDERS.map((d) => ({ name: d.name, w: FEEDER_W, h: FEEDER_H, px: Array.from(feederPixels(d, 0.7)) })),
  perches: PERCHES.map((d) => { const r = perchPixels(d); return { name: d.name, w: PERCH_W, h: PERCH_H, px: Array.from(r.rgba), spots: r.spots }; }),
};
writeFileSync('tools/decor/out.json', JSON.stringify(out));
