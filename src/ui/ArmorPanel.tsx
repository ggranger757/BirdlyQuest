// A bird's armor: the theme, every piece (worn or still to come) with its ability, and the dye picker (v1.37).
import { setArmorDye } from '../app/store';
import { THEMES, DYES, DYE_IDS } from '../core/armor';
import { setOfSighting } from '../core/gear';
import type { Species } from '../data/types';
import type { Sighting } from '../core/model';
import { sfx } from '../app/audio';

export function ArmorPanel({ sp, x }: { sp: Species; x: Sighting }) {
  const set = setOfSighting(sp, x);
  const th = THEMES[set.theme];
  const worn = set.pieces.filter((p) => p.owned).length;
  const next = set.pieces.find((p) => !p.owned);
  const dye = x.armorDye ?? 'theme';
  return (
    <section className="panel armor-panel mt8" aria-label="Armor">
      <div className="armor-head">
        <h3 className="armor-title">Armor <span className="armor-theme" style={{ borderColor: th.glow }}>{th.label}</span></h3>
        <span className="num small">{worn}/{set.pieces.length}</span>
      </div>
      <p className="small muted armor-blurb">
        {th.blurb} {worn === 0 ? 'Level this bird up to earn its first piece.' : ''}
        {next ? ` Next: ${next.label} in ${next.at - set.ups} level-up${next.at - set.ups === 1 ? '' : 's'}.` : ' Every piece earned!'}
        {(x.level ?? 5) >= 50 ? ' Max level reached.' : ''}
      </p>
      <ul className="armor-list">
        {set.pieces.map((p) => (
          <li key={p.slot} className={`armor-piece ${p.owned ? 'own' : 'locked'}`}>
            <span className="armor-slot">{p.label}</span>
            <span className="armor-name">{p.owned ? p.name : `🔒 After ${p.at} level-ups`}</span>
            <span className="armor-ability"><b>{p.abilityName}:</b> {p.ability}</span>
          </li>
        ))}
      </ul>
      <div className="armor-dyes">
        <span className="label">Colour</span>
        {worn === 0 ? <span className="small muted">Unlocks with the first piece.</span> : (
          <div className="armor-swatches" role="radiogroup" aria-label="Armor colour">
            {DYE_IDS.map((id) => {
              const m = DYES[id].metal ?? th.metal, t = DYES[id].trim ?? th.trim;
              return (
                <button key={id} role="radio" aria-checked={dye === id} aria-label={DYES[id].label} title={DYES[id].label} className={`dye ${dye === id ? 'on' : ''}`}
                  onClick={() => { sfx.select(); setArmorDye(x.id, id); }}
                  style={{ background: `linear-gradient(180deg, ${m[1]} 0 30%, ${m[0]} 30% 70%, ${m[2]} 70%)`, boxShadow: `inset 0 -3px 0 ${t}` }} />
              );
            })}
          </div>
        )}
        {worn > 0 && <span className="small muted armor-dye-name">{DYES[dye].label}</span>}
      </div>
    </section>
  );
}
