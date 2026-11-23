import { describe, it, expect } from 'vitest';
import { SLOTS, piecesFor, earnedLevelUps, rivalLevelUps, armorStats, armorSet, themeFor, THEME_IDS, armorKey } from '../src/core/armor';
import { renderFrames, defaultParts } from '../src/core/pixel/sprite';
import { SPECIES } from '../src/data/species';
import { fighter, birdStyle } from '../src/core/trials';

describe('armor (v1.37)', () => {
  it('pieces arrive on level-ups 2, 3, 5, 8, 12, 17, 23, 30', () => {
    expect(SLOTS.map((s) => s.at)).toEqual([2, 3, 5, 8, 12, 17, 23, 30]);
    expect([0, 1, 2, 3, 4, 5, 29, 30, 45].map(piecesFor)).toEqual([0, 0, 1, 2, 2, 3, 7, 8, 8]);
  });
  it('counts level-ups since the bird was logged, capped at Lv50', () => {
    expect(earnedLevelUps({ level: 13, fieldcraft: { total: 40 } })).toBe(0);
    expect(earnedLevelUps({ level: 16, fieldcraft: { total: 40 } })).toBe(3);
    expect(earnedLevelUps({ level: 90, fieldcraft: { total: 40 } })).toBe(37);
    expect(rivalLevelUps(18)).toBe(8);
  });
  it('every species gets a theme and unique piece names', () => {
    const names = new Set<string>();
    for (const sp of SPECIES) {
      const t = themeFor(sp, birdStyle(sp)); expect(THEME_IDS).toContain(t);
      const set = armorSet(sp, birdStyle(sp), 30);
      expect(set.pieces).toHaveLength(8);
      names.add(set.pieces[1].name + sp.id);
    }
    expect(names.size).toBe(SPECIES.length);
  });
  it('abilities change battle stats', () => {
    const sp = SPECIES[0];
    const plain = fighter({ sp, level: 20, quality: 50 }), geared = fighter({ sp, level: 20, quality: 50, armor: 8 });
    expect(geared.ppMax).toBe(plain.ppMax + 1);
    expect(geared.max).toBeGreaterThan(plain.max);
    expect(geared.atk).toBeGreaterThan(plain.atk);
    expect(geared.spd).toBeGreaterThan(plain.spd);
    expect(armorStats(8).start).toBe(25);
    expect(armorStats(0)).toEqual({ pp: 0, dr: 0, hp: 0, spd: 0, atk: 0, gauge: 1, start: 0 });
  });
  it('armor renders on every species and frame without breaking the sprite', () => {
    for (const sp of SPECIES) {
      const parts = defaultParts(sp);
      const plain = renderFrames(sp, parts), armored = renderFrames(sp, parts, { armor: { theme: themeFor(sp, birdStyle(sp)), pieces: 8 } });
      expect(armored).toHaveLength(plain.length);
      let changed = 0;
      armored.forEach((f, i) => { for (let k = 0; k < 1024; k++) if ((f[k] === 255) !== (plain[i][k] === 255) || (f[k] !== 255 && f.pal[f[k]].join() !== plain[i].pal[plain[i][k]].join())) changed++; });
      expect(changed).toBeGreaterThan(20);
    }
    expect(armorKey(null)).toBe('');
  });
});
