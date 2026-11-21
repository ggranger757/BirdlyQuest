import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
import { SPECIES_BY_ID } from '../src/data/species';
import {
  contestStat, power, playRound, matchWinner, bestLineup, rivalTeam, rewardFor, RIVALS, REMATCH, rng, CONTEST_IDS, type Contender,
} from '../src/core/trials';

const sp = (id: string) => SPECIES_BY_ID[id];
const bird = (id: string, level = 5, quality = 50): Contender => ({ sp: sp(id), level, quality });

describe('field trials: bird-true stats', () => {
  it('stats stay within 10–99 for every species and contest', () => {
    for (const s of Object.values(SPECIES_BY_ID)) for (const c of CONTEST_IDS) {
      const v = contestStat(s, c);
      expect(v, `${s.id} ${c}`).toBeGreaterThanOrEqual(10);
      expect(v, `${s.id} ${c}`).toBeLessThanOrEqual(99);
    }
  });
  it('each contest favours the birds that really excel at it', () => {
    expect(contestStat(sp('norcar'), 'display')).toBeGreaterThan(contestStat(sp('houspa'), 'display'));
    expect(contestStat(sp('wooduc'), 'display')).toBeGreaterThan(contestStat(sp('mallar'), 'display'));
    expect(contestStat(sp('rethaw'), 'sky')).toBeGreaterThan(contestStat(sp('amerob'), 'sky'));
    expect(contestStat(sp('amecro'), 'forage')).toBeGreaterThan(contestStat(sp('norcar'), 'forage'));
    expect(contestStat(sp('bkcchi'), 'forage')).toBeGreaterThan(contestStat(sp('moudov'), 'forage'));
    expect(contestStat(sp('amerob'), 'song')).toBeGreaterThan(contestStat(sp('rethaw'), 'song'));
    expect(contestStat(sp('amerob'), 'song')).toBeGreaterThan(contestStat(sp('rocpig'), 'song'));
  });
  it('training (level + photo quality) helps but never outweighs biology', () => {
    const pro = power(bird('houspa', 30, 100), 'display'), natural = power(bird('norcar', 1, 0), 'display');
    expect(natural).toBeGreaterThan(pro);
    expect(power(bird('houspa', 20, 90), 'display')).toBeGreaterThan(power(bird('houspa', 1, 10), 'display'));
  });
});

describe('field trials: matches', () => {
  it('rounds are scored, ties and criticals detected', () => {
    const r = playRound(bird('norcar'), bird('houspa'), 'display', rng(7));
    expect(r.winner).toBe('you');
    expect(r.you - r.rival).toBeGreaterThan(0);
    expect(r.critical).toBe(r.you - r.rival >= 25);
  });
  it('best of three, with the total as tie-break', () => {
    const R = (you: number, rival: number) => ({ contest: 'song' as const, you, rival, winner: (you === rival ? 'tie' : you > rival ? 'you' : 'rival') as 'you' | 'rival' | 'tie', critical: false });
    expect(matchWinner([R(60, 50), R(40, 50), R(70, 60)])).toBe('you');
    expect(matchWinner([R(60, 50), R(40, 70), R(55, 55)])).toBe('rival');
  });
  it('best lineup puts each bird where it shines and uses each bird once', () => {
    const team = [bird('norcar'), bird('amecro'), bird('rethaw')];
    const line = bestLineup(team, ['sky', 'display', 'forage']);
    expect(line.map((b) => b?.sp.id)).toEqual(['rethaw', 'norcar', 'amecro']);
    expect(bestLineup([bird('norcar')], ['song', 'sky', 'forage']).filter(Boolean)).toHaveLength(1);
  });
  it('rival teams come from the regional pool, specialised and without repeats', () => {
    const pool = Object.values(SPECIES_BY_ID).slice(0, 40);
    RIVALS.forEach((r, tier) => {
      const team = rivalTeam(r, pool, tier);
      expect(team).toHaveLength(3);
      expect(new Set(team.map((b) => b.sp.id)).size).toBe(3);
      for (const b of team) expect(pool).toContain(b.sp);
    });
  });
  it('the ladder gets harder', () => {
    for (let i = 1; i < RIVALS.length; i++) {
      expect(RIVALS[i].level).toBeGreaterThan(RIVALS[i - 1].level);
      expect(RIVALS[i].coins).toBeGreaterThan(RIVALS[i - 1].coins);
    }
    expect(RIVALS[RIVALS.length - 1].merlin).toBe(true);
  });
});

describe('field trials: rewards', () => {
  it('full prize the first time, then a small capped rematch bonus', () => {
    expect(rewardFor(undefined, 0, '2026-11-20')).toEqual({ coins: RIVALS[0].coins, xp: RIVALS[0].xp, first: true });
    expect(rewardFor({ cleared: 1, wins: 1 }, 0, '2026-11-20')).toEqual({ coins: REMATCH.coins, xp: REMATCH.xp, first: false });
    expect(rewardFor({ cleared: 1, wins: 4, day: '2026-11-20', rematches: REMATCH.perDay }, 0, '2026-11-20').coins).toBe(0);
    expect(rewardFor({ cleared: 1, wins: 4, day: '2026-11-19', rematches: REMATCH.perDay }, 0, '2026-11-20').coins).toBe(REMATCH.coins);
  });
});
