import { useMemo, useState } from 'react';
import { countries, statesOf, locateState, getRegion, Country } from '../../data/geo';
import { sfx } from '../../app/audio';
import { Icon } from '../components';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Country → state/province picker for any place on Earth. */
export function RegionPicker({ value, onPick, compact }: { value?: string; onPick: (code: string) => void; compact?: boolean }) {
  const all = useMemo(() => countries(), []);
  const [cc, setCc] = useState<string | null>(value ? value.split('-')[0] : null);
  const [step, setStep] = useState<'country' | 'state'>(value && value.includes('-') ? 'state' : 'country');
  const [q, setQ] = useState('');
  const [geo, setGeo] = useState('');
  const localeCc = (navigator.language.split('-')[1] ?? '').toUpperCase();

  const useLocation = () => {
    if (!navigator.geolocation) { setGeo('Location is not available here — pick from the list.'); return; }
    setGeo('Finding your state…');
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        // rounded to ~1 km for the lookup; nothing is stored except the region code
        const r = await locateState(p.coords.latitude, p.coords.longitude);
        if (!r) { setGeo('Could not match your location. Pick from the list.'); return; }
        setGeo(''); sfx.select(); onPick(r.code);
      },
      () => setGeo('Location permission was declined. Pick from the list instead.'),
      { timeout: 10000, maximumAge: 600000 },
    );
  };

  const search = (
    <div className="row" style={{ gap: 8 }}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={step === 'country' ? 'Search countries' : 'Search states and provinces'}
        placeholder={step === 'country' ? 'Search 250 countries…' : 'Search states, provinces, regions…'}
        style={{ flex: 1, minHeight: 48, padding: '8px 12px', background: 'var(--well)', border: '2px solid var(--smoke)', borderRadius: 0, fontSize: 16 }} />
    </div>
  );

  if (step === 'country' || !cc) {
    const list = all.filter((c) => !q || norm(`${c.name} ${c.code}`).includes(norm(q)));
    const top = !q ? all.filter((c) => c.code === localeCc) : [];
    const row = (c: Country) => (
      <li key={c.code}>
        <button className="srow" onClick={() => { sfx.select(); setCc(c.code); setQ(''); if (statesOf(c.code).length) setStep('state'); else onPick(c.code); }}>
          <span style={{ fontSize: 26, width: 34, textAlign: 'center' }} aria-hidden>{c.flag}</span>
          <span className="grow name">{c.name}</span>
          <span className="small muted">{statesOf(c.code).length ? `${statesOf(c.code).length} regions ›` : ''}</span>
        </button>
      </li>
    );
    return (
      <div className="col" style={{ gap: 10, minHeight: 0 }}>
        <button className="btn primary block" onClick={useLocation}><Icon name="map" size={18} color="var(--accent-ink)" /> Use my location</button>
        {geo && <p className="small muted" role="status" style={{ margin: 0 }}>{geo}</p>}
        {search}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: compact ? '46vh' : undefined }} className={compact ? 'screen' : undefined}>
          {top.length > 0 && <li className="label" style={{ padding: '6px 0' }}>Suggested</li>}
          {top.map(row)}
          {top.length > 0 && <li className="label" style={{ padding: '6px 0' }}>All countries</li>}
          {list.map(row)}
          {!list.length && <li className="small muted">No country matches “{q}”.</li>}
        </ul>
      </div>
    );
  }

  const c = all.find((x) => x.code === cc)!;
  const states = statesOf(cc).filter((s) => !q || norm(s.name).includes(norm(q)));
  return (
    <div className="col" style={{ gap: 10 }}>
      <button className="srow" onClick={() => { sfx.back(); setStep('country'); setQ(''); }}>
        <Icon name="back" size={18} /><span style={{ fontSize: 26 }} aria-hidden>{c.flag}</span><span className="grow name">{c.name}</span><span className="small muted">Change</span>
      </button>
      {search}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {!q && (
          <li><button className="srow" onClick={() => { sfx.select(); onPick(cc); }}>
            <span className="grow"><span className="name">All of {c.name}</span><br /><span className="small muted">Use the whole country</span></span>
            {value === cc && <span style={{ color: 'var(--accent)' }}>●</span>}
          </button></li>
        )}
        {states.map((s) => (
          <li key={s.code}>
            <button className="srow" onClick={() => { sfx.select(); onPick(s.code); }} aria-pressed={value === s.code}>
              <span className="grow name" style={{ color: value === s.code ? 'var(--accent)' : undefined }}>{s.name}</span>
              <span className="px small muted">{s.iso}</span>
            </button>
          </li>
        ))}
        {!states.length && <li className="small muted">Nothing matches “{q}”.</li>}
      </ul>
    </div>
  );
}

export { getRegion };
