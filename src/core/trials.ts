// Field Trials: turn-based, Pokémon-style contests between birds, kept bird-true and non-violent.
// Birds don't fight: they out-sing, out-dazzle, out-fly and out-forage each other. Being outshone
// drains a bird's Spirit; at zero it flies off to rest. Strengths come from real biology.
import type { Species } from '../data/types';

// ─── the four styles (types) ───
export type Contest = 'song' | 'display' | 'sky' | 'forage';
export const CONTEST_IDS: Contest[] = ['song', 'display', 'sky', 'forage'];
/** Type chart, a simple loop: each style outshines the next one. */
export const BEATS: Record<Contest, Contest> = { song: 'display', display: 'sky', sky: 'forage', forage: 'song' };
export const BEAT_WHY: Record<Contest, string> = {
  song: 'A great song draws every eye away from plumage.',
  display: 'A dazzling display distracts a racer mid-flight.',
  sky: 'Fliers spot food from above and get there first.',
  forage: 'A busy forager ignores even the finest song.',
};

type Sheet = { src: string; frames: number; fw: number; fh: number };
export interface ContestDef { id: Contest; name: string; short: string; blurb: string; proj: Sheet; boom: Sheet; clip: 'tSong' | 'tDisplay' | 'tSky' | 'tForage'; color: string }
export const CONTESTS: Record<Contest, ContestDef> = {
  song: {
    id: 'song', name: 'Song', short: 'Song', blurb: 'Rich, varied song.', clip: 'tSong', color: 'var(--sun)',
    proj: { src: 'fx/trials/spell_wave_gold_proj.png', frames: 6, fw: 16, fh: 26 }, boom: { src: 'fx/trials/spell_gold_boom.png', frames: 8, fw: 40, fh: 40 },
  },
  display: {
    id: 'display', name: 'Display', short: 'Display', blurb: 'Plumage and courtship.', clip: 'tDisplay', color: 'var(--robin)',
    proj: { src: 'fx/trials/spell_orb_gold_proj.png', frames: 6, fw: 24, fh: 14 }, boom: { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 },
  },
  sky: {
    id: 'sky', name: 'Sky', short: 'Sky', blurb: 'Speed and agility in the air.', clip: 'tSky', color: 'var(--river)',
    proj: { src: 'fx/trials/windblade_proj.png', frames: 4, fw: 28, fh: 39 }, boom: { src: 'fx/trials/windblade_boom.png', frames: 3, fw: 28, fh: 39 },
  },
  forage: {
    id: 'forage', name: 'Forage', short: 'Forage', blurb: 'Clever food-finding.', clip: 'tForage', color: 'var(--moss)',
    proj: { src: 'fx/trials/leaf_proj.png', frames: 2, fw: 16, fh: 16 }, boom: { src: 'fx/trials/leaf_boom.png', frames: 7, fw: 48, fh: 48 },
  },
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
type StatSp = Pick<Species, 'id' | 'archetype' | 'family' | 'wingspanCm' | 'sizeCm'>;

/** A species' natural ability in a style, 10–99. */
export function contestStat(sp: StatSp, c: Contest): number {
  const fixed = BY_SPECIES[sp.id]?.[c];
  if (fixed != null) return fixed;
  const row = BY_ARCHETYPE[sp.archetype] ?? BY_ARCHETYPE.passerine;
  let v = row[CONTEST_IDS.indexOf(c)] + (BY_FAMILY[sp.family]?.[c] ?? 0);
  if (c === 'sky' && sp.wingspanCm) v += clamp((sp.wingspanCm - 35) / 8, -8, 8);
  return Math.round(clamp(v, 10, 99));
}
/** A bird's type: the style it is naturally best at (ties go in Song → Forage order). */
export function birdStyle(sp: StatSp): Contest {
  return [...CONTEST_IDS].sort((a, b) => contestStat(sp, b) - contestStat(sp, a))[0];
}
export const statStars = (v: number) => clamp(Math.round(v / 20), 1, 5);

// ─── moves ───
export type Effect = 'heal' | 'boost' | 'guard' | 'lower' | 'drain';
export interface Move { id: string; name: string; style: Contest; power: number; acc: number; pp: number; effect?: Effect; amount?: number; desc: string }
const M = (id: string, name: string, style: Contest, power: number, acc: number, pp: number, desc: string, effect?: Effect, amount?: number): Move => ({ id, name, style, power, acc, pp, desc, effect, amount });
export const MOVES: Record<string, Move> = Object.fromEntries([
  M('chirp', 'Chirp', 'song', 35, 100, 25, 'A bright, quick call.'),
  M('trill', 'Trill', 'song', 55, 95, 15, 'A rippling run of notes.'),
  M('dawnChorus', 'Dawn Chorus', 'song', 75, 90, 10, 'Sings like the first bird at sunrise.'),
  M('aria', 'Full Aria', 'song', 95, 80, 5, 'Every phrase it knows, at full voice.'),
  M('alarmCall', 'Alarm Call', 'song', 0, 100, 10, "A sharp alarm that rattles the rival's nerve.", 'lower', 1),
  M('crestFlare', 'Crest Flare', 'display', 35, 100, 25, 'Raises its crest with a flourish.'),
  M('plumageFan', 'Plumage Fan', 'display', 55, 95, 15, 'Spreads every feather in the light.'),
  M('iridescence', 'Iridescent Flash', 'display', 80, 85, 8, 'Turns so its colours shimmer.'),
  M('courtship', 'Courtship Dance', 'display', 0, 100, 8, 'A showy dance that sharply raises its flair.', 'boost', 2),
  M('swoop', 'Swoop', 'sky', 35, 100, 25, 'A low, fast pass.'),
  M('aerialLoop', 'Aerial Loop', 'sky', 55, 95, 15, 'A perfect loop-the-loop.'),
  M('stoopDive', 'Stoop Dive', 'sky', 90, 80, 6, 'A breathtaking high-speed dive.'),
  M('updraft', 'Updraft', 'sky', 0, 100, 10, 'Rides a thermal and steadies its nerve.', 'guard', 1),
  M('peck', 'Peck & Probe', 'forage', 35, 100, 25, 'Finds a snack in no time.'),
  M('seedSnatch', 'Seed Snatch', 'forage', 55, 95, 15, 'Grabs the best seed and gets a boost of Spirit.', 'drain', 3),
  M('cacheRaid', 'Cache Raid', 'forage', 80, 85, 8, 'Remembers a hidden stash and digs it up.'),
  M('preen', 'Preen', 'forage', 0, 100, 5, 'Tidies its feathers and recovers Spirit.', 'heal', 2),
].map((m) => [m.id, m]));

const LADDER: Record<Contest, string[]> = {
  song: ['chirp', 'trill', 'dawnChorus', 'aria'], display: ['crestFlare', 'plumageFan', 'iridescence', 'iridescence'],
  sky: ['swoop', 'aerialLoop', 'stoopDive', 'stoopDive'], forage: ['peck', 'seedSnatch', 'cacheRaid', 'cacheRaid'],
};
const SIGNATURE: Record<Contest, string> = { song: 'alarmCall', display: 'courtship', sky: 'updraft', forage: 'preen' };

/** A bird's four moves: two in its own style (stronger as it levels), one in its second style, one signature. */
export function movesFor(sp: StatSp, level: number): Move[] {
  const style = birdStyle(sp);
  const second = [...CONTEST_IDS].filter((c) => c !== style).sort((a, b) => contestStat(sp, b) - contestStat(sp, a))[0];
  const t = level < 10 ? 0 : level < 20 ? 1 : 2;
  const own = [LADDER[style][t], LADDER[style][t + 1]];
  const other = LADDER[second][Math.min(1, t)];
  return [...new Set([...own, other, SIGNATURE[style]])].map((id) => MOVES[id]);
}

// ─── contenders and fighters ───
export interface Contender { sp: Species; level: number; quality: number; parts?: number[]; sightingId?: string }
export interface Fighter {
  c: Contender; style: Contest; moves: Move[]; pp: Record<string, number>;
  maxSp: number; sp: number; boost: number; guard: number; out: boolean;
}
const avgStat = (sp: StatSp) => CONTEST_IDS.reduce((n, c) => n + contestStat(sp, c), 0) / 4;
export function fighter(c: Contender): Fighter {
  const lv = clamp(Math.round(c.level), 1, 50);
  const maxSp = Math.floor((avgStat(c.sp) * 2 * lv) / 100) + lv + 14;
  const moves = movesFor(c.sp, lv);
  return { c: { ...c, level: lv }, style: birdStyle(c.sp), moves, pp: Object.fromEntries(moves.map((m) => [m.id, m.pp])), maxSp, sp: maxSp, boost: 0, guard: 0, out: false };
}
const stage = (s: number) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
/** Attack value in a style: natural ability plus photo quality (better photos = stronger birds). */
const atk = (f: Fighter, s: Contest) => (contestStat(f.c.sp, s) + clamp(f.c.quality, 0, 100) / 8) * stage(f.boost);
const def = (f: Fighter) => (40 + avgStat(f.c.sp) * 0.6) * stage(f.guard);
export const speed = (f: Fighter) => contestStat(f.c.sp, 'sky') + f.c.level * 2;

/** 2 = super impressive, 0.5 = not very impressive. */
export const effectiveness = (move: Contest, target: Contest) => (BEATS[move] === target ? 2 : BEATS[target] === move ? 0.5 : 1);

export function estimate(a: Fighter, b: Fighter, m: Move): number {
  if (!m.power) return 0;
  const base = ((((2 * a.c.level) / 5 + 2) * m.power * atk(a, m.style)) / def(b)) / 50 + 2;
  return base * (m.style === a.style ? 1.25 : 1) * effectiveness(m.style, b.style);
}

// ─── battle ───
export type Side = 'you' | 'foe';
export type Item = 'seeds' | 'berries' | 'worms';
export const ITEMS: Record<Item, { name: string; desc: string }> = {
  seeds: { name: 'Seed Mix', desc: 'Restores 20 Spirit.' },
  berries: { name: 'Berry Mash', desc: 'Restores half of max Spirit.' },
  worms: { name: 'Mealworm Tub', desc: 'Fires your bird up: flair +2.' },
};
export type Action = { kind: 'move'; id: string } | { kind: 'switch'; to: number } | { kind: 'item'; item: Item } | { kind: 'run' };
export type Ev =
  | { t: 'msg'; text: string }
  | { t: 'use'; side: Side; move: Move }
  | { t: 'hit'; side: Side; style: Contest; eff: number; crit: boolean }
  | { t: 'miss'; side: Side }
  | { t: 'spirit'; side: Side; value: number; max: number }
  | { t: 'stat'; side: Side; up: boolean }
  | { t: 'heal'; side: Side }
  | { t: 'rest'; side: Side }
  | { t: 'send'; side: Side; index: number }
  | { t: 'end'; winner: Side };
export interface Battle { you: Fighter[]; foe: Fighter[]; yi: number; fi: number; turn: number; over: Side | null; foeName: string }

export function startBattle(you: Contender[], foe: Contender[], foeName: string): Battle {
  return { you: you.map(fighter), foe: foe.map(fighter), yi: 0, fi: 0, turn: 0, over: null, foeName };
}
const clone = (b: Battle): Battle => ({ ...b, you: b.you.map((f) => ({ ...f, pp: { ...f.pp } })), foe: b.foe.map((f) => ({ ...f, pp: { ...f.pp } })) });
const act = (b: Battle, s: Side) => (s === 'you' ? b.you[b.yi] : b.foe[b.fi]);
const other = (s: Side): Side => (s === 'you' ? 'foe' : 'you');
const who = (b: Battle, s: Side) => (s === 'you' ? act(b, s).c.sp.common : `${b.foeName}'s ${act(b, s).c.sp.common}`);
export const canSwitch = (b: Battle) => b.you.some((f, i) => i !== b.yi && !f.out);

function perform(b: Battle, side: Side, m: Move, rng: () => number, ev: Ev[]) {
  const a = act(b, side), d = act(b, other(side));
  a.pp[m.id] = Math.max(0, (a.pp[m.id] ?? m.pp) - 1);
  ev.push({ t: 'msg', text: `${who(b, side)} used ${m.name}!` }, { t: 'use', side, move: m });
  if (!m.power) {
    if (m.effect === 'heal') {
      const before = a.sp; a.sp = Math.min(a.maxSp, a.sp + Math.ceil(a.maxSp / (m.amount ?? 2)));
      ev.push({ t: 'heal', side }, { t: 'spirit', side, value: a.sp, max: a.maxSp }, { t: 'msg', text: a.sp > before ? `${who(b, side)} feels refreshed!` : `${who(b, side)} is already at full Spirit.` });
    } else if (m.effect === 'boost') {
      a.boost = clamp(a.boost + (m.amount ?? 1), -4, 4); ev.push({ t: 'stat', side, up: true }, { t: 'msg', text: `${who(b, side)}'s flair ${(m.amount ?? 1) > 1 ? 'rose sharply' : 'rose'}!` });
    } else if (m.effect === 'guard') {
      a.guard = clamp(a.guard + (m.amount ?? 1), -4, 4); ev.push({ t: 'stat', side, up: true }, { t: 'msg', text: `${who(b, side)} looks calm and steady!` });
    } else if (m.effect === 'lower') {
      d.boost = clamp(d.boost - (m.amount ?? 1), -4, 4); ev.push({ t: 'stat', side: other(side), up: false }, { t: 'msg', text: `${who(b, other(side))} lost some of its flair!` });
    }
    return;
  }
  if (rng() * 100 >= m.acc) { ev.push({ t: 'miss', side: other(side) }, { t: 'msg', text: `${who(b, other(side))} didn't even notice!` }); return; }
  const crit = rng() < 1 / 16;
  const eff = effectiveness(m.style, d.style);
  const dmg = Math.max(1, Math.floor(estimate(a, d, m) * (0.85 + rng() * 0.15) * (crit ? 1.5 : 1)));
  d.sp = Math.max(0, d.sp - dmg);
  ev.push({ t: 'hit', side: other(side), style: m.style, eff, crit }, { t: 'spirit', side: other(side), value: d.sp, max: d.maxSp });
  if (crit) ev.push({ t: 'msg', text: 'A show-stopping performance!' });
  if (eff > 1) ev.push({ t: 'msg', text: "It's super impressive!" });
  if (eff < 1) ev.push({ t: 'msg', text: "It's not very impressive..." });
  if (m.effect === 'drain') { const before = a.sp; a.sp = Math.min(a.maxSp, a.sp + Math.ceil(dmg / (m.amount ?? 3))); if (a.sp > before) ev.push({ t: 'spirit', side, value: a.sp, max: a.maxSp }); }
  if (d.sp === 0) { d.out = true; ev.push({ t: 'rest', side: other(side) }, { t: 'msg', text: `${who(b, other(side))} flew off to rest!` }); }
}

/** The rival's choice: usually its most impressive move, sometimes a status move, now and then a surprise. */
export function foeChoice(b: Battle, rng: () => number): Action {
  const f = act(b, 'foe'), y = act(b, 'you');
  const usable = f.moves.filter((m) => (f.pp[m.id] ?? 0) > 0);
  if (!usable.length) return { kind: 'move', id: f.moves[0].id };
  const heal = usable.find((m) => m.effect === 'heal');
  if (heal && f.sp < f.maxSp * 0.35 && rng() < 0.6) return { kind: 'move', id: heal.id };
  const status = usable.find((m) => (m.effect === 'boost' || m.effect === 'guard') && !m.power);
  if (status && b.turn < 2 && f.boost < 2 && f.guard < 2 && rng() < 0.3) return { kind: 'move', id: status.id };
  const scored = usable.filter((m) => m.power).map((m) => ({ m, v: estimate(f, y, m) * (m.acc / 100) * (0.8 + rng() * 0.4) }));
  if (!scored.length) return { kind: 'move', id: usable[0].id };
  scored.sort((p, q) => q.v - p.v);
  return { kind: 'move', id: scored[0].m.id };
}

function sendNextFoe(b: Battle, ev: Ev[]) {
  const next = b.foe.findIndex((f) => !f.out);
  if (next < 0) { b.over = 'you'; ev.push({ t: 'end', winner: 'you' }); return; }
  b.fi = next; ev.push({ t: 'send', side: 'foe', index: next }, { t: 'msg', text: `${b.foeName} sent out ${b.foe[next].c.sp.common}!` });
}

/** Resolve one turn. Returns the new battle and what happened, in order, for the UI to play. */
export function takeTurn(b0: Battle, mine: Action, rng: () => number): { b: Battle; ev: Ev[] } {
  const b = clone(b0); const ev: Ev[] = [];
  if (b.over) return { b, ev };
  b.turn++;
  if (mine.kind === 'run') { b.over = 'foe'; ev.push({ t: 'msg', text: 'You bowed out of the trial.' }, { t: 'end', winner: 'foe' }); return { b, ev }; }
  const theirs = foeChoice(b, rng);
  const youFirst = mine.kind !== 'move' || speed(act(b, 'you')) + rng() * 6 >= speed(act(b, 'foe')) + rng() * 6;
  // switching and items always happen before moves
  if (mine.kind === 'switch') {
    ev.push({ t: 'msg', text: `Come back, ${act(b, 'you').c.sp.common}!` });
    b.yi = mine.to; ev.push({ t: 'send', side: 'you', index: mine.to }, { t: 'msg', text: `Go, ${act(b, 'you').c.sp.common}!` });
  } else if (mine.kind === 'item') {
    const a = act(b, 'you'); ev.push({ t: 'msg', text: `You gave ${a.c.sp.common} some ${ITEMS[mine.item].name}.` });
    if (mine.item === 'worms') { a.boost = clamp(a.boost + 2, -4, 4); ev.push({ t: 'stat', side: 'you', up: true }, { t: 'msg', text: `${a.c.sp.common} is fired up! Its flair rose sharply!` }); }
    else { a.sp = Math.min(a.maxSp, a.sp + (mine.item === 'seeds' ? 20 : Math.ceil(a.maxSp / 2))); ev.push({ t: 'heal', side: 'you' }, { t: 'spirit', side: 'you', value: a.sp, max: a.maxSp }, { t: 'msg', text: `${a.c.sp.common} recovered some Spirit!` }); }
  }
  const order: Side[] = mine.kind === 'move' ? (youFirst ? ['you', 'foe'] : ['foe', 'you']) : ['foe'];
  for (const s of order) {
    if (b.over || act(b, s).out || act(b, other(s)).out) continue;
    const id = s === 'you' && mine.kind === 'move' ? mine.id : theirs.kind === 'move' ? theirs.id : act(b, s).moves[0].id;
    const m = act(b, s).moves.find((x) => x.id === id) ?? act(b, s).moves[0];
    perform(b, s, m, rng, ev);
  }
  if (act(b, 'foe').out) sendNextFoe(b, ev);
  if (!b.over && act(b, 'you').out && !canSwitch(b)) { b.over = 'foe'; ev.push({ t: 'end', winner: 'foe' }); }
  return { b, ev };
}

/** After your bird rests, you choose the next one (doesn't use a turn). */
export function sendIn(b0: Battle, to: number): { b: Battle; ev: Ev[] } {
  const b = clone(b0); b.yi = to;
  return { b, ev: [{ t: 'send', side: 'you', index: to }, { t: 'msg', text: `Go, ${b.you[to].c.sp.common}!` }] };
}

// ─── rivals ───
export interface RivalDef {
  id: string; name: string; title: string; line: string; win: string; lose: string;
  styles: Contest[];      // what their birds specialise in
  size: number;           // how many birds they bring
  level: number; quality: number; scene: string;
  coins: number; xp: number; merlin?: boolean;
}
export const RIVALS: RivalDef[] = [
  { id: 'pip', name: 'Pip', title: 'Backyard rookie', line: "My birds sing all morning. Bet yours can't keep up!", win: 'Whoa! Your birds are good!', lose: 'Ha! Told you my birds were the best!', styles: ['song'], size: 1, level: 3, quality: 30, scene: 'valley', coins: 25, xp: 40 },
  { id: 'wren', name: 'Wren', title: 'Dawn chorus fan', line: 'A good song beats bright feathers. Prove me wrong.', win: 'Fine, fine. That was a lovely performance.', lose: 'Listen to that chorus! Come back when you can match it.', styles: ['song', 'forage'], size: 2, level: 5, quality: 40, scene: 'pine', coins: 35, xp: 60 },
  { id: 'gale', name: 'Captain Gale', title: 'Shoreline racer', line: 'Out on the coast, it’s all about the wind.', win: 'You sailed right past me!', lose: 'The wind was on my side today.', styles: ['sky', 'forage'], size: 2, level: 8, quality: 48, scene: 'n3', coins: 45, xp: 80 },
  { id: 'mara', name: 'Mara', title: 'Plumage collector', line: 'Colour is everything. Show me your brightest!', win: 'Stunning. Absolutely stunning.', lose: 'Not quite bright enough, darling.', styles: ['display', 'song'], size: 3, level: 11, quality: 55, scene: 'n1', coins: 60, xp: 110 },
  { id: 'hawkins', name: 'Old Hawkins', title: 'Ridge watcher', line: 'Forty years on this ridge. My birds know every trick.', win: 'Well I never. You’ve got a real eye.', lose: 'Patience, young birder. Come back stronger.', styles: ['sky', 'display', 'forage'], size: 3, level: 14, quality: 62, scene: 'dusk', coins: 80, xp: 150 },
  { id: 'merlin', name: 'Professor Merlin', title: 'Grand finale', line: 'So, you’ve come this far. Show me what your birds can do!', win: 'Magnificent! You are a true birder.', lose: 'Not yet, my friend. Not yet.', styles: ['song', 'display', 'sky'], size: 3, level: 18, quality: 70, scene: 'nfb', coins: 120, xp: 250, merlin: true },
];

/** Rival levels keep pace with your team so later rivals stay a challenge. */
export function rivalLevel(r: RivalDef, tier: number, yourAvg: number): number {
  return Math.max(r.level, Math.round(yourAvg * (0.78 + tier * 0.05)));
}

/** Rival birds come from your region: the best local specialists in the rival's styles, no repeats. */
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

// ─── rewards ───
export const REMATCH = { coins: 5, xp: 15, perDay: 3 };
export interface TrialsState { cleared: number; wins: number; day?: string; rematches?: number }
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
