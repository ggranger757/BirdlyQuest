import { describe, it, expect } from 'vitest';
import { encodeDuel, decodeDuel, duelLink } from '../src/core/duel';
import { qrEncode } from '../src/core/qr';

const card = { name: 'Sam 🐦', trainerLevel: 23, birds: [
  { id: 'norcar', level: 31, quality: 72, armor: 5, dye: 'gold', glow: 'cyan', parts: [3, 7, 12, 40, 2, 9, 9, 1, 0, 5, 33, 4, 4, 2, 7, 1, 8] },
  { id: 'inat-12345', level: 50, quality: 100, armor: 8 },
  { id: 'baleag', level: 12, quality: 40, armor: 0, dye: 'theme', glow: 'theme' },
] };

describe('friend duels (v1.38)', () => {
  it('a team survives the round trip through a code and a link', () => {
    const code = encodeDuel(card);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeDuel(duelLink(code, 'https://example.github.io/BirdlyQuest/#/aviary'));
    expect(back?.name).toBe('Sam 🐦');
    expect(back?.trainerLevel).toBe(23);
    expect(back?.birds.map((b) => [b.id, b.level, b.quality, b.armor, b.dye, b.glow])).toEqual([
      ['norcar', 31, 72, 5, 'gold', 'cyan'], ['inat-12345', 50, 100, 8, 'theme', 'theme'], ['baleag', 12, 40, 0, 'theme', 'theme']]);
    expect(back?.birds[0].parts).toEqual(card.birds[0].parts);
  });
  it('rejects damaged or foreign codes', () => {
    const code = encodeDuel(card);
    expect(decodeDuel(code.slice(0, -3) + 'AAA')).toBeNull();
    expect(decodeDuel('hello world')).toBeNull();
    expect(decodeDuel('')).toBeNull();
  });
  it('fits comfortably in a QR code', () => {
    const link = duelLink(encodeDuel(card), 'https://ggranger757.github.io/BirdlyQuest/');
    const m = qrEncode(new TextEncoder().encode(link));
    expect(m.length).toBeLessThanOrEqual(73); // version 14 or smaller
    expect(m.length % 4).toBe(1);
  });
});
