// FIELD 32 — the only palette in the game (spec pack §A).
// Index order is load-bearing: sprites store palette indices, never RGB.

export const FIELD32 = [
  ['ink', '#14121F'], ['plum', '#2B2440'], ['slate', '#3F3B57'], ['smoke', '#5B5A7A'],
  ['ash', '#8A8BA3'], ['stone', '#B9BCC9'], ['paper', '#E8E4D8'], ['cream', '#F7F4E9'],
  ['umber', '#4A3426'], ['bark', '#8C5A2B'], ['rust', '#C2622F'], ['brick', '#A8452F'],
  ['amber', '#E8A33D'], ['sun', '#F2C14E'], ['pine', '#24553F'], ['fern', '#3F7A3F'],
  ['moss', '#6FA84B'], ['lichen', '#A8C66C'], ['olive', '#7A7A3F'], ['deep', '#1F3F6E'],
  ['ocean', '#2E6F9E'], ['river', '#5AA9C9'], ['sky', '#9FD3E0'], ['ice', '#D6EEF2'],
  ['robin', '#F2A0B5'], ['rose', '#C94F7C'], ['violet', '#7B4FA8'], ['indigo', '#4A3F8F'],
  ['oriole', '#E86A4A'], ['warbler', '#D9C26A'], ['belly', '#F0E2C8'], ['eye', '#1A1A1A'],
] as const;

export type ColorName = (typeof FIELD32)[number][0];

export const NAMES: ColorName[] = FIELD32.map((c) => c[0]);
export const HEX: string[] = FIELD32.map((c) => c[1]);

export const IDX = Object.fromEntries(FIELD32.map((c, i) => [c[0], i])) as Record<ColorName, number>;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const RGB: [number, number, number][] = HEX.map(hexToRgb);

/** Transparent marker in sprite index buffers. */
export const CLEAR = 255;
