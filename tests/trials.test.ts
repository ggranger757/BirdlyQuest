import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { SPECIES_BY_ID } from '../src/data/species';
import {
  contestStat, birdStyle, movesFor, fighter, effectiveness, startBattle, takeTurn, sendIn, foeChoice, canSwitch,
  rivalTeam, rewardFor, RIVALS, REMATCH, rng, CONTEST_IDS, BEATS, type Contender, type Battle,
} from '../src/core/trials';

const sp = (id: string) => SPECIES_BY_ID[id];
const bird = (id: string, level = 10, quality = 50): Contender => ({ sp: sp(id), level, quality });

describe('field trials: bird-true stats', () => {
  it('stats stay within 10–99', () => {
    for (const s of Object.values(SPECIES_BY_ID)) for (const c of CONTEST_IDS) {
      expect(contestStat(s, c), `${s.id} ${c}`).toBeGreaterThanOrEqual(10);
      expect(contestStat(s, c), `${s.id} ${c}`).toBeLessThanOrEqual(99);
    }
  });
  it('birds get the style they are really known for', () => {
    expect(birdStyle(sp('norcar'))).toBe('display');
    expect(birdStyle(sp('wooduc'))).toBe('display');
    expect(birdStyle(sp('rethaw'))).toBe('sky');
    expect(birdStyle(sp('amecro'))).toBe('forage');
    expect(birdStyle(sp('bkcchi'))).toBe('forage');
    expect(birdStyle(sp('amerob'))).toBe('song');
  });
  it('the type chart is a loop: each style beats exactly one and loses to exactly one', () => {
    for (const c of CONTEST_IDS) {
      expect(effectiveness(c, BEATS[c])).toBe(2);
      expect(effectiveness(BEATS[c], c)).toBe(0.5);
      expect(effectiveness(c, c)).toBe(1);
    }
  });
  it('every bird has four distinct moves that grow stronger with level', () => {
    for (const s of Object.values(SPECIES_BY_ID)) {
      const m = movesFor(s, 5);
      expect(m.length, s.id).toBe(4);
      expect(new Set(m.map((x) => x.id)).size, s.id).toBe(4);
    }
    const lo = Math.max(...movesFor(sp('amerob'), 5).map((m) => m.power)), hi = Math.max(...movesFor(sp('amerob'), 25).map((m) => m.power));
    expect(hi).toBeGreaterThan(lo);
  });
  it('level and photo quality make a bird stronger', () => {
    expect(fighter(bird('amerob', 20)).maxSp).toBeGreaterThan(fighter(bird('amerob', 5)).maxSp);
  });
});

describe('field trials: battles', () => {
  const play = (b: Battle, seed: number) => {
    const r = rng(seed); let turns = 0;
    while (!b.over && turns < 80) {
      const me = b.you[b.yi];
      if (me.out) { const to = b.you.findIndex((f) => !f.out); ({ b } = sendIn(b, to)); continue; }
      const id = me.moves.filter((m) => m.power && (me.pp[m.id] ?? 0) > 0)[0]?.id ?? me.moves[0].id;
      ({ b } = takeTurn(b, { kind: 'move', id }, r)); turns++;
    }
    return { b, turns };
  };
  it('battles always end, and spirit never goes below zero', () => {
    for (let s = 1; s < 40; s++) {
      const { b, turns } = play(startBattle([bird('norcar'), bird('amecro'), bird('rethaw')], [bird('houspa'), bird('amerob'), bird('mallar')], 'Rival'), s);
      expect(b.over).toBeTruthy();
      expect(turns).toBeLessThanOrEqual(80);
      for (const f of [...b.you, ...b.foe]) expect(f.sp).toBeGreaterThanOrEqual(0);
    }
  });
  it('a battle between equals takes a satisfying number of turns', () => {
    let total = 0;
    for (let s = 1; s <= 30; s++) total += play(startBattle([bird('amerob')], [bird('amerob')], 'Rival'), s).turns;
    const avg = total / 30;
    expect(avg).toBeGreaterThanOrEqual(3);
    expect(avg).toBeLessThanOrEqual(8);
  });
  it('type advantage matters', () => {
    let wins = 0; // song (robin) vs display (cardinal): song is super impressive
    for (let s = 1; s <= 40; s++) if (play(startBattle([bird('amerob')], [bird('norcar')], 'Rival'), s).b.over === 'you') wins++;
    expect(wins).toBeGreaterThan(24);
  });
  it('switching, items and running work', () => {
    let b = startBattle([bird('norcar'), bird('amerob')], [bird('houspa')], 'Rival');
    const r = rng(3);
    ({ b } = takeTurn(b, { kind: 'switch', to: 1 }, r));
    expect(b.yi).toBe(1);
    b.you[1].sp = 5;
    const fed = takeTurn(b, { kind: 'item', item: 'berries' }, r);
    const healed = fed.ev.find((e) => e.t === 'spirit' && e.side === 'you');
    expect(healed && healed.t === 'spirit' ? healed.value : 0).toBeGreaterThan(5);
    b = fed.b;
    const run = takeTurn(b, { kind: 'run' }, r);
    expect(run.b.over).toBe('foe');
  });
  it('the rival uses real moves and switching needs a bird left', () => {
    const b = startBattle([bird('amerob')], [bird('amecro', 12)], 'Rival');
    const a = foeChoice(b, rng(5));
    expect(a.kind).toBe('move');
    expect(canSwitch(b)).toBe(false);
  });
});

describe('field trials: rivals and rewards', () => {
  it('rival teams come from the regional pool without repeats, and the ladder gets harder', () => {
    const pool = Object.values(SPECIES_BY_ID).slice(0, 40);
    RIVALS.forEach((r, tier) => {
      const team = rivalTeam(r, pool, tier, 10);
      expect(team).toHaveLength(r.size);
      expect(new Set(team.map((b) => b.sp.id)).size).toBe(r.size);
    });
    for (let i = 1; i < RIVALS.length; i++) expect(RIVALS[i].level).toBeGreaterThan(RIVALS[i - 1].level);
    expect(RIVALS[RIVALS.length - 1].merlin).toBe(true);
  });
  it('full prize the first time, then a small capped rematch bonus', () => {
    expect(rewardFor(undefined, 0, '2026-11-20')).toEqual({ coins: RIVALS[0].coins, xp: RIVALS[0].xp, first: true });
    expect(rewardFor({ cleared: 1, wins: 1 }, 0, '2026-11-20')).toEqual({ coins: REMATCH.coins, xp: REMATCH.xp, first: false });
    expect(rewardFor({ cleared: 1, wins: 4, day: '2026-11-20', rematches: REMATCH.perDay }, 0, '2026-11-20').coins).toBe(0);
  });
});
