import { describe, it, expect } from 'vitest';
import { FEEDERS, PERCHES, DECOR, DEFAULT_FEEDER, feederOf, perchOf, migratePerchId } from '../src/core/decor';
import { feederPixels, perchPixels, FEEDER_TRAY, PERCH_W, PERCH_H } from '../src/render/decor';
import { RIVALS, WANDERERS, WANDERER_PERSONA } from '../src/core/trials';

describe('Aviary decor and Bird Homes (v1.28)', () => {
  it('has 105 feeders and 50 perches with unique ids, names and sensible prices', () => {
    expect(FEEDERS.length).toBe(105);   // 15 designs × 7 colourways (v1.50)
    expect(PERCHES.length).toBe(50);
    const all = [...FEEDERS, ...PERCHES];
    expect(new Set(all.map((d) => d.id)).size).toBe(155);
    expect(new Set(all.map((d) => d.name)).size).toBe(155);
    expect(Math.max(...all.map((d) => d.level))).toBeGreaterThanOrEqual(45);   // unlocks run all the way to the Lv50 cap
    for (const d of all) expect(d.level).toBeLessThanOrEqual(50);
    for (const d of all) { expect(d.level).toBeGreaterThanOrEqual(1); expect(d.price).toBeGreaterThanOrEqual(0); }
    expect(DECOR[DEFAULT_FEEDER].price).toBe(0);
    expect(feederOf(undefined).id).toBe(DEFAULT_FEEDER);
    expect(perchOf(undefined)).toBe(null);
  });
  it('every design renders real pixel art, and perches have landing spots on the art', () => {
    for (const d of FEEDERS) {
      const px = feederPixels(d, 1); let n = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) n++;
      expect(n, d.id).toBeGreaterThan(150);
      let tray = 0; for (let x = 0; x < 32; x++) if (px[(FEEDER_TRAY * 32 + x) * 4 + 3] > 0) tray++;
      expect(tray, `${d.id} tray`).toBeGreaterThan(20);
    }
    for (const d of PERCHES) {
      const { rgba, spots } = perchPixels(d); let n = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) n++;
      expect(n, d.id).toBeGreaterThan(250);
      expect(spots.length, d.id).toBeGreaterThan(0);
      for (const [x, y] of spots) { expect(x >= 0 && x < PERCH_W && y >= 0 && y < PERCH_H, d.id).toBe(true); expect(rgba[(y * PERCH_W + x) * 4 + 3], `${d.id} spot on art`).toBeGreaterThan(0); }
    }
  });
  it('old twig perches move to the new set', () => {
    expect(migratePerchId('perch-oak-spring')).toBe('perch-statue-marble');
    expect(migratePerchId('perch-arch-golden')).toBe('perch-blossom-maple');
    expect(migratePerchId('perch-fence-white')).toBe('perch-fence-white');
  });
  it('every rival and wanderer has a full personality', () => {
    for (const r of RIVALS) { for (const k of ['bio', 'motive', 'line', 'win', 'lose', 'low'] as const) expect(r[k].length, `${r.id} ${k}`).toBeGreaterThan(10); for (const k of ['send', 'faint', 'taunt', 'charge'] as const) expect(r[k].length, `${r.id} ${k}`).toBeGreaterThan(0); }
    for (const w of WANDERERS) expect(WANDERER_PERSONA[w], w).toBeTruthy();
  });
});
