import { FeatherIcon } from '../FeatherIcon';
import { FoodIcon } from '../FoodIcon';
// Merlin's Shop: food and Snap Lenses, reachable from the Feather counter on every screen.
import { useState } from 'react';
import { useNav } from '../nav';
import { useGame, buyFood } from '../../app/store';
import { FOODS, type Food } from '../../core/pets';
import { LENSES } from '../../core/lenses';
import { LensList } from '../LensList';
import { Professor } from '../Characters';
import { Sheet, Icon } from '../components';
import { sfx, playClip } from '../../app/audio';

const SHOP_THANKS = ['A fine choice. Your birds will sing for it.', 'Into the bag it goes! Fill that feeder.', 'Splendid! The birds thank you.', 'Fresh seed, straight from my larder. Enjoy!'];

export function Shop() {
  const nav = useNav();
  const st = useGame((s) => s);
  const [shopCast, setShopCast] = useState(0);
  const [shopLine, setShopLine] = useState('Seeds, berries, mealworms and lenses! Fair prices, paid in Feather Coins.');
  return (
    <div className="overlay" style={{ background: 'transparent' }}>
      <Sheet onClose={nav.back} label="Merlin's Shop">
          <h3 className="mb8">Merlin's Shop</h3>
          <div className="wallet">
            <FeatherIcon size={36} />
            <div className="grow">
              <div className="wallet-amount"><span className="num">{st.feathers}</span> Feather Coins</div>
              <div className="small">Feather Coins are BirdlyQuest's money. Every price here is in Feather Coins.</div>
            </div>
          </div>
          <details className="earn mb8">
            <summary className="small">How do I earn Feather Coins?</summary>
            <ul className="small">
              <li>Discover a bird with your camera: <b>+12</b>, or <b>+20</b> for a new species (double for your very first bird)</li>
              <li>Finish a quest, a BirdDex goal or a mission</li>
              <li>Earn badges</li>
              <li>Tap each Aviary bird once a day: <b>+3</b></li>
              <li>Healthy Aviary birds bring you <b>+2</b> each per day</li>
            </ul>
          </details>
          <div className="npc mb8">
            <div key={shopCast} className={shopCast ? 'npc-hop' : ''}><Professor height={96} /></div>
            <div className="bubble"><b>Professor Merlin</b>{shopLine}</div>
          </div>
          <div className="section-title"><span>Bird food</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>Fills your Aviary feeder</span></div>
          {(Object.keys(FOODS) as Food[]).map((f) => (
            <div key={f} className="srow">
              <FoodIcon food={f} size={40} />
              <span className="grow"><span className="name">{FOODS[f].name}</span> <span className="small muted">· have {st.items[f]}</span><br /><span className="small muted">{FOODS[f].desc}</span></span>
              <button className="btn small primary price-btn" aria-label={`Buy ${FOODS[f].name} for ${FOODS[f].price} Feather Coins`} disabled={st.feathers < FOODS[f].price} onClick={() => { if (buyFood(f)) { playClip('buy'); setShopCast((k) => k + 1); setShopLine(SHOP_THANKS[(shopCast + 1) % SHOP_THANKS.length]); nav.toast(`Bought ${FOODS[f].name}`); } else { sfx.error(); setShopLine('Not enough Feather Coins, friend. Go and find some birds!'); } }}>
                <FeatherIcon size={14} /> {FOODS[f].price}
              </button>
            </div>
          ))}
          <div className="section-title"><span>Snap Lenses</span><span className="small muted" style={{ textTransform: 'none', fontFamily: 'var(--body)' }}>Better lenses boost Snap Power</span></div>
          <LensList onBought={(id) => { setShopCast((k) => k + 1); setShopLine(`The ${LENSES[id].name}! +${LENSES[id].power} Snap Power on every photo.`); nav.toast(`Bought ${LENSES[id].name}`); }}
            onEquip={(id) => setShopLine(`The ${LENSES[id].name} is ready. Go and find a bird!`)} />
          <button className="btn block" onClick={() => { nav.back(); nav.setTab('aviary'); }}>Go to my Aviary</button>
        </Sheet>
    </div>
  );
}
