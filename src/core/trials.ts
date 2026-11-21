// Field Trials (v3, Step Quest-style): fast, one-tap-per-turn bird battles. Kept bird-true and non-violent:
// birds out-sing, out-dazzle, out-fly and out-forage each other. When a bird's HP reaches 0 it flies off to rest.
//
// v1.26 (Pokémon / Final Fantasy feel): moves have PP, the faster bird acts first, and Guard, Snack, Swap and Run
// always go first (priority). The Super is a Limit Break that fills as you battle.
// Your turn, one tap:  Quick move (unlimited) · Signature skill (from a real-life fact; limited PP)
//                      · Guard (block 60% of the next hit) · Snack (pantry food) · Super (gauge fills as you battle) · Run
// The rival:           quick move or its own signature skill, now and then a Big Move it announces a turn ahead (Guard!)
// Parties:             up to 3 birds a side; when one rests the next flies in automatically. Swap costs your turn.
// Growth (v1.25):      birds learn moves as they level (Technique Lv12, upgraded quick move Lv20, mastered skill Lv30,
//                      Ultra Super Lv40) and your trainer level adds a Bond bonus to every bird you bring.
// Matchups:            Song beats Display beats Forage beats Sky beats Song (×1.3, or ×0.77 the other way).
import type { Species } from '../data/types';

// ─── styles: a bird's best talent (sets its quick move, super move, colours and sounds) ───
export type Contest = 'song' | 'display' | 'sky' | 'forage';
export const CONTEST_IDS: Contest[] = ['song', 'display', 'sky', 'forage'];

export type Sheet = { src: string; frames: number; fw: number; fh: number };
export interface ContestDef { id: Contest; name: string; quick: string; super: string; big: string; proj: Sheet; boom: Sheet; clip: 'tSong' | 'tDisplay' | 'tSky' | 'tForage'; color: string }
const P = {
  wave: { src: 'fx/trials/spell_wave_gold_proj.png', frames: 6, fw: 16, fh: 26 }, goldBoom: { src: 'fx/trials/spell_gold_boom.png', frames: 8, fw: 40, fh: 40 },
  orb: { src: 'fx/trials/spell_orb_gold_proj.png', frames: 6, fw: 24, fh: 14 }, star: { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 },
  wind: { src: 'fx/trials/windblade_proj.png', frames: 4, fw: 28, fh: 39 }, windBoom: { src: 'fx/trials/windblade_boom.png', frames: 3, fw: 28, fh: 39 },
  leaf: { src: 'fx/trials/leaf_proj.png', frames: 2, fw: 16, fh: 16 }, leafBoom: { src: 'fx/trials/leaf_boom.png', frames: 7, fw: 48, fh: 48 },
} satisfies Record<string, Sheet>;
export const CONTESTS: Record<Contest, ContestDef> = {
  song: { id: 'song', name: 'Song', quick: 'Echo Chirp', super: 'Symphony Burst', big: 'Thunder Chorus', proj: P.wave, boom: P.goldBoom, clip: 'tSong', color: 'var(--sun)' },
  display: { id: 'display', name: 'Display', quick: 'Glimmer Wing', super: 'Prismatic Dance', big: 'Radiant Plume', proj: P.orb, boom: P.star, clip: 'tDisplay', color: 'var(--robin)' },
  sky: { id: 'sky', name: 'Sky', quick: 'Gale Wing', super: 'Tempest Dive', big: 'Cyclone Dive', proj: P.wind, boom: P.windBoom, clip: 'tSky', color: 'var(--river)' },
  forage: { id: 'forage', name: 'Forage', quick: 'Quick Peck', super: 'Harvest Frenzy', big: 'Feast Storm', proj: P.leaf, boom: P.leafBoom, clip: 'tForage', color: 'var(--moss)' },
};

// ─── matchups: each style has an edge over one other (bird-true reasons in MATCHUP_WHY) ───
export const BEATS: Record<Contest, Contest> = { song: 'display', display: 'forage', forage: 'sky', sky: 'song' };
export const MATCHUP_WHY: Record<Contest, string> = {
  song: 'A great song outshines fancy feathers.',
  display: 'A dazzling display distracts busy foragers.',
  forage: 'Patient foragers outlast tired fliers.',
  sky: 'Fast fliers leave singers behind.',
};
/** +1 when the move's style has the edge on the defender, −1 when it is at a disadvantage. */
export const matchup = (move: Contest, defender: Contest): -1 | 0 | 1 => (BEATS[move] === defender ? 1 : BEATS[defender] === move ? -1 : 0);
export const MATCHUP_MULT = { 1: 1.3, 0: 1, [-1]: 0.77 } as Record<-1 | 0 | 1, number>;

export const FX_CRIT: Sheet = { src: 'fx/trials/fx_blast.png', frames: 8, fw: 48, fh: 48 };
export const FX_RING: Sheet = { src: 'fx/trials/sa_nova.png', frames: 6, fw: 52, fh: 48 };

// ─── stats from real biology ───
type Row = [number, number, number, number]; // song, display, sky, forage
const BY_ARCHETYPE: Record<string, Row> = {
  passerine: [70, 55, 45, 60], corvid: [40, 45, 60, 92], raptor: [20, 55, 86, 60], owl: [35, 40, 60, 70],
  waterfowl: [20, 70, 70, 65], wader: [35, 45, 65, 78], seabird: [30, 40, 85, 72], woodpecker: [35, 55, 45, 85],
  hummingbird: [30, 92, 80, 55], gamebird: [25, 60, 35, 70], parrot: [55, 90, 55, 65], kingfisher: [30, 80, 70, 85],
};
const BY_FAMILY: Record<string, Partial<Record<Contest, number>>> = {
  Mimidae: { song: 28 }, Troglodytidae: { song: 25 }, Turdidae: { song: 18 }, Muscicapidae: { song: 12 },
  Sylviidae: { song: 12 }, Phylloscopidae: { song: 10 }, Fringillidae: { song: 8, display: 10 }, Pycnonotidae: { song: 8 },
  Alaudidae: { song: 22 }, Sturnidae: { song: 15, forage: 10 }, Passerellidae: { song: 6, display: -15 },
  Cardinalidae: { display: 35, song: 5 }, Icteridae: { display: 25, song: 10 }, Parulidae: { display: 25, song: 8 },
  Thraupidae: { display: 30 }, Nectariniidae: { display: 25 }, Meliphagidae: { song: 10 }, Bombycillidae: { display: 25 },
  Columbidae: { song: -40, display: -15, sky: 30 }, Apodidae: { sky: 45, song: -30 }, Hirundinidae: { sky: 40, song: -10 },
  Falconidae: { sky: 4 }, Paridae: { forage: 28, song: -5 }, Sittidae: { forage: 18 }, Passeridae: { forage: 15, display: -15 },
  Laridae: { forage: 8 }, Anatidae: { display: 5 }, Upupidae: { display: 15 }, Ardeidae: { display: 10, forage: 5 },
  Psittaculidae: { song: -15 }, Cacatuidae: { song: -20 }, Tyrannidae: { sky: 15, song: -10, forage: 10 },
};
const BY_SPECIES: Record<string, Partial<Record<Contest, number>>> = {
  normoc: { song: 99 }, brnthr: { song: 95 }, carwre: { song: 96 }, houwre: { song: 94 }, winwre: { song: 96 }, eurwre1: { song: 95 },
  norcar: { display: 96 }, wooduc: { display: 98 }, balori: { display: 95 }, scatan: { display: 96 }, indbun: { display: 94 },
  blujay: { display: 82, forage: 94 }, amegfi: { display: 86 }, cedwax: { display: 88 }, rthhum: { display: 95 }, mallar: { display: 78 },
  perfal: { sky: 99 }, chiswi: { sky: 97 }, barswa: { sky: 95 }, amekes: { sky: 93 }, rethaw: { sky: 92 },
  amecro: { forage: 96 }, comrav: { forage: 97 }, bkcchi: { forage: 93 }, tuftit: { forage: 90 }, grbher: { forage: 88 },
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export type StatSp = Pick<Species, 'id' | 'archetype' | 'family' | 'wingspanCm' | 'sizeCm'>;

/** A species' natural ability in a style, 10–99. */
export function contestStat(sp: StatSp, c: Contest): number {
  const fixed = BY_SPECIES[sp.id]?.[c];
  if (fixed != null) return fixed;
  const row = BY_ARCHETYPE[sp.archetype] ?? BY_ARCHETYPE.passerine;
  let v = row[CONTEST_IDS.indexOf(c)] + (BY_FAMILY[sp.family]?.[c] ?? 0);
  if (c === 'sky' && sp.wingspanCm) v += clamp((sp.wingspanCm - 35) / 8, -8, 8);
  return Math.round(clamp(v, 10, 99));
}
/** A bird's style: the thing it is naturally best at. */
export function birdStyle(sp: StatSp): Contest {
  return [...CONTEST_IDS].sort((a, b) => contestStat(sp, b) - contestStat(sp, a))[0];
}

// ─── signature skills: each one is a real thing the bird does ───
export type SkillKind = 'weaken' | 'double' | 'dazzle' | 'crit' | 'gauge' | 'heal' | 'triple' | 'pierce' | 'sure' | 'big' | 'focus' | 'shelter' | 'drain'
  | 'rally' | 'veil' | 'tailwind' | 'mend';
export interface Skill { id: string; name: string; tag: string; fact: string; kind: SkillKind; power: number; hits: number; style: Contest }
const S = (id: string, name: string, style: Contest, kind: SkillKind, power: number, hits: number, tag: string, fact: string): Skill => ({ id, name, style, kind, power, hits, tag, fact });
export const SKILLS: Record<string, Skill> = Object.fromEntries([
  S('song', 'Daybreak Aria', 'song', 'weaken', 1.6, 1, 'Big hit · lowers its power', 'Songbirds sing hardest at dawn to claim their territory.'),
  S('mimic', 'Mirror Mimic', 'song', 'double', 0.95, 2, 'Hits twice', 'Mockingbirds, starlings and jays copy the calls of other birds.'),
  S('display', 'Prism Flash', 'display', 'dazzle', 1.5, 1, 'Hit · dazzles: it may miss', 'Brightly coloured birds flash their feathers to impress.'),
  S('raptor', 'Falcon Stoop', 'sky', 'crit', 2.1, 1, 'Huge hit · often critical', 'A diving peregrine falcon tops 300 km/h, the fastest animal on Earth.'),
  S('corvid', "Crow's Gambit", 'forage', 'gauge', 1.5, 1, 'Hit · fills your Super', 'Crows and jays solve puzzles and even use tools.'),
  S('cache', 'Hidden Cache', 'forage', 'heal', 1.35, 1, 'Hit · heals 20% HP', 'Chickadees hide thousands of seeds and remember where each one is.'),
  S('drum', 'Thunder Drum', 'forage', 'triple', 0.65, 3, 'Hits 3 times', 'Woodpeckers drum on wood up to 20 times a second.'),
  S('owl', 'Phantom Glide', 'sky', 'pierce', 1.8, 1, 'Hit · goes through Guard', "An owl's soft feathers make its flight almost silent."),
  S('hover', 'Hyper Hover', 'sky', 'triple', 0.7, 3, 'Hits 3 times', 'Hummingbirds beat their wings up to 80 times a second.'),
  S('dove', 'Homing Comet', 'sky', 'sure', 1.75, 1, 'Hit · never misses', 'Pigeons can find their way home from hundreds of kilometres away.'),
  S('aerial', 'Aero Ace', 'sky', 'big', 2.0, 1, 'Huge hit', 'Swallows and swifts catch insects in mid-air at full speed.'),
  S('wader', 'Zen Stalk', 'forage', 'focus', 0, 0, 'Next move does ×2.2', 'Herons stand perfectly still, then lunge in a flash.'),
  S('duck', 'Aqua Shield', 'display', 'shelter', 0, 0, 'Heals 25% · blocks next hit', "Water rolls right off a duck's oily feathers."),
  S('gull', 'Plunder Dive', 'forage', 'drain', 1.45, 1, 'Hit · heals half of it', 'Gulls are famous for snatching food on the fly.'),
  S('flock', 'Flock Rally', 'song', 'heal', 1.4, 1, 'Hit · heals 20% HP', 'Sparrows live in chatty flocks that watch out for each other.'),
].map((s) => [s.id, s]));

const SKILL_BY_FAMILY: Record<string, string> = {
  Mimidae: 'mimic', Sturnidae: 'mimic', Troglodytidae: 'song', Turdidae: 'song', Muscicapidae: 'song', Alaudidae: 'song', Sylviidae: 'song',
  Phylloscopidae: 'song', Fringillidae: 'song', Pycnonotidae: 'song', Meliphagidae: 'song', Cardinalidae: 'display', Icteridae: 'display',
  Parulidae: 'display', Thraupidae: 'display', Nectariniidae: 'display', Bombycillidae: 'display', Upupidae: 'display', Psittaculidae: 'display',
  Cacatuidae: 'mimic', Accipitridae: 'raptor', Falconidae: 'raptor', Pandionidae: 'raptor', Strigidae: 'owl', Tytonidae: 'owl', Corvidae: 'corvid',
  Paridae: 'cache', Sittidae: 'cache', Picidae: 'drum', Trochilidae: 'hover', Columbidae: 'dove', Hirundinidae: 'aerial', Apodidae: 'aerial',
  Ardeidae: 'wader', Threskiornithidae: 'wader', Charadriidae: 'wader', Scolopacidae: 'wader', Anatidae: 'duck', Laridae: 'gull',
  Passeridae: 'flock', Passerellidae: 'flock', Ploceidae: 'flock', Estrildidae: 'flock', Zosteropidae: 'flock',
};
const SKILL_BY_ARCHETYPE: Record<string, string> = {
  passerine: 'song', corvid: 'corvid', raptor: 'raptor', owl: 'owl', waterfowl: 'duck', wader: 'wader', seabird: 'gull',
  woodpecker: 'drum', hummingbird: 'hover', gamebird: 'flock', parrot: 'display', kingfisher: 'aerial',
};
export function skillFor(sp: StatSp): Skill {
  return SKILLS[SKILL_BY_FAMILY[sp.family] ?? SKILL_BY_ARCHETYPE[sp.archetype] ?? 'song'];
}

// ─── techniques: a second move every bird learns at Lv12, one per style ───
export const TECHNIQUES: Record<Contest, Skill> = {
  song: S('rally', 'Rally Anthem', 'song', 'rally', 0, 0, 'Power up for 3 turns', 'Birds sing louder and longer when rivals are nearby.'),
  display: S('veil', 'Mirage Veil', 'display', 'veil', 0, 0, 'Rival may miss · heals 15%', 'Many birds fluff up and flash patterns to confuse a rival.'),
  sky: S('tailwind', 'Tailwind Strike', 'sky', 'tailwind', 1.3, 1, 'Never misses · Super +25%', 'Migrating birds ride tailwinds to fly farther and faster.'),
  forage: S('mend', 'Second Helping', 'forage', 'mend', 0, 0, 'Heals 35% HP', 'Foraging birds refuel fast, eating up to a third of their weight a day.'),
};

// ─── growth: what a bird learns as it levels up ───
export const GROW = { tech: 12, quick: 20, master: 30, ultra: 40 };
const QUICK_PLUS: Record<Contest, string> = { song: 'Sonic Trill', display: 'Dazzle Wing', sky: 'Razor Gale', forage: 'Fury Peck' };
const ULTRA: Record<Contest, string> = { song: 'Maestro Symphony', display: 'Aurora Showcase', sky: 'Hypersonic Dive', forage: 'Grand Harvest' };
export interface Unlock { level: number; kind: 'tech' | 'quick' | 'master' | 'ultra'; name: string; text: string }
/** Everything a bird learns on its way to Lv50, in order. */
export function unlocksFor(sp: StatSp): Unlock[] {
  const style = birdStyle(sp), sk = skillFor(sp), tech = TECHNIQUES[style];
  return [
    { level: GROW.tech, kind: 'tech', name: tech.name, text: `Learned ${tech.name}` },
    { level: GROW.quick, kind: 'quick', name: QUICK_PLUS[style], text: `${CONTESTS[style].quick} grew into ${QUICK_PLUS[style]}` },
    { level: GROW.master, kind: 'master', name: `${sk.name}+`, text: `Mastered ${sk.name}: 30% stronger` },
    { level: GROW.ultra, kind: 'ultra', name: ULTRA[style], text: `Super grew into ${ULTRA[style]}` },
  ];
}
/** Moves learned between two levels (for the "grew to Lv12! Learned…" line). */
export const learnedBetween = (sp: StatSp, from: number, to: number) => unlocksFor(sp).filter((u) => u.level > from && u.level <= to);
export const nextUnlock = (sp: StatSp, level: number) => unlocksFor(sp).find((u) => u.level > level) ?? null;
/** Trainer Bond: +1% HP and power per trainer level after the first, up to +30%. */
export const bondFor = (trainerLevel: number) => Math.min(0.3, Math.max(0, trainerLevel - 1) * 0.01);

// ─── tuning ───
export const T = {
  skillPP: 5,           // signature skill uses per battle
  techPP: 3,            // technique uses per battle
  guardBlock: 0.6,      // Guard (and Waterproof) cut the next hit by this much
  bigMove: 2.5,         // the rival's announced Big Move
  superPower: 3,        // your Super move
  bigEvery: 4,          // the rival charges a Big Move every Nth turn
  gauge: { quick: 20, skill: 25, guard: 15, hurt: 10 },
  crit: 0.08, critRaptor: 0.35, critMult: 1.5,
  ambush: 0.25,         // chance the rival acts before your first move (never in your first battle)
};

// ─── contenders and fighters ───
export interface Contender { sp: Species; level: number; quality: number; parts?: number[]; sightingId?: string }
export interface Fighter {
  c: Contender; style: Contest; skill: Skill; quick: string; quickPow: number;
  tech: Skill | null;  // learned at Lv12
  pp: number; ppMax: number;    // signature skill uses left
  pp2: number; pp2Max: number;  // technique uses left
  spd: number;         // speed: the faster bird acts first
  mastered: boolean;   // Lv30: signature skill is 30% stronger (Zen Stalk ×2.6, Aqua Shield heals 35%)
  superName: string; superPow: number;
  hp: number; max: number; atk: number;
  weak: number;        // turns of -30% power (from Dawn Chorus)
  dazzle: number;      // 50% miss on its next attack
  focus: boolean;      // next attacking move ×2.2 (Patient Stalk)
  fed: number;         // turns of +40% power (Mealworms)
  shelter: boolean;    // next hit blocked 60% (Waterproof)
  out: boolean;
}
const avgStat = (sp: StatSp) => CONTEST_IDS.reduce((n, c) => n + contestStat(sp, c), 0) / 4;
export function fighter(c: Contender, hpScale = 1, bond = 0): Fighter {
  const lv = clamp(Math.round(c.level), 1, 50), style = birdStyle(c.sp);
  const max = Math.round((30 + lv * 4 + avgStat(c.sp) * 0.25) * hpScale * (1 + bond));
  const atk = (6 + lv * 1.1 + clamp(c.quality, 0, 100) / 10) * (contestStat(c.sp, style) / 75) * (1 + bond);
  const base = skillFor(c.sp), mastered = lv >= GROW.master;
  return {
    c: { ...c, level: lv }, style, hp: max, max, atk,
    // a mastered skill hits 30% harder
    skill: mastered ? { ...base, name: `${base.name}+`, power: base.power * 1.3, tag: base.kind === 'shelter' ? 'Heals 35% · blocks next hit' : base.kind === 'focus' ? 'Next move does ×2.6' : `${base.tag} · +30%` } : base,
    mastered, pp: T.skillPP, ppMax: T.skillPP, pp2: lv >= GROW.tech ? T.techPP : 0, pp2Max: lv >= GROW.tech ? T.techPP : 0,
    // speed comes from flying ability (fast fliers act first), plus level
    spd: Math.round(contestStat(c.sp, 'sky') * 0.6 + lv * 1.5 + clamp(c.quality, 0, 100) / 20),
    quick: lv >= GROW.quick ? QUICK_PLUS[style] : CONTESTS[style].quick, quickPow: lv >= GROW.quick ? 1.3 : 1,
    tech: lv >= GROW.tech ? TECHNIQUES[style] : null,
    superName: lv >= GROW.ultra ? ULTRA[style] : CONTESTS[style].super, superPow: lv >= GROW.ultra ? T.superPower * 1.2 : T.superPower,
    weak: 0, dazzle: 0, focus: false, fed: 0, shelter: false, out: false,
  };
}

// ─── battle ───
export type Side = 'you' | 'foe';
export type Item = 'seeds' | 'berries' | 'worms';
export const SNACKS: Record<Item, { name: string; tag: string }> = {
  seeds: { name: 'Seed Mix', tag: 'Heals 30% HP' },
  berries: { name: 'Berry Mash', tag: 'Heals 60% HP' },
  worms: { name: 'Mealworms', tag: '+40% power, 3 turns' },
};
export type Action = { kind: 'quick' } | { kind: 'skill' } | { kind: 'tech' } | { kind: 'guard' } | { kind: 'super' } | { kind: 'snack'; item: Item } | { kind: 'swap'; to: number } | { kind: 'run' } | { kind: 'wait' };
export type MoveKind = 'quick' | 'skill' | 'tech' | 'super' | 'big';
export type Ev =
  | { t: 'log'; text: string }
  | { t: 'move'; side: Side; kind: MoveKind; name: string; style: Contest }
  | { t: 'guard'; side: Side }
  | { t: 'charge'; side: Side }
  | { t: 'dmg'; side: Side; amount: number; crit: boolean; blocked: boolean; style: Contest; big: boolean; eff: -1 | 0 | 1 }
  | { t: 'recall'; side: Side }
  | { t: 'miss'; side: Side }
  | { t: 'heal'; side: Side; amount: number }
  | { t: 'buff'; side: Side; text: string; good: boolean }
  | { t: 'hp'; side: Side; value: number; max: number }
  | { t: 'gauge'; value: number }
  | { t: 'rest'; side: Side }
  | { t: 'send'; side: Side; index: number }
  | { t: 'end'; winner: Side };
export interface Battle {
  you: Fighter[]; foe: Fighter[]; yi: number; fi: number; turn: number; over: Side | null; foeName: string;
  gauge: number;            // your Super gauge, 0–100
  guarding: boolean;        // you guard this turn
  foeCharging: boolean;     // the rival announced a Big Move for its next action
  foeGuard: boolean;
}

export function startBattle(you: Contender[], foe: Contender[], foeName: string, opts: { foeHp?: number; bond?: number } = {}): Battle {
  return { you: you.map((c) => fighter(c, 1, opts.bond ?? 0)), foe: foe.map((c) => fighter(c, opts.foeHp ?? 1)), yi: 0, fi: 0, turn: 0, over: null, foeName, gauge: 0, guarding: false, foeCharging: false, foeGuard: false };
}
const clone = (b: Battle): Battle => ({ ...b, you: b.you.map((f) => ({ ...f })), foe: b.foe.map((f) => ({ ...f })) });
export const active = (b: Battle, s: Side) => (s === 'you' ? b.you[b.yi] : b.foe[b.fi]);
const other = (s: Side): Side => (s === 'you' ? 'foe' : 'you');
const nameOf = (b: Battle, s: Side) => (s === 'you' ? active(b, s).c.sp.common : `${b.foeName}'s ${active(b, s).c.sp.common}`);
const power = (f: Fighter) => f.atk * (f.weak > 0 ? 0.7 : 1) * (f.fed > 0 ? 1.4 : 1);

/** One hit from `side` on the other side. Returns the HP it took. */
function strike(b: Battle, side: Side, mult: number, style: Contest, rng: () => number, ev: Ev[], o: { pierce?: boolean; sure?: boolean; critChance?: number; big?: boolean } = {}): number {
  const a = active(b, side), d = active(b, other(side));
  if (d.out) return 0;
  if (!o.sure && a.dazzle > 0 && rng() < 0.5) { a.dazzle = 0; ev.push({ t: 'miss', side: other(side) }, { t: 'log', text: `${nameOf(b, side)} is dazzled and misses!` }); return 0; }
  const crit = rng() < (o.critChance ?? T.crit);
  const eff = matchup(style, d.style);
  let dmg = power(a) * mult * MATCHUP_MULT[eff] * (0.9 + rng() * 0.2) * (crit ? T.critMult : 1) * (a.focus ? (a.mastered ? 2.6 : 2.2) : 1);
  a.focus = false;
  const guarded = !o.pierce && ((side === 'foe' && b.guarding) || (side === 'you' && b.foeGuard) || d.shelter);
  if (guarded) { dmg *= 1 - T.guardBlock; d.shelter = false; }
  const amount = Math.max(1, Math.round(dmg));
  d.hp = Math.max(0, d.hp - amount);
  ev.push({ t: 'dmg', side: other(side), amount, crit, blocked: guarded, style, big: !!o.big, eff }, { t: 'hp', side: other(side), value: d.hp, max: d.max });
  if (crit) ev.push({ t: 'log', text: 'Critical!' });
  if (eff === 1) ev.push({ t: 'log', text: 'Strong matchup! It hits hard!' });
  else if (eff === -1) ev.push({ t: 'log', text: 'Weak matchup… it barely lands.' });
  if (guarded) ev.push({ t: 'log', text: `${nameOf(b, other(side))} guarded! Most of it was blocked.` });
  if (other(side) === 'you') { b.gauge = Math.min(100, b.gauge + T.gauge.hurt); ev.push({ t: 'gauge', value: b.gauge }); }
  return amount;
}
function heal(b: Battle, side: Side, amount: number, ev: Ev[]) {
  const f = active(b, side), before = f.hp;
  f.hp = Math.min(f.max, f.hp + Math.round(amount));
  if (f.hp > before) ev.push({ t: 'heal', side, amount: f.hp - before }, { t: 'hp', side, value: f.hp, max: f.max });
}
function checkRest(b: Battle, side: Side, ev: Ev[]) {
  const f = active(b, side);
  if (f.hp > 0 || f.out) return;
  f.out = true;
  ev.push({ t: 'rest', side }, { t: 'log', text: `${nameOf(b, side)} flew off to rest!` });
  const list = side === 'you' ? b.you : b.foe, next = list.findIndex((x) => !x.out);
  if (next < 0) { b.over = other(side); ev.push({ t: 'end', winner: other(side) }); return; }
  if (side === 'you') b.yi = next; else b.fi = next;
  if (side === 'foe') { b.foeCharging = false; b.foeGuard = false; }
  ev.push({ t: 'send', side, index: next }, { t: 'log', text: side === 'you' ? `Go, ${list[next].c.sp.common}!` : `${b.foeName} sends out ${list[next].c.sp.common}!` });
}

/** Use a signature skill or a learned technique (either side). */
function useSkill(b: Battle, side: Side, rng: () => number, ev: Ev[], slot: 'skill' | 'tech' = 'skill') {
  const f = active(b, side), s = slot === 'tech' && f.tech ? f.tech : f.skill;
  if (slot === 'tech') f.pp2 = Math.max(0, f.pp2 - 1); else f.pp = Math.max(0, f.pp - 1);
  ev.push({ t: 'move', side, kind: slot, name: s.name, style: s.style }, { t: 'log', text: `${nameOf(b, side)} uses ${s.name}!` });
  const foe = active(b, other(side));
  switch (s.kind) {
    case 'focus': f.focus = true; ev.push({ t: 'buff', side, text: 'Focused!', good: true }, { t: 'log', text: `${nameOf(b, side)} waits perfectly still. Its next move will be huge!` }); return;
    case 'shelter': heal(b, side, f.max * (f.mastered ? 0.35 : 0.25), ev); f.shelter = true; ev.push({ t: 'buff', side, text: 'Aqua Shield!', good: true }); return;
    case 'rally': f.fed = Math.max(f.fed, 3); f.weak = 0; ev.push({ t: 'buff', side, text: 'Power up!', good: true }, { t: 'log', text: `${nameOf(b, side)} is fired up! Power rises for 3 turns.` }); return;
    case 'veil': foe.dazzle = 1; ev.push({ t: 'buff', side: other(side), text: 'Dazzled', good: false }); heal(b, side, f.max * 0.15, ev); return;
    case 'mend': heal(b, side, f.max * 0.35, ev); return;
  }
  let total = 0;
  for (let i = 0; i < s.hits && !foe.out; i++) total += strike(b, side, s.power, s.style, rng, ev, { pierce: s.kind === 'pierce', sure: s.kind === 'sure' || s.kind === 'tailwind', critChance: s.kind === 'crit' ? T.critRaptor : undefined });
  if (s.hits > 1 && total) ev.push({ t: 'log', text: `Hit ${s.hits} times!` });
  if (!total) return;
  if (s.kind === 'weaken') { foe.weak = 2; ev.push({ t: 'buff', side: other(side), text: 'Power down', good: false }); }
  if (s.kind === 'dazzle') { foe.dazzle = 1; ev.push({ t: 'buff', side: other(side), text: 'Dazzled', good: false }); }
  if (s.kind === 'heal') heal(b, side, f.max * 0.2, ev);
  if (s.kind === 'drain') heal(b, side, total / 2, ev);
  if (s.kind === 'gauge' && side === 'you') { b.gauge = Math.min(100, b.gauge + 35); ev.push({ t: 'gauge', value: b.gauge }); }
  if (s.kind === 'tailwind' && side === 'you') { b.gauge = Math.min(100, b.gauge + 25); ev.push({ t: 'gauge', value: b.gauge }); }
}

/** The rival's turn. */
function foeTurn(b: Battle, rng: () => number, ev: Ev[], forceCharge = false) {
  const f = active(b, 'foe');
  if (f.out || b.over) return;
  b.foeGuard = false;
  if (b.foeCharging) {
    b.foeCharging = false;
    const name = CONTESTS[f.style].big;
    ev.push({ t: 'move', side: 'foe', kind: 'big', name, style: f.style }, { t: 'log', text: `${nameOf(b, 'foe')} unleashes ${name}!` });
    strike(b, 'foe', T.bigMove, f.style, rng, ev, { big: true });
  } else if (forceCharge || (b.turn % T.bigEvery === T.bigEvery - 1 && b.turn > 1)) {
    b.foeCharging = true;
    ev.push({ t: 'charge', side: 'foe' }, { t: 'log', text: `${nameOf(b, 'foe')} is powering up ${CONTESTS[f.style].big}! Guard!` });
  } else if (f.pp > 0 && rng() < 0.45) {
    useSkill(b, 'foe', rng, ev);
  } else if (f.tech && f.pp2 > 0 && rng() < (f.tech.kind === 'mend' ? (f.hp < f.max * 0.5 ? 0.6 : 0) : 0.3)) {
    useSkill(b, 'foe', rng, ev, 'tech');
  } else if (f.hp < f.max * 0.3 && rng() < 0.25) {
    b.foeGuard = true; ev.push({ t: 'guard', side: 'foe' }, { t: 'log', text: `${nameOf(b, 'foe')} puffs up and guards.` });
  } else {
    ev.push({ t: 'move', side: 'foe', kind: 'quick', name: f.quick, style: f.style }, { t: 'log', text: `${nameOf(b, 'foe')} uses ${f.quick}!` });
    strike(b, 'foe', f.quickPow, f.style, rng, ev);
  }
  checkRest(b, 'you', ev);
}
const tick = (f: Fighter) => { if (f.weak > 0) f.weak--; if (f.fed > 0) f.fed--; };

/** The rival may act before your very first move. */
export function ambush(b0: Battle, rng: () => number): { b: Battle; ev: Ev[] } {
  const b = clone(b0), ev: Ev[] = [{ t: 'log', text: `${b.foeName}'s ${active(b, 'foe').c.sp.common} moves first!` }];
  const f = active(b, 'foe');
  ev.push({ t: 'move', side: 'foe', kind: 'quick', name: f.quick, style: f.style });
  strike(b, 'foe', f.quickPow, f.style, rng, ev);
  checkRest(b, 'you', ev);
  return { b, ev };
}

export const skillReady = (b: Battle) => active(b, 'you').pp > 0;
export const techReady = (b: Battle) => { const f = active(b, 'you'); return !!f.tech && f.pp2 > 0; };
/** Guard, snacks, swapping and running always happen before attacks (like Protect, items and switching). */
export const PRIORITY = new Set<Action['kind']>(['guard', 'snack', 'swap', 'run', 'wait']);
/** Who acts first this turn. */
export function youFirst(b: Battle, a: Action, rng: () => number): boolean {
  if (PRIORITY.has(a.kind)) return true;
  const me = active(b, 'you'), foe = active(b, 'foe');
  return me.spd > foe.spd || (me.spd === foe.spd && rng() < 0.5);
}
export const superReady = (b: Battle) => b.gauge >= 100;

/** Resolve one turn. Priority actions and the faster bird go first. Returns what happened, in order, for the screen to play. */
export function takeTurn(b0: Battle, mine: Action, rng: () => number, opts: { forceCharge?: boolean } = {}): { b: Battle; ev: Ev[] } {
  if (b0.over) return { b: b0, ev: [] };
  const m0 = active(b0, 'you');
  // moves that can't be used right now don't cost the turn
  if (mine.kind === 'skill' && m0.pp < 1) return { b: b0, ev: [{ t: 'log', text: `${m0.skill.name} is out of PP!` }] };
  if (mine.kind === 'tech' && (!m0.tech || m0.pp2 < 1)) return { b: b0, ev: [{ t: 'log', text: m0.tech ? `${m0.tech.name} is out of PP!` : `${m0.c.sp.common} hasn't learned a technique yet.` }] };
  if (mine.kind === 'super' && b0.gauge < 100) return { b: b0, ev: [{ t: 'log', text: 'Your Limit Break isn’t ready yet.' }] };
  if (mine.kind === 'swap' && (!b0.you[mine.to] || b0.you[mine.to].out || mine.to === b0.yi)) return { b: b0, ev: [] };
  const b = clone(b0), ev: Ev[] = [];
  b.turn++;
  b.guarding = false;
  const first = youFirst(b, mine, rng);
  if (!first && b.turn === 1) ev.push({ t: 'log', text: `${nameOf(b, 'foe')} is faster and moves first!` });
  const mineAct = () => {
    const me = active(b, 'you');
    switch (mine.kind) {
      case 'run': b.over = 'foe'; ev.push({ t: 'log', text: 'You bowed out of the trial.' }, { t: 'end', winner: 'foe' }); return;
      case 'wait': ev.push({ t: 'log', text: `${me.c.sp.common} hesitates.` }); return;
      case 'quick':
        ev.push({ t: 'move', side: 'you', kind: 'quick', name: me.quick, style: me.style }, { t: 'log', text: `${me.c.sp.common} uses ${me.quick}!` });
        strike(b, 'you', me.quickPow, me.style, rng, ev);
        b.gauge = Math.min(100, b.gauge + T.gauge.quick); ev.push({ t: 'gauge', value: b.gauge });
        return;
      case 'tech':
        useSkill(b, 'you', rng, ev, 'tech');
        b.gauge = Math.min(100, b.gauge + T.gauge.skill); ev.push({ t: 'gauge', value: b.gauge });
        return;
      case 'skill':
        useSkill(b, 'you', rng, ev);
        b.gauge = Math.min(100, b.gauge + T.gauge.skill); ev.push({ t: 'gauge', value: b.gauge });
        return;
      case 'swap': {
        const to = b.you[mine.to];
        ev.push({ t: 'recall', side: 'you' }, { t: 'log', text: `Come back, ${me.c.sp.common}! Go, ${to.c.sp.common}!` });
        me.focus = false;
        b.yi = mine.to;
        ev.push({ t: 'send', side: 'you', index: mine.to });
        return;
      }
      case 'guard':
        b.guarding = true; b.gauge = Math.min(100, b.gauge + T.gauge.guard);
        ev.push({ t: 'guard', side: 'you' }, { t: 'log', text: `${me.c.sp.common} puffs up and guards!` }, { t: 'gauge', value: b.gauge });
        return;
      case 'super': {
        b.gauge = 0;
        const name = me.superName;
        ev.push({ t: 'gauge', value: 0 }, { t: 'move', side: 'you', kind: 'super', name, style: me.style }, { t: 'log', text: `${me.c.sp.common} unleashes ${name}!` });
        strike(b, 'you', me.superPow, me.style, rng, ev, { pierce: true, sure: true, big: true });
        return;
      }
      case 'snack':
        ev.push({ t: 'log', text: `${me.c.sp.common} gobbles up some ${SNACKS[mine.item].name}.` });
        if (mine.item === 'worms') { me.fed = 3; ev.push({ t: 'buff', side: 'you', text: 'Power up!', good: true }); }
        else heal(b, 'you', me.max * (mine.item === 'seeds' ? 0.3 : 0.6), ev);
        return;
    }
  };
  if (first) {
    mineAct();
    if (b.over) return { b, ev };
    checkRest(b, 'foe', ev);
    if (!b.over) foeTurn(b, rng, ev, opts.forceCharge);
  } else {
    const yi = b.yi;
    foeTurn(b, rng, ev, opts.forceCharge);
    // a bird that flew off to rest doesn't get to act; the next one has just arrived
    if (!b.over && b.yi === yi) { mineAct(); if (!b.over) checkRest(b, 'foe', ev); }
  }
  if (!b.over) { tick(active(b, 'you')); tick(active(b, 'foe')); }
  return { b, ev };
}

// ─── rivals ───
export interface RivalDef {
  id: string; name: string; title: string; line: string; win: string; lose: string;
  styles: Contest[]; size: number; level: number; quality: number; scene: string;
  coins: number; xp: number; time: number; music: string; face?: string; merlin?: boolean;
}
export const RIVALS: RivalDef[] = [
  { id: 'pip', name: 'Pip', title: 'Backyard rookie', line: "My birds sing all morning. Bet yours can't keep up!", win: 'Whoa! Your birds are good!', lose: 'Ha! Told you my birds were the best!', styles: ['song'], size: 1, level: 3, quality: 30, scene: 'valley', coins: 25, xp: 40, time: 12, music: 'music/battle/default-1.mp3', face: 'trainers/t002.png' },
  { id: 'wren', name: 'Wren', title: 'Dawn chorus fan', line: 'A good song beats bright feathers. Prove me wrong.', win: 'Fine, fine. That was a lovely performance.', lose: 'Listen to that chorus! Come back when you can match it.', styles: ['song', 'forage'], size: 2, level: 5, quality: 40, scene: 'pine', coins: 35, xp: 60, time: 10, music: 'music/battle/battle-6.mp3', face: 'trainers/t016.png' },
  { id: 'gale', name: 'Captain Gale', title: 'Shoreline racer', line: 'Out on the coast, it’s all about the wind.', win: 'You sailed right past me!', lose: 'The wind was on my side today.', styles: ['sky', 'forage'], size: 2, level: 8, quality: 48, scene: 'n3', coins: 45, xp: 80, time: 9, music: 'music/battle/battle-4.mp3', face: 'trainers/t023.png' },
  { id: 'mara', name: 'Mara', title: 'Plumage collector', line: 'Colour is everything. Show me your brightest!', win: 'Stunning. Absolutely stunning.', lose: 'Not quite bright enough, darling.', styles: ['display', 'song'], size: 3, level: 11, quality: 55, scene: 'n1', coins: 60, xp: 110, time: 8, music: 'music/battle/default-3.mp3', face: 'trainers/t024.png' },
  { id: 'hawkins', name: 'Old Hawkins', title: 'Ridge watcher', line: 'Forty years on this ridge. My birds know every trick.', win: 'Well I never. You’ve got a real eye.', lose: 'Patience, young birder. Come back stronger.', styles: ['sky', 'display', 'forage'], size: 3, level: 14, quality: 62, scene: 'dusk', coins: 80, xp: 150, time: 8, music: 'music/battle/battle-8.mp3', face: 'trainers/t020.png' },
  { id: 'merlin', name: 'Professor Merlin', title: 'Grand finale', line: 'So, you’ve come this far. Show me what your birds can do!', win: 'Magnificent! You are a true birder.', lose: 'Not yet, my friend. Not yet.', styles: ['song', 'display', 'sky'], size: 3, level: 18, quality: 70, scene: 'nfb', coins: 120, xp: 250, time: 7, music: 'music/battle/elven.mp3', merlin: true },
];
/** Wandering birders who challenge you after you discover a new bird; each gets a portrait from the trainer set. */
const RIVAL_FACES = new Set(['002', '016', '023', '024', '020']);
const WANDERER_FACES = Array.from({ length: 60 }, (_, i) => String(i + 1).padStart(3, '0')).filter((n) => !RIVAL_FACES.has(n));
export const hashStr = (s: string) => [...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
export const wandererFace = (key: string) => `trainers/t${WANDERER_FACES[hashStr(key + 'face') % WANDERER_FACES.length]}.png`;
export const WANDERERS = ['Birder Sky', 'Fern', 'Rook', 'Juniper', 'Marsh', 'Willow', 'Robin Lee', 'Sparrow Sam'];
export const WILD = { coins: 15, xp: 30, time: 10, chance: 0.4, scenes: ['valley', 'pine', 'n1', 'nfb', 'n3'], music: ['music/battle/battle-2.mp3', 'music/battle/battle-8.mp3', 'music/battle/battle-6.mp3', 'music/battle/default-1.mp3'] };

/** Rival levels keep pace with your team so later rivals stay a challenge. */
export function rivalLevel(r: Pick<RivalDef, 'level'>, tier: number, yourAvg: number): number {
  return Math.max(r.level, Math.round(yourAvg * (0.78 + tier * 0.05)));
}
/** Rival birds come from your region: strong local specialists in the rival's styles, no repeats. */
export function rivalTeam(r: RivalDef, pool: Species[], tier: number, yourAvg = 5): Contender[] {
  const used = new Set<string>();
  const reach = Math.max(8, Math.round(pool.length * Math.min(1, 0.35 + tier * 0.13)));
  const options = pool.slice(0, reach);
  const lv = rivalLevel(r, tier, yourAvg);
  return Array.from({ length: r.size }, (_, i) => {
    const c = r.styles[i % r.styles.length];
    const ranked = options.filter((s) => !used.has(s.id)).sort((a, b) => contestStat(b, c) - contestStat(a, c));
    const sp = ranked[Math.min(ranked.length - 1, Math.max(0, 2 - tier) + (i % 2))] ?? ranked[0] ?? pool[0];
    used.add(sp.id);
    return { sp, level: lv + (i === r.size - 1 ? 1 : 0), quality: r.quality };
  });
}
/** A wandering birder's bird: a random local bird at about your new bird's level. */
export function wildTeam(pool: Species[], level: number, rng: () => number, exclude?: string): Contender[] {
  const options = pool.slice(0, Math.max(10, Math.round(pool.length * 0.6))).filter((s) => s.id !== exclude);
  const sp = options[Math.floor(rng() * options.length)] ?? pool[0];
  return [{ sp, level: Math.max(2, level - 1), quality: 40 }];
}

// ─── rewards ───
export const REMATCH = { coins: 5, xp: 15, perDay: 3 };
/** Trial Tickets: earned by logging birds, spent on rival battles (wandering challenges and your first battle are free). */
export const TICKETS = { start: 3, max: 5 };
export interface TrialsState { cleared: number; wins: number; day?: string; rematches?: number; tutorial?: boolean; battles?: number; wildDay?: string; tickets?: number }
export const ticketsOf = (st?: TrialsState) => st?.tickets ?? TICKETS.start;
export const battleIsFree = (st?: TrialsState) => !st?.tutorial;
export function rewardFor(st: TrialsState | undefined, index: number, today: string): { coins: number; xp: number; first: boolean } {
  const r = RIVALS[index];
  if ((st?.cleared ?? 0) <= index) return { coins: r.coins, xp: r.xp, first: true };
  const used = st?.day === today ? st.rematches ?? 0 : 0;
  return used < REMATCH.perDay ? { coins: REMATCH.coins, xp: REMATCH.xp, first: false } : { coins: 0, xp: 0, first: false };
}

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
