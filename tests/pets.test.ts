import { describe, it, expect } from 'vitest';
import { hpNow, mood, MIN_HP, visitFeeder, rest, FOODS } from '../src/core/pets';
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
