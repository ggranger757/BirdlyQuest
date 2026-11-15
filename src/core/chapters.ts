// BirdDex chapters: small, finishable goals built from the regional list (most familiar birds first).
import type { RegionEntry } from '../data/provider';
import { typesOf } from './rarity';

export interface Chapter { id: string; name: string; blurb: string; ids: string[]; reward: number }

export function chaptersFor(entries: RegionEntry[], month = new Date().getMonth()): Chapter[] {
  const used = new Set<string>();
  const take = (pred: (e: RegionEntry) => boolean, n: number) => {
    const out = entries.filter((e) => !used.has(e.sp.id) && !e.sp.sensitive && pred(e)).slice(0, n).map((e) => e.sp.id);
    out.forEach((id) => used.add(id));
    return out;
  };
  const hunter = (e: RegionEntry) => { const t = typesOf(e.sp)[0]; return t === 'Raptor' || t === 'Night'; };
  const list: Chapter[] = [
    { id: 'backyard', name: 'Backyard 12', blurb: 'The birds you can find from your own doorstep.', ids: take((e) => e.sp.habitats.includes('urban') && !hunter(e), 12), reward: 40 },
    { id: 'park', name: 'Park & Woods 20', blurb: 'Take a walk among the trees.', ids: take((e) => e.sp.habitats.includes('woodland') && !hunter(e), 20), reward: 60 },
    { id: 'water', name: 'Water 15', blurb: 'Ponds, rivers and shores.', ids: take((e) => e.sp.habitats.includes('water') && !hunter(e), 15), reward: 60 },
    { id: 'hunters', name: 'Hunters 10', blurb: 'Hawks, falcons and owls.', ids: take(hunter, 10), reward: 80 },
  ];
  // this month's specials: birds much more likely now than the rest of the year
  const season = entries.filter((e) => !e.sp.sensitive && e.seasonal > 0.6 && e.freq < 0.85).sort((a, b) => b.seasonal - a.seasonal).slice(0, 10).map((e) => e.sp.id);
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
  if (season.length >= 5) list.push({ id: `season-${month}`, name: `${MONTH} specials`, blurb: 'In season right now. Catch them before they move on!', ids: season, reward: 70 });
  return list.filter((c) => c.ids.length >= 5);
}

export const chapterProgress = (c: Chapter, found: Set<string>) => c.ids.filter((id) => found.has(id)).length;
