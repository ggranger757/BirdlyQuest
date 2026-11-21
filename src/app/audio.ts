// Chiptune sound: synthesised SFX plus original looping themes (square lead, triangle bass, noise drums).
// All melodies are composed for BirdlyQuest; no samples, nothing to download or license.
import { getState } from './store';

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08, bus: 'sfx' | 'music' = 'sfx', slideTo?: number) {
  const c = ac(); if (!c) return;
  if (bus === 'sfx' && !getState().settings.sound) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.setValueAtTime(vol, t0 + Math.max(0.005, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus === 'sfx' ? sfxBus! : musicBus!);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(start: number, dur: number, vol = 0.12, hp = 1200, bus: 'sfx' | 'music' = 'sfx') {
  const c = ac(); if (!c) return;
  if (bus === 'sfx' && !getState().settings.sound) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0); let seed = 7;
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  }
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = c.createGain(); const t0 = c.currentTime + start;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(bus === 'sfx' ? sfxBus! : musicBus!);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
}

const N = (n: string): number => {
  // note name like C4, F#5 → Hz
  const m = n.match(/^([A-G])(#|b)?(\d)$/); if (!m) return 0;
  const idx = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (idx - 9 + (Number(m[3]) - 4) * 12) / 12);
};

export const sfx = {
  tap: () => tone(1046, 0, 0.035, 'square', 0.035),
  move: () => tone(784, 0, 0.03, 'square', 0.03),
  select: () => { tone(988, 0, 0.04, 'square', 0.05); tone(1319, 0.045, 0.06, 'square', 0.05); },
  back: () => { tone(659, 0, 0.04, 'square', 0.04); tone(494, 0.045, 0.06, 'square', 0.04); },
  blip: () => tone(1568 + Math.random() * 60, 0, 0.018, 'square', 0.018),
  shutter: () => { noise(0, 0.05, 0.3, 2500); noise(0.06, 0.04, 0.2, 1800); tone(1568, 0.02, 0.06, 'square', 0.05); },
  focus: () => { tone(1320, 0, 0.03, 'square', 0.04); tone(1760, 0.05, 0.03, 'square', 0.04); },
  encounter: () => { // battle-start sting: rising sweep + stabs
    tone(220, 0, 0.35, 'sawtooth', 0.05, 'sfx', 1760); noise(0, 0.3, 0.06, 4000);
    [N('E5'), N('E5'), N('G5'), N('B5')].forEach((f, i) => tone(f, 0.38 + i * 0.09, 0.08, 'square', 0.06));
  },
  throw: () => { tone(300, 0, 0.32, 'triangle', 0.12, 'sfx', 900); noise(0, 0.25, 0.05, 3000); },
  open: () => { tone(1800, 0, 0.18, 'square', 0.05, 'sfx', 300); noise(0, 0.12, 0.12, 2000); },
  wobble: () => { tone(180, 0, 0.07, 'square', 0.09); tone(140, 0.08, 0.06, 'square', 0.07); },
  click: () => { tone(2093, 0, 0.03, 'square', 0.08); noise(0, 0.03, 0.15, 5000); },
  caught: () => { // original 6-note victory jingle
    const seq: [string, number, number][] = [['C5', 0, 0.12], ['E5', 0.12, 0.12], ['G5', 0.24, 0.12], ['C6', 0.36, 0.3], ['A5', 0.7, 0.12], ['C6', 0.82, 0.5]];
    seq.forEach(([n, t, d]) => tone(N(n), t, d, 'square', 0.07));
    [['C3', 0, 0.36], ['F3', 0.36, 0.34], ['C3', 0.7, 0.6]].forEach(([n, t, d]) => tone(N(n as string), t as number, d as number, 'triangle', 0.12));
  },
  levelUp: () => {
    ['G4', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(N(n), i * 0.075, i === 6 ? 0.4 : 0.07, 'square', 0.06));
    tone(N('C3'), 0, 0.6, 'triangle', 0.12);
  },
  stamp: () => { tone(110, 0, 0.12, 'triangle', 0.25); noise(0, 0.05, 0.12, 300); },
  page: () => noise(0, 0.12, 0.06, 3000),
  sparkle: () => [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.05, 0.1, 'square', 0.045)),
  pixel: () => tone(220 + Math.random() * 40, 0, 0.02, 'square', 0.015),
  chirp: () => { const b = 2400 + Math.random() * 600; tone(b, 0, 0.05, 'square', 0.04, 'sfx', b * 1.25); tone(b * 1.1, 0.08, 0.06, 'square', 0.035, 'sfx', b * 0.9); },
  error: () => { tone(330, 0, 0.1, 'square', 0.05); tone(247, 0.1, 0.16, 'square', 0.05); },
  fanfare: () => sfx.levelUp(),
};

// ─── recorded jingles (owner-supplied MP3s), played through WebAudio for low latency ───
type Clip = 'buy' | 'newBird' | 'levelUp' | 'throw' | TrialClip;
/** Field Trials sounds (owner-supplied pack): one per contest, plus hits, results and UI. */
export type TrialClip = 'tSong' | 'tDisplay' | 'tSky' | 'tForage' | 'tHit' | 'tCritical' | 'tRoundWin' | 'tLose' | 'tPick' | 'tTie' | 'tStart';
const CORE_CLIPS = ['buy', 'newBird', 'levelUp', 'throw'] as const;
const CLIP_URL: Record<Clip, string> = {
  buy: 'sfx/buy.mp3', newBird: 'sfx/new-bird.mp3', levelUp: 'sfx/level-up.mp3', throw: 'sfx/throw.mp3',
  tSong: 'sfx/trials/song.mp3', tDisplay: 'sfx/trials/display.mp3', tSky: 'sfx/trials/sky.mp3', tForage: 'sfx/trials/forage.mp3',
  tHit: 'sfx/trials/hit.mp3', tCritical: 'sfx/trials/critical.mp3', tRoundWin: 'sfx/trials/round-win.mp3', tLose: 'sfx/trials/lose.mp3',
  tPick: 'sfx/trials/pick.mp3', tTie: 'sfx/trials/tie.mp3', tStart: 'sfx/trials/start.mp3',
};
const clipBuf = new Map<Clip, Promise<AudioBuffer | null>>();
function loadClip(name: Clip): Promise<AudioBuffer | null> {
  const c = ac(); if (!c) return Promise.resolve(null);
  if (!clipBuf.has(name)) {
    clipBuf.set(name, fetch(CLIP_URL[name]).then((r) => r.arrayBuffer())
      .then((b) => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(b, res, rej))).catch(() => null));
  }
  return clipBuf.get(name)!;
}
let duckUntil = 0;
/** Play a recorded jingle. Long jingles dip the background music while they play. */
export async function playClip(name: Clip, opts: { duck?: boolean; vol?: number } = {}) {
  if (!getState().settings.sound) return;
  const c = ac(); if (!c || !sfxBus) return;
  const buf = await loadClip(name); if (!buf) return;
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = opts.vol ?? 0.9;
  src.connect(g).connect(sfxBus); src.start();
  if (opts.duck && musicBus) {
    const now = c.currentTime, end = now + buf.duration;
    duckUntil = Math.max(duckUntil, end);
    const mg = musicBus.gain;
    mg.cancelScheduledValues(now); mg.setValueAtTime(mg.value, now); mg.linearRampToValueAtTime(0.0001, now + 0.15);
    mg.setValueAtTime(0.0001, duckUntil); mg.linearRampToValueAtTime(0.32, duckUntil + 1.2);
    if (songGain && songEl && !songEl.paused) {
      const sg = songGain.gain;
      sg.cancelScheduledValues(now); sg.setValueAtTime(sg.value, now); sg.linearRampToValueAtTime(0.06, now + 0.2);
      sg.setValueAtTime(0.06, duckUntil); sg.linearRampToValueAtTime(SONG_VOL, duckUntil + 1.5);
    }
  }
}
/** Warm the clip cache after the first user gesture so jingles start instantly. */
export function preloadClips() { CORE_CLIPS.forEach((k) => loadClip(k)); }
/** Warm the Field Trials sounds when that screen opens (kept out of the app-wide preload). */
export function preloadTrialClips() { (Object.keys(CLIP_URL) as Clip[]).filter((k) => k.startsWith('t') && k !== 'throw').forEach((k) => loadClip(k)); }

export function haptic(pattern: number | number[] = 10) {
  if (!getState().settings.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// ─── music ───
// Each theme: tempo, lead (note,len in 8ths), bass (note,len), drum pattern over 16 steps (k=kick,s=snare,h=hat).
interface Theme { bpm: number; lead: [string, number][]; bass: [string, number][]; drums: string; leadVol?: number; leadType?: OscillatorType }
const T: Record<string, Theme> = {
  title: {
    bpm: 112,
    lead: [['E5', 2], ['G5', 2], ['A5', 2], ['B5', 2], ['A5', 1], ['G5', 1], ['E5', 2], ['D5', 2], ['E5', 2],
      ['G5', 2], ['A5', 2], ['D6', 2], ['B5', 2], ['A5', 1], ['B5', 1], ['G5', 4], ['-', 2],
      ['E5', 2], ['G5', 2], ['A5', 2], ['B5', 2], ['D6', 2], ['B5', 1], ['A5', 1], ['G5', 2], ['A5', 2],
      ['B5', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['D5', 2], ['E5', 6]],
    bass: [['E3', 4], ['E3', 4], ['C3', 4], ['C3', 4], ['G2', 4], ['G2', 4], ['D3', 4], ['D3', 4]],
    drums: 'k-h-s-h-k-kh-s-h-',
  },
  explore: {
    bpm: 124,
    lead: [['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['G5', 1], ['A5', 2], ['G5', 2], ['E5', 2], ['D5', 2], ['-', 2],
      ['D5', 1], ['F5', 1], ['A5', 2], ['F5', 1], ['A5', 1], ['B5', 2], ['A5', 2], ['G5', 2], ['E5', 4],
      ['C5', 1], ['E5', 1], ['G5', 2], ['C6', 2], ['B5', 1], ['A5', 1], ['G5', 2], ['E5', 2], ['F5', 2],
      ['G5', 2], ['F5', 1], ['E5', 1], ['D5', 2], ['B4', 2], ['C5', 6]],
    bass: [['C3', 2], ['G3', 2], ['C3', 2], ['G3', 2], ['F3', 2], ['C4', 2], ['F3', 2], ['C4', 2], ['D3', 2], ['A3', 2], ['G3', 2], ['D4', 2], ['C3', 2], ['G3', 2], ['C3', 4]],
    drums: 'k-h-s-hhk-h-s-hk',
    leadVol: 0.045,
  },
  encounter: {
    bpm: 152,
    lead: [['A4', 1], ['C5', 1], ['E5', 1], ['A5', 1], ['G5', 1], ['E5', 1], ['C5', 1], ['E5', 1], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 2],
      ['B4', 1], ['D5', 1], ['F5', 1], ['B5', 1], ['A5', 1], ['F5', 1], ['D5', 1], ['F5', 1], ['G#5', 2], ['A5', 2], ['B5', 2], ['E5', 2]],
    bass: [['A2', 1], ['A3', 1], ['A2', 1], ['A3', 1], ['A2', 1], ['A3', 1], ['A2', 1], ['A3', 1], ['F2', 1], ['F3', 1], ['F2', 1], ['F3', 1], ['G2', 1], ['G3', 1], ['G2', 1], ['G3', 1],
      ['E2', 1], ['E3', 1], ['E2', 1], ['E3', 1], ['E2', 1], ['E3', 1], ['E2', 1], ['E3', 1]],
    drums: 'k-hsk-hsk-hskkhs',
    leadVol: 0.05,
  },
  aviary: {
    bpm: 92,
    lead: [['G5', 2], ['E5', 2], ['C5', 2], ['E5', 2], ['F5', 2], ['A5', 2], ['G5', 4], ['E5', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['D5', 6], ['-', 2]],
    bass: [['C3', 4], ['A2', 4], ['F2', 4], ['G2', 4]],
    drums: '----h-------h---',
    leadVol: 0.04, leadType: 'triangle',
  },
};

let current: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function play(name: string) {
  const c = ac(); if (!c) return;
  const th = T[name];
  const eighth = 60 / th.bpm / 2;
  const lenLead = th.lead.reduce((a, [, l]) => a + l, 0);
  const lenBass = th.bass.reduce((a, [, l]) => a + l, 0);
  const loopEighths = Math.max(lenLead, lenBass);
  let nextLoop = c.currentTime + 0.08;
  const schedule = () => {
    if (!ctx) return;
    while (nextLoop < ctx.currentTime + 1.2) {
      const base = nextLoop - ctx.currentTime;
      let t = 0;
      for (const [n, l] of th.lead) { if (n !== '-') tone(N(n), base + t * eighth, l * eighth * 0.92, th.leadType ?? 'square', th.leadVol ?? 0.05, 'music'); t += l; }
      t = 0;
      for (let rep = 0; rep < Math.ceil(loopEighths / lenBass); rep++) for (const [n, l] of th.bass) { if (t < loopEighths) tone(N(n), base + t * eighth, l * eighth * 0.9, 'triangle', 0.1, 'music'); t += l; }
      for (let s = 0; s < loopEighths * 2; s++) {
        const ch = th.drums[s % th.drums.length], at = base + (s * eighth) / 2;
        if (ch === 'k') tone(120, at, 0.09, 'sine', 0.22, 'music', 45);
        else if (ch === 's') noise(at, 0.08, 0.1, 1800, 'music');
        else if (ch === 'h') noise(at, 0.025, 0.035, 7000, 'music');
      }
      nextLoop += loopEighths * eighth;
    }
  };
  schedule();
  timer = setInterval(schedule, 400);
}

/** Switch background theme. Silent until the first user gesture (browser autoplay rules). */
// The main theme is a recorded song (owner-supplied) streamed through WebAudio so it can be ducked.
const SONG_THEMES = new Set(['title', 'explore']);
const SONG_VOL = 0.5;
let songEl: HTMLAudioElement | null = null;
let songGain: GainNode | null = null;
function songStart() {
  const c = ac(); if (!c) return;
  if (!songEl) {
    songEl = new Audio('music/main-theme.mp3');
    songEl.loop = true; songEl.preload = 'auto';
    songGain = c.createGain(); songGain.gain.value = 0;
    try { c.createMediaElementSource(songEl).connect(songGain); } catch { /* already connected */ }
    songGain.connect(c.destination);
  }
  const g = songGain!.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(g.value, c.currentTime); g.linearRampToValueAtTime(SONG_VOL, c.currentTime + 0.8);
  songEl.play().catch(() => {});
}
function songStop() {
  if (!songEl || !songGain || !ctx) return;
  const g = songGain.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(g.value, ctx.currentTime); g.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
  const el = songEl; setTimeout(() => { if (!SONG_THEMES.has(current ?? '')) el.pause(); }, 600); // pause keeps the position for next time
}

export function music(name: keyof typeof T | null) {
  if (name === current) return;
  const prev = current;
  current = name;
  if (timer) { clearInterval(timer); timer = null; }
  const song = !!name && SONG_THEMES.has(name);
  if (!song) songStop();
  if (!name || !getState().settings.music || !unlocked) { if (song) songStop(); return; }
  if (song) {
    if (ctx && musicBus) { musicBus.disconnect(); musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(ctx.destination); }
    if (!(prev && SONG_THEMES.has(prev) && songEl && !songEl.paused)) songStart();
    return;
  }
  if (musicBus && ctx) { const g = musicBus.gain; g.cancelScheduledValues(ctx.currentTime); g.setValueAtTime(0, ctx.currentTime); g.linearRampToValueAtTime(0.32, ctx.currentTime + 0.4); }
  // fresh bus so already-scheduled notes from the old theme are cut
  if (ctx && musicBus) { musicBus.disconnect(); musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(ctx.destination); }
  play(name);
}
export const currentTheme = () => current;

let unlocked = false;
/** Call from any user gesture: browsers only allow audio after one. */
export function unlockAudio() {
  if (unlocked) return;
  const c = ac(); if (!c) return;
  unlocked = true;
  setTimeout(preloadClips, 500);
  const want = current; current = null;
  if (want) music(want as keyof typeof T);
}
if (typeof window !== 'undefined') {
  const u = () => { unlockAudio(); window.removeEventListener('pointerdown', u); window.removeEventListener('keydown', u); };
  window.addEventListener('pointerdown', u); window.addEventListener('keydown', u);
}

// ─── never play while the app isn't on screen ───
// Switching apps, locking the phone or closing the tab pauses ALL sound; it resumes when the player returns.
function goQuiet() {
  try { songEl?.pause(); } catch { /* ignore */ }
  try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch { /* ignore */ }
}
function wakeUp() {
  if (!unlocked || !ctx) return;
  ctx.resume().catch(() => {});
  if (current && SONG_THEMES.has(current) && getState().settings.music && songEl) songEl.play().catch(() => {});
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'hidden' ? goQuiet() : wakeUp()));
  window.addEventListener('pagehide', goQuiet);
  window.addEventListener('blur', () => { if (document.visibilityState === 'hidden') goQuiet(); });
  window.addEventListener('pageshow', () => { if (document.visibilityState === 'visible') wakeUp(); });
}
// read-only audio status for the debug panel and automated checks
if (typeof window !== 'undefined') (window as any).__audioState = () => ({ songPlaying: !!songEl && !songEl.paused, context: ctx?.state ?? 'none', theme: current });

// ─── battle music: the owner's battle track (music/battle.mp3) if it's there, else the chiptune battle theme ───
const BATTLE_URL = 'music/battle.mp3';
let battleEl: HTMLAudioElement | null = null;
let battlePrev: string | null = null;
let battleOn = false;
let battleFile: Promise<boolean> | null = null;
const hasBattleFile = () => (battleFile ??= fetch(BATTLE_URL, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') ?? 'audio').includes('audio')).catch(() => false));
/** Field Trials: start the battle music (with "Music" on in Settings) and restore the previous music afterwards. */
export async function battleMusic(on: boolean) {
  if (on === battleOn) return;
  battleOn = on;
  if (on) {
    battlePrev = current;
    if (!getState().settings.music) return;
    if (await hasBattleFile()) {
      if (!battleOn) return;
      music(null);
      battleEl = new Audio(BATTLE_URL); battleEl.loop = true; battleEl.volume = 0.55;
      battleEl.play().catch(() => {});
    } else music('encounter');
  } else {
    if (battleEl) { const el = battleEl; battleEl = null; el.pause(); }
    music((battlePrev as keyof typeof T | null) ?? null);
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!battleEl) return; if (document.visibilityState === 'hidden') battleEl.pause(); else if (battleOn) battleEl.play().catch(() => {}); });

/** In-game screens call this: silent unless the player turned on "Music during play". */
export function gameMusic(name: keyof typeof T) {
  music(getState().settings.gameMusic ? name : null);
}
