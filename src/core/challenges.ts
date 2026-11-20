// GAM-5 challenges: 3 daily (seeded per day, no repeats within 7 days), 1 weekly, 1 seasonal.
import type { ChallengeSlot, GameState, Sighting } from './model';
import { speciesById } from '../data/provider';
import { getRegion } from '../data/geo';
import { regionSpecies } from './rarity';
import { regionEntries } from '../data/provider';
import { dayKey, daysBetween } from './xp';
import { fnv1a } from './pixel/sprite';

export interface ChallengeDef {
  id: string; kind: 'daily' | 'weekly' | 'seasonal'; xp: number; goal: (p?: ChallengeSlot['param']) => number;
  label: (p?: ChallengeSlot['param']) => string;
  progress: (s: GameState, scope: Sighting[], p?: ChallengeSlot['param']) => number;
  quick?: boolean;
}

const HAB_LABEL: Record<string, string> = { urban: 'urban patch', woodland: 'woodland', water: 'wetland or shore' };
const isNew = (s: GameState, x: Sighting) => x.firstRecord;

export const DAILY: ChallengeDef[] = [
  { id: 'D1', kind: 'daily', xp: 60, quick: true, goal: (n) => Number(n) || 2, label: (n) => `Find ${n} birds`, progress: (_s, sc) => sc.length },
  { id: 'D2', kind: 'daily', xp: 120, goal: () => 1, label: () => 'Discover a new species', progress: (s, sc) => sc.filter((x) => isNew(s, x)).length },
  { id: 'D3', kind: 'daily', xp: 80, goal: () => 1, label: (n) => `Score ${n}+ on a photo`, progress: (_s, sc, n) => sc.filter((x) => (x.fieldcraft?.total ?? 0) >= Number(n)).length },
  { id: 'D4', kind: 'daily', xp: 100, goal: () => 1, label: (f) => `Find one of the ${String(f).toLowerCase()}`, progress: (_s, sc, f) => sc.filter((x) => x.speciesId && speciesById(x.speciesId)?.familyName === f).length },
  { id: 'D5', kind: 'daily', xp: 90, goal: () => 1, label: () => 'Find a bird before 08:00', progress: (_s, sc) => sc.filter((x) => x.hour < 8).length },
  { id: 'D6', kind: 'daily', xp: 90, goal: () => 1, label: (h) => `Find a bird in a ${HAB_LABEL[String(h)]}`, progress: (_s, sc, h) => sc.filter((x) => x.habitat === h).length },
  { id: 'D7', kind: 'daily', xp: 110, goal: () => 1, label: () => 'Find an Uncommon or rarer bird', progress: (_s, sc) => sc.filter((x) => x.rarity !== 'common').length },
  { id: 'D8', kind: 'daily', xp: 100, goal: () => 1, label: () => 'File a plumage record', progress: (_s, sc) => sc.filter((x) => x.newPlumage).length },
  { id: 'D9', kind: 'daily', xp: 70, quick: true, goal: () => 2, label: () => 'Find 2 different species', progress: (_s, sc) => new Set(sc.filter((x) => x.speciesId).map((x) => x.speciesId)).size },
  { id: 'D10', kind: 'daily', xp: 80, quick: true, goal: () => 3, label: () => 'Find 3 birds in one outing', progress: (_s, sc) => maxInSession(sc) },
  { id: 'D11', kind: 'daily', xp: 90, goal: () => 1, label: () => 'Find a bird after sunset', progress: (_s, sc) => sc.filter((x) => x.phase === 'dusk' || x.phase === 'night').length },
  { id: 'D12', kind: 'daily', xp: 50, goal: () => 1, label: () => 'Share a journal spread', progress: (s) => s.events.shares.filter((d) => d === dayKey(new Date())).length },
];

function maxInSession(sc: Sighting[]): number {
  const t = sc.map((x) => new Date(x.capturedAt).getTime()).sort((a, b) => a - b);
  let best = 0;
  for (let i = 0; i < t.length; i++) { let j = i; while (j < t.length && t[j] - t[i] < 45 * 60e3) j++; best = Math.max(best, j - i); }
  return best;
}

export const WEEKLY: ChallengeDef[] = [
  { id: 'W1', kind: 'weekly', xp: 250, goal: () => 3, label: (f) => `Family focus: 3 ${String(f).toLowerCase()}`, progress: (_s, sc, f) => new Set(sc.filter((x) => x.speciesId && speciesById(x.speciesId)?.familyName === f).map((x) => x.speciesId)).size },
  { id: 'W2', kind: 'weekly', xp: 300, goal: () => 15, label: () => 'Big Day: 15 species in 24 hours', progress: (_s, sc) => bigDay(sc) },
  { id: 'W3', kind: 'weekly', xp: 220, goal: () => 5, label: () => 'Craft week: five photos at 80+', progress: (_s, sc) => sc.filter((x) => x.mode === 'field' && (x.fieldcraft?.total ?? 0) >= 80).length },
  { id: 'W4', kind: 'weekly', xp: 250, goal: () => 8, label: () => 'Patch challenge: 8 species in one habitat', progress: (_s, sc) => {
    const by: Record<string, Set<string>> = {};
    for (const x of sc) if (x.speciesId) (by[x.habitat] ??= new Set()).add(x.speciesId);
    return Math.max(0, ...Object.values(by).map((v) => v.size));
  } },
];

function bigDay(sc: Sighting[]): number {
  const t = sc.filter((x) => x.speciesId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  let best = 0;
  for (let i = 0; i < t.length; i++) {
    const start = new Date(t[i].capturedAt).getTime(); const set = new Set<string>();
    for (let j = i; j < t.length && new Date(t[j].capturedAt).getTime() - start < 864e5; j++) set.add(t[j].speciesId!);
    best = Math.max(best, set.size);
  }
  return best;
}

const migrant = (x: Sighting) => {
  const sp = speciesById(x.speciesId); if (!sp) return false;
  const o = sp.occ[x.region] ?? sp.occ[x.region.split('-')[0]];
  if (o) return o[1] !== 'R';
  const e = regionEntries(x.region).find((r) => r.sp.id === sp.id);
  return !!e && e.seasonal < 0.9; // live lists: not present all year → a migrant here
};
export const SEASONAL: ChallengeDef[] = [
  { id: 'S1', kind: 'seasonal', xp: 500, goal: () => 15, label: () => 'Spring Migration: 15 migrants', progress: (_s, sc) => new Set(sc.filter(migrant).map((x) => x.speciesId)).size },
  { id: 'S2', kind: 'seasonal', xp: 400, goal: () => 8, label: () => 'Winter Waterfowl: 8 waterfowl', progress: (_s, sc) => new Set(sc.filter((x) => x.speciesId && speciesById(x.speciesId)?.family === 'Anatidae').map((x) => x.speciesId)).size },
  { id: 'S3', kind: 'seasonal', xp: 350, goal: () => 5, label: () => 'Dawn Chorus Month: 5 birds before 07:00', progress: (_s, sc) => sc.filter((x) => x.hour < 7).length },
  { id: 'S4', kind: 'seasonal', xp: 500, goal: () => 10, label: () => 'Autumn Passage: 10 migrants', progress: (_s, sc) => new Set(sc.filter(migrant).map((x) => x.speciesId)).size },
];

export const ALL_CHALLENGES = [...DAILY, ...WEEKLY, ...SEASONAL];
export const CHALLENGE_BY_ID = Object.fromEntries(ALL_CHALLENGES.map((c) => [c.id, c]));

function seeded(key: string): () => number {
  let h = parseInt(fnv1a(Array.from(key, (c) => c.charCodeAt(0))), 16) || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)}`;
}

function familyParam(region: string, rnd: () => number): string {
  const fams = [...new Set(regionSpecies(region).map((s) => s.familyName))].sort();
  return fams[Math.floor(rnd() * fams.length)];
}

/** Daily picks: deterministic from the date; skips anything picked in the previous 6 days. */
export function pickDaily(s: GameState, today: string): ChallengeSlot[] {
  const rnd = seeded(`daily|${today}|${s.region}`);
  const recent = new Set<string>();
  for (const [d, ids] of Object.entries(s.challenges.history)) {
    const gap = daysBetween(d, today);
    if (gap > 0 && gap < 7) ids.forEach((i) => recent.add(i));
  }
  const speciesCount = new Set(s.sightings.map((x) => x.speciesId)).size;
  let pool = DAILY.filter((c) => !recent.has(c.id));
  if (pool.length < 3) pool = DAILY.slice();
  if (speciesCount < 3) pool = pool.filter((c) => c.id !== 'D8');
  const picks: ChallengeDef[] = [];
  const quick = pool.filter((c) => c.quick);
  picks.push((quick.length ? quick : DAILY.filter((c) => c.quick))[Math.floor(rnd() * (quick.length || 3))]);
  while (picks.length < 3) {
    const c = pool[Math.floor(rnd() * pool.length)];
    if (!picks.includes(c)) picks.push(c);
  }
  return picks.map((c) => ({ id: c.id, claimed: false, param: paramFor(c.id, s, rnd) }));
}

function paramFor(id: string, s: GameState, rnd: () => number): string | number | undefined {
  if (id === 'D1') return 2 + Math.floor(rnd() * 2);
  if (id === 'D3') return [75, 80, 85][Math.floor(rnd() * 3)];
  if (id === 'D4' || id === 'W1') return familyParam(s.region, rnd);
  if (id === 'D6') return ['urban', 'woodland', 'water'][Math.floor(rnd() * 3)];
  return undefined;
}

export function pickWeekly(s: GameState, week: string): ChallengeSlot {
  const rnd = seeded(`weekly|${week}|${s.region}`);
  const speciesCount = new Set(s.sightings.map((x) => x.speciesId)).size;
  const pool = WEEKLY.filter((c) => c.id !== 'W2' || speciesCount >= 50); // GAM-8: Big Day opens at 50 species
  const c = pool[Math.floor(rnd() * pool.length)];
  return { id: c.id, claimed: false, param: paramFor(c.id, s, rnd) };
}

export function pickSeasonal(region: string, d: Date): ChallengeSlot | null {
  const south = !!getRegion(region)?.south;
  const m = (d.getMonth() + (south ? 6 : 0)) % 12;
  if (m >= 2 && m <= 4) return { id: m === 3 ? 'S3' : 'S1', claimed: false };
  if (m >= 8 && m <= 10) return { id: 'S4', claimed: false };
  if (m === 11 || m <= 1) return { id: 'S2', claimed: false };
  return null; // summer: no seasonal running — honest quiet season
}

export function scopeFor(s: GameState, slot: ChallengeSlot, now: Date): Sighting[] {
  const def = CHALLENGE_BY_ID[slot.id];
  if (def.kind === 'daily') return s.sightings.filter((x) => x.day === dayKey(now));
  if (def.kind === 'weekly') return s.sightings.filter((x) => weekKey(new Date(x.capturedAt)) === weekKey(now));
  const m0 = new Date(now); m0.setMonth(m0.getMonth() - 3);
  return s.sightings.filter((x) => new Date(x.capturedAt) >= m0);
}

export function challengeProgress(s: GameState, slot: ChallengeSlot, now: Date) {
  const def = CHALLENGE_BY_ID[slot.id];
  const goal = def.goal(slot.param);
  const p = Math.min(goal, def.progress(s, scopeFor(s, slot, now), slot.param));
  return { def, goal, progress: p, done: p >= goal, label: def.label(slot.param) };
}
