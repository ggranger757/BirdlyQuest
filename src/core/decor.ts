// Aviary decor (v1.28): 50 bird feeders and 50 perches, sold in Merlin's Shop.
// Each is a design × a colourway; the drawing lives in src/render/decor.ts.

export type FeederShape = 'tube' | 'cottage' | 'platform' | 'globe' | 'lantern' | 'suet' | 'hopper' | 'teacup' | 'gourd' | 'tower';
export type PerchShape = 'twig' | 'oak' | 'blossom' | 'pine' | 'driftwood' | 'bamboo' | 'swing' | 'ladder' | 'pillar' | 'arch';

export interface FeederPal { roof: string; roofHi: string; body: string; trim: string }
export interface PerchPal { wood: string; dark: string; leaf: string; leaf2: string; accent: string }
export interface FeederDef { id: string; kind: 'feeder'; name: string; shape: FeederShape; pal: FeederPal; level: number; price: number; desc: string }
export interface PerchDef { id: string; kind: 'perch'; name: string; shape: PerchShape; pal: PerchPal; level: number; price: number; desc: string }
export type DecorDef = FeederDef | PerchDef;

const FEEDER_SHAPES: [FeederShape, string, number, number, string][] = [
  ['tube', 'Tube Feeder', 1, 40, 'A clear tube of seed. The backyard classic.'],
  ['cottage', 'Cottage Feeder', 2, 60, 'A little house with a gabled roof and a seed window.'],
  ['platform', 'Platform Tray', 3, 70, 'An open tray. Big birds love the elbow room.'],
  ['globe', 'Globe Feeder', 4, 90, 'A glass ball of seed that sparkles in the sun.'],
  ['lantern', 'Lantern Feeder', 5, 110, 'An old-fashioned lantern, full of seed instead of flame.'],
  ['suet', 'Suet Cage', 6, 120, 'A wire cage of suet. Woodpeckers can’t resist it.'],
  ['hopper', 'Hopper Box', 7, 140, 'A sturdy box that drops seed into the tray as birds eat.'],
  ['teacup', 'Teacup Feeder', 8, 160, 'A dainty teacup on a saucer. Very civilised.'],
  ['gourd', 'Gourd Feeder', 9, 180, 'A painted dried gourd, the oldest feeder there is.'],
  ['tower', 'Tower Feeder', 10, 220, 'Three tiers of seed for a busy aviary.'],
];
const FEEDER_PALS: [string, FeederPal, number][] = [
  ['Classic', { roof: '#B4532A', roofHi: '#E8943A', body: '#8A5A35', trim: '#7A2E1E' }, 1],
  ['Meadow', { roof: '#3E8E4A', roofHi: '#7BC96F', body: '#EADFC4', trim: '#2E5E33' }, 1.1],
  ['Ocean', { roof: '#2F6FB0', roofHi: '#6FB0E8', body: '#E8F1F6', trim: '#1D3F66' }, 1.2],
  ['Berry', { roof: '#A83E78', roofHi: '#E07AB4', body: '#E9D5EA', trim: '#5E1F42' }, 1.3],
  ['Midnight', { roof: '#1F2440', roofHi: '#E8C04A', body: '#3A4058', trim: '#0E1020' }, 1.5],
];
const PERCH_SHAPES: [PerchShape, string, number, number, string][] = [
  ['twig', 'Twig Stand', 1, 30, 'A simple T-perch on a pole.'],
  ['oak', 'Oak Bough', 2, 50, 'A sturdy branch with room for two.'],
  ['blossom', 'Blossom Branch', 3, 70, 'A flowering branch that catches the light.'],
  ['pine', 'Pine Bough', 4, 80, 'A shaggy evergreen bough.'],
  ['driftwood', 'Driftwood', 5, 90, 'Sea-smoothed wood, perfect for shorebirds.'],
  ['bamboo', 'Bamboo Frame', 6, 110, 'A tidy frame of bamboo poles.'],
  ['swing', 'Rope Swing', 7, 130, 'A little swing birds can ride.'],
  ['ladder', 'Bird Ladder', 8, 150, 'Three rungs to hop between.'],
  ['pillar', 'Stone Pillar', 9, 170, 'An old garden pillar with a mossy top.'],
  ['arch', 'Garden Arch', 10, 200, 'A climbing-plant arch with perches on top.'],
];
const PERCH_PALS: [string, PerchPal, number][] = [
  ['Spring', { wood: '#7A5230', dark: '#4E331C', leaf: '#5FB24A', leaf2: '#9AD66B', accent: '#F4E06B' }, 1],
  ['Autumn', { wood: '#6E4426', dark: '#452912', leaf: '#E07A2C', leaf2: '#F2B248', accent: '#B23A2A' }, 1.1],
  ['Cherry', { wood: '#5E3A2A', dark: '#3A2218', leaf: '#F2A3C4', leaf2: '#FFD3E4', accent: '#FFFFFF' }, 1.2],
  ['Frosted', { wood: '#8E8A86', dark: '#5C5854', leaf: '#DDEFF5', leaf2: '#FFFFFF', accent: '#8FC7E8' }, 1.3],
  ['Golden', { wood: '#7A5A1A', dark: '#4A3510', leaf: '#E8C04A', leaf2: '#FFE38A', accent: '#FFFFFF' }, 1.5],
];
const r5 = (n: number) => Math.round(n / 5) * 5;

export const FEEDERS: FeederDef[] = FEEDER_SHAPES.flatMap(([shape, name, level, price, desc]) => FEEDER_PALS.map(([pn, pal, k]) => ({
  id: `feeder-${shape}-${pn.toLowerCase()}`, kind: 'feeder' as const, name: `${pn} ${name}`, shape, pal, level, desc,
  price: shape === 'tube' && pn === 'Classic' ? 0 : r5(price * k),
})));
export const PERCHES: PerchDef[] = PERCH_SHAPES.flatMap(([shape, name, level, price, desc]) => PERCH_PALS.map(([pn, pal, k]) => ({
  id: `perch-${shape}-${pn.toLowerCase()}`, kind: 'perch' as const, name: `${pn} ${name}`, shape, pal, level, desc, price: r5(price * k),
})));
export const DEFAULT_FEEDER = 'feeder-tube-classic';
export const DECOR: Record<string, DecorDef> = Object.fromEntries([...FEEDERS, ...PERCHES].map((d) => [d.id, d]));
export const feederOf = (id?: string) => (DECOR[id ?? ''] as FeederDef | undefined)?.kind === 'feeder' ? (DECOR[id!] as FeederDef) : (DECOR[DEFAULT_FEEDER] as FeederDef);
export const perchOf = (id?: string) => (DECOR[id ?? ''] as PerchDef | undefined)?.kind === 'perch' ? (DECOR[id!] as PerchDef) : null;
