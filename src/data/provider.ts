// SpeciesDataProvider (DAT-3): curated seed species + live regional lists from iNaturalist.
// The UI only ever sees normalised `Species` + `RegionEntry` objects.
import type { Species, Habitat, Look } from './types';
import type { Archetype, Shape } from '../core/pixel/archetypes';
import { SPECIES, SPECIES_BY_ID } from './species';
import { REGION_BY_CODE as SEED_REGIONS } from './regions';
import { getRegion } from './geo';
import { getRef, putRef } from '../app/db';

export interface RegionEntry {
  sp: Species;
  freq: number;      // 0–1 how often it is recorded in the region (all year)
  seasonal: number;  // 0–1 how present it is this month
  count?: number;    // research-grade observations (live data)
  dex: number;       // regional BirdDex number
}

export type ProviderStatus = 'idle' | 'loading' | 'live' | 'cached' | 'seed' | 'offline' | 'error';

// ─── registry of every species the app knows (seed + live + caught) ───
const dynamic = new Map<string, Species>();
export function speciesById(id: string | null | undefined): Species | undefined {
  if (!id) return undefined;
  return SPECIES_BY_ID[id] ?? dynamic.get(id);
}
export function registerSpecies(list: Species[]) { for (const s of list) if (!SPECIES_BY_ID[s.id]) dynamic.set(s.id, s); }
export function allKnownSpecies(): Species[] { return [...SPECIES, ...dynamic.values()]; }

// ─── body plan from the bird's name (live species have no curated anatomy) ───
interface Plan { archetype: Archetype; family: string; familyName: string; order: string; shape?: Partial<Shape>; habitats: Habitat[]; activity?: Species['activity']; sensitive?: boolean }
const RULES: [RegExp, Plan][] = [
  [/\bowl(et)?\b/i, { archetype: 'owl', family: 'Strigidae', familyName: 'Owls', order: 'Strigiformes', habitats: ['woodland'], activity: 'nocturnal', sensitive: true }],
  [/nightjar|nighthawk|poorwill|whip-poor-will|potoo/i, { archetype: 'owl', family: 'Caprimulgidae', familyName: 'Nightjars', order: 'Caprimulgiformes', habitats: ['woodland'], activity: 'nocturnal', shape: { brx: 7.5, bry: 5, hr: 4.5 } }],
  [/eagle|hawk|kite|buzzard|harrier|osprey|vulture|condor|goshawk|sparrowhawk|accipiter/i, { archetype: 'raptor', family: 'Accipitridae', familyName: 'Hawks, eagles and kites', order: 'Accipitriformes', habitats: ['woodland', 'urban'], sensitive: true }],
  [/falcon|kestrel|merlin|hobby|caracara/i, { archetype: 'raptor', family: 'Falconidae', familyName: 'Falcons', order: 'Falconiformes', habitats: ['urban', 'woodland'], sensitive: true, shape: { brx: 5, bry: 6.5, hr: 3.6 } }],
  [/hummingbird|hermit\b(?! thrush| warbler)|sunangel|woodstar|emerald|sapphire|brilliant|mango|violetear|sylph|coquette/i, { archetype: 'hummingbird', family: 'Trochilidae', familyName: 'Hummingbirds', order: 'Apodiformes', habitats: ['urban', 'woodland'] }],
  [/swift\b/i, { archetype: 'hummingbird', family: 'Apodidae', familyName: 'Swifts', order: 'Apodiformes', habitats: ['urban'], shape: { beak: 'cone', beakLen: 2, brx: 5.5, wingSpan: 13 } }],
  [/parrot|parakeet|macaw|lorikeet|lorikeet|cockatoo|cockatiel|conure|lovebird|amazon|galah|corella|rosella|budgerigar/i, { archetype: 'parrot', family: 'Psittacidae', familyName: 'Parrots', order: 'Psittaciformes', habitats: ['urban', 'woodland'] }],
  [/kingfisher|kookaburra/i, { archetype: 'kingfisher', family: 'Alcedinidae', familyName: 'Kingfishers', order: 'Coraciiformes', habitats: ['water', 'woodland'] }],
  [/woodpecker|flicker|sapsucker|wryneck|piculet|barbet|toucan(et)?/i, { archetype: 'woodpecker', family: 'Picidae', familyName: 'Woodpeckers', order: 'Piciformes', habitats: ['woodland'] }],
  [/\b(crow|raven|jay|magpie|jackdaw|rook|nutcracker|chough|treepie)\b/i, { archetype: 'corvid', family: 'Corvidae', familyName: 'Crows and jays', order: 'Passeriformes', habitats: ['urban', 'woodland'] }],
  [/\b(swan|goose|duck|teal|wigeon|mallard|pintail|shoveler|gadwall|scaup|eider|scoter|merganser|goldeneye|bufflehead|pochard|canvasback|redhead|whistling-duck|shelduck)\b/i, { archetype: 'waterfowl', family: 'Anatidae', familyName: 'Ducks, geese and swans', order: 'Anseriformes', habitats: ['water'] }],
  [/\b(grebe|loon|diver|coot|moorhen|gallinule)\b/i, { archetype: 'waterfowl', family: 'Rallidae', familyName: 'Rails, coots and grebes', order: 'Gruiformes', habitats: ['water'], shape: { beak: 'dagger', beakLen: 3, neck: 3 } }],
  [/\b(heron|egret|bittern|ibis|spoonbill|stork|crane|flamingo)\b/i, { archetype: 'wader', family: 'Ardeidae', familyName: 'Herons, ibises and allies', order: 'Pelecaniformes', habitats: ['water'] }],
  [/plover|lapwing|killdeer|sandpiper|stint|dunlin|sanderling|knot|curlew|godwit|whimbrel|yellowlegs|dowitcher|snipe|woodcock|phalarope|turnstone|oystercatcher|avocet|stilt|dotterel|ruff|tattler|willet|greenshank|redshank/i,
    { archetype: 'wader', family: 'Scolopacidae', familyName: 'Shorebirds', order: 'Charadriiformes', habitats: ['water'], shape: { neck: 1, hy: 11, hx: 19.5, hr: 3.4, legLen: 7, beak: 'needle', beakLen: 3, by: 18 } }],
  [/\b(gull|tern|kittiwake|skua|jaeger|noddy|skimmer)\b/i, { archetype: 'seabird', family: 'Laridae', familyName: 'Gulls and terns', order: 'Charadriiformes', habitats: ['water', 'urban'] }],
  [/pelican|cormorant|shag|albatross|petrel|shearwater|gannet|booby|frigatebird|puffin|auk|guillemot|murre|penguin|anhinga|darter/i, { archetype: 'seabird', family: 'Seabirds', familyName: 'Seabirds', order: 'Suliformes', habitats: ['water'] }],
  [/quail|pheasant|grouse|turkey|partridge|guineafowl|francolin|chachalaca|junglefowl|peafowl|ptarmigan|spurfowl|chicken|bobwhite|tinamou/i, { archetype: 'gamebird', family: 'Phasianidae', familyName: 'Gamebirds', order: 'Galliformes', habitats: ['woodland'] }],
  [/\b(rail|crake|bustard|roadrunner)\b/i, { archetype: 'gamebird', family: 'Rallidae', familyName: 'Rails and allies', order: 'Gruiformes', habitats: ['water', 'woodland'], shape: { legLen: 6, beak: 'dagger', beakLen: 4 } }],
  [/\b(dove|pigeon)\b/i, { archetype: 'passerine', family: 'Columbidae', familyName: 'Pigeons and doves', order: 'Columbiformes', habitats: ['urban'], shape: { hr: 3.3, beak: 'needle', beakLen: 2, tail: 'long', tailLen: 9 } }],
  [/cuckoo|koel|coucal|ani\b/i, { archetype: 'passerine', family: 'Cuculidae', familyName: 'Cuckoos', order: 'Cuculiformes', habitats: ['woodland'], shape: { tail: 'long', tailLen: 11 } }],
  [/sunbird|honeyeater|spiderhunter/i, { archetype: 'passerine', family: 'Nectariniidae', familyName: 'Sunbirds and honeyeaters', order: 'Passeriformes', habitats: ['urban', 'woodland'], shape: { beak: 'decurved', beakLen: 4.5, brx: 5, bry: 4, hr: 3.4 } }],
  [/warbler|chiffchaff|blackcap|whitethroat|yellowthroat|redstart|parula|ovenbird|waterthrush/i, { archetype: 'passerine', family: 'Parulidae', familyName: 'Warblers', order: 'Passeriformes', habitats: ['woodland'], shape: { beak: 'needle', beakLen: 2.5, brx: 5.5, bry: 4.5 } }],
  [/wren\b|fairywren/i, { archetype: 'passerine', family: 'Troglodytidae', familyName: 'Wrens', order: 'Passeriformes', habitats: ['woodland', 'urban'], shape: { tail: 'cocked', tailAngle: 215, tailLen: 5, brx: 5.5, bry: 4.5, beak: 'needle', beakLen: 2.5 } }],
  [/swallow|martin|swiftlet/i, { archetype: 'passerine', family: 'Hirundinidae', familyName: 'Swallows', order: 'Passeriformes', habitats: ['urban', 'water'], shape: { tail: 'forked', tailLen: 9, beak: 'cone', beakLen: 1.5, wingSpan: 13 } }],
  [/flycatcher|kingbird|phoebe|pewee|tyrant|kiskadee|fantail|drongo/i, { archetype: 'passerine', family: 'Tyrannidae', familyName: 'Flycatchers', order: 'Passeriformes', habitats: ['woodland', 'urban'], shape: { beak: 'stout', beakLen: 3 } }],
  [/finch|sparrow|bunting|grosbeak|seedeater|canary|siskin|redpoll|junco|towhee|cardinal|weaver|munia|waxbill/i, { archetype: 'passerine', family: 'Fringillidae', familyName: 'Finches and sparrows', order: 'Passeriformes', habitats: ['urban'] }],
  [/thrush|robin|blackbird|bluebird|nightingale|chat\b|wheatear|solitaire/i, { archetype: 'passerine', family: 'Turdidae', familyName: 'Thrushes', order: 'Passeriformes', habitats: ['urban', 'woodland'], shape: { beak: 'needle', beakLen: 2.5 } }],
  [/\btit\b|chickadee|titmouse|nuthatch|creeper/i, { archetype: 'passerine', family: 'Paridae', familyName: 'Tits and nuthatches', order: 'Passeriformes', habitats: ['woodland', 'urban'], shape: { hr: 4.2, beakLen: 2 } }],
  [/starling|myna|grackle|cowbird|oriole|meadowlark|bobolink|icterid/i, { archetype: 'passerine', family: 'Sturnidae', familyName: 'Starlings and blackbirds', order: 'Passeriformes', habitats: ['urban'], shape: { beak: 'dagger', beakLen: 3.5 } }],
  [/wagtail|pipit|lark\b|longclaw/i, { archetype: 'passerine', family: 'Motacillidae', familyName: 'Wagtails and larks', order: 'Passeriformes', habitats: ['urban', 'water'], shape: { tail: 'long', tailLen: 11, tailAngle: 165, beak: 'needle', beakLen: 2.5 } }],
  [/hoopoe|bee-eater|roller|hornbill|trogon|motmot|mousebird/i, { archetype: 'kingfisher', family: 'Coraciidae', familyName: 'Rollers and allies', order: 'Coraciiformes', habitats: ['woodland'], shape: { hr: 4, beakLen: 5, tail: 'long', tailLen: 9 } }],
];
const DEFAULT_PLAN: Plan = { archetype: 'passerine', family: 'Passeriformes', familyName: 'Songbirds', order: 'Passeriformes', habitats: ['urban', 'woodland'] };

export function planFor(common: string, sci: string): Plan {
  for (const [re, plan] of RULES) if (re.test(common)) return plan;
  for (const [re, plan] of RULES) if (re.test(sci)) return plan;
  return DEFAULT_PLAN;
}

// Neutral default plumage per archetype: the player's photo supplies the real colours.
const LOOKS: Record<Archetype, Look> = {
  passerine: { head: 'smoke', back: 'bark', wing: 'umber', belly: 'stone', beak: 'slate', legs: 'umber' },
  corvid: { head: 'plum', back: 'plum', wing: 'slate', belly: 'plum', beak: 'ink', legs: 'ink' },
  raptor: { head: 'bark', back: 'umber', wing: 'umber', belly: 'belly', beak: 'slate', legs: 'sun' },
  owl: { head: 'bark', back: 'bark', wing: 'umber', belly: 'stone', beak: 'stone', legs: 'stone', cheek: 'stone', mask: ['bold', 'sun'] },
  waterfowl: { head: 'umber', back: 'ash', wing: 'smoke', belly: 'stone', beak: 'olive', legs: 'amber' },
  wader: { head: 'stone', back: 'ash', wing: 'smoke', belly: 'cream', beak: 'warbler', legs: 'olive' },
  seabird: { head: 'cream', back: 'stone', wing: 'ash', belly: 'cream', beak: 'warbler', legs: 'warbler' },
  woodpecker: { head: 'cream', crown: 'ink', nape: 'brick', back: 'ink', wing: 'ink', belly: 'cream', beak: 'slate', legs: 'slate', patternLight: true },
  hummingbird: { head: 'fern', back: 'fern', wing: 'slate', belly: 'cream', beak: 'ink', legs: 'ink' },
  gamebird: { head: 'bark', back: 'bark', wing: 'umber', belly: 'stone', beak: 'slate', legs: 'smoke' },
  parrot: { head: 'moss', back: 'fern', wing: 'fern', belly: 'lichen', beak: 'stone', legs: 'slate' },
  kingfisher: { head: 'ocean', back: 'ocean', wing: 'river', belly: 'rust', beak: 'ink', legs: 'oriole' },
};

interface InatTaxon {
  id: number; name: string; rank?: string; preferred_common_name?: string; english_common_name?: string;
  default_photo?: { square_url?: string; medium_url?: string; attribution?: string; license_code?: string | null };
  wikipedia_summary?: string;
}

export function speciesFromTaxon(t: InatTaxon): Species {
  const common = t.preferred_common_name || t.english_common_name || t.name;
  const titled = common.replace(/(^|[\s-])([a-z])/g, (_m, a, b) => a + b.toUpperCase());
  const plan = planFor(titled, t.name);
  const seed = SPECIES.find((s) => s.sci.toLowerCase() === t.name.toLowerCase());
  if (seed) return seed;
  return {
    id: `inat-${t.id}`, common: titled, sci: t.name, family: plan.family, familyName: plan.familyName, order: plan.order,
    archetype: plan.archetype, pattern: 'solid', look: LOOKS[plan.archetype], shape: plan.shape, habitats: plan.habitats,
    sizeCm: 0, fact: '', activity: plan.activity ?? 'diurnal', sensitive: plan.sensitive, occ: {}, inatId: t.id,
    photo: t.default_photo?.license_code ? t.default_photo.square_url : undefined,
    summary: t.wikipedia_summary ? stripHtml(t.wikipedia_summary).slice(0, 280) : undefined,
  };
}
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ─── regional lists ───
interface Cached { at: number; place?: number; year: [number, number][]; month: Record<number, [number, number][]>; taxa: Species[] }
const memory = new Map<string, Cached>();
const status = new Map<string, ProviderStatus>();
const listeners = new Set<() => void>();
export function onProviderChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const emit = () => listeners.forEach((f) => f());
export const providerStatus = (code: string): ProviderStatus => status.get(code) ?? 'idle';

const seedFor = (code: string) => (SEED_REGIONS[code] ? code : SEED_REGIONS[code.split('-')[0]] ? code.split('-')[0] : null);

function nearestSeed(code: string): string {
  const r = getRegion(code);
  let best = 'US-IL', bd = Infinity;
  for (const s of Object.values(SEED_REGIONS)) {
    const d = (s.lat - r.lat) ** 2 + ((s.lng - r.lng) * Math.cos((r.lat * Math.PI) / 180)) ** 2;
    if (d < bd) { bd = d; best = s.code; }
  }
  return best;
}

function seasonalIndexOf(season: string, month: number, south: boolean): number {
  const m = south ? (month + 6) % 12 : month;
  switch (season) {
    case 'S': return [0.1, 0.1, 0.35, 0.8, 1, 1, 1, 1, 0.85, 0.5, 0.15, 0.1][m];
    case 'W': return [1, 1, 0.8, 0.35, 0.05, 0.02, 0.02, 0.05, 0.2, 0.6, 0.9, 1][m];
    case 'M': return [0.05, 0.05, 0.3, 0.9, 1, 0.3, 0.1, 0.3, 0.9, 0.8, 0.3, 0.05][m];
  }
  return 1;
}

/** Everything known for a region right now: live list if cached, else curated seed (exact or nearest). */
export function regionEntries(code: string, now = new Date()): RegionEntry[] {
  const r = getRegion(code);
  const live = memory.get(code);
  const out: RegionEntry[] = [];
  if (live && live.year.length) {
    const maxLog = Math.log(1 + Math.max(...live.year.map(([, c]) => c)));
    const month = live.month[now.getMonth()] ?? [];
    const mMax = Math.log(1 + Math.max(1, ...month.map(([, c]) => c)));
    const mBy = new Map(month);
    const byId = new Map(live.taxa.map((s) => [s.inatId!, s]));
    live.year.forEach(([id, c]) => {
      const sp = byId.get(id); if (!sp) return;
      const mc = mBy.get(id) ?? 0;
      out.push({ sp, freq: Math.log(1 + c) / maxLog, seasonal: mc ? 0.35 + 0.65 * (Math.log(1 + mc) / mMax) : 0.1, count: c, dex: 0 });
    });
  } else {
    const seed = seedFor(code) ?? nearestSeed(code);
    for (const sp of SPECIES) {
      const o = sp.occ[seed]; if (!o) continue;
      out.push({ sp, freq: o[0], seasonal: seasonalIndexOf(o[1], now.getMonth(), r.south), dex: 0 });
    }
  }
  // regional dex order: most familiar birds first, stable by name
  out.sort((a, b) => b.freq - a.freq || a.sp.sci.localeCompare(b.sp.sci));
  out.forEach((e, i) => (e.dex = i + 1));
  return out;
}

export function usingSeedFallback(code: string): string | null {
  return memory.get(code)?.year.length ? null : seedFor(code) ?? nearestSeed(code);
}

const TTL = 7 * 864e5;
const API = 'https://api.inaturalist.org/v1';

export async function getJSON(url: string, ms = 9000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(t); }
}

/** Find the iNaturalist place for a region (state/province or country). */
export async function placeFor(code: string): Promise<number | null> {
  const r = getRegion(code);
  const q = r.name === r.countryName ? r.countryName : r.name;
  const j = await getJSON(`${API}/places/autocomplete?q=${encodeURIComponent(q)}&per_page=20`);
  const want = r.name === r.countryName ? 0 : 10;
  const results: any[] = j.results ?? [];
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // Same-named places exist in several countries (e.g. Maryland, US vs Maryland, Liberia):
  // states are listed as "Name, CC", so the country code decides.
  const inCountry = (p: any) => {
    const d = norm(p.display_name ?? '');
    return d.endsWith(`, ${r.country.toLowerCase()}`) || d.includes(`, ${r.country.toLowerCase()},`) || d.includes(norm(r.countryName));
  };
  const match = results.find((p) => p.admin_level === want && norm(p.name) === norm(q) && (want === 0 || inCountry(p)))
    ?? results.find((p) => p.admin_level === want && inCountry(p) && norm(p.display_name ?? '').startsWith(norm(q)))
    ?? (want === 0 ? results.find((p) => p.admin_level === 0 && norm(p.name) === norm(q)) : undefined);
  return match?.id ?? null;
}

function countsQuery(loc: string, extra = '') {
  return `${API}/observations/species_counts?${loc}&taxon_id=3&quality_grade=research&rank=species&per_page=500&locale=${encodeURIComponent((navigator.language || 'en').split('-')[0])}${extra}`;
}

/** Load (or refresh) the live list for a region. Safe to call often. */
export async function ensureRegion(code: string, force = false): Promise<void> {
  if (status.get(code) === 'loading') return;
  if (!memory.has(code)) {
    try { const c = await getRef<Cached>(`region2:${code}`); if (c) { memory.set(code, c); registerSpecies(c.taxa); status.set(code, 'cached'); emit(); } } catch { /* ignore */ }
  }
  const have = memory.get(code);
  if (have && !force && Date.now() - have.at < TTL) return;
  if (!navigator.onLine) { status.set(code, have ? 'cached' : 'offline'); emit(); return; }
  status.set(code, 'loading'); emit();
  try {
    const r = getRegion(code);
    const place = have?.place ?? (await placeFor(code).catch(() => null));
    const loc = place ? `place_id=${place}` : `lat=${r.lat}&lng=${r.lng}&radius=150`;
    const m = new Date().getMonth();
    const months = [(m + 11) % 12, m, (m + 1) % 12].map((x) => x + 1).join(',');
    const [year, now] = await Promise.all([getJSON(countsQuery(loc)), getJSON(countsQuery(loc, `&month=${months}`))]);
    // big regions have more than 500 species: fetch one more page (rare birds) when needed
    if ((year.total_results ?? 0) > 500) {
      try { const p2 = await getJSON(countsQuery(loc, '&page=2')); year.results = [...(year.results ?? []), ...(p2.results ?? [])]; } catch { /* first 500 are plenty */ }
    }
    const taxa: Species[] = []; const seen = new Set<number>();
    for (const row of [...(year.results ?? []), ...(now.results ?? [])]) {
      if (!row.taxon || seen.has(row.taxon.id)) continue;
      seen.add(row.taxon.id);
      const sp = speciesFromTaxon(row.taxon);
      taxa.push(sp.inatId === row.taxon.id ? sp : { ...sp, inatId: row.taxon.id });
    }
    const cached: Cached = {
      at: Date.now(), place: place ?? undefined, taxa,
      year: (year.results ?? []).map((x: any) => [x.taxon.id, x.count]),
      month: { ...(have?.month ?? {}), [m]: (now.results ?? []).map((x: any) => [x.taxon.id, x.count]) },
    };
    if (!cached.year.length) throw new Error('empty');
    memory.set(code, cached); registerSpecies(taxa);
    putRef(`region2:${code}`, cached).catch(() => {});
    status.set(code, 'live');
  } catch {
    status.set(code, have ? 'cached' : 'error');
  }
  emit();
}

// ─── nearby sightings for the map ───
export interface Sighting { id: number; sp: Species; lat: number; lng: number; observedOn: string; observedAt?: string; place?: string; photo?: string; user?: string }

export async function nearbySightings(lat: number, lng: number, radiusKm = 12, days = 30): Promise<{ list: Sighting[]; hidden: number }> {
  const d1 = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const j = await getJSON(`${API}/observations?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}&radius=${radiusKm}&taxon_id=3&d1=${d1}&quality_grade=research&per_page=120&order_by=observed_on&locale=${(navigator.language || 'en').split('-')[0]}`);
  let hidden = 0;
  const list: Sighting[] = [];
  for (const o of j.results ?? []) {
    if (!o.taxon || !o.geojson?.coordinates) continue;
    const sp = speciesFromTaxon(o.taxon);
    // ETH-2: never pin obscured, private or sensitive species (owls, raptors, nests)
    const priv = (v: unknown) => v === 'obscured' || v === 'private';
    if (o.obscured || priv(o.geoprivacy) || priv(o.taxon_geoprivacy) || sp.sensitive) { hidden++; continue; }
    registerSpecies([sp]);
    list.push({ id: o.id, sp, lng: o.geojson.coordinates[0], lat: o.geojson.coordinates[1], observedOn: o.observed_on ?? '', observedAt: o.time_observed_at ?? o.created_at ?? undefined, place: o.place_guess, photo: o.photos?.[0]?.url?.replace('square', 'small') });
  }
  list.sort((a, b) => (b.observedAt ?? b.observedOn).localeCompare(a.observedAt ?? a.observedOn));
  return { list, hidden };
}

export { seedFor };

const summaries = new Map<number, Promise<string | null>>();
/** Wikipedia summary for a live species (iNaturalist /taxa/{id}); cached per session. */
export function taxonSummary(id: number): Promise<string | null> {
  if (!summaries.has(id)) {
    summaries.set(id, getJSON(`${API}/taxa/${id}?locale=${(navigator.language || 'en').split('-')[0]}`)
      .then((j) => { const w = j.results?.[0]?.wikipedia_summary as string | undefined; return w ? stripHtml(w).slice(0, 300) : null; })
      .catch(() => null));
  }
  return summaries.get(id)!;
}

// ─── birding spots: parks, refuges and preserves near you (iNaturalist community places) ───
export interface Spot { id: number; name: string; lat: number; lng: number; species: number; top: string[] }
const NATURE = /\b(park|refuge|preserve|reserve|sanctuary|marsh|wetlands?|lake|pond|reservoir|arboretum|garden|forest|woods|nature|trail|island|beach|creek|river|bay|swamp|meadow|prairie|hotspot|wildlife|conservation|greenway|valley)\b/i;
const NOISE = /usgs|quad|yard|squad|university|college|campus|county|zip|city of|school|census|grid|block|circle|bioblitz|challenge|project/i;
export async function birdingSpots(lat: number, lng: number, max = 10): Promise<Spot[]> {
  const key = `spots:${lat.toFixed(2)},${lng.toFixed(2)}`;
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < 864e5) return c.list; } catch { /* ignore */ }
  const boxes = [[0.06, 0.08], [0.16, 0.2]]; // close by first, then a wider ring
  const found = new Map<number, { id: number; name: string; lat: number; lng: number; d: number }>();
  for (const [dy, dx] of boxes) {
    const j = await getJSON(`https://api.inaturalist.org/v1/places/nearby?nelat=${lat + dy}&nelng=${lng + dx}&swlat=${lat - dy}&swlng=${lng - dx}&per_page=50`);
    for (const p of [...(j.results?.community ?? []), ...(j.results?.standard ?? [])]) {
      if (!p.location || !NATURE.test(p.name) || NOISE.test(p.name) || (p.bbox_area ?? 1) > 0.03) continue;
      const [plat, plng] = String(p.location).split(',').map(Number);
      const d = Math.hypot((plat - lat) * 111, (plng - lng) * 111 * Math.cos(lat * Math.PI / 180));
      if (!found.has(p.id)) found.set(p.id, { id: p.id, name: p.name.replace(/\s*\(.*?\)\s*$/, '').trim(), lat: plat, lng: plng, d });
    }
    if (found.size >= max) break;
  }
  // drop near-duplicates (same name), keep the closest, then count birds recorded at each
  const byName = new Map<string, { id: number; name: string; lat: number; lng: number; d: number }>();
  for (const s of [...found.values()].sort((a, b) => a.d - b.d)) { const k = s.name.toLowerCase().replace(/[^a-z]/g, ''); if (!byName.has(k)) byName.set(k, s); }
  const cands = [...byName.values()].slice(0, max);
  const list: Spot[] = [];
  for (const s of cands) {
    try {
      const c = await getJSON(`https://api.inaturalist.org/v1/observations/species_counts?place_id=${s.id}&taxon_id=3&quality_grade=research&per_page=3&locale=en`);
      const species = c.total_results ?? 0;
      if (species >= 5) list.push({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, species, top: (c.results ?? []).map((r: any) => r.taxon?.preferred_common_name ?? r.taxon?.name).filter(Boolean) });
    } catch { /* skip this one */ }
  }
  list.sort((a, b) => b.species - a.species);
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), list })); } catch { /* ignore */ }
  return list;
}
