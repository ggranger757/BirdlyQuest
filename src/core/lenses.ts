// Snap Lenses. Each adds Snap Power to camera photos and records birds with its own effect.
// Effects are built from the owner-supplied fx sheets in public/fx, recoloured and arranged in different patterns.
export type LensId = string;
export type LensTier = 'common' | 'rare' | 'epic' | 'legendary';
export type LensPattern = 'single' | 'double' | 'ring3' | 'ring6' | 'swarm' | 'rain' | 'orbit' | 'rainbow';
export type ParticleShape = 'star' | 'heart' | 'drop' | 'leaf' | 'snow' | 'diamond' | 'bolt' | 'feather' | 'sparkle' | 'ring';
type Sheet = 'ripple' | 'bubble' | 'ember' | 'arcane' | 'phantom';

export const SHEETS: Record<Sheet, { src: string; fw: number; fh: number; frames: number; fps: number }> = {
  ripple: { src: 'fx/ripple.png', fw: 40, fh: 40, frames: 8, fps: 14 },
  bubble: { src: 'fx/bubble.png', fw: 11, fh: 11, frames: 3, fps: 8 },
  ember: { src: 'fx/ember.png', fw: 16, fh: 26, frames: 6, fps: 14 },
  arcane: { src: 'fx/arcane.png', fw: 16, fh: 26, frames: 6, fps: 14 },
  phantom: { src: 'fx/phantom.png', fw: 64, fh: 64, frames: 8, fps: 12 },
};

export interface Lens {
  id: LensId; name: string; price: number; desc: string; tier: LensTier;
  /** trainer level needed to buy it */
  level: number;
  /** Snap Power bonus added to every camera photo recorded with this lens */
  power: number;
  fx: { src: string; fw: number; fh: number; frames: number; fps: number };
  /** CSS filter applied to the effect (recolours the sheet) */
  filter?: string;
  pattern: LensPattern;
  /** pixel particles that burst out with the effect */
  particles?: { shape: ParticleShape; colors: string[]; count: number };
  /** capsule colours: A = shell, a = shell shade, g = glass */
  colors: { A: string; a: string; g: string };
}

export const TIER_META: Record<LensTier, { label: string; level: number; color: string }> = {
  common: { label: 'Common', level: 1, color: '#B6C0C9' },
  rare: { label: 'Rare', level: 4, color: '#5AA9C9' },
  epic: { label: 'Epic', level: 8, color: '#B48BE0' },
  legendary: { label: 'Legendary', level: 12, color: '#F2C14E' },
};

// shell colour → shell shade and glass tint
function capsule(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mix = (k: number, t: number) => `#${[r, g, b].map((c) => Math.round(c + (t - c) * k).toString(16).padStart(2, '0')).join('')}`;
  return { A: hex, a: mix(0.45, 0), g: mix(0.7, 255) };
}
const hue = (deg: number, extra = '') => `hue-rotate(${deg}deg)${extra ? ` ${extra}` : ''}`;

type Def = [id: string, name: string, tier: LensTier, power: number, price: number, sheet: Sheet, pattern: LensPattern, color: string, desc: string, filter?: string];
const DEFS: Def[] = [
  // common: starter looks, small boosts
  ['ripple', 'Ripple Lens', 'common', 0, 0, 'ripple', 'single', '#B3B0FF', 'A soft ring of light. Every explorer starts with one.'],
  ['dewdrop', 'Dewdrop Lens', 'common', 2, 30, 'bubble', 'swarm', '#7FD9A8', 'Morning dew beads around your bird.', hue(120)],
  ['sunbeam', 'Sunbeam Lens', 'common', 3, 40, 'ripple', 'single', '#F2C14E', 'A warm golden pulse, like the first light of day.', hue(200, 'saturate(1.4)')],
  ['pebble', 'Pebble Lens', 'common', 3, 45, 'bubble', 'rain', '#9AA3AD', 'Smooth stones tumble down like a rockfall.', 'grayscale(1) brightness(1.2)'],
  ['meadow', 'Meadow Lens', 'common', 4, 55, 'ripple', 'double', '#8DC63F', 'Two green ripples, like wind across tall grass.', hue(80)],
  ['bubble', 'Bubble Lens', 'common', 5, 60, 'bubble', 'swarm', '#7CCBFF', 'Records your bird in a stream of bubbles.'],
  ['cinder', 'Cinder Lens', 'common', 5, 70, 'ember', 'single', '#E8743C', 'One bright crescent of campfire light.'],
  ['lilac', 'Lilac Lens', 'common', 5, 75, 'ripple', 'ring3', '#D7A6FF', 'Three little rings bloom like spring lilacs.', hue(40)],
  // rare
  ['tidepool', 'Tidepool Lens', 'rare', 8, 100, 'bubble', 'orbit', '#3FC1C9', 'Bubbles circle your bird like a rock-pool current.', hue(-20)],
  ['jade', 'Jade Lens', 'rare', 8, 105, 'ripple', 'double', '#3FAF7A', 'A deep green double pulse of polished jade.', hue(120)],
  ['frost', 'Frost Lens', 'rare', 9, 110, 'arcane', 'ring3', '#9FD8FF', 'Icy crescents crackle around your bird.', hue(-80, 'brightness(1.3)')],
  ['coral', 'Coral Lens', 'rare', 9, 115, 'bubble', 'swarm', '#FF8FA3', 'A reef of pink bubbles drifts upward.', hue(150, 'saturate(1.5)')],
  ['ember', 'Ember Lens', 'rare', 10, 120, 'ember', 'ring3', '#FF9A3C', 'Three flaming crescents spin around your bird.'],
  ['twilight', 'Twilight Lens', 'rare', 10, 130, 'arcane', 'single', '#7B6CD9', 'A single violet arc, like dusk settling.'],
  ['blaze', 'Blaze Lens', 'rare', 11, 140, 'ember', 'ring6', '#FF6A2B', 'A full ring of fire crescents.'],
  ['storm', 'Storm Lens', 'rare', 11, 145, 'bubble', 'rain', '#5B7FD6', 'A sudden downpour of blue raindrops.', hue(30, 'saturate(1.3)')],
  ['sunflare', 'Sunflare Lens', 'rare', 12, 160, 'ember', 'orbit', '#FFC23C', 'Golden flares orbit your bird.', hue(25, 'brightness(1.15)')],
  // epic
  ['arcane', 'Arcane Lens', 'epic', 15, 180, 'arcane', 'ring3', '#B98AFF', 'Violet crescents: Merlin’s own favourite.'],
  ['nebula', 'Nebula Lens', 'epic', 16, 200, 'phantom', 'single', '#7C8CFF', 'A swirl of star-stuff that fades to sparkles.', hue(-100)],
  ['aurora', 'Aurora Lens', 'epic', 16, 210, 'ripple', 'ring6', '#5FE3B8', 'Six shimmering rings, like the northern lights.', hue(140, 'saturate(1.4)')],
  ['inferno', 'Inferno Lens', 'epic', 17, 220, 'ember', 'ring6', '#E8402B', 'A blazing crown of red fire.', hue(-20, 'saturate(1.6)')],
  ['glacier', 'Glacier Lens', 'epic', 17, 230, 'arcane', 'ring6', '#BFEFFF', 'Six crystal crescents, cold as a glacier.', hue(-90, 'brightness(1.4)')],
  ['wisp', 'Wisp Lens', 'epic', 18, 240, 'phantom', 'double', '#9CFFD6', 'Two friendly spirit wisps visit your bird.', hue(-170)],
  ['starfall', 'Starfall Lens', 'epic', 18, 245, 'bubble', 'rain', '#FFE36B', 'Shooting stars rain down around your bird.', hue(230, 'saturate(1.8) brightness(1.2)')],
  ['moonlight', 'Moonlight Lens', 'epic', 19, 250, 'ripple', 'double', '#E9ECF5', 'Silver rings of moonlight.', 'grayscale(1) brightness(1.6)'],
  ['phantom', 'Phantom Lens', 'epic', 20, 260, 'phantom', 'single', '#FF6BD6', 'A spooky spirit swirl that fades to sparkles.'],
  // legendary
  ['phoenix', 'Phoenix Lens', 'legendary', 22, 320, 'ember', 'rainbow', '#FF5A1F', 'A firebird’s halo in every colour of flame.', 'saturate(1.6)'],
  ['leviathan', 'Leviathan Lens', 'legendary', 23, 340, 'bubble', 'orbit', '#1F8FBF', 'Deep-sea bubbles whirl around your bird.', hue(-40, 'saturate(1.5)')],
  ['dragon', 'Dragon Lens', 'legendary', 24, 360, 'arcane', 'ring6', '#2FBF71', 'Six emerald dragon scales spin into place.', hue(-200, 'saturate(1.6)')],
  ['eclipse', 'Eclipse Lens', 'legendary', 25, 380, 'phantom', 'double', '#2B2B3A', 'Darkness, then a ring of light.', 'grayscale(1) contrast(1.4)'],
  ['galaxy', 'Galaxy Lens', 'legendary', 26, 400, 'phantom', 'orbit', '#6A5BFF', 'A spiral galaxy turns around your bird.', hue(-120, 'saturate(1.5)')],
  ['thunderbird', 'Thunderbird Lens', 'legendary', 27, 440, 'arcane', 'orbit', '#FFE14D', 'Lightning crescents crackle in orbit.', hue(150, 'brightness(1.5) saturate(1.6)')],
  ['celestial', 'Celestial Lens', 'legendary', 28, 480, 'ripple', 'rainbow', '#C9D7FF', 'Six rings, each a different star colour.'],
  ['prism', 'Prism Lens', 'legendary', 29, 520, 'bubble', 'rainbow', '#FF9CF2', 'Bubbles split light into a full rainbow.', 'saturate(1.5)'],
  ['merlin', 'Merlin’s Eye Lens', 'legendary', 30, 600, 'arcane', 'rainbow', '#F2C14E', 'The lens Merlin carries. Only the greatest explorers earn it.', 'saturate(1.4)'],
];

export const LENSES: Record<LensId, Lens> = Object.fromEntries(DEFS.map(([id, name, tier, power, price, sheet, pattern, color, desc, filter]) =>
  [id, { id, name, tier, power, price, desc, pattern, filter, fx: SHEETS[sheet], level: TIER_META[tier].level, colors: capsule(color) }]));
const P: Record<string, [ParticleShape, string[], number]> = {
  dewdrop: ['drop', ['#7FD9A8', '#C9F7E2'], 8], sunbeam: ['sparkle', ['#F2C14E', '#FFF3B0'], 8], pebble: ['diamond', ['#9AA3AD', '#D4D9DE', '#6B7480'], 8],
  meadow: ['leaf', ['#8DC63F', '#3F7A3F', '#C8E67A'], 10], bubble: ['ring', ['#7CCBFF', '#D8F1FF'], 8], cinder: ['sparkle', ['#FF9A3C', '#FFD08A'], 8],
  lilac: ['heart', ['#D7A6FF', '#F2D9FF'], 10], tidepool: ['drop', ['#3FC1C9', '#9FE8EC', '#1F7F86'], 10], jade: ['leaf', ['#3FAF7A', '#9FE0BF'], 10],
  frost: ['snow', ['#9FD8FF', '#FFFFFF'], 12], coral: ['heart', ['#FF8FA3', '#FFC2CD', '#FF5C7A'], 12], ember: ['sparkle', ['#FF9A3C', '#FFE08A'], 10],
  twilight: ['star', ['#7B6CD9', '#C9C2FF'], 10], blaze: ['sparkle', ['#FF6A2B', '#FFC23C', '#FF3B1F'], 14], storm: ['bolt', ['#FFE14D', '#FFFFFF'], 10],
  sunflare: ['star', ['#FFC23C', '#FFF0A8'], 12], arcane: ['star', ['#B98AFF', '#E6D4FF'], 12], nebula: ['star', ['#7C8CFF', '#FF8FD8', '#C9D7FF'], 14],
  aurora: ['sparkle', ['#5FE3B8', '#8FB8FF', '#FF9CF2'], 14], inferno: ['sparkle', ['#E8402B', '#FF8A3C', '#FFD23C'], 16], glacier: ['snow', ['#BFEFFF', '#FFFFFF', '#7FC8F0'], 14],
  wisp: ['ring', ['#9CFFD6', '#E0FFF3'], 12], starfall: ['star', ['#FFE36B', '#FFFFFF'], 16], moonlight: ['star', ['#E9ECF5', '#B6C0C9'], 12], phantom: ['heart', ['#FF6BD6', '#FFC9F1'], 12],
  phoenix: ['feather', ['#FF5A1F', '#FFC23C', '#FF2B4E'], 16], leviathan: ['drop', ['#1F8FBF', '#7FD3FF', '#0E4F7A'], 16], dragon: ['diamond', ['#2FBF71', '#9FF0C4', '#F2C14E'], 16],
  eclipse: ['ring', ['#FFFFFF', '#2B2B3A', '#F2C14E'], 14], galaxy: ['star', ['#6A5BFF', '#FF8FD8', '#8FE3FF', '#FFFFFF'], 18], thunderbird: ['bolt', ['#FFE14D', '#FFFFFF', '#F2A33C'], 16],
  celestial: ['star', ['#C9D7FF', '#FFE36B', '#FF9CF2', '#8FE3FF'], 18], prism: ['diamond', ['#FF5C7A', '#FFC23C', '#7FE37F', '#5AB8FF', '#B98AFF'], 20],
  merlin: ['feather', ['#F2C14E', '#FFF3B0', '#B98AFF'], 20],
};
for (const [id, [shape, colors, count]] of Object.entries(P)) if (LENSES[id]) LENSES[id].particles = { shape, colors, count };

export const LENS_ORDER: LensId[] = DEFS.map((d) => d[0]);
export const LENS_TIERS: LensTier[] = ['common', 'rare', 'epic', 'legendary'];
export const lensOf = (id?: string): Lens => (id && LENSES[id]) || LENSES.ripple;
/** Snap Power after the lens bonus (camera photos only), capped at 100. */
export const boostedPower = (base: number, lens?: string) => Math.min(100, base + lensOf(lens).power);
