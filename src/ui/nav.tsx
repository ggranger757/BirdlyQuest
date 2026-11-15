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
  | { name: 'debug' };

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
