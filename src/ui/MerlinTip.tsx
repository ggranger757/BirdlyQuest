// Just-in-time help: Merlin pops in once, the first time you open each screen.
import { useGame, setState } from '../app/store';
import { Professor } from './Characters';
import { sfx } from '../app/audio';

export const TIPS: Record<string, string> = {
  explore: 'This map shows real birds seen near you. When you spot one, tap the big SNAP button!',
  dex: 'Your BirdDex! Start with the Backyard 12 chapter. Finish a chapter to earn Feathers.',
  aviary: 'Birds you discover live here. Keep the feeder full: buy food with Feathers (the gold feather is your money). Tap a bird to say hello!',
  you: 'Your Trainer page: quests, badges and Snap Lenses. Better lenses boost Snap Power.',
  camera: 'Get close and keep the bird sharp for a high Snap Power. Not sure what it is? The Likely list below helps.',
};

export function MerlinTip({ id, placement = 'above-tabs' }: { id: string; placement?: 'above-tabs' | 'inline' }) {
  const seen = useGame((s) => (s.tipsSeen ?? []).includes(id) || !!s.tourOn);
  if (seen || !TIPS[id]) return null;
  const close = () => { sfx.select(); setState((s) => ({ ...s, tipsSeen: [...(s.tipsSeen ?? []), id] })); };
  return (
    <div className={`merlin-tip ${placement}`} role="status" aria-live="polite">
      <div className="merlin-tip-bird"><Professor height={48} /></div>
      <div className="merlin-tip-body">
        <b>Professor Merlin</b>
        <span>{TIPS[id]}</span>
      </div>
      <button className="btn small primary" onClick={close}>Got it</button>
    </div>
  );
}
