import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { BADGES, newlyEarned } from '../src/core/badges';

const sighting = (o: Record<string, unknown> = {}): any => ({
  id: Math.random().toString(36), speciesId: 'amerob', region: 'US-IL', habitat: 'urban', capturedAt: '2026-05-02T10:00:00Z', day: '2026-05-02', hour: 10,
  phase: 'day', mode: 'field', verification: 'verified', fieldcraft: { total: 50 }, rarity: 'common', note: '', sprite: { pose: 'perched', variant: 'normal' }, ...o,
});
const state = (o: Record<string, unknown> = {}): any => ({
  region: 'US-IL', habitat: 'urban', sightings: [], badges: {}, streak: { best: 0 }, events: { shares: [], sitSpots: [] },
  diorama: { birds: [] }, stats: { fills: 0, spent: 0, quests: 0 }, ...o,
});
const ids = (s: any) => newlyEarned(s).map((b) => b.id);

describe('achievements', () => {
  it('there are 48, each with art and a unique id', () => {
    expect(BADGES).toHaveLength(48);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(48);
    for (const b of BADGES) expect(b.icon, b.id).toBeTruthy();
  });
  it('care, spending and quest counters', () => {
    expect(ids(state({ stats: { fills: 1, spent: 500, quests: 5 } }))).toEqual(expect.arrayContaining(['first-fill', 'big-spender', 'quest-starter']));
    expect(ids(state({ stats: { fills: 0, spent: 499, quests: 4 } }))).not.toEqual(expect.arrayContaining(['first-fill']));
  });
  it('rarity, morphs, notes, midnight and weekends', () => {
    const s = state({ sightings: [
      sighting({ rarity: 'legendary', hour: 2, day: '2026-05-02' }), // Saturday
      sighting({ sprite: { pose: 'flight', variant: 'leucistic' }, day: '2026-05-03' }), // Sunday
      ...Array.from({ length: 10 }, () => sighting({ note: 'seen on the fence' })),
    ] });
    expect(ids(s)).toEqual(expect.arrayContaining(['rare-find', 'epic-find', 'legendary-find', 'midnight', 'weekender', 'flight-shot', 'rare-morph', 'field-notes']));
  });
  it('regional BirdDex percentage', () => {
    const one = state({ sightings: [sighting()] });
    expect(ids(one)).not.toContain('dex-10');
    const many = state({ sightings: ['amerob', 'norcar', 'blujay', 'amecro', 'moudov'].map((id) => sighting({ speciesId: id })) });
    expect(ids(many)).toContain('dex-10');
  });
});
