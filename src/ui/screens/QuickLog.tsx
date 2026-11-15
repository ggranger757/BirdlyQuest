// "Saw it, no photo": log a bird that flew off. Small reward, and the BirdDex marks it as seen (not discovered).
import { useMemo, useState } from 'react';
import { useNav } from '../nav';
import { useGame, fileCatch } from '../../app/store';
import { getRegion } from '../../data/geo';
import { regionEntries } from '../../data/provider';
import { likelyNow } from '../../core/rarity';
import { BirdThumb, Types } from '../game';
import { Professor } from '../Characters';
import { sfx } from '../../app/audio';
import type { Species } from '../../data/types';

export function QuickLog() {
  const nav = useNav();
  const st = useGame((s) => s);
  const region = getRegion(st.region);
  const likely = useMemo(() => likelyNow(region, new Date(), st.habitat).slice(0, 8).map((l) => l.sp), [st.region]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const pool = q ? regionEntries(st.region).map((e) => e.sp).filter((s) => `${s.common} ${s.sci}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40) : likely;
  const log = async (sp: Species) => {
    if (busy) return; setBusy(true); sfx.select();
    await fileCatch({ speciesId: sp.id, verification: 'self-reported', mode: 'seen', habitat: st.habitat, analysis: null, photo: null });
    sfx.page(); nav.closeAll(); nav.toast(`Logged a ${sp.common}! Photograph one to discover it and bring it home.`);
  };
  return (
    <div className="overlay">
      <div className="topbar"><button className="icon-btn" onClick={nav.back} aria-label="Back">◀</button><h2>Saw it, no photo</h2></div>
      <div className="screen">
        <div className="npc mb8"><Professor height={96} /><div className="bubble"><b>Professor Merlin</b>Birds fly off all the time! Log what you saw for a few Feathers. To discover it for your BirdDex and Aviary, you'll still need a photo.</div></div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${region.name} birds…`} aria-label="Search birds"
          style={{ width: '100%', minHeight: 48, padding: '8px 12px', background: 'var(--well)', border: '2px solid var(--smoke)', fontSize: 16 }} />
        <div className="label mt16 mb8">{q ? 'Matches' : 'Likely right now'}</div>
        {pool.map((sp) => (
          <button key={sp.id} className="srow" style={{ width: '100%', textAlign: 'left' }} disabled={busy} onClick={() => log(sp)}>
            <BirdThumb sp={sp} size={48} />
            <span className="grow"><span className="name">{sp.common}</span><br /><Types sp={sp} /></span>
            <span className="small" style={{ color: 'var(--accent)' }}>Log</span>
          </button>
        ))}
        {!pool.length && <p className="small muted">No match in {region.name}.</p>}
      </div>
    </div>
  );
}
