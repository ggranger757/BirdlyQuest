import { FeatherIcon } from '../FeatherIcon';
import { FoodIcon } from '../FoodIcon';
// Woods' Shop (v1.28): tabs for Food, Lenses, Bird Homes, Feeders and Perches, with Professor Woods in an RPG dialogue box.
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useGame, buyFood, buyHome, ownsHome, setHome, buyDecor, ownsDecor, equipDecor } from '../../app/store';
import { FOODS, type Food } from '../../core/pets';
import { LENSES } from '../../core/lenses';
import { FEEDERS, PERCHES, DECOR, type DecorDef } from '../../core/decor';
import { SCENES, homePrice, paintHomeThumb } from '../../render/diorama';
import { paintDecorThumb } from '../../render/decor';
import { trainerLevel } from '../../core/xp';
import { LensList } from '../LensList';
import { MerlinSays } from '../MerlinSays';
import type { WoodsMood } from '../Characters';
import { Sheet } from '../components';
import { sfx, playClip } from '../../app/audio';

export type ShopTab = 'food' | 'lenses' | 'homes' | 'feeders' | 'perches';
type Tab = ShopTab;
const TABS: { id: Tab; label: string; hello: string }[] = [
  { id: 'food', label: 'Food', hello: 'Seeds, berries and mealworms! Fill your feeder and your birds stay happy.' },
  { id: 'lenses', label: 'Lenses', hello: 'Snap Lenses! Each one adds Snap Power to your photos, and they look rather dashing.' },
  { id: 'homes', label: 'Homes', hello: 'New Bird Homes open up as you level up. Buy one and your Aviary moves in.' },
  { id: 'feeders', label: 'Feeders', hello: 'Fifty feeders, from humble tubes to grand towers. Your birds eat from the one you hang.' },
  { id: 'perches', label: 'Perches', hello: 'Fences, statues, ancient ruins, glowing crystals… Birds will land on whichever perch you set out.' },
];
const THANKS = ['A fine choice. Your birds will sing for it.', 'Wonderful! The birds thank you.', 'Into the bag it goes!', 'Excellent taste, my friend.'];

function Thumb({ paint, w = 44, h = 44 }: { paint: (c: HTMLCanvasElement) => void; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paint(ref.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="pix shop-thumb" style={{ width: w, height: h }} aria-hidden />;
}

export function Shop({ tab: startTab = 'food' }: { tab?: ShopTab }) {
  const nav = useNav();
  const st = useGame((s) => s);
  const lv = trainerLevel(st.xp).level;
  const [tab, setTab] = useState<Tab>(startTab);
  const [cast, setCast] = useState(0);
  const [line, setLine] = useState(TABS.find((t) => t.id === startTab)!.hello);
  const [showEarn, setShowEarn] = useState(false);
  const [mood, setMood] = useState<WoodsMood>('curious');
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
        <Thumb w={112} h={112} paint={(c) => paintDecorThumb(c, d)} />
        <span className="dcard-name">{d.colourway}</span>
        {owned ? (
          <button className="btn small block" disabled={inUse} onClick={() => { sfx.select(); equipDecor(d.kind, d.id); setLine(`The ${d.name} is up in your Aviary. Lovely!`); }}>{inUse ? 'In use' : 'Use'}</button>
        ) : locked ? <span className="btn small block lens-locked">🔒 Lv {d.level}</span>
          : priceBtn(d.price, d.name, () => { if (buyDecor(d.id)) { thank(`The ${d.name}! I’ve put it up in your Aviary.`); nav.toast(`Bought ${d.name}`); } else broke(); })}
      </div>
    );
  };
  const decorList = (list: DecorDef[]) => {
    // grouped by design, cheapest first
    const groups = new Map<string, DecorDef[]>();
    for (const d of list) { const k = d.design; groups.set(k, [...(groups.get(k) ?? []), d]); }
    return [...groups.entries()].map(([g, items]) => (
      <div key={g} className="shop-group">
        <div className="section-title"><span>{g}</span><span className="small muted">{lv < items[0].level ? `🔒 Lv ${items[0].level}` : `${items.filter((d) => ownsDecor(st, d.id)).length}/${items.length} owned`}</span></div>
        <p className="small muted shop-desc">{items[0].desc}</p>
        <div className="dgrid">{items.map(decorCard)}</div>
      </div>
    ));
  };

  return (
    <div className="overlay" style={{ background: 'transparent' }}>
      <Sheet onClose={nav.back} label="Woods' Shop">
        <div className="shop-head">
          <h3>Woods' Shop</h3>
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
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`shop-tab ${tab === t.id ? 'on' : ''}`} onClick={() => { sfx.move(); setTab(t.id); setMood('curious'); setLine(t.hello); }}>{t.label}</button>
          ))}
        </div>

        {tab === 'food' && (Object.keys(FOODS) as Food[]).map((f) => (
          <div key={f} className="srow">
            <FoodIcon food={f} size={40} />
            <span className="grow"><span className="name">{FOODS[f].name}</span> <span className="small muted">· have {st.items[f]}</span><br /><span className="small muted">{FOODS[f].desc}</span></span>
            {priceBtn(FOODS[f].price, FOODS[f].name, () => { if (buyFood(f)) { thank(); nav.toast(`Bought ${FOODS[f].name}`); } else broke(); })}
          </div>
        ))}
        {tab === 'lenses' && (
          <LensList onBought={(id) => { thank(`The ${LENSES[id].name}! +${LENSES[id].power} Snap Power on every photo.`); nav.toast(`Bought ${LENSES[id].name}`); }}
            onEquip={(id) => setLine(`The ${LENSES[id].name} is ready. Go and find a bird!`)} />
        )}
        {tab === 'homes' && Object.values(SCENES).slice().sort((a, b) => a.level - b.level || homePrice(a.id) - homePrice(b.id)).map((sc) => {
          const owned = ownsHome(st, sc.id), locked = !owned && lv < sc.level, on = st.diorama.home === sc.id, price = homePrice(sc.id);
          return (
            <div key={sc.id} className={`srow ${locked ? 'locked' : ''} ${on ? 'on' : ''}`}>
              <Thumb w={72} h={40} paint={(c) => { void paintHomeThumb(c, sc.id, 72); }} />
              <span className="grow"><span className="name">{sc.label}</span>{on && <span className="small" style={{ color: 'var(--accent)' }}> · your home</span>}<br /><span className="small muted">{owned ? 'Owned' : locked ? `Unlocks at Lv ${sc.level}` : 'Ready to buy'}</span></span>
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
        <button className="btn block mt16" onClick={() => { nav.back(); nav.setTab('aviary'); }}>Go to my Aviary</button>
      </Sheet>
    </div>
  );
}
