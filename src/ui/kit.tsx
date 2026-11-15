import { FeatherIcon } from './FeatherIcon';
import { useNav } from './nav';
// Shared layout pieces so every tab looks and behaves the same.
import { ReactNode } from 'react';
import { Icon } from './components';
import { useGame } from '../app/store';
import { sfx } from '../app/audio';

/** Feathers balance: the game's currency, always in the same place. */
export function FeatherChip({ label = true }: { label?: boolean }) {
  const f = useGame((s) => s.feathers);
  const nav = useNav();
  return (
    <button className="chip feather-chip" aria-label={`You have ${f} Feathers, the in-game money. Open Merlin's Shop`} onClick={() => nav.open({ name: 'shop' })}>
      <FeatherIcon size={14} /><span className="num">{f}</span>{label && <span className="feather-word">Feathers</span>}
    </button>
  );
}

/** One header for every tab: title on the left, actions on the right. */
export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-head-row">
        <h1>{title}</h1>
        <div className="row" style={{ gap: 6, flex: 'none' }}>{right}</div>
      </div>
      {sub && <div className="page-sub">{sub}</div>}
    </header>
  );
}

/** Pixel segmented control for switching sections inside a tab. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; badge?: number | boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className="seg-btn" onClick={() => { if (o.id !== value) { sfx.move(); onChange(o.id); } }}>
          {o.label}{o.badge ? <span className="seg-dot" aria-label="needs attention">{typeof o.badge === 'number' ? o.badge : ''}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A prominent call to action shown when something needs the player. */
export function Alert({ tone = 'warn', children, action }: { tone?: 'warn' | 'good' | 'info'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role="status">
      <div className="grow">{children}</div>
      {action}
    </div>
  );
}
