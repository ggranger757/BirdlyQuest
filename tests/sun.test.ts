import { describe, it, expect } from 'vitest';
import { sunTimes, dayPhase } from '../src/core/sun';
import { REGION_BY_CODE } from '../src/data/regions';
const at = (iso: string, code: string) => { const r = REGION_BY_CODE[code]; const d = new Date(iso); return dayPhase(d, sunTimes(d, r.lat, r.lng)); };
describe('sun phases across longitudes', () => {
  it('Illinois: mid-morning is daytime, 22:00 is night', () => {
    expect(['morning', 'day']).toContain(at('2026-05-14T10:30:00-05:00', 'US-IL'));
    expect(at('2026-05-14T22:30:00-05:00', 'US-IL')).toBe('night');
    expect(at('2026-05-14T19:45:00-05:00', 'US-IL')).toBe('golden');
  });
  it('Tokyo and Sydney noon are day; 02:00 is night', () => {
    expect(at('2026-01-10T12:00:00+09:00', 'JP-13')).toBe('day');
    expect(at('2026-01-10T02:00:00+09:00', 'JP-13')).toBe('night');
    expect(at('2026-07-10T13:00:00+10:00', 'AU-NSW')).toBe('day');
  });
  it('sunset follows sunrise on the same day', () => {
    for (const code of ['US-IL', 'GB', 'JP-13', 'AU-NSW', 'BR-SP', 'IN-DL']) {
      const r = REGION_BY_CODE[code]; const s = sunTimes(new Date('2026-03-20T12:00:00Z'), r.lat, r.lng);
      const len = (s.sunset.getTime() - s.sunrise.getTime()) / 3600e3;
      expect(len).toBeGreaterThan(11); expect(len).toBeLessThan(13.5);
    }
  });
});
