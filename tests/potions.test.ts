import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { SPECIES_BY_ID } from '../src/data/species';
import { startBattle, takeTurn, active, type Contender } from '../src/core/trials';
import { POTIONS, drink, potionById, GAUGE_MAX } from '../src/core/potions';

const bird = (id: string, level = 20): Contender => ({ sp: SPECIES_BY_ID[id], level, quality: 50 });
const fixed = () => 0.5;

describe('potions and gauges', () => {
  it('three colours, unlocking gradually and costing more as they grow', () => {
    expect(new Set(POTIONS.map((p) => p.kind))).toEqual(new Set(['atk', 'def', 'both']));
    const lv = POTIONS.map((p) => p.level);
    expect([...lv].sort((a, b) => a - b)).toEqual(lv);
    expect(POTIONS.filter((p) => p.level === 1).length).toBe(2);
  });
  it('red fills Attack, blue Defense, green both, never past 5', () => {
    expect(drink(potionById('atk2')!, 0, 0)).toEqual({ atk: 2, def: 0 });
    expect(drink(potionById('def3')!, 1, 4)).toEqual({ atk: 1, def: GAUGE_MAX });
    expect(drink(potionById('both1')!, 2, 2)).toEqual({ atk: 3, def: 3 });
  });
  it('drinking takes your turn and fills the gauge', () => {
    const b = startBattle([bird('amerob')], [bird('amerob')]);
    const r = takeTurn(b, { kind: 'potion', id: 'atk2' }, fixed);
    expect(active(r.b, 'you').atkG).toBe(2);
    expect(r.ev.some((e) => e.t === 'gauges')).toBe(true);
    expect(r.ev.some((e) => e.t === 'dmg' && e.side === 'you')).toBe(true);   // the rival still moved
  });
  it('a full Attack gauge hits 50% harder; a full Defense gauge takes 50% less', () => {
    const hit = (atkG: number, defG: number) => {
      const b = startBattle([bird('amerob')], [bird('amerob')]);
      b.you[0].atkG = atkG; b.foe[0].defG = defG;
      const r = takeTurn(b, { kind: 'quick' }, fixed);
      return (r.ev.find((e) => e.t === 'dmg' && e.side === 'foe') as { amount: number }).amount;
    };
    const base = hit(0, 0);
    expect(hit(5, 0) / base).toBeGreaterThan(1.4);
    expect(hit(0, 5) / base).toBeLessThan(0.6);
  });
  it('when the turn timer runs out, the rival takes your turn', () => {
    const b = startBattle([bird('amerob')], [bird('amerob')]);
    const r = takeTurn(b, { kind: 'wait', timeout: true }, fixed);
    expect(r.ev.some((e) => e.t === 'log' && /Time’s up/.test(e.text))).toBe(true);
    expect(r.ev.some((e) => e.t === 'dmg' && e.side === 'foe')).toBe(false);
    expect(r.ev.some((e) => e.t === 'dmg' && e.side === 'you')).toBe(true);
  });
});
