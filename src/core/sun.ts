// NOAA-style sunrise/sunset approximation. Uses the region centroid, never the player's position.
const rad = Math.PI / 180;

export interface SunTimes { sunrise: Date; sunset: Date; dawn: Date; dusk: Date }

/** UT hour of a solar event on day-of-year N (NOAA approximation), or null for polar day/night. */
function solarEventUT(N: number, lat: number, lng: number, zenith: number, rising: boolean): number | null {
  const lngHour = lng / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
  L = (L + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = (RA + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  const H = (rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  return (((T - lngHour) % 24) + 24) % 24;
}

/**
 * Sun times for the region's local calendar day containing `date`. Each event is placed on the
 * 24h cycle nearest its expected side of solar noon, so sunsets past UTC midnight land correctly.
 */
export function sunTimes(date: Date, lat: number, lng: number): SunTimes {
  const local = new Date(date.getTime() + (lng / 15) * 3600e3); // region's mean solar time
  const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const N = Math.floor((base - Date.UTC(local.getUTCFullYear(), 0, 0)) / 864e5);
  const noon = base + (12 - lng / 15) * 3600e3;
  const place = (ut: number | null, offsetH: number) => {
    const target = noon + offsetH * 3600e3;
    if (ut === null) return new Date(target);
    let best = 0, bd = Infinity;
    for (const k of [-1, 0, 1]) { const v = base + k * 864e5 + ut * 3600e3; if (Math.abs(v - target) < bd) { bd = Math.abs(v - target); best = v; } }
    return new Date(best);
  };
  return {
    sunrise: place(solarEventUT(N, lat, lng, 90.833, true), -6),
    sunset: place(solarEventUT(N, lat, lng, 90.833, false), 6),
    dawn: place(solarEventUT(N, lat, lng, 96, true), -6.5),
    dusk: place(solarEventUT(N, lat, lng, 96, false), 6.5),
  };
}

export type DayPhase = 'night' | 'dawn' | 'morning' | 'day' | 'golden' | 'dusk';

export function dayPhase(now: Date, s: SunTimes): DayPhase {
  const t = now.getTime();
  if (t < s.dawn.getTime() || t > s.dusk.getTime()) return 'night';
  if (t < s.sunrise.getTime() + 40 * 60e3) return 'dawn';
  if (t < s.sunrise.getTime() + 3 * 3600e3) return 'morning';
  if (t < s.sunset.getTime() - 3600e3) return 'day';
  if (t < s.sunset.getTime()) return 'golden';
  return 'dusk';
}
