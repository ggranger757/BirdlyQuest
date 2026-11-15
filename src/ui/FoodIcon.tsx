// Pixel-art food icons (16×16), drawn to match the sprites instead of system emoji.
import type { Food } from '../core/pets';

const ART: Record<Food, { rows: string[]; pal: Record<string, string> }> = {
  // a tied burlap sack spilling seeds
  seeds: {
    rows: [
      '................',
      '......kkkk......',
      '.....kyyyyk.....',
      '......kkkk......',
      '.....kbbbbk.....',
      '....kbBBBBbk....',
      '...kbBBBBBBbk...',
      '..kbBBBsBBBBbk..',
      '..kbBBBBBBsBbk..',
      '..kbBsBBBBBBbk..',
      '..kbBBBBsBBBbk..',
      '..kbbBBBBBBbbk..',
      '...kkbbbbbbkk...',
      '..s..kkkkkk..s..',
      '.s.s..s..s..s.s.',
      '................',
    ],
    pal: { k: '#2A1A0E', b: '#8C5A2B', B: '#C9935A', y: '#E8C27A', s: '#F2D88A' },
  },
  // a bunch of blueberries with a leaf
  berries: {
    rows: [
      '................',
      '.......gg.......',
      '......gGGg......',
      '.......gg.k.....',
      '....kkk.kkkk....',
      '...kbBBkbBBbk...',
      '..kbBwBbkBwBbk..',
      '..kbBBBbkBBBbk..',
      '..kkbbbkkbbbkk..',
      '..kbBBBbkbBBbk..',
      '.kbBwBBbkbBwBk..',
      '.kbBBBBbkbBBBk..',
      '.kkbbbbkkkbbkk..',
      '..kkkkkk.kkkk...',
      '................',
      '................',
    ],
    pal: { k: '#1A1530', b: '#3E3C9E', B: '#6E70E0', w: '#C9CCFF', g: '#2F6B2F', G: '#6FA84B' },
  },
  // a tub with a pink worm poking out
  worms: {
    rows: [
      '................',
      '........pp......',
      '.......pPPp.....',
      '.......pPep.....',
      '........pPp.....',
      '...kkkkkkpPkkk..',
      '..kwwwwwwpPwwwk.',
      '..kkkkkkkkkkkkk.',
      '...kTTTTTTTTTk..',
      '...kTttttttTTk..',
      '...kTtTTTTTTTk..',
      '...kTTTTTTTTTk..',
      '...kTTTTTTTTTk..',
      '....kTTTTTTTk...',
      '....kkkkkkkkk...',
      '................',
    ],
    pal: { k: '#1A1A1A', w: '#F0E2C8', p: '#B0446A', P: '#F2A0B5', e: '#1A1A1A', T: '#5AA9C9', t: '#9FD3E0' },
  },
};

export function FoodIcon({ food, size = 32 }: { food: Food; size?: number }) {
  const { rows, pal } = ART[food];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden style={{ display: 'block', flex: 'none' }}>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={pal[c]} />)))}
    </svg>
  );
}
