// Field Trials v3: fast, Step Quest-style bird battles with a modern HUD. One tap a turn:
// Quick move · Signature skill (a real-life talent) · Guard · Snack, plus a Super gauge and Run.
// HP reaching 0 means the bird flies off to rest; nobody gets hurt.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNav } from '../nav';
import { useGame, getState, counts, speciesOf, finishTrial, finishWild, noteBattle, spendTrialItem, spendTicket } from '../../app/store';
import { regionEntries, speciesById } from '../../data/provider';
import { playClip, preloadTrialClips, sfx, haptic, battleMusic } from '../../app/audio';
import { TopBar, Sprite, Icon, useReducedMotion } from '../components';
import { FeatherChip } from '../kit';
import { FeatherIcon } from '../FeatherIcon';
import { FoodIcon } from '../FoodIcon';
import { Professor } from '../Characters';
import { runBackdrop } from '../../render/diorama';
import { dayKey, trainerLevel } from '../../core/xp';
import type { Species } from '../../data/types';
import {
  CONTESTS, RIVALS, WANDERERS, WILD, wandererFace, FX_CRIT, FX_RING, SNACKS, GROW, TECHNIQUES, BEATS, TICKETS,
  fighter, startBattle, takeTurn, active, rivalTeam, wildTeam, rewardFor, birdStyle, matchup, bondFor, learnedBetween, nextUnlock, ticketsOf, battleIsFree,
  type Contender, type Battle, type Ev, type Side, type Item, type Action, type Sheet, type Contest,
} from '../../core/trials';

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const hashName = (s: string) => WANDERERS[[...s].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % WANDERERS.length];

/** An animated sprite-sheet effect (or a single frame of one, for icons). */
function Fx({ sheet, scale = 2, ms = 500, loop, frame, className, style }: { sheet: Sheet; scale?: number; ms?: number; loop?: boolean; frame?: number; className?: string; style?: CSSProperties }) {
  const w = sheet.fw * scale, h = sheet.fh * scale;
  const still = frame != null;
  return (
    <span aria-hidden className={`tfx ${className ?? ''}`} style={{
      width: w, height: h, backgroundImage: `url(${sheet.src})`, backgroundSize: `${sheet.frames * w}px ${h}px`,
      backgroundPosition: still ? `-${frame * w}px 0` : undefined,
      ['--sheet-w' as string]: `-${sheet.frames * w}px`, animation: still ? 'none' : `tfx ${ms}ms steps(${sheet.frames}) ${loop ? 'infinite' : '1 forwards'}`, ...style,
    }} />
  );
}

/** A little pixel Trial Ticket. */
export function TicketIcon({ size = 16 }: { size?: number }) {
  const rows = ['.xxxxxxxxxxxx.', 'xyyyyyyyyyyyyx', 'xyyyyyyyyyyyyx', '.yyywwwwwwyyy.', '.yyyyyyyyyyyy.', 'xyyyyyyyyyyyyx', 'xyyyyyyyyyyyyx', '.xxxxxxxxxxxx.'];
  const col: Record<string, string> = { x: '#7A4A00', y: '#FFC93C', w: '#7A4A00' };
  return (
    <svg width={size * 14 / 8} height={size} viewBox="0 0 14 8" shapeRendering="crispEdges" aria-hidden style={{ display: 'inline-block', verticalAlign: '-2px' }}>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={col[c]} />)))}
    </svg>
  );
}
/** Trial Ticket count that opens or closes a short explanation (remembered between visits). */
function TicketInfo({ tickets, free }: { tickets: number; free: boolean }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('bq-ticket-info') === '1'; } catch { return false; } });
  const toggle = () => { sfx.select(); setOpen((v) => { try { localStorage.setItem('bq-ticket-info', v ? '0' : '1'); } catch { /* private mode */ } return !v; }); };
  return (
    <>
      <button className={`tticket-chip ${tickets || free ? '' : 'empty'}`} onClick={toggle} aria-expanded={open}
        aria-label={`${free ? 'First battle free. ' : ''}${tickets} of ${TICKETS.max} Trial Tickets. ${open ? 'Hide' : 'Show'} details`}>
        <TicketIcon /> {free ? 'First battle free' : `${tickets}/${TICKETS.max} tickets`} <span className="tticket-caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <p className="tticket-note small">Rival battles use 1 ticket. Log a bird to earn one (max {TICKETS.max}). Challenges after a new find are free.</p>}
    </>
  );
}

/** Matchup arrow for a move's style against a bird's style. */
function Edge({ move, vs }: { move: Contest; vs: Contest }) {
  const e = matchup(move, vs);
  return e ? <span className={`tedge ${e > 0 ? 'up' : 'down'}`}>{e > 0 ? '▲ Strong' : '▼ Weak'}</span> : null;
}

/** A rival trainer's portrait (Professor Merlin uses his own sprite). */
export function Face({ face, merlin, name, size = 56, className, tall }: { face?: string; merlin?: boolean; name: string; size?: number; className?: string; tall?: boolean }) {
  const h = tall ? Math.round(size * 1.5) : size;
  return (
    <span className={`tface ${tall ? 'tall' : ''} ${className ?? ''}`} style={{ width: size, height: h }}>
      {merlin ? <Professor height={Math.max(48, h - 8)} /> : face ? <img src={face} alt={name} width={size} height={h} draggable={false} /> : null}
    </span>
  );
}

/** The player's birds: best photo of each species, plus the partner bird. */
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
    return [...best.values()].sort((a, b) => b.level - a.level);
  }, [sightings, partner]);
}

interface Setup { foeName: string; title: string; scene: string; foe: Contender[]; time: number; merlin?: boolean; line: string; music: string; face?: string }
type Prize = { coins: number; xp: number; first: boolean; levelled: string[] };

export function Trials({ wild }: { wild?: string }) {
  const nav = useNav();
  const tst = useGame((s) => s.trials);
  const region = useGame((s) => s.region);
  const bond = bondFor(trainerLevel(useGame((s) => s.xp)).level);
  const sightings = useGame((s) => s.sightings);
  const team = useTeam();
  const pool = useMemo(() => regionEntries(region).map((e) => e.sp), [region]);
  const [phase, setPhase] = useState<'ladder' | 'party' | 'battle' | 'result'>(wild ? 'battle' : 'ladder');
  const [ri, setRi] = useState(0);
  const [party, setParty] = useState<Contender[]>(() => {
    if (!wild) return [];
    const x = sightings.find((s) => s.id === wild);
    const lead: Contender | null = x && x.speciesId ? { sp: speciesOf(x), level: x.level ?? 5, quality: x.fieldcraft?.total ?? 40, parts: x.sprite?.parts, sightingId: x.id } : null;
    return lead ? [lead, ...team.filter((c) => c.sp.id !== lead.sp.id).slice(0, 2)] : team.slice(0, 3);
  });
  const [outcome, setOutcome] = useState<{ won: boolean; prize: Prize } | null>(null);
  const [seed, setSeed] = useState(0);
  useEffect(() => { preloadTrialClips(); return () => { battleMusic(false); }; }, []);

  const avg = (list: Contender[]) => list.reduce((n, c) => n + c.level, 0) / Math.max(1, list.length);
  const setup: Setup = useMemo(() => {
    if (wild) {
      const name = hashName(wild), lead = party[0];
      let s = [...wild].reduce((n, ch) => n + ch.charCodeAt(0), 0) + seed;
      const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      return { foeName: name, title: 'Wandering birder', scene: WILD.scenes[Math.floor(r() * WILD.scenes.length)], foe: wildTeam(pool.length ? pool : team.map((t) => t.sp), lead?.level ?? 5, r, lead?.sp.id), time: WILD.time, face: wandererFace(wild), music: WILD.music[Math.floor(r() * WILD.music.length)], line: `I spotted your new ${lead?.sp.common ?? 'bird'}! Let's see what it can do!` };
    }
    const r = RIVALS[ri];
    return { foeName: r.name, title: r.title, scene: r.scene, foe: rivalTeam(r, pool.length ? pool : team.map((t) => t.sp), ri, avg(party.length ? party : team.slice(0, 3))), time: r.time, merlin: r.merlin, line: r.line, music: r.music, face: r.face };
  }, [wild, ri, pool, party, team, seed]);

  const choose = (i: number) => { sfx.select(); setRi(i); setParty(team.slice(0, 3)); setPhase('party'); };
  const back = () => { if (phase === 'ladder' || wild) nav.back(); else { sfx.back(); setPhase('ladder'); } };

  return (
    <div className={`overlay trials ${phase}`}>
      {phase !== 'battle' && <TopBar title={phase === 'ladder' ? 'Field Trials' : phase === 'party' ? 'Choose your birds' : wild ? 'Challenge' : RIVALS[ri].name} onBack={back} right={<FeatherChip label={false} />} />}
      {phase === 'ladder' && <Ladder team={team} pool={pool} onPick={choose} onCamera={() => nav.open({ name: 'viewfinder' })} cleared={tst?.cleared ?? 0} wins={tst?.wins ?? 0} />}
      {phase === 'party' && <Party setup={setup} size={RIVALS[ri].size} team={team} party={party} setParty={setParty} bond={bond}
        onGo={() => { if (!spendTicket()) { sfx.error(); nav.toast('No Trial Tickets left. Log a bird to earn one!'); return; } playClip('tStart'); haptic(14); setSeed((s) => s + 1); setPhase('battle'); }} />}
      {phase === 'battle' && party.length > 0 && (
        <BattleView key={seed} setup={setup} party={party} bond={bond}
          onEnd={(won, used) => {
            const prize = wild ? finishWild(won, used) : finishTrial(ri, won, used);
            setOutcome({ won, prize });
            battleMusic(false);
            if (won) playClip('levelUp', { duck: true }); else playClip('tLose', { duck: true });
            setPhase('result');
          }} />
      )}
      {phase === 'battle' && party.length === 0 && <div className="trials-body"><p>You need a photographed bird to battle.</p></div>}
      {phase === 'result' && outcome && (
        <Result setup={setup} won={outcome.won} prize={outcome.prize} party={party} wild={!!wild}
          onRematch={wild ? undefined : () => { setSeed((s) => s + 1); setPhase('party'); }} onLadder={() => (wild ? nav.back() : setPhase('ladder'))}
          onNext={!wild && outcome.won && ri + 1 < RIVALS.length ? () => choose(ri + 1) : undefined} />
      )}
    </div>
  );
}

// ─── ladder ───
function Ladder({ team, pool, cleared, wins, onPick, onCamera }: { team: Contender[]; pool: Species[]; cleared: number; wins: number; onPick: (i: number) => void; onCamera: () => void }) {
  const tst = useGame((s) => s.trials);
  const xp = useGame((s) => s.xp);
  const tickets = ticketsOf(tst), free = battleIsFree(tst), tlv = trainerLevel(xp).level;
  const [howOpen, setHow] = useState(false);
  const today = dayKey(new Date());
  const avg = team.slice(0, 3).reduce((n, c) => n + c.level, 0) / Math.max(1, Math.min(3, team.length));
  return (
    <div className="trials-body">
      <div className="thero panel">
        <span className="thero-kicker">Battle mode</span>
        <b className="thero-title">Field Trials</b>
        <span className="thero-sub">Birds compete with their real-life talents. Beat each rival birder to unlock the next.</span>
        <div className="thero-stats">
          <TicketInfo tickets={tickets} free={free} />
          <span className="tbond-chip" aria-label={`Trainer level ${tlv}: Bond plus ${Math.round(bondFor(tlv) * 100)} percent`}>Bond +{Math.round(bondFor(tlv) * 100)}%</span>
          <button className="btn ghost small" onClick={() => { sfx.select(); setHow((v) => !v); }} aria-expanded={howOpen}>{howOpen ? 'Close' : 'How it works'}</button>
        </div>
        {howOpen && (
          <div className="thow">
            <p><b>Speed.</b> The faster bird moves first. Guard, Bag and Birds always go before attacks.</p>
            <p><b>PP.</b> Quick moves and Guard never run out. Signature skills and Techniques have a few uses (PP) per battle.</p>
            <p><b>Matchups.</b> {(Object.keys(BEATS) as Contest[]).map((c) => `${CONTESTS[c].name} beats ${CONTESTS[BEATS[c]].name}`).join(' · ')}. A strong matchup hits 30% harder. Swap birds mid-battle to get the edge.</p>
            <p><b>Growing up.</b> Birds level up when they win. At Lv{GROW.tech} they learn a Technique, at Lv{GROW.quick} their quick move gets stronger, at Lv{GROW.master} they master their signature skill, and at Lv{GROW.ultra} their Super becomes an Ultra move.</p>
            <p><b>Bond.</b> Your trainer level makes every bird you bring stronger: +1% HP and power per level, up to +30%.</p>
          </div>
        )}
      </div>
      {team.length === 0 && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>Photograph a bird to start competing.</p>
          <button className="btn primary" onClick={onCamera}>Open camera</button>
        </div>
      )}
      <div className="section-title"><span>Rivals</span><span>{Math.min(cleared, RIVALS.length)}/{RIVALS.length} · {wins} win{wins === 1 ? '' : 's'}</span></div>
      <div className="trials-ladder" role="list">
        {RIVALS.map((r, i) => {
          const locked = i > cleared, beaten = i < cleared;
          const lead = rivalTeam(r, pool.length ? pool : team.map((t) => t.sp), i, avg);
          const rw = rewardFor(tst, i, today);
          return (
            <div key={r.id} role="listitem" className={`trival ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''} ${i === cleared ? 'next' : ''} ${r.merlin ? 'boss' : ''}`}>
              <Face face={r.face} merlin={r.merlin} name={r.name} size={60} className={`trival-portrait ${locked ? 'locked' : ''}`} />
              <div className="trival-main">
                <b className="trival-name">{r.name}</b>
                <span className="trival-meta">{r.title} · Lv{lead[0]?.level ?? r.level}</span>
                <span className="tballs" aria-label={`${r.size} bird${r.size > 1 ? 's' : ''}`}>{Array.from({ length: r.size }, (_, k) => <i key={k} />)}</span>
              </div>
              <div className="trival-side">
                {locked ? <span className="trival-lock" aria-label="Locked: beat the rival above first">Locked</span> : (
                  <button className="btn primary small" disabled={team.length === 0 || (!free && tickets < 1)} onClick={() => onPick(i)}
                    aria-label={`${beaten ? 'Rematch' : 'Battle'} ${r.name}${free ? '' : ', uses 1 Trial Ticket'}`}>{beaten ? 'Rematch' : 'Battle'}</button>
                )}
                <span className="trival-prize">{beaten ? <span className="trival-done">✓ Beaten</span> : rw.coins ? <><FeatherIcon size={12} /> {rw.coins}</> : null}</span>
              </div>
            </div>
          );
        })}
      </div>
      {!free && tickets < 1 && <p className="small tticket-out"><TicketIcon /> Out of tickets. Log a bird to earn one!</p>}
      <p className="small muted" style={{ textAlign: 'center' }}>First wins pay the full prize and level up your birds.</p>
    </div>
  );
}

// ─── party ───
function Party({ setup, size, team, party, setParty, onGo, bond }: { setup: Setup; size: number; team: Contender[]; party: Contender[]; setParty: (p: Contender[]) => void; onGo: () => void; bond: number }) {
  const tst = useGame((s) => s.trials);
  const free = battleIsFree(tst), tickets = ticketsOf(tst);
  const foeStyles = setup.foe.map((c) => birdStyle(c.sp));
  // how a bird's style fares against the rival's whole team: + good, − risky
  const fit = (c: Contest) => foeStyles.reduce((n, f) => n + matchup(c, f) - matchup(f, c) * 0.5, 0);
  const toggle = (c: Contender) => {
    haptic(6); playClip('tPick', { vol: 0.5 });
    const at = party.findIndex((p) => p.sp.id === c.sp.id);
    if (at >= 0) setParty(party.filter((_, i) => i !== at));
    else if (party.length < 3) setParty([...party, c]);
  };
  return (
    <div className="trials-body">
      <div className="tvs-card panel">
        <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={72} className="trival-portrait" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className="trival-name">{setup.foeName}</b>
          <span className="trival-meta">brings {size} bird{size > 1 ? 's' : ''}</span>
          <span className="tstyles">{[...new Set(foeStyles)].map((c) => <i key={c} style={{ ['--c' as string]: CONTESTS[c].color }}>{CONTESTS[c].name}</i>)}</span>
          <p className="small" style={{ margin: '6px 0 0' }}>“{setup.line}”</p>
        </div>
      </div>
      <div className="section-title"><span>Your party · {party.length}/3</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>First one leads{bond > 0 ? ` · Bond +${Math.round(bond * 100)}%` : ''}</span></div>
      <div className="tpicker" role="list">
        {team.map((c) => {
          const f = fighter(c, 1, bond), at = party.findIndex((p) => p.sp.id === c.sp.id);
          const score = fit(f.style), next = nextUnlock(c.sp, f.c.level);
          return (
            <button key={c.sp.id} role="listitem" className={`tpick ${at >= 0 ? 'on' : ''}`} onClick={() => toggle(c)} aria-pressed={at >= 0}
              aria-label={`${c.sp.common}, level ${f.c.level}, ${f.max} HP. Signature skill: ${f.skill.name}, ${f.skill.tag}.`}>
              {at >= 0 && <span className="tpick-tag">{at === 0 ? 'Lead' : at + 1}</span>}
              <Sprite species={c.sp} parts={c.parts} scale={2} mode="static" />
              <span className="tpick-name">{c.sp.common}</span>
              <span className="tpick-lv">Lv{f.c.level} · {f.max} HP</span>
              <span className="tpick-skill" style={{ ['--c' as string]: CONTESTS[f.skill.style].color }}>{f.skill.name}</span>
              {f.tech && <span className="tpick-skill tech" style={{ ['--c' as string]: CONTESTS[f.tech.style].color }}>{f.tech.name}</span>}
              {score !== 0 && <span className={`tedge ${score > 0 ? 'up' : 'down'}`}>{score > 0 ? '▲ Good pick' : '▼ Risky'}</span>}
              {next && <span className="tpick-next">Lv{next.level}: {next.name}</span>}
            </button>
          );
        })}
      </div>
      <div className="trials-cta">
        <button className="btn primary big block" disabled={!party.length || (!free && tickets < 1)} onClick={onGo}>
          {free ? 'Start battle · free' : <>Start battle · <TicketIcon /> 1</>}
        </button>
        <div className="tcta-note"><TicketInfo tickets={tickets} free={free} /></div>
      </div>
    </div>
  );
}

// ─── battle ───
type Anim = '' | 'enter' | 'lunge' | 'hit' | 'rest' | 'charge' | 'guard';
interface SideView { idx: number; hp: number; max: number; anim: Anim; hidden: boolean }
interface Pop { id: number; side: Side; text: string; kind: 'dmg' | 'crit' | 'heal' | 'info' | 'miss' | 'bad' }
type Panel = 'busy' | 'menu' | 'fight' | 'snack' | 'swap';

function useCount(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now(), a = from.current, dur = 420;
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - start) / dur); setV(Math.round(a + (target - a) * k)); if (k < 1) raf = requestAnimationFrame(step); else from.current = target; };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target]);
  return v;
}
function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const shown = useCount(hp);
  return (
    <span className="thp">
      <span className="thp-track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-label="HP">
        <i className="trail" style={{ width: `${pct}%` }} />
        <i className={`fill ${pct > 50 ? 'hi' : pct > 20 ? 'mid' : 'lo'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="thp-num"><b>{shown}</b>/{max}<span className="thp-unit"> HP</span></span>
    </span>
  );
}

const TUT = (b: Battle) => {
  const me = active(b, 'you'), foe = active(b, 'foe');
  return [
    { id: 'hud', info: true, text: `Welcome to your first Field Trial! Birds compete with their real-life talents. Bring ${foe.c.sp.common}'s HP to 0 and it flies off to rest. Nobody gets hurt. Tap the text box any time to read faster.` },
    { id: 'quick', info: false, text: `Tap FIGHT, then ${me.quick}. Quick moves never run out.` },
    { id: 'skill', info: false, text: `Now FIGHT, then ${me.skill.name}: your ${me.c.sp.common}'s signature skill. Real fact: ${me.skill.fact} It's stronger, but it only has ${me.ppMax} uses (PP) per battle.` },
    { id: 'guard', info: false, text: `${foe.c.sp.common} is powering up a Big Move! FIGHT, then Guard. Guard always goes first and blocks most of it.` },
    { id: 'snack', info: true, text: 'Nicely blocked! BAG feeds your bird snacks from your pantry, and BIRDS swaps in another bird from your party. Both happen before the rival moves.' },
    { id: 'super', info: false, text: `Your Limit gauge is full! Tap it to unleash ${me.superName}.` },
    { id: 'done', info: true, text: `Last tips: the faster bird moves first, and styles have matchups: ${(Object.keys(BEATS) as Contest[]).map((c) => `${CONTESTS[c].name} beats ${CONTESTS[BEATS[c]].name}`).join(', ')}. Look for ▲ Strong. Now finish the trial!` },
  ];
};

/** Little status tags under a bird's HP bar. */
function statusOf(f: Battle['you'][number]): { t: string; good: boolean }[] {
  const out: { t: string; good: boolean }[] = [];
  if (f.fed > 0) out.push({ t: 'PWR▲', good: true });
  if (f.weak > 0) out.push({ t: 'PWR▼', good: false });
  if (f.focus) out.push({ t: 'FOCUS', good: true });
  if (f.shelter) out.push({ t: 'SHIELD', good: true });
  if (f.dazzle > 0) out.push({ t: 'DAZED', good: false });
  return out;
}

type Line = { text: string; who?: string };

function BattleView({ setup, party, onEnd, bond }: { setup: Setup; party: Contender[]; onEnd: (won: boolean, birds: string[]) => void; bond: number }) {
  const reduced = useReducedMotion();
  const items = useGame((s) => s.items);
  const firstBattle = useMemo(() => !getState().trials?.tutorial, []);
  const [bat, setBat] = useState<Battle>(() => startBattle(party, setup.foe, setup.foeName, { foeHp: firstBattle ? 2.6 : 1, bond }));
  const batRef = useRef(bat); batRef.current = bat;
  const [you, setYou] = useState<SideView>(() => ({ idx: 0, hp: bat.you[0].hp, max: bat.you[0].max, anim: '', hidden: true }));
  const [foe, setFoe] = useState<SideView>(() => ({ idx: 0, hp: bat.foe[0].hp, max: bat.foe[0].max, anim: '', hidden: true }));
  const [gauge, setGauge] = useState(0);
  const [panel, setPanel] = useState<Panel>('busy');
  const [msg, setMsgText] = useState('');
  const [speaker, setSpeaker] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [history, setHistory] = useState<Line[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [intro, setIntro] = useState(true);
  const [charging, setCharging] = useState(false);
  const [fx, setFx] = useState<{ key: number; side: Side; sheet: Sheet; scale: number } | null>(null);
  const [proj, setProj] = useState<{ key: number; from: Side; sheet: Sheet; big: boolean } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [tut, setTut] = useState<number>(firstBattle ? 0 : -1);
  const tutRef = useRef(tut); tutRef.current = tut;
  const used = useRef(new Set<string>([party[0]?.sightingId ?? '']));
  const canvas = useRef<HTMLCanvasElement>(null);
  const k = useRef(0);
  const steps = useMemo(() => TUT(bat), []);
  const [shown, setShown] = useState(false); // birds are in: the tutorial may start
  const step = shown && tut >= 0 && tut < steps.length ? steps[tut] : null;

  useEffect(() => { const cv = canvas.current; if (!cv) return; return runBackdrop(cv, setup.scene, { focus: 0.5, reduced }); }, [setup.scene, reduced]);
  useEffect(() => { battleMusic(true, setup.music); }, []);

  // ── the text box: narration stays up long enough to read (tap to skip); rival speech waits for a tap ──
  const waiter = useRef<null | (() => void)>(null);
  const advance = () => { const w = waiter.current; if (w) { sfx.move(); w(); } };
  const hold = (ms: number, tap: boolean) => new Promise<void>((ok) => {
    let t = 0;
    const done = () => { window.clearTimeout(t); waiter.current = null; setNeedTap(false); ok(); };
    waiter.current = done;
    if (tap) setNeedTap(true); else t = window.setTimeout(done, ms);
  });
  const note = (text: string, who?: string) => setHistory((h) => [...h.slice(-49), { text, who }]);
  const show = (text: string) => { setMsgText(text); setSpeaker(false); };
  const narrate = async (text: string) => { show(text); note(text); await hold(reduced ? 450 : Math.min(1900, 650 + text.length * 24), false); };
  const speak = async (text: string) => { setMsgText(text); setSpeaker(true); note(text, setup.foeName); await hold(0, true); };

  const setSide = (s: Side, f: (v: SideView) => SideView) => (s === 'you' ? setYou(f) : setFoe(f));
  const anim = async (s: Side, a: Anim, ms: number) => { setSide(s, (v) => ({ ...v, anim: a })); await sleep(reduced ? Math.min(ms, 150) : ms); setSide(s, (v) => ({ ...v, anim: v.anim === a ? '' : v.anim })); };
  const pop = (side: Side, text: string, kind: Pop['kind']) => { const id = ++k.current; setPops((p) => [...p, { id, side, text, kind }]); setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100); };
  const burst = (s: Side, sheet: Sheet, scale = 3) => { if (!reduced) setFx({ key: ++k.current, side: s, sheet, scale }); };

  const play = useCallback(async (ev0: Ev[], before: Battle) => {
    // say "X uses Y!" before the move animation, like the classics
    const ev = [...ev0];
    for (let i = 0; i < ev.length - 1; i++) if (ev[i].t === 'move' && ev[i + 1].t === 'log') [ev[i], ev[i + 1]] = [ev[i + 1], ev[i]];
    for (const e of ev) {
      switch (e.t) {
        case 'log':
          if (/ sends out /.test(e.text)) { const nm = e.text.split(' sends out ')[1]?.replace(/!$/, ''); await speak(`Go, ${nm}! Show them what you've got!`); }
          else await narrate(e.text);
          break;
        case 'move': {
          const def = CONTESTS[e.style];
          playClip(e.kind === 'super' || e.kind === 'big' ? 'tCritical' : def.clip, { vol: 0.8 });
          if (e.side === 'foe' && e.kind === 'big') setCharging(false);
          if (e.kind === 'super') { setFlash(true); setTimeout(() => setFlash(false), 260); }
          const l = anim(e.side, 'lunge', 300);
          if (!reduced) { setProj({ key: ++k.current, from: e.side, sheet: def.proj, big: e.kind === 'super' || e.kind === 'big' }); await sleep(380); setProj(null); }
          await l; break;
        }
        case 'recall': playClip('tPick', { vol: 0.5 }); await anim(e.side, 'rest', 420); setSide(e.side, (v) => ({ ...v, hidden: true })); break;
        case 'dmg': {
          burst(e.side, e.crit || e.big ? FX_CRIT : CONTESTS[e.style].boom, e.big ? 4 : 3);
          pop(e.side, e.blocked ? `-${e.amount} blocked` : `-${e.amount}`, e.crit || e.big ? 'crit' : 'dmg');
          if (e.eff) setTimeout(() => pop(e.side, e.eff > 0 ? 'Strong!' : 'Weak…', e.eff > 0 ? 'crit' : 'miss'), 180);
          playClip(e.blocked ? 'tTie' : 'tHit', { vol: 0.75 });
          if (e.crit || e.big) { haptic([20, 30, 20]); if (!reduced) { setShake(true); setTimeout(() => setShake(false), 340); } } else haptic(10);
          await anim(e.side, 'hit', 300); break;
        }
        case 'miss': pop(e.side, 'Miss', 'miss'); await sleep(260); break;
        case 'hp': setSide(e.side, (v) => ({ ...v, hp: e.value, max: e.max })); await sleep(reduced ? 80 : 300); break;
        case 'heal': pop(e.side, `+${e.amount}`, 'heal'); burst(e.side, FX_RING, 2); await sleep(340); break;
        case 'buff': pop(e.side, e.text, e.good ? 'info' : 'bad'); await sleep(320); break;
        case 'guard': playClip('tPick', { vol: 0.6 }); burst(e.side, FX_RING, 2); pop(e.side, 'Guard', 'info'); await anim(e.side, 'guard', 320); break;
        case 'charge': setCharging(true); playClip('tStart', { vol: 0.7 }); await anim('foe', 'charge', 520); break;
        case 'gauge': setGauge(e.value); break;
        case 'rest': playClip('tTie', { vol: 0.7 }); if (e.side === 'foe') setCharging(false); await anim(e.side, 'rest', 620); setSide(e.side, (v) => ({ ...v, hidden: true })); break;
        case 'send': {
          const f = e.side === 'you' ? before.you[e.index] : before.foe[e.index];
          if (e.side === 'you') used.current.add(party[e.index]?.sightingId ?? '');
          setSide(e.side, () => ({ idx: e.index, hp: f.hp, max: f.max, anim: 'enter', hidden: false }));
          playClip('tPick', { vol: 0.6 }); await sleep(reduced ? 100 : 450); setSide(e.side, (v) => ({ ...v, anim: '' }));
          break;
        }
        case 'end': break;
      }
    }
  }, [reduced, party]);

  const ready = useCallback(async (b: Battle) => {
    setBat(b);
    if (b.over) {
      const r = RIVALS.find((x) => x.name === setup.foeName);
      noteBattle(firstBattle);
      await speak(b.over === 'you' ? r?.win ?? 'Wow, your birds are amazing!' : r?.lose ?? 'My birds take this one! Good battle!');
      onEnd(b.over === 'you', [...used.current].filter((id) => id && id !== 'partner'));
      return;
    }
    setPanel('menu');
    show(`What will ${active(b, 'you').c.sp.common} do?`);
  }, [setup.foeName, onEnd, firstBattle]);

  // intro: the rival appears (Pokémon-style), speaks, then both birds fly in
  useEffect(() => {
    let live = true;
    (async () => {
      show(`${setup.title === 'Wandering birder' ? 'Birder' : 'Rival'} ${setup.foeName} wants to battle!`);
      await sleep(reduced ? 300 : 1500); if (!live) return;
      setIntro(false);
      await speak(setup.line); if (!live) return;
      setFoe((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      await narrate(`${setup.foeName} sent out ${setup.foe[0].sp.common}!`); if (!live) return;
      setFoe((v) => ({ ...v, anim: '' }));
      setYou((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      await narrate(`Go, ${party[0].sp.common}!`); if (!live) return;
      setYou((v) => ({ ...v, anim: '' }));
      setShown(true);
      ready(batRef.current);
    })();
    return () => { live = false; };
  }, []);

  const act = async (a: Action) => {
    setPanel('busy');
    const before = batRef.current;
    const s = steps[tutRef.current]?.id;
    const { b, ev } = takeTurn(before, a, Math.random, { forceCharge: s === 'skill' });
    if (b === before) { for (const e of ev) if (e.t === 'log') await narrate(e.text); setPanel('menu'); return; }
    await play(ev, before);
    // tutorial: move on to the next lesson, and fill the gauge for the Limit lesson
    if (tutRef.current >= 0) {
      let n = tutRef.current + 1;
      if (!b.over && steps[n]?.id === 'guard' && !b.foeCharging) n = steps.findIndex((x) => x.id === 'snack');
      setTut(b.over || n >= steps.length ? -1 : n);
      tutRef.current = b.over || n >= steps.length ? -1 : n;
    }
    await ready(b);
  };

  const me = bat.you[you.idx], them = bat.foe[foe.idx], cur = active(bat, 'you');
  const tutId = step?.id;
  const live = panel !== 'busy';
  const fightLesson = tutId === 'quick' || tutId === 'skill' || tutId === 'guard';
  const lock = (id: string) => !live || (!!step && (step.info || (tutId !== id && !(id === 'fight' && fightLesson))));
  const snacks = (['seeds', 'berries', 'worms'] as Item[]).reduce((n, it) => n + (items[it] ?? 0), 0);
  const sReady = gauge >= 100;
  const bench = bat.you.map((f, i) => ({ f, i })).filter(({ f, i }) => !f.out && i !== bat.yi);
  const meFirst = cur.spd >= them.spd;

  // plain render helper (not a component), so buttons are never rebuilt mid-tap
  const move = (o: { id: string; cls: string; icon: ReactNode; name: string; sub: string; pp?: string; onClick: () => void; disabled?: boolean; edge?: Contest }) => (
    <button key={o.id} className={`tact ${o.cls} ${tutId === o.id && !step?.info ? 'tut-focus' : ''}`} onClick={o.onClick} disabled={o.disabled || lock(o.id)}
      aria-label={`${o.name}: ${o.sub}${o.pp ? `, ${o.pp}` : ''}${o.edge && matchup(o.edge, them.style) ? (matchup(o.edge, them.style) > 0 ? ', strong matchup' : ', weak matchup') : ''}`}>
      <span className="tact-ic" aria-hidden>{o.icon}</span>
      <span className="tact-txt"><b>{o.name}</b><small>{o.sub}</small></span>
      {o.pp && <span className="tpp">{o.pp}</span>}
      {o.edge && !foe.hidden && <Edge move={o.edge} vs={them.style} />}
    </button>
  );
  const pick = (a: Action) => { sfx.select(); act(a); };
  const card = (side: Side, f: Battle['you'][number], v: SideView, list: Battle['you'], at: number) => (
    <div className={`thud-card ${side} ${v.hidden ? 'dim' : ''}`}>
      <div className="thud-top"><b className="thud-name">{f.c.sp.common}</b><span className="thud-lv">Lv{f.c.level}</span></div>
      <HpBar hp={v.hp} max={v.max} />
      <span className="thud-row">
        <span className="thud-pips">{list.map((x, i) => <i key={i} className={x.out ? 'out' : i === at ? 'on' : ''} />)}</span>
        <span className="thud-status">{!v.hidden && statusOf(f).map((x) => <i key={x.t} className={x.good ? 'good' : 'bad'}>{x.t}</i>)}</span>
      </span>
    </div>
  );

  return (
    <div className={`tb ${shake ? 'shake' : ''}`} style={{ ['--c' as string]: CONTESTS[cur.style].color }}>
      <div className="tb-stage" onClick={advance}>
        <canvas ref={canvas} className="tb-bg pix" aria-hidden />
        <div className={`tb-flash ${flash ? 'on' : ''}`} aria-hidden />

        <div className={`thud ${tutId === 'hud' ? 'tut-focus' : ''}`}>
          {card('you', me, you, bat.you, bat.yi)}
          <div className="tvs-dot" aria-hidden>VS</div>
          {card('foe', them, foe, bat.foe, bat.fi)}
        </div>

        <div className={`tspot foe ${foe.hidden ? 'gone' : ''}`}>
          <span className="tplat" aria-hidden />
          <div className={`tbird ${foe.anim} ${charging ? 'charging' : ''}`}>
            {charging && <span className="twarn" aria-hidden>!</span>}
            <Sprite species={them.c.sp} scale={3} mode={foe.anim === 'lunge' ? 'fly' : 'idle'} flip />
            {fx?.side === 'foe' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={480} className="tboom" />}
            {pops.filter((p) => p.side === 'foe').map((p) => <span key={p.id} className={`tpop ${p.kind}`}>{p.text}</span>)}
          </div>
        </div>
        <div className={`tspot you ${you.hidden ? 'gone' : ''}`}>
          <span className="tplat" aria-hidden />
          <div className={`tbird ${you.anim}`}>
            <Sprite species={me.c.sp} parts={me.c.parts} scale={5} mode={you.anim === 'lunge' ? 'fly' : 'idle'} />
            {fx?.side === 'you' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={480} className="tboom" />}
            {pops.filter((p) => p.side === 'you').map((p) => <span key={p.id} className={`tpop ${p.kind}`}>{p.text}</span>)}
          </div>
        </div>
        {proj && <span key={proj.key} className={`tproj3 from-${proj.from}`}><Fx sheet={proj.sheet} scale={proj.big ? 4 : 3} ms={260} loop style={proj.from === 'foe' ? { transform: 'scaleX(-1)' } : undefined} /></span>}

        {charging && <div className="tbanner-warn" role="status">Big Move incoming · Guard!</div>}
        <div className={`tlog dialog ${speaker ? 'speech' : ''} ${needTap ? 'wait' : ''}`} role="status" aria-live="polite">
          {speaker && <span className="dialog-name">{setup.foeName}</span>}
          {speaker && <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={44} className="tlog-face" />}
          <p className="dialog-text">{speaker ? `“${msg}”` : msg}</p>
          {needTap && <span className="tlog-next" aria-label="Tap to continue">▼</span>}
          <button className="tlog-hist" onClick={(e) => { e.stopPropagation(); sfx.select(); setShowLog(true); }} aria-label="Battle log">LOG</button>
        </div>

        {intro && (
          <div className="tintro" aria-hidden>
            <span className="tintro-k">{setup.title === 'Wandering birder' ? 'Challenge' : 'Rival battle'}</span>
            <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={104} tall className="tintro-face" />
            <b className="tintro-t">{setup.foeName}</b>
            <span className="tintro-s">{setup.title}</span>
          </div>
        )}
        {showLog && (
          <div className="thistory" role="dialog" aria-label="Battle log" onClick={(e) => e.stopPropagation()}>
            <div className="thistory-top"><b>Battle log</b><button className="btn ghost small" onClick={() => setShowLog(false)}>Close</button></div>
            <ol>{history.map((l, i) => <li key={i} className={l.who ? 'who' : ''}>{l.who && <b>{l.who}: </b>}{l.who ? `“${l.text}”` : l.text}</li>)}</ol>
          </div>
        )}
      </div>

      <div className={`ttray ${live ? '' : 'busy'}`} onClick={live ? undefined : advance}>
        {step && (
          <div className="ttut dialog" role="dialog" aria-label="Battle tutorial">
            <span className="dialog-name">Merlin · {tut + 1}/{steps.length}</span>
            <div className="ttut-merlin"><Professor height={48} /></div>
            <div className="ttut-body">
              <p className="dialog-text">{step.text}</p>
              {step.info && <button className="btn primary small" onClick={() => {
                sfx.select(); const n = tut + 1 >= steps.length ? -1 : tut + 1; setTut(n); tutRef.current = n;
                if (steps[n]?.id === 'super') { const nb = { ...batRef.current, gauge: 100 }; setBat(nb); batRef.current = nb; setGauge(100); }
              }}>{tut + 1 >= steps.length ? 'Let’s go!' : 'Next'}</button>}
            </div>
          </div>
        )}
        <button className={`tsuper ${sReady ? 'ready' : ''} ${tutId === 'super' ? 'tut-focus' : ''}`} disabled={!sReady || lock('super')} onClick={() => pick({ kind: 'super' })}
          aria-label={sReady ? `Limit Break ${cur.superName}: ready` : `Limit gauge ${gauge}%`}>
          <i style={{ width: `${gauge}%` }} aria-hidden />
          <span className="tsuper-l"><Icon name="star" size={16} /> <span>{sReady ? cur.superName : 'Limit'}</span></span>
          <span className="tsuper-r">{sReady ? 'Ready!' : `${gauge}%`}</span>
        </button>

        {(panel === 'menu' || panel === 'busy') && (
          <div className="tcmd">
            <button className={`tcmd-b fight ${fightLesson && !step?.info ? 'tut-focus' : ''}`} disabled={lock('fight')} onClick={() => { sfx.select(); setPanel('fight'); }}>Fight</button>
            <button className="tcmd-b" disabled={lock('bag') || !snacks} onClick={() => { sfx.select(); setPanel('snack'); }}>Bag <small>×{snacks}</small></button>
            <button className="tcmd-b" disabled={lock('birds') || !bench.length} onClick={() => { sfx.select(); setPanel('swap'); }}>Birds <small>×{bench.length}</small></button>
            <button className="tcmd-b run" disabled={!live || !!step} onClick={() => { sfx.back(); act({ kind: 'run' }); }}>Run</button>
          </div>
        )}
        {panel === 'fight' && (
          <>
            <div className="tfight-top">
              <span>{meFirst ? `⚡ ${cur.c.sp.common} is faster` : `⚡ ${them.c.sp.common} is faster`}</span>
              <span className="muted">{CONTESTS[cur.style].name} vs {CONTESTS[them.style].name}</span>
            </div>
            <div className="tgrid">
              {move({ id: 'quick', cls: 'quick', icon: <Fx sheet={CONTESTS[cur.style].proj} scale={1} frame={1} />, name: cur.quick, sub: cur.quickPow > 1 ? 'Upgraded quick move' : 'Quick move', pp: '∞', edge: cur.style, onClick: () => pick({ kind: 'quick' }) })}
              {move({ id: 'skill', cls: 'skill', icon: <Fx sheet={CONTESTS[cur.skill.style].boom} scale={1} frame={2} />, name: cur.skill.name, sub: cur.skill.tag, pp: `${cur.pp}/${cur.ppMax}`, disabled: cur.pp < 1, edge: cur.skill.power ? cur.skill.style : undefined, onClick: () => pick({ kind: 'skill' }) })}
              {cur.tech
                ? move({ id: 'tech', cls: 'tech', icon: <Fx sheet={CONTESTS[cur.tech.style].proj} scale={1} frame={3} />, name: cur.tech.name, sub: cur.tech.tag, pp: `${cur.pp2}/${cur.pp2Max}`, disabled: cur.pp2 < 1, edge: cur.tech.power ? cur.tech.style : undefined, onClick: () => pick({ kind: 'tech' }) })
                : (
                  <div className="tact locked" aria-label={`${TECHNIQUES[cur.style].name}: learned at level ${GROW.tech}`}>
                    <span className="tact-ic" aria-hidden>🔒</span>
                    <span className="tact-txt"><b>{TECHNIQUES[cur.style].name}</b><small>Learns at Lv{GROW.tech}</small></span>
                  </div>
                )}
              {move({ id: 'guard', cls: 'guard', icon: <Fx sheet={FX_RING} scale={1} frame={3} />, name: 'Guard', sub: 'Goes first · blocks 60%', pp: '∞', onClick: () => pick({ kind: 'guard' }) })}
            </div>
            <button className="btn ghost small trun" disabled={!!step && !step.info && fightLesson} onClick={() => { sfx.back(); setPanel('menu'); }}>Back</button>
          </>
        )}
        {panel === 'swap' && (
          <div className="tsnacks">
            {bench.map(({ f, i }) => (
              <button key={i} className="tact snackrow" onClick={() => pick({ kind: 'swap', to: i })}
                aria-label={`Swap in ${f.c.sp.common}, level ${f.c.level}, ${f.hp} of ${f.max} HP`}>
                <span className="tact-ic" aria-hidden><Sprite species={f.c.sp} parts={f.c.parts} scale={1} mode="static" /></span>
                <span className="tact-txt"><b>{f.c.sp.common}</b><small>Lv{f.c.level} · {f.hp}/{f.max} HP · {CONTESTS[f.style].name}</small></span>
                <Edge move={f.style} vs={them.style} />
              </button>
            ))}
            <p className="small muted tswap-note">Swapping goes first, then the rival moves. {(() => { const edge = (Object.keys(BEATS) as Contest[]).find((c) => BEATS[c] === them.style)!; return `${CONTESTS[edge].name} birds have the edge on ${them.c.sp.common}.`; })()}</p>
            <button className="btn ghost small trun" onClick={() => { sfx.back(); setPanel('menu'); }}>Back</button>
          </div>
        )}
        {panel === 'snack' && (
          <div className="tsnacks">
            {(['seeds', 'berries', 'worms'] as Item[]).map((it) => (
              <button key={it} className="tact snackrow" disabled={(items[it] ?? 0) < 1} onClick={() => { if (spendTrialItem(it)) pick({ kind: 'snack', item: it }); }}>
                <span className="tact-ic" aria-hidden><FoodIcon food={it} size={26} /></span>
                <span className="tact-txt"><b>{SNACKS[it].name}</b><small>{SNACKS[it].tag}</small></span>
                <span className="tsnack-n">×{items[it] ?? 0}</span>
              </button>
            ))}
            <button className="btn ghost small trun" onClick={() => { sfx.back(); setPanel('menu'); }}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── result ───
function Result({ setup, won, prize, party, wild, onRematch, onLadder, onNext }: {
  setup: Setup; won: boolean; prize: Prize; party: Contender[]; wild: boolean; onRematch?: () => void; onLadder: () => void; onNext?: () => void;
}) {
  const idx = RIVALS.findIndex((x) => x.name === setup.foeName), r = RIVALS[idx];
  return (
    <div className="trials-body tresult">
      <div className={`tresult-hero ${won ? 'won' : 'lost'}`}>
        {won && <Fx sheet={FX_RING} scale={4} ms={900} loop className="tresult-ring" />}
        <span className="thero-kicker">{wild ? 'Challenge' : 'Field Trial'}</span>
        <h1>{won ? 'Victory!' : 'So close!'}</h1>
        <div className="tresult-quote"><Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={48} /><p className="small"><b>{setup.foeName}:</b> “{won ? r?.win ?? 'Your birds are amazing!' : r?.lose ?? 'Good try! Train up and come back.'}”</p></div>
      </div>
      {won && (
        <div className="tprize">
          {prize.coins > 0 ? <span><FeatherIcon size={18} /> +{prize.coins}</span> : <span>No prize left today</span>}
          {prize.xp > 0 && <span>+{prize.xp} XP</span>}
          {prize.first && <span className="tprize-tag">First win</span>}
        </div>
      )}
      {won && prize.levelled.length > 0 && (
        <div className="tlevels">
          {party.filter((c) => c.sightingId && prize.levelled.includes(c.sightingId)).map((c) => {
            const learned = learnedBetween(c.sp, c.level, c.level + 1), next = nextUnlock(c.sp, c.level + 1);
            return (
              <div key={c.sp.id} className={`tlevel ${learned.length ? 'learned' : ''}`}>
                <Sprite species={c.sp} parts={c.parts} scale={2} mode="idle" />
                <span>
                  <b>{c.sp.common}</b> grew to Lv{c.level + 1}!
                  {learned.map((u) => <span key={u.kind} className="tlearn">★ {u.text}!</span>)}
                  {!learned.length && next && <small className="muted"> Next: {next.name} at Lv{next.level}</small>}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!won && <p className="small muted">Tip: Guard when the rival announces a Big Move, pick birds marked ▲ Good pick, and Swap when a matchup turns against you. Winning levels your birds up so they learn new moves.</p>}
      <div className="trials-cta col">
        {onNext && idx >= 0 && idx + 1 < RIVALS.length && <button className="btn primary big block" onClick={onNext}>Next rival: {RIVALS[idx + 1].name}</button>}
        {onRematch && <button className={`btn block ${onNext ? '' : 'primary big'}`} onClick={onRematch}>{won ? 'Rematch' : 'Try again'}</button>}
        <button className="btn ghost block" onClick={onLadder}>{wild ? 'Done' : 'Back to rivals'}</button>
      </div>
    </div>
  );
}
