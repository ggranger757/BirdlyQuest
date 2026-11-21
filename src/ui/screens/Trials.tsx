// Field Trials: turn-based, Pokémon-style bird contests. Pick a rival, choose a party of up to three
// photographed birds, then battle turn by turn: Perform a move, use the Bag, switch Birds or Run.
// Being outshone drains Spirit; at zero a bird flies off to rest. No fighting, no damage.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNav } from '../nav';
import { useGame, counts, speciesOf, finishTrial, spendTrialItem } from '../../app/store';
import { regionEntries, speciesById } from '../../data/provider';
import { playClip, preloadTrialClips, sfx, haptic } from '../../app/audio';
import { TopBar, Sprite, useReducedMotion } from '../components';
import { FeatherChip } from '../kit';
import { FeatherIcon } from '../FeatherIcon';
import { Professor } from '../Characters';
import { runBackdrop } from '../../render/diorama';
import { dayKey } from '../../core/xp';
import type { Species } from '../../data/types';
import {
  CONTESTS, CONTEST_IDS, BEATS, BEAT_WHY, RIVALS, FX_CRIT, FX_RING, ITEMS, fighter, effectiveness, startBattle, takeTurn, sendIn, canSwitch,
  rivalTeam, rewardFor, type Contest, type Contender, type Battle, type Ev, type Side, type Item, type Move,
} from '../../core/trials';

type Sheet = { src: string; frames: number; fw: number; fh: number };
const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** One animated sprite-sheet effect. Pixel-crisp, integer-scaled. */
function Fx({ sheet, scale = 2, ms = 500, loop, className, style }: { sheet: Sheet; scale?: number; ms?: number; loop?: boolean; className?: string; style?: CSSProperties }) {
  const w = sheet.fw * scale, h = sheet.fh * scale;
  return (
    <span aria-hidden className={`tfx ${className ?? ''}`} style={{
      width: w, height: h, backgroundImage: `url(${sheet.src})`, backgroundSize: `${sheet.frames * w}px ${h}px`,
      ['--sheet-w' as string]: `-${sheet.frames * w}px`, animation: `tfx ${ms}ms steps(${sheet.frames}) ${loop ? 'infinite' : '1 forwards'}`, ...style,
    }} />
  );
}
const TypeChip = ({ c, small }: { c: Contest; small?: boolean }) => (
  <span className={`tchip ${small ? 'small' : ''}`} style={{ ['--c' as string]: CONTESTS[c].color }}>{CONTESTS[c].short}</span>
);
const counterOf = (c: Contest) => CONTEST_IDS.find((x) => BEATS[x] === c)!;

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

export function Trials() {
  const nav = useNav();
  const tst = useGame((s) => s.trials);
  const region = useGame((s) => s.region);
  const team = useTeam();
  const pool = useMemo(() => regionEntries(region).map((e) => e.sp), [region]);
  const [phase, setPhase] = useState<'ladder' | 'party' | 'battle' | 'result'>('ladder');
  const [ri, setRi] = useState(0);
  const [party, setParty] = useState<Contender[]>([]);
  const [outcome, setOutcome] = useState<{ won: boolean; prize: ReturnType<typeof finishTrial> } | null>(null);
  const [seed, setSeed] = useState(0);
  useEffect(() => { preloadTrialClips(); }, []);

  const rival = RIVALS[ri];
  const yourAvg = party.length ? party.reduce((n, c) => n + c.level, 0) / party.length : team.slice(0, 3).reduce((n, c) => n + c.level, 0) / Math.max(1, Math.min(3, team.length));
  const rTeam = useMemo(() => rivalTeam(rival, pool.length ? pool : team.map((t) => t.sp), ri, yourAvg), [rival, pool, ri, yourAvg, team, seed]);

  const choose = (i: number) => { sfx.select(); setRi(i); setParty(team.slice(0, 3)); setPhase('party'); };
  const back = () => { if (phase === 'ladder') nav.back(); else { sfx.back(); setPhase('ladder'); } };

  return (
    <div className={`overlay trials ${phase}`}>
      {phase !== 'battle' && <TopBar title={phase === 'ladder' ? 'Field Trials' : phase === 'party' ? 'Choose your birds' : rival.name} onBack={back} right={<FeatherChip label={false} />} />}
      {phase === 'ladder' && <Ladder team={team} cleared={tst?.cleared ?? 0} wins={tst?.wins ?? 0} pool={pool} onPick={choose} onCamera={() => nav.open({ name: 'viewfinder' })} />}
      {phase === 'party' && <Party rival={ri} team={team} party={party} setParty={setParty} onGo={() => { playClip('tStart'); haptic(14); setSeed((s) => s + 1); setPhase('battle'); }} />}
      {phase === 'battle' && (
        <BattleView key={seed} rival={ri} party={party} rTeam={rTeam}
          onEnd={(won, used) => {
            const prize = finishTrial(ri, won, used);
            setOutcome({ won, prize });
            if (won) playClip('levelUp', { duck: true }); else playClip('tLose', { duck: true });
            setPhase('result');
          }} />
      )}
      {phase === 'result' && outcome && (
        <Result rival={ri} won={outcome.won} prize={outcome.prize} party={party}
          onRematch={() => { setSeed((s) => s + 1); setPhase('party'); }} onLadder={() => setPhase('ladder')}
          onNext={outcome.won && ri + 1 < RIVALS.length ? () => choose(ri + 1) : undefined} />
      )}
    </div>
  );
}

// ─── ladder ───
function Ladder({ team, cleared, wins, pool, onPick, onCamera }: { team: Contender[]; cleared: number; wins: number; pool: Species[]; onPick: (i: number) => void; onCamera: () => void }) {
  const tst = useGame((s) => s.trials);
  const today = dayKey(new Date());
  const avg = team.slice(0, 3).reduce((n, c) => n + c.level, 0) / Math.max(1, Math.min(3, team.length));
  return (
    <div className="trials-body">
      <div className="tchart" aria-label="Type chart: Song beats Display, Display beats Sky, Sky beats Forage, Forage beats Song">
        <span className="px small tchart-title">Who outshines who</span>
        <div className="tchart-loop">
          {CONTEST_IDS.map((c) => <span key={c} className="tchart-step"><TypeChip c={c} /><span className="tchart-arrow" aria-hidden>▶</span></span>)}
          <TypeChip c="song" />
        </div>
        <span className="small muted">Pick birds whose style beats the rival's. Better photos and higher levels make birds stronger.</span>
      </div>
      {team.length === 0 && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p>Photograph a bird to start competing.</p>
          <button className="btn primary" onClick={onCamera}>Open camera</button>
        </div>
      )}
      <div className="section-title"><span>Rival birders</span><span>{Math.min(cleared, RIVALS.length)}/{RIVALS.length} beaten · {wins} win{wins === 1 ? '' : 's'}</span></div>
      <div className="trials-ladder" role="list">
        {RIVALS.map((r, i) => {
          const locked = i > cleared, beaten = i < cleared;
          const lead = rivalTeam(r, pool.length ? pool : team.map((t) => t.sp), i, avg);
          const rw = rewardFor(tst, i, today);
          return (
            <div key={r.id} role="listitem" className={`trival ${locked ? 'locked' : ''} ${beaten ? 'beaten' : ''} ${i === cleared ? 'next' : ''} ${r.merlin ? 'boss' : ''}`}>
              <div className="trival-portrait">
                {r.merlin ? <Professor height={48} /> : lead[0] ? <Sprite species={lead[0].sp} scale={2} mode={locked ? 'silhouette' : 'idle'} flip /> : null}
              </div>
              <div className="trival-main">
                <div className="row between"><b className="trival-name">{r.name}</b><span className="px small muted">Lv{lead[0]?.level ?? r.level}</span></div>
                <div className="small muted">{r.title}</div>
                <div className="row" style={{ gap: 4, marginTop: 4, alignItems: 'center' }}>
                  {r.styles.map((c) => <TypeChip key={c} c={c} small />)}
                  <span className="tballs" aria-label={`${r.size} bird${r.size > 1 ? 's' : ''}`}>{Array.from({ length: r.size }, (_, k) => <i key={k} />)}</span>
                </div>
              </div>
              <div className="trival-side">
                {beaten && <span className="trival-badge">✓ Beaten</span>}
                {locked ? <span className="trival-lock" aria-label="Locked: beat the rival above first">🔒</span> : (
                  <button className="btn small primary" disabled={team.length === 0} onClick={() => onPick(i)} aria-label={`Challenge ${r.name}`}>{beaten ? 'Rematch' : 'Battle'}</button>
                )}
                <span className="trival-prize small">{rw.coins ? <><FeatherIcon size={12} /> +{rw.coins}</> : <span className="muted">no prize today</span>}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>First win pays the full prize and levels up your birds. Rematches pay a small bonus 3 times a day. Losing costs nothing.</p>
    </div>
  );
}

// ─── party select ───
function Party({ rival, team, party, setParty, onGo }: { rival: number; team: Contender[]; party: Contender[]; setParty: (p: Contender[]) => void; onGo: () => void }) {
  const r = RIVALS[rival];
  const toggle = (c: Contender) => {
    haptic(6); playClip('tPick', { vol: 0.5 });
    const at = party.findIndex((p) => p.sp.id === c.sp.id);
    if (at >= 0) setParty(party.filter((_, i) => i !== at));
    else if (party.length < 3) setParty([...party, c]);
  };
  return (
    <div className="trials-body">
      <div className="tvs-card">
        <div className="trival-portrait">{r.merlin ? <Professor height={48} /> : <span className="px" style={{ fontSize: 22 }}>?</span>}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className="trival-name">{r.name}</b> <span className="small muted">brings {r.size} bird{r.size > 1 ? 's' : ''}</span>
          <div className="small" style={{ marginTop: 4 }}>“{r.line}”</div>
          <div className="ttip small">
            {r.styles.map((s) => <span key={s}>Their <TypeChip c={s} small /> birds are outshone by <TypeChip c={counterOf(s)} small /></span>)}
          </div>
        </div>
      </div>
      <div className="section-title"><span>Your party</span><span>{party.length}/3</span></div>
      <div className="tparty-slots">
        {[0, 1, 2].map((k) => {
          const c = party[k];
          return (
            <div key={k} className={`tparty-slot ${c ? 'full' : ''}`}>
              <span className="px small">{k === 0 ? 'Lead' : `#${k + 1}`}</span>
              {c ? <><Sprite species={c.sp} parts={c.parts} scale={2} mode="idle" /><span className="small tparty-name">{c.sp.common}</span></> : <span className="tparty-empty">+</span>}
            </div>
          );
        })}
      </div>
      <div className="tpicker" role="list">
        {team.map((c) => {
          const f = fighter(c), at = party.findIndex((p) => p.sp.id === c.sp.id);
          const vs = r.styles.map((s) => effectiveness(f.style, s));
          const good = vs.some((v) => v > 1), bad = vs.every((v) => v < 1);
          return (
            <button key={c.sp.id} role="listitem" className={`tpick ${at >= 0 ? 'on' : ''}`} onClick={() => toggle(c)} aria-pressed={at >= 0}
              aria-label={`${c.sp.common}, level ${f.c.level}, ${CONTESTS[f.style].name} style, ${f.maxSp} Spirit. Moves: ${f.moves.map((m) => m.name).join(', ')}`}>
              {at >= 0 && <span className="tpick-tag">{at === 0 ? 'Lead' : at + 1}</span>}
              {good && <span className="tpick-hint good">Strong pick</span>}
              {bad && !good && <span className="tpick-hint bad">Risky</span>}
              <Sprite species={c.sp} parts={c.parts} scale={2} mode="static" />
              <span className="tpick-name small">{c.sp.common}</span>
              <span className="row" style={{ gap: 4, alignItems: 'center' }}><TypeChip c={f.style} small /><span className="px small">Lv{f.c.level}</span></span>
              <span className="tpick-moves">{f.moves.map((m) => m.name).join(' · ')}</span>
            </button>
          );
        })}
      </div>
      <div className="trials-cta">
        <button className="btn primary big block" disabled={!party.length} onClick={onGo}>Battle! ▶</button>
      </div>
    </div>
  );
}

// ─── the battle ───
type Anim = '' | 'enter' | 'lunge' | 'hit' | 'dodge' | 'rest' | 'up' | 'down' | 'heal';
interface SideView { idx: number; sp: number; max: number; anim: Anim; hidden: boolean }
type Panel = 'busy' | 'menu' | 'moves' | 'bag' | 'birds' | 'force';

function SpiritBar({ value, max, numbers }: { value: number; max: number; numbers?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <span className="tspirit">
      <span className="tspirit-label px">Spirit</span>
      <span className="tspirit-track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label="Spirit">
        <i className={pct > 50 ? 'hi' : pct > 20 ? 'mid' : 'lo'} style={{ width: `${pct}%` }} />
      </span>
      {numbers && <span className="tspirit-num px">{value}/{max}</span>}
    </span>
  );
}

function BattleView({ rival, party, rTeam, onEnd }: { rival: number; party: Contender[]; rTeam: Contender[]; onEnd: (won: boolean, birds: string[]) => void }) {
  const r = RIVALS[rival];
  const reduced = useReducedMotion();
  const items = useGame((s) => s.items);
  const [bat, setBat] = useState<Battle>(() => startBattle(party, rTeam, r.name));
  const batRef = useRef(bat); batRef.current = bat;
  const [you, setYou] = useState<SideView>(() => ({ idx: 0, sp: bat.you[0].sp, max: bat.you[0].maxSp, anim: '', hidden: true }));
  const [foe, setFoe] = useState<SideView>(() => ({ idx: 0, sp: bat.foe[0].sp, max: bat.foe[0].maxSp, anim: '', hidden: true }));
  const [panel, setPanel] = useState<Panel>('busy');
  const [text, setText] = useState('');
  const [full, setFull] = useState('');
  const [intro, setIntro] = useState(true);
  const [fx, setFx] = useState<{ key: number; side: Side; sheet: Sheet; scale: number } | null>(null);
  const [proj, setProj] = useState<{ key: number; from: Side; sheet: Sheet } | null>(null);
  const [shake, setShake] = useState(false);
  const used = useRef(new Set<string>([party[0]?.sightingId ?? '']));
  const fast = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const k = useRef(0);

  useEffect(() => { const cv = canvas.current; if (!cv) return; return runBackdrop(cv, r.scene, { focus: 0.5, reduced }); }, [r.scene, reduced]);

  /** Typewriter text box; tapping it finishes the line and skips the pause. */
  const say = useCallback(async (line: string, hold = 700) => {
    fast.current = false; setFull(line);
    if (reduced) setText(line);
    else for (let i = 1; i <= line.length; i++) { if (fast.current) break; setText(line.slice(0, i)); await sleep(18); }
    setText(line);
    const until = performance.now() + hold;
    while (performance.now() < until && !fast.current) await sleep(30);
  }, [reduced]);

  const setSide = (s: Side, f: (v: SideView) => SideView) => (s === 'you' ? setYou(f) : setFoe(f));
  const anim = async (s: Side, a: Anim, ms: number) => { setSide(s, (v) => ({ ...v, anim: a })); await sleep(reduced ? Math.min(ms, 200) : ms); setSide(s, (v) => ({ ...v, anim: '' })); };
  const burst = (s: Side, sheet: Sheet, scale = 3) => { if (!reduced) setFx({ key: ++k.current, side: s, sheet, scale }); };

  const play = useCallback(async (ev: Ev[], before: Battle) => {
    for (const e of ev) {
      switch (e.t) {
        case 'msg': await say(e.text); break;
        case 'use': {
          playClip(CONTESTS[e.move.style].clip, { vol: 0.8 });
          const lunge = anim(e.side, 'lunge', 380);
          if (e.move.power && !reduced) { setProj({ key: ++k.current, from: e.side, sheet: CONTESTS[e.move.style].proj }); await sleep(560); setProj(null); }
          else if (!e.move.power) burst(e.side, FX_RING, 2);
          await lunge; break;
        }
        case 'hit': {
          burst(e.side, e.crit ? FX_CRIT : CONTESTS[e.style].boom, e.crit ? 4 : 3);
          playClip(e.crit ? 'tCritical' : 'tHit', { vol: e.eff > 1 ? 1 : 0.7 });
          if (e.crit || e.eff > 1) { haptic(e.crit ? [20, 40, 30] : 18); if (!reduced) { setShake(true); setTimeout(() => setShake(false), 380); } }
          await anim(e.side, 'hit', 480); break;
        }
        case 'miss': await anim(e.side, 'dodge', 360); break;
        case 'spirit': setSide(e.side, (v) => ({ ...v, sp: e.value, max: e.max })); await sleep(reduced ? 150 : 620); break;
        case 'stat': playClip('tPick', { vol: 0.5 }); await anim(e.side, e.up ? 'up' : 'down', 560); break;
        case 'heal': burst(e.side, { src: 'fx/trials/star_boom.png', frames: 7, fw: 32, fh: 32 }, 3); await anim(e.side, 'heal', 520); break;
        case 'rest': playClip('tTie', { vol: 0.7 }); await anim(e.side, 'rest', 760); setSide(e.side, (v) => ({ ...v, hidden: true })); break;
        case 'send': {
          const f = e.side === 'you' ? before.you[e.index] : before.foe[e.index];
          if (e.side === 'you') used.current.add(party[e.index]?.sightingId ?? '');
          setSide(e.side, () => ({ idx: e.index, sp: f.sp, max: f.maxSp, anim: 'enter', hidden: false }));
          playClip('tPick', { vol: 0.6 }); await sleep(reduced ? 120 : 520); setSide(e.side, (v) => ({ ...v, anim: '' }));
          break;
        }
        case 'end': break;
      }
    }
  }, [say, reduced, party]);

  const afterTurn = useCallback(async (b: Battle) => {
    setBat(b);
    if (b.over) {
      await say(b.over === 'you' ? `You won against ${r.name}!` : `${r.name}'s birds stole the show.`, 600);
      await say(`${r.name}: “${b.over === 'you' ? r.win : r.lose}”`, 1100);
      onEnd(b.over === 'you', [...used.current].filter((id) => id && id !== 'partner'));
      return;
    }
    if (b.you[b.yi].out) { setFull('Choose your next bird.'); setText('Choose your next bird.'); setPanel('force'); return; }
    const line = `What will ${b.you[b.yi].c.sp.common} do?`; setFull(line); setText(line); setPanel('menu');
  }, [r, onEnd, say]);

  // intro: VS splash, then the send-outs
  useEffect(() => {
    let live = true;
    (async () => {
      await sleep(reduced ? 300 : 1500); if (!live) return;
      setIntro(false);
      await say(`${r.name} wants a friendly contest!`, 600);
      setFoe((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      await say(`${r.name} sent out ${rTeam[0].sp.common}!`, 500); setFoe((v) => ({ ...v, anim: '' }));
      setYou((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      await say(`Go, ${party[0].sp.common}!`, 400); setYou((v) => ({ ...v, anim: '' }));
      if (live) afterTurn(batRef.current);
    })();
    return () => { live = false; };
  }, []);

  const act = async (a: Parameters<typeof takeTurn>[1]) => {
    setPanel('busy');
    const before = batRef.current;
    const { b, ev } = takeTurn(before, a, Math.random);
    await play(ev, before);
    await afterTurn(b);
  };
  const force = async (to: number) => {
    setPanel('busy');
    const before = batRef.current;
    const { b, ev } = sendIn(before, to);
    await play(ev, before);
    await afterTurn(b);
  };

  const me = bat.you[you.idx], them = bat.foe[foe.idx];
  const curMe = bat.you[bat.yi];

  return (
    <div className={`tbattle ${shake ? 'shake' : ''}`}>
      <div className="tscene">
        <canvas ref={canvas} className="tstage-bg pix" aria-hidden />
        <span className="tplat foe" aria-hidden /><span className="tplat you" aria-hidden />

        <div className={`tinfo foe ${foe.hidden ? 'gone' : ''}`}>
          <div className="tinfo-row"><b className="tinfo-name">{them.c.sp.common}</b><span className="px">Lv{them.c.level}</span></div>
          <div className="tinfo-row"><TypeChip c={them.style} small /><span className="tballs">{bat.foe.map((f, i) => <i key={i} className={f.out ? 'out' : ''} />)}</span></div>
          <SpiritBar value={foe.sp} max={foe.max} />
        </div>
        <div className={`tmon foe ${foe.anim} ${foe.hidden ? 'gone' : ''}`}>
          <Sprite species={them.c.sp} scale={3} mode={foe.anim === 'lunge' ? 'fly' : 'idle'} flip />
          {fx?.side === 'foe' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={520} className="tboom" />}
        </div>

        <div className={`tmon you ${you.anim} ${you.hidden ? 'gone' : ''}`}>
          <Sprite species={me.c.sp} parts={me.c.parts} scale={5} mode={you.anim === 'lunge' ? 'fly' : 'idle'} />
          {fx?.side === 'you' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={520} className="tboom" />}
        </div>
        <div className={`tinfo you ${you.hidden ? 'gone' : ''}`}>
          <div className="tinfo-row"><b className="tinfo-name">{me.c.sp.common}</b><span className="px">Lv{me.c.level}</span></div>
          <div className="tinfo-row"><TypeChip c={me.style} small /><span className="tballs">{bat.you.map((f, i) => <i key={i} className={f.out ? 'out' : ''} />)}</span></div>
          <SpiritBar value={you.sp} max={you.max} numbers />
        </div>

        {proj && <span key={proj.key} className={`tproj2 from-${proj.from}`}><Fx sheet={proj.sheet} scale={3} ms={300} loop style={proj.from === 'foe' ? { transform: 'scaleX(-1)' } : undefined} /></span>}

        {intro && (
          <div className="tvs" aria-hidden>
            <div className="tvs-top"><span className="tvs-name px">{r.name}</span><span className="small">{r.title}</span></div>
            <div className="tvs-mid px">VS</div>
            <div className="tvs-bot"><span className="tvs-name px">You</span><span className="small">{party.length} bird{party.length > 1 ? 's' : ''}</span></div>
          </div>
        )}
      </div>

      <div className="tpanel">
        <button className="tbox" onClick={() => { fast.current = true; }} aria-live="polite" aria-label={full}>
          <span>{text}</span>{panel === 'busy' && text === full && <span className="tbox-more" aria-hidden>▼</span>}
        </button>

        {panel === 'menu' && (
          <div className="tmenu">
            <button className="tcmd perform" onClick={() => { sfx.select(); setPanel('moves'); }}>Perform</button>
            <button className="tcmd bag" onClick={() => { sfx.select(); setPanel('bag'); }}>Bag</button>
            <button className="tcmd birds" onClick={() => { sfx.select(); setPanel('birds'); }}>Birds</button>
            <button className="tcmd run" onClick={() => { sfx.back(); act({ kind: 'run' }); }}>Run</button>
          </div>
        )}

        {panel === 'moves' && (
          <div className="tmoves">
            {curMe.moves.map((m: Move) => {
              const left = curMe.pp[m.id] ?? 0, eff = m.power ? effectiveness(m.style, them.style) : 1;
              return (
                <button key={m.id} className="tmove" style={{ ['--c' as string]: CONTESTS[m.style].color }} disabled={left <= 0}
                  onClick={() => { sfx.select(); act({ kind: 'move', id: m.id }); }}
                  aria-label={`${m.name}, ${CONTESTS[m.style].name} style, ${m.power ? `power ${m.power}` : 'status move'}, ${left} of ${m.pp} uses left. ${m.desc}${eff > 1 ? ' Super impressive against this bird.' : eff < 1 ? ' Not very impressive against this bird.' : ''}`}>
                  <span className="tmove-name">{m.name}</span>
                  <span className="tmove-meta"><TypeChip c={m.style} small /><span className="px">{left}/{m.pp}</span></span>
                  {eff > 1 && <span className="tmove-eff good">Super!</span>}
                  {eff < 1 && <span className="tmove-eff bad">Weak</span>}
                  {!m.power && <span className="tmove-eff">Status</span>}
                </button>
              );
            })}
            <button className="tcmd-back" onClick={() => { sfx.back(); setPanel('menu'); }}>◀ Back</button>
          </div>
        )}

        {panel === 'bag' && (
          <div className="tlist">
            {(Object.keys(ITEMS) as Item[]).map((it) => (
              <button key={it} className="trow2" disabled={(items[it] ?? 0) < 1}
                onClick={() => { if (spendTrialItem(it)) { sfx.select(); act({ kind: 'item', item: it }); } }}>
                <b>{ITEMS[it].name}</b><span className="small muted">{ITEMS[it].desc}</span><span className="px">×{items[it] ?? 0}</span>
              </button>
            ))}
            {(['seeds', 'berries', 'worms'] as Item[]).every((it) => (items[it] ?? 0) < 1) && <p className="small muted" style={{ margin: 0 }}>Your pantry is empty. Buy food in Merlin's Shop.</p>}
            <button className="tcmd-back" onClick={() => { sfx.back(); setPanel('menu'); }}>◀ Back</button>
          </div>
        )}

        {(panel === 'birds' || panel === 'force') && (
          <div className="tlist">
            {bat.you.map((f, i) => (
              <button key={i} className={`trow2 bird ${i === bat.yi ? 'cur' : ''}`} disabled={f.out || i === bat.yi}
                onClick={() => { sfx.select(); if (panel === 'force') force(i); else act({ kind: 'switch', to: i }); }}>
                <Sprite species={f.c.sp} parts={f.c.parts} scale={1} mode="static" />
                <b>{f.c.sp.common}</b><TypeChip c={f.style} small />
                <span className="trow2-bar"><SpiritBar value={f.sp} max={f.maxSp} numbers /></span>
                {f.out && <span className="small muted">Resting</span>}
              </button>
            ))}
            {panel === 'birds' && <button className="tcmd-back" onClick={() => { sfx.back(); setPanel('menu'); }}>◀ Back</button>}
            {panel === 'birds' && !canSwitch(bat) && <p className="small muted" style={{ margin: 0 }}>No other birds ready.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── result ───
function Result({ rival, won, prize, party, onRematch, onLadder, onNext }: {
  rival: number; won: boolean; prize: ReturnType<typeof finishTrial>; party: Contender[]; onRematch: () => void; onLadder: () => void; onNext?: () => void;
}) {
  const r = RIVALS[rival];
  return (
    <div className="trials-body tresult">
      <div className={`tresult-hero ${won ? 'won' : 'lost'}`}>
        {won && <Fx sheet={FX_RING} scale={4} ms={900} loop className="tresult-ring" />}
        <h1>{won ? 'Victory!' : 'So close!'}</h1>
        <p className="small" style={{ margin: 0 }}>{r.name}: “{won ? r.win : r.lose}”</p>
      </div>
      {won && (
        <div className="tprize">
          {prize.coins > 0 ? <span><FeatherIcon size={18} /> +{prize.coins} Feather Coins</span> : <span>No prize left today</span>}
          {prize.xp > 0 && <span className="px">+{prize.xp} XP</span>}
          {prize.first && <span className="tprize-tag">First win!</span>}
        </div>
      )}
      {won && prize.levelled.length > 0 && (
        <div className="tlevels">
          {party.filter((c) => c.sightingId && prize.levelled.includes(c.sightingId)).map((c) => (
            <div key={c.sp.id} className="tlevel"><Sprite species={c.sp} parts={c.parts} scale={2} mode="idle" /><span><b>{c.sp.common}</b> grew to <span className="px">Lv{c.level + 1}</span>!</span></div>
          ))}
        </div>
      )}
      {!won && <p className="small">Tip: their {r.styles.map((s) => CONTESTS[s].name).join(' and ')} birds are outshone by {r.styles.map((s) => CONTESTS[counterOf(s)].name).join(' and ')} birds. {BEAT_WHY[counterOf(r.styles[0])]}</p>}
      <div className="trials-cta col">
        {onNext && <button className="btn primary big block" onClick={onNext}>Next rival: {RIVALS[rival + 1].name} ▶</button>}
        <button className={`btn block ${onNext ? '' : 'primary big'}`} onClick={onRematch}>{won ? 'Rematch' : 'Try again'}</button>
        <button className="btn ghost block" onClick={onLadder}>Back to the rivals</button>
      </div>
    </div>
  );
}
