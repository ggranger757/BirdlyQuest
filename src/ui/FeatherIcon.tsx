// The in-game currency: a golden pixel feather. Used on every price and balance so Feathers read as money.
const ROWS = [
  '..........kk',
  '........kkGk',
  '.......kGGYk',
  '......kGGYk.',
  '.....kGGYYk.',
  '....kGGYYk..',
  '...kGGYYk...',
  '..kGGYYk....',
  '..kGYYk.....',
  '.kGYYk......',
  '.kYYk.......',
  'kqkk........',
  'kq..........',
  'q...........',
];
const PAL: Record<string, string> = { k: '#3A2408', G: '#F2C14E', Y: '#FFE7A0', q: '#8C5A2B' };

export function FeatherIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" shapeRendering="crispEdges" aria-hidden style={{ display: 'inline-block', flex: 'none', verticalAlign: '-2px' }}>
      {ROWS.flatMap((r, y) => [...r].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PAL[c]} />)))}
    </svg>
  );
}
