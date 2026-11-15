import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../nav';
import { useGame, counts, speciesOf, logEvent, claimChapter } from '../../app/store';
import { chaptersFor, chapterProgress } from '../../core/chapters';
import { playClip } from '../../app/audio';
import { getRegion } from '../../data/geo';
import { regionEntries, ensureRegion, onProviderChange, providerStatus } from '../../data/provider';
import { typesOf, BirdType, GROUP_PLURAL, GROUP_TYPES, PLACE_TYPES } from '../../core/rarity';
import { Segmented } from '../kit';
import type { Sighting } from '../../core/model';
import { Sprite, Meter, VERIFY_META, formatDate } from '../components';
import { Types, dexNo, HpBar } from '../game';
import { PageHeader, FeatherChip } from '../kit';
import { hpNow } from '../../core/pets';
import { HEX } from '../../core/palette';

type Filter = 'all' | 'found' | 'missing';

export function Dex() {
  const nav = useNav();
  const st = useGame((s) => s);
  const [, force] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<BirdType | ''>('');
  const [place, setPlace] = useState<BirdType | ''>('');
  const [q, setQ] = useState('');
  const [chap, setChap] = useState<string | null>(null);
  useEffect(() => { logEvent('journal_open'); ensureRegion(st.region); return onProviderChange(() => force((x) => x + 1)); }, [st.region]);
  useEffect(() => { if (nav.highlight) { const t = setTimeout(() => nav.setHighlight(null), 2600); return () => clearTimeout(t); } }, [nav.highlight]);

  const region = getRegion(st.region);
  const entries = regionEntries(st.region);
  const mine = useMemo(() => {
    const m = new Map<string, Sighting[]>();
    for (const s of st.sightings) if (s.speciesId && counts(s)) { const a = m.get(s.speciesId) ?? []; a.push(s); m.set(s.speciesId, a); }
    return m;
  }, [st.sightings]);
  const have = entries.filter((e) => mine.has(e.sp.id)).length;
  const outside = [...mine.keys()].filter((id) => !entries.some((e) => e.sp.id === id));
  const pending = st.sightings.filter((s) => !counts(s) && s.mode !== 'seen');
  const seenIds = new Set(st.sightings.filter((s) => s.mode === 'seen').map((s) => s.speciesId));
  const chapters = useMemo(() => chaptersFor(entries), [entries.length, st.region]);
  const found = new Set(mine.keys());
  const current = chapters.find((c) => chapterProgress(c, found) < c.ids.length || !st.chapters?.[c.id]) ?? chapters[0];
  const chapSet = chap ? new Set(chapters.find((c) => c.id === chap)?.ids ?? []) : null;
  const present = new Set(entries.flatMap((e) => typesOf(e.sp)));
  const groups = GROUP_TYPES.filter((t) => present.has(t));
  // each group: how many birds, and the most familiar local example, so the menu explains itself
  const groupInfo = (t: BirdType) => {
    const list = entries.filter((e) => typesOf(e.sp)[0] === t);
    return { n: list.length, example: list[0]?.sp.common };
  };

  const shown = entries.filter((e) => {
    const caught = mine.has(e.sp.id);
    if (chapSet && !chapSet.has(e.sp.id)) return false;
    if (filter === 'found' && !caught) return false;
    if (filter === 'missing' && caught) return false;
    if (q && !`${e.sp.common} ${e.sp.sci}`.toLowerCase().includes(q.toLowerCase()) && !String(e.dex).includes(q.replace('#', ''))) return false;
    return true;
  });
  // field-guide sections: one per bird group, in field-guide order
  const sections = groups.map((t) => ({ t, all: entries.filter((e) => typesOf(e.sp)[0] === t), list: shown.filter((e) => typesOf(e.sp)[0] === t) })).filter((x) => x.list.length);
  const jump = (t: BirdType) => { document.getElementById(`dex-${t}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  void group; void setGroup; void place; void setPlace; void groupInfo; void PLACE_TYPES;

  const cell = (e: (typeof entries)[number]) => {
    const s = mine.get(e.sp.id)?.[0];
    const seen = seenIds.has(e.sp.id);
    if (!s) {
      return (
        <li key={e.sp.id}>
          <button className={`jcell missing ${seen ? 'seen' : ''}`} onClick={() => nav.open({ name: 'species', id: e.sp.id })}
            aria-label={`${dexNo(e.dex)} ${e.sp.common}, ${seen ? 'seen but not photographed yet' : 'not found yet'}`}>
            <span className="dexno">{dexNo(e.dex)}</span>
            <span className="jcell-art"><Sprite species={e.sp} mode="silhouette" scale={2} /></span>
            <span className="cap muted">{e.sp.common}</span>
            <span className="jcell-foot" style={{ color: 'var(--accent)' }}>{seen ? 'Seen' : ''}</span>
          </button>
        </li>
      );
    }
    return (
      <li key={e.sp.id}>
        <button className={`jcell ${nav.highlight && mine.get(e.sp.id)!.some((x) => x.id === nav.highlight) ? 'fresh' : ''}`}
          style={{ background: `linear-gradient(${HEX[s.sprite.bg]}55, var(--plum) 70%)` }}
          onClick={() => nav.open({ name: 'species', id: e.sp.id })} aria-label={`${dexNo(e.dex)} ${e.sp.common}, found ${formatDate(s.capturedAt)}`}>
          <span className="dexno" style={{ color: 'var(--accent)' }}>{dexNo(e.dex)} ✓</span>
          <span className="jcell-art"><Sprite species={e.sp} parts={s.sprite.parts} scale={2} mode={nav.highlight === s.id ? 'idle' : 'static'} /></span>
          <span className="cap">{e.sp.common}</span>
          <span className="jcell-foot"><HpBar hp={hpNow(s)} compact /></span>
        </button>
      </li>
    );
  };

  return (
    <div className="screen with-tabs dex">
      <PageHeader title="BirdDex" sub={`${region.flag ?? ''} ${region.name} · ${have} of ${entries.length} found · Bird list ${mine.size}`} right={<FeatherChip />} />

      {/* 1. goals */}
      <div className="section-title"><span>Your goals</span>{chap && <button className="link" style={{ minHeight: 0 }} onClick={() => setChap(null)}>Show all birds</button>}</div>
      <div className="hscroll chapters" role="list" aria-label="BirdDex chapters">
        {chapters.map((c) => {
          const n = chapterProgress(c, found), done = n >= c.ids.length, claimed = !!st.chapters?.[c.id];
          return (
            <div key={c.id} role="listitem" className={`chapter ${chap === c.id ? 'on' : ''} ${done ? 'done' : ''}`}>
              <div className="chapter-card">
                <button className="chapter-main" onClick={() => setChap(chap === c.id ? null : c.id)} aria-pressed={chap === c.id} aria-label={`${c.name}: ${n} of ${c.ids.length}. ${chap === c.id ? 'Showing only this goal' : 'Show only these birds'}`}>
                  <span className="name small chapter-name">{c.name}</span>
                  <span className="small muted chapter-blurb">{c.blurb}</span>
                  <Meter value={n} max={c.ids.length} tone="sun" label={`${c.name} progress`} />
                </button>
                <div className="chapter-foot small">
                  <span className="num">{n}/{c.ids.length}</span>
                  {done && !claimed
                    ? <button className="btn small primary chapter-claim" onClick={() => { if (claimChapter(c.id, c.reward)) { playClip('levelUp'); nav.toast(`${c.name} complete! +${c.reward} Feathers`); } }}>Claim +{c.reward}</button>
                    : <span className="muted">{claimed ? '✓ Claimed' : `+${c.reward} Feathers`}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <section className="panel dashed mt8" aria-label="Birds waiting for a name">
          <div className="label mb8">Waiting for a name · {pending.length}</div>
          <div className="hscroll">
            {pending.map((s) => (
              <button key={s.id} className="jcell" style={{ width: 92, flex: 'none' }} onClick={() => nav.open({ name: 'species', id: s.speciesId ?? '_unknown', sightingId: s.id })}
                aria-label={`${s.speciesId ? speciesOf(s).common : 'Unidentified bird'}, ${VERIFY_META[s.verification].label}, ${formatDate(s.capturedAt)}`}>
                <span className="dexno">New</span>
                <span className="jcell-art"><Sprite species={speciesOf(s)} parts={s.sprite.parts} scale={2} mode="static" /></span>
                <span className="cap">{s.speciesId ? speciesOf(s).common : 'Unknown'}</span>
                <span className="jcell-foot small" style={{ color: 'var(--accent)' }}>Name it</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 2. find a bird */}
      <div className="dex-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up a bird by name or number" aria-label="Look up a bird"
          style={{ width: '100%', minHeight: 44, padding: '6px 12px', background: 'var(--well)', border: '2px solid var(--smoke)' }} />
        <Segmented label="Show" value={filter} onChange={setFilter} options={[
          { id: 'all', label: `All ${entries.length}` }, { id: 'found', label: `Found ${have}` }, { id: 'missing', label: `To find ${entries.length - have}` },
        ]} />
      </div>
      {/* 3. field-guide index (stays on screen while you scroll) */}
      <nav className="dex-index hscroll" aria-label="Jump to a bird group">
          {sections.map(({ t, all }) => {
            const got = all.filter((e) => mine.has(e.sp.id)).length;
            return <button key={t} className="filter" onClick={() => jump(t)}>{GROUP_PLURAL[t]} <span className="muted">{got}/{all.length}</span></button>;
          })}
      </nav>
      {providerStatus(st.region) === 'loading' && <div className="small muted mb8">Updating the list for {region.name}…</div>}
      {st.sightings.length === 0 && <p className="small muted">Nothing found yet. Photograph a real bird and it appears here in colour.</p>}

      {/* 4. the guide itself */}
      {sections.length === 0 ? <p className="small muted mt16">No birds match. Try another name, or switch to All.</p> : sections.map(({ t, all, list }) => {
        const got = all.filter((e) => mine.has(e.sp.id)).length;
        return (
          <section key={t} id={`dex-${t}`} className="dex-section" aria-label={`${GROUP_PLURAL[t]}: ${got} of ${all.length} found`}>
            <header className="dex-head">
              <span className="dex-head-name">{GROUP_PLURAL[t]}</span>
              <span className="num small">{got}/{all.length}</span>
            </header>
            <ul className="jgrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>{list.map(cell)}</ul>
          </section>
        );
      })}
      {outside.length > 0 && <p className="small muted mt16">+ {outside.length} birds found in other regions (see your Bird list on the Trainer tab).</p>}
      <p className="small muted mt16">Local list: species with research-grade iNaturalist records in {region.name}.</p>
    </div>
  );
}
