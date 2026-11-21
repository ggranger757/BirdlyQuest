// Pet care. Birds living in your Aviary slowly get hungry and eat from the feeder you keep filled.
// Birds resting in the Bird Box don't get hungry. Birds never die or leave: hungry birds are just weak.
import type { Sighting } from './model';

export const MAX_HP = 100;
export const MIN_HP = 10;
export const DRAIN_PER_HOUR = 0.7;   // full → hungry (<30) in about 4 days without food
export const EAT_BELOW = 80;         // birds visit the feeder once they drop below this
export const FEEDER_CAP = 200;       // feeder holds this many food points
export const AVIARY_MAX = 12;

export type Food = 'seeds' | 'berries' | 'worms';
/** Bags you buy with Feather Coins and pour into the feeder. Bigger bags are better value. */
export const FOODS: Record<Food, { name: string; points: number; price: number; icon: string; desc: string }> = {
  seeds: { name: 'Seed Mix', points: 25, price: 10, icon: '🌾', desc: 'Small bag. Fills the feeder by 25' },
  berries: { name: 'Berry Mash', points: 60, price: 22, icon: '🫐', desc: 'Medium bag. Fills the feeder by 60' },
  worms: { name: 'Mealworm Tub', points: 120, price: 40, icon: '🪱', desc: 'Big tub. Fills the feeder by 120' },
};

export interface Pet { hp: number; at: string; resting?: boolean }

/**
 * What is inside the feeder, as layers poured one on top of another (bottom first).
 * Birds eat from the top, so the food you poured last is what they eat first and what you see go down.
 */
export interface FoodLayer { food: Food; pts: number }
export interface FeederState { level: number; layers?: FoodLayer[] }
const sumPts = (ls: FoodLayer[]) => ls.reduce((n, l) => n + l.pts, 0);

/** Pour food on top; the same food as the top layer just makes that layer deeper. */
export function pourLayers(ls: FoodLayer[], food: Food, pts: number): FoodLayer[] {
  if (pts <= 0) return ls;
  const top = ls[ls.length - 1];
  return top && top.food === food ? [...ls.slice(0, -1), { food, pts: top.pts + pts }] : [...ls, { food, pts }];
}
/** Birds eat `pts` from the top down. */
export function eatLayers(ls: FoodLayer[], pts: number): FoodLayer[] {
  const out = ls.map((l) => ({ ...l }));
  let left = Math.max(0, pts);
  while (left > 0 && out.length) {
    const top = out[out.length - 1], bite = Math.min(top.pts, left);
    top.pts -= bite; left -= bite;
    if (top.pts <= 1e-9) out.pop();
  }
  return out;
}
/** The feeder's layers, always adding up to its level. Saves from before v1.33 had seed only. */
export function layersOf(f: FeederState): FoodLayer[] {
  const ls = (f.layers ?? []).filter((l) => l.pts > 0 && l.food in FOODS);
  const have = sumPts(ls);
  if (have > f.level) return eatLayers(ls, have - f.level);
  if (have < f.level) return [{ food: 'seeds', pts: f.level - have }, ...ls];
  return ls;
}

export function hpNow(s: Pick<Sighting, 'pet' | 'capturedAt'>, now = new Date()): number {
  const p = s.pet ?? { hp: 80, at: s.capturedAt };
  if (p.resting) return Math.max(MIN_HP, Math.round(p.hp));
  const hours = Math.max(0, (now.getTime() - new Date(p.at).getTime()) / 3600e3);
  return Math.max(MIN_HP, Math.round(p.hp - hours * DRAIN_PER_HOUR));
}

export type Mood = 'thriving' | 'content' | 'hungry' | 'weak';
export function mood(hp: number): Mood {
  return hp >= 75 ? 'thriving' : hp >= 45 ? 'content' : hp > MIN_HP ? 'hungry' : 'weak';
}
export const MOOD_LINE: Record<Mood, string> = {
  thriving: 'Thriving', content: 'Content', hungry: 'Hungry — fill the feeder', weak: 'Weak — needs the feeder',
};

export interface Meal { id: string; ate: number }

/**
 * Hungry Aviary birds eat from the feeder, hungriest first, each up to full health.
 * Returns the updated sightings, the new feeder level, and who ate what.
 */
export function visitFeeder(birds: Sighting[], level: number, now = new Date()): { birds: Sighting[]; level: number; meals: Meal[] } {
  const meals: Meal[] = [];
  const order = birds.map((b) => ({ b, hp: hpNow(b, now) })).sort((x, y) => x.hp - y.hp);
  const out = new Map<string, Sighting>();
  for (const { b, hp } of order) {
    let next = hp;
    if (hp < EAT_BELOW && level > 0) {
      const ate = Math.min(MAX_HP - hp, level);
      level -= ate; next = hp + ate;
      meals.push({ id: b.id, ate });
    }
    out.set(b.id, { ...b, pet: { hp: next, at: now.toISOString() } });
  }
  return { birds: birds.map((b) => out.get(b.id) ?? b), level, meals };
}

export function rest(s: Sighting, now = new Date()): Sighting {
  return { ...s, pet: { hp: hpNow(s, now), at: now.toISOString(), resting: true } };
}
export function wake(s: Sighting, now = new Date()): Sighting {
  return { ...s, pet: { hp: hpNow(s, now), at: now.toISOString() } };
}
