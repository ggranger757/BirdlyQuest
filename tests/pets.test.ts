import { describe, it, expect } from 'vitest';
import { hpNow, mood, MIN_HP, visitFeeder, rest, FOODS, pourLayers, eatLayers, layersOf } from '../src/core/pets';
const at = '2026-05-01T08:00:00Z';
const bird = (id: string, hp: number): any => ({ id, capturedAt: at, pet: { hp, at } });
describe('pets and the feeder', () => {
  it('Aviary birds drain slowly and never below the floor', () => {
    expect(hpNow(bird('a', 80), new Date('2026-05-02T08:00:00Z'))).toBe(63);
    expect(hpNow(bird('a', 80), new Date('2026-06-01T08:00:00Z'))).toBe(MIN_HP);
    expect(mood(MIN_HP)).toBe('weak');
  });
  it('resting birds in the Bird Box do not get hungry', () => {
    const r = rest(bird('a', 70), new Date(at));
    expect(hpNow(r, new Date('2026-07-01T08:00:00Z'))).toBe(70);
  });
  it('hungry birds eat from the feeder, hungriest first, until it runs out', () => {
    const now = new Date('2026-05-03T08:00:00Z'); // 48h later: 80→46, 40→10
    const r = visitFeeder([bird('a', 80), bird('b', 40)], 60, now);
    expect(r.meals[0]).toEqual({ id: 'b', ate: 60 });     // b was hungriest and ate everything
    expect(r.level).toBe(0);
    expect(hpNow(r.birds[1], now)).toBe(70);
    expect(hpNow(r.birds[0], now)).toBe(46);                 // a got nothing: feeder empty
  });
  it('full birds leave the feeder alone', () => {
    const r = visitFeeder([bird('a', 95)], 100, new Date(at));
    expect(r.meals).toHaveLength(0); expect(r.level).toBe(100);
  });
  it('bigger bags are better value', () => {
    const per = (f: keyof typeof FOODS) => FOODS[f].points / FOODS[f].price;
    expect(per('worms')).toBeGreaterThan(per('seeds'));
  });
});

describe('feeder food layers (v1.33)', () => {
  it('pours on top, merges the same food, and birds eat from the top down', () => {
    let ls = pourLayers([], 'seeds', 25);
    ls = pourLayers(ls, 'berries', 60);
    ls = pourLayers(ls, 'berries', 20);
    expect(ls).toEqual([{ food: 'seeds', pts: 25 }, { food: 'berries', pts: 80 }]);
    const eaten = eatLayers(ls, 90);
    expect(eaten).toEqual([{ food: 'seeds', pts: 15 }]);
    expect(eatLayers(ls, 500)).toEqual([]);
  });
  it('old saves without layers are all seed, and layers always add up to the level', () => {
    expect(layersOf({ level: 60 })).toEqual([{ food: 'seeds', pts: 60 }]);
    expect(layersOf({ level: 50, layers: [{ food: 'worms', pts: 120 }] })).toEqual([{ food: 'worms', pts: 50 }]);
    expect(layersOf({ level: 100, layers: [{ food: 'worms', pts: 40 }] })).toEqual([{ food: 'seeds', pts: 60 }, { food: 'worms', pts: 40 }]);
  });
});
