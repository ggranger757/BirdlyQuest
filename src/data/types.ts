import type { Archetype, Shape } from '../core/pixel/archetypes';
import type { ColorName } from '../core/palette';

export type Pattern = 'solid' | 'streaked' | 'barred' | 'spotted' | 'mottled' | 'iridescent';
export type Habitat = 'urban' | 'woodland' | 'water';
export type Season = 'R' | 'S' | 'W' | 'M'; // resident, breeding summer, winter, passage migrant
export type Activity = 'diurnal' | 'crepuscular' | 'nocturnal';

export interface Look {
  head: ColorName; back: ColorName; wing: ColorName; belly: ColorName; tail?: ColorName;
  beak: ColorName; legs: ColorName;
  crown?: ColorName; nape?: ColorName; cheek?: ColorName; eyeRing?: ColorName;
  crest?: ['small' | 'prominent' | 'tufts', ColorName];
  bib?: ['throat' | 'full', ColorName];
  mask?: ['thin' | 'bold', ColorName];
  wingbar?: ['single' | 'double', ColorName];
  patternLight?: boolean; // pattern drawn lighter than base (e.g. spots on a dark bird)
}

/** [seed frequency 0–1, seasonality, usual suspect] */
export type Occurrence = [number, Season, 1?];

export interface Species {
  id: string;
  common: string;
  sci: string;
  family: string;       // scientific family
  familyName: string;   // English family name
  order: string;
  archetype: Archetype;
  pattern: Pattern;
  look: Look;
  shape?: Partial<Shape>;
  habitats: Habitat[];
  sizeCm: number;
  wingspanCm?: number;
  fact: string;
  activity: Activity;
  sensitive?: boolean;
  occ: Record<string, Occurrence>;
  localNames?: Record<string, string>;
  inatId?: number;            // live species from iNaturalist
  photo?: string;             // reference photo (square) for live species
  summary?: string;           // Wikipedia summary for live species (attributed in the UI)
}

export interface Region {
  code: string;          // eBird-style region code
  country: string;       // ISO country code
  countryName: string;
  name: string;          // subnational name
  lat: number; lng: number; // region centroid, used for sun times + weather (never the player's position)
  south: boolean;        // southern hemisphere → seasons flipped
  emblem?: string;       // species id of the state/provincial/national bird
  emblemLabel?: string;
  flag?: string;
}
