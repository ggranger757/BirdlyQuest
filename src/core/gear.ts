// Armor for a specific bird: joins the armor catalogue (armor.ts) with battle styles (trials.ts).
import type { Species } from '../data/types';
import { birdStyle } from './trials';
import { armorSet, earnedLevelUps, piecesFor, rivalLevelUps, themeFor, type ArmorLook } from './armor';

type LoggedBird = { level?: number; fieldcraft?: { total?: number }; armorDye?: string };

/** How a logged bird's armor looks right now. */
export function lookOfSighting(sp: Species, x: LoggedBird): ArmorLook {
  return { theme: themeFor(sp, birdStyle(sp)), pieces: piecesFor(earnedLevelUps(x)), dye: x.armorDye };
}
/** How a rival or wild bird's armor looks at a level. */
export function lookAtLevel(sp: Species, level: number, dye?: string): ArmorLook {
  return { theme: themeFor(sp, birdStyle(sp)), pieces: piecesFor(rivalLevelUps(level)), dye };
}
/** The full set (owned and still to come) for a logged bird. */
export function setOfSighting(sp: Species, x: LoggedBird) {
  const ups = earnedLevelUps(x);
  return { ups, ...armorSet(sp, birdStyle(sp), ups) };
}
