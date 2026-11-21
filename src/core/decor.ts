// Aviary decor (v1.29): 50 bird feeders and 50 perches, sold in Woods' Shop.
// Each is a design × a colourway; the pixel art lives in src/render/decor.ts.

export type FeederShape = 'tube' | 'cottage' | 'platform' | 'globe' | 'lantern' | 'suet' | 'hopper' | 'teacup' | 'gourd' | 'tower';
export type PerchShape = 'fence' | 'statue' | 'ruins' | 'glow' | 'toadstool' | 'lamp' | 'stump' | 'bath' | 'rune' | 'blossom';

export interface FeederPal { roof: string; roofHi: string; body: string; trim: string }
/** a: main material, b: second material, c: accent, d: glow or highlight */
export interface PerchPal { a: string; b: string; c: string; d: string }
export interface FeederDef { id: string; kind: 'feeder'; name: string; design: string; colourway: string; shape: FeederShape; pal: FeederPal; level: number; price: number; desc: string }
export interface PerchDef { id: string; kind: 'perch'; name: string; design: string; colourway: string; shape: PerchShape; pal: PerchPal; level: number; price: number; desc: string; variant: number }
export type DecorDef = FeederDef | PerchDef;

const FEEDER_SHAPES: [FeederShape, string, number, number, string][] = [
  ['tube', 'Tube Feeder', 1, 40, 'A glass tube of seed with little perch ports. The backyard classic.'],
  ['cottage', 'Cottage Feeder', 2, 60, 'A tiny cottage with a shingled roof and a seed window.'],
  ['platform', 'Platform Tray', 3, 70, 'An open tray under a little canopy. Big birds love the room.'],
  ['globe', 'Globe Feeder', 4, 90, 'A glass globe of seed that sparkles in the sun.'],
  ['lantern', 'Lantern Feeder', 5, 110, 'An old-fashioned lantern, full of seed instead of flame.'],
  ['suet', 'Suet Cage', 6, 120, 'A wire cage of seedy suet. Woodpeckers can’t resist it.'],
  ['hopper', 'Hopper Box', 7, 140, 'A sturdy box that drops seed into the tray as birds eat.'],
  ['teacup', 'Teacup Feeder', 8, 160, 'A painted teacup on a saucer. Very civilised.'],
  ['gourd', 'Gourd Feeder', 9, 180, 'A painted dried gourd, the oldest feeder there is.'],
  ['tower', 'Tower Feeder', 10, 220, 'Three tiers of seed for a busy aviary.'],
];
const FEEDER_PALS: [string, FeederPal, number][] = [
  ['Classic', { roof: '#B4532A', roofHi: '#E8943A', body: '#9A6A3E', trim: '#6B3A1E' }, 1],
  ['Meadow', { roof: '#3E8E4A', roofHi: '#8CD27A', body: '#E6D9B8', trim: '#2E5E33' }, 1.1],
  ['Ocean', { roof: '#2F6FB0', roofHi: '#7FC0F0', body: '#E4EEF4', trim: '#1D3F66' }, 1.2],
  ['Berry', { roof: '#A83E78', roofHi: '#EE8CC2', body: '#EAD8EC', trim: '#5E1F42' }, 1.3],
  ['Midnight', { roof: '#262B4A', roofHi: '#E8C04A', body: '#3C4260', trim: '#14172A' }, 1.5],
];

/** Perches: [shape, name, level, base price, description, five colourways]. */
const PERCH_SHAPES: [PerchShape, string, number, number, string, [string, PerchPal][]][] = [
  ['fence', 'Picket Fence', 1, 30, 'Three pickets and a rail, with wildflowers at the foot.', [
    ['White', { a: '#EFEBE0', b: '#6FB84F', c: '#F2C94C', d: '#FFFFFF' }], ['Weathered', { a: '#A79A84', b: '#7FA35A', c: '#E8E0C8', d: '#D8CDB6' }],
    ['Barn Red', { a: '#B0432F', b: '#5FA445', c: '#FFFFFF', d: '#E2735C' }], ['Sage', { a: '#93AE80', b: '#4E9A4A', c: '#E96A8E', d: '#C4DDB0' }], ['Midnight', { a: '#3C4266', b: '#3E7C4A', c: '#C6A2F0', d: '#7A82B8' }]]],
  ['statue', 'Statue Head', 2, 60, 'A sleeping stone head on a plinth. Birds love its curls.', [
    ['Marble', { a: '#E8E3D8', b: '#B9B2A4', c: '#9C968A', d: '#FFFFFF' }], ['Bronze', { a: '#B06E36', b: '#7E6A55', c: '#4FA58A', d: '#F0B070' }],
    ['Jade', { a: '#4FA27C', b: '#8E8A80', c: '#2E6E52', d: '#A6F0C8' }], ['Obsidian', { a: '#2C2836', b: '#55505E', c: '#B98AFF', d: '#7A6E92' }], ['Golden', { a: '#E3B43E', b: '#8E7A5A', c: '#B5812A', d: '#FFF0A8' }]]],
  ['ruins', 'Ruin Stones', 3, 70, 'A broken column and a fallen block from a forgotten temple.', [
    ['Sandstone', { a: '#D8B47C', b: '#C29A62', c: '#7FA35A', d: '#F2D8A8' }], ['Mossy', { a: '#8E9284', b: '#767A6C', c: '#5FAE48', d: '#B8BCAC' }],
    ['Basalt', { a: '#4E4E5A', b: '#3C3C46', c: '#6F9A5A', d: '#7A7A88' }], ['Moonstone', { a: '#BCC6E2', b: '#9AA4C4', c: '#8FE0FF', d: '#E8F0FF' }], ['Rose Granite', { a: '#C98C86', b: '#AE726C', c: '#8FB86A', d: '#EAB8B2' }]]],
  ['glow', 'Glow Sticks', 4, 80, 'Crystal rods in a rock that glow softly all night.', [
    ['Firefly', { a: '#C8FF5A', b: '#5E5A66', c: '#F4FFB0', d: '#C8FF5A' }], ['Frost', { a: '#7FE8FF', b: '#5A6070', c: '#E0FAFF', d: '#7FE8FF' }],
    ['Ember', { a: '#FF9A3C', b: '#5A4A44', c: '#FFE0A0', d: '#FF8A2C' }], ['Fairy', { a: '#FF8FD8', b: '#5E5266', c: '#FFE0F4', d: '#FF8FD8' }], ['Arcane', { a: '#B98AFF', b: '#4A4458', c: '#EAD8FF', d: '#A97AFF' }]]],
  ['toadstool', 'Toadstool', 5, 90, 'A giant mushroom, just the right height for a bird.', [
    ['Scarlet', { a: '#D8362F', b: '#EFE6D0', c: '#FFFFFF', d: '#FF7A6A' }], ['Brown Cap', { a: '#8A5A35', b: '#E6DABE', c: '#F2E2B8', d: '#C08A5A' }],
    ['Glowcap', { a: '#2F8FE0', b: '#D8EEF2', c: '#B8F4FF', d: '#5FD8FF' }], ['Golden', { a: '#E3A82E', b: '#F0E4C4', c: '#FFF4C0', d: '#FFD86A' }], ['Lilac', { a: '#A884DC', b: '#EAE0EE', c: '#FFFFFF', d: '#D2B8FF' }]]],
  ['lamp', 'Lamp Post', 6, 110, 'An old street lamp. Birds sit on top while it glows.', [
    ['Iron', { a: '#30364A', b: '#4A526A', c: '#FFE7A0', d: '#FFD86A' }], ['Brass', { a: '#B8872E', b: '#7A5A22', c: '#FFF0B8', d: '#FFD86A' }],
    ['Seafoam', { a: '#4E9C8E', b: '#2E6A60', c: '#E0FFF4', d: '#8FFFE0' }], ['Ruby', { a: '#8E2E3A', b: '#5E1E28', c: '#FFD0C0', d: '#FF8A7A' }], ['Moonlit', { a: '#5A6A9A', b: '#3A4670', c: '#E4ECFF', d: '#A8C8FF' }]]],
  ['stump', 'Tree Stump', 7, 130, 'An old stump with growth rings and a little moss.', [
    ['Oak', { a: '#6E4A2A', b: '#D9B57E', c: '#5FAE48', d: '#8A6038' }], ['Birch', { a: '#E6E2D6', b: '#E8CFA0', c: '#2A2A2A', d: '#FFFFFF' }],
    ['Mossy', { a: '#5E4A32', b: '#C8A672', c: '#4FA23A', d: '#8FD06A' }], ['Hollow', { a: '#5A3E26', b: '#C89E68', c: '#1E140C', d: '#7E5A3A' }], ['Autumn', { a: '#6A4426', b: '#DDB07A', c: '#E0702A', d: '#F2B248' }]]],
  ['bath', 'Bird Bath', 8, 150, 'A pedestal basin of fresh water for splashing.', [
    ['Stone', { a: '#A9A49A', b: '#6FC3E8', c: '#7FA35A', d: '#D8D4CA' }], ['Terracotta', { a: '#C0653A', b: '#6FC3E8', c: '#E8A07A', d: '#E89A70' }],
    ['Marble', { a: '#E6E1D6', b: '#7FD0F0', c: '#B8B2A4', d: '#FFFFFF' }], ['Copper', { a: '#5FAE93', b: '#7FD0F0', c: '#B87333', d: '#9FE0C8' }], ['Mosaic', { a: '#3E7CC7', b: '#8FE0F8', c: '#F2C94C', d: '#E8F0FF' }]]],
  ['rune', 'Rune Stone', 9, 170, 'An ancient standing stone carved with glowing runes.', [
    ['Moss', { a: '#8A8C84', b: '#5FAE48', c: '#9CFF6A', d: '#9CFF6A' }], ['Frost', { a: '#C6D2E2', b: '#E8F4FF', c: '#6FE0FF', d: '#6FE0FF' }],
    ['Ember', { a: '#4A4246', b: '#6A5A50', c: '#FF8A2C', d: '#FF8A2C' }], ['Arcane', { a: '#5A5470', b: '#7A6E92', c: '#C08AFF', d: '#C08AFF' }], ['Golden', { a: '#C9AE7A', b: '#A88E5A', c: '#FFD84A', d: '#FFD84A' }]]],
  ['blossom', 'Blossom Tree', 10, 200, 'A little flowering tree that drops petals in the breeze.', [
    ['Cherry', { a: '#5E3A2A', b: '#F2A3C4', c: '#FFD8E8', d: '#FFFFFF' }], ['Plum', { a: '#4A2E2A', b: '#C8508A', c: '#F290BE', d: '#FFE0F0' }],
    ['Magnolia', { a: '#6A4A36', b: '#F4E2EA', c: '#E8A8C4', d: '#FFFFFF' }], ['Wisteria', { a: '#5A4432', b: '#A98BE0', c: '#D8C4FF', d: '#FFFFFF' }], ['Maple', { a: '#5E3A22', b: '#E0562C', c: '#F2A43A', d: '#FFD86A' }]]],
];
const r5 = (n: number) => Math.round(n / 5) * 5;
const VAR_MULT = [1, 1.1, 1.2, 1.3, 1.5];

export const FEEDERS: FeederDef[] = FEEDER_SHAPES.flatMap(([shape, name, level, price, desc]) => FEEDER_PALS.map(([pn, pal, k]) => ({
  id: `feeder-${shape}-${pn.toLowerCase()}`, kind: 'feeder' as const, name: `${pn} ${name}`, design: name, colourway: pn, shape, pal, level, desc,
  price: shape === 'tube' && pn === 'Classic' ? 0 : r5(price * k),
})));
export const PERCHES: PerchDef[] = PERCH_SHAPES.flatMap(([shape, name, level, price, desc, vars]) => vars.map(([vn, pal], v) => ({
  id: `perch-${shape}-${vn.toLowerCase().replace(/\s+/g, '')}`, kind: 'perch' as const, name: `${vn} ${name}`, design: name, colourway: vn, shape, pal, level, desc, variant: v, price: r5(price * VAR_MULT[v]),
})));
export const DEFAULT_FEEDER = 'feeder-tube-classic';
export const DECOR: Record<string, DecorDef> = Object.fromEntries([...FEEDERS, ...PERCHES].map((d) => [d.id, d]));
export const feederOf = (id?: string) => (DECOR[id ?? ''] as FeederDef | undefined)?.kind === 'feeder' ? (DECOR[id!] as FeederDef) : (DECOR[DEFAULT_FEEDER] as FeederDef);
export const perchOf = (id?: string) => (DECOR[id ?? ''] as PerchDef | undefined)?.kind === 'perch' ? (DECOR[id!] as PerchDef) : null;

/** v1.28 perches (all twigs and branches) → the v1.29 set, same slot, same colourway position. */
const OLD_PERCH = ['twig', 'oak', 'blossom', 'pine', 'driftwood', 'bamboo', 'swing', 'ladder', 'pillar', 'arch'];
const OLD_VAR = ['spring', 'autumn', 'cherry', 'frosted', 'golden'];
export function migratePerchId(id: string): string {
  const m = /^perch-([a-z]+)-([a-z]+)$/.exec(id);
  if (!m || DECOR[id]) return id;
  const si = OLD_PERCH.indexOf(m[1]), vi = OLD_VAR.indexOf(m[2]);
  if (si < 0 || vi < 0) return id;
  return PERCHES.find((p) => p.shape === PERCH_SHAPES[si][0] && p.variant === vi)?.id ?? id;
}
