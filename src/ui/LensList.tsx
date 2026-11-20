import { useState } from 'react';
import { useGame, buyLens, equipLens } from '../app/store';
import { LENSES, LENS_ORDER, LENS_TIERS, TIER_META, type LensId, type LensTier } from '../core/lenses';
import { trainerLevel } from '../core/xp';
import { Capsule } from './game';
import { FeatherIcon } from './FeatherIcon';
import { sfx, playClip } from '../app/audio';

/** Every Snap Lens, grouped by tier: what it does, its Snap Power boost, and buy / use buttons. */
export function LensList({ onBought, onEquip }: { onBought?: (id: LensId) => void; onEquip?: (id: LensId) => void }) {
  const st = useGame((s) => s);
  const lv = trainerLevel(st.xp).level;
  const [tier, setTier] = useState<LensTier | 'owned'>(() => (st.lenses.length > 1 ? 'owned' : 'common'));
  const ids = LENS_ORDER.filter((id) => (tier === 'owned' ? st.lenses.includes(id) : LENSES[id].tier === tier));
  return (
    <div className="lens-list">
      <div className="lens-tabs hscroll" role="tablist" aria-label="Lens tiers">
        {(['owned', ...LENS_TIERS] as const).map((t) => {
          const n = t === 'owned' ? st.lenses.length : LENS_ORDER.filter((id) => LENSES[id].tier === t).length;
          const label = t === 'owned' ? 'Yours' : TIER_META[t].label;
          return (
            <button key={t} role="tab" aria-selected={tier === t} className="filter" aria-pressed={tier === t} onClick={() => { sfx.move(); setTier(t); }}>
              {label} <span className="muted">{n}</span>
            </button>
          );
        })}
      </div>
      {tier !== 'owned' && lv < TIER_META[tier].level && (
        <p className="small lens-gate">🔒 {TIER_META[tier].label} lenses unlock at <b>Lv {TIER_META[tier].level}</b>. You're Lv {lv}: discover more birds to level up.</p>
      )}
      {ids.map((id) => {
        const l = LENSES[id]; const owned = st.lenses.includes(id); const on = st.lens === id; const locked = !owned && lv < l.level;
        const short = !owned && !locked && st.feathers < l.price;
        return (
          <div key={id} className={`srow lens-row ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}>
            <span className="lens-ico" aria-hidden><Capsule size={36} lens={id} glow={on} /></span>
            <span className="grow">
              <span className="name">{l.name}</span> <span className="tier-tag" style={{ borderColor: TIER_META[l.tier].color }}>{TIER_META[l.tier].label}</span>{on && <span className="small" style={{ color: 'var(--accent)' }}> · in use</span>}
              <br /><span className="lens-power">{l.power ? `+${l.power} Snap Power` : 'No Snap Power boost'}</span>
              <br /><span className="small muted">{l.desc}</span>
              {short && <><br /><span className="small" style={{ color: 'var(--oriole)' }}>Need {l.price - st.feathers} more Feather Coins</span></>}
            </span>
            {owned ? (
              <button className="btn small" disabled={on} aria-label={on ? `${l.name} in use` : `Use ${l.name}`} onClick={() => { equipLens(id); sfx.select(); onEquip?.(id); }}>{on ? 'Using' : 'Use'}</button>
            ) : locked ? (
              <span className="btn small lens-locked" aria-label={`${l.name} unlocks at level ${l.level}`}>🔒 Lv {l.level}</span>
            ) : (
              <button className="btn small primary price-btn" disabled={short} aria-label={`Buy ${l.name} for ${l.price} Feather Coins`}
                onClick={() => { if (buyLens(id)) { playClip('buy'); onBought?.(id); } else sfx.error(); }}>
                <FeatherIcon size={14} /> {l.price}
              </button>
            )}
          </div>
        );
      })}
      {tier === 'owned' && ids.length <= 1 && <p className="small muted">Buy more lenses from the other tabs. Each one adds Snap Power and its own recording effect.</p>}
    </div>
  );
}
