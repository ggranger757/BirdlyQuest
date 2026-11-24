// Battle potions (v1.43). Three colours, so they read at a glance:
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
  fill: number;   // pips added to each gauge it fills
  level: number;  // birder level that unlocks it
  price: number;  // Feather Coins
  img: string;    // the owner's pixel art
}
const P = (id: string, name: string, kind: PotionKind, fill: number, level: number, price: number, art: string): Potion =>
  ({ id, name, kind, fill, level, price, img: `items/potions/${art}.png` });

export const POTIONS: Potion[] = [
  P('atk1', 'Attack Vial', 'atk', 1, 1, 15, 'p1'),
  P('def1', 'Defense Vial', 'def', 1, 1, 15, 'p8'),
  P('atk2', 'Attack Flask', 'atk', 2, 6, 30, 'p23'),
  P('def2', 'Defense Flask', 'def', 2, 6, 30, 'p9'),
  P('both1', 'Green Tonic', 'both', 1, 10, 40, 'p29'),
  P('atk3', 'Attack Bottle', 'atk', 3, 16, 50, 'p20'),
  P('def3', 'Defense Bottle', 'def', 3, 16, 50, 'p10'),
  P('both2', 'Forest Draught', 'both', 2, 22, 75, 'p46'),
  P('atk4', 'Fire Elixir', 'atk', 5, 30, 90, 'tonic'),
  P('def4', 'Steel Elixir', 'def', 5, 30, 90, 'polish'),
  P('both3', 'Golden Elixir', 'both', 5, 40, 160, 'elixir'),
];
export const potionById = (id: string) => POTIONS.find((p) => p.id === id);
export const KIND_META: Record<PotionKind, { label: string; color: string }> = {
  atk: { label: 'Attack', color: '#E0483A' },
  def: { label: 'Defense', color: '#3A8FE0' },
  both: { label: 'Attack + Defense', color: '#4CC25A' },
};
/** "Attack +2", "Defense +5 (full)", "Attack +1 & Defense +1" */
export function potionTag(p: Potion): string {
  const n = p.fill >= GAUGE_MAX ? 'full' : `+${p.fill}`;
  return p.kind === 'both' ? `Attack ${n} & Defense ${n}` : `${KIND_META[p.kind].label} ${n}`;
}
/** What it does, in a sentence. */
export function potionSays(p: Potion): string {
  const amt = p.fill >= GAUGE_MAX ? 'all the way' : `by ${p.fill}`;
  if (p.kind === 'atk') return `Fills your bird’s Attack gauge ${amt}, so it hits harder. Battles only.`;
  if (p.kind === 'def') return `Fills your bird’s Defense gauge ${amt}, so it gets hurt less. Battles only.`;
  return `Fills both gauges ${amt}: hits harder and gets hurt less. Battles only.`;
}
/** Apply a potion to a bird's gauges; returns the new values. */
export function drink(p: Potion, atk: number, def: number): { atk: number; def: number } {
  return {
    atk: p.kind === 'def' ? atk : Math.min(GAUGE_MAX, atk + p.fill),
    def: p.kind === 'atk' ? def : Math.min(GAUGE_MAX, def + p.fill),
  };
}
