// Battle potions (v1.43; 17 since v1.50). Three colours, so they read at a glance:
//   red   = fills the Attack gauge   (each pip: your bird hits 10% harder)
//   blue  = fills the Defense gauge  (each pip: your bird takes 10% less damage)
//   green = fills both
// Bigger bottles unlock as your birder level rises. Bought with Feather Coins in Woods' Shop,
// drunk from the Bag in a battle (it uses your turn, like a snack). Gauges empty after every battle.

export const GAUGE_MAX = 5;
export const GAUGE_STEP = 0.1;

export type PotionKind = 'atk' | 'def' | 'both';
export interface Potion {
  id: string; name: string; kind: PotionKind;
  atk: number; def: number; // pips added to the Attack / Defense gauges
  fill: number;             // the bigger of the two (for sorting and tags)
  level: number;            // birder level that unlocks it
  price: number;            // Feather Coins
  img: string;              // the owner's pixel art
}
const P = (id: string, name: string, atk: number, def: number, level: number, price: number, art: string): Potion =>
  ({ id, name, kind: atk && def ? 'both' : atk ? 'atk' : 'def', atk, def, fill: Math.max(atk, def), level, price, img: `items/potions/${art}.png` });

// Ids never change (players own them); levels spread across the climb to Lv50 (v1.50).
export const POTIONS: Potion[] = [
  P('atk1', 'Attack Vial', 1, 0, 1, 15, 'p1'),
  P('def1', 'Defense Vial', 0, 1, 1, 15, 'p8'),
  P('atk2', 'Attack Flask', 2, 0, 5, 30, 'p23'),
  P('def2', 'Defense Flask', 0, 2, 5, 30, 'p9'),
  P('both1', 'Green Tonic', 1, 1, 9, 40, 'p29'),
  P('atk3', 'Attack Bottle', 3, 0, 13, 55, 'p20'),
  P('def3', 'Defense Bottle', 0, 3, 13, 55, 'p10'),
  P('both2', 'Forest Draught', 2, 2, 17, 80, 'p46'),
  P('atk5', 'Ember Draught', 4, 0, 21, 95, 'p33'),
  P('def5', 'Frost Draught', 0, 4, 21, 95, 'p36'),
  P('both4', 'Sprout Tonic', 3, 3, 25, 120, 'p22'),
  P('atk4', 'Fire Elixir', 5, 0, 29, 140, 'tonic'),
  P('def4', 'Steel Elixir', 0, 5, 29, 140, 'polish'),
  P('both5', 'Moss Elixir', 4, 4, 34, 180, 'p34'),
  P('dragon', 'Dragon Draught', 5, 2, 38, 210, 'p18'),
  P('titan', 'Titan Draught', 2, 5, 38, 210, 'p24'),
  P('both3', 'Golden Elixir', 5, 5, 44, 260, 'elixir'),
];
export const potionById = (id: string) => POTIONS.find((p) => p.id === id);
export const KIND_META: Record<PotionKind, { label: string; color: string }> = {
  atk: { label: 'Attack', color: '#E0483A' },
  def: { label: 'Defense', color: '#3A8FE0' },
  both: { label: 'Attack + Defense', color: '#4CC25A' },
};
const amt = (n: number) => (n >= GAUGE_MAX ? 'full' : `+${n}`);
/** "Attack +2", "Defense full", "Attack +1 & Defense +1" */
export function potionTag(p: Potion): string {
  if (p.atk && p.def) return `Attack ${amt(p.atk)} & Defense ${amt(p.def)}`;
  return p.atk ? `Attack ${amt(p.atk)}` : `Defense ${amt(p.def)}`;
}
/** What it does, in a sentence. */
export function potionSays(p: Potion): string {
  const by = (n: number) => (n >= GAUGE_MAX ? 'all the way' : `by ${n}`);
  if (p.atk && !p.def) return `Fills your bird’s Attack gauge ${by(p.atk)}, so it hits harder. Battles only.`;
  if (p.def && !p.atk) return `Fills your bird’s Defense gauge ${by(p.def)}, so it gets hurt less. Battles only.`;
  if (p.atk === p.def) return `Fills both gauges ${by(p.atk)}: hits harder and gets hurt less. Battles only.`;
  return `Fills Attack ${by(p.atk)} and Defense ${by(p.def)}. Battles only.`;
}
/** Apply a potion to a bird's gauges; returns the new values. */
export function drink(p: Potion, atk: number, def: number): { atk: number; def: number } {
  return { atk: Math.min(GAUGE_MAX, atk + p.atk), def: Math.min(GAUGE_MAX, def + p.def) };
}
