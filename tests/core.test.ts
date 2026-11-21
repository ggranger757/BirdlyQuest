import { describe, it, expect } from 'vitest';
import { catchXp, applyStreak, catchCoins } from '../src/core/xp';
import { rarityOf } from '../src/core/rarity';
import { SPECIES, SPECIES_BY_ID } from '../src/data/species';
import { REGIONS } from '../src/data/regions';
import { assembleSprite, renderFrames, defaultParts, passesGate, fnv1a } from '../src/core/pixel/sprite';
import { analyzePhoto } from '../src/core/pixel/extract';
import { CLEAR } from '../src/core/palette';

describe('XP (spec pack §C worked example)', () => {
  it('new Uncommon species, Fieldcraft 84, 12-day streak = 205', () => {
    expect(catchXp({ newSpecies: true, regionFirst: true, fieldcraft: 84, rarity: 'uncommon', streakDays: 12, mode: 'field' })).toBe(205);
  });
  it('imports earn 50%, sketches 40%', () => {
    const base = { newSpecies: false, regionFirst: false, fieldcraft: 0, rarity: 'common' as const, streakDays: 0 };
    expect(catchXp({ ...base, mode: 'import' })).toBe(5);
    expect(catchXp({ ...base, mode: 'sketch' })).toBe(4);
  });
  it('streak freezes cover a missed day', () => {
    let s = { days: 0, last: null as string | null, freezes: 0, best: 0 };
    for (let d = 1; d <= 7; d++) s = applyStreak(s, `2026-05-${String(d).padStart(2, '0')}`);
    expect(s.freezes).toBe(1);
    s = applyStreak(s, '2026-05-09');
    expect(s.days).toBe(8);
  });
});

describe('rarity buckets (DAT-5)', () => {
  it('maps LNS to tiers', () => {
    expect(rarityOf(0.9)).toBe('common'); expect(rarityOf(0.6)).toBe('uncommon');
    expect(rarityOf(0.3)).toBe('rare'); expect(rarityOf(0.1)).toBe('mega'); expect(rarityOf(0.02)).toBe('legendary');
  });
});

describe('seed data', () => {
  it('every region has 12 usual suspects', () => {
    for (const r of REGIONS) expect(SPECIES.filter((s) => s.occ[r.code]?.[2]).length, r.code).toBe(12);
  });
  it('facts are ≤140 characters and ids unique', () => {
    for (const s of SPECIES) expect(s.fact.length, s.id).toBeLessThanOrEqual(140);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
  });
});

function fakePhoto(seed: number): Uint8ClampedArray {
  const n = 512, a = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, inBird = (x - 256) ** 2 / 9000 + (y - 270) ** 2 / 5000 < 1;
    a[i] = inBird ? 200 : 120 + (seed % 40); a[i + 1] = inBird ? 90 : 170; a[i + 2] = inBird ? 60 : 220; a[i + 3] = 255;
  }
  return a;
}

describe('pixel pipeline (PIX-7, PIX-8, ART-5)', () => {
  it('same photo + species → identical sprite', () => {
    const sp = SPECIES_BY_ID.amerob;
    const a = analyzePhoto(fakePhoto(3), 512), b = analyzePhoto(fakePhoto(3), 512);
    const s1 = assembleSprite(sp, a.palette, a.hash), s2 = assembleSprite(sp, b.palette, b.hash);
    expect(s1.spriteHash).toBe(s2.spriteHash);
    expect(s1.parts).toEqual(s2.parts);
  });
  it('every species passes the colour gate and keeps a solid silhouette in every frame', () => {
    for (const sp of SPECIES) {
      const frames = renderFrames(sp, defaultParts(sp));
      expect(passesGate(frames[0]), sp.id).toBe(true);
      for (const f of frames) expect(f.filter((c) => c !== CLEAR).length, sp.id).toBeGreaterThan(60);
    }
  });
  it('different species produce different silhouettes from the same photo', () => {
    const a = analyzePhoto(fakePhoto(1), 512);
    const sil = (id: string) => fnv1a(renderFrames(SPECIES_BY_ID[id], assembleSprite(SPECIES_BY_ID[id], a.palette, a.hash).parts)[0].map((c) => (c === CLEAR ? 0 : 1)));
    expect(sil('amerob')).not.toBe(sil('rocpig'));
    expect(sil('mallar')).not.toBe(sil('grbher'));
  });
});

describe('rarer birds pay more', () => {
  it('Feather Coins and XP rise with rarity', () => {
    const c = (rarity: 'common' | 'uncommon' | 'rare' | 'mega' | 'legendary') => catchCoins({ seen: false, firstRecord: true, newPlumage: false, rarity });
    expect(c('common')).toBe(20);
    expect(c('uncommon')).toBeGreaterThan(c('common'));
    expect(c('rare')).toBeGreaterThan(c('uncommon'));
    expect(c('mega')).toBeGreaterThan(c('rare'));
    expect(c('legendary')).toBe(120);
    const x = (rarity: 'common' | 'legendary') => catchXp({ newSpecies: true, regionFirst: false, fieldcraft: 50, rarity, streakDays: 0, mode: 'field' });
    expect(x('legendary')).toBeGreaterThan(x('common') * 5);
  });
});
