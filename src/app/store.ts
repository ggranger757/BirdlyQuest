// Game state: one local store, persisted to IndexedDB on every change.
import { SCENES, FREE_HOMES, homePrice } from '../render/diorama';
import { potionById } from '../core/potions';
import { DECOR, DEFAULT_FEEDER, migratePerchId } from '../core/decor';
import { LENSES, RETIRED_LENSES, boostedPower, type LensId } from '../core/lenses';
import { useSyncExternalStore } from 'react';
import type { GameState, Sighting, Verification, ChallengeSlot } from '../core/model';
import { UNKNOWN } from '../core/model';
import type { Habitat, Species } from '../data/types';
import { speciesById, registerSpecies, ensureRegion, regionEntries } from '../data/provider';
import { getRegion, loadGeo, defaultRegionCode } from '../data/geo';
import { assembleSprite, PhotoPalette, PIPELINE_VERSION } from '../core/pixel/sprite';
import type { Analysis } from '../core/pixel/extract';
import { lns, rarityOf, Rarity } from '../core/rarity';
import { catchCoins, catchXp, applyStreak, dayKey, rankFor, CatchMode, trainerLevel } from '../core/xp';
import { BADGES, newlyEarned, TIER_FEATHERS, Badge } from '../core/badges';
import { pickDaily, pickWeekly, pickSeasonal, weekKey, challengeProgress, CHALLENGE_BY_ID } from '../core/challenges';
import { sunTimes, dayPhase } from '../core/sun';
import { deltaE2000 } from '../core/color';
import { PAL_LAB } from '../core/color';
import { P } from '../core/pixel/archetypes';
import { FOODS, Food, hpNow, visitFeeder, rest, wake, Meal, AVIARY_MAX, ROTATE_MS, FEEDER_CAP, layersOf, pourLayers, eatLayers } from '../core/pets';
import { RIVALS, rewardFor, WILD, TICKETS, ticketsOf, battleIsFree } from '../core/trials';
import { loadState, saveState, putPhoto, getPhoto, photoKeys, deletePhoto as dbDeletePhoto, forgetPhotoURL } from './db';

const VERSION = 1;

export function freshState(): GameState {
  const now = new Date().toISOString();
  return {
    version: VERSION, createdAt: now, onboarded: false, region: 'US', habitat: 'urban',
    xp: 0, feathers: 0, streak: { days: 0, last: null, freezes: 0, best: 0 }, sightings: [], badges: {},
    challenges: { day: '', daily: [], week: '', weekly: null, seasonal: null, history: {} },
    events: { sitSpots: [], shares: [] },
    diorama: { biome: 'urban', birds: [], decor: {} }, ownedDecor: [],
    settings: { sound: true, music: true, gameMusic: false, haptics: true, grid: true, motion: 'system', dyslexiaFont: false, refPhotos: true, theme: 'neon' },
    sessions: 0, lastSession: null, backupPromptAfter: null, firstCatchSeconds: null, installStartedAt: now, log: [],
    trainerName: '', partner: null, speciesDefs: {},
    items: { seeds: 0, berries: 0, worms: 0 }, potions: { atk1: 1, def1: 1 }, lenses: ['ripple'], lens: 'ripple', feeder: { level: 60 }, petDay: null,
    stats: { fills: 0, spent: 0, quests: 0 }, badgeQueue: [],
  };
}

let state: GameState = freshState();
let ready = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() { listeners.forEach((l) => l()); }
// Saving waits until the saved journal has been read, so a slow or stuck IndexedDB
// can never overwrite a real journal with a fresh one.
let loadSettled = false;
function persist() {
  if (!loadSettled) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveState(state).catch(() => {}); }, 120);
}

export function getState() { return state; }
export function setState(fn: (s: GameState) => GameState) { state = fn(state); emit(); persist(); }
export function useGame<T>(sel: (s: GameState) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => sel(state));
}
export const isReady = () => ready;

export function logEvent(e: string, d?: unknown) {
  state = { ...state, log: [...state.log.slice(-199), { t: new Date().toISOString(), e, d }] };
  persist();
}

function adopt(saved: GameState | undefined) {
  if (saved && saved.version) state = { ...freshState(), ...saved, settings: { ...freshState().settings, ...saved.settings }, items: { ...freshState().items, ...(saved.items ?? {}) }, feeder: saved.feeder ?? freshState().feeder, stats: { ...freshState().stats, ...(saved.stats ?? {}) }, badgeQueue: saved.badgeQueue ?? [], potions: saved.potions ?? { atk1: 1, def1: 1 }, lenses: saved.lenses?.length ? saved.lenses : ['ripple'], lens: saved.lens ?? 'ripple' };
  // v1.37: birds cap at Lv50; the Aviary holds 10 (extra residents go back to the Bird Box, in arrival order)
  if (state.sightings.some((x) => (x.level ?? 0) > 50)) state = { ...state, sightings: state.sightings.map((x) => ((x.level ?? 0) > 50 ? { ...x, level: 50 } : x)) };
  if (state.diorama.birds.length > AVIARY_MAX) {
    const out = new Set(state.diorama.birds.slice(0, -AVIARY_MAX)), now = new Date();
    state = { ...state, diorama: { ...state.diorama, birds: state.diorama.birds.slice(-AVIARY_MAX) }, sightings: state.sightings.map((x) => (out.has(x.id) ? rest(x, now) : x)) };
  }
  // The Legendary lens tier was retired (v1.25): refund what each one cost and fall back to a lens still owned.
  // v1.28: Bird Homes are bought now. Whatever home a player already uses stays theirs; High Street was retired.
  if (!state.ownedHomes) state = { ...state, ownedHomes: state.diorama.home && state.diorama.home !== 'c2' ? [state.diorama.home] : [] };
  if (state.diorama.home === 'c2' || (state.diorama.home && !SCENES[state.diorama.home])) state = { ...state, diorama: { ...state.diorama, home: undefined } };
  // v1.29: the twig-and-branch perches became fences, statues, ruins, glow sticks… (same slot and colourway)
  if (state.ownedDecor.some((id) => migratePerchId(id) !== id) || (state.diorama.perch && migratePerchId(state.diorama.perch) !== state.diorama.perch))
    state = { ...state, ownedDecor: state.ownedDecor.map(migratePerchId), diorama: { ...state.diorama, perch: state.diorama.perch && migratePerchId(state.diorama.perch) } };
  const retired = state.lenses.filter((id) => RETIRED_LENSES[id] != null);
  if (retired.length) {
    const refund = retired.reduce((n, id) => n + RETIRED_LENSES[id], 0);
    const lenses = state.lenses.filter((id) => LENSES[id]);
    state = { ...state, feathers: state.feathers + refund, lenses: lenses.length ? lenses : ['ripple'], lens: LENSES[state.lens] ? state.lens : lenses[lenses.length - 1] ?? 'ripple' };
  }
}

export async function initStore() {
  await loadGeo().catch(() => {});
  // Some browsers (older iOS Safari, in-app webviews, private modes) never answer IndexedDB.
  // Never block the first paint on it: start after 1.5s with an in-memory journal if needed.
  const load = loadState<GameState>().then((v) => ({ ok: true as const, v }), () => ({ ok: false as const, v: undefined }));
  const first = await Promise.race([load, new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
  if (first) { adopt(first.v); loadSettled = true; }
  else {
    load.then((res) => {
      // Late answer: adopt the saved journal unless the player already caught something this session.
      if (res.v && res.v.version && state.sightings.length === 0) { adopt(res.v); emit(); }
      loadSettled = true; persist();
    });
  }
  if (!state.onboarded && state.region === 'US') state = { ...state, region: defaultRegionCode() };
  registerSpecies(Object.values(state.speciesDefs ?? {}));
  ensureRegion(state.region).catch(() => {});
  try { tickFeeder(); } catch { /* ignore */ }
  setTimeout(() => { try { awardBadges(); } catch { /* ignore */ } }, 1500); // retroactive awards for new achievements
  const today = dayKey(new Date());
  if (state.lastSession !== today || state.sessions === 0) state = { ...state, sessions: state.sessions + 1, lastSession: today };
  refreshChallenges(new Date(), false);
  ready = true;
  emit(); persist();
  try { if (state.sightings.length && navigator.storage?.persist) navigator.storage.persist(); } catch { /* ignore */ }
}

export function refreshChallenges(now: Date, notify = true) {
  const today = dayKey(now), week = weekKey(now);
  let c = state.challenges;
  if (c.day !== today) {
    const daily = pickDaily(state, today);
    const history = Object.fromEntries(Object.entries(c.history).filter(([d]) => d >= dayKey(new Date(now.getTime() - 14 * 864e5))));
    history[today] = daily.map((d) => d.id);
    c = { ...c, day: today, daily, history };
  }
  if (c.week !== week) c = { ...c, week, weekly: pickWeekly(state, week) };
  const seasonal = pickSeasonal(state.region, now);
  if (seasonal?.id !== c.seasonal?.id) c = { ...c, seasonal };
  if (c !== state.challenges) { state = { ...state, challenges: c }; if (notify) { emit(); persist(); } }
}

// ─── catches ───

export interface CatchInput {
  speciesId: string | null;
  verification: Verification;
  mode: CatchMode;
  habitat: Habitat;
  analysis: Pick<Analysis, 'palette' | 'score' | 'hash'> | null;
  photo: Blob | null;
  at?: Date;
}

export interface CatchResult {
  sighting: Sighting;
  species: Species;
  badges: Badge[];
  rankUp: string | null;
  levelUp: { level: number; homes: string[] } | null;
  firstEver?: boolean;
  missionDone?: boolean;
  previousXp: number;
  /** a Trial Ticket was earned for logging this bird */
  ticket?: boolean;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

const PHOTO_PARTS = [P.BODY, P.BELLY, P.WING, P.HEAD, P.CROWN, P.TAIL];
function meanDeltaE(a: number[], b: number[]): number {
  return PHOTO_PARTS.reduce((s, p) => s + deltaE2000(PAL_LAB[a[p]], PAL_LAB[b[p]]), 0) / PHOTO_PARTS.length;
}

export function speciesOf(s: Sighting): Species {
  return speciesById(s.speciesId) || UNKNOWN;
}

/** Counts toward completion: verified or self-reported, not vagrant-pending or unverified. */
export const counts = (x: Sighting) => !!x.speciesId && x.mode !== 'seen' && (x.verification === 'verified' || x.verification === 'self-reported');

export function plumagesOf(st: GameState, speciesId: string): Sighting[] {
  return st.sightings.filter((x) => x.speciesId === speciesId && (x.firstRecord || x.newPlumage));
}

export async function fileCatch(input: CatchInput): Promise<CatchResult> {
  const at = input.at ?? new Date();
  const region = getRegion(state.region);
  const sp = speciesById(input.speciesId) || UNKNOWN;
  const hash = input.analysis?.hash ?? fakeHash(`${sp.id}|${at.toISOString()}`);
  const palette: PhotoPalette | null = input.analysis?.palette ?? null;
  const sprite = assembleSprite(sp, palette, hash);

  // "seen" logs (no photo) never make a bird discovered, so a later photo is still a first record
  const prior = input.speciesId ? state.sightings.filter((x) => x.speciesId === input.speciesId && x.mode !== 'seen') : [];
  const seen = input.mode === 'seen';
  const firstRecord = !seen && !!input.speciesId && prior.length === 0;
  const firstEver = !seen && !!input.speciesId && !state.sightings.some(counts);
  const regionFirst = !!input.speciesId && !prior.some((x) => x.region === state.region);
  const plumages = input.speciesId ? plumagesOf(state, input.speciesId) : [];
  const newPlumage = !firstRecord && plumages.length > 0 && plumages.length < 4 &&
    plumages.every((p) => meanDeltaE(p.sprite.parts, sprite.parts) > 10);

  const score = input.speciesId ? lns(sp, region, at, input.habitat) : 0.9;
  const rarity: Rarity = rarityOf(score);
  const fc0 = input.analysis?.score ?? null;
  // the equipped Snap Lens boosts Snap Power on field photos
  const fc = fc0 && input.mode === 'field' ? { ...fc0, total: boostedPower(fc0.total, state.lens) } : fc0;
  const streakBefore = state.streak;
  const streak = applyStreak(streakBefore, dayKey(at));
  const xp0 = catchXp({
    newSpecies: firstRecord && input.verification !== 'vagrant', regionFirst, fieldcraft: fc?.total ?? 0,
    rarity, streakDays: streak.days, mode: input.mode,
  });
  // Feather Coins are the in-game currency: every real catch pays, new species pay most, rarer birds pay more
  const feathers0 = catchCoins({ seen, firstRecord, newPlumage, rarity });
  // first-bird bonus: the very first discovery pays double, so day one ends with a win
  // missions: find the bird you set out for in time for a bonus
  const missionDone = !seen && !!state.mission && state.mission.speciesId === input.speciesId && at.getTime() < Date.parse(state.mission.until);
  const xp = (firstEver ? xp0 * 2 : xp0) + (missionDone ? 25 : 0), feathers = (firstEver ? feathers0 * 2 : feathers0) + (missionDone ? 25 : 0);

  const id = uuid();
  let photoId: string | null = null;
  if (input.photo) { try { await putPhoto(id, input.photo); photoId = id; } catch { photoId = null; } }

  const phase = dayPhase(at, sunTimes(at, region.lat, region.lng));
  const sighting: Sighting = {
    id, speciesId: input.speciesId, region: state.region, habitat: input.habitat,
    capturedAt: at.toISOString(), day: dayKey(at), hour: at.getHours(), phase, mode: input.mode,
    verification: input.verification,
    fieldcraft: fc ? { total: fc.total, sharpness: fc.sharpness, exposure: fc.exposure, size: fc.size, framing: fc.framing, separation: fc.separation } : null,
    coaching: fc?.coaching ?? [], rarity, xp, feathers, sprite, palette, photoId, firstRecord, newPlumage,
    timesSeen: prior.length + 1, note: '',
    level: Math.min(50, 5 + Math.round((fc?.total ?? 40) / 5) + prior.length), // level cap 50
    dex: regionEntries(state.region).find((e) => e.sp.id === sp.id)?.dex,
    pet: { hp: 80, at: at.toISOString() },
  };

  const previousXp = state.xp;
  const rankBefore = rankFor(previousXp).name;
  let next: GameState = {
    ...state, sightings: [sighting, ...state.sightings], xp: state.xp + xp, feathers: state.feathers + feathers, streak,
    speciesDefs: sp.inatId && sp.id.startsWith('inat-') ? { ...state.speciesDefs, [sp.id]: sp } : state.speciesDefs,
    mission: missionDone ? null : state.mission,
  };
  if (state.firstCatchSeconds === null) {
    next.firstCatchSeconds = Math.round((at.getTime() - new Date(state.installStartedAt).getTime()) / 1000);
    next.backupPromptAfter = new Date().toISOString();
  }
  // auto-place the first few birds in the diorama so the habitat is never empty
  // new catches move into the Aviary while there is room; otherwise they rest in the Bird Box
  if (seen) { /* seen-only logs stay in your journal, not the Aviary */ }
  else if (next.diorama.birds.length < AVIARY_MAX) next.diorama = { ...next.diorama, birds: [...next.diorama.birds, id] };
  else { // full: the new bird flies in and the one that's been there longest flies off to the Bird Box
    const out = next.diorama.birds[0];
    next.diorama = { ...next.diorama, birds: [...next.diorama.birds.slice(1), id] };
    next.sightings = next.sightings.map((x) => (x.id === out ? rest(x, at) : x));
  }
  const earned = newlyEarned(next);
  if (earned.length) {
    const badges = { ...next.badges };
    let bonus = 0;
    for (const b of earned) { badges[b.id] = at.toISOString(); bonus += TIER_FEATHERS[b.tier]; }
    next = { ...next, badges, feathers: next.feathers + bonus };
  }
  // every bird you log earns a Trial Ticket for rival battles (up to the cap)
  const ticket = counts(sighting) && ticketsOf(next.trials) < TICKETS.max;
  if (ticket) next = { ...next, trials: { cleared: 0, wins: 0, ...next.trials, tickets: ticketsOf(next.trials) + 1, ticketsEarned: (next.trials?.ticketsEarned ?? 0) + 1 } };
  // sometimes a wandering birder challenges you to show off a newly discovered bird (at most once a day)
  if (sighting.firstRecord && counts(sighting) && next.sightings.filter(counts).length >= 2 && next.trials?.wildDay !== dayKey(at) && Math.random() < WILD.chance) {
    next = { ...next, pendingChallenge: { sightingId: sighting.id, at: at.toISOString() } };
  }
  state = next;
  logEvent('catch_success', { mode: input.mode, species: input.speciesId, verification: input.verification, fc: fc?.total });
  if (sighting.firstRecord && state.sightings.length === 1) logEvent('first_catch_seconds', state.firstCatchSeconds);
  emit(); persist();
  const rankAfter = rankFor(state.xp).name;
  const lvA = trainerLevel(previousXp).level, lvB = trainerLevel(state.xp).level;
  const homes = Object.values(SCENES).filter((h) => h.level > lvA && h.level <= lvB && !FREE_HOMES.includes(h.id)).map((h) => h.label);
  return { sighting, species: sp, badges: earned, rankUp: rankAfter !== rankBefore ? rankAfter : null, levelUp: lvB > lvA ? { level: lvB, homes } : null, previousXp, firstEver, missionDone, ticket };
}

function fakeHash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + 'ffff0000';
}

/** Identify an unverified catch later (or confirm a vagrant): re-inks the sprite with the new anatomy. */
export function identifySighting(id: string, speciesId: string, verification: Verification) {
  setState((s) => ({
    ...s,
    sightings: s.sightings.map((x) => {
      if (x.id !== id) return x;
      const sp = speciesById(speciesId)!;
      const first = !s.sightings.some((y) => y.id !== id && y.speciesId === speciesId);
      return { ...x, speciesId, verification, firstRecord: first, sprite: assembleSprite(sp, x.palette, x.sprite.hash) };
    }),
    speciesDefs: speciesById(speciesId)?.id.startsWith('inat-') ? { ...s.speciesDefs, [speciesId]: speciesById(speciesId)! } : s.speciesDefs,
  }));
}

export function updateNote(id: string, note: string) {
  setState((s) => ({ ...s, sightings: s.sightings.map((x) => (x.id === id ? { ...x, note: note.slice(0, 280) } : x)) }));
  after(0);
}

export async function deletePhotoKeepSprite(id: string) {
  await dbDeletePhoto(id).catch(() => {});
  forgetPhotoURL(id);
  setState((s) => ({ ...s, sightings: s.sightings.map((x) => (x.id === id ? { ...x, photoId: null } : x)) }));
}

export function deleteSighting(id: string) {
  dbDeletePhoto(id).catch(() => {});
  forgetPhotoURL(id);
  setState((s) => ({
    ...s, sightings: s.sightings.filter((x) => x.id !== id),
    diorama: { ...s.diorama, birds: s.diorama.birds.filter((b) => b !== id) },
  }));
}

// ─── challenges, habitat, settings ───

export function claimChallenge(slot: ChallengeSlot) {
  const now = new Date();
  const { done, def } = challengeProgress(state, slot, now);
  if (!done || slot.claimed) return 0;
  const mark = (x: ChallengeSlot | null) => (x && x.id === slot.id && x.param === slot.param ? { ...x, claimed: true } : x);
  setState((s) => ({
    ...s, xp: s.xp + def.xp, feathers: s.feathers + Math.round(def.xp / 10),
    challenges: { ...s.challenges, daily: s.challenges.daily.map((d) => mark(d)!), weekly: mark(s.challenges.weekly), seasonal: mark(s.challenges.seasonal) },
  }));
  setState((s) => ({ ...s, stats: { ...s.stats, quests: s.stats.quests + 1 } }));
  logEvent('challenge_claim', slot.id);
  return after(def.xp);
}

export function recordSitSpot() { setState((s) => ({ ...s, events: { ...s.events, sitSpots: [...s.events.sitSpots.slice(-30), dayKey(new Date())] } })); }
export function recordShare() { setState((s) => ({ ...s, events: { ...s.events, shares: [...s.events.shares.slice(-30), dayKey(new Date())] } })); logEvent('share_created'); after(0); }

/** Move a bird between the Aviary and the Bird Box. When the Aviary is full, the bird that's been there longest swaps out.
 *  Returns false only if nothing changed; otherwise true (and `swappedOut` names the sighting that flew off, if any). */
export let swappedOut: string | null = null;
/** Birds take turns in the Aviary: when it's full and others wait in the Bird Box, every few hours the bird that's
 *  been in longest flies off and the one that's rested longest flies in. Returns who swapped, or null. */
export function rotateAviary(now = new Date()): { out: string; in: string } | null {
  const ids = state.diorama.birds;
  if (!state.diorama.rotatedAt) { setState((s) => ({ ...s, diorama: { ...s.diorama, rotatedAt: now.toISOString() } })); return null; }
  if (ids.length < AVIARY_MAX || now.getTime() - Date.parse(state.diorama.rotatedAt) < ROTATE_MS) return null;
  const box = state.sightings.filter((x) => counts(x) && x.pet?.resting && !ids.includes(x.id))
    .sort((a, b) => Date.parse(a.pet!.at) - Date.parse(b.pet!.at));
  if (!box.length) return null;
  const out = ids[0], inn = box[0].id;
  setState((s) => ({
    ...s,
    diorama: { ...s.diorama, birds: [...s.diorama.birds.filter((b) => b !== out), inn], rotatedAt: now.toISOString() },
    sightings: s.sightings.map((x) => (x.id === out ? rest(x, now) : x.id === inn ? wake(x, now) : x)),
  }));
  return { out, in: inn };
}

/** Recolour a bird's armor (any dye from core/armor DYES; 'theme' restores the original colours). */
export function setArmorGlow(id: string, glow: string) {
  setState((s) => ({ ...s, sightings: s.sightings.map((x) => (x.id === id ? { ...x, armorGlow: glow === 'theme' ? undefined : glow } : x)) }));
}
export function setArmorDye(id: string, dye: string) {
  setState((s) => ({ ...s, sightings: s.sightings.map((x) => (x.id === id ? { ...x, armorDye: dye === 'theme' ? undefined : dye } : x)) }));
}

export function toggleHabitatBird(id: string): boolean {
  const has = state.diorama.birds.includes(id);
  const now = new Date();
  const out = !has && state.diorama.birds.length >= AVIARY_MAX ? state.diorama.birds[0] : null;
  swappedOut = out;
  setState((s) => ({
    ...s,
    diorama: { ...s.diorama, birds: has ? s.diorama.birds.filter((b) => b !== id) : [...s.diorama.birds.filter((b) => b !== out), id] },
    sightings: s.sightings.map((x) => (x.id === id ? (has ? rest(x, now) : wake(x, now)) : x.id === out ? rest(x, now) : x)),
  }));
  after(0);
  return true;
}

export function setHome(id: string | undefined) { if (id && !ownsHome(state, id)) return; setState((s) => ({ ...s, diorama: { ...s.diorama, home: id } })); }
/** Bird Homes: the default pair is free; every other home unlocks by level and is then bought. */
export const ownsHome = (s: GameState, id: string) => FREE_HOMES.includes(id) || !!s.ownedHomes?.includes(id);
export function buyHome(id: string): boolean {
  const sc = SCENES[id], price = homePrice(id);
  if (!sc || ownsHome(state, id) || trainerLevel(state.xp).level < sc.level || state.feathers < price) return false;
  setState((s) => ({ ...s, feathers: s.feathers - price, ownedHomes: [...(s.ownedHomes ?? []), id], diorama: { ...s.diorama, home: id }, stats: { ...s.stats, spent: s.stats.spent + price } }));
  logEvent('buy_home', id);
  return true;
}
/** Feeders and perches. */
export const ownsDecor = (s: GameState, id: string) => id === DEFAULT_FEEDER || s.ownedDecor.includes(id);
export function buyDecor(id: string): boolean {
  const d = DECOR[id];
  if (!d || ownsDecor(state, id) || trainerLevel(state.xp).level < d.level || state.feathers < d.price) return false;
  setState((s) => ({ ...s, feathers: s.feathers - d.price, ownedDecor: [...s.ownedDecor, id], diorama: { ...s.diorama, [d.kind]: id }, stats: { ...s.stats, spent: s.stats.spent + d.price } }));
  logEvent('buy_decor', id);
  return true;
}
export function equipDecor(kind: 'feeder' | 'perch', id: string | undefined) {
  if (id && !ownsDecor(state, id)) return;
  setState((s) => ({ ...s, diorama: { ...s.diorama, [kind]: id } }));
}
export function setBiome(b: Habitat) { setState((s) => ({ ...s, diorama: { ...s.diorama, biome: b } })); }

export function speciesCount(s: GameState) { return new Set(s.sightings.filter(counts).map((x) => x.speciesId)).size; }

export function badgeById(id: string) { return BADGES.find((b) => b.id === id); }
export { CHALLENGE_BY_ID, PIPELINE_VERSION };

export async function exportBackup(includePhotos: boolean): Promise<Blob> {
  const photos: Record<string, string> = {};
  if (includePhotos) {
    for (const s of state.sightings) {
      if (!s.photoId) continue;
      const b = await getPhoto(s.photoId);
      if (b) photos[s.photoId] = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
    }
  }
  return new Blob([JSON.stringify({ app: 'birdlyquest', version: VERSION, state, photos })], { type: 'application/json' });
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if ((data.app !== 'birdlyquest' && data.app !== 'pixel-birder') || !data.state) throw new Error('That file is not a BirdlyQuest backup.');
  for (const [id, url] of Object.entries<string>(data.photos ?? {})) {
    const blob = await (await fetch(url)).blob();
    await putPhoto(id, blob);
  }
  state = { ...freshState(), ...data.state };
  emit(); persist();
  return state.sightings.length;
}

export async function resetAll() {
  for (const k of await photoKeys()) await dbDeletePhoto(String(k));
  state = freshState();
  emit(); await saveState(state);
}

export function setRegion(code: string) {
  setState((s) => ({ ...s, region: code }));
  ensureRegion(code).catch(() => {});
}
export function setTrainer(name: string) { setState((s) => ({ ...s, trainerName: name.slice(0, 16) })); }
export function setPartner(sp: Species) {
  const parts = assembleSprite(sp, null, `partner${sp.id}`).parts;
  setState((s) => ({ ...s, partner: { speciesId: sp.id, parts, pet: { hp: 90, at: new Date().toISOString() } }, speciesDefs: sp.id.startsWith('inat-') ? { ...s.speciesDefs, [sp.id]: sp } : s.speciesDefs }));
}

// ─── achievements outside of discoveries ───
/** Award any newly met badges (Feather Coins included) and queue a pop-up for each. */
export function awardBadges(): Badge[] {
  const earned = newlyEarned(state);
  if (!earned.length) return [];
  const now = new Date().toISOString();
  setState((s) => {
    const badges = { ...s.badges }; let bonus = 0;
    for (const b of earned) { badges[b.id] = now; bonus += TIER_FEATHERS[b.tier]; }
    return { ...s, badges, feathers: s.feathers + bonus, badgeQueue: [...s.badgeQueue, ...earned.map((b) => b.id)] };
  });
  return earned;
}
export function shiftBadgeQueue() { setState((s) => ({ ...s, badgeQueue: s.badgeQueue.slice(1) })); }
const after = <T,>(v: T): T => { setTimeout(awardBadges, 0); return v; };

// ─── pets & feeder ───
export const inAviary = (id: string) => state.diorama.birds.includes(id);

export function buyFood(food: Food, qty = 1): boolean {
  const cost = FOODS[food].price * qty;
  if (state.feathers < cost) return false;
  setState((s) => ({ ...s, feathers: s.feathers - cost, items: { ...s.items, [food]: s.items[food] + qty }, stats: { ...s.stats, spent: s.stats.spent + cost } }));
  logEvent('buy_food', food);
  return after(true);
}

/** Start (or drop) a mission to go and find a bird from a live sighting. Lasts 3 hours. */
export function setMission(m: { speciesId: string; name: string; lat: number; lng: number } | null) {
  setState((s) => ({ ...s, mission: m ? { ...m, until: new Date(Date.now() + 3 * 3600e3).toISOString() } : null }));
  if (m) logEvent('mission_start', m.speciesId);
}

/** Say "not now" to an offered mission: no offers for 2 hours, and that species isn't offered again today. */
export function skipMission(speciesId: string) {
  const day = dayKey(new Date());
  setState((s) => ({ ...s, missionSkips: { day, ids: [...(s.missionSkips?.day === day ? s.missionSkips.ids : []).filter((x) => typeof x === 'string'), speciesId] }, missionSnoozeUntil: new Date(Date.now() + 2 * 3600e3).toISOString() }));
  logEvent('mission_skip', speciesId);
}

/** Claim a finished BirdDex chapter's Feather reward (once). */
export function claimChapter(id: string, reward: number): boolean {
  if (state.chapters?.[id]) return false;
  setState((s) => ({ ...s, feathers: s.feathers + reward, chapters: { ...(s.chapters ?? {}), [id]: new Date().toISOString() } }));
  logEvent('chapter_claim', id);
  return after(true);
}

/** Finish a Field Trial. A win pays the rival's prize the first time, then a small capped rematch bonus. */
export function finishTrial(index: number, won: boolean, birds: string[] = []): { coins: number; xp: number; first: boolean; levelled: string[] } {
  const rival = RIVALS[index];
  if (!rival) return { coins: 0, xp: 0, first: false, levelled: [] };
  if (!won) { logEvent('trial_loss', rival.id); return { coins: 0, xp: 0, first: false, levelled: [] }; }
  setState((s) => ({ ...s, trials: { cleared: 0, wins: 0, ...s.trials } }));
  const today = dayKey(new Date());
  const r = rewardFor(state.trials, index, today);
  // birds that took part grow a level (only while the win still pays, so rematches can't be farmed)
  const levelled = r.coins > 0 ? birds.filter((id) => state.sightings.some((x) => x.id === id && (x.level ?? 5) < 50)) : [];
  setState((s) => {
    const t = s.trials ?? { cleared: 0, wins: 0 };
    const used = t.day === today ? t.rematches ?? 0 : 0;
    return {
      ...s, xp: s.xp + r.xp, feathers: s.feathers + r.coins,
      sightings: levelled.length ? s.sightings.map((x) => (levelled.includes(x.id) ? { ...x, level: (x.level ?? 5) + 1 } : x)) : s.sightings,
      trials: { ...t, cleared: Math.max(t.cleared, index + 1), wins: t.wins + 1, day: today, rematches: r.first ? used : used + 1 },
    };
  });
  logEvent('trial_win', { rival: rival.id, ...r, levelled: levelled.length });
  return after({ ...r, levelled });
}

/** A wandering birder's challenge (after discovering a new bird): a small prize, and your birds grow a level. */
export function finishWild(won: boolean, birds: string[] = []): { coins: number; xp: number; first: boolean; levelled: string[] } {
  const today = dayKey(new Date());
  const levelled = won ? birds.filter((id) => state.sightings.some((x) => x.id === id && (x.level ?? 5) < 50)) : [];
  setState((s) => {
    const t = s.trials ?? { cleared: 0, wins: 0 };
    return {
      ...s, xp: s.xp + (won ? WILD.xp : 0), feathers: s.feathers + (won ? WILD.coins : 0),
      sightings: levelled.length ? s.sightings.map((x) => (levelled.includes(x.id) ? { ...x, level: (x.level ?? 5) + 1 } : x)) : s.sightings,
      trials: { ...t, wins: t.wins + (won ? 1 : 0), wildDay: today },
    };
  });
  logEvent(won ? 'wild_win' : 'wild_loss', levelled.length);
  return after({ coins: won ? WILD.coins : 0, xp: won ? WILD.xp : 0, first: false, levelled });
}
/** A friend duel ended. Prizes and level-ups only for the first win against each friend per day, so duels can't be farmed. */
export const DUEL = { coins: 20, xp: 40 };
export function finishDuel(won: boolean, birds: string[], friend: string): { coins: number; xp: number; first: boolean; levelled: string[] } {
  const today = dayKey(new Date());
  const seen = state.trials?.duels ?? {};
  const first = won && seen[friend] !== today;
  const levelled = first ? birds.filter((id) => state.sightings.some((x) => x.id === id && (x.level ?? 5) < 50)) : [];
  setState((s) => {
    const t = s.trials ?? { cleared: 0, wins: 0 };
    const duels = { ...(t.duels ?? {}) }; if (won) duels[friend] = today;
    const keep = Object.fromEntries(Object.entries(duels).sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, 40));
    return {
      ...s, xp: s.xp + (first ? DUEL.xp : 0), feathers: s.feathers + (first ? DUEL.coins : 0),
      sightings: levelled.length ? s.sightings.map((x) => (levelled.includes(x.id) ? { ...x, level: (x.level ?? 5) + 1 } : x)) : s.sightings,
      trials: { ...t, wins: t.wins + (won ? 1 : 0), duels: keep, duelWins: (t.duelWins ?? 0) + (won ? 1 : 0) },
    };
  });
  logEvent(won ? 'duel_win' : 'duel_loss', levelled.length);
  return after({ coins: first ? DUEL.coins : 0, xp: first ? DUEL.xp : 0, first, levelled });
}
/** Count a battle played, and mark the battle tutorial as seen. */
export function noteBattle(tutorialDone: boolean) {
  setState((s) => { const t = s.trials ?? { cleared: 0, wins: 0 }; return { ...s, trials: { ...t, battles: (t.battles ?? 0) + 1, tutorial: t.tutorial || tutorialDone } }; });
}
/** Spend a Trial Ticket to start a rival battle (your very first battle is free). */
export function spendTicket(): boolean {
  if (battleIsFree(state.trials)) return true;
  const n = ticketsOf(state.trials);
  if (n < 1) return false;
  setState((s) => ({ ...s, trials: { cleared: 0, wins: 0, ...s.trials, tickets: n - 1, ticketsUsed: (s.trials?.ticketsUsed ?? 0) + 1 } }));
  logEvent('ticket_used', n - 1);
  return true;
}
export function clearChallenge() { setState((s) => ({ ...s, pendingChallenge: null })); }

/** Buy a battle potion. Needs the birder level it unlocks at and enough Feather Coins. */
export function buyPotion(id: string): boolean {
  const p = potionById(id);
  if (!p || state.feathers < p.price || trainerLevel(state.xp).level < p.level) return false;
  setState((s) => ({ ...s, feathers: s.feathers - p.price, potions: { ...(s.potions ?? {}), [id]: (s.potions?.[id] ?? 0) + 1 }, stats: { ...s.stats, spent: s.stats.spent + p.price } }));
  logEvent('buy_potion', id);
  return after(true);
}
/** Drink one potion in a battle. */
export function spendPotion(id: string): boolean {
  if ((state.potions?.[id] ?? 0) < 1) return false;
  setState((s) => ({ ...s, potions: { ...(s.potions ?? {}), [id]: (s.potions?.[id] ?? 0) - 1 } }));
  logEvent('trial_potion', id);
  return true;
}

/** Use one bag of pantry food during a Field Trial. */
export function spendTrialItem(item: Food): boolean {
  if ((state.items[item] ?? 0) < 1) return false;
  setState((s) => ({ ...s, items: { ...s.items, [item]: s.items[item] - 1 } }));
  logEvent('trial_item', item);
  return true;
}

/** Buy a Snap Lens with Feather Coins and put it on. */
export function buyLens(id: LensId): boolean {
  const l = LENSES[id];
  if (!l || state.lenses.includes(id) || state.feathers < l.price || trainerLevel(state.xp).level < l.level) return false;
  setState((s) => ({ ...s, feathers: s.feathers - l.price, lenses: [...s.lenses, id], lens: id, stats: { ...s.stats, spent: s.stats.spent + l.price } }));
  logEvent('buy_lens', id);
  return after(true);
}
export function equipLens(id: LensId) { if (state.lenses.includes(id)) setState((s) => ({ ...s, lens: id })); }

/** Pour one bag from the pantry into the feeder. Returns points added (0 if full or no bag). */
export function fillFeeder(food: Food): number {
  if (state.items[food] <= 0 || state.feeder.level >= FEEDER_CAP) return 0;
  const add = Math.min(FOODS[food].points, FEEDER_CAP - state.feeder.level);
  setState((s) => ({ ...s, items: { ...s.items, [food]: s.items[food] - 1 }, feeder: { level: s.feeder.level + add, layers: pourLayers(layersOf(s.feeder), food, add) }, stats: { ...s.stats, fills: s.stats.fills + 1 } }));
  return after(add);
}

/** Hungry Aviary birds eat from the feeder. Call often; it only changes state when someone eats. */
export function tickFeeder(now = new Date()): Meal[] {
  const ids = new Set(state.diorama.birds);
  const pp = partnerPet();
  const birds = [...state.sightings.filter((x) => ids.has(x.id)), ...(pp ? [pp] : [])];
  if (!birds.length) return [];
  const r = visitFeeder(birds, state.feeder.level, now);
  if (!r.meals.length) return [];
  const by = new Map(r.birds.map((b) => [b.id, b]));
  const np = by.get('partner');
  setState((s) => ({ ...s, feeder: { level: r.level, layers: eatLayers(layersOf(s.feeder), s.feeder.level - r.level) }, sightings: s.sightings.map((x) => by.get(x.id) ?? x),
    partner: s.partner && np ? { ...s.partner, pet: np.pet as { hp: number; at: string } } : s.partner }));
  return after(r.meals);
}

/** Tapping a bird: once a day each one brings you a little gift. Returns Feather Coins gained. */
export function petBird(id: string, now = new Date()): number {
  const day = dayKey(now);
  if (id === 'partner' || state.petGifts?.[id] === day) return 0;
  setState((s) => ({ ...s, feathers: s.feathers + 3, petGifts: { ...(s.petGifts ?? {}), [id]: day } }));
  return 3;
}

/**
 * Welcome back: if you've been away a day or more, Merlin feeds any weak Aviary birds back to 50 HP.
 * Returns how many birds he fed. Always records that you're here now.
 */
export function welcomeBack(now = new Date()): number {
  const away = state.lastSeenAt ? now.getTime() - Date.parse(state.lastSeenAt) : 0;
  let fed = 0;
  let sightings = state.sightings;
  if (away > 20 * 3600e3) {
    sightings = state.sightings.map((x) => {
      if (!inAviary(x.id) || hpNow(x, now) >= 40) return x;
      fed++; return { ...x, pet: { hp: 50, at: now.toISOString() } };
    });
  }
  let partner = state.partner;
  // partners from older versions had no HP yet: start them healthy now
  if (partner && !partner.pet) partner = { ...partner, pet: { hp: 90, at: now.toISOString() } };
  const pp = partner ? partnerPet({ ...state, partner }) : null;
  if (away > 20 * 3600e3 && pp && partner && hpNow(pp, now) < 40) { fed++; partner = { ...partner, pet: { hp: 50, at: now.toISOString() } }; }
  setState((s) => ({ ...s, sightings, partner, lastSeenAt: now.toISOString() }));
  return fed;
}

/** Once a day, each healthy Aviary bird brings you 2 Feather Coins. */
export function collectAviary(now = new Date()): number {
  const today = dayKey(now);
  if (state.petDay === today) return 0;
  const n = state.sightings.filter((x) => inAviary(x.id) && hpNow(x, now) >= 60).length * 2;
  setState((s) => ({ ...s, petDay: today, feathers: s.feathers + n }));
  return n;
}
/** The partner bird as a pet record, so it gets hungry and eats like the others. */
export function partnerPet(st: GameState = state): Sighting | null {
  if (!st.partner) return null;
  return { id: 'partner', capturedAt: st.installStartedAt, pet: st.partner.pet ?? { hp: 90, at: new Date().toISOString() } } as unknown as Sighting;
}
/** What to call a bird: its nickname, else its species name. */
export function birdName(id: string, st: GameState = state): string {
  if (id === 'partner') return st.partner?.nickname || speciesById(st.partner?.speciesId ?? '')?.common || 'Partner';
  const s = st.sightings.find((x) => x.id === id);
  return s ? s.nickname || speciesOf(s).common : 'Bird';
}
/** Give a found bird (or your partner) a name. Empty clears it. */
export function nameBird(id: string, name: string) {
  const n = name.trim().slice(0, 18) || undefined;
  if (id === 'partner') setState((s) => ({ ...s, partner: s.partner ? { ...s.partner, nickname: n } : s.partner }));
  else setState((s) => ({ ...s, sightings: s.sightings.map((x) => (x.id === id ? { ...x, nickname: n } : x)) }));
  logEvent('name_bird', !!n);
}
export function hungryCount(now = new Date()): number {
  const pp = partnerPet();
  return state.sightings.filter((x) => inAviary(x.id) && hpNow(x, now) < 30).length + (pp && hpNow(pp, now) < 30 ? 1 : 0);
}

// e2e/dev only: lets automated checks seed a save. Stripped from production builds.
if ((import.meta as any).env?.DEV && typeof window !== 'undefined') (window as any).__store = { getState, setState, fileCatch };
