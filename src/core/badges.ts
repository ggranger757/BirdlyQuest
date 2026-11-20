// GAM-4: 24 v1 badges across six categories. Pure progress functions over state.
import type { GameState, Sighting } from './model';
import { speciesById } from '../data/provider';
import { getRegion } from '../data/geo';
import { regionEntries } from '../data/provider';
import { hpNow } from './pets';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export const TIER_FEATHERS: Record<Tier, number> = { bronze: 25, silver: 50, gold: 100, platinum: 200 };

export interface Badge {
  id: string; name: string; category: 'Firsts' | 'Taxonomy' | 'Place' | 'Craft' | 'Time' | 'Dedication' | 'Care';
  tier: Tier; desc: string; goal: number; progress: (s: GameState) => number; icon?: string;
}

const verified = (s: GameState) => s.sightings.filter((x) => x.speciesId && x.verification !== 'unverified' && x.verification !== 'vagrant');
const speciesSet = (list: Sighting[]) => new Set(list.map((x) => x.speciesId!));
const countWhere = (s: GameState, pred: (sp: NonNullable<ReturnType<typeof speciesById>>) => boolean) =>
  [...speciesSet(verified(s))].filter((id) => { const sp = speciesById(id); return !!sp && pred(sp); }).length;
function dexPct(s: GameState): number {
  const entries = regionEntries(s.region);
  if (!entries.length) return 0;
  const mine = speciesSet(verified(s));
  return Math.floor((entries.filter((e) => mine.has(e.sp.id)).length / entries.length) * 100);
}
function weekend(s: GameState): number {
  const days = new Set(s.sightings.map((x) => x.day));
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number); const dt = new Date(y, m - 1, dd);
    if (dt.getDay() !== 6) continue;
    const sun = new Date(y, m - 1, dd + 1);
    const key = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
    if (days.has(key)) return 1;
  }
  return 0;
}
const photos = (s: GameState) => s.sightings.filter((x) => x.mode === 'field' && x.fieldcraft);
const RAPTOR_FAMILIES = ['Accipitridae', 'Falconidae', 'Pandionidae', 'Cathartidae'];
const WARBLER_FAMILIES = ['Parulidae', 'Phylloscopidae', 'Sylviidae', 'Acrocephalidae', 'Cettiidae'];

function seasonOf(iso: string, south: boolean) {
  const m = new Date(iso).getMonth();
  const n = Math.floor(((m + 1) % 12) / 3); // 0 winter (DJF) … 3 autumn
  return south ? (n + 2) % 4 : n;
}

const ICONS: Record<string, string> = {"first-light": "druidtoken", "ten": "clover", "fifty": "crown", "century": "dragonheart", "corvid-crew": "seer", "raptor-club": "phoenix", "shorebird-society": "nestpearl", "warbler-wave": "sparkwand", "local-patch": "backpack", "county-line": "fleetboots", "state-bird": "aegis", "far-afield": "windboots", "steady-hands": "focus", "sharp-eye": "precision", "perfect-frame": "mirror", "portfolio": "book", "dawn-chorus": "emberheart", "golden-hour": "sunorb", "night-shift": "lantern", "four-seasons": "stormorb", "week-one": "horseshoe", "month-strong": "tempered", "seasoned": "tower", "year-of-birds": "worldbreaker"};

export const BADGES: Badge[] = [
  { id: 'first-light', name: 'First Light', category: 'Firsts', tier: 'bronze', desc: 'Your first discovery', goal: 1, progress: (s) => s.sightings.length },
  { id: 'ten', name: 'Ten', category: 'Firsts', tier: 'silver', desc: '10 species', goal: 10, progress: (s) => speciesSet(verified(s)).size },
  { id: 'fifty', name: 'Fifty', category: 'Firsts', tier: 'gold', desc: '50 species', goal: 50, progress: (s) => speciesSet(verified(s)).size },
  { id: 'century', name: 'Century', category: 'Firsts', tier: 'platinum', desc: '100 species', goal: 100, progress: (s) => speciesSet(verified(s)).size },

  { id: 'corvid-crew', name: 'Corvid Crew', category: 'Taxonomy', tier: 'bronze', desc: '5 crows, jays or magpies', goal: 5, progress: (s) => countWhere(s, (sp) => sp.family === 'Corvidae') },
  { id: 'raptor-club', name: 'Raptor Club', category: 'Taxonomy', tier: 'silver', desc: '6 hawks, eagles, kites or falcons', goal: 6, progress: (s) => countWhere(s, (sp) => RAPTOR_FAMILIES.includes(sp.family)) },
  { id: 'shorebird-society', name: 'Shorebird Society', category: 'Taxonomy', tier: 'silver', desc: '8 shorebirds, gulls or terns', goal: 8, progress: (s) => countWhere(s, (sp) => sp.order === 'Charadriiformes') },
  { id: 'warbler-wave', name: 'Warbler Wave', category: 'Taxonomy', tier: 'gold', desc: '10 warblers', goal: 10, progress: (s) => countWhere(s, (sp) => WARBLER_FAMILIES.includes(sp.family)) },

  { id: 'local-patch', name: 'Local Patch', category: 'Place', tier: 'bronze', desc: '20 discoveries at your home patch', goal: 20, progress: (s) => s.sightings.filter((x) => x.region === s.region && x.habitat === s.habitat).length },
  { id: 'county-line', name: 'County Line', category: 'Place', tier: 'silver', desc: 'Discover birds in all 3 habitat types', goal: 3, progress: (s) => new Set(s.sightings.map((x) => x.habitat)).size },
  { id: 'state-bird', name: 'State Bird', category: 'Place', tier: 'gold', desc: 'Your state, provincial or national bird (curated regions)', goal: 1,
    progress: (s) => { const e = getRegion(s.region)?.emblem; return e && verified(s).some((x) => x.speciesId === e) ? 1 : 0; } },
  { id: 'far-afield', name: 'Far Afield', category: 'Place', tier: 'silver', desc: 'Discover birds in a second region', goal: 2, progress: (s) => new Set(s.sightings.map((x) => x.region)).size },

  { id: 'steady-hands', name: 'Steady Hands', category: 'Craft', tier: 'bronze', desc: 'A photo scoring 80+', goal: 1, progress: (s) => (photos(s).some((x) => x.fieldcraft!.total >= 80) ? 1 : 0) },
  { id: 'sharp-eye', name: 'Sharp Eye', category: 'Craft', tier: 'silver', desc: 'A photo scoring 90+', goal: 1, progress: (s) => (photos(s).some((x) => x.fieldcraft!.total >= 90) ? 1 : 0) },
  { id: 'perfect-frame', name: 'Perfect Frame', category: 'Craft', tier: 'gold', desc: 'A photo scoring 95+', goal: 1, progress: (s) => (photos(s).some((x) => x.fieldcraft!.total >= 95) ? 1 : 0) },
  { id: 'portfolio', name: 'Portfolio', category: 'Craft', tier: 'gold', desc: 'Ten photos at 80+', goal: 10, progress: (s) => photos(s).filter((x) => x.fieldcraft!.total >= 80).length },

  { id: 'dawn-chorus', name: 'Dawn Chorus', category: 'Time', tier: 'silver', desc: '5 discoveries before 07:00', goal: 5, progress: (s) => s.sightings.filter((x) => x.hour < 7).length },
  { id: 'golden-hour', name: 'Golden Hour', category: 'Time', tier: 'bronze', desc: 'A discovery in the hour before sunset', goal: 1, progress: (s) => (s.sightings.some((x) => x.phase === 'golden') ? 1 : 0) },
  { id: 'night-shift', name: 'Night Shift', category: 'Time', tier: 'gold', desc: 'An owl after dark', goal: 1,
    progress: (s) => (s.sightings.some((x) => x.speciesId && speciesById(x.speciesId)?.archetype === 'owl' && (x.phase === 'night' || x.phase === 'dusk')) ? 1 : 0) },
  { id: 'four-seasons', name: 'Four Seasons', category: 'Time', tier: 'platinum', desc: 'Discoveries in all four seasons', goal: 4,
    progress: (s) => new Set(s.sightings.map((x) => seasonOf(x.capturedAt, !!getRegion(x.region)?.south))).size },

  { id: 'week-one', name: 'Week One', category: 'Dedication', tier: 'bronze', desc: '7-day streak', goal: 7, progress: (s) => s.streak.best },
  { id: 'month-strong', name: 'Month Strong', category: 'Dedication', tier: 'silver', desc: '30-day streak', goal: 30, progress: (s) => s.streak.best },
  { id: 'seasoned', name: 'Seasoned', category: 'Dedication', tier: 'gold', desc: '100-day streak', goal: 100, progress: (s) => s.streak.best },
  { id: 'year-of-birds', name: 'Year of Birds', category: 'Dedication', tier: 'platinum', desc: '365-day streak', goal: 365, progress: (s) => s.streak.best },
  // ─── v2 achievements (art: public/badges/b-<id>.png) ───
  { id: 'two-fifty', name: 'Two-Fifty', category: 'Firsts', tier: 'platinum', desc: '250 species', goal: 250, progress: (s) => speciesSet(verified(s)).size },
  { id: 'rare-find', name: 'Rare Find', category: 'Firsts', tier: 'silver', desc: 'Discover a Rare bird', goal: 1, progress: (s) => (s.sightings.some((x) => ['rare', 'mega', 'legendary'].includes(x.rarity)) ? 1 : 0) },
  { id: 'epic-find', name: 'Epic Find', category: 'Firsts', tier: 'gold', desc: 'Discover an Epic bird', goal: 1, progress: (s) => (s.sightings.some((x) => ['mega', 'legendary'].includes(x.rarity)) ? 1 : 0) },
  { id: 'legendary-find', name: 'Legendary Find', category: 'Firsts', tier: 'platinum', desc: 'Discover a Legendary bird', goal: 1, progress: (s) => (s.sightings.some((x) => x.rarity === 'legendary') ? 1 : 0) },

  { id: 'night-owls', name: 'Night Owls', category: 'Taxonomy', tier: 'silver', desc: '3 owl species', goal: 3, progress: (s) => countWhere(s, (sp) => sp.archetype === 'owl') },
  { id: 'woodpecker-works', name: 'Woodpecker Works', category: 'Taxonomy', tier: 'bronze', desc: '4 woodpecker species', goal: 4, progress: (s) => countWhere(s, (sp) => sp.archetype === 'woodpecker') },
  { id: 'waterfowl-wing', name: 'Waterfowl Wing', category: 'Taxonomy', tier: 'silver', desc: '8 ducks, geese or swans', goal: 8, progress: (s) => countWhere(s, (sp) => sp.family === 'Anatidae') },
  { id: 'jewel-thieves', name: 'Jewel Thieves', category: 'Taxonomy', tier: 'gold', desc: '3 hummingbird species', goal: 3, progress: (s) => countWhere(s, (sp) => sp.archetype === 'hummingbird') },

  { id: 'dex-10', name: 'Dex Explorer', category: 'Place', tier: 'bronze', desc: '10% of your regional BirdDex', goal: 10, progress: (s) => dexPct(s) },
  { id: 'dex-25', name: 'Dex Ranger', category: 'Place', tier: 'silver', desc: '25% of your regional BirdDex', goal: 25, progress: (s) => dexPct(s) },
  { id: 'dex-50', name: 'Dex Master', category: 'Place', tier: 'gold', desc: '50% of your regional BirdDex', goal: 50, progress: (s) => dexPct(s) },
  { id: 'globetrotter', name: 'Globetrotter', category: 'Place', tier: 'platinum', desc: 'Discover birds in 3 regions', goal: 3, progress: (s) => new Set(s.sightings.map((x) => x.region)).size },

  { id: 'flight-shot', name: 'Flight Shot', category: 'Craft', tier: 'gold', desc: 'Photograph a bird in flight', goal: 1, progress: (s) => (s.sightings.some((x) => x.mode === 'field' && x.sprite.pose === 'flight') ? 1 : 0) },
  { id: 'rare-morph', name: 'Rare Morph', category: 'Craft', tier: 'platinum', desc: 'A leucistic, melanistic or albino bird', goal: 1, progress: (s) => (s.sightings.some((x) => x.sprite.variant !== 'normal') ? 1 : 0) },
  { id: 'field-notes', name: 'Field Notes', category: 'Craft', tier: 'bronze', desc: 'Write 10 field notes', goal: 10, progress: (s) => s.sightings.filter((x) => x.note.trim().length > 0).length },
  { id: 'storyteller', name: 'Storyteller', category: 'Craft', tier: 'silver', desc: 'Share 3 journal spreads', goal: 3, progress: (s) => s.events.shares.length },

  { id: 'first-fill', name: 'First Fill', category: 'Care', tier: 'bronze', desc: 'Fill the bird feeder', goal: 1, progress: (s) => s.stats?.fills ?? 0 },
  { id: 'well-fed', name: 'Well Fed', category: 'Care', tier: 'silver', desc: '5 thriving birds in the Aviary', goal: 5, progress: (s) => s.sightings.filter((x) => s.diorama.birds.includes(x.id) && hpNow(x) >= 75).length },
  { id: 'full-house', name: 'Full House', category: 'Care', tier: 'gold', desc: '12 birds living in the Aviary', goal: 12, progress: (s) => s.diorama.birds.length },
  { id: 'big-spender', name: 'Big Spender', category: 'Care', tier: 'platinum', desc: 'Spend 500 Feather Coins', goal: 500, progress: (s) => s.stats?.spent ?? 0 },

  { id: 'midnight', name: 'Midnight', category: 'Time', tier: 'gold', desc: 'A discovery between 00:00 and 04:00', goal: 1, progress: (s) => (s.sightings.some((x) => x.hour < 4) ? 1 : 0) },
  { id: 'weekender', name: 'Weekender', category: 'Time', tier: 'bronze', desc: 'Discover birds on a Saturday and the Sunday after', goal: 1, progress: (s) => weekend(s) },

  { id: 'quest-starter', name: 'Quest Starter', category: 'Dedication', tier: 'bronze', desc: 'Complete 5 quests', goal: 5, progress: (s) => s.stats?.quests ?? 0 },
  { id: 'questmaster', name: 'Questmaster', category: 'Dedication', tier: 'gold', desc: 'Complete 50 quests', goal: 50, progress: (s) => s.stats?.quests ?? 0 },
];

for (const b of BADGES) b.icon = ICONS[b.id] ?? `b-${b.id}`;

export function newlyEarned(s: GameState): Badge[] {
  return BADGES.filter((b) => !s.badges[b.id] && b.progress(s) >= b.goal);
}
