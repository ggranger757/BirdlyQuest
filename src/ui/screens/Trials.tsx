// Field Trials: friendly, bird-true contests. Pick a rival from the ladder, choose which of your
// photographed birds enters each round (Song-off, Display, Sky race, Forage), then watch the show.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNav } from '../nav';
import { useGame, counts, speciesOf, finishTrial } from '../../app/store';
import { regionEntries, speciesById } from '../../data/provider';
import { playClip, preloadTrialClips, sfx, haptic } from '../../app/audio';
import { TopBar, Sprite, Icon, useReducedMotion } from '../components';
import { FeatherChip } from '../kit';
import { FeatherIcon } from '../FeatherIcon';
import { Professor } from '../Characters';
import { runBackdrop } from '../../render/diorama';
import { dayKey } from '../../core/xp';
import type { Species } from '../../data/types';
import {
  CONTESTS, RIVALS, FX_CRIT, FX_RING, power, contestStat, statStars, playRound, matchWinner, bestLineup, rivalTeam, rewardFor,
  type Contest, type Contender, type RoundResult,
} from '../../core/trials';

type Sheet = { src: string; frames: number; fw: number; fh: number };

/** One animated sprite-sheet effect (projectile, burst). Pixel-crisp, scaled by an integer. */
function Fx({ sheet, scale = 2, ms = 500, loop, className, style }: { sheet: Sheet; scale?: number; ms?: number; loop?: boolean; className?: string; style?: CSSProperties }) {
  const w = sheet.fw * scale, h = sheet.fh * scale;
  return (
    <span aria-hidden className={`tfx ${className ?? ''}`} style={{
      width: w, height: h, backgroundImage: `url(${sheet.src})`, backgroundSize: `${sheet.frames * w}px ${h}px`,
      ['--sheet-w' as string]: `-${sheet.frames * w}px`, animation: `tfx ${ms}ms steps(${sheet.frames}) ${loop ? 'infinite' : '1 forwards'}`, ...style,
    }} />
  );
}

/** The player's birds: best photo of each species they've caught, plus their partner bird. */
function useTeam(): Contender[] {
  const sightings = useGame((s) => s.sightings);
  const partner = useGame((s) => s.partner);
  return useMemo(() => {
    const best = new Map<string, Contender>();
    for (const x of sightings) {
      if (!counts(x) || !x.speciesId) continue;
      const c: Contender = { sp: speciesOf(x), level: x.level ?? 5, quality: x.fieldcraft?.total ?? 40, parts: x.sprite?.parts, sightingId: x.id };
      const prev = best.get(x.speciesId);
      if (!prev || c.level + c.quality / 10 > prev.level + prev.quality / 10) best.set(x.speciesId, c);
    }
    if (partner && !best.has(partner.speciesId)) {
      const sp = speciesById(partner.speciesId);
      if (sp) best.set(sp.id, { sp, level: 5, quality: 40, parts: partner.parts, sightingId: 'partner' });
    }
    return [...best.values()];
  }, [sightings, partner]);
}

const ContestChip = ({ c, small }: { c: Contest; small?: boolean }) => (
  <span className={`tchip ${small ? 'small' : ''}`} style={{ ['--c' as string]: CONTESTS[c].color }}>{CONTESTS[c].short}</span>
);
const Stars = ({ n }: { n: number }) => <span className="tstars" aria-label={`${n} of 5`}>{'★★★★★'.slice(0, n)}<i>{'★★★★★'.slice(n)}</i></span>;

export function Trials() {
  const nav = useNav();
  const st = useGame((s) => s);
  const team = useTeam();
  const pool = useMemo(() => regionEntries(st.region).map((e) => e.sp), [st.region]);
  const [phase, setPhase] = useState<'ladder' | 'lineup' | 'show' | 'result'>('ladder');
  const [ri, setRi] = useState(0);
  const [lineup, setLineup] = useState<(Contender | null)[]>([]);
  const [slot, setSlot] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [prize, setPrize] = useState<{ coins: number; xp: number; first: boolean } | null>(null);
  const cleared = st.trials?.cleared ?? 0;
  useEffect(() => { preloadTrialClips(); }, []);

  const rival = RIVALS[ri];
  const rTeam = useMemo(() => rivalTeam(rival, pool.length ? pool : team.map((t) => t.sp), ri), [rival, pool, ri, team]);

  const pick = (i: number) => {
    sfx.select(); setRi(i); setSlot(0);
    const r = RIVALS[i];
    const line = bestLineup(team, r.contests);
    // fewer than three birds: the best one may enter more than one round
    setLineup(line.map((b, k) => b ?? [...team].sort((x, y) => power(y, r.contests[k]) - power(x, r.contests[k]))[0] ?? null));
    setPhase('lineup');
  };
  const back = () => {
    if (phase === 'ladder') nav.back();
    else { sfx.back(); setPhase('ladder'); }
  };

  return (
    <div className={`overlay trials ${phase}`}>
      <TopBar title={phase === 'ladder' ? 'Field Trials' : rival.name} onBack={back} right={<FeatherChip label={false} />} />
      {phase === 'ladder' && <Ladder team={team} cleared={cleared} wins={st.trials?.wins ?? 0} pool={pool} onPick={pick} onCamera={() => nav.open({ name: 'viewfinder' })} />}
      {phase === 'lineup' && (
        <Lineup rival={ri} rTeam={rTeam} team={team} lineup={lineup} slot={slot} setSlot={setSlot}
          assign={(b) => {
            haptic(8); playClip('tPick', { vol: 0.6 });
            setLineup((l) => {
              const n = [...l];
              const reuse = team.length < rival.contests.length;
              const at = n.findIndex((x) => x?.sp.id === b.sp.id);
              if (!reuse && at >= 0 && at !== slot) n[at] = n[slot]; // swap
              n[slot] = b; return n;
            });
            setSlot((s) => Math.min(rival.contests.length - 1, s + 1));
          }}
          onStart={() => {
            const rounds = rival.contests.map((c, k) => playRound(lineup[k]!, rTeam[k], c, Math.random));
            setResults(rounds); setPhase('show');
          }} />
      )}
      {phase === 'show' && (
        <Show rival={ri} lineup={lineup as Contender[]} rTeam={rTeam} results={results}
          onDone={() => {
            const won = matchWinner(results) === 'you';
            setPrize(finishTrial(ri, won));
            if (won) playClip('levelUp', { duck: true }); else playClip('tLose', { duck: true });
            setPhase('result');
          }} />
      )}
      {phase === 'result' && (
        <Result rival={ri} lineup={lineup as Contender[]} rTeam={rTeam} results={results} prize={prize}
          onRematch={() => pick(ri)} onLadder={() => setPhase('ladder')}
          onNext={ri + 1 < RIVALS.length && matchWinner(results) === 'you' ? () => pick(ri + 1) : undefined} />
      )}
    </div>
  );
}

// ─── 1. the ladder ───
function Ladder({ team, cleared, wins, pool, onPick, onCamera }: { team: Contender[]; cleared: number; wins: number; pool: Species[]; onPick: (i: number) => void; onCamera: () => void }) {
  const today = dayKey(new Date());
  const tst = useGame((s) => s.trials);
  return (
    <div className="trials-body">
      <div className="trials-hero">
        <Fx sheet={FX_RING} scale={2} ms={900} loop className="trials-hero-ring" />
        <div>
          <h2 style={{ margin: 0 }}>Friendly contests</h2>
          <p className="small" style={{ margin: '4px 0 0' }}>Birds compete at what real birds do best: singing, showing off, flying and finding food. Your photo quality and the bird's level give it an edge.</p>
        </div>
      </div>
      <div className="row wrap tcontests" aria-label="The four contests">
        {(Object.keys(CONTESTS) as Contest[]).map((c) => <span key={c} className="tcontest-key"><ContestChip c={c} /> <span className="small muted">{CONTESTS[c].blurb}</span></span>)}
      </div>
      {team.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>You need at least one photographed bird to enter.</p>
          <button className="btn primary" onClick={onCamera}><Icon name="photo" size={18} /> Open camera</button>
        </div>
      ) : (
        <div className="section-title"><span>Rival ladder</span><span>{Math.min(cleared, RIVALS.length)}/{RIVALS.length} · {wins} win{wins === 1 ? '' : 's'}</span></div>
      )}
      <div className="trials-ladder" role="list">
        {RIVALS.map((r, i) => {
          const locked = i > cleared, beaten = i < cleared;
          const lead = rivalTeam(r, pool.length ? pool : team.map((t) => t.sp), i)[0];
          const rw = rewardFor(tst, i, today);
          return (
            <div key={r.id} role="listitem" className={`trival ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''} ${i === cleared ? 'next' : ''} ${r.merlin ? 'boss' : ''}`}>
              <div className="trival-portrait">
                {r.merlin ? <Professor height={48} /> : lead ? <Sprite species={lead.sp} scale={2} mode={locked ? 'silhouette' : 'idle'} flip /> : null}
              </div>
              <div className="trival-main">
                <div className="row between"><b className="trival-name">{r.name}</b><span className="px small muted">Lv{r.level}</span></div>
                <div className="small muted">{r.title}</div>
                <div className="row" style={{ gap: 4, marginTop: 4 }}>{r.contests.map((c, k) => <ContestChip key={k} c={c} small />)}</div>
              </div>
              <div className="trival-side">
                {beaten && <span className="trival-badge">✓ Beaten</span>}
                {locked ? <span className="trival-lock" aria-label="Locked: beat the rival above first">🔒</span> : (
                  <button className="btn small primary" disabled={team.length === 0} onClick={() => onPick(i)} aria-label={`Challenge ${r.name}`}>{beaten ? 'Rematch' : 'Challenge'}</button>
                )}
                <span className="trival-prize small">{rw.coins ? <><FeatherIcon size={12} /> +{rw.coins}</> : <span className="muted">no prize today</span>}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>First win pays the full prize. Rematches pay a small bonus, 3 times a day. Losing costs nothing.</p>
    </div>
  );
}

// ─── 2. the lineup ───
function Lineup({ rival, rTeam, team, lineup, slot, setSlot, assign, onStart }: {
  rival: number; rTeam: Contender[]; team: Contender[]; lineup: (Contender | null)[]; slot: number; setSlot: (n: number) => void; assign: (b: Contender) => void; onStart: () => void;
}) {
  const r = RIVALS[rival];
  const c = r.contests[slot];
  const sorted = [...team].sort((a, b) => power(b, c) - power(a, c));
  return (
    <div className="trials-body">
      <div className="trival-say"><b>{r.name}:</b> “{r.line}”</div>
      <div className="section-title"><span>Your lineup</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>tap a round, then a bird</span></div>
      <div className="tslots">
        {r.contests.map((cc, k) => {
          const mine = lineup[k], them = rTeam[k];
          const a = mine ? power(mine, cc) : 0, b = power(them, cc);
          const odds = !mine ? '' : a - b >= 8 ? 'Favoured' : b - a >= 8 ? 'Underdog' : 'Close call';
          return (
            <button key={k} className={`tslot ${slot === k ? 'on' : ''}`} onClick={() => { sfx.select(); setSlot(k); }} aria-pressed={slot === k}
              aria-label={`Round ${k + 1}, ${CONTESTS[cc].name}: ${mine ? mine.sp.common : 'no bird'} (${a}) versus ${them.sp.common} (${b}). ${odds}`}>
              <span className="tslot-head"><span className="px small">R{k + 1}</span><ContestChip c={cc} /></span>
              <span className="tslot-vs">
                <span className="tslot-bird">{mine ? <Sprite species={mine.sp} parts={mine.parts} scale={2} mode="static" /> : <span className="tslot-empty">?</span>}<b className="num">{mine ? a : '–'}</b></span>
                <span className="px small muted">vs</span>
                <span className="tslot-bird them"><Sprite species={them.sp} scale={2} mode="static" flip /><b className="num">{b}</b></span>
              </span>
              <span className={`tslot-odds ${odds === 'Favoured' ? 'good' : odds === 'Underdog' ? 'bad' : ''}`}>{odds || 'Pick a bird'}</span>
            </button>
          );
        })}
      </div>
      <div className="section-title"><span>Pick for round {slot + 1}: {CONTESTS[c].name}</span></div>
      <div className="tpicker" role="list">
        {sorted.map((b) => {
          const v = power(b, c), inUse = lineup.findIndex((x) => x?.sp.id === b.sp.id);
          return (
            <button key={b.sp.id} role="listitem" className={`tpick ${lineup[slot]?.sp.id === b.sp.id ? 'on' : ''}`} onClick={() => assign(b)}
              aria-label={`${b.sp.common}, ${CONTESTS[c].short} power ${v}${inUse >= 0 ? `, in round ${inUse + 1}` : ''}`}>
              <Sprite species={b.sp} parts={b.parts} scale={2} mode="static" />
              <span className="tpick-name small">{b.sp.common}</span>
              <Stars n={statStars(contestStat(b.sp, c))} />
              <span className="tpick-pow num">{v}</span>
              {inUse >= 0 && <span className="tpick-tag">R{inUse + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="trials-cta">
        <button className="btn primary big block" disabled={lineup.some((x) => !x)} onClick={() => { playClip('tStart'); haptic(12); onStart(); }}>Start the trial ▶</button>
      </div>
    </div>
  );
}

// ─── 3. the show ───
type Beat = { round: number; banner?: boolean; proj?: 'you' | 'rival'; boom?: 'you' | 'rival'; score?: { you?: number; rival?: number }; verdict?: boolean; crit?: boolean };

function Show({ rival, lineup, rTeam, results, onDone }: { rival: number; lineup: Contender[]; rTeam: Contender[]; results: RoundResult[]; onDone: () => void }) {
  const r = RIVALS[rival];
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState<Beat>({ round: 0, banner: true });
  const [shake, setShake] = useState(false);
  const skip = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const res = results[beat.round];
  const c = CONTESTS[res.contest];

  // backdrop follows the contest of the current round
  useEffect(() => { const cv = canvas.current; if (!cv) return; return runBackdrop(cv, c.scene, { focus: 0.5, reduced }); }, [c.scene, reduced]);

  useEffect(() => {
    let live = true;
    const wait = (ms: number) => new Promise<void>((ok) => setTimeout(ok, skip.current ? 0 : reduced ? Math.min(ms, 450) : ms));
    (async () => {
      for (let k = 0; k < results.length && live; k++) {
        const rr = results[k], def = CONTESTS[rr.contest];
        setBeat({ round: k, banner: true }); if (!skip.current) playClip('tStart', { vol: 0.5 });
        await wait(1150); if (!live) return;
        // your bird performs
        setBeat({ round: k, proj: 'you' }); if (!skip.current) playClip(def.clip, { vol: 0.8 });
        await wait(650); if (!live) return;
        setBeat({ round: k, boom: 'rival', score: { you: rr.you } }); if (!skip.current) playClip('tHit', { vol: 0.6 });
        await wait(700); if (!live) return;
        // the rival answers
        setBeat({ round: k, proj: 'rival', score: { you: rr.you } }); if (!skip.current) playClip(def.clip, { vol: 0.7 });
        await wait(650); if (!live) return;
        setBeat({ round: k, boom: 'you', score: { you: rr.you, rival: rr.rival } }); if (!skip.current) playClip('tHit', { vol: 0.6 });
        await wait(750); if (!live) return;
        // verdict
        setBeat({ round: k, verdict: true, crit: rr.critical, score: { you: rr.you, rival: rr.rival } });
        if (!skip.current) {
          if (rr.critical) { playClip('tCritical'); if (!reduced) { setShake(true); setTimeout(() => setShake(false), 420); } haptic([20, 40, 30]); }
          else playClip(rr.winner === 'you' ? 'tRoundWin' : 'tTie', { vol: 0.8 });
        }
        await wait(1500);
      }
      if (live) onDone();
    })();
    return () => { live = false; };
  }, []);

  const you = lineup[beat.round], them = rTeam[beat.round];
  const done = results.slice(0, beat.verdict ? beat.round + 1 : beat.round);
  const winner = beat.verdict ? res.winner : null;
  return (
    <div className={`tstage ${shake ? 'shake' : ''}`} style={{ ['--c' as string]: c.color }}>
      <canvas ref={canvas} className="tstage-bg pix" aria-hidden />
      <div className="tstage-hud">
        <span className="tstage-name">You</span>
        <span className="tstage-dots" aria-label={`Round ${beat.round + 1} of ${results.length}`}>
          {results.map((x, i) => <i key={i} className={i < done.length ? (x.winner === 'you' ? 'w' : x.winner === 'rival' ? 'l' : 't') : i === beat.round ? 'now' : ''} />)}
        </span>
        <span className="tstage-name">{r.name}</span>
      </div>
      <button className="btn small ghost tstage-skip" onClick={() => { skip.current = true; }}>Skip ▸▸</button>

      {beat.banner && (
        <div className="tbanner" role="status">
          <span className="px small">Round {beat.round + 1}</span>
          <b className="tbanner-name">{c.name}</b>
          <span className="small">{c.blurb}</span>
        </div>
      )}

      <div className={`tbird you ${beat.proj === 'you' ? 'perform' : ''} ${winner === 'you' ? 'win' : winner === 'rival' ? 'lose' : ''}`}>
        {beat.score?.you != null && <span className="tscore">{beat.score.you}</span>}
        <Sprite species={you.sp} parts={you.parts} scale={4} mode={beat.proj === 'you' ? 'fly' : 'idle'} />
        <span className="tbird-name small">{you.sp.common}</span>
        {beat.boom === 'you' && !reduced && <Fx sheet={c.boom} scale={3} ms={520} className="tboom" />}
        {beat.verdict && winner === 'you' && <Fx sheet={FX_RING} scale={3} ms={600} className="tboom" />}
        {beat.verdict && beat.crit && winner === 'rival' && !reduced && <Fx sheet={FX_CRIT} scale={4} ms={700} className="tboom" />}
      </div>
      <div className={`tbird rival ${beat.proj === 'rival' ? 'perform' : ''} ${winner === 'rival' ? 'win' : winner === 'you' ? 'lose' : ''}`}>
        {beat.score?.rival != null && <span className="tscore">{beat.score.rival}</span>}
        <Sprite species={them.sp} scale={4} mode={beat.proj === 'rival' ? 'fly' : 'idle'} flip />
        <span className="tbird-name small">{them.sp.common}</span>
        {beat.boom === 'rival' && !reduced && <Fx sheet={c.boom} scale={3} ms={520} className="tboom" />}
        {beat.verdict && winner === 'rival' && <Fx sheet={FX_RING} scale={3} ms={600} className="tboom" />}
        {beat.verdict && beat.crit && winner === 'you' && !reduced && <Fx sheet={FX_CRIT} scale={4} ms={700} className="tboom" />}
      </div>

      {beat.proj && !reduced && (
        <span key={`${beat.round}-${beat.proj}`} className={`tproj from-${beat.proj}`}>
          <Fx sheet={c.proj} scale={3} ms={360} loop style={beat.proj === 'rival' ? { transform: 'scaleX(-1)' } : undefined} />
        </span>
      )}

      {beat.verdict && (
        <div className={`tverdict ${winner}`} role="status">
          {beat.crit && <span className="tcrit px">Critical!</span>}
          <b>{winner === 'you' ? `${you.sp.common} wins the ${c.name}!` : winner === 'rival' ? `${them.sp.common} takes the ${c.name}` : 'A dead heat!'}</b>
        </div>
      )}
    </div>
  );
}

// ─── 4. the result ───
function Result({ rival, lineup, rTeam, results, prize, onRematch, onLadder, onNext }: {
  rival: number; lineup: Contender[]; rTeam: Contender[]; results: RoundResult[]; prize: { coins: number; xp: number; first: boolean } | null;
  onRematch: () => void; onLadder: () => void; onNext?: () => void;
}) {
  const r = RIVALS[rival];
  const won = matchWinner(results) === 'you';
  const w = results.filter((x) => x.winner === 'you').length, l = results.filter((x) => x.winner === 'rival').length;
  return (
    <div className="trials-body tresult">
      <div className={`tresult-hero ${won ? 'won' : 'lost'}`}>
        {won && <Fx sheet={FX_RING} scale={4} ms={900} loop className="tresult-ring" />}
        <h1>{won ? 'Victory!' : 'So close!'}</h1>
        <p className="px">{w} – {l}{w === l ? ' · total points decide' : ''}</p>
        <p className="small" style={{ margin: 0 }}>{won ? (r.merlin ? 'You beat Professor Merlin himself. Your birds are the real deal.' : `${r.name} tips their hat to your birds.`) : `${r.name}'s birds edged it this time. Try a different lineup, or level up your birds with better photos.`}</p>
      </div>
      {won && prize && (
        <div className="tprize">
          {prize.coins > 0 ? <span><FeatherIcon size={18} /> +{prize.coins} Feather Coins</span> : <span className="muted">No prize left today</span>}
          {prize.xp > 0 && <span className="px">+{prize.xp} XP</span>}
          {prize.first && <span className="tprize-tag">First win!</span>}
        </div>
      )}
      <div className="section-title"><span>Rounds</span></div>
      <div className="tsummary">
        {results.map((x, k) => (
          <div key={k} className={`trow ${x.winner}`}>
            <ContestChip c={x.contest} small />
            <span className="trow-bird"><Sprite species={lineup[k].sp} parts={lineup[k].parts} scale={1} mode="static" /> <span className="small">{lineup[k].sp.common}</span></span>
            <b className="num">{x.you}</b><span className="muted small">–</span><b className="num">{x.rival}</b>
            <span className="trow-bird them"><span className="small">{rTeam[k].sp.common}</span> <Sprite species={rTeam[k].sp} scale={1} mode="static" flip /></span>
          </div>
        ))}
      </div>
      <div className="trials-cta col">
        {onNext && <button className="btn primary big block" onClick={onNext}>Next rival: {RIVALS[rival + 1].name} ▶</button>}
        <button className={`btn block ${onNext ? '' : 'primary big'}`} onClick={onRematch}>{won ? 'Rematch' : 'Try again'}</button>
        <button className="btn ghost block" onClick={onLadder}>Back to the ladder</button>
      </div>
    </div>
  );
}
