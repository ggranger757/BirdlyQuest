import { FeatherIcon } from '../FeatherIcon';
// Feeder & Shop (v1.36). One page in two parts, after cozy and RPG shops:
//  1. a slim feeder bar: picture, level, and one chip per food that pours a bag in with one tap (Neko Atsume's bowl);
//  2. one shop grid with category chips (Stardew's grid + filters). Each feeder / perch design is ONE tile with its
//     colourways as swatches (Animal Crossing variations). Tapping a tile opens a single detail sheet with
//     Professor Woods, a big preview and ONE button that fits the item's state: Buy, Hang it, Move in, Use…
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav, type Nav } from '../nav';
import { useGame, buyHome, ownsHome, setHome, buyDecor, ownsDecor, equipDecor, buyFood, fillFeeder, buyLens, equipLens } from '../../app/store';
import { FOODS, FEEDER_CAP, type Food } from '../../core/pets';
import { LENSES, LENS_ORDER, TIER_META, type LensId } from '../../core/lenses';
import { FEEDERS, PERCHES, feederOf, type DecorDef } from '../../core/decor';
import { SCENES, homePrice, paintHomeThumb } from '../../render/diorama';
import { paintDecorThumb } from '../../render/decor';
import { trainerLevel } from '../../core/xp';
import { Professor, type WoodsMood } from '../Characters';
import { Capsule } from '../game';
import { FoodIcon } from '../FoodIcon';
import { Sheet } from '../components';
import { sfx, haptic, playClip } from '../../app/audio';

export type ShopTab = 'food' | 'lenses' | 'homes' | 'feeders' | 'perches';
type Cat = ShopTab;
const CATS: { id: Cat; label: string }[] = [
  { id: 'food', label: 'Food' }, { id: 'feeders', label: 'Feeders' }, { id: 'perches', label: 'Perches' }, { id: 'homes', label: 'Homes' }, { id: 'lenses', label: 'Lenses' },
];

/* ── opening the shop from anywhere: jump to the Aviary's Feeder & Shop page ── */
let pending: { tab?: ShopTab } | null = null;
const listeners = new Set<() => void>();
/** Open Woods' Shop: closes any open screen, goes to the Aviary and shows the Feeder & Shop page on that category. */
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

function Thumb({ paint, w, h, k }: { paint: (c: HTMLCanvasElement) => void; w: number; h: number; k: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paint(ref.current); }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="pix shop-thumb" style={{ width: w, height: h }} aria-hidden />;
}
const decorArt = (d: DecorDef, size: number) => <Thumb k={d.id} w={size} h={size} paint={(c) => paintDecorThumb(c, d)} />;
const homeArt = (id: string, w: number) => <Thumb k={id} w={w} h={Math.round(w * 0.56)} paint={(c) => { void paintHomeThumb(c, id, w); }} />;

type State = 'inuse' | 'owned' | 'buy' | 'locked';
interface Tile { key: string; name: string; art: (size: number) => ReactNode; state: State; tag: ReactNode; order: number }
const STATE_ORDER: Record<State, number> = { inuse: 0, owned: 1, buy: 2, locked: 3 };

/** The whole Feeder & Shop page. `cat` is controlled so other screens can open it on a category. */
export function FeederShop({ cat, onCat, onPoured, birds }: { cat: Cat; onCat: (c: Cat) => void; onPoured: () => void; birds: number }) {
  const nav = useNav();
  const st = useGame((s) => s);
  const lv = trainerLevel(st.xp).level;
  const [open, setOpen] = useState<string | null>(null);
  const fill = st.feeder.level / FEEDER_CAP;
  const feeder = feederOf(st.diorama.feeder);
  const pour = (f: Food) => {
    if (!(st.items[f] > 0)) { sfx.select(); onCat('food'); setOpen(`food:${f}`); return; }
    const n = fillFeeder(f);
    if (n) { sfx.page(); haptic(12); nav.toast(`Poured ${FOODS[f].name} into the feeder (+${n})`); setTimeout(onPoured, 600); } else nav.toast('The feeder is full.');
  };

  const price = (n: number) => <><FeatherIcon size={12} /> {n}</>;
  const tiles: Tile[] = useMemo(() => {
    const decorTiles = (list: DecorDef[]): Tile[] => {
      const groups = new Map<string, DecorDef[]>();
      for (const d of list) groups.set(d.design, [...(groups.get(d.design) ?? []), d]);
      return [...groups.entries()].map(([design, items]) => {
        const using = items.find((d) => st.diorama[d.kind] === d.id || (d.kind === 'feeder' && !st.diorama.feeder && d.price === 0));
        const owned = items.filter((d) => ownsDecor(st, d.id));
        const cheapest = Math.min(...items.filter((d) => !ownsDecor(st, d.id)).map((d) => d.price));
        const state: State = using ? 'inuse' : owned.length ? 'owned' : lv < items[0].level ? 'locked' : 'buy';
        const show = using ?? owned[0] ?? items[0];
        return {
          key: `${items[0].kind}:${design}`, name: design, art: (s) => decorArt(show, s), state, order: items[0].level * 1000 + items[0].price,
          tag: state === 'inuse' ? '✓ In use' : state === 'locked' ? `🔒 Lv ${items[0].level}` : state === 'owned' ? `${owned.length}/${items.length} owned` : <>from {price(cheapest)}</>,
        };
      });
    };
    switch (cat) {
      case 'food': return (Object.keys(FOODS) as Food[]).map((f, i) => ({
        key: `food:${f}`, name: FOODS[f].name, art: (s: number) => <FoodIcon food={f} size={Math.round(s * 0.62)} />, state: 'buy' as State, order: i,
        tag: <>{st.items[f] ? `×${st.items[f]} · ` : ''}{price(FOODS[f].price)}</>,
      }));
      case 'feeders': return decorTiles(FEEDERS);
      case 'perches': return decorTiles(PERCHES);
      case 'homes': return [
        { key: 'home:', name: 'Day & night', art: (s: number) => <span className="tile-homes">{homeArt('skyday', Math.round(s * 0.9))}</span>, state: (!st.diorama.home ? 'inuse' : 'owned') as State, order: -1, tag: !st.diorama.home ? '✓ In use' : 'Free' },
        ...Object.values(SCENES).map((sc) => {
          const owned = ownsHome(st, sc.id), state: State = st.diorama.home === sc.id ? 'inuse' : owned ? 'owned' : lv < sc.level ? 'locked' : 'buy';
          return { key: `home:${sc.id}`, name: sc.label, art: (s: number) => homeArt(sc.id, Math.round(s * 0.9)), state, order: sc.level * 1000 + homePrice(sc.id),
            tag: state === 'inuse' ? '✓ Home' : state === 'owned' ? 'Owned' : state === 'locked' ? `🔒 Lv ${sc.level}` : price(homePrice(sc.id)) };
        }),
      ];
      case 'lenses': return LENS_ORDER.map((id, i) => {
        const l = LENSES[id], owned = st.lenses.includes(id), state: State = st.lens === id ? 'inuse' : owned ? 'owned' : lv < l.level ? 'locked' : 'buy';
        return { key: `lens:${id}`, name: l.name, art: (s: number) => <Capsule size={Math.round(s * 0.55)} lens={id} glow={state === 'inuse'} />, state, order: i,
          tag: state === 'inuse' ? '✓ In use' : state === 'owned' ? 'Owned' : state === 'locked' ? `🔒 Lv ${l.level}` : price(l.price) };
      });
    }
  }, [cat, st, lv]);
  const sorted = cat === 'food' ? tiles : [...tiles].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.order - b.order);

  return (
    <div className="fshop">
      {/* 1 · the feeder */}
      <div className={`fbar ${fill <= 0.25 ? 'low' : ''}`}>
        <span className="fbar-art">{decorArt(feeder, 60)}</span>
        <div className="fbar-main">
          <div className="fbar-top"><b className="fbar-name">{feeder.name}</b><span className="num small">{st.feeder.level}/{FEEDER_CAP}</span></div>
          <div className="feeder-meter" role="meter" aria-label="Feeder level" aria-valuemin={0} aria-valuemax={FEEDER_CAP} aria-valuenow={st.feeder.level}>
            <i style={{ width: `${fill * 100}%`, background: fill > 0.25 ? 'var(--warbler)' : 'var(--oriole)' }} />
          </div>
          <div className="fbar-foods" role="group" aria-label="Tap a food to pour a bag in">
            {(Object.keys(FOODS) as Food[]).map((f) => {
              const have = st.items[f] ?? 0;
              return (
                <button key={f} className={`fchip ${have ? '' : 'none'}`} disabled={have > 0 && st.feeder.level >= FEEDER_CAP} onClick={() => pour(f)}
                  aria-label={have ? `Pour ${FOODS[f].name}, ${have} bags` : `${FOODS[f].name}: none, buy some`}>
                  <FoodIcon food={f} size={22} /><span className="num">{have ? `×${have}` : '+'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="fbar-hint small muted">
        {st.feeder.level === 0 ? 'Empty! Tap a food to pour it in.' : st.feeder.level >= FEEDER_CAP ? 'Full to the brim.' : `About ${Math.max(1, Math.round(st.feeder.level / Math.max(1, birds * 17)))} day(s) of food. Tap a food to pour a bag in.`}
      </p>

      {/* 2 · the shop */}
      <div className="fshop-cats" role="tablist" aria-label="Woods' Shop">
        {CATS.map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={`fcat ${cat === c.id ? 'on' : ''}`} onClick={() => { sfx.move(); onCat(c.id); }}>{c.label}</button>
        ))}
      </div>
      <div className="fgrid" role="tabpanel" aria-label={`${CATS.find((c) => c.id === cat)!.label} for sale`}>
        {sorted.map((t) => (
          <button key={t.key} className={`ftile s-${t.state}`} onClick={() => { sfx.select(); setOpen(t.key); }}
            aria-label={`${t.name}: ${typeof t.tag === 'string' ? t.tag : t.state === 'buy' ? 'for sale' : ''}. Open`}>
            <span className="ftile-art">{t.art(72)}</span>
            <span className="ftile-name">{t.name}</span>
            <span className="ftile-tag">{t.tag}</span>
          </button>
        ))}
      </div>
      {open && <ItemSheet itemKey={open} onClose={() => setOpen(null)} onPoured={onPoured} />}
    </div>
  );
}

/** One item, Woods beside it, and one button that does the right thing. */
function ItemSheet({ itemKey, onClose, onPoured }: { itemKey: string; onClose: () => void; onPoured: () => void }) {
  const nav = useNav();
  const st = useGame((s) => s);
  const lv = trainerLevel(st.xp).level;
  const [kind, id] = [itemKey.slice(0, itemKey.indexOf(':')), itemKey.slice(itemKey.indexOf(':') + 1)];
  const [mood, setMood] = useState<WoodsMood>('curious');
  const [said, setSaid] = useState<string | null>(null);
  const happy = (t: string) => { playClip('buy'); setMood('delighted'); setSaid(t); };
  const broke = (n: number) => { sfx.error(); setMood('focused'); setSaid(`You need ${n - st.feathers} more Feather Coins. Go and find some birds!`); };
  const coins = (n: number) => <span className="isheet-price"><FeatherIcon size={15} /> {n}</span>;

  // decor: pick a colourway (starts on the one in use, else one you own, else the cheapest)
  const variants = kind === 'feeder' ? FEEDERS.filter((d) => d.design === id) : kind === 'perch' ? PERCHES.filter((d) => d.design === id) : [];
  const [pick, setPick] = useState<string>(() => (variants.find((d) => st.diorama[d.kind] === d.id) ?? variants.find((d) => ownsDecor(st, d.id)) ?? variants[0])?.id ?? '');

  let art: ReactNode = null, title = '', meta: ReactNode = null, line = '', primary: ReactNode = null, secondary: ReactNode = null;
  if (kind === 'food') {
    const f = id as Food, have = st.items[f] ?? 0;
    art = <FoodIcon food={f} size={88} />; title = FOODS[f].name; line = `${FOODS[f].desc}. Birds eat the newest food first.`;
    meta = <>You have <b>{have}</b> · feeder {st.feeder.level}/{FEEDER_CAP}</>;
    primary = <button className="btn primary block" disabled={st.feathers < FOODS[f].price} onClick={() => { if (buyFood(f)) { happy('Into your bag it goes! Pour it in whenever you like.'); nav.toast(`Bought ${FOODS[f].name}`); } else broke(FOODS[f].price); }}>Buy a bag · {coins(FOODS[f].price)}</button>;
    secondary = <button className="btn block" disabled={!have || st.feeder.level >= FEEDER_CAP} onClick={() => { const n = fillFeeder(f); if (n) { sfx.page(); haptic(12); happy(`Poured in! +${n}. Your birds will be thrilled.`); setTimeout(onPoured, 600); } }}>{st.feeder.level >= FEEDER_CAP ? 'Feeder is full' : have ? `Pour one in (${have} left)` : 'Pour one in (none yet)'}</button>;
  } else if (kind === 'feeder' || kind === 'perch') {
    const d = variants.find((v) => v.id === pick) ?? variants[0];
    const owned = ownsDecor(st, d.id), using = st.diorama[d.kind] === d.id || (d.kind === 'feeder' && !st.diorama.feeder && d.price === 0), locked = !owned && lv < d.level;
    art = decorArt(d, 128); title = d.name; line = d.desc;
    meta = <>{variants.filter((v) => ownsDecor(st, v.id)).length}/{variants.length} colours owned</>;
    const verb = d.kind === 'feeder' ? 'Hang it' : 'Set it out';
    primary = using ? <button className="btn block" disabled>✓ In your Aviary</button>
      : owned ? <button className="btn primary block" onClick={() => { sfx.select(); equipDecor(d.kind, d.id); happy(`The ${d.name} is up in your Aviary. Lovely!`); }}>{verb}</button>
      : locked ? <button className="btn block" disabled>🔒 Unlocks at Lv {d.level}</button>
      : <button className="btn primary block" disabled={st.feathers < d.price} onClick={() => { if (buyDecor(d.id)) { happy(`The ${d.name}! I’ve put it up in your Aviary.`); nav.toast(`Bought ${d.name}`); } else broke(d.price); }}>Buy &amp; {verb.toLowerCase()} · {coins(d.price)}</button>;
    if (d.kind === 'perch' && using) secondary = <button className="btn ghost block" onClick={() => { equipDecor('perch', undefined); setMood('curious'); setSaid('Perch packed away. Your birds will use the branches.'); }}>Take it down</button>;
  } else if (kind === 'home') {
    const sc = id ? SCENES[id] : null;
    const owned = !sc || ownsHome(st, sc.id), on = sc ? st.diorama.home === sc.id : !st.diorama.home, locked = !!sc && !owned && lv < sc.level, p = sc ? homePrice(sc.id) : 0;
    art = homeArt(sc?.id ?? 'skyday', 200); title = sc?.label ?? 'Day & night';
    line = sc ? 'A new home for your Aviary. Your birds, feeder and perch all move in together.' : 'The default home: a sunny meadow by day that turns to dusk at night.';
    meta = sc ? <>Unlocks at Lv {sc.level}</> : <>Free</>;
    const move = () => { sfx.select(); setHome(sc?.id); happy(`Your birds are settling into ${title}.`); };
    primary = on ? <button className="btn block" disabled>✓ Your home</button>
      : owned ? <button className="btn primary block" onClick={move}>Move in</button>
      : locked ? <button className="btn block" disabled>🔒 Unlocks at Lv {sc!.level}</button>
      : <button className="btn primary block" disabled={st.feathers < p} onClick={() => { if (buyHome(sc!.id)) { happy(`${sc!.label} is yours! Your birds have moved in.`); nav.toast(`Moved to ${sc!.label}`); } else broke(p); }}>Buy &amp; move in · {coins(p)}</button>;
  } else if (kind === 'lens') {
    const l = LENSES[id as LensId], owned = st.lenses.includes(l.id), on = st.lens === l.id, locked = !owned && lv < l.level;
    art = <Capsule size={96} lens={l.id} glow />; title = l.name; line = l.desc;
    meta = <><span className="tier-tag" style={{ borderColor: TIER_META[l.tier].color }}>{TIER_META[l.tier].label}</span> {l.power ? `+${l.power} Snap Power on every photo` : 'No Snap Power boost'}</>;
    primary = on ? <button className="btn block" disabled>✓ On your camera</button>
      : owned ? <button className="btn primary block" onClick={() => { equipLens(l.id); sfx.select(); happy(`The ${l.name} is ready. Go and find a bird!`); }}>Use this lens</button>
      : locked ? <button className="btn block" disabled>🔒 Unlocks at Lv {l.level}</button>
      : <button className="btn primary block" disabled={st.feathers < l.price} onClick={() => { if (buyLens(l.id)) { happy(`The ${l.name}! +${l.power} Snap Power on every photo.`); nav.toast(`Bought ${l.name}`); } else broke(l.price); }}>Buy &amp; use · {coins(l.price)}</button>;
  }

  return (
    <Sheet onClose={onClose} label={title}>
      <div className="isheet">
        <div className="isheet-woods">
          <span className="isheet-face woods-frame"><Professor height={64} mood={mood} /></span>
          <p className="isheet-say"><b>Professor Woods</b>{said ?? line}</p>
        </div>
        <div className="isheet-art">{art}</div>
        <h3 className="isheet-title">{title}</h3>
        <p className="small muted isheet-meta">{meta}</p>
        {variants.length > 1 && (
          <div className="isheet-swatches" role="radiogroup" aria-label="Colours">
            {variants.map((v) => {
              const owned = ownsDecor(st, v.id), using = st.diorama[v.kind] === v.id;
              return (
                <button key={v.id} role="radio" aria-checked={pick === v.id} className={`swatch ${pick === v.id ? 'on' : ''}`} onClick={() => { sfx.move(); setPick(v.id); setSaid(null); setMood('curious'); }}
                  aria-label={`${v.colourway}${using ? ', in use' : owned ? ', owned' : lv < v.level ? `, unlocks at level ${v.level}` : `, ${v.price} Feather Coins`}`}>
                  {decorArt(v, 40)}
                  <span className="swatch-name">{v.colourway}</span>
                  <span className="swatch-tag">{using ? '✓' : owned ? 'Owned' : lv < v.level ? '🔒' : <><FeatherIcon size={10} />{v.price}</>}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="isheet-acts">{primary}{secondary}</div>
        <p className="small muted isheet-wallet">You have <FeatherIcon size={12} /> <b className="num">{st.feathers}</b> Feather Coins</p>
      </div>
    </Sheet>
  );
}
