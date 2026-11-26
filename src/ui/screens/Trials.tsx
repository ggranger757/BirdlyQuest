// Field Trials v3: fast, Step Quest-style bird battles with a modern HUD. One tap a turn:
// Quick move · Signature skill (a real-life talent) · Guard · Snack, plus a Super gauge and Run.
// HP reaching 0 means the bird flies off to rest; nobody gets hurt.
import { decodeDuel } from '../../core/duel';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNav } from '../nav';
import { finishDuel, useGame, getState, counts, speciesOf, finishTrial, finishWild, noteBattle, spendTrialItem, spendPotion, spendTicket } from '../../app/store';
import { POTIONS, potionTag, KIND_META, GAUGE_MAX } from '../../core/potions';
import { regionEntries, speciesById } from '../../data/provider';
import { playClip, preloadTrialClips, sfx, haptic, battleMusic } from '../../app/audio';
import { TopBar, Sprite, Icon, useReducedMotion } from '../components';
import { FeatherChip } from '../kit';
import { FeatherIcon } from '../FeatherIcon';
import { FoodIcon } from '../FoodIcon';
import { Professor, WOODS_RATIO } from '../Characters';
import { runBackdrop } from '../../render/diorama';
import { dayKey, trainerLevel } from '../../core/xp';
import type { Species } from '../../data/types';
import {
  CONTESTS, RIVALS, WANDERER_PERSONA, WILD, wandererFace, wandererFor, FX_CRIT, FX_RING, TECH_FX, critFx, SNACKS, GROW, TECHNIQUES, BEATS, TICKETS, T,
  fighter, startBattle, takeTurn, active, rivalTeam, wildTeam, rewardFor, birdStyle, matchup, bondFor, learnedBetween, nextUnlock, ticketsOf, battleIsFree,
  type Contender, type Battle, type Ev, type Side, type Item, type Action, type Sheet, type Contest, type Persona,
} from '../../core/trials';

const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
const hashName = (s: string) => wandererFor(s);

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

/** Turn timer: seconds of free thinking, then the visible countdown. */
const TURN_WAIT = 8, TURN_COUNT = 5;

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
  const tst = useGame((s) => s.trials);
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('bq-ticket-info') === '1'; } catch { return false; } });
  const toggle = () => { sfx.select(); setOpen((v) => { try { localStorage.setItem('bq-ticket-info', v ? '0' : '1'); } catch { /* private mode */ } return !v; }); };
  return (
    <>
      <button className={`tticket-chip ${tickets || free ? '' : 'empty'}`} onClick={toggle} aria-expanded={open}
        aria-label={`${free ? 'First duel free. ' : ''}${tickets} of ${TICKETS.max} Trial Tickets. ${open ? 'Hide' : 'Show'} details`}>
        <TicketIcon /> {free ? 'First duel free' : `${tickets}/${TICKETS.max} tickets`} <span className="tticket-caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <p className="tticket-note small">
          Rival duels use 1 ticket. Log a bird to earn one (max {TICKETS.max}). Challenges after a new find are free. Tickets never refill on their own.
          {(tst?.ticketsEarned !== undefined || tst?.ticketsUsed !== undefined) && (
            <span className="tticket-tally">You started with {TICKETS.start} · +{tst?.ticketsEarned ?? 0} from logging birds · −{tst?.ticketsUsed ?? 0} used in duels</span>
          )}
        </p>
      )}
    </>
  );
}

/** Trainer Bond chip: tap it to see what Bond is and what it does right now. */
function BondChip() {
  const tlv = trainerLevel(useGame((s) => s.xp)).level, pct = Math.round(bondFor(tlv) * 100), next = Math.round(bondFor(tlv + 1) * 100);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="tbond-chip" onClick={() => { sfx.select(); setOpen((v) => !v); }} aria-expanded={open}
        aria-label={`Bond plus ${pct} percent. ${open ? 'Hide' : 'Show'} what Bond does`}>
        <PixelEmoji name="heart" size={14} /> Bond +{pct}% <span className="tticket-caret" aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <p className="tticket-note tbond-note small">
          <b>Bond</b> is how well you know your birds. Your trainer level (Lv{tlv}) gives <b>every bird you bring +{pct}% energy and power</b>.
          {pct < 30 ? ` It grows by 1% each trainer level (next level: +${next}%), up to +30%. Log birds to earn trainer XP.` : ' That’s the maximum.'}
        </p>
      )}
    </>
  );
}

// Pixel emojis for the battle menu (12×12, one letter per colour; '.' is see-through).
const EMOJI_PAL: Record<string, string> = { K: '#141018', Y: '#FFD23F', O: '#F08A24', W: '#FFFFFF', L: '#E7A766', B: '#B8682A', D: '#6E3A14', G: '#F6C945', S: '#4FA7E3', N: '#2864A6', P: '#FFB36B', C: '#B9C6D6', R: '#E5484D' };
const EMOJI: Record<'fight' | 'bag' | 'birds' | 'run' | 'heart', string[]> = {
  heart: ['............', '.KKK...KKK..', 'KRRRK.KRRRK.', 'KRWRRKRRRRK.', 'KRRRRRRRRRK.', 'KRRRRRRRRRK.', '.KRRRRRRRK..', '..KRRRRRK...', '...KRRRK....', '....KRK.....', '.....K......', '............'],
  fight: ['......KKKK..', '.....KWYYK..', '....KWYYK...', '...KYYYK....', '..KYYYYKKKK.', '.KYYYYYYYOK.', '.KKKKYYYOK..', '....KYYOK...', '...KYYOK....', '...KYOK.....', '..KYOK......', '..KKK.......'],
  bag: ['....KKKK....', '...KDDDDK...', '...KD..DK...', '.KKKKKKKKKK.', 'KLLLLLLLLLLK', 'KBBBBBBBBBBK', 'KBBBKGGKBBBK', 'KBBBKGGKBBBK', 'KBBBBBBBBBBK', 'KDBBBBBBBBDK', '.KDDDDDDDDK.', '..KKKKKKKK..'],
  birds: ['............', '......KKKK..', '.....KSSSSK.', '.....KSSKSOO', '..KK.KSSSSK.', '.KSSKKSSSSK.', 'KSSSSSSSWWSK', 'KNSSSSSWWWWK', '.KNNSSWWWWK.', '..KKNNNNNK..', '....KKKKK...', '.....O.O....'],
  run: ['............', '........KKK.', '.......KWWWK', '..KKK.KWWWWK', '.KWWWKWWWCWK', 'KWWWWWWWWWCK', 'KWWWWWWWWCCK', '.KCWWWWCCCK.', '..KKKKKKKK..', '............', 'KKKK..KKKKK.', '...KKKK.....'],
};
function PixelEmoji({ name, size = 22 }: { name: keyof typeof EMOJI; size?: number }) {
  const rows = EMOJI[name];
  return (
    <svg className="temoji" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={EMOJI_PAL[ch]} />)))}
    </svg>
  );
}

/** Uses left on a move: dots for limited moves (refilled every battle), "Always" for moves that never run out. */
function Uses({ left, max }: { left?: number; max?: number }) {
  if (max === undefined || left === undefined) return <span className="tuses always" aria-hidden>Always</span>;
  return (
    <span className={`tuses ${left < 1 ? 'none' : ''}`} aria-hidden>
      <span className="tuses-pips">{Array.from({ length: max }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}</span>
      <span className="tuses-n">{left < 1 ? 'Used up' : `${left} left`}</span>
    </span>
  );
}

/** The whole rulebook, short and visual. Shown from the rival list and from the ? button during a battle. */
function BattleGuide() {
  const tlv = trainerLevel(useGame((s) => s.xp)).level, pct = Math.round(bondFor(tlv) * 100);
  const loop: Contest[] = ['song', 'display', 'forage', 'sky', 'song'];
  const sec = (n: number, title: string, body: ReactNode) => <section className="tg-sec"><h4><span className="tg-n">{n}</span>{title}</h4>{body}</section>;
  return (
    <div className="tguide">
      {sec(1, 'How to win', <p>Each bird has <b>energy</b>. Good moves from the other bird use it up. When a bird’s energy reaches 0, it gets tired and flies off to rest. Tire out all the rival’s birds to win.</p>)}
      {sec(2, 'Taking turns', <>
        <p>You and the rival take turns. On your turn, pick one:</p>
        <ul className="tg-acts">
          <li><b>Moves</b><span>use a move</span></li><li><b>Bag</b><span>snack or potion</span></li>
          <li><b>Birds</b><span>switch birds</span></li><li><b>Leave</b><span>end the duel</span></li>
        </ul>
        <p>The faster bird moves first. Take your time: after {TURN_WAIT} seconds a {TURN_COUNT}-second countdown starts, and if it runs out, the rival gets your turn.</p>
      </>)}
      {sec(3, 'Moves', <>
        <div className="tg-moves">
          <span><b>Quick move</b><small>Scores a few points. Use it as much as you like.</small></span><Uses />
          <span><b>Signature skill</b><small>Your bird’s special trick. Stronger, but only a few uses.</small></span><Uses left={T.skillPP} max={T.skillPP} />
          <span><b>Technique</b><small>A bonus trick learned at Lv{GROW.tech}.</small></span><Uses left={T.techPP} max={T.techPP} />
          <span><b>Guard</b><small>Goes first and blocks most of the rival’s next move.</small></span><Uses />
        </div>
        <p>The dots show uses left. They all come back next duel.</p>
      </>)}
      {sec(4, 'Classes', <>
        <p>Every bird has a class. Each class beats the next one in this circle:</p>
        <div className="tg-loop">{loop.map((c, i) => <Fragment key={i}>{i > 0 && <b aria-hidden>▶</b>}<i style={{ ['--c' as string]: CONTESTS[c].color }}>{CONTESTS[c].name}</i></Fragment>)}</div>
        <p><span className="tedge up">▲ Strong</span> means your move scores more. <span className="tedge down">▼ Weak</span> means softer. Seeing ▼? Try switching birds.</p>
      </>)}
      {sec(5, 'Power & Defense gauges', <>
        <p>Under each bird’s energy bar are two gauges with 5 pips each. Every <b style={{ color: '#E0483A' }}>✦ Power</b> pip makes your bird’s moves score 10% more. Every <b style={{ color: '#3A8FE0' }}>🛡 Defense</b> pip makes the rival’s moves score 10% less.</p>
        <p>Fill them with potions: <b style={{ color: '#E0483A' }}>red</b> for Power, <b style={{ color: '#3A8FE0' }}>blue</b> for Defense, <b style={{ color: '#4CC25A' }}>green</b> for both. Buy them in the Shop, then drink one from <b>Bag</b> (it uses your turn). Bigger bottles unlock as you level up. Gauges empty after each duel.</p>
      </>)}
      {sec(6, 'Super meter', <p>The purple bar fills a little each time you score, block or get scored on. When it says <b>Ready!</b>, tap it for your biggest move.</p>)}
      {sec(7, 'Red “!”', <p>A rival bird with a red <b>!</b> is getting ready for a giant move. Tap <b>Guard</b> to block it.</p>)}
      {sec(8, 'Bond', <p>As you level up as a birder, all your birds get stronger. Right now they get <b>+{pct}%</b>.</p>)}
      {sec(9, 'Tickets', <p>Each duel uses 1 ticket. Every bird you log gives you 1 more (you can hold {TICKETS.max}).</p>)}
    </div>
  );
}

/** Matchup arrow for a move's style against a bird's style. */
function Edge({ move, vs }: { move: Contest; vs: Contest }) {
  const e = matchup(move, vs);
  return e ? <span className={`tedge ${e > 0 ? 'up' : 'down'}`}>{e > 0 ? '▲ Strong' : '▼ Weak'}</span> : null;
}

/** A rival trainer's portrait. Professor Woods is drawn whole (never cropped): her 3:4 picture is fitted inside the box. */
export function Face({ face, merlin, name, size = 56, className, tall }: { face?: string; merlin?: boolean; name: string; size?: number; className?: string; tall?: boolean }) {
  const h = tall ? Math.round(size * 1.5) : size;
  const inner = (n: number) => n - 4; // inside the 2px border
  return (
    <span className={`tface ${tall ? 'tall' : ''} ${merlin ? 'woods-face' : ''} ${className ?? ''}`} style={{ width: size, height: h }}>
      {merlin ? <Professor mood="focused" height={Math.floor(Math.min(inner(h), inner(size) / WOODS_RATIO))} /> : face ? <img src={face} alt={name} width={size} height={h} draggable={false} /> : null}
    </span>
  );
}

/** The player's birds: best photo of each species, plus the partner bird. */

export function useTeam(): Contender[] {
  const sightings = useGame((s) => s.sightings);
  const partner = useGame((s) => s.partner);
  return useMemo(() => {
    const best = new Map<string, Contender>();
    for (const x of sightings) {
      if (!counts(x) || !x.speciesId) continue;
      const c: Contender = { sp: speciesOf(x), level: Math.min(50, x.level ?? 5), quality: x.fieldcraft?.total ?? 40, parts: x.sprite?.parts, sightingId: x.id };
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

interface Setup { wild?: boolean; foeName: string; title: string; scene: string; foe: Contender[]; time: number; merlin?: boolean; line: string; music: string; face?: string; persona: Persona; win: string; lose: string }
type Prize = { coins: number; xp: number; first: boolean; levelled: string[] };

export function Trials({ wild, duel }: { wild?: string; duel?: string }) {
  const nav = useNav();
  const tst = useGame((s) => s.trials);
  const region = useGame((s) => s.region);
  const bond = bondFor(trainerLevel(useGame((s) => s.xp)).level);
  const sightings = useGame((s) => s.sightings);
  const team = useTeam();
  const pool = useMemo(() => regionEntries(region).map((e) => e.sp), [region]);
  // a friend duel: their team, decoded from the code they shared
  const duelCard = useMemo(() => (duel ? decodeDuel(duel) : null), [duel]);
  const duelFoe: Contender[] = useMemo(() => (duelCard?.birds ?? []).map((b) => ({ sp: speciesById(b.id)!, level: b.level, quality: b.quality, parts: b.parts })).filter((c) => c.sp), [duelCard]);
  const [phase, setPhase] = useState<'ladder' | 'party' | 'battle' | 'result'>(wild ? 'battle' : duel ? 'party' : 'ladder');
  const [ri, setRi] = useState(0);
  const [party, setParty] = useState<Contender[]>(() => {
    if (!wild) return [];
    const x = sightings.find((s) => s.id === wild);
    const lead: Contender | null = x && x.speciesId ? { sp: speciesOf(x), level: Math.min(50, x.level ?? 5), quality: x.fieldcraft?.total ?? 40, parts: x.sprite?.parts, sightingId: x.id } : null;
    return lead ? [lead, ...team.filter((c) => c.sp.id !== lead.sp.id).slice(0, 2)] : team.slice(0, 3);
  });
  const [outcome, setOutcome] = useState<{ won: boolean; prize: Prize } | null>(null);
  const [seed, setSeed] = useState(0);
  useEffect(() => { preloadTrialClips(); return () => { battleMusic(false); }; }, []);

  const avg = (list: Contender[]) => list.reduce((n, c) => n + c.level, 0) / Math.max(1, list.length);
  const setup: Setup = useMemo(() => {
    if (duelCard) {
      const key = duelCard.name + duelCard.birds.map((b) => b.id).join(''), p = WANDERER_PERSONA[hashName(key)];
      let s = [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) + seed;
      const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      return {
        foeName: duelCard.name, title: `Your friend · Trainer Lv${duelCard.trainerLevel}`, scene: WILD.scenes[Math.floor(r() * WILD.scenes.length)], foe: duelFoe, time: WILD.time,
        face: wandererFace(key), music: WILD.music[Math.floor(r() * WILD.music.length)], line: `${duelCard.name} challenges you to a duel! Show them what your birds can do.`,
        persona: { ...p, bio: `${duelCard.name} is a fellow BirdlyQuest trainer.`, motive: 'a friendly duel' }, win: 'Good game! Send them your team back for a rematch.', lose: `${duelCard.name}'s birds won this time. Rematch?`, wild: true,
      } as Setup;
    }
    if (wild) {
      const name = hashName(wild), lead = party[0];
      let s = [...wild].reduce((n, ch) => n + ch.charCodeAt(0), 0) + seed;
      const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const p = WANDERER_PERSONA[name], nb = lead?.sp.common ?? 'bird';
      return { foeName: name, title: p.title, scene: WILD.scenes[Math.floor(r() * WILD.scenes.length)], foe: wildTeam(pool.length ? pool : team.map((t) => t.sp), lead?.level ?? 5, r, lead?.sp.id), time: WILD.time, face: wandererFace(wild), music: WILD.music[Math.floor(r() * WILD.music.length)],
        line: p.line.replace(/\{new\}/g, nb), persona: { ...p, motive: p.motive.replace(/\{new\}/g, nb) }, win: p.win, lose: p.lose, wild: true } as Setup;
    }
    const r = RIVALS[ri];
    return { foeName: r.name, title: r.title, scene: r.scene, foe: rivalTeam(r, pool.length ? pool : team.map((t) => t.sp), ri, avg(party.length ? party : team.slice(0, 3))), time: r.time, merlin: r.merlin, line: r.line, music: r.music, face: r.face, persona: r, win: r.win, lose: r.lose };
  }, [wild, duelCard, duelFoe, ri, pool, party, team, seed]);

  const choose = (i: number) => { sfx.select(); setRi(i); setParty(team.slice(0, 3)); setPhase('party'); };
  const back = () => { if (phase === 'ladder' || wild || duel) nav.back(); else { sfx.back(); setPhase('ladder'); } };
  const friendKey = duelCard ? duelCard.name + ':' + duelCard.birds.map((b) => b.id).join(',') : '';
  useEffect(() => { if (duel && !party.length) setParty(team.slice(0, 3)); }, [duel, team.length]);

  return (
    <div className={`overlay trials ${phase}`}>
      {phase !== 'battle' && <TopBar title={phase === 'ladder' ? 'Field Trials' : phase === 'party' ? 'Choose your birds' : duel ? 'Duel' : wild ? 'Challenge' : RIVALS[ri].name} onBack={back} right={<FeatherChip label={false} />} />}
      {phase === 'ladder' && <Ladder team={team} pool={pool} onPick={choose} onCamera={() => nav.open({ name: 'viewfinder' })} cleared={tst?.cleared ?? 0} wins={tst?.wins ?? 0} />}
      {phase === 'party' && <Party setup={setup} size={duel ? 3 : RIVALS[ri].size} team={team} party={party} setParty={setParty} bond={bond} duel={!!duel}
        onGo={() => { if (!duel && !spendTicket()) { sfx.error(); nav.toast('No Trial Tickets left. Log a bird to earn one!'); return; } playClip('tStart'); haptic(14); setSeed((s) => s + 1); setPhase('battle'); }} />}
      {phase === 'battle' && party.length > 0 && (
        <BattleView key={seed} setup={setup} party={party} bond={bond}
          onEnd={(won, used) => {
            const prize = duel ? finishDuel(won, used, friendKey) : wild ? finishWild(won, used) : finishTrial(ri, won, used);
            setOutcome({ won, prize });
            battleMusic(false);
            if (won) playClip('levelUp', { duck: true }); else playClip('tLose', { duck: true });
            setPhase('result');
          }} />
      )}
      {phase === 'battle' && party.length === 0 && <div className="trials-body"><p>You need a photographed bird to duel.</p></div>}
      {phase === 'result' && outcome && (
        <Result setup={setup} won={outcome.won} prize={outcome.prize} party={party} wild={!!wild || !!duel}
          onRematch={wild ? undefined : () => { setSeed((s) => s + 1); setPhase('party'); }} onLadder={() => (wild || duel ? nav.back() : setPhase('ladder'))}
          onSendBack={duel ? () => nav.replace({ name: 'duel' }) : undefined}
          onNext={!wild && outcome.won && ri + 1 < RIVALS.length ? () => choose(ri + 1) : undefined} />
      )}
    </div>
  );
}

// ─── ladder ───
function Ladder({ team, pool, cleared, wins, onPick, onCamera }: { team: Contender[]; pool: Species[]; cleared: number; wins: number; onPick: (i: number) => void; onCamera: () => void }) {
  const nav = useNav();
  const tst = useGame((s) => s.trials);
  const xp = useGame((s) => s.xp);
  const tickets = ticketsOf(tst), free = battleIsFree(tst);
  const [howOpen, setHow] = useState(false);
  const today = dayKey(new Date());
  const avg = team.slice(0, 3).reduce((n, c) => n + c.level, 0) / Math.max(1, Math.min(3, team.length));
  return (
    <div className="trials-body">
      <div className="thero panel">
        <span className="thero-kicker">Duel mode</span>
        <b className="thero-title">Field Trials</b>
        <span className="thero-sub">Birds compete with their real-life talents. Beat each rival birder to unlock the next.</span>
        <div className="thero-stats">
          <TicketInfo tickets={tickets} free={free} />
          <BondChip />
          <button className="btn ghost small" onClick={() => { sfx.select(); setHow((v) => !v); }} aria-expanded={howOpen}>{howOpen ? 'Close rules' : 'How duels work'}</button>
        </div>
        <button className="btn primary block tduel-btn" onClick={() => { sfx.select(); nav.open({ name: 'duel' }); }} disabled={team.length === 0}>✦ Duel a friend (QR code)</button>
        {howOpen && <BattleGuide />}
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
                    aria-label={`${beaten ? 'Rematch' : 'Duel'} ${r.name}${free ? '' : ', uses 1 Trial Ticket'}`}>{beaten ? 'Rematch' : 'Duel'}</button>
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
function Party({ setup, size, team, party, setParty, onGo, bond, duel }: { setup: Setup; size: number; team: Contender[]; party: Contender[]; setParty: (p: Contender[]) => void; onGo: () => void; bond: number; duel?: boolean }) {
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
          <p className="small tbio">{setup.persona.bio}</p>
          <p className="small tmotive"><b>Why they’re here:</b> {setup.persona.motive}</p>
        </div>
      </div>
      <div className="section-title"><span>Your party · {party.length}/3</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>First one leads</span></div>
      <div className="tparty-bond"><BondChip /></div>
      <div className="tpicker" role="list">
        {team.map((c) => {
          const f = fighter(c, 1, bond), at = party.findIndex((p) => p.sp.id === c.sp.id);
          const score = fit(f.style), next = nextUnlock(c.sp, f.c.level);
          return (
            <button key={c.sp.id} role="listitem" className={`tpick ${at >= 0 ? 'on' : ''}`} onClick={() => toggle(c)} aria-pressed={at >= 0}
              aria-label={`${c.sp.common}, level ${f.c.level}, ${f.max} energy. Signature skill: ${f.skill.name}, ${f.skill.tag}.`}>
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
        <button className="btn primary big block" disabled={!party.length || (!duel && !free && tickets < 1)} onClick={onGo}>
          {duel ? 'Start duel · free' : free ? 'Start duel · free' : <>Start duel · <TicketIcon /> 1</>}
        </button>
        {duel ? <p className="small muted tcta-note">Friend duels never use tickets. Your first win against each friend each day pays a prize and levels your birds.</p> : <div className="tcta-note"><TicketInfo tickets={tickets} free={free} /></div>}
      </div>
    </div>
  );
}

// ─── battle ───
type Anim = '' | 'enter' | 'lunge' | 'hit' | 'rest' | 'charge' | 'guard';
interface SideView { idx: number; hp: number; max: number; anim: Anim; hidden: boolean; atk?: number; def?: number }
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
/** Power and Defense gauges: 5 pips each, filled by potions. */
function Gauges({ atk, def }: { atk: number; def: number }) {
  const row = (k: 'atk' | 'def', n: number) => (
    <span className={`tg-gauge ${k}`} aria-label={`${k === 'atk' ? 'Power' : 'Defense'} gauge ${n} of ${GAUGE_MAX}${n ? `: ${k === 'atk' ? 'moves score' : 'rival moves score'} ${n * 10}% ${k === 'atk' ? 'more' : 'less'}` : ''}`}>
      <small aria-hidden>{k === 'atk' ? 'PWR' : 'DEF'}</small>{Array.from({ length: GAUGE_MAX }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
  );
  return <span className="thud-gauges">{row('atk', atk)}{row('def', def)}</span>;
}
function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const shown = useCount(hp);
  return (
    <span className="thp">
      <span className="thp-track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-label="Energy">
        <i className="trail" style={{ width: `${pct}%` }} />
        <i className={`fill ${pct > 50 ? 'hi' : pct > 20 ? 'mid' : 'lo'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="thp-num"><b>{shown}</b>/{max}<span className="thp-unit"> energy</span></span>
    </span>
  );
}

const TUT = (b: Battle) => {
  const me = active(b, 'you'), foe = active(b, 'foe');
  return [
    { id: 'hud', info: true, text: `Your first Field Trial! Tire out ${foe.c.sp.common}: when its energy hits 0, it flies off to rest.` },
    { id: 'quick', info: false, text: `Tap MOVES, then ${me.quick}. Quick moves never run out.` },
    { id: 'skill', info: false, text: `Now MOVES, then ${me.skill.name}. Stronger, but only ${me.ppMax} uses (the dots).` },
    { id: 'guard', info: false, text: `${foe.c.sp.common} is charging a big move! MOVES, then Guard.` },
    { id: 'snack', info: true, text: 'Blocked! BAG feeds a snack. BIRDS swaps in another bird.' },
    { id: 'super', info: false, text: `Super is full! Tap it for ${me.superName}.` },
    { id: 'done', info: true, text: 'Look for ▲ Strong moves. All rules are under How duels work. Go for the win!' },
  ];
};

/** Little status tags under a bird's HP bar. */
function statusOf(f: Battle['you'][number]): { t: string; good: boolean }[] {
  const out: { t: string; good: boolean }[] = [];
  if (f.fed > 0) out.push({ t: 'POWER▲', good: true });
  if (f.weak > 0) out.push({ t: 'POWER▼', good: false });
  if (f.focus) out.push({ t: 'FOCUS', good: true });
  if (f.shelter) out.push({ t: 'SHIELD', good: true });
  if (f.dazzle > 0) out.push({ t: 'DAZED', good: false });
  return out;
}

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
  const [intro, setIntro] = useState(true);
  const [charging, setCharging] = useState(false);
  const [fx, setFx] = useState<{ key: number; side: Side; sheet: Sheet; scale: number } | null>(null);
  const nextBoom = useRef<Sheet | null>(null), selfFx = useRef(false);
  const [proj, setProj] = useState<{ key: number; from: Side; sheet: Sheet; big: boolean } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [guide, setGuide] = useState(false);
  const [tut, setTut] = useState<number>(firstBattle ? 0 : -1);
  const tutRef = useRef(tut); tutRef.current = tut;
  const used = useRef(new Set<string>([party[0]?.sightingId ?? '']));
  // who is out and how many have rested, for the trainer's reactions
  const youIdx = useRef(0), foeIdx = useRef(0), youOut = useRef(0), foeOut = useRef(0), saidLow = useRef(false);
  const line = (opts: string[], bird: string) => (opts[Math.floor(Math.random() * opts.length)] ?? '').replace(/\{bird\}/g, bird);
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
  const show = (text: string) => { setMsgText(text); setSpeaker(false); };
  const narrate = async (text: string) => { show(text); await hold(reduced ? 450 : Math.min(1900, 650 + text.length * 24), false); };
  const speak = async (text: string) => { setMsgText(text); setSpeaker(true); await hold(0, true); };

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
          if (/ sends out /.test(e.text)) { const nm = e.text.split(' sends out ')[1]?.replace(/!$/, '') ?? ''; await speak(line(setup.persona.send.length ? setup.persona.send : ['Go, {bird}!'], nm)); }
          else await narrate(e.text);
          break;
        case 'move': {
          const def = CONTESTS[e.style];
          playClip(e.kind === 'super' || e.kind === 'big' ? 'tCritical' : def.clip, { vol: 0.8 });
          if (e.side === 'foe' && e.kind === 'big') setCharging(false);
          if (e.kind === 'super') { setFlash(true); setTimeout(() => setFlash(false), 260); }
          const tfx = e.tech ? TECH_FX[e.tech] : null; selfFx.current = false;
          if (tfx?.self) {   // power-ups and heals glow on the bird itself
            selfFx.current = true; burst(e.side, tfx.boom, 3); await anim(e.side, 'guard', 520); await sleep(reduced ? 0 : 260); break;
          }
          // wind-up, dash (the projectile leaves at the peak of the dash), then glide back
          const l = anim(e.side, 'lunge', 560);
          if (!reduced) { await sleep(200); setProj({ key: ++k.current, from: e.side, sheet: tfx?.proj ?? def.proj, big: e.kind === 'super' || e.kind === 'big' }); await sleep(340); setProj(null); }
          if (tfx && tfx.hits) nextBoom.current = tfx.boom;                     // lands with the damage
          else if (tfx) { burst(e.side === 'you' ? 'foe' : 'you', tfx.boom, 3); await sleep(reduced ? 0 : 300); }
          await l; break;
        }
        case 'recall': playClip('tPick', { vol: 0.5 }); await anim(e.side, 'rest', 420); setSide(e.side, (v) => ({ ...v, hidden: true })); break;
        case 'dmg': {
          burst(e.side, nextBoom.current ?? (e.crit || e.big ? critFx(e.style, e.big) : CONTESTS[e.style].boom), e.big ? 4 : 3); nextBoom.current = null;
          pop(e.side, e.blocked ? `-${e.amount} blocked` : `-${e.amount}`, e.crit || e.big ? 'crit' : 'dmg');
          if (e.eff) setTimeout(() => pop(e.side, e.eff > 0 ? 'Strong!' : 'Weak…', e.eff > 0 ? 'crit' : 'miss'), 180);
          playClip(e.blocked ? 'tTie' : 'tHit', { vol: 0.75 });
          if (e.crit || e.big) { haptic([20, 30, 20]); if (!reduced) { setShake(true); setTimeout(() => setShake(false), 340); } } else haptic(10);
          await anim(e.side, 'hit', 440); break;
        }
        case 'miss': pop(e.side, 'Miss', 'miss'); await sleep(260); break;
        case 'hp':
          setSide(e.side, (v) => ({ ...v, hp: e.value, max: e.max })); await sleep(reduced ? 80 : 300);
          if (e.side === 'foe' && !saidLow.current && e.value > 0 && e.value < e.max * 0.3 && foeOut.current === before.foe.length - 1) { saidLow.current = true; await speak(line([setup.persona.low], before.foe[foeIdx.current]?.c.sp.common ?? '')); }
          break;
        case 'heal': pop(e.side, `+${e.amount}`, 'heal'); if (!selfFx.current) burst(e.side, FX_RING, 2); selfFx.current = false; await sleep(340); break;
        // (a technique's own glow already played for this heal)
        case 'buff': pop(e.side, e.text, e.good ? 'info' : 'bad'); await sleep(320); break;
        case 'guard': playClip('tPick', { vol: 0.6 }); burst(e.side, FX_RING, 2); pop(e.side, 'Guard', 'info'); await anim(e.side, 'guard', 320); break;
        case 'charge': setCharging(true); playClip('tStart', { vol: 0.7 }); await anim('foe', 'charge', 520); await speak(line(setup.persona.charge, active(before, 'foe').c.sp.common)); break;
        case 'gauge': setGauge(e.value); break;
        case 'gauges': setSide(e.side, (v) => ({ ...v, atk: e.atk, def: e.def })); playClip('buy', { vol: 0.5 }); burst(e.side, FX_RING, 2); await sleep(reduced ? 60 : 380); break;
        case 'rest': {
          playClip('tTie', { vol: 0.7 }); if (e.side === 'foe') setCharging(false); await anim(e.side, 'rest', 760); setSide(e.side, (v) => ({ ...v, hidden: true }));
          // the trainer reacts, unless that was the last bird (their win/lose line comes next)
          const list = e.side === 'foe' ? before.foe : before.you, left = (e.side === 'foe' ? foeOut : youOut).current += 1;
          const nm = (e.side === 'foe' ? before.foe[foeIdx.current] : before.you[youIdx.current])?.c.sp.common ?? '';
          if (left < list.length) await speak(line(e.side === 'foe' ? setup.persona.faint : setup.persona.taunt, nm));
          break;
        }
        case 'send': {
          if (e.side === 'you') youIdx.current = e.index; else foeIdx.current = e.index;
          const f = e.side === 'you' ? before.you[e.index] : before.foe[e.index];
          if (e.side === 'you') used.current.add(party[e.index]?.sightingId ?? '');
          setSide(e.side, () => ({ idx: e.index, hp: f.hp, max: f.max, anim: 'enter', hidden: false, atk: f.atkG ?? 0, def: f.defG ?? 0 }));
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
      noteBattle(firstBattle);
      await speak(b.over === 'you' ? setup.win : setup.lose);
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
      show(`${setup.title === 'Wandering birder' ? 'Birder' : 'Rival'} ${setup.foeName} wants to duel!`);
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
    // tutorial: move on to the next lesson, and fill the meter for the Super lesson
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
  const potions = useGame((s) => s.potions ?? {});
  const myPotions = POTIONS.filter((p) => (potions[p.id] ?? 0) > 0);
  const snacks = (['seeds', 'berries', 'worms'] as Item[]).reduce((n, it) => n + (items[it] ?? 0), 0) + myPotions.reduce((n, p) => n + (potions[p.id] ?? 0), 0);
  const sReady = gauge >= 100;
  const bench = bat.you.map((f, i) => ({ f, i })).filter(({ f, i }) => !f.out && i !== bat.yi);
  const meFirst = cur.spd >= them.spd;
  const myEdge = matchup(cur.style, them.style);
  const betterBench = bench.map(({ f }) => f).find((f) => matchup(f.style, them.style) > 0) ?? null;

  // plain render helper (not a component), so buttons are never rebuilt mid-tap
  const move = (o: { id: string; cls: string; icon: ReactNode; name: string; sub: string; uses?: [number, number]; onClick: () => void; disabled?: boolean; edge?: Contest }) => (
    <button key={o.id} className={`tact ${o.cls} ${tutId === o.id && !step?.info ? 'tut-focus' : ''}`} onClick={o.onClick} disabled={o.disabled || lock(o.id)}
      aria-label={`${o.name}: ${o.sub}, ${o.uses ? `${o.uses[0]} of ${o.uses[1]} uses left this duel` : 'always available'}${o.edge && matchup(o.edge, them.style) ? (matchup(o.edge, them.style) > 0 ? ', strong matchup' : ', weak matchup') : ''}`}>
      <span className="tact-ic" aria-hidden>{o.icon}</span>
      <span className="tact-txt"><span className="tact-top"><b>{o.name}</b>{o.uses ? <Uses left={o.uses[0]} max={o.uses[1]} /> : <Uses />}</span><small>{o.sub}</small></span>
      {o.edge && !foe.hidden && <Edge move={o.edge} vs={them.style} />}
    </button>
  );
  const pick = (a: Action) => { sfx.select(); act(a); };
  // turn timer: after 8 s of thinking a 5 s countdown appears; at 0 your bird uses its quick move
  const pickRef = useRef(pick); pickRef.current = pick;
  const [left, setLeft] = useState<number | null>(null);
  const timed = live && !step;
  useEffect(() => {
    if (!timed) { setLeft(null); return; }
    const t0 = Date.now();
    const id = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      if (el < TURN_WAIT) return;
      const r = Math.ceil(TURN_WAIT + TURN_COUNT - el);
      if (r <= 0) { clearInterval(id); setLeft(null); pickRef.current({ kind: 'wait', timeout: true }); return; }   // time's up: the rival takes your turn
      setLeft((v) => { if (v !== r) sfx.move(); return r; });
    }, 200);
    return () => clearInterval(id);
  }, [timed]);
  const card = (side: Side, f: Battle['you'][number], v: SideView, list: Battle['you'], at: number) => (
    <div className={`thud-card ${side} ${v.hidden ? 'dim' : ''}`}>
      <div className="thud-top"><b className="thud-name">{f.c.sp.common}</b><span className="thud-lv">Lv{f.c.level}</span></div>
      <HpBar hp={v.hp} max={v.max} />
      <span className="thud-row">
        <span className="thud-pips">{list.map((x, i) => <i key={i} className={x.out ? 'out' : i === at ? 'on' : ''} />)}</span>
        <span className="thud-status">{!v.hidden && statusOf(f).map((x) => <i key={x.t} className={x.good ? 'good' : 'bad'}>{x.t}</i>)}</span>
      </span>
      <Gauges atk={v.atk ?? 0} def={v.def ?? 0} />
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
            <span className="tbody"><Sprite species={them.c.sp} scale={3} mode="fly" flapMs={foe.anim === 'lunge' ? 38 : 92} flip /></span>
            {fx?.side === 'foe' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={Math.max(480, fx.sheet.frames * 60)} className="tboom" />}
            {pops.filter((p) => p.side === 'foe').map((p) => <span key={p.id} className={`tpop ${p.kind}`}>{p.text}</span>)}
          </div>
        </div>
        <div className={`tspot you ${you.hidden ? 'gone' : ''}`}>
          <span className="tplat" aria-hidden />
          <div className={`tbird ${you.anim}`}>
            <span className="tbody"><Sprite species={me.c.sp} parts={me.c.parts} scale={5} mode="fly" flapMs={you.anim === 'lunge' ? 38 : 92} /></span>
            {fx?.side === 'you' && <Fx key={fx.key} sheet={fx.sheet} scale={fx.scale} ms={Math.max(480, fx.sheet.frames * 60)} className="tboom" />}
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
        </div>

        {intro && (
          <div className="tintro" aria-hidden>
            <span className="tintro-k">{setup.title === 'Wandering birder' ? 'Challenge' : 'Rival duel'}</span>
            <Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={104} tall className="tintro-face" />
            <b className="tintro-t">{setup.foeName}</b>
            <span className="tintro-s">{setup.title}</span>
          </div>
        )}
      </div>

      {guide && (
        <div className="tguide-sheet" role="dialog" aria-label="How duels work">
          <div className="tguide-head"><b>How duels work</b><button className="btn small" onClick={() => { sfx.back(); setGuide(false); }}>Close</button></div>
          <div className="tguide-scroll"><BattleGuide /></div>
        </div>
      )}
      <div className={`ttray ${live ? '' : 'busy'}`} onClick={live ? undefined : advance}>
        {step && (
          <div className="ttut dialog" role="dialog" aria-label="Duel tutorial">
            <span className="dialog-name">Professor Woods · {tut + 1}/{steps.length}</span>
            <div className="ttut-merlin woods-frame"><Professor height={64} /></div>
            <div className="ttut-body">
              <p className="dialog-text">{step.text}</p>
              {step.info && <button className="btn primary small" onClick={() => {
                sfx.select(); const n = tut + 1 >= steps.length ? -1 : tut + 1; setTut(n); tutRef.current = n;
                if (steps[n]?.id === 'super') { const nb = { ...batRef.current, gauge: 100 }; setBat(nb); batRef.current = nb; setGauge(100); }
              }}>{tut + 1 >= steps.length ? 'Let’s go!' : 'Next'}</button>}
            </div>
          </div>
        )}
        {left != null && (
          <div className="tturn-timer" role="timer" aria-live="polite">
            <span>Pick a move!</span><b>{left}</b>
            <i style={{ width: `${(left / TURN_COUNT) * 100}%` }} aria-hidden />
          </div>
        )}
        <button className={`tsuper ${sReady ? 'ready' : ''} ${tutId === 'super' ? 'tut-focus' : ''}`} disabled={!sReady || lock('super')} onClick={() => pick({ kind: 'super' })}
          aria-label={sReady ? `Super ${cur.superName}: ready, tap to use` : `Super meter ${gauge}%: fills as you compete`}>
          <i style={{ width: `${gauge}%` }} aria-hidden />
          <span className="tsuper-l"><Icon name="star" size={16} /> <span>{sReady ? cur.superName : 'Super meter'}</span></span>
          <span className="tsuper-r">{sReady ? 'Ready!' : `${gauge}%`}</span>
        </button>

        {(panel === 'menu' || panel === 'busy') && (
          <div className="tcmd">
            <button className={`tcmd-b fight ${fightLesson && !step?.info ? 'tut-focus' : ''}`} disabled={lock('fight')} onClick={() => { sfx.select(); setPanel('fight'); }} aria-label="Moves: choose a move"><PixelEmoji name="fight" /><span className="tcmd-l">Moves</span></button>
            <button className="tcmd-b" disabled={lock('bag') || !snacks} onClick={() => { sfx.select(); setPanel('snack'); }} aria-label={`Bag: ${snacks} snacks and potions`}><PixelEmoji name="bag" /><span className="tcmd-l">Bag</span><small>×{snacks}</small></button>
            <button className="tcmd-b" disabled={lock('birds') || !bench.length} onClick={() => { sfx.select(); setPanel('swap'); }} aria-label={`Birds: ${bench.length} to swap in`}><PixelEmoji name="birds" /><span className="tcmd-l">Birds</span><small>×{bench.length}</small></button>
            <button className="tcmd-b run" disabled={!live || !!step} onClick={() => { sfx.back(); act({ kind: 'run' }); }} aria-label="Leave: end the duel"><PixelEmoji name="run" /><span className="tcmd-l">Leave</span></button>
            <button className="thelp" onClick={() => { sfx.select(); setGuide(true); }}><span className="thelp-q" aria-hidden>?</span><span className="thelp-l">How duels work</span></button>
          </div>
        )}
        {panel === 'fight' && (
          <>
            <div className="tfight-top">
              <span>{meFirst ? '⚡ You go first' : `⚡ ${them.c.sp.common} goes first`}</span>
              <span className={`tmatch ${myEdge > 0 ? 'up' : myEdge < 0 ? 'down' : ''}`}>{myEdge > 0 ? `▲ Your ${CONTESTS[cur.style].name} beats ${CONTESTS[them.style].name}` : myEdge < 0 ? `▼ ${CONTESTS[them.style].name} beats your ${CONTESTS[cur.style].name}` : `${CONTESTS[cur.style].name} vs ${CONTESTS[them.style].name}: even`}</span>
            </div>
            {charging ? <p className="tfight-hint warn">The rival is powering up a Big Move. <b>Guard</b> blocks most of it.</p>
              : myEdge < 0 && betterBench ? <p className="tfight-hint">Tip: go Back and tap <b>Birds</b> to swap in {betterBench.c.sp.common}, who has the edge.</p> : null}
            <div className="tgrid">
              {move({ id: 'quick', cls: 'quick', icon: <Fx sheet={CONTESTS[cur.style].proj} scale={1} frame={1} />, name: cur.quick, sub: cur.quickPow > 1 ? 'Upgraded quick move' : 'Quick move · steady points', edge: cur.style, onClick: () => pick({ kind: 'quick' }) })}
              {move({ id: 'skill', cls: 'skill', icon: <Fx sheet={CONTESTS[cur.skill.style].boom} scale={1} frame={2} />, name: cur.skill.name, sub: cur.skill.tag, uses: [cur.pp, cur.ppMax], disabled: cur.pp < 1, edge: cur.skill.power ? cur.skill.style : undefined, onClick: () => pick({ kind: 'skill' }) })}
              {cur.tech
                ? move({ id: 'tech', cls: 'tech', icon: (() => { const t = TECH_FX[cur.tech.kind as keyof typeof TECH_FX]; return t?.proj ? <Fx sheet={t.proj} scale={1} frame={2} /> : t ? <Fx sheet={t.boom} scale={0.6} frame={3} /> : <Fx sheet={CONTESTS[cur.tech.style].proj} scale={1} frame={3} />; })(), name: cur.tech.name, sub: cur.tech.tag, uses: [cur.pp2, cur.pp2Max], disabled: cur.pp2 < 1, edge: cur.tech.power ? cur.tech.style : undefined, onClick: () => pick({ kind: 'tech' }) })
                : (
                  <div className="tact locked" aria-label={`${TECHNIQUES[cur.style].name}: learned at level ${GROW.tech}`}>
                    <span className="tact-ic" aria-hidden>🔒</span>
                    <span className="tact-txt"><b>{TECHNIQUES[cur.style].name}</b><small>Learns at Lv{GROW.tech}</small></span>
                  </div>
                )}
              {move({ id: 'guard', cls: 'guard', icon: <Fx sheet={FX_RING} scale={1} frame={3} />, name: 'Guard', sub: 'Goes first · blocks 60%', onClick: () => pick({ kind: 'guard' }) })}
            </div>
            <button className="btn ghost small trun" disabled={!!step && !step.info && fightLesson} onClick={() => { sfx.back(); setPanel('menu'); }}>Back</button>
          </>
        )}
        {panel === 'swap' && (
          <div className="tsnacks">
            {bench.map(({ f, i }) => (
              <button key={i} className="tact snackrow" onClick={() => pick({ kind: 'swap', to: i })}
                aria-label={`Swap in ${f.c.sp.common}, level ${f.c.level}, ${f.hp} of ${f.max} energy`}>
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
            {myPotions.length > 0 && <p className="tbag-h">Potions <small>fill your bird’s gauges</small></p>}
            {myPotions.map((p) => (
              <button key={p.id} className="tact snackrow" disabled={(p.kind === 'atk' && (you.atk ?? 0) >= GAUGE_MAX) || (p.kind === 'def' && (you.def ?? 0) >= GAUGE_MAX) || (p.kind === 'both' && (you.atk ?? 0) >= GAUGE_MAX && (you.def ?? 0) >= GAUGE_MAX)} onClick={() => { if (spendPotion(p.id)) pick({ kind: 'potion', id: p.id }); }}>
                <span className="tact-ic" aria-hidden><img src={p.img} width={28} height={28} className="pix potion-art" alt="" /></span>
                <span className="tact-txt"><b>{p.name}</b><small style={{ color: KIND_META[p.kind].color }}>{potionTag(p)}</small></span>
                <span className="tsnack-n">×{potions[p.id]}</span>
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
function Result({ setup, won, prize, party, wild, onRematch, onLadder, onNext, onSendBack }: {
  setup: Setup; won: boolean; prize: Prize; party: Contender[]; wild: boolean; onRematch?: () => void; onLadder: () => void; onNext?: () => void; onSendBack?: () => void;
}) {
  const idx = RIVALS.findIndex((x) => x.name === setup.foeName);
  return (
    <div className="trials-body tresult">
      <div className={`tresult-hero ${won ? 'won' : 'lost'}`}>
        {won && <Fx sheet={FX_RING} scale={4} ms={900} loop className="tresult-ring" />}
        <span className="thero-kicker">{wild ? 'Challenge' : 'Field Trial'}</span>
        <h1>{won ? 'Victory!' : 'So close!'}</h1>
        <div className="tresult-quote"><Face face={setup.face} merlin={setup.merlin} name={setup.foeName} size={48} /><p className="small"><b>{setup.foeName}:</b> “{won ? setup.win : setup.lose}”</p></div>
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
        {onSendBack && <button className="btn block" onClick={onSendBack}>✦ Send them your team</button>}
        <button className="btn ghost block" onClick={onLadder}>{wild ? 'Done' : 'Back to rivals'}</button>
      </div>
    </div>
  );
}
