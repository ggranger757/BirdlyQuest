// DAT-4 Likely Now Score, DAT-5 rarity tiers, spawn weights. Works on any region's entries.
import type { Species, Habitat, Region } from '../data/types';
import { regionEntries, RegionEntry } from '../data/provider';
import { sunTimes, dayPhase, DayPhase } from './sun';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mega' | 'legendary';

export const RARITY_META: Record<Rarity, { label: string; glyph: string; color: string; mult: number }> = {
  common: { label: 'Common', glyph: '●', color: 'var(--ash)', mult: 1 },
  uncommon: { label: 'Uncommon', glyph: '◆', color: 'var(--moss)', mult: 1.5 },
  rare: { label: 'Rare', glyph: '★', color: 'var(--river)', mult: 2.5 },
  mega: { label: 'Epic', glyph: '✦', color: 'var(--violet-text)', mult: 5 },
  legendary: { label: 'Legendary', glyph: '♛', color: 'var(--sun)', mult: 10 },
};

export interface Conditions { weather?: 'clear' | 'cloud' | 'rain' | 'snow' | 'fog' | 'storm'; tempC?: number }

export function seasonalIndex(season: string, d: Date, south: boolean): number {
  const m = (d.getMonth() + (south ? 6 : 0)) % 12;
  switch (season) {
    case 'R': return 1;
    case 'S': return [0.1, 0.1, 0.35, 0.8, 1, 1, 1, 1, 0.85, 0.5, 0.15, 0.1][m];
    case 'W': return [1, 1, 0.8, 0.35, 0.05, 0.02, 0.02, 0.05, 0.2, 0.6, 0.9, 1][m];
    case 'M': return [0.05, 0.05, 0.3, 0.9, 1, 0.3, 0.1, 0.3, 0.9, 0.8, 0.3, 0.05][m];
  }
  return 0.5;
}

export function timeOfDayFit(activity: Species['activity'], phase: DayPhase): number {
  const table: Record<Species['activity'], Record<DayPhase, number>> = {
    diurnal: { night: 0.02, dawn: 0.9, morning: 1, day: 0.7, golden: 0.85, dusk: 0.4 },
    crepuscular: { night: 0.3, dawn: 1, morning: 0.8, day: 0.5, golden: 0.9, dusk: 1 },
    nocturnal: { night: 1, dawn: 0.6, morning: 0.05, day: 0.02, golden: 0.2, dusk: 0.9 },
  };
  return table[activity][phase];
}

export function weatherFit(sp: Species, c?: Conditions): number {
  if (!c?.weather) return 0.7;
  if (c.weather === 'storm') return 0.3;
  if (c.weather === 'rain') return sp.habitats.includes('water') ? 0.8 : 0.5;
  if (c.weather === 'snow') return sp.archetype !== 'hummingbird' ? 0.6 : 0.2;
  return 0.9;
}

export function lnsOf(e: RegionEntry, region: Region, d: Date, habitat: Habitat, c?: Conditions): number {
  const phase = dayPhase(d, sunTimes(d, region.lat, region.lng));
  const v = 0.4 * e.freq * e.seasonal + 0.25 * e.seasonal + 0.15 * timeOfDayFit(e.sp.activity, phase)
    + 0.1 * (e.sp.habitats.includes(habitat) ? 1 : 0.3) + 0.1 * weatherFit(e.sp, c);
  return Math.max(0, Math.min(1, v));
}

/** LNS for one species in a region (0 when it is not on the region's list). */
export function lns(sp: Species, region: Region, d: Date, habitat: Habitat, c?: Conditions): number {
  const e = regionEntries(region.code, d).find((x) => x.sp.id === sp.id);
  return e ? lnsOf(e, region, d, habitat, c) : 0;
}

export function rarityOf(score: number): Rarity {
  const r = 1 - score;
  if (r < 0.25) return 'common';
  if (r < 0.5) return 'uncommon';
  if (r < 0.75) return 'rare';
  if (r < 0.95) return 'mega';
  return 'legendary';
}

export function regionSpecies(code: string): Species[] {
  return regionEntries(code).map((e) => e.sp);
}

export interface Likely { sp: Species; score: number; rarity: Rarity; dex: number }

export function likelyNow(region: Region, d: Date, habitat: Habitat, c?: Conditions): Likely[] {
  return regionEntries(region.code, d)
    .map((e) => { const score = lnsOf(e, region, d, habitat, c); return { sp: e.sp, score, rarity: rarityOf(score), dex: e.dex }; })
    .sort((a, b) => b.score - a.score || a.sp.id.localeCompare(b.sp.id));
}

export function spawnWeight(score: number, irruption = false): number {
  const w = Math.pow(Math.max(0.02, Math.min(1, score)), 1.5) * 100;
  return irruption ? w * 3 : w;
}

export function weightedPick<T>(items: T[], weight: (t: T) => number, roll: number): T {
  const total = items.reduce((a, t) => a + weight(t), 0);
  let r = roll * total;
  for (const t of items) { r -= weight(t); if (r <= 0) return t; }
  return items[items.length - 1];
}

// ─── Bird types (collector-game flavour; derived from real anatomy and habitat) ───
export type BirdType = 'Song' | 'Water' | 'Shore' | 'Sea' | 'Raptor' | 'Night' | 'Wood' | 'Jewel' | 'Ground' | 'Tropic' | 'Dive' | 'Clever' | 'City' | 'Forest' | 'Wetland';
export const TYPE_COLOR: Record<BirdType, string> = {
  Song: '#6FA84B', Water: '#2E6F9E', Shore: '#D9C26A', Sea: '#5AA9C9', Raptor: '#C2622F', Night: '#7B4FA8', Wood: '#8C5A2B',
  Jewel: '#C94F7C', Ground: '#7A7A3F', Tropic: '#3F7A3F', Dive: '#1F3F6E', Clever: '#5B5A7A', City: '#8A8BA3', Forest: '#24553F', Wetland: '#4A3F8F',
};
/** Plain-language names shown to players (the internal ids stay short). */
export const TYPE_LABEL: Record<BirdType, string> = {
  Song: 'Songbird', Clever: 'Crow family', Raptor: 'Bird of prey', Night: 'Owl', Water: 'Waterbird', Shore: 'Wader',
  Sea: 'Seabird', Wood: 'Woodpecker', Jewel: 'Hummingbird', Ground: 'Ground bird', Tropic: 'Parrot', Dive: 'Kingfisher',
  City: 'City', Forest: 'Woods', Wetland: 'Water',
};
export const GROUP_PLURAL: Partial<Record<BirdType, string>> = {
  Song: 'Songbirds', Clever: 'Crows & jays', Raptor: 'Birds of prey', Night: 'Owls', Water: 'Ducks & waterbirds', Shore: 'Herons & waders',
  Sea: 'Gulls & seabirds', Wood: 'Woodpeckers', Jewel: 'Hummingbirds', Ground: 'Ground birds', Tropic: 'Parrots', Dive: 'Kingfishers & hoopoes',
};
export const GROUP_TYPES: BirdType[] = ['Song', 'Clever', 'Raptor', 'Night', 'Water', 'Shore', 'Sea', 'Wood', 'Jewel', 'Ground', 'Tropic', 'Dive'];
export const PLACE_TYPES: BirdType[] = ['City', 'Forest', 'Wetland'];

export function typesOf(sp: Species): BirdType[] {
  const a: Record<string, BirdType> = {
    passerine: 'Song', corvid: 'Clever', raptor: 'Raptor', owl: 'Night', waterfowl: 'Water', wader: 'Shore', seabird: 'Sea',
    woodpecker: 'Wood', hummingbird: 'Jewel', gamebird: 'Ground', parrot: 'Tropic', kingfisher: 'Dive',
  };
  const first = a[sp.archetype] ?? 'Song';
  const hab: Record<Habitat, BirdType> = { urban: 'City', woodland: 'Forest', water: 'Wetland' };
  const second = hab[sp.habitats[0]];
  return second && second !== first ? [first, second] : [first];
}
