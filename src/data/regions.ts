import type { Region } from './types';

// v1 ships nine seed regions. Codes follow the eBird convention (DAT-2).
export const REGIONS: Region[] = [
  { code: 'US-IL', country: 'US', countryName: 'United States', name: 'Illinois', lat: 40.0, lng: -89.2, south: false, emblem: 'norcar', emblemLabel: 'State bird' },
  { code: 'CA-ON', country: 'CA', countryName: 'Canada', name: 'Ontario', lat: 44.5, lng: -79.5, south: false, emblem: 'comloo', emblemLabel: 'Provincial bird' },
  { code: 'GB', country: 'GB', countryName: 'United Kingdom', name: 'Great Britain', lat: 52.8, lng: -1.6, south: false, emblem: 'eurrob', emblemLabel: 'National bird (2015 vote)' },
  { code: 'DE-BE', country: 'DE', countryName: 'Germany', name: 'Berlin', lat: 52.52, lng: 13.4, south: false },
  { code: 'AU-NSW', country: 'AU', countryName: 'Australia', name: 'New South Wales', lat: -33.3, lng: 149.0, south: true, emblem: 'laukoo', emblemLabel: 'Bird emblem' },
  { code: 'IN-DL', country: 'IN', countryName: 'India', name: 'Delhi', lat: 28.65, lng: 77.2, south: false },
  { code: 'JP-13', country: 'JP', countryName: 'Japan', name: 'Tokyo', lat: 35.68, lng: 139.7, south: false, emblem: 'bkhgul', emblemLabel: 'Prefectural bird' },
  { code: 'BR-SP', country: 'BR', countryName: 'Brazil', name: 'São Paulo', lat: -23.0, lng: -47.5, south: true },
  { code: 'ZA-WC', country: 'ZA', countryName: 'South Africa', name: 'Western Cape', lat: -33.5, lng: 19.5, south: true },
];

export const REGION_BY_CODE: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.code, r]));

export function regionStamp(code: string): string {
  const r = REGION_BY_CODE[code];
  if (!r) return code;
  return r.code === r.country ? `${r.country} · ${r.name.toUpperCase()}` : `${r.country} · ${r.name.toUpperCase()}`;
}

/** Nearest seed region to a point. Coordinates are used once and discarded (PRV-1). */
export function nearestRegion(lat: number, lng: number): Region {
  let best = REGIONS[0], bestD = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(r.lat - lat, (r.lng - lng) * Math.cos((lat * Math.PI) / 180));
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

export function defaultRegionFromLocale(): string {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const cc = lang.split('-')[1]?.toUpperCase();
  const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
  if (tz.startsWith('Australia')) return 'AU-NSW';
  if (tz.startsWith('Asia/Tokyo')) return 'JP-13';
  if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) return 'IN-DL';
  if (tz.startsWith('America/Sao_Paulo')) return 'BR-SP';
  if (tz.startsWith('Africa/Johannesburg')) return 'ZA-WC';
  if (tz.startsWith('Europe/Berlin')) return 'DE-BE';
  if (tz.startsWith('Europe/London')) return 'GB';
  if (tz.startsWith('America/Toronto')) return 'CA-ON';
  const byCountry: Record<string, string> = { US: 'US-IL', CA: 'CA-ON', GB: 'GB', DE: 'DE-BE', AU: 'AU-NSW', IN: 'IN-DL', JP: 'JP-13', BR: 'BR-SP', ZA: 'ZA-WC' };
  return (cc && byCountry[cc]) || 'US-IL';
}
