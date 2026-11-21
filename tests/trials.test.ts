import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { SPECIES_BY_ID } from '../src/data/species';
import {
  contestStat, birdStyle, skillFor, fighter, startBattle, takeTurn, ambush, active, superReady, skillReady,
  rivalTeam, wildTeam, rewardFor, RIVALS, REMATCH, SKILLS, CONTEST_IDS, T, rng, type Contender, type Battle,
  TECHNIQUES, learnedBetween, nextUnlock, techReady, matchup, bondFor, ticketsOf, battleIsFree, TICKETS,
} from '../src/core/trials';

const sp = (id: string) => SPECIES_BY_ID[id];
const bird = (id: string, level = 10, quality = 50): Contender => ({ sp: sp(id), level, quality });

describe('field trials: birds are true to life', () => {
  it('stats stay within 10–99', () => {
    for (const s of Object.values(SPECIES_BY_ID)) for (const c of CONTEST_IDS) {
      expect(contestStat(s, c), `${s.id} ${c}`).toBeGreaterThanOrEqual(10);
      expect(contestStat(s, c), `${s.id} ${c}`).toBeLessThanOrEqual(99);
    }
  });
  it('each bird gets the style and signature skill it is known for', () => {
    expect(birdStyle(sp('norcar'))).toBe('display');
    expect(birdStyle(sp('amerob'))).toBe('song');
    expect(skillFor(sp('rethaw')).name).toBe('Falcon Stoop');
    expect(skillFor(sp('amecro')).name).toBe("Crow's Gambit");
    expect(skillFor(sp('bkcchi')).name).toBe('Hidden Cache');
    expect(skillFor(sp('mallar')).name).toBe('Aqua Shield');
    expect(skillFor(sp('norcar')).name).toBe('Prism Flash');
    expect(skillFor(sp('rocpig')).name).toBe('Homing Comet');
  });
  it('every species has a skill with a real-life fact, and short button labels', () => {
    for (const s of Object.values(SPECIES_BY_ID)) { const k = skillFor(s); expect(k, s.id).toBeTruthy(); expect(k.fact.length, s.id).toBeGreaterThan(20); }
    for (const k of Object.values(SKILLS)) { expect(k.tag.length, k.id).toBeLessThanOrEqual(30); expect(k.name.length, k.id).toBeLessThanOrEqual(15); }
  });
  it('level and photo quality make a bird stronger', () => {
    expect(fighter(bird('amerob', 20)).max).toBeGreaterThan(fighter(bird('amerob', 5)).max);
    expect(fighter(bird('amerob', 10, 90)).atk).toBeGreaterThan(fighter(bird('amerob', 10, 20)).atk);
  });
});

describe('field trials: battles', () => {
  const play = (b: Battle, seed: number) => {
    const r = rng(seed); let turns = 0;
    while (!b.over && turns < 60) {
      const a = superReady(b) ? { kind: 'super' as const } : b.foeCharging ? { kind: 'guard' as const } : skillReady(b) ? { kind: 'skill' as const } : { kind: 'quick' as const };
      ({ b } = takeTurn(b, a, r)); turns++;
    }
    return { b, turns };
  };
  it('battles always end, HP never goes below zero, and the next bird flies in automatically', () => {
    for (let s = 1; s < 40; s++) {
      const { b, turns } = play(startBattle([bird('norcar'), bird('amecro'), bird('rethaw')], [bird('houspa'), bird('amerob'), bird('mallar')], 'Rival'), s);
      expect(b.over).toBeTruthy();
      expect(turns).toBeLessThanOrEqual(60);
      for (const f of [...b.you, ...b.foe]) expect(f.hp).toBeGreaterThanOrEqual(0);
    }
  });
  it('a one-on-one between equals is quick: 2–7 taps', () => {
    let total = 0;
    for (let s = 1; s <= 30; s++) total += play(startBattle([bird('amerob')], [bird('amerob')], 'Rival'), s).turns;
    expect(total / 30).toBeGreaterThanOrEqual(2);
    expect(total / 30).toBeLessThanOrEqual(7);
  });
  it('Guard blocks most of an announced Big Move', () => {
    let b = startBattle([bird('amerob', 30)], [bird('amerob', 10)], 'Rival');
    ({ b } = takeTurn(b, { kind: 'guard' }, rng(1), { forceCharge: true }));
    expect(b.foeCharging).toBe(true);
    const guarded = takeTurn(b, { kind: 'guard' }, rng(2));
    const open = takeTurn(b, { kind: 'snack', item: 'seeds' }, rng(2));
    const hitG = guarded.ev.find((e) => e.t === 'dmg' && e.side === 'you'), hitO = open.ev.find((e) => e.t === 'dmg' && e.side === 'you');
    expect(hitG && hitG.t === 'dmg' && hitG.blocked).toBe(true);
    expect(hitG && hitO && hitG.t === 'dmg' && hitO.t === 'dmg' ? hitG.amount < hitO.amount : false).toBe(true);
  });
  it('the skill recharges and the Super gauge fills, then empties', () => {
    let b = startBattle([bird('amerob', 30)], [bird('amerob', 30)], 'Rival');
    ({ b } = takeTurn(b, { kind: 'skill' }, rng(3)));
    expect(skillReady(b)).toBe(false);
    ({ b } = takeTurn(b, { kind: 'guard' }, rng(3)));
    expect(skillReady(b)).toBe(true);
    b.gauge = 100;
    const r = takeTurn(b, { kind: 'super' }, rng(4));
    expect(r.b.gauge).toBe(0);
  });
  it('snacks heal and power up; running ends the trial', () => {
    let b = startBattle([bird('amerob')], [bird('houspa')], 'Rival');
    b.you[0].hp = 5;
    const fed = takeTurn(b, { kind: 'snack', item: 'berries' }, rng(5));
    expect(fed.ev.some((e) => e.t === 'heal' && e.side === 'you')).toBe(true);
    b = startBattle([bird('amerob', 30)], [bird('houspa', 3)], 'Rival');
    ({ b } = takeTurn(b, { kind: 'snack', item: 'worms' }, rng(5)));
    expect(active(b, 'you').fed).toBeGreaterThan(0);
    expect(takeTurn(b, { kind: 'run' }, rng(5)).b.over).toBe('foe');
  });
  it('an ambush lets the rival act first', () => {
    const r = ambush(startBattle([bird('amerob')], [bird('houspa')], 'Rival'), rng(6));
    expect(r.ev.some((e) => e.t === 'dmg' && e.side === 'you')).toBe(true);
  });
});

describe('field trials: rivals and rewards', () => {
  it('rival and wanderer teams come from the regional pool', () => {
    const pool = Object.values(SPECIES_BY_ID).slice(0, 40);
    RIVALS.forEach((r, tier) => {
      const team = rivalTeam(r, pool, tier, 10);
      expect(team).toHaveLength(r.size);
      expect(new Set(team.map((b) => b.sp.id)).size).toBe(r.size);
    });
    const w = wildTeam(pool, 8, rng(1), pool[0].id);
    expect(w).toHaveLength(1);
    expect(w[0].sp.id === pool[0].id).toBe(false);
    for (let i = 1; i < RIVALS.length; i++) { expect(RIVALS[i].level).toBeGreaterThan(RIVALS[i - 1].level); expect(RIVALS[i].time).toBeLessThanOrEqual(RIVALS[i - 1].time); }
  });
  it('full prize the first time, then a small capped rematch bonus', () => {
    expect(rewardFor(undefined, 0, '2026-11-20')).toEqual({ coins: RIVALS[0].coins, xp: RIVALS[0].xp, first: true });
    expect(rewardFor({ cleared: 1, wins: 1 }, 0, '2026-11-20')).toEqual({ coins: REMATCH.coins, xp: REMATCH.xp, first: false });
    expect(rewardFor({ cleared: 1, wins: 4, day: '2026-11-20', rematches: REMATCH.perDay }, 0, '2026-11-20').coins).toBe(0);
    expect(T.guardBlock).toBeGreaterThan(0.5);
  });
});

describe('field trials v1.25: growth, matchups, swap, bond, tickets', () => {
  it('birds learn moves as they level up', () => {
    const lv = (n: number) => fighter(bird('rethaw', n));
    expect(lv(11).tech).toBe(null);
    expect(lv(12).tech?.name).toBe(TECHNIQUES.sky.name);
    expect(lv(19).quick).toBe('Gale Wing');
    expect(lv(20).quick).not.toBe('Gale Wing');
    expect(lv(20).quickPow).toBeGreaterThan(1);
    expect(lv(29).skill.name).toBe('Falcon Stoop');
    expect(lv(30).skill.name).toBe('Falcon Stoop+');
    expect(lv(30).skill.power).toBeGreaterThan(lv(29).skill.power);
    expect(lv(40).superName).not.toBe(lv(39).superName);
    expect(learnedBetween(sp('rethaw'), 11, 12).map((u) => u.kind)).toEqual(['tech']);
    expect(nextUnlock(sp('rethaw'), 12)?.kind).toBe('quick');
    expect(nextUnlock(sp('rethaw'), 40)).toBe(null);
  });
  it('techniques work and recharge', () => {
    let b = startBattle([bird('bkcchi', 15)], [bird('amerob', 15)], 'Rival');
    expect(takeTurn(startBattle([bird('bkcchi', 5)], [bird('amerob', 5)], 'R'), { kind: 'tech' }, rng(1)).ev.some((e) => e.t === 'move')).toBe(false);
    b.you[0].hp = 10;
    const r = takeTurn(b, { kind: 'tech' }, rng(2));
    expect(r.ev.some((e) => e.t === 'heal' && e.side === 'you')).toBe(true);
    expect(techReady(r.b)).toBe(false);
  });
  it('style matchups: song > display > forage > sky > song', () => {
    expect(matchup('song', 'display')).toBe(1);
    expect(matchup('display', 'forage')).toBe(1);
    expect(matchup('forage', 'sky')).toBe(1);
    expect(matchup('sky', 'song')).toBe(1);
    expect(matchup('display', 'song')).toBe(-1);
    expect(matchup('song', 'forage')).toBe(0);
    // a strong matchup hits harder than a weak one with the same bird
    const dmg = (foe: string) => takeTurn(startBattle([bird('rethaw', 20)], [bird(foe, 20)], 'R'), { kind: 'quick' }, rng(9)).ev.find((e) => e.t === 'dmg' && e.side === 'foe');
    const strong = dmg('amerob'), weak = dmg('amecro');
    expect(birdStyle(sp('amerob'))).toBe('song');
    expect(birdStyle(sp('amecro'))).toBe('forage');
    expect(strong && weak && strong.t === 'dmg' && weak.t === 'dmg' ? strong.amount > weak.amount && strong.eff === 1 && weak.eff === -1 : false).toBe(true);
  });
  it('swapping uses your turn and brings in the chosen bird', () => {
    const b = startBattle([bird('amerob'), bird('rethaw')], [bird('houspa')], 'Rival');
    const r = takeTurn(b, { kind: 'swap', to: 1 }, rng(3));
    expect(r.b.yi).toBe(1);
    expect(r.ev.some((e) => e.t === 'recall')).toBe(true);
    expect(r.ev.some((e) => e.t === 'move' && e.side === 'foe')).toBe(true);
    expect(takeTurn(b, { kind: 'swap', to: 0 }, rng(3)).b).toBe(b); // can't swap to the bird already out
  });
  it('trainer Bond makes your birds stronger, capped at +30%', () => {
    expect(bondFor(1)).toBe(0);
    expect(Math.abs(bondFor(11) - 0.1) < 1e-9).toBe(true);
    expect(bondFor(80)).toBe(0.3);
    const a = startBattle([bird('amerob', 10)], [bird('houspa')], 'R'), c = startBattle([bird('amerob', 10)], [bird('houspa')], 'R', { bond: 0.2 });
    expect(c.you[0].max).toBeGreaterThan(a.you[0].max);
    expect(c.you[0].atk).toBeGreaterThan(a.you[0].atk);
  });
  it('Trial Tickets: start with 3, first battle is free', () => {
    expect(ticketsOf(undefined)).toBe(TICKETS.start);
    expect(ticketsOf({ cleared: 0, wins: 0, tickets: 0 })).toBe(0);
    expect(battleIsFree(undefined)).toBe(true);
    expect(battleIsFree({ cleared: 0, wins: 0, tutorial: true })).toBe(false);
  });
});
