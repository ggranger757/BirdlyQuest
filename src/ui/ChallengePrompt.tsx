import { lookOfSighting } from '../core/gear';
// After you discover a new bird, a wandering birder sometimes asks for a quick Field Trial with it.
import { useGame, clearChallenge, speciesOf } from '../app/store';
import { useNav } from './nav';
import { Sprite } from './components';
import { sfx, playClip } from '../app/audio';
import { WANDERERS, WANDERER_PERSONA, wandererFace } from '../core/trials';

export function ChallengePrompt() {
  const nav = useNav();
  const pending = useGame((s) => s.pendingChallenge);
  const badgeQueue = useGame((s) => s.badgeQueue.length);
  const sighting = useGame((s) => (s.pendingChallenge ? s.sightings.find((x) => x.id === s.pendingChallenge!.sightingId) : undefined));
  if (!pending || !sighting || badgeQueue > 0) return null;
  const sp = speciesOf(sighting);
  const who = WANDERERS[[...sighting.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % WANDERERS.length];
  return (
    <div className="tchallenge" role="dialog" aria-modal="true" aria-label="Battle challenge">
      <div className="tchallenge-card panel">
        <span className="thero-kicker">Challenge!</span>
        <div className="tchallenge-vs">
          <img className="tchallenge-face" src={wandererFace(sighting.id)} alt={who} width={88} height={88} draggable={false} />
          <span className="tchallenge-x" aria-hidden>VS</span>
          <div className="tchallenge-bird"><Sprite species={sp} parts={sighting.sprite?.parts} armor={lookOfSighting(sp, sighting)} scale={2} mode="idle" /></div>
        </div>
        <b className="tchallenge-title">{who} wants a Field Trial</b>
        <span className="small muted">{WANDERER_PERSONA[who]?.title}</span>
        <p className="tchallenge-line">“{(WANDERER_PERSONA[who]?.line ?? 'They spotted your new {new}!').replace(/\{new\}/g, sp.common)}”</p>
        <div className="tchallenge-row">
          <button className="btn ghost" onClick={() => { sfx.back(); clearChallenge(); }}>Not now</button>
          <button className="btn primary" onClick={() => { playClip('tStart'); clearChallenge(); nav.open({ name: 'trials', wild: sighting.id }); }}>Battle!</button>
        </div>
      </div>
    </div>
  );
}
