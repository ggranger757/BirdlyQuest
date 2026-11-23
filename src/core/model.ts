import type { SpriteRecord, PhotoPalette } from './pixel/sprite';
import type { FieldcraftScore } from './pixel/extract';
import type { Rarity } from './rarity';
import type { CatchMode, StreakState } from './xp';
import type { Habitat, Species } from '../data/types';

export type Verification = 'verified' | 'self-reported' | 'unverified' | 'vagrant';

export interface Sighting {
  nickname?: string; // the name the player gave this bird
  id: string;
  speciesId: string | null;      // null while unverified
  region: string;
  habitat: Habitat;
  capturedAt: string;            // ISO
  day: string;                   // local YYYY-MM-DD
  hour: number;
  phase: string;                 // day phase at capture
  mode: CatchMode;
  verification: Verification;
  fieldcraft: Omit<FieldcraftScore, 'coaching' | 'tooDark'> | null;
  coaching: string[];
  rarity: Rarity;
  xp: number;
  feathers: number;
  sprite: SpriteRecord;
  palette: PhotoPalette | null;  // kept so the sprite can be re-inked if the bird is identified later
  photoId: string | null;        // key into the photo store; null once deleted
  firstRecord: boolean;
  newPlumage: boolean;
  timesSeen: number;
  note: string;
  analysisMs?: number;
  level?: number;                // collector-style level (5 + fieldcraft/5, +1 per repeat; max 50)
  armorDye?: string;             // armor colour the player picked (v1.37; see core/armor DYES)
  armorGlow?: string;            // gem / glow colour the player picked (v1.38; core/armor GLOWS)
  dex?: number;                  // regional BirdDex number at time of catch
  pet?: { hp: number; at: string; resting?: boolean }; // health at `at`; drains only while living in the Aviary
}

export type Theme = 'neon' | 'dusk' | 'ember' | 'field';
export interface Settings {
  sound: boolean; haptics: boolean; grid: boolean;
  motion: 'system' | 'reduced' | 'full';
  dyslexiaFont: boolean; refPhotos: boolean; theme: Theme; music: boolean; gameMusic: boolean;
}

export interface ChallengeSlot { id: string; param?: string | number; claimed: boolean }

export interface GameState {
  version: number;
  createdAt: string;
  onboarded: boolean;
  region: string;
  habitat: Habitat;
  xp: number;
  feathers: number;
  streak: StreakState;
  sightings: Sighting[];
  badges: Record<string, string>;       // id → earned ISO
  challenges: { day: string; daily: ChallengeSlot[]; week: string; weekly: ChallengeSlot | null; seasonal: ChallengeSlot | null; history: Record<string, string[]> };
  events: { sitSpots: string[]; shares: string[] };
  diorama: { biome: Habitat; home?: string /* chosen Bird Home scene id; unset = follows time of day */; birds: string[]; decor: Record<string, string>; feeder?: string /* feeder design in use */; perch?: string /* perch in use */; rotatedAt?: string /* last Aviary swap (v1.37) */ }; // `decor` is legacy
  ownedDecor: string[];                // feeders and perches bought in Woods' Shop (v1.28)
  ownedHomes?: string[];               // Bird Homes bought in Woods' Shop (v1.28)
  settings: Settings;
  sessions: number;
  lastSession: string | null;
  backupPromptAfter: string | null;
  firstCatchSeconds: number | null;
  installStartedAt: string;
  log: { t: string; e: string; d?: unknown }[]; // local analytics ring buffer (TEC-8), never leaves the device
  trainerName: string;
  partner: { speciesId: string; parts: number[]; nickname?: string; pet?: { hp: number; at: string } } | null;
  speciesDefs: Record<string, Species>; // live species the player has caught, kept for offline use
  items: { seeds: number; berries: number; worms: number }; // food bags in the pantry
  lenses: string[]; lens: string;
  tutorialDone?: boolean;
  tourSeen?: number;      // version of Professor Woods' tour last finished or skipped (v1.28 tour = 2)
  tourOn?: boolean;       // Merlin's full tour is running (started from Settings)
  tipsSeen?: string[];
  petGifts?: Record<string, string>; // bird id → day it last brought a gift
  lastSeenAt?: string;               // last time the app was open (for welcome-back care)
  missionSkips?: { day: string; ids: string[] }; // species skipped today
  missionSnoozeUntil?: string;                    // no mission offers until this time (after 'Not now') // sightings the player said 'not now' to today
  mission?: { speciesId: string; name: string; lat: number; lng: number; until: string } | null; // go-find-it mission from a live sighting    // one-time Merlin tips already dismissed
  chapters?: Record<string, string>; // claimed BirdDex chapter rewards (id → ISO date) // Merlin's guided tour finished or skipped // owned Snap Lenses and the one in use
  feeder: { level: number; layers?: { food: 'seeds' | 'berries' | 'worms'; pts: number }[] }; // food points in the Aviary feeder, and which food (bottom to top, v1.33)
  petDay: string | null;           // last day the aviary paid out Feather Coins
  stats: { fills: number; spent: number; quests: number };
  badgeQueue: string[];            // newly earned badges waiting for their pop-up
  trials?: { cleared: number; wins: number; day?: string; rematches?: number; tutorial?: boolean; battles?: number; wildDay?: string; tickets?: number; ticketsEarned?: number; ticketsUsed?: number; duels?: Record<string, string>; duelWins?: number }; // Field Trials progress (tickets: Trial Tickets, default 3; earned / used tallies since v1.34)
  pendingChallenge?: { sightingId: string; at: string } | null; // a wandering birder wants to see a newly discovered bird
}

export const UNKNOWN: Species = {
  id: '_unknown', common: 'Unidentified bird', sci: '', family: '', familyName: 'Unidentified', order: '',
  archetype: 'passerine', pattern: 'solid', habitats: ['urban', 'woodland', 'water'], sizeCm: 0,
  fact: 'Not every bird gives up its name on the first look. Identify it later from the journal.',
  activity: 'diurnal', occ: {},
  look: { head: 'ash', back: 'smoke', wing: 'smoke', belly: 'stone', beak: 'slate', legs: 'umber' },
};
