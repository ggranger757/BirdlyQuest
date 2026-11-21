// Field Trials (v3, Step Quest-style): fast, one-tap-per-turn bird battles. Kept bird-true and non-violent:
// birds out-sing, out-dazzle, out-fly and out-forage each other. When a bird's HP reaches 0 it flies off to rest.
//
// Your turn, one tap:  Quick move (always ready) · Signature skill (from a real-life fact; recharges)
//                      · Guard (block 60% of the next hit) · Snack (pantry food) · Super (gauge fills as you battle) · Run
// The rival:           quick move or its own signature skill, now and then a Big Move it announces a turn ahead (Guard!)
// Parties:             up to 3 birds a side; when one rests the next flies in automatically.
import type { Species } from '../data/types';

// ─── styles: a bird's best talent (sets its quick move, super move, colours and sounds) ───
export type Contest = 'song' | 'display' | 'sky' | 'forage';
export const CONTEST_IDS: Contest[] = ['song', 'display', 'sky', 'forage'];

export type Sheet = { src: string; frames: number; fw: number; fh: number };
export interface ContestDef { id: Contest; name: string; quick: string; super: string; proj: Sheet; boom: Sheet; clip: 'tSong' | 'tDisplay' | 'tSky' | 'tForage'; color: string }
const P = {
  wave: { src: 'fx/trials/spell_wave_gold_proj.png', frames: 6, fw: 16, fh: 26 }, goldBoom: { src: 'fx/trials/spell_gold_boom.png', frames: 8, fw: 40, fh: 40 },
  orb: { src: 'fx/trials/spell_orb_gold_proj.png', frames: 6, fw: 24, fh: 14 }, star: { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 },
  wind: { src: 'fx/trials/windblade_proj.png', frames: 4, fw: 28, fh: 39 }, windBoom: { src: 'fx/trials/windblade_boom.png', frames: 3, fw: 28, fh: 39 },
  leaf: { src: 'fx/trials/leaf_proj.png', frames: 2, fw: 16, fh: 16 }, leafBoom: { src: 'fx/trials/leaf_boom.png', frames: 7, fw: 48, fh: 48 },
} satisfies Record<string, Sheet>;
export const CONTESTS: Record<Contest, ContestDef> = {
  song: { id: 'song', name: 'Song', quick: 'Chirp', super: 'Full Aria', proj: P.wave, boom: P.goldBoom, clip: 'tSong', color: 'var(--sun)' },
  display: { id: 'display', name: 'Display', quick: 'Show Off', super: 'Courtship Dance', proj: P.orb, boom: P.star, clip: 'tDisplay', color: 'var(--robin)' },
  sky: { id: 'sky', name: 'Sky', quick: 'Swoop', super: 'Sky Dive', proj: P.wind, boom: P.windBoom, clip: 'tSky', color: 'var(--river)' },
  forage: { id: 'forage', name: 'Forage', quick: 'Peck', super: 'Feeding Frenzy', proj: P.leaf, boom: P.leafBoom, clip: 'tForage', color: 'var(--moss)' },
};
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
export type SkillKind = 'weaken' | 'double' | 'dazzle' | 'crit' | 'gauge' | 'heal' | 'triple' | 'pierce' | 'sure' | 'big' | 'focus' | 'shelter' | 'drain';
export interface Skill { id: string; name: string; tag: string; fact: string; kind: SkillKind; power: number; hits: number; style: Contest }
const S = (id: string, name: string, style: Contest, kind: SkillKind, power: number, hits: number, tag: string, fact: string): Skill => ({ id, name, style, kind, power, hits, tag, fact });
export const SKILLS: Record<string, Skill> = Object.fromEntries([
  S('song', 'Dawn Chorus', 'song', 'weaken', 1.6, 1, 'Big hit · lowers its power', 'Songbirds sing hardest at dawn to claim their territory.'),
  S('mimic', 'Mimicry', 'song', 'double', 0.95, 2, 'Hits twice', 'Mockingbirds, starlings and jays copy the calls of other birds.'),
  S('display', 'Plumage Flash', 'display', 'dazzle', 1.5, 1, 'Hit · dazzles: it may miss', 'Brightly coloured birds flash their feathers to impress.'),
  S('raptor', 'Stoop Dive', 'sky', 'crit', 2.1, 1, 'Huge hit · often critical', 'A diving peregrine falcon tops 300 km/h, the fastest animal on Earth.'),
  S('corvid', 'Clever Trick', 'forage', 'gauge', 1.5, 1, 'Hit · fills your Super', 'Crows and jays solve puzzles and even use tools.'),
  S('cache', 'Seed Cache', 'forage', 'heal', 1.35, 1, 'Hit · heals 20% HP', 'Chickadees hide thousands of seeds and remember where each one is.'),
  S('drum', 'Drum Roll', 'forage', 'triple', 0.65, 3, 'Hits 3 times', 'Woodpeckers drum on wood up to 20 times a second.'),
  S('owl', 'Silent Flight', 'sky', 'pierce', 1.8, 1, 'Hit · goes through Guard', "An owl's soft feathers make its flight almost silent."),
  S('hover', 'Hover Blitz', 'sky', 'triple', 0.7, 3, 'Hits 3 times', 'Hummingbirds beat their wings up to 80 times a second.'),
  S('dove', 'Homing Rush', 'sky', 'sure', 1.75, 1, 'Hit · never misses', 'Pigeons can find their way home from hundreds of kilometres away.'),
  S('aerial', 'Aerial Ace', 'sky', 'big', 2.0, 1, 'Huge hit', 'Swallows and swifts catch insects in mid-air at full speed.'),
  S('wader', 'Patient Stalk', 'forage', 'focus', 0, 0, 'Next move does ×2.2', 'Herons stand perfectly still, then lunge in a flash.'),
  S('duck', 'Waterproof', 'display', 'shelter', 0, 0, 'Heals 25% · blocks next hit', "Water rolls right off a duck's oily feathers."),
  S('gull', 'Snatch & Grab', 'forage', 'drain', 1.45, 1, 'Hit · heals half of it', 'Gulls are famous for snatching food on the fly.'),
  S('flock', 'Flock Call', 'song', 'heal', 1.4, 1, 'Hit · heals 20% HP', 'Sparrows live in chatty flocks that watch out for each other.'),
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

// ─── tuning ───
export const T = {
  skillCooldown: 2,     // turns before a signature skill is ready again
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
  c: Contender; style: Contest; skill: Skill; quick: string;
  hp: number; max: number; atk: number;
  cd: number;          // turns until the signature skill is ready
  weak: number;        // turns of -30% power (from Dawn Chorus)
  dazzle: number;      // 50% miss on its next attack
  focus: boolean;      // next attacking move ×2.2 (Patient Stalk)
  fed: number;         // turns of +40% power (Mealworms)
  shelter: boolean;    // next hit blocked 60% (Waterproof)
  out: boolean;
}
const avgStat = (sp: StatSp) => CONTEST_IDS.reduce((n, c) => n + contestStat(sp, c), 0) / 4;
export function fighter(c: Contender, hpScale = 1): Fighter {
  const lv = clamp(Math.round(c.level), 1, 50), style = birdStyle(c.sp);
  const max = Math.round((30 + lv * 4 + avgStat(c.sp) * 0.25) * hpScale);
  const atk = (6 + lv * 1.1 + clamp(c.quality, 0, 100) / 10) * (contestStat(c.sp, style) / 75);
  return { c: { ...c, level: lv }, style, skill: skillFor(c.sp), quick: CONTESTS[style].quick, hp: max, max, atk, cd: 0, weak: 0, dazzle: 0, focus: false, fed: 0, shelter: false, out: false };
}

// ─── battle ───
export type Side = 'you' | 'foe';
export type Item = 'seeds' | 'berries' | 'worms';
export const SNACKS: Record<Item, { name: string; tag: string }> = {
  seeds: { name: 'Seed Mix', tag: 'Heals 30% HP' },
  berries: { name: 'Berry Mash', tag: 'Heals 60% HP' },
  worms: { name: 'Mealworms', tag: '+40% power, 3 turns' },
};
export type Action = { kind: 'quick' } | { kind: 'skill' } | { kind: 'guard' } | { kind: 'super' } | { kind: 'snack'; item: Item } | { kind: 'run' } | { kind: 'wait' };
export type MoveKind = 'quick' | 'skill' | 'super' | 'big';
export type Ev =
  | { t: 'log'; text: string }
  | { t: 'move'; side: Side; kind: MoveKind; name: string; style: Contest }
  | { t: 'guard'; side: Side }
  | { t: 'charge'; side: Side }
  | { t: 'dmg'; side: Side; amount: number; crit: boolean; blocked: boolean; style: Contest; big: boolean }
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

export function startBattle(you: Contender[], foe: Contender[], foeName: string, opts: { foeHp?: number } = {}): Battle {
  return { you: you.map((c) => fighter(c)), foe: foe.map((c) => fighter(c, opts.foeHp ?? 1)), yi: 0, fi: 0, turn: 0, over: null, foeName, gauge: 0, guarding: false, foeCharging: false, foeGuard: false };
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
  let dmg = power(a) * mult * (0.9 + rng() * 0.2) * (crit ? T.critMult : 1) * (a.focus ? 2.2 : 1);
  a.focus = false;
  const guarded = !o.pierce && ((side === 'foe' && b.guarding) || (side === 'you' && b.foeGuard) || d.shelter);
  if (guarded) { dmg *= 1 - T.guardBlock; d.shelter = false; }
  const amount = Math.max(1, Math.round(dmg));
  d.hp = Math.max(0, d.hp - amount);
  ev.push({ t: 'dmg', side: other(side), amount, crit, blocked: guarded, style, big: !!o.big }, { t: 'hp', side: other(side), value: d.hp, max: d.max });
  if (crit) ev.push({ t: 'log', text: 'Critical!' });
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

/** Use a signature skill (either side). */
function useSkill(b: Battle, side: Side, rng: () => number, ev: Ev[]) {
  const f = active(b, side), s = f.skill;
  f.cd = T.skillCooldown;
  ev.push({ t: 'move', side, kind: 'skill', name: s.name, style: s.style }, { t: 'log', text: `${nameOf(b, side)} uses ${s.name}!` });
  const foe = active(b, other(side));
  switch (s.kind) {
    case 'focus': f.focus = true; ev.push({ t: 'buff', side, text: 'Focused!', good: true }, { t: 'log', text: `${nameOf(b, side)} waits perfectly still. Its next move will be huge!` }); return;
    case 'shelter': heal(b, side, f.max * 0.25, ev); f.shelter = true; ev.push({ t: 'buff', side, text: 'Waterproof!', good: true }); return;
  }
  let total = 0;
  for (let i = 0; i < s.hits && !foe.out; i++) total += strike(b, side, s.power, s.style, rng, ev, { pierce: s.kind === 'pierce', sure: s.kind === 'sure', critChance: s.kind === 'crit' ? T.critRaptor : undefined });
  if (s.hits > 1 && total) ev.push({ t: 'log', text: `Hit ${s.hits} times!` });
  if (!total) return;
  if (s.kind === 'weaken') { foe.weak = 2; ev.push({ t: 'buff', side: other(side), text: 'Power down', good: false }); }
  if (s.kind === 'dazzle') { foe.dazzle = 1; ev.push({ t: 'buff', side: other(side), text: 'Dazzled', good: false }); }
  if (s.kind === 'heal') heal(b, side, f.max * 0.2, ev);
  if (s.kind === 'drain') heal(b, side, total / 2, ev);
  if (s.kind === 'gauge' && side === 'you') { b.gauge = Math.min(100, b.gauge + 35); ev.push({ t: 'gauge', value: b.gauge }); }
}

/** The rival's turn. */
function foeTurn(b: Battle, rng: () => number, ev: Ev[], forceCharge = false) {
  const f = active(b, 'foe');
  if (f.out || b.over) return;
  b.foeGuard = false;
  if (b.foeCharging) {
    b.foeCharging = false;
    const name = 'Big Move';
    ev.push({ t: 'move', side: 'foe', kind: 'big', name, style: f.style }, { t: 'log', text: `${nameOf(b, 'foe')} unleashes its Big Move!` });
    strike(b, 'foe', T.bigMove, f.style, rng, ev, { big: true });
  } else if (forceCharge || (b.turn % T.bigEvery === T.bigEvery - 1 && b.turn > 1)) {
    b.foeCharging = true;
    ev.push({ t: 'charge', side: 'foe' }, { t: 'log', text: `${nameOf(b, 'foe')} is gathering itself for a Big Move! Guard!` });
  } else if (f.cd === 0 && rng() < 0.45) {
    useSkill(b, 'foe', rng, ev);
  } else if (f.hp < f.max * 0.3 && rng() < 0.25) {
    b.foeGuard = true; ev.push({ t: 'guard', side: 'foe' }, { t: 'log', text: `${nameOf(b, 'foe')} puffs up and guards.` });
  } else {
    ev.push({ t: 'move', side: 'foe', kind: 'quick', name: f.quick, style: f.style }, { t: 'log', text: `${nameOf(b, 'foe')} uses ${f.quick}!` });
    strike(b, 'foe', 1, f.style, rng, ev);
  }
  checkRest(b, 'you', ev);
}
const tick = (f: Fighter) => { if (f.cd > 0) f.cd--; if (f.weak > 0) f.weak--; if (f.fed > 0) f.fed--; };

/** The rival may act before your very first move. */
export function ambush(b0: Battle, rng: () => number): { b: Battle; ev: Ev[] } {
  const b = clone(b0), ev: Ev[] = [{ t: 'log', text: `${b.foeName}'s ${active(b, 'foe').c.sp.common} moves first!` }];
  const f = active(b, 'foe');
  ev.push({ t: 'move', side: 'foe', kind: 'quick', name: f.quick, style: f.style });
  strike(b, 'foe', 1, f.style, rng, ev);
  checkRest(b, 'you', ev);
  return { b, ev };
}

export const skillReady = (b: Battle) => active(b, 'you').cd === 0;
export const superReady = (b: Battle) => b.gauge >= 100;

/** Resolve one turn: your action, then the rival's. Returns what happened, in order, for the screen to play. */
export function takeTurn(b0: Battle, mine: Action, rng: () => number, opts: { forceCharge?: boolean } = {}): { b: Battle; ev: Ev[] } {
  const b = clone(b0), ev: Ev[] = [];
  if (b.over) return { b, ev };
  b.turn++;
  b.guarding = false;
  const me = active(b, 'you');
  switch (mine.kind) {
    case 'run': b.over = 'foe'; ev.push({ t: 'log', text: 'You bowed out of the trial.' }, { t: 'end', winner: 'foe' }); return { b, ev };
    case 'wait': ev.push({ t: 'log', text: `Too slow! ${me.c.sp.common} hesitates.` }); break;
    case 'quick':
      ev.push({ t: 'move', side: 'you', kind: 'quick', name: me.quick, style: me.style }, { t: 'log', text: `${me.c.sp.common} uses ${me.quick}!` });
      strike(b, 'you', 1, me.style, rng, ev);
      b.gauge = Math.min(100, b.gauge + T.gauge.quick); ev.push({ t: 'gauge', value: b.gauge });
      break;
    case 'skill':
      if (me.cd > 0) { ev.push({ t: 'log', text: `${me.skill.name} is still recharging.` }); return { b: b0, ev }; }
      useSkill(b, 'you', rng, ev);
      b.gauge = Math.min(100, b.gauge + T.gauge.skill); ev.push({ t: 'gauge', value: b.gauge });
      break;
    case 'guard':
      b.guarding = true; b.gauge = Math.min(100, b.gauge + T.gauge.guard);
      ev.push({ t: 'guard', side: 'you' }, { t: 'log', text: `${me.c.sp.common} puffs up and guards!` }, { t: 'gauge', value: b.gauge });
      break;
    case 'super': {
      if (b.gauge < 100) { ev.push({ t: 'log', text: 'Your Super move isn’t ready yet.' }); return { b: b0, ev }; }
      b.gauge = 0;
      const name = CONTESTS[me.style].super;
      ev.push({ t: 'gauge', value: 0 }, { t: 'move', side: 'you', kind: 'super', name, style: me.style }, { t: 'log', text: `${me.c.sp.common} unleashes ${name}!` });
      strike(b, 'you', T.superPower, me.style, rng, ev, { pierce: true, sure: true, big: true });
      break;
    }
    case 'snack': {
      ev.push({ t: 'log', text: `${me.c.sp.common} gobbles up some ${SNACKS[mine.item].name}.` });
      if (mine.item === 'worms') { me.fed = 3; ev.push({ t: 'buff', side: 'you', text: 'Power up!', good: true }); }
      else heal(b, 'you', me.max * (mine.item === 'seeds' ? 0.3 : 0.6), ev);
      break;
    }
  }
  checkRest(b, 'foe', ev);
  if (!b.over) foeTurn(b, rng, ev, opts.forceCharge);
  if (!b.over) { tick(active(b, 'you')); tick(active(b, 'foe')); }
  return { b, ev };
}

// ─── rivals ───
export interface RivalDef {
  id: string; name: string; title: string; line: string; win: string; lose: string;
  styles: Contest[]; size: number; level: number; quality: number; scene: string;
  coins: number; xp: number; time: number; music: string; merlin?: boolean;
}
export const RIVALS: RivalDef[] = [
  { id: 'pip', name: 'Pip', title: 'Backyard rookie', line: "My birds sing all morning. Bet yours can't keep up!", win: 'Whoa! Your birds are good!', lose: 'Ha! Told you my birds were the best!', styles: ['song'], size: 1, level: 3, quality: 30, scene: 'valley', coins: 25, xp: 40, time: 12, music: 'music/battle/default-1.mp3' },
  { id: 'wren', name: 'Wren', title: 'Dawn chorus fan', line: 'A good song beats bright feathers. Prove me wrong.', win: 'Fine, fine. That was a lovely performance.', lose: 'Listen to that chorus! Come back when you can match it.', styles: ['song', 'forage'], size: 2, level: 5, quality: 40, scene: 'pine', coins: 35, xp: 60, time: 10, music: 'music/battle/battle-6.mp3' },
  { id: 'gale', name: 'Captain Gale', title: 'Shoreline racer', line: 'Out on the coast, it’s all about the wind.', win: 'You sailed right past me!', lose: 'The wind was on my side today.', styles: ['sky', 'forage'], size: 2, level: 8, quality: 48, scene: 'n3', coins: 45, xp: 80, time: 9, music: 'music/battle/battle-4.mp3' },
  { id: 'mara', name: 'Mara', title: 'Plumage collector', line: 'Colour is everything. Show me your brightest!', win: 'Stunning. Absolutely stunning.', lose: 'Not quite bright enough, darling.', styles: ['display', 'song'], size: 3, level: 11, quality: 55, scene: 'n1', coins: 60, xp: 110, time: 8, music: 'music/battle/default-3.mp3' },
  { id: 'hawkins', name: 'Old Hawkins', title: 'Ridge watcher', line: 'Forty years on this ridge. My birds know every trick.', win: 'Well I never. You’ve got a real eye.', lose: 'Patience, young birder. Come back stronger.', styles: ['sky', 'display', 'forage'], size: 3, level: 14, quality: 62, scene: 'dusk', coins: 80, xp: 150, time: 8, music: 'music/battle/battle-8.mp3' },
  { id: 'merlin', name: 'Professor Merlin', title: 'Grand finale', line: 'So, you’ve come this far. Show me what your birds can do!', win: 'Magnificent! You are a true birder.', lose: 'Not yet, my friend. Not yet.', styles: ['song', 'display', 'sky'], size: 3, level: 18, quality: 70, scene: 'nfb', coins: 120, xp: 250, time: 7, music: 'music/battle/elven.mp3', merlin: true },
];
/** Wandering birders who challenge you after you discover a new bird. */
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
export interface TrialsState { cleared: number; wins: number; day?: string; rematches?: number; tutorial?: boolean; battles?: number; wildDay?: string }
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
