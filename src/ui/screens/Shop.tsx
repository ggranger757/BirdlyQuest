import { FeatherIcon } from '../FeatherIcon';
// Woods' Shop (v1.35): no longer a separate sheet. It lives inside the Aviary's "Feeder & Shop" section, right under
// the feeder, so buying and using things is one tap and never leaves the Aviary. Food is bought and poured on the
// feeder card itself; this panel sells feeders, perches, homes and lenses.
import { useEffect, useRef, useState } from 'react';
import { useNav, type Nav } from '../nav';
import { useGame, buyHome, ownsHome, setHome, buyDecor, ownsDecor, equipDecor } from '../../app/store';
import { LENSES } from '../../core/lenses';
import { FEEDERS, PERCHES, DECOR, type DecorDef } from '../../core/decor';
import { SCENES, homePrice, paintHomeThumb } from '../../render/diorama';
import { paintDecorThumb } from '../../render/decor';
import { trainerLevel } from '../../core/xp';
import { LensList } from '../LensList';
import { MerlinSays } from '../MerlinSays';
import type { WoodsMood } from '../Characters';
import { sfx, playClip } from '../../app/audio';

export type ShopTab = 'food' | 'lenses' | 'homes' | 'feeders' | 'perches';
type PanelTab = Exclude<ShopTab, 'food'>;
const TABS: { id: PanelTab; label: string; hello: string }[] = [
  { id: 'feeders', label: 'Feeders', hello: 'Fifty feeders, from humble tubes to grand towers. Tap one to hang it.' },
  { id: 'perches', label: 'Perches', hello: 'Fences, statues, ruins, glowing crystals… Birds land on whichever perch you set out.' },
  { id: 'homes', label: 'Homes', hello: 'New Bird Homes open up as you level up. Buy one and your Aviary moves in.' },
  { id: 'lenses', label: 'Lenses', hello: 'Snap Lenses add Snap Power to your photos, and they look rather dashing.' },
];
const THANKS = ['A fine choice. Your birds will sing for it.', 'Wonderful! The birds thank you.', 'Into the bag it goes!', 'Excellent taste, my friend.'];

/* ── opening the shop from anywhere: jump to the Aviary's Feeder & Shop section ── */
let pending: { tab?: ShopTab } | null = null;
const listeners = new Set<() => void>();
/** Open Woods' Shop: closes any open screen, goes to the Aviary, and shows the shop (or the feeder, for food). */
export function openShop(nav: Nav, tab?: ShopTab) {
  pending = { tab };
  nav.closeAll(); nav.setTab('aviary');
  listeners.forEach((f) => f());
}
/** The Aviary calls this to hear shop requests, including one made just before it appeared. */
export function useShopRequest(cb: (tab?: ShopTab) => void) {
  const ref = useRef(cb); ref.current = cb;
  useEffect(() => {
    const run = () => { if (pending) { const p = pending; pending = null; ref.current(p.tab); } };
    run(); listeners.add(run);
    return () => { listeners.delete(run); };
  }, []);
}
/** Old route (`nav.open({ name: 'shop' })`) still works: it forwards to the Aviary. */
export function Shop({ tab }: { tab?: ShopTab }) {
  const nav = useNav();
  useEffect(() => { openShop(nav, tab); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Thumb({ paint, w = 44, h = 44 }: { paint: (c: HTMLCanvasElement) => void; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paint(ref.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="pix shop-thumb" style={{ width: w, height: h }} aria-hidden />;
}

/** The shop itself, shown inline in the Aviary. */
export function ShopPanel({ tab, onTab }: { tab: PanelTab; onTab: (t: PanelTab) => void }) {
  const nav = useNav();
  const st = useGame((s) => s);
  const lv = trainerLevel(st.xp).level;
  const [cast, setCast] = useState(0);
  const [line, setLine] = useState(TABS.find((t) => t.id === tab)!.hello);
  const [showEarn, setShowEarn] = useState(false);
  const [mood, setMood] = useState<WoodsMood>('curious');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setLine(TABS.find((t) => t.id === tab)!.hello); setMood('curious'); }, [tab]);
  // each design row scrolls sideways so the item you're using is in view
  useEffect(() => {
    listRef.current?.querySelectorAll<HTMLElement>('.dstrip').forEach((s) => {
      const on = s.querySelector<HTMLElement>('.dcard.on'); if (on) s.scrollLeft = Math.max(0, on.offsetLeft - s.offsetLeft - 8);
    });
  }, [tab]);
  const thank = (t?: string) => { playClip('buy'); setCast((k) => k + 1); setMood('delighted'); setLine(t ?? THANKS[(cast + 1) % THANKS.length]); };
  const broke = () => { sfx.error(); setMood('focused'); setLine('Not enough Feather Coins, friend. Go and find some birds!'); };
  const priceBtn = (price: number, label: string, onBuy: () => void) => (
    <button className="btn small primary price-btn" aria-label={`Buy ${label} for ${price} Feather Coins`} disabled={st.feathers < price} onClick={onBuy}>
      <FeatherIcon size={14} /> {price}
    </button>
  );
  const decorCard = (d: DecorDef) => {
    const owned = ownsDecor(st, d.id), inUse = st.diorama[d.kind] === d.id || (d.kind === 'feeder' && !st.diorama.feeder && owned && d.price === 0), locked = !owned && lv < d.level;
    return (
      <div key={d.id} className={`dcard ${locked ? 'locked' : ''} ${inUse ? 'on' : ''}`}>
        <span className="dcard-art"><Thumb w={84} h={84} paint={(c) => paintDecorThumb(c, d)} /></span>
        <span className="dcard-name">{d.colourway}</span>
        {inUse ? <span className="dcard-inuse">✓ In use</span>
          : owned ? <button className="btn small block" onClick={() => { sfx.select(); equipDecor(d.kind, d.id); setLine(`The ${d.name} is up in your Aviary. Lovely!`); }} aria-label={`Use ${d.name}`}>Use</button>
            : locked ? <span className="btn small block lens-locked">🔒 Lv {d.level}</span>
              : priceBtn(d.price, d.name, () => { if (buyDecor(d.id)) { thank(`The ${d.name}! I’ve put it up in your Aviary.`); nav.toast(`Bought ${d.name}`); } else broke(); })}
      </div>
    );
  };
  const decorList = (list: DecorDef[]) => {
    const groups = new Map<string, DecorDef[]>();
    for (const d of list) groups.set(d.design, [...(groups.get(d.design) ?? []), d]);
    return [...groups.entries()].map(([g, items]) => (
      <div key={g} className="shop-group">
        <div className="section-title"><span>{g}</span><span className="small muted">{lv < items[0].level ? `🔒 Lv ${items[0].level}` : `${items.filter((d) => ownsDecor(st, d.id)).length}/${items.length} owned`}</span></div>
        <p className="small muted shop-desc">{items[0].desc}</p>
        <div className="dstrip">{items.map(decorCard)}</div>
      </div>
    ));
  };

  return (
    <section className="shop-panel" aria-label="Woods' Shop">
      <div className="shop-head">
        <h3 className="shop-panel-title">Woods' Shop</h3>
        <button className="wallet-chip" onClick={() => setShowEarn((v) => !v)} aria-expanded={showEarn} aria-label={`${st.feathers} Feather Coins. How to earn more`}>
          <FeatherIcon size={18} /> <b className="num">{st.feathers}</b> <span className="small muted">{showEarn ? '▴' : '▾'}</span>
        </button>
      </div>
      {showEarn && (
        <ul className="small shop-earn">
          <li>Log a bird with your camera: <b>+12</b>, <b>+20</b> for a new species. Rarer birds pay up to <b>×6</b>.</li>
          <li>Win Field Trials, finish quests, goals and missions, earn badges.</li>
          <li>Tap each Aviary bird once a day (<b>+3</b>); healthy Aviary birds bring <b>+2</b> each per day.</li>
        </ul>
      )}
      <MerlinSays text={line} cast={cast} mood={mood} />
      <div className="shop-tabs" role="tablist" aria-label="Shop sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`shop-tab ${tab === t.id ? 'on' : ''}`} onClick={() => { sfx.move(); onTab(t.id); }}>{t.label}</button>
        ))}
      </div>
      <div ref={listRef}>
        {tab === 'lenses' && (
          <LensList onBought={(id) => { thank(`The ${LENSES[id].name}! +${LENSES[id].power} Snap Power on every photo.`); nav.toast(`Bought ${LENSES[id].name}`); }}
            onEquip={(id) => setLine(`The ${LENSES[id].name} is ready. Go and find a bird!`)} />
        )}
        {tab === 'homes' && Object.values(SCENES).slice().sort((a, b) => a.level - b.level || homePrice(a.id) - homePrice(b.id)).map((sc) => {
          const owned = ownsHome(st, sc.id), locked = !owned && lv < sc.level, on = st.diorama.home === sc.id, price = homePrice(sc.id);
          return (
            <div key={sc.id} className={`srow ${locked ? 'locked' : ''} ${on ? 'on' : ''}`}>
              <Thumb w={72} h={40} paint={(c) => { void paintHomeThumb(c, sc.id, 72); }} />
              <span className="grow"><span className="name">{sc.label}</span>{on && <span className="small" style={{ color: 'var(--accent)' }}> · your home</span>}<br /><span className="small muted">{owned ? 'Owned' : locked ? `Unlocks at Lv ${sc.level}` : 'For sale'}</span></span>
              {owned ? <button className="btn small" disabled={on} onClick={() => { sfx.select(); setHome(sc.id); setLine(`Your birds are settling into ${sc.label}.`); }}>{on ? 'Home' : 'Move'}</button>
                : locked ? <span className="btn small lens-locked">🔒 Lv {sc.level}</span>
                  : priceBtn(price, sc.label, () => { if (buyHome(sc.id)) { thank(`${sc.label} is yours! Your birds have moved in.`); nav.toast(`Moved to ${sc.label}`); } else broke(); })}
            </div>
          );
        })}
        {tab === 'feeders' && decorList(FEEDERS)}
        {tab === 'perches' && (
          <>
            {st.diorama.perch && DECOR[st.diorama.perch] && <button className="btn ghost small block mb8" onClick={() => { equipDecor('perch', undefined); setLine('Perch packed away. Your birds will use the branches.'); }}>Take down my perch</button>}
            {decorList(PERCHES)}
          </>
        )}
      </div>
    </section>
  );
}
