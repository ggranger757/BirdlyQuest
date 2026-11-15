// Optional network: weather (Open-Meteo, keyless) and reference photos (iNaturalist, keyless).
// Both use region centroids or scientific names only — never the player's position.
import { getRef, putRef } from './db';
import type { Region, Species } from '../data/types';
import type { Conditions } from '../core/rarity';

export interface Weather extends Conditions { label: string; fetchedAt: number }

const WMO: [number[], Conditions['weather'], string][] = [
  [[0, 1], 'clear', 'Clear'], [[2, 3], 'cloud', 'Cloudy'], [[45, 48], 'fog', 'Fog'],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'snow', 'Snow'], [[95, 96, 99], 'storm', 'Storm'],
];

export async function fetchWeather(r: Region): Promise<Weather | null> {
  const key = `wx:${r.code}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null') as Weather | null;
    if (cached && Date.now() - cached.fetchedAt < 3600e3) return cached;
  } catch { /* ignore */ }
  if (!navigator.onLine) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lng}&current=temperature_2m,weather_code&timezone=auto`, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.error || !j.current) return null; // quota exceeded or bad response: just show no weather
    const code = j.current?.weather_code as number;
    const m = WMO.find(([codes]) => codes.includes(code));
    const w: Weather = { weather: m?.[1] ?? 'cloud', label: m?.[2] ?? 'Mixed', tempC: Math.round(j.current?.temperature_2m), fetchedAt: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(w)); } catch { /* ignore */ }
    return w;
  } catch { return null; }
}

export interface RefPhoto { url: string; square: string; attribution: string; license: string; taxonUrl: string }

const LICENSES: Record<string, string> = {
  'cc0': 'CC0', 'cc-by': 'CC BY', 'cc-by-nc': 'CC BY-NC', 'cc-by-sa': 'CC BY-SA', 'cc-by-nd': 'CC BY-ND',
  'cc-by-nc-sa': 'CC BY-NC-SA', 'cc-by-nc-nd': 'CC BY-NC-ND',
};

const inflight = new Map<string, Promise<RefPhoto | null>>();

/** A Creative-Commons reference photo of the real species from iNaturalist (DAT-9: licence + attribution per asset). */
export function refPhoto(sp: Species): Promise<RefPhoto | null> {
  if (!sp.sci) return Promise.resolve(null);
  if (inflight.has(sp.id)) return inflight.get(sp.id)!;
  const key = `v2:${sp.id}`; // v2: older builds cached 'none' when only the default photo was unlicensed
  const p = (async () => {
    try {
      const cached = await getRef<RefPhoto | 'none' | { none: number }>(key);
      if (cached && typeof cached === 'object' && 'none' in cached) { if (Date.now() - cached.none < 7 * 864e5) return null; }
      else if (cached && cached !== 'none') return cached as RefPhoto;
    } catch { /* ignore */ }
    if (!navigator.onLine) return null;
    const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
    const make = (ph: any, taxonId: number): RefPhoto | null => {
      const lic = ph?.license_code as string | null;
      if (!ph || !lic || !LICENSES[lic] || !ph.url) return null;
      const base = String(ph.url);
      return { url: ph.medium_url ?? base.replace(/square|small|thumb/, 'medium'), square: ph.square_url ?? base.replace(/medium|small|thumb/, 'square'),
        attribution: ph.attribution ?? '', license: LICENSES[lic], taxonUrl: `https://www.inaturalist.org/taxa/${taxonId}` };
    };
    try {
      // 1) the species' own photos: the default first, then the rest of its gallery
      let id = sp.inatId;
      if (!id) {
        const j = await get(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sp.sci)}&rank=species&per_page=5`);
        const results: any[] = j.results ?? [];
        const exact = results.find((r) => r.name?.toLowerCase() === sp.sci.toLowerCase()) ?? results[0];
        if (!exact) throw new Error('no taxon');
        id = exact.id;
        const d = make(exact.default_photo, id!); if (d) { await putRef(key, d).catch(() => {}); return d; }
      }
      const t = (await get(`https://api.inaturalist.org/v1/taxa/${id}`)).results?.[0];
      let out = make(t?.default_photo, id!);
      for (const tp of t?.taxon_photos ?? []) { if (out) break; out = make(tp.photo, id!); }
      // 2) a Creative-Commons photo from a research-grade observation
      if (!out) {
        const o = await get(`https://api.inaturalist.org/v1/observations?taxon_id=${id}&quality_grade=research&photo_license=cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa,cc-by-nd,cc-by-nc-nd&order_by=votes&per_page=3`);
        for (const ob of o.results ?? []) { if (out) break; for (const ph of ob.photos ?? []) { out = make(ph, id!); if (out) break; } }
      }
      await putRef(key, out ?? { none: Date.now() }).catch(() => {});
      return out;
    } catch { return null; }
  })();
  inflight.set(sp.id, p);
  p.finally(() => setTimeout(() => inflight.delete(sp.id), 1000));
  return p;
}
