import { describe, it, expect } from 'vitest';
import { LENSES, LENS_ORDER, LENS_TIERS, TIER_META, RETIRED_LENSES, boostedPower, lensOf } from '../src/core/lenses';

describe('snap lenses', () => {
  it('has a big, well-ordered catalogue', () => {
    expect(LENS_ORDER.length).toBeGreaterThanOrEqual(25);
    expect(new Set(LENS_ORDER).size).toBe(LENS_ORDER.length);
    const l = LENS_ORDER.map((id) => LENSES[id]);
    for (let i = 1; i < l.length; i++) {
      expect(l[i].price).toBeGreaterThan(l[i - 1].price);          // dearer as you go
      expect(l[i].power).toBeGreaterThanOrEqual(l[i - 1].power);   // never weaker than a cheaper lens
      expect(l[i].level).toBeGreaterThanOrEqual(l[i - 1].level);   // tiers unlock in order
    }
    expect(LENSES.ripple.price).toBe(0);
    expect(Math.max(...l.map((x) => x.power))).toBeLessThanOrEqual(20);
  });
  it('keeps the five original lenses and their boosts', () => {
    expect([LENSES.ripple.power, LENSES.bubble.power, LENSES.ember.power, LENSES.arcane.power, LENSES.phantom.power]).toEqual([0, 5, 10, 15, 20]);
  });
  it('locks tiers behind trainer levels', () => {
    expect(LENSES.phantom.level).toBe(TIER_META.epic.level);
    expect(LENSES.dewdrop.level).toBe(1);
  });
  it('has no Legendary tier any more, and each rare lens has its own colour', () => {
    expect(LENS_TIERS).toEqual(['common', 'rare', 'epic']);
    for (const id of Object.keys(RETIRED_LENSES)) expect(LENSES[id]).toBe(undefined);
    for (const tier of ['rare', 'epic'] as const) {
      const cols = LENS_ORDER.filter((id) => LENSES[id].tier === tier).map((id) => LENSES[id].colors.A);
      expect(new Set(cols).size).toBe(cols.length);
    }
  });
  it('adds the bonus and caps Snap Power at 100', () => {
    expect(boostedPower(60, 'ember')).toBe(70);
    expect(boostedPower(94, 'phantom')).toBe(100);
    expect(boostedPower(50, 'nope')).toBe(50);
    expect(lensOf(undefined).id).toBe('ripple');
  });
});
