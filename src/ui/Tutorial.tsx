// Merlin's guided tour: spotlights real parts of the app, one step at a time.
import { useEffect, useLayoutEffect, useState } from 'react';
import { setState } from '../app/store';
import { Professor } from './Characters';
import { sfx } from '../app/audio';

type Tab = 'explore' | 'dex' | 'aviary' | 'you';
interface Step { tab?: Tab; section?: string; target?: string; text: string }

const STEPS: Step[] = [
  { tab: 'explore', text: 'Welcome, birder! I’m Professor Woods. Let me walk you through your whole field kit. It takes a minute, and you can skip any time.' },
  // Explore
  { tab: 'explore', target: '.map-wrap', text: 'This is your MAP. Real birds people have reported near you in the last 30 days show up here, live. Parks marked with a pin are good birding spots.' },
  { tab: 'explore', target: '.drawer .seg', text: 'LATEST shows the newest sightings around you. LIKELY shows the birds you’re most likely to find right now, here, at this time of day.' },
  { tab: 'explore', target: '.feather-chip', text: 'These are FEATHER COINS, BirdlyQuest’s money. You earn them by logging birds, winning battles and finishing quests. Tap here any time to open my shop.' },
  // Camera + Snap Power
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'This is the SNAP button. Point the camera at a real bird and press the shutter. Pinch to zoom, and use the brightness button in dim light.' },
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'Every photo gets a SNAP POWER score out of 100. Close, sharp, well-lit, centred birds score highest. Higher Snap Power earns more XP and makes your capture more certain.' },
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'Then tell me which bird it is (the Likely list helps). I turn it into a pixel bird coloured from YOUR photo. Rarer birds pay more: up to ×10 XP and ×6 Feather Coins!' },
  // BirdDex
  { tab: 'dex', target: '.goals', text: 'Your BirdDex! These are your GOALS. Each is a set of local birds to find. Complete one to open a treasure chest of coins.' },
  { tab: 'dex', target: '.jgrid', text: 'Every bird in your region is listed here. Silhouettes are birds still waiting to be discovered. Tap any bird for facts and where to look.' },
  // Aviary
  { tab: 'aviary', target: '[data-tour="aviary"]', text: 'Your AVIARY. Birds you discover live here as pets and fly between perches. Tap one for a fun fact. Healthy birds bring you Feather Coins every day.' },
  { tab: 'aviary', target: '[role="tablist"][aria-label="Aviary sections"]', text: 'Their HP slowly drops, so keep the FEEDER full. Hungry birds fly to the feeder and eat by themselves.' },
  { tab: 'aviary', target: '.home-strip', text: 'BIRD HOMES. New homes unlock as you level up, then you buy them with Feather Coins. You can also hang new feeders and set out perches from my shop.' },
  { tab: 'aviary', target: '.trials-entry', text: 'FIELD TRIALS! Battle rival birders with your birds’ real-life talents: songs, displays, flight and foraging. Win to level your birds up so they learn new moves.' },
  { tab: 'aviary', target: '.trials-entry', text: 'Each rival battle costs a TRIAL TICKET. You earn one for every bird you log (up to 5). Wandering birders sometimes challenge you after a new find, and those battles are free.' },
  { tab: 'aviary', target: '.trials-entry', text: 'In battle: FIGHT to pick a move, BAG for snacks and potions, BIRDS to swap. The faster bird moves first, and every bird has a class. Song beats Display, Display beats Forage, Forage beats Sky, Sky beats Song.' },
  // Trainer
  { tab: 'you', section: 'lenses', target: '[aria-label="Your Snap Lenses"]', text: 'SNAP LENSES add Snap Power to every photo, and each records your bird with its own effect. Better lenses unlock as you level up.' },
  { tab: 'you', section: 'quests', target: '[role="tablist"][aria-label="Trainer sections"]', text: 'QUESTS and BADGES earn XP and Feather Coins. Each trainer level also adds BOND: +1% HP and power for every bird you bring to battle.' },
  { tab: 'explore', target: '.feather-chip', text: 'My SHOP sells bird food, Snap Lenses, Bird Homes, 50 feeders and 50 perches. Everything is paid in Feather Coins.' },
  { tab: 'explore', text: 'That’s everything! Go outside and find your first bird. You can replay this tour any time from Settings. Happy birding!' },
];
export const TOUR_VERSION = 2;

export function Tutorial({ setTab, onDone }: { setTab: (t: Tab) => void; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  useEffect(() => {
    if (step.tab) setTab(step.tab);
    const fire = () => { if (step.section) window.dispatchEvent(new CustomEvent('birdly:trainer-section', { detail: step.section })); };
    fire(); const t = setTimeout(fire, 80); const t2 = setTimeout(fire, 300);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [i]);

  // find the target once the screen has rendered, and keep it measured
  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const el = step.target ? document.querySelector(step.target) : null;
      if (el) { const h = el.getBoundingClientRect().height; el.scrollIntoView({ block: h > window.innerHeight * 0.35 ? 'start' : 'nearest' }); }
      if (!el) { setRect(null); return; }
      // keep the spotlight on what is actually on screen
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const top = Math.max(4, r.top), bottom = Math.min(vh - 4, r.bottom, top + vh * 0.42);
      setRect(new DOMRect(Math.max(4, r.left), top, Math.min(window.innerWidth - 8, r.right) - Math.max(4, r.left), Math.max(24, bottom - top)));
    };
    setRect(null);
    const t1 = setTimeout(measure, 160), t2 = setTimeout(measure, 500), t3 = setTimeout(measure, 900);
    window.addEventListener('resize', measure);
    return () => { alive = false; clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); window.removeEventListener('resize', measure); };
  }, [i]);

  const finish = () => { setState((s) => ({ ...s, tutorialDone: true, tourOn: false, tourSeen: TOUR_VERSION })); sfx.levelUp(); onDone(); };
  const next = () => { sfx.select(); if (i < STEPS.length - 1) setI(i + 1); else finish(); };
  const back = () => { sfx.back(); setI(Math.max(0, i - 1)); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); if (e.key === 'ArrowRight' || e.key === 'Enter') next(); if (e.key === 'ArrowLeft') back(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const pad = 6;
  const below = !rect || rect.top + rect.height / 2 < window.innerHeight * 0.45; // put Merlin away from the target
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Professor Woods' tour, step ${i + 1} of ${STEPS.length}`}>
      {rect ? <div className="tour-hole" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={below ? { bottom: 'calc(var(--tab-h) + var(--safe-b) + 16px)' } : { top: 'calc(16px + var(--safe-t))' }}>
        <div className="tour-merlin"><Professor framed height={96} mood={i === STEPS.length - 1 ? 'delighted' : i >= 12 && i <= 14 ? 'focused' : 'curious'} /></div>
        <div className="dialog" style={{ cursor: 'default' }}>
          <span className="dialog-name">Professor Woods · {i + 1}/{STEPS.length}</span>
          <span className="tour-progress" aria-hidden><i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} /></span>
          <p className="dialog-text" aria-live="polite">{step.text}</p>
          <div className="row mt8" style={{ gap: 8 }}>
            <button className="btn small ghost tour-skip" onClick={finish}>Skip tour</button>
            <span className="grow" />
            {i > 0 && <button className="btn small" onClick={back}>Back</button>}
            <button className="btn small primary" onClick={next} autoFocus>{i < STEPS.length - 1 ? 'Next' : 'Let’s go!'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
