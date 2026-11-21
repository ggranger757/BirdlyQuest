import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { SPECIES } from '../src/data/species';
import { renderFrames, defaultParts } from '../src/core/pixel/sprite';
import { DIRECT, FLY_FRAMES, formFor } from '../src/core/pixel/birds';
import { FORMS, SHEET } from '../src/core/pixel/birdart';

const opaque = (f: Uint8Array) => f.filter((c) => c !== 255).length;
describe('bird sprites from the owner’s sheet (v1.27)', () => {
  it('every species renders all 16 frames, with a full 8-frame wingbeat', () => {
    for (const sp of SPECIES) {
      const fr = renderFrames(sp, defaultParts(sp));
      expect(fr.length, sp.id).toBe(8 + FLY_FRAMES);
      for (const f of fr) expect(opaque(f), sp.id).toBeGreaterThan(60);
      const fly = new Set(fr.slice(8).map((f) => Array.from(f).join(',')));
      expect(fly.size, `${sp.id} wings move`).toBeGreaterThan(4);
      expect(FORMS[formFor(sp)], sp.id).toBeTruthy();
    }
  });
  it('species on the sheet use the owner’s pixels unchanged', () => {
    for (const [id, idx] of Object.entries(DIRECT)) {
      const sp = SPECIES.find((s) => s.id === id)!;
      const f = renderFrames(sp, defaultParts(sp))[0], sheet = SHEET[idx];
      let same = 0, total = 0;
      for (let i = 0; i < 1024; i++) {
        const k = sheet.rows[(i / 32) | 0][i % 32];
        if (k === '.') continue;
        total++;
        const want = sheet.pal['0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(k)];
        const got = f.pal[f[i]]?.map((c) => c.toString(16).padStart(2, '0')).join('');
        if (got === want) same++;
      }
      expect(same / total, id).toBeGreaterThan(0.97);
    }
  });
  it('rendering is deterministic and colours follow the catch', () => {
    const sp = SPECIES.find((s) => s.id === 'blutit')!, d = defaultParts(sp);
    expect(Array.from(renderFrames(sp, d.slice())[0])).toEqual(Array.from(renderFrames(sp, d.slice())[0]));
    const tinted = d.slice(); tinted[1] = (tinted[1] + 3) % 32;
    expect(renderFrames(sp, tinted)[0].pal).not.toEqual(renderFrames(sp, d)[0].pal);
  });
});
