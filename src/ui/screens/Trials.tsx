// Field Trials v3: fast, Step Quest-style bird battles with a modern HUD. One tap a turn:
// Quick move · Signature skill (a real-life talent) · Guard · Snack, plus a Super gauge and Run.
// HP reaching 0 means the bird flies off to rest; nobody gets hurt.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNav } from '../nav';
import { useGame, getState, counts, speciesOf, finishTrial, finishWild, noteBattle, spendTrialItem } from '../../app/store';
import { regionEntries, speciesById } from '../../data/provider';
import { playClip, preloadTrialClips, sfx, haptic, battleMusic } from '../../app/audio';
import { TopBar, Sprite, Icon, useReducedMotion } from '../components';
import { FeatherChip } from '../kit';
import { FeatherIcon } from '../FeatherIcon';
import { FoodIcon } from '../FoodIcon';
import { Professor } from '../Characters';
import { runBackdrop } from '../../render/diorama';
import { dayKey } from '../../core/xp';
import type { Species } from '../../data/types';
import {
  CONTESTS, RIVALS, WANDERERS, WILD, wandererFace, FX_CRIT, FX_RING, SNACKS, T, fighter, startBattle, takeTurn, ambush, active, rivalTeam, wildTeam, rewardFor,
  type Contender, type Battle, type Ev, type Side, type Item, type Action, type Sheet,
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

/** A rival trainer's portrait (Professor Merlin uses his own sprite). */
export function Face({ face, merlin, name, size = 56, className }: { face?: string; merlin?: boolean; name: string; size?: number; className?: string }) {
  return (
    <span className={`tface ${className ?? ''}`} style={{ width: size, height: size }}>
      {merlin ? <Professor height={Math.max(48, size - 8)} /> : face ? <img src={face} alt={name} width={size} height={size} draggable={false} /> : null}
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
      {phase === 'party' && <Party setup={setup} size={RIVALS[ri].size} team={team} party={party} setParty={setParty} onGo={() => { playClip('tStart'); haptic(14); setSeed((s) => s + 1); setPhase('battle'); }} />}
      {phase === 'battle' && party.length > 0 && (
        <BattleView key={seed} setup={setup} party={party}
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
  const today = dayKey(new Date());
  const avg = team.slice(0, 3).reduce((n, c) => n + c.level, 0) / Math.max(1, Math.min(3, team.length));
  return (
    <div className="trials-body">
      <div className="thero panel">
        <span className="thero-kicker">Battle mode</span>
        <b className="thero-title">Field Trials</b>
        <span className="thero-sub">Birds compete with their real-life talents. Beat each rival birder to unlock the next.</span>
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
                  <button className="btn primary small" disabled={team.length === 0} onClick={() => onPick(i)} aria-label={`${beaten ? 'Rematch' : 'Battle'} ${r.name}`}>{beaten ? 'Rematch' : 'Battle'}</button>
                )}
                <span className="trival-prize">{beaten ? <span className="trival-done">✓ Beaten</span> : rw.coins ? <><FeatherIcon size={12} /> {rw.coins}</> : null}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>First wins pay the full prize and level up your birds. Losing costs nothing.</p>
    </div>
  );
}

// ─── party ───
function Party({ setup, size, team, party, setParty, onGo }: { setup: Setup; size: number; team: Contender[]; party: Contender[]; setParty: (p: Contender[]) => void; onGo: () => void }) {
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
          <p className="small" style={{ margin: '6px 0 0' }}>“{setup.line}”</p>
        </div>
      </div>
      <div className="section-title"><span>Your party · {party.length}/3</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>First one leads</span></div>
      <div className="tpicker" role="list">
        {team.map((c) => {
          const f = fighter(c), at = party.findIndex((p) => p.sp.id === c.sp.id);
          return (
            <button key={c.sp.id} role="listitem" className={`tpick ${at >= 0 ? 'on' : ''}`} onClick={() => toggle(c)} aria-pressed={at >= 0}
              aria-label={`${c.sp.common}, level ${f.c.level}, ${f.max} HP. Signature skill: ${f.skill.name}, ${f.skill.tag}.`}>
              {at >= 0 && <span className="tpick-tag">{at === 0 ? 'Lead' : at + 1}</span>}
              <Sprite species={c.sp} parts={c.parts} scale={2} mode="static" />
              <span className="tpick-name">{c.sp.common}</span>
              <span className="tpick-lv">Lv{f.c.level} · {f.max} HP</span>
              <span className="tpick-skill" style={{ ['--c' as string]: CONTESTS[f.skill.style].color }}>{f.skill.name}</span>
            </button>
          );
        })}
      </div>
      <div className="trials-cta">
        <button className="btn primary big block" disabled={!party.length} onClick={onGo}>Start battle</button>
      </div>
    </div>
  );
}

// ─── battle ───
type Anim = '' | 'enter' | 'lunge' | 'hit' | 'rest' | 'charge' | 'guard';
interface SideView { idx: number; hp: number; max: number; anim: Anim; hidden: boolean }
interface Pop { id: number; side: Side; text: string; kind: 'dmg' | 'crit' | 'heal' | 'info' | 'miss' | 'bad' }
type Panel = 'busy' | 'menu' | 'snack';

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
    { id: 'hud', info: true, text: `Welcome to your first Field Trial! Birds compete with their real-life talents. Bring ${foe.c.sp.common}'s HP to 0 and it flies off to rest. Nobody gets hurt.` },
    { id: 'quick', info: false, text: `Tap ${me.quick}. It's your quick move: always ready to use.` },
    { id: 'skill', info: false, text: `Now try ${me.skill.name}, your ${me.c.sp.common}'s signature skill. Real fact: ${me.skill.fact} It's stronger, then recharges for a turn.` },
    { id: 'guard', info: false, text: `${foe.c.sp.common} is gathering itself for a Big Move! Tap Guard to block most of it.` },
    { id: 'snack', info: true, text: 'Nicely blocked! Snack feeds your bird from your pantry: seeds and berries heal, mealworms power it up. Buy more food in Merlin’s Shop.' },
    { id: 'super', info: false, text: `Your Super gauge fills as you battle, and it's full! Tap it to unleash ${CONTESTS[me.style].super}.` },
    { id: 'done', info: true, text: 'That’s everything! In later battles a turn timer keeps things fast, so choose quickly. Now finish the trial!' },
  ];
};

function BattleView({ setup, party, onEnd }: { setup: Setup; party: Contender[]; onEnd: (won: boolean, birds: string[]) => void }) {
  const reduced = useReducedMotion();
  const items = useGame((s) => s.items);
  const firstBattle = useMemo(() => !getState().trials?.tutorial, []);
  const timed = useMemo(() => (getState().trials?.battles ?? 0) > 0 && !firstBattle, [firstBattle]);
  const [bat, setBat] = useState<Battle>(() => startBattle(party, setup.foe, setup.foeName, { foeHp: firstBattle ? 2.6 : 1 }));
  const batRef = useRef(bat); batRef.current = bat;
  const [you, setYou] = useState<SideView>(() => ({ idx: 0, hp: bat.you[0].hp, max: bat.you[0].max, anim: '', hidden: true }));
  const [foe, setFoe] = useState<SideView>(() => ({ idx: 0, hp: bat.foe[0].hp, max: bat.foe[0].max, anim: '', hidden: true }));
  const [gauge, setGauge] = useState(0);
  const [panel, setPanel] = useState<Panel>('busy');
  const [msg, setMsgText] = useState('');
  const [speaker, setSpeaker] = useState(false);
  const setMsg = (t: string) => { setMsgText(t); setSpeaker(false); };
  const say = (t: string) => { setMsgText(t); setSpeaker(true); };
  const [intro, setIntro] = useState(true);
  const [charging, setCharging] = useState(false);
  const [fx, setFx] = useState<{ key: number; side: Side; sheet: Sheet; scale: number } | null>(null);
  const [proj, setProj] = useState<{ key: number; from: Side; sheet: Sheet; big: boolean } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [tut, setTut] = useState<number>(firstBattle ? 0 : -1);
  const tutRef = useRef(tut); tutRef.current = tut;
  const [clock, setClock] = useState<number | null>(null);
  const used = useRef(new Set<string>([party[0]?.sightingId ?? '']));
  const canvas = useRef<HTMLCanvasElement>(null);
  const k = useRef(0);
  const steps = useMemo(() => TUT(bat), []);
  const [shown, setShown] = useState(false); // birds are in: the tutorial may start
  const step = shown && tut >= 0 && tut < steps.length ? steps[tut] : null;

  useEffect(() => { const cv = canvas.current; if (!cv) return; return runBackdrop(cv, setup.scene, { focus: 0.5, reduced }); }, [setup.scene, reduced]);
  useEffect(() => { battleMusic(true, setup.music); }, []);

  const setSide = (s: Side, f: (v: SideView) => SideView) => (s === 'you' ? setYou(f) : setFoe(f));
  const anim = async (s: Side, a: Anim, ms: number) => { setSide(s, (v) => ({ ...v, anim: a })); await sleep(reduced ? Math.min(ms, 150) : ms); setSide(s, (v) => ({ ...v, anim: v.anim === a ? '' : v.anim })); };
  const pop = (side: Side, text: string, kind: Pop['kind']) => { const id = ++k.current; setPops((p) => [...p, { id, side, text, kind }]); setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 950); };
  const burst = (s: Side, sheet: Sheet, scale = 3) => { if (!reduced) setFx({ key: ++k.current, side: s, sheet, scale }); };

  const play = useCallback(async (ev: Ev[], before: Battle) => {
    for (const e of ev) {
      switch (e.t) {
        case 'log': if (/ sends out /.test(e.text)) { const nm = e.text.split(' sends out ')[1]?.replace(/!$/, ''); say(`Go, ${nm}! Show them what you've got!`); } else setMsg(e.text); break;
        case 'move': {
          const def = CONTESTS[e.style];
          playClip(e.kind === 'super' || e.kind === 'big' ? 'tCritical' : def.clip, { vol: 0.8 });
          if (e.side === 'foe' && e.kind === 'big') setCharging(false);
          if (e.kind === 'super') { setFlash(true); setTimeout(() => setFlash(false), 260); }
          const l = anim(e.side, 'lunge', 300);
          if (!reduced) { setProj({ key: ++k.current, from: e.side, sheet: def.proj, big: e.kind === 'super' || e.kind === 'big' }); await sleep(380); setProj(null); }
          await l; break;
        }
        case 'dmg': {
          burst(e.side, e.crit || e.big ? FX_CRIT : CONTESTS[e.style].boom, e.big ? 4 : 3);
          pop(e.side, e.blocked ? `-${e.amount} blocked` : `-${e.amount}`, e.crit || e.big ? 'crit' : 'dmg');
          playClip(e.blocked ? 'tTie' : 'tHit', { vol: 0.75 });
          if (e.crit || e.big) { haptic([20, 30, 20]); if (!reduced) { setShake(true); setTimeout(() => setShake(false), 340); } } else haptic(10);
          await anim(e.side, 'hit', 300); break;
        }
        case 'miss': pop(e.side, 'Miss', 'miss'); await sleep(260); break;
        case 'hp': setSide(e.side, (v) => ({ ...v, hp: e.value, max: e.max })); await sleep(reduced ? 80 : 260); break;
        case 'heal': pop(e.side, `+${e.amount}`, 'heal'); burst(e.side, FX_RING, 2); await sleep(320); break;
        case 'buff': pop(e.side, e.text, e.good ? 'info' : 'bad'); await sleep(280); break;
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
      say(b.over === 'you' ? r?.win ?? 'Wow, your birds are amazing!' : r?.lose ?? 'My birds take this one! Good battle!');
      noteBattle(firstBattle);
      await sleep(1800);
      onEnd(b.over === 'you', [...used.current].filter((id) => id && id !== 'partner'));
      return;
    }
    setPanel('menu');
    if (tutRef.current < 0) setMsg(`What will ${active(b, 'you').c.sp.common} do?`);
  }, [setup.foeName, onEnd, firstBattle]);

  // intro: title card, birds fly in, maybe an ambush
  useEffect(() => {
    let live = true;
    (async () => {
      await sleep(reduced ? 300 : 1300); if (!live) return;
      setIntro(false);
      say(setup.line);
      await sleep(reduced ? 300 : 1400); if (!live) return;
      say(`Go, ${setup.foe[0].sp.common}!`);
      setFoe((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      await sleep(600); setFoe((v) => ({ ...v, anim: '' }));
      setYou((v) => ({ ...v, hidden: false, anim: 'enter' })); playClip('tPick', { vol: 0.6 });
      setMsg(`Go, ${party[0].sp.common}!`);
      await sleep(500); setYou((v) => ({ ...v, anim: '' }));
      if (!live) return;
      setShown(true);
      if (timed && Math.random() < T.ambush) {
        const before = batRef.current, r = ambush(before, Math.random);
        await play(r.ev, before); if (!live) return;
        return ready(r.b);
      }
      ready(batRef.current);
    })();
    return () => { live = false; };
  }, []);

  const act = async (a: Action) => {
    setPanel('busy'); setClock(null);
    const before = batRef.current;
    const s = steps[tutRef.current]?.id;
    const { b, ev } = takeTurn(before, a, Math.random, { forceCharge: s === 'skill' });
    await play(ev, before);
    // tutorial: move on to the next lesson, and fill the Super gauge for the Super lesson
    if (tutRef.current >= 0) {
      let n = tutRef.current + 1;
      if (!b.over && steps[n]?.id === 'guard' && !b.foeCharging) n = steps.findIndex((x) => x.id === 'snack');
      setTut(b.over || n >= steps.length ? -1 : n);
      tutRef.current = b.over || n >= steps.length ? -1 : n;
    }
    await ready(b);
  };

  // turn timer (not in your first battles)
  useEffect(() => {
    if (panel !== 'menu' || !timed || tut >= 0) { setClock(null); return; }
    const end = performance.now() + setup.time * 1000;
    setClock(setup.time);
    const iv = setInterval(() => {
      const left = Math.max(0, (end - performance.now()) / 1000);
      setClock(left);
      if (left <= 0) { clearInterval(iv); act({ kind: 'wait' }); }
    }, 100);
    return () => clearInterval(iv);
  }, [panel, bat.turn, tut]);

  const me = bat.you[you.idx], them = bat.foe[foe.idx], cur = active(bat, 'you');
  const tutId = step?.id;
  const lock = (id: string) => panel !== 'menu' || (!!step && (step.info || tutId !== id));
  const snacks = (['seeds', 'berries', 'worms'] as Item[]).reduce((n, it) => n + (items[it] ?? 0), 0);
  const sReady = gauge >= 100;
  const skillCd = cur.cd;

  const Act = ({ id, cls, icon, name, sub, onClick, disabled }: { id: string; cls: string; icon: ReactNode; name: string; sub: string; onClick: () => void; disabled?: boolean }) => (
    <button className={`tact ${cls} ${tutId === id && !step?.info ? 'tut-focus' : ''}`} onClick={onClick} disabled={disabled || lock(id)} aria-label={`${name}: ${sub}`}>
      <span className="tact-ic" aria-hidden>{icon}</span>
      <span className="tact-txt"><b>{name}</b><small>{sub}</small></span>
    </button>
  );

  return (
    <div className={`tb ${shake ? 'shake' : ''}`} style={{ ['--c' as string]: CONTESTS[cur.style].color }}>
      <div className="tb-stage">
        <canvas ref={canvas} className="tb-bg pix" aria-hidden />
        <div className={`tb-flash ${flash ? 'on' : ''}`} aria-hidden />

        <div className={`thud ${tutId === 'hud' ? 'tut-focus' : ''}`}>
          <div className={`thud-card you ${you.hidden ? 'dim' : ''}`}>
            <div className="thud-top"><b className="thud-name">{me.c.sp.common}</b><span className="thud-lv">Lv{me.c.level}</span></div>
            <HpBar hp={you.hp} max={you.max} />
            <span className="thud-pips">{bat.you.map((f, i) => <i key={i} className={f.out ? 'out' : i === bat.yi ? 'on' : ''} />)}</span>
          </div>
          {clock != null ? (
            <div className={`ttimer ${clock < 3 ? 'urgent' : ''}`} aria-label={`${Math.ceil(clock)} seconds left`}><b>{Math.ceil(clock)}</b><i style={{ width: `${(clock / setup.time) * 100}%` }} /></div>
          ) : <div className="tvs-dot" aria-hidden>VS</div>}
          <div className={`thud-card foe ${foe.hidden ? 'dim' : ''}`}>
            <div className="thud-top"><b className="thud-name">{them.c.sp.common}</b><span className="thud-lv">Lv{them.c.level}</span></div>
            <HpBar hp={foe.hp} max={foe.max} />
            <span className="thud-pips">{bat.foe.map((f, i) => <i key={i} className={f.out ? 'out' : i === bat.fi ? 'on' : ''} />)}</span>
          </div>
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
        <div className={`tlog dialog ${speaker ? 'speech' : ''}`} role="status" aria-live="polite">
          {speaker && <span className="dialog-name">{setup.foeName}</span>}
          {speaker && <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={44} className="tlog-face" />}
          <p className="dialog-text">{speaker ? `“${msg}”` : msg}</p>
        </div>

        {intro && (
          <div className="tintro" aria-hidden>
            <span className="tintro-k">Battle mode</span>
            <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={112} className="tintro-face" />
            <b className="tintro-t">{setup.foeName}</b>
            <span className="tintro-s">{setup.title}</span>
          </div>
        )}
      </div>

      <div className="ttray">
        {step && (
          <div className="ttut dialog" role="dialog" aria-label="Battle tutorial">
            <span className="dialog-name">Merlin · {tut + 1}/{steps.length}</span>
            <div className="ttut-merlin"><Professor height={48} /></div>
            <div className="ttut-body">
              <p className="dialog-text">{step.text}</p>
              {step.info && <button className="btn primary small" onClick={() => {
                sfx.select(); const n = tut + 1 >= steps.length ? -1 : tut + 1; setTut(n); tutRef.current = n;
                if (steps[n]?.id === 'super') { const nb = { ...batRef.current, gauge: 100 }; setBat(nb); batRef.current = nb; setGauge(100); }
                if (n < 0) setMsg(`What will ${cur.c.sp.common} do?`);
              }}>{tut + 1 >= steps.length ? 'Let’s go!' : 'Next'}</button>}
            </div>
          </div>
        )}
        {panel !== 'snack' ? (
          <>
            <button className={`tsuper ${sReady ? 'ready' : ''} ${tutId === 'super' ? 'tut-focus' : ''}`} disabled={!sReady || lock('super')} onClick={() => { sfx.select(); act({ kind: 'super' }); }}
              aria-label={sReady ? `Super move ${CONTESTS[cur.style].super}: ready` : `Super move charging, ${gauge}%`}>
              <i style={{ width: `${gauge}%` }} aria-hidden />
              <span className="tsuper-l"><Icon name="star" size={16} /> <span>{CONTESTS[cur.style].super}</span></span>
              <span className="tsuper-r">{sReady ? 'Ready!' : `${gauge}%`}</span>
            </button>
            <div className="tgrid">
              <Act id="quick" cls="quick" icon={<Fx sheet={CONTESTS[cur.style].proj} scale={1} frame={1} />} name={cur.quick} sub="Always ready" onClick={() => { sfx.select(); act({ kind: 'quick' }); }} />
              <Act id="skill" cls="skill" icon={<Fx sheet={CONTESTS[cur.skill.style].boom} scale={1} frame={2} />} name={cur.skill.name} sub={skillCd > 0 ? `Recharging · ${skillCd} turn` : cur.skill.tag} disabled={skillCd > 0} onClick={() => { sfx.select(); act({ kind: 'skill' }); }} />
              <Act id="guard" cls="guard" icon={<Fx sheet={FX_RING} scale={1} frame={3} />} name="Guard" sub="Block 60% of next hit" onClick={() => { sfx.select(); act({ kind: 'guard' }); }} />
              <Act id="snack" cls="snack" icon={<FoodIcon food="berries" size={26} />} name="Snack" sub={snacks ? `${snacks} in pantry` : 'Pantry empty'} disabled={!snacks} onClick={() => { sfx.select(); setPanel('snack'); }} />
            </div>
            <button className="btn ghost small trun" disabled={panel !== 'menu' || !!step} onClick={() => { sfx.back(); act({ kind: 'run' }); }}>Run away</button>
          </>
        ) : (
          <div className="tsnacks">
            {(['seeds', 'berries', 'worms'] as Item[]).map((it) => (
              <button key={it} className="tact snackrow" disabled={(items[it] ?? 0) < 1} onClick={() => { if (spendTrialItem(it)) { sfx.select(); act({ kind: 'snack', item: it }); } }}>
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
          {party.filter((c) => c.sightingId && prize.levelled.includes(c.sightingId)).map((c) => (
            <div key={c.sp.id} className="tlevel"><Sprite species={c.sp} parts={c.parts} scale={2} mode="idle" /><span><b>{c.sp.common}</b> grew to Lv{c.level + 1}!</span></div>
          ))}
        </div>
      )}
      {!won && <p className="small muted">Tip: Guard when the rival announces a Big Move, use your signature skill whenever it's ready, and save your Super for a strong bird.</p>}
      <div className="trials-cta col">
        {onNext && idx >= 0 && idx + 1 < RIVALS.length && <button className="btn primary big block" onClick={onNext}>Next rival: {RIVALS[idx + 1].name}</button>}
        {onRematch && <button className={`btn block ${onNext ? '' : 'primary big'}`} onClick={onRematch}>{won ? 'Rematch' : 'Try again'}</button>}
        <button className="btn ghost block" onClick={onLadder}>{wild ? 'Done' : 'Back to rivals'}</button>
      </div>
    </div>
  );
}
