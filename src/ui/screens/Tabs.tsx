import { FoodIcon } from '../FoodIcon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useGame, getState, counts, speciesOf, speciesCount, setBiome, setHome, ownsHome, buyHome, toggleHabitatBird, setState, claimChallenge, refreshChallenges, buyFood, buyLens, equipLens, collectAviary, petBird, partnerPet, birdName, nameBird, fillFeeder, tickFeeder } from '../../app/store';
import { FOODS, Food, hpNow, mood, MOOD_LINE, FEEDER_CAP, AVIARY_MAX, Meal } from '../../core/pets';
import { getRegion, regionLabel } from '../../data/geo';
import { allKnownSpecies } from '../../data/provider';
import { gameMusic } from '../../app/audio';
import { Types, BirdThumb, dexNo, BadgeIcon, HpBar, Capsule } from '../game';
import { LENSES, LENS_ORDER, lensOf } from '../../core/lenses';
import { LensList } from '../LensList';
import { factsFor } from '../../data/facts';
import { PageHeader, Segmented, Alert, FeatherChip } from '../kit';
import { MerlinSays } from '../MerlinSays';
import { Diorama, SCENES, paintHomeThumb, homePrice } from '../../render/diorama';
import { FeatherIcon } from '../FeatherIcon';
import { FEEDERS, PERCHES, feederOf, perchOf, type DecorDef } from '../../core/decor';
import { paintDecorThumb } from '../../render/decor';
import { sunTimes, dayPhase } from '../../core/sun';
import { rankFor, RANKS, liveStreak, dayKey, trainerLevel } from '../../core/xp';
import { BADGES, TIER_FEATHERS } from '../../core/badges';
import { challengeProgress } from '../../core/challenges';
import type { Habitat } from '../../data/types';
import { Sprite, Meter, Icon, useReducedMotion, Sheet, RarityTag } from '../components';
import { sfx, haptic, playClip } from '../../app/audio';

// ─── AVIARY: your birds living in a scene, kept fed from the feeder ───

export function HabitatTab() {
  useEffect(() => { gameMusic('aviary'); }, []);
  const nav = useNav();
  const st = useGame((s) => s);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dio = useRef<Diorama | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [sheet, setSheet] = useState<'box' | 'fill' | 'shop' | null>(null);
  const [section, setSection] = useState<'birds' | 'feeder'>('birds');
  const [sceneLabel, setSceneLabel] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [gift, setGift] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  // keep the chosen home in view inside the strip (sideways only, never moves the page)
  useEffect(() => {
    const strip = stripRef.current; const on = strip?.querySelector<HTMLElement>('.home-card.on');
    if (strip && on) strip.scrollLeft = Math.max(0, on.offsetLeft - strip.offsetLeft - (strip.clientWidth - on.offsetWidth) / 2);
  }, [st.diorama.home, section]);
  const [hello, setHello] = useState<{ key: string; text: string; gift: number; at: number } | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  useEffect(() => { if (naming) setNameDraft(birdName(naming) === (naming === 'partner' ? allKnownSpecies().find((x) => x.id === st.partner?.speciesId)?.common : speciesOf(st.sightings.find((x) => x.id === naming)!).common) ? '' : birdName(naming)); }, [naming]);
  const [fact, setFact] = useState<{ name: string; species: string; text: string } | null>(null);
  const factIdx = useRef<Record<string, number>>({});
  useEffect(() => { if (!hello) return; const t = setTimeout(() => setHello(null), 2700); return () => clearTimeout(t); }, [hello]);
  const [, tick] = useState(0);
  const species = speciesCount(st);
  const lv = trainerLevel(st.xp).level;
  const region = getRegion(st.region);
  const now = new Date();
  const phase = dayPhase(now, sunTimes(now, region.lat, region.lng));
  const aviary = st.diorama.birds.map((id) => st.sightings.find((s) => s.id === id)).filter(Boolean) as typeof st.sightings;
  const box = st.sightings.filter((s) => !st.diorama.birds.includes(s.id));
  const fill = st.feeder.level / FEEDER_CAP;

  // birds visit the feeder: on open, every 20s, and right after you fill it
  const runFeeder = () => {
    const pp0 = partnerPet(getState());
    const before = new Map([...getState().sightings.map((x) => [x.id, hpNow(x)] as const), ...(pp0 ? [['partner', hpNow(pp0)] as const] : [])]);
    const m = tickFeeder();
    if (!m.length) return;
    setMeals(m);
    // up to three hungry birds eat side by side; the rest queue for the next free spot
    m.forEach((meal, i) => setTimeout(() => {
      const from = Math.round(before.get(meal.id) ?? 50), to = Math.min(100, from + meal.ate);
      const go = (tries: number) => { if (!dio.current) return; if (!dio.current.visit(meal.id, { ms: 3200, hp: [from, to] })) { if (tries > 0) setTimeout(() => go(tries - 1), 1500); else dio.current.setHp(meal.id, to); } };
      go(6);
    }, Math.floor(i / 3) * 4200 + (i % 3) * 300));
    sfx.sparkle();
  };
  useEffect(() => {
    setGift(collectAviary());
    const first = setTimeout(runFeeder, 1200);
    const t = setInterval(() => { runFeeder(); tick((x) => x + 1); }, 20000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  useEffect(() => { const w = boxRef.current?.clientWidth ?? 358; setDims({ w: Math.floor(w / 2), h: Math.floor(Math.min(window.innerHeight * 0.46, 480) / 2) }); }, []);
  useEffect(() => {
    if (!dims) return;
    const d = new Diorama(ref.current!, st.diorama.biome, phase, { sceneId: st.diorama.home && (SCENES[st.diorama.home]?.level ?? 99) <= lv && ownsHome(st, st.diorama.home) ? st.diorama.home : undefined, hpBars: true, wander: true, reduced, viewW: dims.w, viewH: dims.h, feeder: fill, feederStyle: st.diorama.feeder, perch: st.diorama.perch });
    dio.current = d;
    setSceneLabel(d.scene.label);
    const partner = st.partner ? allKnownSpecies().find((x) => x.id === st.partner!.speciesId) : null;
    if (partner && st.partner) d.add('partner', partner, st.partner.parts, { arrive: false, seed: 1, hp: hpNow(partnerPet(st)!) });
    aviary.forEach((s, i) => d.add(s.id, speciesOf(s), s.sprite.parts, { arrive: false, seed: i * 7 + 3, hp: hpNow(s) }));
    d.start();
    return () => { d.dispose(); dio.current = null; };
  }, [st.diorama.biome, st.diorama.home, st.diorama.feeder, st.diorama.perch, aviary.map((p) => p.id).join(), reduced, dims]);
  useEffect(() => { dio.current?.setFeeder(fill); }, [fill]);

  const hungry = aviary.filter((x) => hpNow(x) < 30).length;
  const bags = (Object.keys(FOODS) as Food[]).reduce((n, f) => n + st.items[f], 0);
  const fillOrShop = () => setSheet(bags > 0 ? 'fill' : 'shop');
  return (
    <div className="screen with-tabs">
      <PageHeader title="Aviary" sub={`${aviary.length}/${AVIARY_MAX} birds · feeder ${Math.round(fill * 100)}% full`}
        right={<><FeatherChip label={false} /><button className="btn primary small shop-btn" onClick={() => { sfx.select(); nav.open({ name: 'shop' }); }} aria-label="Open Merlin's Shop"><Icon name="bag" size={14} /> Shop</button></>} />
      {hungry > 0 && st.feeder.level < 20 && (
        <Alert action={<button className="btn small primary" onClick={fillOrShop}>{bags > 0 ? 'Fill' : 'Buy food'}</button>}>
          <b>{hungry} bird{hungry > 1 ? 's are' : ' is'} hungry.</b><br />The feeder is {st.feeder.level ? 'almost' : ''} empty.
        </Alert>
      )}
      {gift > 0 && <Alert tone="good">Your healthy birds brought you <b>{gift}</b> Feather Coins today.</Alert>}
      <div ref={boxRef} data-tour="aviary" style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <canvas ref={ref} className="pix" style={{ width: (dims?.w ?? 0) * 2, maxWidth: '100%', border: '2px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }} role="img"
          aria-label={`Aviary with ${aviary.length} birds and a feeder ${Math.round(fill * 100)}% full. Tap a bird to say hello.`}
          onClick={(e) => {
            const c = ref.current!, d = dio.current; if (!d) return;
            const r = c.getBoundingClientRect(), k = c.width / r.width;
            const b = d.hit((e.clientX - r.left) * k, (e.clientY - r.top) * k); if (!b) return;
            d.poke(b.key); sfx.chirp(); haptic(10);
            const sg = b.key === 'partner' ? partnerPet(st) : st.sightings.find((x) => x.id === b.key);
            const gift = sg && b.key !== 'partner' ? petBird(sg.id) : 0;
            const hp = sg ? hpNow(sg) : null;
            setHello({ key: b.key, text: `${birdName(b.key, st)}${hp !== null ? ` · ${hp} HP · ${MOOD_LINE[mood(hp)]}` : ''}`, gift, at: Date.now() });
            // a true fun fact, a different one on each tap
            factsFor(b.sp).then((fs) => {
              if (!fs.length) { setFact({ name: birdName(b.key, st), species: b.sp.common, text: '' }); return; }
              const k = b.sp.id; const n = factIdx.current[k] ?? 0; factIdx.current[k] = n + 1;
              setFact({ name: birdName(b.key, st), species: b.sp.common, text: fs[n % fs.length] });
            });
            if (gift) { playClip('buy'); }
          }} />
        {hello && Date.now() - hello.at < 2600 && dio.current?.where(hello.key) && ref.current && (() => {
          const c = ref.current!, p = dio.current!.where(hello.key)!, s = c.getBoundingClientRect().width / c.width;
          return (
            <div className="bird-hello" style={{ left: Math.min(c.offsetLeft + c.clientWidth - 112, Math.max(c.offsetLeft + 112, c.offsetLeft + p.x * s)), top: Math.max(c.offsetTop + 46, c.offsetTop + (p.y - 40) * s) }} role="status">
              {hello.text}{hello.gift ? <b> · brought you {hello.gift} Feather Coins!</b> : null}
            </div>
          );
        })()}
      </div>
      {fact && fact.text && (
        <div className="fact-card" role="status" aria-live="polite">
          <div className="fact-head"><span className="mission-tag">Fun fact</span> <b>{fact.name}</b>{fact.name !== fact.species ? <span className="small muted"> · {fact.species}</span> : null}<button className="icon-btn fact-x" aria-label="Close fact" onClick={() => setFact(null)}>✕</button></div>
          <p className="small" style={{ margin: '4px 0 0' }}>{fact.text}</p>
          <p className="small muted" style={{ margin: '4px 0 0', fontSize: 11 }}>Tap the bird again for another. Sources: BirdlyQuest field notes and Wikipedia (via iNaturalist).</p>
        </div>
      )}
      {!fact && aviary.length + (st.partner ? 1 : 0) > 0 && <p className="small muted mt8" style={{ textAlign: 'center' }}>Tap a bird for a fun fact.</p>}
      {meals.length > 0 && <div className="small mt8" role="status" style={{ color: 'var(--lichen)' }}>{meals.map((m) => `${birdName(m.id, st)} ate (+${m.ate} HP)`).join(' · ')}</div>}

      <button className="trials-entry" onClick={() => { sfx.select(); nav.open({ name: 'trials' }); }} aria-label={`Field Trials: friendly bird contests. ${st.trials?.cleared ?? 0} of 6 rivals beaten`}>
        <span className="trials-entry-icon" aria-hidden><span className="tfx" style={{ width: 52, height: 48, backgroundImage: 'url(fx/trials/sa_nova.png)', backgroundSize: '312px 48px', ['--sheet-w' as string]: '-312px', animation: 'tfx 900ms steps(6) infinite' }} /></span>
        <span className="grow" style={{ textAlign: 'left' }}>
          <b className="trials-entry-title">Field Trials</b>
          <span className="small">Song-offs, displays, sky races and foraging. Pit your birds against rival birders.</span>
        </span>
        <span className="px small trials-entry-go">{st.trials?.cleared ?? 0}/6 ▶</span>
      </button>
      <Segmented label="Aviary sections" value={section} onChange={setSection} options={[
        { id: 'birds', label: 'Birds', badge: hungry || undefined },
        { id: 'feeder', label: 'Feeder & Shop', badge: st.feeder.level < 20 },
      ]} />

      {section === 'birds' && (
        <section aria-label="Birds in your aviary">
          {aviary.length === 0 && <p className="small muted">Photograph a real bird to bring your first pet home. Your partner is waiting here.</p>}
          {(() => {
            const pp = partnerPet(st); const psp = st.partner ? allKnownSpecies().find((x) => x.id === st.partner!.speciesId) : null;
            const rows = [
              ...(pp && psp && st.partner ? [{ id: 'partner', sp: psp, parts: st.partner.parts, hp: hpNow(pp), level: undefined as number | undefined, open: () => nav.open({ name: 'species', id: psp.id }), tag: 'Partner' }] : []),
              ...aviary.map((x) => ({ id: x.id, sp: speciesOf(x), parts: x.sprite.parts, hp: hpNow(x), level: x.level ?? 5, open: () => nav.open({ name: 'species', id: x.speciesId ?? '_unknown', sightingId: x.id }), tag: '' })),
            ].sort((a, b) => a.hp - b.hp);
            return rows.map((r) => (
              <div key={r.id} className="panel pet-row" style={{ borderColor: r.hp < 30 ? 'var(--brick)' : undefined }}>
                <button className="pet-main" onClick={r.open} aria-label={`${birdName(r.id, st)}, ${r.sp.common}, ${r.hp} HP. Open details`}>
                  <span style={{ background: 'var(--slate)', border: '2px solid #000' }}><Sprite species={r.sp} parts={r.parts} scale={2} mode={r.hp < 30 ? 'static' : 'idle'} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row between"><span className="name small">{birdName(r.id, st)}</span><span className="px" style={{ fontSize: 10 }}>{r.tag || `Lv${r.level}`}</span></span>
                    {birdName(r.id, st) !== r.sp.common && <span className="small muted">{r.sp.common}</span>}
                    <HpBar hp={r.hp} />
                    <span className="small" style={{ color: r.hp < 30 ? 'var(--oriole)' : 'var(--stone)' }}>{MOOD_LINE[mood(r.hp)]}</span>
                  </span>
                </button>
                <button className="btn small ghost pet-name-btn" onClick={() => { sfx.select(); setNaming(r.id); }} aria-label={`Name ${birdName(r.id, st)}`}>✎ Name</button>
              </div>
            ));
          })()}
          <button className="btn block" onClick={() => setSheet('box')}>Bird Box · {box.length} resting</button>
          <p className="small muted">Aviary birds eat from the feeder and earn you Feather Coins. Birds in the Bird Box rest and don't get hungry.</p>
          <div className="section-title"><span>Bird Homes</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>{Object.keys(SCENES).filter((id) => ownsHome(st, id)).length}/{Object.keys(SCENES).length} owned</span></div>
          <div className="home-strip" role="radiogroup" aria-label="Bird Homes" ref={stripRef}>
            <button role="radio" className={`home-card auto ${!st.diorama.home ? 'on' : ''}`} aria-checked={!st.diorama.home} onClick={() => { sfx.select(); haptic(8); setHome(undefined); }}>
              <span className="home-auto" aria-hidden><HomeThumb id="skyday" /><HomeThumb id="dusk" /></span>
              <span className="small">Day &amp; night (default)</span>
            </button>
            {Object.values(SCENES).slice().sort((a, b) => a.level - b.level).map((sc) => {
              const locked = sc.level > lv, owned = ownsHome(st, sc.id), on = st.diorama.home === sc.id, price = homePrice(sc.id);
              return (
                <button key={sc.id} role="radio" className={`home-card ${on ? 'on' : ''} ${locked ? 'locked' : ''} ${!owned && !locked ? 'forsale' : ''}`} aria-checked={on} disabled={locked}
                  aria-label={locked ? `${sc.label}, unlocks at level ${sc.level}` : owned ? sc.label : `${sc.label}, buy for ${price} Feather Coins`}
                  onClick={() => { sfx.select(); haptic(8); if (owned) setHome(sc.id); else setBuying(sc.id); }}>
                  <HomeThumb id={sc.id} />
                  <span className="small">{locked ? `🔒 Lv ${sc.level}` : sc.label}</span>
                  {!owned && !locked && <span className="home-price"><FeatherIcon size={11} /> {price}</span>}
                </button>
              );
            })}
          </div>
          {buying && SCENES[buying] && (
            <div className="panel home-buy" role="dialog" aria-label={`Buy ${SCENES[buying].label}`}>
              <HomeThumb id={buying} />
              <div className="grow">
                <b>{SCENES[buying].label}</b>
                <p className="small" style={{ margin: '2px 0 6px' }}>Move your birds here for <FeatherIcon size={12} /> <b>{homePrice(buying)}</b> Feather Coins. You have {st.feathers}.</p>
                <div className="btn-pair">
                  <button className="btn ghost small" onClick={() => { sfx.back(); setBuying(null); }}>Not now</button>
                  <button className="btn primary small" disabled={st.feathers < homePrice(buying)} onClick={() => { if (buyHome(buying)) { playClip('buy'); nav.toast(`Moved to ${SCENES[buying].label}!`); setBuying(null); } else sfx.error(); }}>
                    {st.feathers < homePrice(buying) ? `Need ${homePrice(buying) - st.feathers} more` : 'Buy & move in'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {section === 'feeder' && (
        <section aria-label="Feeder and shop">
          {/* 1. the feeder: what's up, how full, one big action */}
          <div className={`panel feeder-card ${fill <= 0.25 ? 'low' : ''}`}>
            <DecorThumb def={feederOf(st.diorama.feeder)} size={96} />
            <div className="grow">
              <div className="row between"><b className="feeder-name">{feederOf(st.diorama.feeder).name}</b><span className="num small">{st.feeder.level}/{FEEDER_CAP}</span></div>
              <div className="feeder-meter" role="meter" aria-label="Feeder level" aria-valuemin={0} aria-valuemax={FEEDER_CAP} aria-valuenow={st.feeder.level}>
                <i style={{ width: `${fill * 100}%`, background: fill > 0.25 ? 'var(--warbler)' : 'var(--oriole)' }} />
              </div>
              <p className="small feeder-status">
                {st.feeder.level === 0 ? 'Empty! Your birds go hungry until you fill it.'
                  : `About ${Math.max(1, Math.round(st.feeder.level / Math.max(1, aviary.length * 17)))} day(s) of food for ${aviary.length || 1} bird${aviary.length === 1 ? '' : 's'}.`}
              </p>
              {bags > 0
                ? <button className="btn primary small block" onClick={() => setSheet('fill')} disabled={st.feeder.level >= FEEDER_CAP}>{st.feeder.level >= FEEDER_CAP ? 'Feeder is full' : 'Fill feeder'}</button>
                : <button className="btn primary small block" onClick={() => nav.open({ name: 'shop', tab: 'food' })}>Buy food</button>}
            </div>
          </div>

          {/* 2. pantry: tap a bag to pour it straight in */}
          <div className="section-title"><span>Pantry</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>Tap a bag to pour it in</span></div>
          <div className="pantry">
            {(Object.keys(FOODS) as Food[]).map((f) => {
              const have = st.items[f] ?? 0;
              return (
                <button key={f} className={`pantry-tile ${have ? '' : 'empty'}`} aria-label={have ? `Pour ${FOODS[f].name} into the feeder, ${have} left` : `${FOODS[f].name}: none left, buy more`}
                  disabled={have > 0 && st.feeder.level >= FEEDER_CAP}
                  onClick={() => {
                    if (!have) { sfx.select(); nav.open({ name: 'shop', tab: 'food' }); return; }
                    const n = fillFeeder(f); if (n) { sfx.page(); haptic(12); nav.toast(`Poured ${FOODS[f].name} into the feeder (+${n})`); setTimeout(runFeeder, 600); }
                  }}>
                  <FoodIcon food={f} size={40} />
                  <div className="small pantry-name">{FOODS[f].name}</div>
                  <div className="num pantry-n">{have ? `×${have}` : 'Buy'}</div>
                </button>
              );
            })}
          </div>

          {/* 3. Merlin's Shop: one tap to every department */}
          <div className="shop-hub">
            <div className="shop-hub-head">
              <span className="shop-hub-title">Merlin's Shop</span>
              <span className="wallet-chip"><FeatherIcon size={16} /> <b className="num">{st.feathers}</b></span>
            </div>
            <div className="shop-hub-grid">
              {([
                { tab: 'food', label: 'Food', sub: `${bags} bag${bags === 1 ? '' : 's'}`, art: <FoodIcon food="berries" size={44} /> },
                { tab: 'feeders', label: 'Feeders', sub: `${FEEDERS.filter((d) => st.ownedDecor.includes(d.id)).length + 1}/50`, art: <DecorThumb def={FEEDERS[8]} size={56} /> },
                { tab: 'perches', label: 'Perches', sub: `${PERCHES.filter((d) => st.ownedDecor.includes(d.id)).length}/50`, art: <DecorThumb def={PERCHES[15]} size={56} /> },
                { tab: 'homes', label: 'Homes', sub: `${Object.keys(SCENES).filter((id) => ownsHome(st, id)).length}/${Object.keys(SCENES).length}`, art: <HomeThumb id={st.diorama.home ?? 'valley'} /> },
                { tab: 'lenses', label: 'Lenses', sub: `${st.lenses.length}/${LENS_ORDER.length}`, art: <Capsule size={44} lens={st.lens} /> },
              ] as const).map((t) => (
                <button key={t.tab} className={`shop-hub-tile t-${t.tab}`} onClick={() => { sfx.select(); nav.open({ name: 'shop', tab: t.tab }); }} aria-label={`Open Merlin's Shop: ${t.label}, ${t.sub} owned`}>
                  <span className="shop-hub-art" aria-hidden>{t.art}</span>
                  <b>{t.label}</b><span className="small muted">{t.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. what's set up in the Aviary right now */}
          <div className="section-title"><span>In your Aviary</span></div>
          {([
            { k: 'Feeder', v: feederOf(st.diorama.feeder).name, tab: 'feeders' },
            { k: 'Perch', v: perchOf(st.diorama.perch)?.name ?? 'None yet', tab: 'perches' },
            { k: 'Home', v: st.diorama.home && SCENES[st.diorama.home] ? SCENES[st.diorama.home].label : 'Day & night', tab: 'homes' },
          ] as const).map((r) => (
            <div key={r.k} className="setup-row">
              <span className="label">{r.k}</span><span className="grow">{r.v}</span>
              <button className="btn ghost small" onClick={() => nav.open({ name: 'shop', tab: r.tab })}>{r.k === 'Perch' && !st.diorama.perch ? 'Add one' : 'Change'}</button>
            </div>
          ))}
          <p className="small muted mt8">Earn Feather Coins by photographing real birds: +20 for a new species, +12 for a repeat, more for rare birds.</p>
        </section>
      )}


      {sheet === 'fill' && (
        <Sheet onClose={() => setSheet(null)} label="Fill the feeder">
          <div className="row between mb8"><h3>Fill the feeder</h3><span className="num small">{st.feeder.level}/{FEEDER_CAP}</span></div>
          {(Object.keys(FOODS) as Food[]).map((f) => (
            <button key={f} className="srow" disabled={st.items[f] <= 0 || st.feeder.level >= FEEDER_CAP} style={{ opacity: st.items[f] <= 0 ? 0.45 : 1 }}
              onClick={() => { const n = fillFeeder(f); if (n) { sfx.page(); haptic(12); nav.toast(`Poured ${FOODS[f].name} into the feeder (+${n})`); setTimeout(runFeeder, 600); } }}>
              <FoodIcon food={f} size={40} />
              <span className="grow"><span className="name">{FOODS[f].name}</span><br /><span className="small muted">{FOODS[f].desc}</span></span>
              <span className="num">×{st.items[f]}</span>
            </button>
          ))}
          {(Object.keys(FOODS) as Food[]).every((f) => st.items[f] <= 0) && (
            <>
              <p className="small">Your pantry is empty. Buy food with the Feather Coins you earn by discovering birds.</p>
              <button className="btn primary block" onClick={() => nav.open({ name: 'shop' })}>Go to the food shop</button>
            </>
          )}
        </Sheet>
      )}
      {naming && (
        <Sheet onClose={() => setNaming(null)} label="Name your bird">
          <h3 className="mb8">Name your bird</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Give your {naming === 'partner' ? allKnownSpecies().find((x) => x.id === st.partner?.speciesId)?.common : speciesOf(st.sightings.find((x) => x.id === naming)!).common} a name. Leave it empty to use the species name.</p>
          <form onSubmit={(e) => { e.preventDefault(); nameBird(naming, nameDraft); sfx.select(); nav.toast(nameDraft.trim() ? `Say hello to ${nameDraft.trim()}!` : 'Name cleared'); setNaming(null); }}>
            <label className="label" htmlFor="birdname">Name</label>
            <input id="birdname" autoFocus value={nameDraft} maxLength={18} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Pip"
              style={{ width: '100%', minHeight: 48, padding: '8px 12px', background: 'var(--well)', border: '2px solid var(--accent)', fontSize: 18, margin: '6px 0 12px' }} />
            <div className="btn-pair">
              <button type="button" className="btn" onClick={() => setNaming(null)}>Cancel</button>
              <button type="submit" className="btn primary">Save</button>
            </div>
          </form>
        </Sheet>
      )}
      {sheet === 'box' && (
        <Sheet onClose={() => setSheet(null)} label="Bird Box">
          <h3 className="mb8">Bird Box · {box.length}</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Birds resting here don't get hungry. Up to {AVIARY_MAX} birds can live in the Aviary, where they eat from the feeder and earn you Feather Coins.</p>
          {[...aviary, ...box].map((s) => {
            const here = st.diorama.birds.includes(s.id);
            return (
              <div key={s.id} className="srow">
                <Sprite species={speciesOf(s)} parts={s.sprite.parts} scale={1} mode="static" />
                <span className="grow"><span className="name">{birdName(s.id, st)}</span>{s.nickname ? <span className="small muted"> · {speciesOf(s).common}</span> : null}<br /><span style={{ display: 'block', width: 120 }}><HpBar hp={hpNow(s)} compact /></span></span>
                <button className="btn small" onClick={() => { if (!toggleHabitatBird(s.id)) nav.toast(`The Aviary holds ${AVIARY_MAX} birds. Move one to the Bird Box first.`); }}>{here ? 'To box' : 'To aviary'}</button>
              </div>
            );
          })}
        </Sheet>
      )}
    </div>
  );
}

function dedupe<T extends { speciesId: string | null; id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((s) => { const k = String(s.speciesId); if (seen.has(k)) return false; seen.add(k); return true; });
}

// ─── YOU: rank, bird list, badges, challenges, settings ───
export function YouTab() {
  const nav = useNav();
  const st = useGame((s) => s);
  useEffect(() => { gameMusic('explore'); refreshChallenges(new Date()); }, []);
  const rank = rankFor(st.xp);
  const streak = liveStreak(st.streak, dayKey(new Date()));
  const earned = Object.keys(st.badges).length;
  const partner = st.partner ? allKnownSpecies().find((x) => x.id === st.partner!.speciesId) : null;
  const region = getRegion(st.region);
  const life = dedupe(st.sightings.filter(counts));
  const now = new Date();
  const slots = [
    ...st.challenges.daily.map((d) => ({ slot: d, kind: 'Daily' })),
    ...(st.challenges.weekly ? [{ slot: st.challenges.weekly, kind: 'Weekly' }] : []),
    ...(st.challenges.seasonal ? [{ slot: st.challenges.seasonal, kind: 'Seasonal' }] : []),
  ];
  const claimable = slots.filter(({ slot }) => !slot.claimed && challengeProgress(st, slot, now).done).length;
  const [section, setSection] = useState<'quests' | 'badges' | 'lenses' | 'life'>('quests');
  useEffect(() => { const f = (e: Event) => setSection((e as CustomEvent).detail); window.addEventListener('birdly:trainer-section', f); return () => window.removeEventListener('birdly:trainer-section', f); }, []);
  const [questCast, setQuestCast] = useState(0);
  const cats = ['Firsts', 'Taxonomy', 'Place', 'Craft', 'Care', 'Time', 'Dedication'] as const;
  const tierColor = { bronze: 'var(--tier-bronze)', silver: 'var(--tier-silver)', gold: 'var(--tier-gold)', platinum: 'var(--tier-platinum)' };
  return (
    <div className="screen with-tabs">
      <PageHeader title="Trainer" right={<><FeatherChip /><button className="icon-btn" aria-label="Settings" onClick={() => nav.open({ name: 'settings' })}><Icon name="gear" size={22} /></button></>} />
      <div className="panel" style={{ background: 'linear-gradient(135deg, var(--slate), var(--plum) 60%)', borderColor: 'var(--accent)' }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          {partner && st.partner && <div style={{ background: 'var(--slate)', border: '2px solid #000' }}><Sprite species={partner} parts={st.partner.parts} scale={3} /></div>}
          <div className="grow" style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18 }}>{st.trainerName || 'Trainer'}</h2>
            <div className="small muted">{region.flag} {regionLabel(st.region)}</div>
            <div className="mt8"><span className="chip sun">Lv {trainerLevel(st.xp).level}</span> <span className="small muted">Title:</span> <span className="px small">{rank.name}</span></div>
            {partner && <div className="small mt8">Partner: <b>{partner.common}</b></div>}
          </div>
        </div>
        <div className="mt16"><Meter value={trainerLevel(st.xp).progress * 100} tone="sun" label="Progress to next level" /></div>
        <div className="row between small mt8"><span className="num">{st.xp} XP</span><span className="muted">{trainerLevel(st.xp).nextXp - st.xp} XP to Lv {trainerLevel(st.xp).level + 1}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', textAlign: 'center', marginTop: 12, borderTop: '2px solid #000', paddingTop: 10 }}>
          <div><div className="num" style={{ fontSize: 16 }}>{life.length}</div><div className="label" style={{ fontSize: 10 }}>Species</div></div>
          <div><div className="num" style={{ fontSize: 16 }}>{st.sightings.length}</div><div className="label" style={{ fontSize: 10 }}>Sightings</div></div>
          <div><div className="num" style={{ fontSize: 16 }}>{streak.days}</div><div className="label" style={{ fontSize: 10 }}>Streak</div></div>
          <div><div className="num" style={{ fontSize: 16 }}>{earned}</div><div className="label" style={{ fontSize: 10 }}>Badges</div></div>
        </div>
      </div>

      <Segmented label="Trainer sections" value={section} onChange={setSection} options={[
        { id: 'quests', label: 'Quests', badge: claimable || undefined },
        { id: 'badges', label: `Badges` },
        { id: 'lenses', label: 'Lenses' },
        { id: 'life', label: 'Bird list' },
      ]} />

      {section === 'quests' && (
        <section aria-label="Quests">
          <MerlinSays cast={questCast} name="Professor Merlin · Quests"
            text={claimable ? `You have ${claimable} quest${claimable > 1 ? 's' : ''} to hand in. Claim your reward!` : 'Head out and find birds. I will reward you for every quest you finish.'} />
          {slots.map(({ slot, kind }) => {
            const p = challengeProgress(st, slot, now);
            const ready = p.done && !slot.claimed;
            return (
              <div key={`${kind}-${slot.id}`} className={`panel ${ready ? 'highlight' : ''}`} style={{ padding: 10 }}>
                <div className="row between"><span className="label" style={{ fontSize: 11 }}>{kind}</span><span className="px small" style={{ color: 'var(--accent)' }}>+{p.def.xp} XP</span></div>
                <div className="mt8" style={{ fontWeight: 600 }}>{p.label}</div>
                <div className="row mt8" style={{ gap: 10 }}>
                  <div className="grow"><Meter value={p.progress} max={p.goal} tone="river" label={p.label} /></div>
                  {slot.claimed ? <span className="px small" style={{ color: 'var(--lichen)' }}>✓ Done</span>
                    : ready ? <button className="btn small primary" onClick={() => { const xp = claimChallenge(slot); sfx.levelUp(); setQuestCast((k) => k + 1); nav.toast(`Quest complete! +${xp} XP · +${Math.round(xp / 10)} Feather Coins`); }}>Claim</button>
                      : <span className="num small">{p.progress}/{p.goal}</span>}
                </div>
              </div>
            );
          })}
          <p className="small muted">Daily quests reset at midnight and one is always quick. Quests pay XP and Feather Coins.</p>
        </section>
      )}

      {section === 'badges' && (
        <section aria-label="Badges">
          <div className="small muted mb8">{earned} of {BADGES.length} earned. Tap a category to see what's next.</div>
          {cats.map((c) => (
            <div key={c}>
              <div className="section-title"><span>{c}</span><span>{BADGES.filter((b) => b.category === c && st.badges[b.id]).length}/{BADGES.filter((b) => b.category === c).length}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {BADGES.filter((b) => b.category === c).map((b) => {
                  const got = st.badges[b.id]; const p = Math.min(b.goal, b.progress(st));
                  return (
                    <div key={b.id} title={`${b.name}: ${b.desc}`} style={{ textAlign: 'center', background: 'var(--well-2)', border: `2px solid ${got ? tierColor[b.tier] : '#000'}`, padding: '6px 2px' }}>
                      <BadgeIcon icon={b.icon} earned={!!got} size={44} label={`${b.name}, ${b.desc}, ${got ? 'earned' : `${p} of ${b.goal}`}`} />
                      <div style={{ fontSize: 10, lineHeight: '12px', marginTop: 2 }}>{b.name}</div>
                      <div className="num" style={{ fontSize: 9, color: got ? tierColor[b.tier] : 'var(--ash)' }}>{got ? b.tier : `${p}/${b.goal}`}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {section === 'lenses' && (
        <section aria-label="Your Snap Lenses">
          <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Capsule size={48} lens={st.lens} glow />
            <div className="grow">
              <div className="label">In use</div>
              <div className="name">{lensOf(st.lens).name}</div>
              <div className="lens-power">{lensOf(st.lens).power ? `+${lensOf(st.lens).power} Snap Power` : 'No Snap Power boost'}</div>
            </div>
            <div className="num small">{st.lenses.length}/{LENS_ORDER.length}</div>
          </div>
          <p className="small muted">Snap Power is your photo score out of 100. Your lens adds a bonus to every photo you take with the camera, so you earn more XP. Each lens also records birds with its own effect.</p>
          <LensList onBought={(id) => nav.toast(`Bought ${LENSES[id].name}`)} onEquip={(id) => nav.toast(`Using ${LENSES[id].name}`)} />
        </section>
      )}

      {section === 'life' && (
        <section aria-label="Bird list">
          {life.length === 0 && <p className="small muted">Your Bird list starts with the first bird you identify.</p>}
          {life.map((s) => (
            <button key={s.id} className="srow" onClick={() => nav.open({ name: 'species', id: s.speciesId! })}>
              <BirdThumb sp={speciesOf(s)} size={40} />
              <span className="grow"><span className="name">{speciesOf(s).common}</span><br /><span className="small muted">{dexNo(s.dex)} · Lv {s.level ?? 5} · {new Date(s.capturedAt).toLocaleDateString()} · {getRegion(s.region).name}</span></span>
              <RarityTag rarity={s.rarity} showLabel={false} />
            </button>
          ))}
          <button className="btn block mt16" onClick={() => nav.open({ name: 'year' })}>Your year in birds</button>
        </section>
      )}
    </div>
  );
}

function BadgeStrip() {
  const st = useGame((s) => s);
  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="label mb8">Badge case</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, justifyItems: 'center' }}>
        {BADGES.map((b) => <BadgeIcon key={b.id} icon={b.icon} earned={!!st.badges[b.id]} size={44} label={`${b.name}${st.badges[b.id] ? ', earned' : ', not yet earned'}`} />)}
      </div>
    </div>
  );
}

export function BadgesScreen() {
  const st = useGame((s) => s);
  const nav = useNav();
  const cats = ['Firsts', 'Taxonomy', 'Place', 'Craft', 'Care', 'Time', 'Dedication'] as const;
  const [cat, setCat] = useState<(typeof cats)[number]>('Firsts');
  const tierColor = { bronze: 'var(--tier-bronze)', silver: 'var(--tier-silver)', gold: 'var(--tier-gold)', platinum: 'var(--tier-platinum)' };
  return (
    <div className="overlay">
      <div className="topbar"><button className="icon-btn" onClick={nav.back} aria-label="Back"><Icon name="back" size={20} /></button><h2>Badges</h2><span className="px small">{Object.keys(st.badges).length} / {BADGES.length}</span></div>
      <div className="screen">
        <div className="hscroll mb16">{cats.map((c) => <button key={c} className="filter" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {BADGES.filter((b) => b.category === cat).map((b) => {
            const got = st.badges[b.id];
            const p = Math.min(b.goal, b.progress(st));
            return (
              <div key={b.id} className="panel" style={{ margin: 0, opacity: got ? 1 : 0.85, borderColor: got ? tierColor[b.tier] : undefined }}>
                <BadgeIcon icon={b.icon} earned={!!got} size={64} />
                <div className="px" style={{ fontSize: 12 }}>{b.name}</div>
                <div className="small muted">{b.desc}</div>
                <div className="px mt8" style={{ fontSize: 11, color: tierColor[b.tier] }}>{b.tier}</div>
                {got ? <div className="small">Earned {new Date(got).toLocaleDateString()} · +{TIER_FEATHERS[b.tier]}</div>
                  : <><Meter value={p} max={b.goal} tone="river" label={b.name} /><div className="small num mt8">{p}/{b.goal}</div></>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ChallengesScreen() {
  const st = useGame((s) => s);
  const nav = useNav();
  const now = new Date();
  const species = speciesCount(st);
  const slots = [
    ...st.challenges.daily.map((d) => ({ slot: d, kind: 'Daily' })),
    ...(st.challenges.weekly ? [{ slot: st.challenges.weekly, kind: 'Weekly' }] : []),
    ...(st.challenges.seasonal ? [{ slot: st.challenges.seasonal, kind: 'Seasonal' }] : []),
  ];
  return (
    <div className="overlay">
      <div className="topbar"><button className="icon-btn" onClick={nav.back} aria-label="Back"><Icon name="back" size={20} /></button><h2>Challenges</h2></div>
      <div className="screen">
        {slots.map(({ slot, kind }) => {
          const p = challengeProgress(st, slot, now);
          return (
            <div key={`${kind}-${slot.id}`} className="panel">
              <div className="row between"><span className="label">{kind}</span><span className="px small" style={{ color: 'var(--accent)' }}>{p.def.xp} XP</span></div>
              <div className="mt8">{p.label}</div>
              <Meter value={p.progress} max={p.goal} tone="river" label={p.label} />
              <div className="row between mt8 small">
                <span className="num">{p.progress}/{p.goal}</span>
                {slot.claimed ? <span className="px" style={{ color: 'var(--lichen)' }}>Claimed</span>
                  : <button className="btn small primary" disabled={!p.done} onClick={() => { const xp = claimChallenge(slot); sfx.sparkle(); nav.toast(`+${xp} XP`); }}>Claim</button>}
              </div>
            </div>
          );
        })}
        {!st.challenges.seasonal && <p className="small muted">No seasonal challenge in high summer. The next one starts with autumn passage.</p>}
        {species < 50 && <p className="small muted">The Big Day challenge type opens at 50 species.</p>}
        <p className="small muted">No leaderboards, no timers on your birds. Daily challenges reset at midnight; one is always quick.</p>
      </div>
    </div>
  );
}

export function YearScreen() {
  const st = useGame((s) => s);
  const nav = useNav();
  const year = new Date().getFullYear();
  const mine = st.sightings.filter((s) => new Date(s.capturedAt).getFullYear() === year);
  const uniq = dedupe(mine.filter(counts));
  const rarest = mine.slice().sort((a, b) => ['common', 'uncommon', 'rare', 'mega', 'legendary'].indexOf(b.rarity) - ['common', 'uncommon', 'rare', 'mega', 'legendary'].indexOf(a.rarity))[0];
  const best = mine.filter((s) => s.fieldcraft).sort((a, b) => b.fieldcraft!.total - a.fieldcraft!.total)[0];
  const patch = Object.entries(mine.reduce<Record<string, number>>((m, s) => ((m[s.habitat] = (m[s.habitat] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="overlay">
      <div className="topbar"><button className="icon-btn" onClick={nav.back} aria-label="Back"><Icon name="back" size={20} /></button><h2>{year} in birds</h2></div>
      <div className="screen">
        {new Date().getMonth() !== 11 && <p className="small muted">The full recap arrives in December. Here is your year so far.</p>}
        <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, padding: 8 }}>
          {uniq.map((s) => <Sprite key={s.id} species={speciesOf(s)} parts={s.sprite.parts} scale={1} mode="static" />)}
          {!uniq.length && <p className="small muted" style={{ gridColumn: '1 / -1' }}>No birds yet this year. The poster fills as you go.</p>}
        </div>
        <div className="panel small">
          <div>Species: <b className="num">{uniq.length}</b></div>
          <div>Sightings: <b className="num">{mine.length}</b></div>
          {rarest && <div>Rarest: {speciesOf(rarest).common} (<RarityTag rarity={rarest.rarity} />)</div>}
          {best && <div>Best photo: {speciesOf(best).common} · {best.fieldcraft!.total}</div>}
          {patch && <div>Most-birded patch: {patch[0]}</div>}
        </div>
        <p className="small muted">Generated on this phone. Nothing is sent anywhere.</p>
      </div>
    </div>
  );
}

export { setState, useMemo };

function DecorThumb({ def, size }: { def: DecorDef; size: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (c.current) paintDecorThumb(c.current, def); }, [def.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={c} className="pix decor-thumb" style={{ width: size, height: size }} aria-hidden />;
}
function HomeThumb({ id }: { id: string }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (c.current) paintHomeThumb(c.current, id, 200); }, [id]);
  return <canvas ref={c} className="home-thumb" aria-hidden />;
}
