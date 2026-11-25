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
import { Sprite, Icon, VERIFY_META, formatDate } from '../components';
import { FeatherIcon } from '../FeatherIcon';
import { haptic } from '../../app/audio';
import { Types, dexNo, HpBar } from '../game';
import { PageHeader, FeatherChip } from '../kit';
import { hpNow } from '../../core/pets';
import { HEX } from '../../core/palette';

/** Where a bird lives, in a few words, for the "still to find" list. */
const NEED_HAB: Record<string, string> = { urban: 'towns & yards', woodland: 'woods', water: 'water & wetlands' };

type Filter = 'all' | 'found' | 'missing';

// each goal gets its own colour and pixel emblem so the row reads like a quest board
const GOAL_LOOK: Record<string, { icon: string; color: string }> = {
  backyard: { icon: 'house', color: 'var(--moss)' },
  park: { icon: 'tree', color: 'var(--lichen)' },
  water: { icon: 'wave', color: 'var(--river)' },
  hunters: { icon: 'talon', color: 'var(--oriole)' },
};
const goalLook = (id: string) => GOAL_LOOK[id] ?? { icon: 'star', color: 'var(--sun)' };
const goalStars = (n: number, total: number) => (n >= total ? 3 : Math.floor((n / total) * 3));

/** Feather Coins bursting out of an opened chest. */
function CoinBurst() {
  const coins = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2, r = 46 + (i % 3) * 14;
    return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r - 18), delay: (i % 4) * 40 };
  });
  return (
    <span className="goal-burst" aria-hidden>
      {coins.map((c, i) => (
        <span key={i} className="particle" style={{ ['--dx' as string]: `${c.dx}px`, ['--dy' as string]: `${c.dy}px`, animationDelay: `${c.delay}ms` }}><FeatherIcon size={14} /></span>
      ))}
    </span>
  );
}

export function Dex() {
  const nav = useNav();
  const st = useGame((s) => s);
  const [, force] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<BirdType | ''>('');
  const [place, setPlace] = useState<BirdType | ''>('');
  const [q, setQ] = useState('');
  const [chap, setChap] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
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

      {/* 1. goals: a quest board */}
      {(() => {
        const doneCount = chapters.filter((c) => chapterProgress(c, found) >= c.ids.length).length;
        const chests = chapters.filter((c) => chapterProgress(c, found) >= c.ids.length && !st.chapters?.[c.id]).length;
        return (
          <div className="section-title goals-title">
            <span>Your goals <span className="goals-score">★ {doneCount}/{chapters.length}</span>{chests > 0 && <span className="goals-chests">{chests} chest{chests > 1 ? 's' : ''} to open!</span>}</span>
            {/* only offer "Show all" when the tapped goal actually has birds you've found */}
            {chap && (() => { const c = chapters.find((x) => x.id === chap); return c && chapterProgress(c, found) > 0; })() && <button className="link" style={{ minHeight: 0 }} onClick={() => setChap(null)}>Show all birds</button>}
          </div>
        );
      })()}
      <div className="hscroll chapters goals" role="list" aria-label="BirdDex goals">
        {chapters.map((c) => {
          const n = chapterProgress(c, found), total = c.ids.length, done = n >= total, claimed = !!st.chapters?.[c.id];
          const look = goalLook(c.id), stars = goalStars(n, total), left = total - n;
          const isNext = !done && c.id === current?.id;
          // birds in this goal, found ones first, so the card shows what you've collected
          const birds = c.ids.map((id) => entries.find((e) => e.sp.id === id)).filter((e): e is (typeof entries)[number] => !!e)
            .sort((a, b) => Number(mine.has(b.sp.id)) - Number(mine.has(a.sp.id)));
          const segs = Math.min(total, 12);
          const lit = done ? segs : Math.floor((n / total) * segs);
          const state = done ? (claimed ? 'claimed' : 'ready') : isNext ? 'next' : '';
          return (
            <div key={c.id} role="listitem" className={`chapter goal ${state} ${chap === c.id ? 'on' : ''} ${done ? 'done' : ''}`} style={{ ['--goal' as string]: look.color }}>
              <div className="chapter-card goal-card">
                {state === 'ready' && <span className="goal-ribbon">Complete!</span>}
                {state === 'next' && <span className="goal-ribbon">Next goal</span>}
                {state === 'claimed' && <span className="goal-ribbon muted-ribbon">Mastered</span>}
                <button className="goal-main" onClick={() => { haptic(6); setChap(chap === c.id ? null : c.id); }} aria-pressed={chap === c.id}
                  aria-label={`${c.name}: ${n} of ${total} found, ${stars} of 3 stars. ${chap === c.id ? 'Showing only these birds' : 'Show only these birds'}`}>
                  <span className="goal-head">
                    <span className="goal-emblem"><Icon name={look.icon} size={22} /></span>
                    <span className="goal-title">
                      <span className="goal-name">{c.name}</span>
                      <span className="goal-togo">{done ? 'All found!' : `${left} to go`}</span>
                    </span>
                  </span>
                  <span className="goal-blurb small">{c.blurb}</span>
                  <span className="goal-birds" aria-hidden>
                    {birds.slice(0, 6).map((e) => {
                      const s0 = mine.get(e.sp.id)?.[0];
                      return <span key={e.sp.id} className={`goal-bird ${s0 ? 'got' : ''}`}><Sprite species={e.sp} parts={s0?.sprite.parts} mode={s0 ? 'static' : 'silhouette'} scale={1} /></span>;
                    })}
                    {birds.length > 6 && <span className="goal-more">+{birds.length - 6}</span>}
                  </span>
                  <span className="goal-bar" aria-hidden>
                    {Array.from({ length: segs }, (_, i) => <i key={i} className={i < lit ? 'lit' : ''} />)}
                    {[1, 2, 3].map((k) => <b key={k} className={`goal-pip ${stars >= k ? 'on' : ''}`} style={{ left: `${(k / 3) * 100}%` }}>★</b>)}
                  </span>
                </button>
                <div className="goal-foot">
                  <span className="goal-stars" aria-hidden>{[1, 2, 3].map((k) => <span key={k} className={stars >= k ? 'on' : ''}>★</span>)}</span>
                  <span className="goal-count num">{n}/{total}</span>
                  {done && !claimed ? (
                    <button className="goal-chest ready" onClick={() => {
                      if (claimChapter(c.id, c.reward)) {
                        playClip('levelUp'); haptic(20); setBurst(c.id); setTimeout(() => setBurst(null), 1100);
                        nav.toast(`${c.name} complete! +${c.reward} Feather Coins`);
                      }
                    }} aria-label={`Open the chest: +${c.reward} Feather Coins`}>
                      <Icon name="chest" size={18} /><span>Open</span><span className="goal-reward"><FeatherIcon size={12} />+{c.reward}</span>
                    </button>
                  ) : (
                    <span className={`goal-chest ${claimed ? 'open' : 'locked'}`} aria-label={claimed ? `Reward collected: ${c.reward} Feather Coins` : `Reward: ${c.reward} Feather Coins`}>
                      <Icon name={claimed ? 'chestOpen' : 'chest'} size={18} /><span className="goal-reward"><FeatherIcon size={12} />{claimed ? '✓' : `+${c.reward}`}</span>
                    </span>
                  )}
                  {burst === c.id && <CoinBurst />}
                </div>
                {!done && (
                  <button className={`goal-need ${chap === c.id ? 'on' : ''}`} onClick={() => { haptic(6); setChap(chap === c.id ? null : c.id); }} aria-expanded={chap === c.id}>
                    {chap === c.id ? 'Hide birds needed' : `See the ${left} bird${left === 1 ? '' : 's'} needed`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(() => {
        const c = chap ? chapters.find((x) => x.id === chap) : null;
        if (!c) return null;
        const need = c.ids.map((id) => entries.find((e) => e.sp.id === id)).filter((e): e is (typeof entries)[number] => !!e && !mine.has(e.sp.id));
        const look = goalLook(c.id);
        return (
          <section className="panel goal-needs" style={{ ['--goal' as string]: look.color }} aria-label={`Birds still needed for ${c.name}`}>
            <div className="goal-needs-head">
              <b>{c.name}</b>
              <span className="small muted">{need.length ? `Still to find: ${need.length}` : 'All found!'}</span>
              <button className="link" style={{ minHeight: 0 }} onClick={() => setChap(null)} aria-label="Close">✕</button>
            </div>
            {need.length > 0 && <p className="small muted goal-needs-tip">Tap a bird to see what it looks like and where to find it.</p>}
            <ul className="goal-needs-list">
              {need.map((e) => {
                const seen = seenIds.has(e.sp.id);
                return (
                  <li key={e.sp.id}>
                    <button className="goal-need-row" onClick={() => nav.open({ name: 'species', id: e.sp.id })} aria-label={`${e.sp.common}${seen ? ', seen but not photographed yet' : ''}. Open its card`}>
                      <span className="goal-need-art"><Sprite species={e.sp} mode="silhouette" scale={1} /></span>
                      <span className="goal-need-txt">
                        <b>{e.sp.common}</b>
                        <small className="muted">{dexNo(e.dex)} · {(e.sp.habitats ?? []).map((h) => NEED_HAB[h] ?? h).join(', ')}</small>
                      </span>
                      {seen && <span className="goal-need-seen">Seen</span>}
                      <span className="goal-need-go" aria-hidden>›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}

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
