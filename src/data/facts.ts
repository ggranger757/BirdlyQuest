// True facts about a species: the curated fact first, then sentences from its Wikipedia summary (via iNaturalist).
import type { Species } from './types';
import { getJSON } from './provider';

const cache = new Map<string, Promise<string[]>>();
const strip = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** Split a summary into readable, self-contained sentences (skips the opening "X is a species of…" line when there are others). */
export function factSentences(summary: string): string[] {
  const sents = strip(summary).split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim())
    .filter((x) => /[.!?]$/.test(x) && x.length >= 40 && x.length <= 240);
  const rest = sents.slice(1);
  return rest.length ? rest : sents;
}

export function factsFor(sp: Species): Promise<string[]> {
  if (cache.has(sp.id)) return cache.get(sp.id)!;
  const p = (async () => {
    const out: string[] = [];
    if (sp.fact) out.push(sp.fact);
    try {
      let id = sp.inatId;
      if (!id && sp.sci) {
        const j = await getJSON(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sp.sci)}&rank=species&per_page=3`);
        id = (j.results ?? []).find((r: any) => r.name?.toLowerCase() === sp.sci.toLowerCase())?.id;
      }
      if (id) {
        const t = (await getJSON(`https://api.inaturalist.org/v1/taxa/${id}`)).results?.[0];
        if (t?.wikipedia_summary) out.push(...factSentences(t.wikipedia_summary));
      } else if (sp.summary) out.push(...factSentences(sp.summary));
    } catch { if (sp.summary) out.push(...factSentences(sp.summary)); }
    return [...new Set(out)].slice(0, 8);
  })();
  cache.set(sp.id, p);
  p.then((x) => { if (!x.length) cache.delete(sp.id); });
  return p;
}
