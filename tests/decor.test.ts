import { describe, it, expect } from 'vitest';
import { FEEDERS, PERCHES, DECOR, DEFAULT_FEEDER, feederOf, perchOf } from '../src/core/decor';
import { RIVALS, WANDERERS, WANDERER_PERSONA } from '../src/core/trials';

describe('Aviary decor and Bird Homes (v1.28)', () => {
  it('has 50 feeders and 50 perches with unique ids, names and sensible prices', () => {
    expect(FEEDERS.length).toBe(50);
    expect(PERCHES.length).toBe(50);
    const all = [...FEEDERS, ...PERCHES];
    expect(new Set(all.map((d) => d.id)).size).toBe(100);
    expect(new Set(all.map((d) => d.name)).size).toBe(100);
    for (const d of all) { expect(d.level).toBeGreaterThanOrEqual(1); expect(d.price).toBeGreaterThanOrEqual(0); }
    expect(DECOR[DEFAULT_FEEDER].price).toBe(0);
    expect(feederOf(undefined).id).toBe(DEFAULT_FEEDER);
    expect(perchOf(undefined)).toBe(null);
  });
  it('every rival and wanderer has a full personality', () => {
    for (const r of RIVALS) { for (const k of ['bio', 'motive', 'line', 'win', 'lose', 'low'] as const) expect(r[k].length, `${r.id} ${k}`).toBeGreaterThan(10); for (const k of ['send', 'faint', 'taunt', 'charge'] as const) expect(r[k].length, `${r.id} ${k}`).toBeGreaterThan(0); }
    for (const w of WANDERERS) expect(WANDERER_PERSONA[w], w).toBeTruthy();
  });
});
