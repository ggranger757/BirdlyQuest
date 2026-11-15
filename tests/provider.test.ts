import { describe, it, expect, beforeAll, vi } from 'vitest';
import { loadGeo, countries, statesOf, getRegion, nearestState, locateState } from '../src/data/geo';
import { planFor, speciesFromTaxon, regionEntries, ensureRegion, usingSeedFallback, nearbySightings } from '../src/data/provider';

vi.mock('../src/app/db', () => ({ getRef: async () => undefined, putRef: async () => {} }));
beforeAll(async () => { await loadGeo(); });

describe('geography: any country, any state', () => {
  it('has every country and the US states', () => {
    expect(countries().length).toBeGreaterThan(240);
    const us = statesOf('US').map((s) => s.name);
    for (const n of ['Texas', 'California', 'New York', 'Florida', 'Alaska', 'Illinois']) expect(us).toContain(n);
    expect(statesOf('FR').length).toBeGreaterThan(10);
  });
  it('resolves regions and nearest states', () => {
    expect(getRegion('US-TX').name).toBe('Texas');
    expect(getRegion('US-TX').countryName).toBe('United States');
    expect(getRegion('BR').name).toBe('Brazil');
    expect(nearestState(30.27, -97.74)?.code).toBe('US-TX'); // Austin
    expect(nearestState(29.76, -95.37)?.country).toBe('US'); // Houston: right country even near a border
    expect(nearestState(48.85, 2.35)?.code.startsWith('FR-')).toBe(true); // Paris
  });
  it('uses the reverse geocoder for an exact state', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ countryCode: 'US', principalSubdivisionCode: 'US-TX' }) })) as any;
    expect((await locateState(29.76, -95.37))?.code).toBe('US-TX');
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as any;
    expect((await locateState(30.27, -97.74))?.code).toBe('US-TX');
  });
});

describe('species provider', () => {
  it('derives anatomy from bird names', () => {
    expect(planFor('Great Blue Heron', 'Ardea herodias').archetype).toBe('wader');
    expect(planFor('Barn Owl', 'Tyto alba').archetype).toBe('owl');
    expect(planFor('Mallard', 'Anas platyrhynchos').archetype).toBe('waterfowl');
    expect(planFor('Red-shouldered Hawk', 'Buteo lineatus').archetype).toBe('raptor');
    expect(planFor('Anna\'s Hummingbird', 'Calypte anna').archetype).toBe('hummingbird');
    expect(planFor('Monk Parakeet', 'Myiopsitta monachus').archetype).toBe('parrot');
    expect(planFor('Carolina Wren', 'Thryothorus ludovicianus').archetype).toBe('passerine');
  });
  it('maps iNaturalist taxa onto curated species when they match', () => {
    expect(speciesFromTaxon({ id: 12727, name: 'Turdus migratorius', preferred_common_name: 'American Robin' }).id).toBe('amerob');
    const live = speciesFromTaxon({ id: 9083, name: 'Mimus polyglottos', preferred_common_name: 'northern mockingbird', default_photo: { square_url: 'x', license_code: 'cc-by' } });
    expect(live.id).toBe('inat-9083'); expect(live.common).toBe('Northern Mockingbird'); expect(live.photo).toBe('x');
  });
  it('falls back to the nearest curated list offline, then uses the live list', async () => {
    expect(usingSeedFallback('US-TX')).toBe('US-IL');
    expect(regionEntries('US-TX').length).toBeGreaterThan(20);
    const counts = { results: [
      { count: 900, taxon: { id: 9083, name: 'Mimus polyglottos', preferred_common_name: 'Northern Mockingbird' } },
      { count: 500, taxon: { id: 12727, name: 'Turdus migratorius', preferred_common_name: 'American Robin' } },
      { count: 20, taxon: { id: 19893, name: 'Strix varia', preferred_common_name: 'Barred Owl' } },
    ] };
    vi.stubGlobal('navigator', { onLine: true, language: 'en-US' });
    globalThis.fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => (String(url).includes('places') ? { results: [{ id: 18, name: 'Texas', display_name: 'Texas, US', admin_level: 10 }] } : counts) })) as any;
    await ensureRegion('US-TX', true);
    const e = regionEntries('US-TX');
    expect(usingSeedFallback('US-TX')).toBeNull();
    expect(e.map((x) => x.sp.common)).toEqual(['Northern Mockingbird', 'American Robin', 'Barred Owl']);
    expect(e[0].dex).toBe(1);
    expect(e[2].sp.archetype).toBe('owl');
    expect(e[2].sp.sensitive).toBe(true);
    expect(String((globalThis.fetch as any).mock.calls[1][0])).toContain('place_id=18');
  });

  it('pins ordinary sightings (taxon_geoprivacy "open") and hides private, obscured and sensitive ones', async () => {
    const obs = (id: number, name: string, common: string, extra: object = {}) => ({ id, observed_on: '2026-11-14', geojson: { coordinates: [-97.7, 30.2] }, obscured: false, taxon: { id, name, preferred_common_name: common }, ...extra });
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ results: [
      obs(1, 'Poecile carolinensis', 'Carolina Chickadee', { taxon_geoprivacy: 'open' }),
      obs(2, 'Egretta thula', 'Snowy Egret', { taxon_geoprivacy: null }),
      obs(3, 'Tringa solitaria', 'Solitary Sandpiper', { taxon_geoprivacy: 'obscured', obscured: true }),
      obs(4, 'Buteo jamaicensis', 'Red-tailed Hawk', { taxon_geoprivacy: 'open' }),
      obs(5, 'Zenaida asiatica', 'White-winged Dove', { geoprivacy: 'private' }),
    ] }) })) as any;
    const r = await nearbySightings(30.27, -97.74);
    expect(r.list.map((o) => o.sp.common)).toEqual(['Carolina Chickadee', 'Snowy Egret']);
    expect(r.hidden).toBe(3); // obscured sandpiper, sensitive hawk, private dove
  });
});
