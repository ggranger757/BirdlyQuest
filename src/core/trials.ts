// Field Trials: friendly, bird-true contests between the player's photographed birds and a rival's.
// No fighting and no damage. Each round is one thing real birds actually compete at, and a bird's
// strength comes from its real biology (family, wingspan) plus how well the player photographed it.
import type { Species } from '../data/types';

export type Contest = 'song' | 'display' | 'sky' | 'forage';
export const CONTEST_IDS: Contest[] = ['song', 'display', 'sky', 'forage'];

export interface ContestDef {
  id: Contest; name: string; short: string; blurb: string;
  scene: string;                       // diorama background (public/bg/<scene>)
  proj: { src: string; frames: number; fw: number; fh: number };
  boom: { src: string; frames: number; fw: number; fh: number };
  clip: 'tSong' | 'tDisplay' | 'tSky' | 'tForage';
  color: string;
}

export const CONTESTS: Record<Contest, ContestDef> = {
  song: {
    id: 'song', name: 'Song-off', short: 'Song', blurb: 'Who has the richest, most varied song?', scene: 'pine',
    proj: { src: 'fx/trials/spell_wave_gold_proj.png', frames: 6, fw: 16, fh: 26 },
    boom: { src: 'fx/trials/spell_gold_boom.png', frames: 8, fw: 40, fh: 40 }, clip: 'tSong', color: 'var(--sun)',
  },
  display: {
    id: 'display', name: 'Display', short: 'Display', blurb: 'Brightest plumage and boldest courtship show.', scene: 'n1',
    proj: { src: 'fx/trials/spell_orb_gold_proj.png', frames: 6, fw: 24, fh: 14 },
    boom: { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 }, clip: 'tDisplay', color: 'var(--robin)',
  },
  sky: {
    id: 'sky', name: 'Sky race', short: 'Sky', blurb: 'Speed, wingspan and agility in the air.', scene: 'dusk',
    proj: { src: 'fx/trials/windblade_proj.png', frames: 4, fw: 28, fh: 39 },
    boom: { src: 'fx/trials/windblade_boom.png', frames: 3, fw: 28, fh: 39 }, clip: 'tSky', color: 'var(--river)',
  },
  forage: {
    id: 'forage', name: 'Forage', short: 'Forage', blurb: 'Clever, quick food-finding.', scene: 'valley',
    proj: { src: 'fx/trials/leaf_proj.png', frames: 2, fw: 16, fh: 16 },
    boom: { src: 'fx/trials/leaf_boom.png', frames: 7, fw: 48, fh: 48 }, clip: 'tForage', color: 'var(--moss)',
  },
};
/** The decisive-win burst and the round-win ring. */
export const FX_CRIT = { src: 'fx/trials/fx_blast.png', frames: 8, fw: 48, fh: 48 };
export const FX_RING = { src: 'fx/trials/sa_nova.png', frames: 6, fw: 52, fh: 48 };

// ─── stats from real biology ───
type Row = [number, number, number, number]; // song, display, sky, forage
const BY_ARCHETYPE: Record<string, Row> = {
  passerine: [70, 55, 45, 60], corvid: [40, 45, 60, 92], raptor: [20, 55, 86, 60], owl: [35, 40, 60, 70],
  waterfowl: [20, 70, 70, 65], wader: [35, 45, 65, 78], seabird: [30, 40, 85, 72], woodpecker: [35, 55, 45, 85],
  hummingbird: [30, 92, 80, 55], gamebird: [25, 60, 35, 70], parrot: [55, 90, 55, 65], kingfisher: [30, 80, 70, 85],
};
// family adjustments (added to the archetype row)
const BY_FAMILY: Record<string, Partial<Record<Contest, number>>> = {
  Mimidae: { song: 28 }, Troglodytidae: { song: 25 }, Turdidae: { song: 18 }, Muscicapidae: { song: 12 },
  Sylviidae: { song: 12 }, Phylloscopidae: { song: 10 }, Fringillidae: { song: 8, display: 10 }, Pycnonotidae: { song: 8 },
  Alaudidae: { song: 22 }, Sturnidae: { song: 15, forage: 10 }, Passerellidae: { song: 6, display: -15 },
  Cardinalidae: { display: 35, song: 5 }, Icteridae: { display: 25, song: 10 }, Parulidae: { display: 25, song: 8 },
  Thraupidae: { display: 30 }, Nectariniidae: { display: 25 }, Meliphagidae: { song: 10 }, Bombycillidae: { display: 25 },
  Columbidae: { song: -40, display: -15, sky: 30, forage: 0 }, Apodidae: { sky: 45, song: -30 }, Hirundinidae: { sky: 40, song: -10 },
  Falconidae: { sky: 4 }, Paridae: { forage: 28, song: -5 }, Sittidae: { forage: 18 }, Passeridae: { forage: 15, display: -15 },
  Laridae: { forage: 8 }, Anatidae: { display: 5 }, Upupidae: { display: 15 }, Ardeidae: { display: 10, forage: 5 },
  Psittaculidae: { song: -15 }, Cacatuidae: { song: -20 }, Tyrannidae: { sky: 15, song: -10, forage: 10 },
  Corvidae: {}, Picidae: {}, Accipitridae: {}, Strigidae: {},
};
// a few species famous for one thing
const BY_SPECIES: Record<string, Partial<Record<Contest, number>>> = {
  normoc: { song: 99 }, brnthr: { song: 95 }, carwre: { song: 96 }, houwre: { song: 94 }, winwre: { song: 96 }, eurwre1: { song: 95 },
  norcar: { display: 96 }, wooduc: { display: 98 }, balori: { display: 95 }, scatan: { display: 96 }, indbun: { display: 94 },
  blujay: { display: 82, forage: 94 }, amegfi: { display: 86 }, cedwax: { display: 88 }, rthhum: { display: 95 }, mallar: { display: 78 },
  perfal: { sky: 99 }, chiswi: { sky: 97 }, barswa: { sky: 95 }, amekes: { sky: 93 }, rethaw: { sky: 92 },
  amecro: { forage: 96 }, comrav: { forage: 97 }, bkcchi: { forage: 93 }, tuftit: { forage: 90 }, grbher: { forage: 88 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A species' natural ability in a contest, 10–99. */
export function contestStat(sp: Pick<Species, 'id' | 'archetype' | 'family' | 'wingspanCm' | 'sizeCm'>, c: Contest): number {
  const fixed = BY_SPECIES[sp.id]?.[c];
  if (fixed != null) return fixed;
  const row = BY_ARCHETYPE[sp.archetype] ?? BY_ARCHETYPE.passerine;
  let v = row[CONTEST_IDS.indexOf(c)] + (BY_FAMILY[sp.family]?.[c] ?? 0);
  if (c === 'sky' && sp.wingspanCm) v += clamp((sp.wingspanCm - 35) / 8, -8, 8); // long wings carry
  return Math.round(clamp(v, 10, 99));
}

/** Star rating (1–5) shown on the lineup cards. */
export const statStars = (v: number) => clamp(Math.round(v / 20), 1, 5);

// ─── contenders ───
export interface Contender {
  sp: Species;
  level: number;        // 1–30
  quality: number;      // 0–100 photo fieldcraft (rival birds: a fixed value)
  parts?: number[];     // sprite parts for the player's own bird
  sightingId?: string;
}
/** Bonus from training: level and photo quality. Kept small so biology still matters most. */
export const trainBonus = (b: Pick<Contender, 'level' | 'quality'>) => Math.round(Math.min(30, b.level) * 0.6 + clamp(b.quality, 0, 100) / 10);

/** Expected score before the roll (shown as the bird's power in the lineup). */
export const power = (b: Contender, c: Contest) => contestStat(b.sp, c) + trainBonus(b);

/** One round's score: power plus a small roll (rng in 0..1). */
export const roundScore = (b: Contender, c: Contest, rng: () => number) => power(b, c) + Math.round((rng() - 0.5) * 16);

export type RoundResult = { contest: Contest; you: number; rival: number; winner: 'you' | 'rival' | 'tie'; critical: boolean };

export function playRound(you: Contender, rival: Contender, c: Contest, rng: () => number): RoundResult {
  const a = roundScore(you, c, rng), b = roundScore(rival, c, rng);
  const winner = a === b ? 'tie' : a > b ? 'you' : 'rival';
  return { contest: c, you: a, rival: b, winner, critical: Math.abs(a - b) >= 25 };
}

/** Best of three: a tie in rounds goes to the higher total. */
export function matchWinner(rounds: RoundResult[]): 'you' | 'rival' {
  const w = rounds.filter((r) => r.winner === 'you').length, l = rounds.filter((r) => r.winner === 'rival').length;
  if (w !== l) return w > l ? 'you' : 'rival';
  const t = rounds.reduce((n, r) => n + r.you - r.rival, 0);
  return t >= 0 ? 'you' : 'rival';
}

/** Pick the best bird for each contest from a team (each bird used once). */
export function bestLineup(team: Contender[], contests: Contest[]): (Contender | null)[] {
  let best: (Contender | null)[] = contests.map(() => null), bestSum = -1;
  const n = team.length;
  const go = (i: number, used: Set<number>, pick: number[], sum: number) => {
    if (i === contests.length) { if (sum > bestSum) { bestSum = sum; best = pick.map((k) => (k < 0 ? null : team[k])); } return; }
    let any = false;
    for (let k = 0; k < n; k++) if (!used.has(k)) { any = true; used.add(k); go(i + 1, used, [...pick, k], sum + power(team[k], contests[i])); used.delete(k); }
    if (!any) go(i + 1, used, [...pick, -1], sum);
  };
  go(0, new Set(), [], 0);
  return best;
}

// ─── rivals ───
export interface RivalDef {
  id: string; name: string; title: string; line: string;
  contests: Contest[];   // the three rounds, announced up front
  level: number; quality: number;
  coins: number; xp: number;
  merlin?: boolean;
}
export const RIVALS: RivalDef[] = [
  { id: 'pip', name: 'Pip', title: 'Backyard rookie', line: "My birds sing all morning. Bet yours can't keep up!", contests: ['song', 'forage', 'display'], level: 2, quality: 30, coins: 25, xp: 40 },
  { id: 'wren', name: 'Wren', title: 'Dawn chorus fan', line: 'A good song beats bright feathers. Prove me wrong.', contests: ['song', 'song', 'sky'], level: 5, quality: 45, coins: 35, xp: 60 },
  { id: 'gale', name: 'Captain Gale', title: 'Shoreline racer', line: 'Out on the coast, it’s all about the wind.', contests: ['sky', 'forage', 'sky'], level: 8, quality: 55, coins: 45, xp: 80 },
  { id: 'mara', name: 'Mara', title: 'Plumage collector', line: 'Colour is everything. Show me your brightest!', contests: ['display', 'display', 'song'], level: 12, quality: 65, coins: 60, xp: 110 },
  { id: 'hawkins', name: 'Old Hawkins', title: 'Ridge watcher', line: 'Forty years on this ridge. My birds know every trick.', contests: ['sky', 'forage', 'display'], level: 16, quality: 75, coins: 80, xp: 150 },
  { id: 'merlin', name: 'Professor Merlin', title: 'Grand finale', line: 'So, you’ve come this far. Show me what your birds can do.', contests: ['song', 'display', 'sky'], level: 22, quality: 85, coins: 120, xp: 250, merlin: true },
];

/** Rival birds come from the player's region: the best local specialist for each round, never repeated. */
export function rivalTeam(r: RivalDef, pool: Species[], tier: number): Contender[] {
  const used = new Set<string>();
  // early rivals field common-ish birds (take from the first part of the regional list), later rivals any
  const reach = Math.max(8, Math.round(pool.length * Math.min(1, 0.35 + tier * 0.13)));
  const options = pool.slice(0, reach);
  return r.contests.map((c, i) => {
    const ranked = options.filter((s) => !used.has(s.id)).sort((a, b) => contestStat(b, c) - contestStat(a, c));
    // early rivals don't always bring their very best specialist
    const sp = ranked[Math.min(ranked.length - 1, Math.max(0, 3 - tier) + (i % 2))] ?? ranked[0] ?? pool[0];
    used.add(sp.id);
    return { sp, level: r.level, quality: r.quality };
  });
}

// ─── rewards ───
export const REMATCH = { coins: 5, xp: 15, perDay: 3 };
export interface TrialsState { cleared: number; wins: number; day?: string; rematches?: number }
/** What a win pays: the full prize the first time, a small capped bonus for rematches. */
export function rewardFor(st: TrialsState | undefined, index: number, today: string): { coins: number; xp: number; first: boolean } {
  const r = RIVALS[index];
  if ((st?.cleared ?? 0) <= index) return { coins: r.coins, xp: r.xp, first: true };
  const used = st?.day === today ? st.rematches ?? 0 : 0;
  return used < REMATCH.perDay ? { coins: REMATCH.coins, xp: REMATCH.xp, first: false } : { coins: 0, xp: 0, first: false };
}

/** Small seeded RNG so a match can be replayed in tests. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
