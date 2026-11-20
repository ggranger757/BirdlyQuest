// Merlin's guided tour: spotlights real parts of the app, one step at a time.
import { useEffect, useLayoutEffect, useState } from 'react';
import { setState } from '../app/store';
import { Professor } from './Characters';
import { sfx } from '../app/audio';

type Tab = 'explore' | 'dex' | 'aviary' | 'you';
interface Step { tab?: Tab; section?: string; target?: string; text: string }

const STEPS: Step[] = [
  { tab: 'explore', text: 'Welcome to your field kit! Let me show you around. Tap Next to follow me.' },
  { tab: 'explore', target: '.map-wrap', text: 'This is your map. Real birds people have seen near you in the last 30 days appear here, live.' },
  { tab: 'explore', target: '.drawer .seg', text: 'LATEST shows the newest sightings around you. LIKELY shows the birds you are most likely to find right now.' },
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'This is the SNAP button. Open the camera, point it at a real bird and press the shutter.' },
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'Every photo gets a SNAP POWER score out of 100. Sharp, close, well-lit shots score higher and earn more XP.' },
  { tab: 'explore', target: '.tabbar .tab.cam', text: 'Then tell me which bird it is. I turn your photo into a pixel bird coloured from YOUR shot, and you record it with your Snap Lens.' },
  { tab: 'dex', target: '.jgrid', text: 'Your BirdDex holds every bird in your region. Silhouettes are birds still waiting to be discovered.' },
  { tab: 'aviary', target: '[data-tour="aviary"]', text: 'Your Aviary! Birds you discover live here as pets. Their HP slowly drops, so they need food.' },
  { tab: 'aviary', target: '[role="tablist"][aria-label="Aviary sections"]', text: 'Keep the FEEDER full. Hungry birds fly in and eat by themselves. Buy food in my shop with Feathers.' },
  { tab: 'you', section: 'lenses', target: '[aria-label="Your Snap Lenses"]', text: 'Your Snap Lenses. Better lenses add Snap Power to every photo, and each has its own recording effect.' },
  { tab: 'you', section: 'quests', target: '[role="tablist"][aria-label="Trainer sections"]', text: 'Quests and badges earn XP and Feathers. Level up to unlock new Bird Homes for your Aviary.' },
  { tab: 'explore', text: 'That is everything! Go outside and find your first bird. You can replay this tour in Settings.' },
];

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

  const finish = () => { setState((s) => ({ ...s, tutorialDone: true, tourOn: false })); sfx.levelUp(); onDone(); };
  const next = () => { sfx.select(); if (i < STEPS.length - 1) setI(i + 1); else finish(); };
  const back = () => { sfx.back(); setI(Math.max(0, i - 1)); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); if (e.key === 'ArrowRight' || e.key === 'Enter') next(); if (e.key === 'ArrowLeft') back(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const pad = 6;
  const below = !rect || rect.top + rect.height / 2 < window.innerHeight * 0.45; // put Merlin away from the target
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Merlin's tour, step ${i + 1} of ${STEPS.length}`}>
      {rect ? <div className="tour-hole" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={below ? { bottom: 'calc(var(--tab-h) + var(--safe-b) + 16px)' } : { top: 'calc(16px + var(--safe-t))' }}>
        <div className="tour-merlin"><Professor height={96} /></div>
        <div className="dialog" style={{ cursor: 'default' }}>
          <span className="dialog-name">Professor Merlin · {i + 1}/{STEPS.length}</span>
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
