import { createContext, useContext } from 'react';
import type { Shot } from '../app/photo';
import type { CatchMode } from '../core/xp';
import type { FieldcraftScore } from '../core/pixel/extract';

export type Tab = 'explore' | 'dex' | 'aviary' | 'you';

export interface CaptureJob {
  mode: CatchMode;
  shot: Shot;
  scoreOverride?: Partial<FieldcraftScore>;
  returnTo?: 'viewfinder' | 'journal';
}

export type Route =
  | { name: 'species'; id: string; sightingId?: string }
  | { name: 'spread'; sightingId: string }
  | { name: 'viewfinder' }
  | { name: 'catch'; job: CaptureJob }
  | { name: 'sketch' }
  | { name: 'quicklog' }
  | { name: 'shop' }
  | { name: 'badges' }
  | { name: 'challenges' }
  | { name: 'settings' }
  | { name: 'year' }
  | { name: 'lab' }
  | { name: 'debug' }
  | { name: 'trials'; wild?: string };

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  open: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  closeAll: () => void;
  toast: (t: string) => void;
  highlight: string | null;
  setHighlight: (id: string | null) => void;
  stack: Route[];
}

export const NavCtx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavCtx);

/**
 * Back guards: an in-screen layer (e.g. the camera's bird peek) that the system Back
 * gesture should close *before* the screen itself. While a guard is registered, the
 * next popstate is handed to it instead of popping the route stack.
 */
const guards: { close: () => void; depth: number }[] = [];
/**
 * Called by App's popstate handler with the route-stack depth; true when a guard consumed
 * this Back. A guard only fires when its screen is on top (a route opened over it pops first).
 */
export function consumeBackGuard(depth: number): boolean {
  const g = guards[guards.length - 1];
  if (!g || g.depth !== depth) return false;
  guards.pop();
  g.close();
  return true;
}
/** Register a guard for the screen at route-stack `depth` and push a history entry for it. */
export function pushBackGuard(depth: number, close: () => void): () => void {
  const g = { close, depth };
  guards.push(g);
  history.pushState({ guard: true }, '');
  return () => { const i = guards.indexOf(g); if (i >= 0) guards.splice(i, 1); };
}
