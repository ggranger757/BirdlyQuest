// Every country and first-level subdivision (state / province / region).
// Data: countries-states-cities-database (ODbL), trimmed to code, name, centroid.
import type { Region } from './types';
import { REGION_BY_CODE as SEED_REGIONS } from './regions';

type CountryRow = [code: string, name: string, flag: string, lat: number, lng: number];
type StateRow = [iso: string, name: string, lat: number, lng: number];
interface Geo { countries: CountryRow[]; states: Record<string, StateRow[]> }

let geo: Geo | null = null;
let loading: Promise<Geo> | null = null;

export function loadGeo(): Promise<Geo> {
  if (geo) return Promise.resolve(geo);
  loading ??= import('./geo.json').then((m) => (geo = (m.default ?? m) as unknown as Geo));
  return loading;
}
export const geoReady = () => !!geo;

export interface Country { code: string; name: string; flag: string; lat: number; lng: number }
export interface State { code: string; iso: string; name: string; lat: number; lng: number }

export function countries(): Country[] {
  return (geo?.countries ?? []).map(([code, name, flag, lat, lng]) => ({ code, name, flag, lat, lng }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function statesOf(cc: string): State[] {
  return (geo?.states[cc] ?? []).map(([iso, name, lat, lng]) => ({ code: `${cc}-${iso}`, iso, name, lat, lng }));
}

function country(cc: string): Country | undefined {
  const r = geo?.countries.find((c) => c[0] === cc);
  return r && { code: r[0], name: r[1], flag: r[2], lat: r[3], lng: r[4] };
}

const cache = new Map<string, Region>();
/** Region for any code: "US-TX", "FR-IDF", "GB", … Seed regions keep their curated metadata. */
export function getRegion(code: string): Region {
  const hit = cache.get(code);
  if (hit) return hit;
  const seed = SEED_REGIONS[code];
  const [cc, iso] = code.split('-');
  const c = country(cc);
  const st = iso ? geo?.states[cc]?.find((s) => s[0] === iso) : undefined;
  let r: Region;
  if (st && c) r = { code, country: cc, countryName: c.name, name: st[1], lat: st[2], lng: st[3], south: st[2] < 0, flag: c.flag };
  else if (c) r = { code, country: cc, countryName: c.name, name: c.name, lat: c.lat, lng: c.lng, south: c.lat < 0, flag: c.flag };
  else if (seed) r = { ...seed };
  else r = { code, country: cc, countryName: cc, name: code, lat: 0, lng: 0, south: false };
  if (seed) r = { ...r, emblem: seed.emblem, emblemLabel: seed.emblemLabel, lat: seed.lat, lng: seed.lng };
  if (geo) cache.set(code, r);
  return r;
}

/** Nearest state/province to a point. Runs on the phone; the coordinates are not stored. */
export function nearestState(lat: number, lng: number): Region | null {
  if (!geo) return null;
  let best: { cc: string; row: StateRow } | null = null, bd = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  const dist = (a: number, b: number) => Math.sqrt((a - lat) ** 2 + ((b - lng) * k) ** 2);
  const cDist = new Map(geo.countries.map((c) => [c[0], dist(c[3], c[4])]));
  for (const [cc, rows] of Object.entries(geo.states)) {
    const cd = cDist.get(cc) ?? 99;
    if (cd > 45) continue;
    for (const row of rows) {
      // a state must be near the point AND belong to a country that is near too (guards bad centroids)
      const d = dist(row[2], row[3]) + 0.35 * cd;
      if (d < bd) { bd = d; best = { cc, row }; }
    }
  }
  return best ? getRegion(`${best.cc}-${best.row[0]}`) : null;
}

/** Exact state from a position via BigDataCloud's free client reverse-geocoder; falls back to nearestState. */
export async function locateState(lat: number, lng: number): Promise<Region | null> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&localityLanguage=en`, { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const sub = String(j.principalSubdivisionCode ?? ''); const cc = String(j.countryCode ?? '');
    if (sub && geo?.states[cc]?.some((s) => `${cc}-${s[0]}` === sub)) return getRegion(sub);
    if (cc && geo?.countries.some((c) => c[0] === cc)) {
      const near = nearestState(lat, lng);
      return near && near.country === cc ? near : getRegion(cc);
    }
  } catch { /* offline or blocked */ }
  return nearestState(lat, lng);
}

export function regionLabel(code: string): string {
  const r = getRegion(code);
  return r.name === r.countryName ? r.countryName : `${r.name}, ${r.countryName}`;
}

export function regionStamp(code: string): string {
  const r = getRegion(code);
  return r.name === r.countryName ? r.countryName.toUpperCase() : `${r.country} · ${r.name.toUpperCase()}`;
}

export function defaultRegionCode(): string {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const cc = lang.split('-')[1]?.toUpperCase();
  return cc && geo?.countries.some((c) => c[0] === cc) ? cc : 'US';
}
