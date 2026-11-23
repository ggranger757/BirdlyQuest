// Bird armor (v1.37). Real birds don't evolve, so instead they gear up: every few level-ups a bird earns a new piece
// of armor, in a theme picked for its species (fantasy knight, cyberpunk, wasteland, mecha, clockwork, samurai,
// celestial, druid). Each piece comes with a battle ability; names follow the bird's species and battle style.
// Armor is counted in level-ups EARNED since the bird was logged, so every bird gets the whole journey.
import type { Species } from '../data/types';
import type { Contest } from './trials';

export type ArmorTheme = 'arcane' | 'neon' | 'wasteland' | 'mecha' | 'clockwork' | 'shogun' | 'celestial' | 'verdant';
export type SlotId = 'amulet' | 'helm' | 'chest' | 'wings' | 'talons' | 'pack' | 'sigil' | 'aura';

/** Pieces in the order they're earned, and the level-up that brings each one. */
export const SLOTS: { id: SlotId; at: number; label: string }[] = [
  { id: 'amulet', at: 2, label: 'Necklace' },
  { id: 'helm', at: 3, label: 'Helmet' },
  { id: 'chest', at: 5, label: 'Chestplate' },
  { id: 'wings', at: 8, label: 'Wing guards' },
  { id: 'talons', at: 12, label: 'Talons' },
  { id: 'pack', at: 17, label: 'Back gear' },
  { id: 'sigil', at: 23, label: 'Sigil' },
  { id: 'aura', at: 30, label: 'Aura' },
];
export const MAX_LEVEL = 50;

/** What each piece does in battle. */
export const ABILITY: Record<SlotId, { text: string }> = {
  amulet: { text: '+1 signature skill use' },
  helm: { text: 'Takes 10% less damage' },
  chest: { text: '+12% HP' },
  wings: { text: '+12% speed' },
  talons: { text: '+10% power' },
  pack: { text: 'Super meter fills 25% faster' },
  sigil: { text: 'Starts battles with 25% Super' },
  aura: { text: '+6% HP and power' },
};
/** The ability's name follows the bird's battle style, so armor complements how it fights. */
const ABILITY_NAME: Record<Contest, Record<SlotId, string>> = {
  song: { amulet: 'Encore', helm: 'Steady Voice', chest: 'Resonant Core', wings: 'Quick Tempo', talons: 'Crescendo', pack: 'Amplifier', sigil: 'Overture', aura: 'Harmony' },
  display: { amulet: 'Second Bow', helm: 'Poise', chest: 'Grand Plumage', wings: 'Flourish', talons: 'Spotlight', pack: 'Showstopper', sigil: 'Curtain Up', aura: 'Radiance' },
  sky: { amulet: 'Second Wind', helm: 'Slipstream', chest: 'Hollow Bones', wings: 'Tailwind', talons: 'Stoop Strike', pack: 'Afterburner', sigil: 'Head Start', aura: 'Jet Stream' },
  forage: { amulet: 'Second Helping', helm: 'Thick Skull', chest: 'Fat Reserves', wings: 'Scamper', talons: 'Iron Grip', pack: 'Full Larder', sigil: 'Early Bird', aura: 'Abundance' },
};

/** Each theme: its name, metal (base / light / dark), trim and glowing accent. */
export const THEMES: Record<ArmorTheme, { label: string; blurb: string; metal: [string, string, string]; trim: string; glow: string; words: Record<SlotId, string> }> = {
  arcane: { label: 'Fantasy', blurb: 'Enchanted knight’s plate with rune gems and a plume.', metal: ['#8C96A8', '#D8DEE8', '#4A5266'], trim: '#E8B83A', glow: '#7CE0FF',
    words: { amulet: 'Rune Torc', helm: 'Plumed Helm', chest: 'Knight’s Cuirass', wings: 'Pauldrons', talons: 'Gauntlet Talons', pack: 'Royal Cape', sigil: 'Crest of Runes', aura: 'Arcane Aura' } },
  neon: { label: 'Cyberpunk', blurb: 'Carbon plating, a glowing visor and a jet pack.', metal: ['#2B2F45', '#5A6488', '#14162A'], trim: '#FF3FD8', glow: '#2EF2FF',
    words: { amulet: 'Data Choker', helm: 'Neon Visor', chest: 'Circuit Vest', wings: 'Holo Fins', talons: 'Chrome Claws', pack: 'Jet Pack', sigil: 'Glitch Glyph', aura: 'Neon Halo' } },
  wasteland: { label: 'Dystopian', blurb: 'Scrap-metal armour, a gas mask and a fuel tank.', metal: ['#7A5A40', '#B08A5E', '#3E2C22'], trim: '#E0B020', glow: '#FF7A1A',
    words: { amulet: 'Dog Tags', helm: 'Gas Mask', chest: 'Scrap Plate', wings: 'Rust Guards', talons: 'Rebar Talons', pack: 'Fuel Tank', sigil: 'Hazard Mark', aura: 'Ember Haze' } },
  mecha: { label: 'Mecha', blurb: 'White armour plates, a V-fin and thrusters.', metal: ['#E8ECF4', '#FFFFFF', '#8A94AC'], trim: '#2F5BD8', glow: '#FFD23F',
    words: { amulet: 'Core Reactor', helm: 'V-Fin Helm', chest: 'Mobile Armour', wings: 'Wing Binders', talons: 'Strike Talons', pack: 'Thruster Pack', sigil: 'Unit Emblem', aura: 'Trans-Am Glow' } },
  clockwork: { label: 'Steampunk', blurb: 'Brass, rivets, goggles and a little boiler.', metal: ['#B07A34', '#E8C070', '#5E3A18'], trim: '#5A3A22', glow: '#9EE8D0',
    words: { amulet: 'Cog Locket', helm: 'Aviator Goggles', chest: 'Brass Corset', wings: 'Gear Guards', talons: 'Piston Talons', pack: 'Steam Boiler', sigil: 'Guild Seal', aura: 'Steam Halo' } },
  shogun: { label: 'Samurai', blurb: 'Lacquered plates, a horned kabuto and a war banner.', metal: ['#A8242C', '#E05A4A', '#4A0E14'], trim: '#141014', glow: '#F2C94C',
    words: { amulet: 'Prayer Beads', helm: 'Kabuto', chest: 'Lacquer Dō', wings: 'Sode Plates', talons: 'Tekko Talons', pack: 'War Banner', sigil: 'Clan Mon', aura: 'Ki Aura' } },
  celestial: { label: 'Celestial', blurb: 'Starlit silver, a halo and an orbiting star.', metal: ['#C8D0F0', '#FFFFFF', '#6A74A8'], trim: '#F6D77A', glow: '#B79BFF',
    words: { amulet: 'Star Pendant', helm: 'Halo Circlet', chest: 'Moon Mail', wings: 'Comet Guards', talons: 'Starfall Talons', pack: 'Orbiting Star', sigil: 'Constellation', aura: 'Starlight' } },
  verdant: { label: 'Druid', blurb: 'Bark and leaf armour, a flower crown and a shell.', metal: ['#6E8A3A', '#A8C46A', '#34461C'], trim: '#7A4E2A', glow: '#FF8FB8',
    words: { amulet: 'Seed Necklace', helm: 'Leaf Crown', chest: 'Bark Mail', wings: 'Leaf Guards', talons: 'Root Talons', pack: 'Moss Cloak', sigil: 'Bloom Mark', aura: 'Pollen Glow' } },
};
export const THEME_IDS = Object.keys(THEMES) as ArmorTheme[];

/** Dyes the player can pick once a bird has armor ('theme' keeps the theme's own colours). */
export const DYES: Record<string, { label: string; metal?: [string, string, string]; trim?: string }> = {
  theme: { label: 'Original' },
  gold: { label: 'Gold', metal: ['#D9A520', '#FFE27A', '#7A5208'], trim: '#FFF4C2' },
  silver: { label: 'Silver', metal: ['#A8B0BC', '#EEF2F6', '#5A6270'], trim: '#3A4250' },
  bronze: { label: 'Bronze', metal: ['#A8683A', '#E0A070', '#552C14'], trim: '#F2D29A' },
  copper: { label: 'Copper', metal: ['#C8603A', '#F4A07A', '#5E2414'], trim: '#5ED0B0' },
  platinum: { label: 'Platinum', metal: ['#D4D8E0', '#FFFFFF', '#8A90A0'], trim: '#7AA8FF' },
  obsidian: { label: 'Obsidian', metal: ['#2A2430', '#544A60', '#0E0A12'], trim: '#B79BFF' },
  onyx: { label: 'Onyx', metal: ['#3A3A3E', '#6E6E76', '#141416'], trim: '#E8E8EC' },
  crimson: { label: 'Crimson', metal: ['#B02A30', '#F06A5A', '#520C12'], trim: '#F2C94C' },
  ruby: { label: 'Ruby', metal: ['#C8184A', '#FF6A8E', '#5A0620'], trim: '#FFE0EA' },
  sunset: { label: 'Sunset', metal: ['#E8742A', '#FFC07A', '#7A2E0A'], trim: '#5A1A40' },
  amber: { label: 'Amber', metal: ['#E0A020', '#FFD870', '#7A4A08'], trim: '#3A2A10' },
  lemon: { label: 'Lemon', metal: ['#E8D22A', '#FFF59A', '#7A6A08'], trim: '#2A2A2A' },
  lime: { label: 'Lime', metal: ['#8AC83A', '#D0F290', '#3A6014'], trim: '#1A2A10' },
  jade: { label: 'Jade', metal: ['#2E9A6A', '#7EE0B0', '#0E4A30'], trim: '#F2E6C2' },
  forest: { label: 'Forest', metal: ['#2E6A3A', '#6EAA6A', '#123018'], trim: '#D8B060' },
  teal: { label: 'Teal', metal: ['#1E8A94', '#6ED8E0', '#0A3E44'], trim: '#F2F2E0' },
  sky: { label: 'Sky', metal: ['#4AA8E8', '#A8DCFF', '#1A4E7A'], trim: '#FFFFFF' },
  cobalt: { label: 'Cobalt', metal: ['#2F5BD8', '#7FA4FF', '#122A6A'], trim: '#E8ECF4' },
  navy: { label: 'Navy', metal: ['#22305E', '#4E62A0', '#0C1430'], trim: '#E8C860' },
  violet: { label: 'Violet', metal: ['#7A3AC8', '#BC90F4', '#34125E'], trim: '#F2E0FF' },
  rose: { label: 'Rose', metal: ['#D86A9A', '#FFB0D0', '#6A2440'], trim: '#FFFFFF' },
  bubblegum: { label: 'Bubblegum', metal: ['#F088C8', '#FFC8EA', '#8A2A6A'], trim: '#6AE0FF' },
  ivory: { label: 'Ivory', metal: ['#E8DCC0', '#FFFAEA', '#9A8A66'], trim: '#B08A3A' },
};
/** Gem and glow colours (necklace gem, visor, eyes, sparkles), chosen separately from the metal. */
export const GLOWS: Record<string, { label: string; hex?: string }> = {
  theme: { label: 'Original' }, cyan: { label: 'Cyan', hex: '#2EF2FF' }, magenta: { label: 'Magenta', hex: '#FF3FD8' }, ember: { label: 'Ember', hex: '#FF7A1A' },
  sun: { label: 'Sun', hex: '#FFD23F' }, mint: { label: 'Mint', hex: '#5BFF9A' }, violet: { label: 'Violet', hex: '#B79BFF' }, ruby: { label: 'Ruby', hex: '#FF3A5A' },
  ice: { label: 'Ice', hex: '#D8F4FF' }, blossom: { label: 'Blossom', hex: '#FF8FB8' }, lime: { label: 'Lime', hex: '#C6FF3A' }, azure: { label: 'Azure', hex: '#3A8CFF' },
};
export const GLOW_IDS = Object.keys(GLOWS);
export const DYE_IDS = Object.keys(DYES);

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

/** The theme that suits a species: by family first (raptors are samurai or mecha, corvids wasteland or cyberpunk…), then by battle style. */
export function themeFor(sp: Pick<Species, 'id' | 'family' | 'archetype'>, style: Contest): ArmorTheme {
  const fam: Record<string, ArmorTheme[]> = {
    Accipitridae: ['shogun', 'mecha'], Falconidae: ['mecha', 'shogun'], Pandionidae: ['mecha'], Cathartidae: ['wasteland'],
    Strigidae: ['arcane', 'clockwork', 'celestial'], Tytonidae: ['celestial', 'arcane'],
    Corvidae: ['wasteland', 'neon', 'arcane'], Trochilidae: ['neon', 'celestial'], Psittacidae: ['neon', 'verdant'], Psittaculidae: ['neon', 'verdant'], Cacatuidae: ['celestial', 'neon'],
    Picidae: ['clockwork', 'wasteland'], Anatidae: ['clockwork', 'verdant'], Laridae: ['clockwork', 'mecha'], Ardeidae: ['shogun', 'celestial'], Columbidae: ['celestial', 'clockwork'],
    Phasianidae: ['shogun', 'arcane'], Numididae: ['wasteland', 'shogun'], Alcedinidae: ['neon', 'mecha'], Cardinalidae: ['arcane', 'shogun'], Sturnidae: ['neon', 'wasteland'],
  };
  const byStyle: Record<Contest, ArmorTheme[]> = { song: ['arcane', 'celestial', 'clockwork', 'verdant'], display: ['neon', 'arcane', 'shogun', 'celestial'], sky: ['mecha', 'shogun', 'celestial', 'neon'], forage: ['wasteland', 'clockwork', 'verdant', 'mecha'] };
  const list = fam[sp.family ?? ''] ?? byStyle[style];
  return list[hash(sp.id) % list.length];
}

/** Level-ups a logged bird has earned since it was logged (its catch level is 5 + fieldcraft / 5). */
export function earnedLevelUps(x: { level?: number; fieldcraft?: { total?: number } }): number {
  const start = 5 + Math.round((x.fieldcraft?.total ?? 40) / 5);
  return Math.max(0, Math.min(MAX_LEVEL, x.level ?? 5) - start);
}
/** Rival and wild birds wear armor by level (as if caught at Lv10). */
export const rivalLevelUps = (level: number) => Math.max(0, Math.min(MAX_LEVEL, level) - 10);
/** How many pieces a bird wears after `ups` level-ups. */
export const piecesFor = (ups: number) => SLOTS.filter((s) => ups >= s.at).length;

export interface ArmorPiece { slot: SlotId; label: string; name: string; ability: string; abilityName: string; at: number; owned: boolean }
/** Every piece for one bird, owned or still to come, with its unique name and ability. */
export function armorSet(sp: Pick<Species, 'id' | 'family' | 'archetype' | 'common'>, style: Contest, ups: number): { theme: ArmorTheme; pieces: ArmorPiece[] } {
  const theme = themeFor(sp, style), t = THEMES[theme];
  const short = sp.common.split(' ').slice(-1)[0];
  return {
    theme,
    pieces: SLOTS.map((s) => ({
      slot: s.id, label: s.label, at: s.at, owned: ups >= s.at,
      name: `${short}’s ${t.words[s.id]}`, abilityName: ABILITY_NAME[style][s.id], ability: ABILITY[s.id].text,
    })),
  };
}

/** Battle bonuses from the pieces a bird wears. */
export interface ArmorStats { pp: number; dr: number; hp: number; spd: number; atk: number; gauge: number; start: number }
export function armorStats(pieces: number): ArmorStats {
  const has = (id: SlotId) => pieces > SLOTS.findIndex((s) => s.id === id);
  const aura = has('aura') ? 0.06 : 0;
  return {
    pp: has('amulet') ? 1 : 0, dr: has('helm') ? 0.1 : 0, hp: (has('chest') ? 0.12 : 0) + aura, spd: has('wings') ? 0.12 : 0,
    atk: (has('talons') ? 0.1 : 0) + aura, gauge: has('pack') ? 1.25 : 1, start: has('sigil') ? 25 : 0,
  };
}

/** What the sprite painter needs. */
export interface ArmorLook { theme: ArmorTheme; pieces: number; dye?: string; glow?: string }
export const armorKey = (a?: ArmorLook | null) => (a && a.pieces > 0 ? `${a.theme}.${a.pieces}.${a.dye ?? 'theme'}.${a.glow ?? 'theme'}` : '');
