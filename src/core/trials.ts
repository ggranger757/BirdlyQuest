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
import { armorStats, piecesFor, rivalLevelUps, type ArmorStats } from './armor';

// ─── styles: a bird's best talent (sets its quick move, super move, colours and sounds) ───
export type Contest = 'song' | 'display' | 'sky' | 'forage';
export const CONTEST_IDS: Contest[] = ['song', 'display', 'sky', 'forage'];

export type Sheet = { src: string; frames: number; fw: number; fh: number };
export interface ContestDef { id: Contest; name: string; quick: string; super: string; big: string; proj: Sheet; boom: Sheet; clip: 'tSong' | 'tDisplay' | 'tSky' | 'tForage'; color: string }
const P = {
  wave: { src: 'fx/trials/spell_wave_gold_proj.png', frames: 6, fw: 16, fh: 26 }, goldBoom: { src: 'fx/trials/spell_gold_boom.png', frames: 8, fw: 40, fh: 40 },
  orb: { src: 'fx/trials/spell_orb_gold_proj.png', frames: 6, fw: 24, fh: 14 }, star: { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 },
  wind: { src: 'fx/trials/windblade_proj.png', frames: 4, fw: 28, fh: 39 }, windBoom: { src: 'fx/trials/windblade_boom.png', frames: 3, fw: 28, fh: 39 },
  leaf: { src: 'fx/trials/leaf_proj.png', frames: 2, fw: 16, fh: 16 }, leafBoom: { src: 'fx/trials/leaf_green_boom.png', frames: 7, fw: 48, fh: 48 },
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
/** Forage birds explode green. */
export const FX_GREEN_CRIT: Sheet = { src: 'fx/trials/green_blast.png', frames: 8, fw: 48, fh: 48 };
export const FX_GREEN_BIG: Sheet = { src: 'fx/trials/green_smoke_boom.png', frames: 9, fw: 56, fh: 64 };
export const critFx = (style: Contest, big: boolean): Sheet => (style === 'forage' ? (big ? FX_GREEN_BIG : FX_GREEN_CRIT) : FX_CRIT);

// ─── technique animations (pixelated from the owner's projectile and explosion sheets) ───
export type TechKind = 'rally' | 'veil' | 'tailwind' | 'mend';
/** self: plays on the user (power-ups, heals). hits: the explosion lands with the damage. */
export const TECH_FX: Record<TechKind, { proj?: Sheet; boom: Sheet; self?: boolean; hits?: boolean }> = {
  tailwind: { proj: { src: 'fx/trials/spark_proj.png', frames: 5, fw: 32, fh: 16 }, boom: { src: 'fx/trials/spark_boom.png', frames: 11, fw: 48, fh: 48 }, hits: true },
  veil: { proj: { src: 'fx/trials/spell_orb_violet_proj.png', frames: 6, fw: 24, fh: 14 }, boom: { src: 'fx/trials/spell_violet_boom.png', frames: 8, fw: 40, fh: 40 } },
  rally: { boom: { src: 'fx/trials/rally_boom.png', frames: 11, fw: 48, fh: 48 }, self: true },
  mend: { boom: { src: 'fx/trials/spell_green_boom.png', frames: 8, fw: 40, fh: 40 }, self: true },
};
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
export interface Contender { sp: Species; level: number; quality: number; parts?: number[]; sightingId?: string; armor?: number; dye?: string; glow?: string } // armor: pieces worn (v1.37)
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
  gear: ArmorStats;    // armor bonuses (v1.37)
  out: boolean;
}
const avgStat = (sp: StatSp) => CONTEST_IDS.reduce((n, c) => n + contestStat(sp, c), 0) / 4;
export function fighter(c: Contender, hpScale = 1, bond = 0): Fighter {
  const lv = clamp(Math.round(c.level), 1, 50), style = birdStyle(c.sp);
  const gear = armorStats(c.armor ?? 0);
  const max = Math.round((30 + lv * 4 + avgStat(c.sp) * 0.25) * hpScale * (1 + bond) * (1 + gear.hp));
  const atk = (6 + lv * 1.1 + clamp(c.quality, 0, 100) / 10) * (contestStat(c.sp, style) / 75) * (1 + bond) * (1 + gear.atk);
  const base = skillFor(c.sp), mastered = lv >= GROW.master;
  return {
    c: { ...c, level: lv }, style, hp: max, max, atk,
    // a mastered skill hits 30% harder
    skill: mastered ? { ...base, name: `${base.name}+`, power: base.power * 1.3, tag: base.kind === 'shelter' ? 'Heals 35% · blocks next hit' : base.kind === 'focus' ? 'Next move does ×2.6' : `${base.tag} · +30%` } : base,
    mastered, gear, pp: T.skillPP + gear.pp, ppMax: T.skillPP + gear.pp, pp2: lv >= GROW.tech ? T.techPP : 0, pp2Max: lv >= GROW.tech ? T.techPP : 0,
    // speed comes from flying ability (fast fliers act first), plus level
    spd: Math.round((contestStat(c.sp, 'sky') * 0.6 + lv * 1.5 + clamp(c.quality, 0, 100) / 20) * (1 + gear.spd)),
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
  | { t: 'move'; side: Side; kind: MoveKind; name: string; style: Contest; tech?: TechKind }
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
  const mine = you.map((c) => fighter(c, 1, opts.bond ?? 0));
  // a sigil starts the battle with some Super already charged
  return { you: mine, foe: foe.map((c) => fighter(c, opts.foeHp ?? 1)), yi: 0, fi: 0, turn: 0, over: null, foeName, gauge: mine[0]?.gear.start ?? 0, guarding: false, foeCharging: false, foeGuard: false };
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
  dmg *= 1 - (d.gear?.dr ?? 0); // helmet
  const amount = Math.max(1, Math.round(dmg));
  d.hp = Math.max(0, d.hp - amount);
  ev.push({ t: 'dmg', side: other(side), amount, crit, blocked: guarded, style, big: !!o.big, eff }, { t: 'hp', side: other(side), value: d.hp, max: d.max });
  if (crit) ev.push({ t: 'log', text: 'Critical!' });
  if (eff === 1) ev.push({ t: 'log', text: 'Strong matchup! It hits hard!' });
  else if (eff === -1) ev.push({ t: 'log', text: 'Weak matchup… it barely lands.' });
  if (guarded) ev.push({ t: 'log', text: `${nameOf(b, other(side))} guarded! Most of it was blocked.` });
  if (other(side) === 'you') { b.gauge = gainGauge(b, T.gauge.hurt); ev.push({ t: 'gauge', value: b.gauge }); }
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
  ev.push({ t: 'move', side, kind: slot, name: s.name, style: s.style, tech: slot === 'tech' ? (s.kind as TechKind) : undefined }, { t: 'log', text: `${nameOf(b, side)} uses ${s.name}!` });
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
  if (s.kind === 'gauge' && side === 'you') { b.gauge = gainGauge(b, 35); ev.push({ t: 'gauge', value: b.gauge }); }
  if (s.kind === 'tailwind' && side === 'you') { b.gauge = gainGauge(b, 25); ev.push({ t: 'gauge', value: b.gauge }); }
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
/** Your Super meter goes up; back gear makes it fill faster. */
function gainGauge(b: Battle, n: number) { return Math.min(100, b.gauge + n * (active(b, 'you').gear?.gauge ?? 1)); }

/** Resolve one turn. Priority actions and the faster bird go first. Returns what happened, in order, for the screen to play. */
export function takeTurn(b0: Battle, mine: Action, rng: () => number, opts: { forceCharge?: boolean } = {}): { b: Battle; ev: Ev[] } {
  if (b0.over) return { b: b0, ev: [] };
  const m0 = active(b0, 'you');
  // moves that can't be used right now don't cost the turn
  if (mine.kind === 'skill' && m0.pp < 1) return { b: b0, ev: [{ t: 'log', text: `${m0.skill.name} has no uses left this battle. Quick moves and Guard always work.` }] };
  if (mine.kind === 'tech' && (!m0.tech || m0.pp2 < 1)) return { b: b0, ev: [{ t: 'log', text: m0.tech ? `${m0.tech.name} has no uses left this battle. Quick moves and Guard always work.` : `${m0.c.sp.common} hasn't learned a technique yet.` }] };
  if (mine.kind === 'super' && b0.gauge < 100) return { b: b0, ev: [{ t: 'log', text: 'Your Super isn’t ready yet. The Super meter fills as you fight.' }] };
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
        b.gauge = gainGauge(b, T.gauge.quick); ev.push({ t: 'gauge', value: b.gauge });
        return;
      case 'tech':
        useSkill(b, 'you', rng, ev, 'tech');
        b.gauge = gainGauge(b, T.gauge.skill); ev.push({ t: 'gauge', value: b.gauge });
        return;
      case 'skill':
        useSkill(b, 'you', rng, ev);
        b.gauge = gainGauge(b, T.gauge.skill); ev.push({ t: 'gauge', value: b.gauge });
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
        b.guarding = true; b.gauge = gainGauge(b, T.gauge.guard);
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
/** How a trainer talks. `{bird}` is replaced with the bird's name. */
export interface Persona {
  bio: string; motive: string;
  send: string[];    // sending out their next bird
  faint: string[];   // their bird flies off to rest
  taunt: string[];   // your bird flies off to rest
  charge: string[];  // announcing a Big Move
  low: string;       // their last bird is nearly out
}
export interface RivalDef extends Persona {
  id: string; name: string; title: string; line: string; win: string; lose: string;
  styles: Contest[]; size: number; level: number; quality: number; scene: string;
  coins: number; xp: number; time: number; music: string; face?: string; merlin?: boolean;
}
export const RIVALS: RivalDef[] = [
  {
    id: 'pip', name: 'Pip', title: 'Backyard rookie', styles: ['song'], size: 1, level: 3, quality: 30, scene: 'valley', coins: 25, xp: 40, time: 12, music: 'music/battle/default-1.mp3', face: 'trainers/t002.png',
    bio: 'Ten years old, with binoculars bigger than his head. Watches his backyard feeder every morning before school.',
    motive: 'His big sister promised to take him on the dawn bird walk if he ever wins a Field Trial.',
    line: 'Okay okay okay! My sister says if I beat you she’ll FINALLY take me on the dawn walk. So… prepare to lose!',
    send: ['Go, {bird}! You’re my best one!', '{bird}, it’s your turn! Do the thing!'],
    faint: ['Nooo, {bird}! You were doing so good!', 'It’s okay, {bird}! Extra snacks later, I promise!'],
    taunt: ['Ha! Did you see that?! My backyard birds rule!', 'Whoa, I actually did it!'],
    charge: ['{bird}, do the super loud one! The one that wakes up my whole street!'],
    low: 'Uh oh. Uh oh uh oh uh oh.',
    win: 'Aww, man! That was SO cool though. Can you show me how you trained them?',
    lose: 'I WON?! Wait till my sister hears about this!',
  },
  {
    id: 'wren', name: 'Wren', title: 'Dawn chorus fan', styles: ['song', 'forage'], size: 2, level: 5, quality: 40, scene: 'pine', coins: 35, xp: 60, time: 10, music: 'music/battle/battle-6.mp3', face: 'trainers/t016.png',
    bio: 'A sound recordist who is out with her microphone at 4 a.m. She has 900 hours of dawn chorus recorded and an opinion about every minute.',
    motive: 'She’s choosing birds for her dawn-chorus album. Birds that lose don’t make the tracklist.',
    line: 'Shh. Hear that? No? That’s the problem. I only record birds that can hold a stage. Prove yours can.',
    send: ['{bird}, take it from the top.', 'Your cue, {bird}. Don’t rush the tempo.'],
    faint: ['Cut. {bird}, we’ll do another take.', 'Hm. {bird} went flat on that one.'],
    taunt: ['That’s what a clean recording sounds like.', 'Pitch perfect. Yours was… enthusiastic.'],
    charge: ['Building to the crescendo… {bird}, now!'],
    low: 'Fine. Final verse. Make it count, {bird}.',
    win: 'That was a lovely performance. You’ve earned a track on the album.',
    lose: 'Too noisy, too soon. Come back when your birds can listen as well as sing.',
  },
  {
    id: 'gale', name: 'Captain Gale', title: 'Shoreline racer', styles: ['sky', 'forage'], size: 2, level: 8, quality: 48, scene: 'n3', coins: 45, xp: 80, time: 9, music: 'music/battle/battle-4.mp3', face: 'trainers/t023.png',
    bio: 'Skippered the island ferry for forty years. Now he races shorebirds against the tide, and he has never lost on home water.',
    motive: 'Defending his unbeaten record. Nobody takes his harbour.',
    line: 'Ahoy, landlubber! Fair winds or foul, nobody beats Gale on his own coast. Batten down!',
    send: ['Hoist the sails, {bird}! Full speed ahead!', '{bird}, ride that headwind!'],
    faint: ['Man overboard! Hang on, {bird}!', 'Rough seas, {bird}. Rest easy, matey.'],
    taunt: ['Ha! Caught you in my wake!', 'That’s how it’s done on open water!'],
    charge: ['All hands! {bird}, bring the storm!'],
    low: 'Steady as she goes… we’re not sunk yet!',
    win: 'Blow me down! You sailed right past me. The harbour’s yours today.',
    lose: 'The tide never lies, sailor. Come back when you’ve found your sea legs.',
  },
  {
    id: 'mara', name: 'Mara', title: 'Plumage collector', styles: ['display', 'song'], size: 3, level: 11, quality: 55, scene: 'n1', coins: 60, xp: 110, time: 8, music: 'music/battle/default-3.mp3', face: 'trainers/t024.png',
    bio: 'A fashion designer who sketches feathers for her runway collections. Her studio walls are covered in plumage swatches.',
    motive: 'She’s hunting for a muse bird for her next collection. Only the most dazzling will do.',
    line: 'Darling. Let me see them. …Hm. We’ll see if any of yours could possibly be my muse.',
    send: ['{bird}, walk for me, darling.', 'Show them the collection, {bird}.'],
    faint: ['Tragic. {bird}, go and fix your feathers.', 'No, no, no. That look was all wrong.'],
    taunt: ['Stunning. Simply stunning. Mine, I mean.', 'Did you see the shimmer on that?'],
    charge: ['{bird}, the grand finale look! Now!'],
    low: 'Last look of the season. Make it unforgettable, {bird}.',
    win: 'Stunning. Absolutely stunning. I think I’ve found my muse… and it’s yours.',
    lose: 'Not quite bright enough, darling. Come back with more colour.',
  },
  {
    id: 'hawkins', name: 'Old Hawkins', title: 'Ridge watcher', styles: ['sky', 'display', 'forage'], size: 3, level: 14, quality: 62, scene: 'dusk', coins: 80, xp: 150, time: 8, music: 'music/battle/battle-8.mp3', face: 'trainers/t020.png',
    bio: 'Has counted migrating hawks from the same ridge every autumn for forty years. Gruff, patient, and misses nothing.',
    motive: 'His knees can’t take the climb much longer. He’s looking for someone worthy to take over the count.',
    line: 'Forty years on this ridge, kid. Seen a lot of birders come and go. Let’s see if you’re one who stays.',
    send: ['Steady, {bird}. Watch the wind.', 'Your turn, {bird}. Like we practised.'],
    faint: ['Good effort, {bird}. Rest your wings.', 'Saw that coming. Should’ve moved sooner.'],
    taunt: ['Patience wins on the ridge.', 'You rushed it. Birds can tell.'],
    charge: ['Now, {bird}. Ride the thermal and drop.'],
    low: 'Heh. Last one. Haven’t had to say that in years.',
    win: 'Well I never. You’ve got a real eye. Maybe the ridge will be in good hands.',
    lose: 'Patience, young birder. The ridge will still be here. Come back stronger.',
  },
  {
    id: 'merlin', name: 'Professor Woods', title: 'Grand finale', styles: ['song', 'display', 'sky'], size: 3, level: 18, quality: 70, scene: 'nfb', coins: 120, xp: 250, time: 7, music: 'music/battle/elven.mp3', merlin: true,
    bio: 'Your mentor and the keeper of the shop. Thirty years in the field, and she still gasps at every sparrow.',
    motive: 'The final exam: has her student learned that every bird’s real-life talent is its true strength?',
    line: 'So, you’ve come this far. Every bird has a true talent. Today, show me you’ve learned to see it.',
    send: ['Come, {bird}. One more lesson to teach.', '{bird}, my old friend. Show them.'],
    faint: ['Splendid! You were watching closely.', 'Well spotted. Rest now, {bird}.'],
    taunt: ['Ah, a lesson I learned the hard way too.', 'Mind the matchups, my friend.'],
    charge: ['Watch carefully now. {bird}, the grand finale!'],
    low: 'My last bird. How very exciting!',
    win: 'Magnificent! There’s nothing left I can teach you. You are a true birder.',
    lose: 'Not yet, my friend. Not yet. Study your birds’ talents and come back.',
  },
];
/** Wandering birders who challenge you after you discover a new bird; each gets a portrait from the trainer set. */
const RIVAL_FACES = new Set(['002', '016', '023', '024', '020']);
const WANDERER_FACES = Array.from({ length: 60 }, (_, i) => String(i + 1).padStart(3, '0')).filter((n) => !RIVAL_FACES.has(n));
export const hashStr = (s: string) => [...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
export const wandererFace = (key: string) => `trainers/t${WANDERER_FACES[hashStr(key + 'face') % WANDERER_FACES.length]}.png`;
export const WANDERERS = ['Birder Sky', 'Fern', 'Rook', 'Juniper', 'Marsh', 'Willow', 'Robin Lee', 'Sparrow Sam'];
/** Wandering birders: short personalities for the challenges that pop up after a new find. `{new}` is your new bird. */
export const WANDERER_PERSONA: Record<string, Persona & { line: string; win: string; lose: string; title: string }> = {
  'Birder Sky': { title: 'Wildlife photographer', bio: 'Carries three cameras and zero snacks.', motive: 'Wants an action shot of your new bird for her portfolio.', line: 'Hold still… a {new}?! I need this shot. Battle me while I shoot!', send: [], faint: ['Got the shot anyway!'], taunt: ['Ooh, that’ll make a great photo.'], charge: ['{bird}, give me your best angle!'], low: 'One more frame…', win: 'Perfect shot. Thanks for the show!', lose: 'Great photos, though. Truly.' },
  Fern: { title: 'Shy botanist', bio: 'Knows every plant on the trail and talks mostly to them.', motive: 'Curious whether your {new} can keep up with her garden birds.', line: 'Oh! Um. Sorry. Is that a {new}? Could we… maybe have a small trial?', send: [], faint: ['Oh no, sorry, {bird}!'], taunt: ['Oh! I didn’t mean to win that one.'], charge: ['{bird}, um… go big?'], low: 'Okay. Deep breaths.', win: 'You’re really good. Thank you for being gentle.', lose: 'I… won? Oh my.' },
  Rook: { title: 'Cocky teen birder', bio: 'Has 400 species on his list and mentions it constantly.', motive: 'Wants to prove your {new} is just beginner’s luck.', line: 'A {new}? Cute. I’ve got that one five times over. Let’s see if yours can actually battle.', send: [], faint: ['Whatever, {bird} wasn’t trying.'], taunt: ['Too easy.'], charge: ['Watch this, {bird}. Show-off time.'], low: 'Okay, okay, I’m focusing now.', win: 'Fine. Beginner’s luck. Twice.', lose: 'Told you. Four hundred species, baby.' },
  Juniper: { title: 'Field researcher', bio: 'Clipboard, waders, and a spreadsheet for everything.', motive: 'Collecting data on how a {new} performs under pressure.', line: 'Fascinating, a {new}. For science: may I test it in a trial?', send: [], faint: ['Noted. Interesting result.'], taunt: ['Consistent with my hypothesis.'], charge: ['Trial three, {bird}: maximum output.'], low: 'The sample size is getting small…', win: 'Excellent data. Thank you for participating.', lose: 'Results recorded. Try again for a larger sample.' },
  Marsh: { title: 'Old fisherman', bio: 'Fishes the same pond every day and knows every heron by name.', motive: 'Reckons nothing beats a pond bird, not even your {new}.', line: 'Well now, a {new}. Pond birds’ll teach it a thing or two. Fancy a trial?', send: [], faint: ['That one got away.'], taunt: ['Patience. Like fishing.'], charge: ['Reel it in, {bird}!'], low: 'Last cast of the day.', win: 'Hah! Good catch, that bird of yours.', lose: 'The pond always wins in the end.' },
  Willow: { title: 'Landscape painter', bio: 'Paints birds in watercolour, usually slightly the wrong colour.', motive: 'Wants to see your {new} move so she can paint it.', line: 'Look at the colours on that {new}! Battle me, I need to see how it moves.', send: [], faint: ['Such lovely brushwork, {bird}.'], taunt: ['Beautiful! I must paint that.'], charge: ['{bird}, a bold stroke now!'], low: 'Final layer of paint…', win: 'Gorgeous! That one’s going on canvas.', lose: 'Lovely composition. Mine, I mean!' },
  'Robin Lee': { title: 'Birding streamer', bio: 'Live-streams every walk to 12 loyal viewers.', motive: 'Chat wants to see a {new} battle. Content is content.', line: 'Chat, CHAT. A {new}! Okay, okay, let’s do a trial on stream!', send: [], faint: ['Chat, that was a misclick.'], taunt: ['Clip that! CLIP IT!'], charge: ['{bird}, hit them with the big one for chat!'], low: 'Chat, we’re in trouble.', win: 'GG! Chat, follow this birder.', lose: 'And THAT’s why we stream, chat.' },
  'Sparrow Sam': { title: 'Kid with a notebook', bio: 'Draws every bird she sees with a purple crayon.', motive: 'Has never seen a {new} up close and wants to know if it’s strong.', line: 'Is that a REAL {new}?! Can my bird try battling it? Please please please?', send: [], faint: ['Sorry, {bird}! You did great!'], taunt: ['Yay! Did you see?!'], charge: ['{bird}, do your biggest flap!'], low: 'Come on come on come on!', win: 'Wow! Your bird is the best one!', lose: 'We won! I’m drawing this in my notebook!' },
};
export const WILD = { coins: 15, xp: 30, time: 10, chance: 0.4, scenes: ['valley', 'pine', 'n1', 'nfb', 'n3'], music: ['music/battle/battle-2.mp3', 'music/battle/battle-8.mp3', 'music/battle/battle-6.mp3', 'music/battle/default-1.mp3'] };

/** Rival levels keep pace with your team so later rivals stay a challenge. */
export function rivalLevel(r: Pick<RivalDef, 'level'>, tier: number, yourAvg: number): number {
  return Math.max(r.level, Math.round(yourAvg * (0.78 + tier * 0.05)));
}
/** Each rival's team wears their signature armor colour. */
const RIVAL_DYE: Record<string, string> = { pip: 'theme', wren: 'jade', gale: 'cobalt', mara: 'rose', hawkins: 'silver', merlin: 'gold' };
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
    { const level = lv + (i === r.size - 1 ? 1 : 0); return { sp, level, quality: r.quality, armor: piecesFor(rivalLevelUps(level)), dye: RIVAL_DYE[r.id] }; }
  });
}
/** A wandering birder's bird: a random local bird at about your new bird's level. */
export function wildTeam(pool: Species[], level: number, rng: () => number, exclude?: string): Contender[] {
  const options = pool.slice(0, Math.max(10, Math.round(pool.length * 0.6))).filter((s) => s.id !== exclude);
  const sp = options[Math.floor(rng() * options.length)] ?? pool[0];
  { const lv = Math.max(2, level - 1); return [{ sp, level: lv, quality: 40, armor: piecesFor(rivalLevelUps(lv)) }]; }
}

// ─── rewards ───
export const REMATCH = { coins: 5, xp: 15, perDay: 3 };
/** Trial Tickets: earned by logging birds, spent on rival battles (wandering challenges and your first battle are free). */
export const TICKETS = { start: 3, max: 5 };
export interface TrialsState { cleared: number; wins: number; day?: string; rematches?: number; tutorial?: boolean; battles?: number; wildDay?: string; tickets?: number; ticketsEarned?: number; ticketsUsed?: number; duels?: Record<string, string>; duelWins?: number }
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
