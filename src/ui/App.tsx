import { Component, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { NavCtx, Nav, Route, Tab, consumeBackGuard } from './nav';
import { useGame, isReady, getState, hungryCount, tickFeeder , welcomeBack } from '../app/store';
import { Icon, Toast } from './components';
import { Boot, Onboarding } from './screens/Onboarding';
import { Explore } from './screens/Explore';
import { Dex } from './screens/Dex';
import { HabitatTab, YouTab, BadgesScreen, ChallengesScreen, YearScreen } from './screens/Tabs';
import { Viewfinder } from './screens/Viewfinder';
import { CatchFlow } from './screens/Catch';
import { SpeciesCard } from './screens/SpeciesCard';
import { Spread } from './screens/Spread';
import { Sketch } from './screens/Sketch';
import { Settings, Debug, Lab } from './screens/Settings';
import { sfx } from '../app/audio';
import { challengeProgress } from '../core/challenges';
import { BadgePopup } from './BadgePopup';

const TABS: { id: Tab | 'camera'; label: string; icon: string }[] = [
  { id: 'explore', label: 'Explore', icon: 'map' }, { id: 'dex', label: 'BirdDex', icon: 'journal' },
  { id: 'camera', label: 'Snap', icon: 'photo' },
  { id: 'aviary', label: 'Aviary', icon: 'habitat' }, { id: 'you', label: 'Trainer', icon: 'you' },
];

function renderRoute(r: Route) {
  switch (r.name) {
    case 'species': return <SpeciesCard id={r.id} sightingId={r.sightingId} />;
    case 'spread': return <Spread sightingId={r.sightingId} />;
    case 'viewfinder': return <Viewfinder />;
    case 'catch': return <CatchFlow job={r.job} />;
    case 'sketch': return <Sketch />;
    case 'quicklog': return <QuickLog />;
    case 'shop': return <Shop />;
    case 'badges': return <BadgesScreen />;
    case 'challenges': return <ChallengesScreen />;
    case 'settings': return <Settings />;
    case 'year': return <YearScreen />;
    case 'lab': return <Lab />;
    case 'debug': return <Debug />;
    case 'trials': return <Trials wild={r.wild} />;
  }
}

function hasClaimable() {
  const st = getState(); const now = new Date();
  const slots = [...st.challenges.daily, st.challenges.weekly, st.challenges.seasonal].filter(Boolean) as typeof st.challenges.daily;
  return slots.some((s) => !s.claimed && challengeProgress(st, s, now).done);
}

const THEME_BAR: Record<string, string> = { neon: '#0A0C0F', dusk: '#0E0B22', ember: '#150906', field: '#EADCBC' };

import { Tutorial } from './Tutorial';
import { QuickLog } from './screens/QuickLog';
import { MerlinTip } from './MerlinTip';
import { Shop } from './screens/Shop';
import { Trials } from './screens/Trials';
import { ChallengePrompt } from './ChallengePrompt';

export function App() {
  const ready = useGame(() => isReady());
  const onboarded = useGame((s) => s.onboarded);
  const tourOn = useGame((s) => !!s.tourOn);
  const dys = useGame((s) => s.settings.dyslexiaFont);
  const theme = useGame((s) => ((s.settings.theme as string) === 'forest' ? 'ember' : s.settings.theme) ?? 'neon');
  const motion = useGame((s) => s.settings.motion);
  useGame((s) => s.challenges); useGame((s) => s.sightings.length);
  const [booted, setBooted] = useState(false);
  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.slice(2) as Tab;
    return (['explore', 'dex', 'aviary', 'you'] as Tab[]).includes(h) ? h : 'explore';
  });
  const [stack, setStack] = useState<Route[]>(() => (location.hash === '#/lab' ? [{ name: 'lab' }] : []));
  const [toast, setToast] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    document.documentElement.classList.toggle('dyslexia', dys);
    document.documentElement.classList.toggle('motion-reduced', motion === 'reduced');
    document.documentElement.classList.toggle('motion-full', motion === 'full');
    for (const t of ['dusk', 'ember', 'field']) document.documentElement.classList.toggle(`theme-${t}`, theme === t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR[theme] ?? '#0A0C0F');
  }, [dys, motion, theme]);

  useEffect(() => { const t = setInterval(() => tickFeeder(), 60000); return () => clearInterval(t); }, []);
  // welcome back: Merlin looks after weak birds if you've been away a while
  useEffect(() => {
    if (!ready || !onboarded) return;
    const check = () => { if (document.visibilityState !== 'visible') return; const n = welcomeBack(); if (n) setToast(`Welcome back! Merlin fed ${n} hungry bird${n > 1 ? 's' : ''} while you were away.`); };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [ready, onboarded]);

  useEffect(() => {
    const onPop = () => { if (consumeBackGuard(stackRef.current.length)) return; if (stackRef.current.length) setStack((s) => s.slice(0, -1)); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setTab = useCallback((t: Tab) => { setTabState(t); history.replaceState(null, '', `#/${t}`); }, []);
  const nav: Nav = {
    tab, setTab, stack, highlight, setHighlight,
    open: (r) => { history.pushState({ o: true }, ''); setStack((s) => [...s, r]); },
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
    back: () => { if (stackRef.current.length) { sfx.back(); history.back(); } },
    closeAll: () => { const n = stackRef.current.length; setStack([]); if (n) history.go(-n); },
    toast: (t) => setToast(t),
  };

  if (!ready) return <div className="app" aria-busy="true" />;
  if (!booted && !onboarded) return <div className="app"><Boot onDone={() => setBooted(true)} /></div>;
  if (!onboarded) return <div className="app"><Onboarding onFinish={() => setTab('explore')} /></div>;

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <main aria-hidden={stack.length > 0}>
          {tab === 'explore' && <Explore />}
          {tab === 'dex' && <Dex />}
          {tab === 'aviary' && <HabitatTab />}
          {tab === 'you' && <YouTab />}
        </main>
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => t.id === 'camera' ? (
            <button key="cam" className="tab cam" onClick={() => { sfx.select(); nav.open({ name: 'viewfinder' }); }} aria-label="Snap a bird with the camera">
              <span className="cam-btn"><Icon name="photo" size={28} color="var(--accent-ink)" /></span>
            </button>
          ) : (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => { sfx.move(); setTab(t.id as Tab); }}>
              <Icon name={t.icon} size={24} filled={tab === t.id} />{t.label}
              {t.id === 'you' && hasClaimable() && <span className="dot" aria-label="Quest ready to claim" />}
              {t.id === 'aviary' && hungryCount() > 0 && <span className="dot" aria-label="A bird is hungry" />}
            </button>
          ))}
        </nav>
        {stack.map((r, i) => <div key={i} style={{ display: 'contents' }} aria-hidden={i < stack.length - 1}>{renderRoute(r)}</div>)}
        <BadgePopup blocked={stack.some((r) => r.name === 'catch')} />
        {toast && <Toast text={toast} onDone={() => setToast(null)} />}
        {tourOn && stack.length === 0 && <Tutorial setTab={setTab} onDone={() => setTab('explore')} />}
        {!tourOn && stack.length === 0 && !toast && <MerlinTip id={tab} />}
        {!tourOn && stack.length === 0 && <ChallengePrompt />}
      </div>
      <p className="desk-note"><b>BIRDLYQUEST</b> is built for phones. Open this page on your phone and add it to your home screen to play.</p>
    </NavCtx.Provider>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="app"><div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <h2>BirdlyQuest tripped over a branch.</h2>
        <p className="small">Your BirdDex is safe — it is saved on this phone after every discovery. Reload to carry on.</p>
        <pre className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.err.message).slice(0, 300)}</pre>
        <button className="btn primary big block" onClick={() => location.reload()}>Reload</button>
      </div></div>
    );
  }
}
