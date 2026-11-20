// GAM-1 XP, GAM-2 ranks, GAM-3 streaks. Pure.
import { RARITY_META, Rarity } from './rarity';

export type CatchMode = 'field' | 'import' | 'sketch' | 'seen';

export interface XpInput {
  newSpecies: boolean; regionFirst: boolean; fieldcraft: number; rarity: Rarity; streakDays: number; mode: CatchMode;
}

export function catchXp(i: XpInput): number {
  const fc = i.mode === 'field' ? (i.fieldcraft / 100) * 30 : 0;
  const base = 10 + (i.newSpecies ? 50 : 0) + (i.regionFirst ? 25 : 0) + fc;
  const streak = 1 + Math.min(0.3, i.streakDays * 0.02);
  const modeMult = i.mode === 'import' ? 0.5 : i.mode === 'sketch' ? 0.4 : i.mode === 'seen' ? 0.25 : 1;
  return Math.round(base * RARITY_META[i.rarity].mult * streak * modeMult);
}

export const RANKS = [
  { name: 'Fledgling', xp: 0 }, { name: 'Greenhorn', xp: 250 }, { name: 'Field Hand', xp: 750 },
  { name: 'Birder', xp: 1800 }, { name: 'Twitcher', xp: 4000 }, { name: 'Lister', xp: 8000 },
  { name: 'Field Ornithologist', xp: 15000 }, { name: 'Sage of the Marsh', xp: 28000 }, { name: 'Living Legend', xp: 50000 },
];

export const RANK_LINES: Record<string, string> = {
  Greenhorn: 'Greenhorn. You have started looking up.',
  'Field Hand': 'Field Hand. Your patch knows you now.',
  Birder: 'Birder. You check the trees before the sky.',
  Twitcher: 'Twitcher. You have driven somewhere for a bird.',
  Lister: 'Lister. The list keeps you honest.',
  'Field Ornithologist': 'Field Ornithologist. You know what a wingbar is now.',
  'Sage of the Marsh': 'Sage of the Marsh. People ask you what that was.',
  'Living Legend': 'Living Legend. The birds were here first; you noticed.',
};

export function rankFor(xp: number) {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].xp) i = k;
  const next = RANKS[i + 1];
  return { index: i, name: RANKS[i].name, next, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

/** Trainer level: finer-grained than ranks, so there is always a next level in reach. */
export function trainerLevel(xp: number) {
  const lv = 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 30));
  const at = (l: number) => (l - 1) * (l - 1) * 30;
  return { level: lv, progress: (xp - at(lv)) / (at(lv + 1) - at(lv)), nextXp: at(lv + 1) };
}

/** Snap Power as a letter grade players read at a glance. */
export function snapGrade(n: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  return n >= 90 ? 'S' : n >= 75 ? 'A' : n >= 55 ? 'B' : n >= 35 ? 'C' : 'D';
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}

export interface StreakState { days: number; last: string | null; freezes: number; best: number }

/** Apply a catch on `today`. One freeze token per 7 days of streak, max 2 held. */
export function applyStreak(s: StreakState, today: string): StreakState {
  if (s.last === today) return s;
  let days = s.days, freezes = s.freezes;
  if (!s.last) days = 1;
  else {
    const gap = daysBetween(s.last, today);
    if (gap === 1) days += 1;
    else if (gap > 1 && gap - 1 <= freezes) { freezes -= gap - 1; days += 1; }
    else days = 1;
  }
  if (days > 0 && days % 7 === 0) freezes = Math.min(2, freezes + 1);
  return { days, last: today, freezes, best: Math.max(s.best, days) };
}

/** Current displayed streak: still alive if last catch was today or yesterday (or covered by freezes). */
export function liveStreak(s: StreakState, today: string): { days: number; resting: boolean } {
  if (!s.last) return { days: 0, resting: false };
  const gap = daysBetween(s.last, today);
  if (gap <= 1) return { days: s.days, resting: gap === 1 };
  if (gap - 1 <= s.freezes) return { days: s.days, resting: true };
  return { days: 0, resting: false };
}
