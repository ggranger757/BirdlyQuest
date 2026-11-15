import { useEffect, useState } from 'react';
import { useGame, shiftBadgeQueue } from '../app/store';
import { BADGES, TIER_FEATHERS } from '../core/badges';
import { BadgeIcon } from './game';
import { playClip, haptic } from '../app/audio';

const TIER_COL: Record<string, string> = { bronze: '#C2622F', silver: '#B6C0C9', gold: '#F2C14E', platinum: '#9FD3E0' };
// lighter versions for text on the dark card (WCAG AA)
const TIER_TEXT: Record<string, string> = { bronze: 'var(--tier-bronze)', silver: 'var(--tier-silver)', gold: 'var(--tier-gold)', platinum: 'var(--tier-platinum)' };

/** "Badge earned!" moment for achievements earned outside the discovery sequence. */
export function BadgePopup({ blocked }: { blocked: boolean }) {
  const id = useGame((s) => s.badgeQueue[0]);
  const b = id ? BADGES.find((x) => x.id === id) : undefined;
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [id]);
  useEffect(() => { if (b && !blocked) { playClip('levelUp', { duck: true }); haptic([15, 40, 15, 40, 30]); } }, [b?.id, blocked]);
  useEffect(() => { if (id && !b) shiftBadgeQueue(); }, [id]);
  useEffect(() => {
    if (!b || blocked) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); shiftBadgeQueue(); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [b?.id, blocked]);
  if (!b || blocked) return null;
  return (
    <div className="badge-pop" role="dialog" aria-modal="true" aria-label={`Badge earned: ${b.name}`} onClick={shiftBadgeQueue}>
      <div className="badge-pop-card" onClick={(e) => e.stopPropagation()} style={{ borderColor: TIER_COL[b.tier] }}>
        <div className="label" style={{ color: TIER_TEXT[b.tier] }}>Badge earned!</div>
        <div className="badge-pop-icon"><BadgeIcon icon={b.icon} earned size={128} label={b.name} /></div>
        <h2 style={{ fontSize: 18 }}>{b.name}</h2>
        <p className="small" style={{ margin: '6px 0' }}>{b.desc}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <span className="chip" style={{ background: TIER_COL[b.tier], color: '#0A0C0F', borderColor: '#000' }}>{b.tier}</span>
          <span className="chip">+{TIER_FEATHERS[b.tier]} Feathers</span>
        </div>
        <div className="row mt16" style={{ gap: 8 }}>
          <button className="btn grow" onClick={async () => {
            const text = `I just earned the ${b.name} badge in BirdlyQuest! ${b.desc}`;
            try { if (navigator.share) await navigator.share({ title: 'BirdlyQuest', text }); else { await navigator.clipboard.writeText(text); setCopied(true); } } catch { /* cancelled */ }
          }}>{copied ? 'Copied!' : 'Share'}</button>
          <button className="btn primary grow" onClick={shiftBadgeQueue}>Nice!</button>
        </div>
      </div>
    </div>
  );
}
