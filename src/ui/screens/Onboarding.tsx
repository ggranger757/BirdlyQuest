import { useEffect, useMemo, useRef, useState } from 'react';
import { SPECIES_BY_ID } from '../../data/species';
import { setState, getState, logEvent, setRegion, setTrainer, setPartner, useGame } from '../../app/store';
import { runBackdrop } from '../../render/diorama';
import { Sprite, useReducedMotion } from '../components';
import { Dialog, Types, BirdThumb, Capsule } from '../game';
import { sfx, music } from '../../app/audio';
import { Professor } from '../Characters';
import { RegionPicker } from './RegionPicker';
import { getRegion, regionLabel } from '../../data/geo';
import { regionEntries, ensureRegion, allKnownSpecies, onProviderChange, providerStatus } from '../../data/provider';
import { typesOf } from '../../core/rarity';
import type { Species } from '../../data/types';

/** Valley pond, full screen and gently drifting, with a dark fade so text stays readable. */
function SceneBackdrop({ dim = 0.15 }: { dim?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => runBackdrop(ref.current!, 'valley', { focus: 0.62, reduced }), [reduced]);
  return (
    <>
      <canvas ref={ref} className="pix" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: -2 }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, background: `linear-gradient(180deg, rgba(var(--scrim),${dim}) 0%, rgba(var(--scrim),${dim}) 45%, rgba(var(--scrim),${Math.min(0.92, dim + 0.55)}) 100%)` }} />
    </>
  );
}

export function Boot({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  useEffect(() => { music('title'); }, []);
  return (
    <div className="screen" onClick={() => { sfx.select(); onDone(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, position: 'relative', isolation: 'isolate' }}>
      <SceneBackdrop dim={0.3} />
      <div style={{ animation: reduced ? undefined : 'bob 900ms steps(2) infinite' }}><Sprite species={SPECIES_BY_ID.norcar} scale={4} mode="fly" /></div>
      <h1 className="title-logo">BIRDLY<b>QUEST</b></h1>
      <p className="small" style={{ margin: 0, textShadow: '1px 1px 0 #000' }}>Discover real birds with your camera.</p>
      <p className="press mt24">TAP TO START</p>
    </div>
  );
}


export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<'intro' | 'name' | 'region' | 'partner' | 'outro'>('intro');
  const [name, setName] = useState(getState().trainerName);
  const region = useGame((s) => s.region);
  useEffect(() => { logEvent('onboarding_step', step); }, [step]);
  useEffect(() => { music('title'); }, []);

  const prof = (
    <div className="merlin-stage">
      <div style={{ filter: 'drop-shadow(4px 4px 0 #000)' }}><Professor height={144} /></div>
      <i className="merlin-shadow" aria-hidden />
    </div>
  );

  if (step === 'intro') {
    return (
      <div className="screen onb" style={{ justifyContent: 'flex-end' }}>
        <SceneBackdrop />
        {prof}
        <Dialog speaker="Professor Merlin" lines={[
          'Kee-kee! Welcome to the world of BIRDS! I am Professor Merlin, a falcon of the old woods.',
          'Real wild birds live all around you — in parks, on rooftops, by the water.',
          'Snap a photo of one and it is discovered: it joins your BirdDex as a pixel companion, while the real bird flies on.',
          'Every bird you discover is drawn from YOUR photo. No two explorers have the same birds.',
          'Now then… what should I call you?',
        ]} onDone={() => setStep('name')} />
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="screen onb" style={{ justifyContent: 'flex-end' }}>
        <SceneBackdrop />
        {prof}
        <div className="onb-card">
        <Dialog speaker="Professor Merlin" lines={['What should I call you, explorer?']} />
        <label className="label mt16" htmlFor="tname" style={{ display: 'block', marginBottom: 6 }}>Trainer name</label>
        <input id="tname" autoFocus value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          style={{ minHeight: 56, padding: '8px 14px', background: 'var(--well)', border: '3px solid var(--accent)', fontFamily: 'var(--px)', fontSize: 20, textTransform: 'uppercase', borderRadius: 0 }} />
        <button className="btn primary big block" onClick={() => { setTrainer(name.trim() || 'Birder'); sfx.select(); setStep('region'); }}>{name.trim() ? 'That’s me' : 'Skip'}</button>
        </div>
      </div>
    );
  }

  if (step === 'region') {
    return (
      <div className="screen onb">
        <SceneBackdrop dim={0.7} />
        <div className="row" style={{ alignItems: 'flex-end', gap: 10, marginTop: 8 }}><Professor height={96} /><div className="grow"><Dialog speaker="Professor Merlin" lines={[`${name.trim() || 'Birder'}! Where do you live? Every place has its own birds.`]} /></div></div>
        <div className="mt16">
          <RegionPicker value={getState().onboarded ? region : undefined} onPick={(code) => { setRegion(code); setStep('partner'); }} />
        </div>
      </div>
    );
  }

  if (step === 'partner') return <PartnerPick region={region} onDone={() => setStep('outro')} />;

  const r = getRegion(region);
  return <Outro r={r} region={region} onFinish={onFinish} />;
}

function Outro({ r, region, onFinish }: { r: ReturnType<typeof getRegion>; region: string; onFinish: () => void }) {
  return (
    <div className="screen onb" style={{ justifyContent: 'flex-end' }}>
      <SceneBackdrop />
      <div className="merlin-stage">
        <div style={{ filter: 'drop-shadow(4px 4px 0 #000)' }}><Professor height={144} /></div>
        <i className="merlin-shadow" aria-hidden />
      </div>
      <Dialog speaker="Professor Merlin" lines={[
        `${r.flag ?? ''} ${regionLabel(region)}. Splendid birding country!`,
        'Every bird you discover earns you FEATHER COINS, the money of BirdlyQuest. Spend them in my shop on bird food and Snap Lenses.',
        'I will pop up with a tip the first time you open each screen. Off you go!',
      ]} onDone={() => {
        setState((s) => ({ ...s, onboarded: true, diorama: { ...s.diorama, biome: s.habitat } }));
        sfx.levelUp(); onFinish();
      }} />
    </div>
  );
}

function PartnerPick({ region, onDone }: { region: string; onDone: () => void }) {
  const [, force] = useState(0);
  useEffect(() => { ensureRegion(region); return onProviderChange(() => force((x) => x + 1)); }, [region]);
  const status = providerStatus(region);
  // wait for the live regional list (up to 8s) so the choices don't swap under the player's finger
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 8000); return () => clearTimeout(t); }, []);
  const ready = (status !== 'loading' && status !== 'idle') || waited;
  const choices = useMemo(() => {
    if (!ready) return [];
    const ok = (sp: Species) => !sp.sensitive && sp.archetype !== 'owl';
    const top = regionEntries(region).map((e) => e.sp).filter(ok).slice(0, 40);
    const out: Species[] = []; const types = new Set<string>();
    for (const sp of top) { const t = typesOf(sp)[0]; if (!types.has(t)) { types.add(t); out.push(sp); } if (out.length === 3) break; }
    for (const sp of top) { if (out.length >= 3) break; if (!out.includes(sp)) out.push(sp); }
    // always offer three, even where data is thin
    for (const sp of allKnownSpecies().filter(ok)) { if (out.length >= 3) break; if (!out.some((x) => x.id === sp.id)) out.push(sp); }
    return out;
  }, [region, ready]);
  const [pick, setPick] = useState<Species | null>(null);
  return (
    <div className="screen onb">
      <SceneBackdrop dim={0.7} />
      <div className="row" style={{ alignItems: 'flex-end', gap: 10, marginTop: 8 }}><Professor height={96} /><div className="grow"><Dialog speaker="Professor Merlin" lines={['Every trainer needs a partner. These three are common where you live. Choose one!']} /></div></div>
      {!ready && <p className="small muted mt8">Looking up the birds of {regionLabel(region)}…</p>}
      {!ready && <div className="col mt16" style={{ gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="panel skeleton" style={{ margin: 0, height: 84 }} />)}</div>}
      <div className="col mt16" style={{ gap: 12 }}>
        {choices.map((sp) => (
          <button key={sp.id} className={`panel ${pick?.id === sp.id ? 'highlight' : ''}`} style={{ margin: 0, textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}
            onClick={() => { sfx.select(); setPick(sp); }} aria-pressed={pick?.id === sp.id}>
            <div style={{ background: 'var(--slate)', border: '2px solid #000' }}><Sprite species={sp} scale={2} mode={pick?.id === sp.id ? 'idle' : 'static'} /></div>
            <span className="grow"><span className="name">{sp.common}</span><br /><Types sp={sp} /></span>
            <BirdThumb sp={sp} size={56} />
          </button>
        ))}
      </div>
      <button className="btn primary big block mt16" disabled={!pick} onClick={() => { if (pick) { setPartner(pick); sfx.caught(); onDone(); } }}>
        {pick ? `Choose ${pick.common}` : 'Pick a partner'}
      </button>
      <p className="small muted">Your partner is a gift, not a discovery. Your BirdDex fills only with birds you photograph.</p>
    </div>
  );
}
