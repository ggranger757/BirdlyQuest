import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { useNav } from '../nav';
import { useGame, counts, refreshChallenges, setRegion, setMission, skipMission } from '../../app/store';
import { getRegion, regionLabel } from '../../data/geo';
import { regionEntries, ensureRegion, onProviderChange, providerStatus, usingSeedFallback, nearbySightings, Sighting as Obs, birdingSpots, type Spot } from '../../data/provider';
import { likelyNow } from '../../core/rarity';
import { sunTimes, dayPhase, DayPhase } from '../../core/sun';
import { liveStreak, dayKey, rankFor, trainerLevel } from '../../core/xp';
import { fetchWeather, Weather } from '../../app/net';
import { renderFrames, defaultParts } from '../../core/pixel/sprite';
import { frameImage, Icon, RarityTag, Sheet } from '../components';
import { FeatherChip, Segmented } from '../kit';
import { BirdThumb, Types, dexNo } from '../game';
import { sfx, gameMusic } from '../../app/audio';
import { RegionPicker } from './RegionPicker';
import type { Species } from '../../data/types';
import 'leaflet/dist/leaflet.css';

const PHASE_LINE: Record<DayPhase, string> = {
  night: 'Night — owls are the birds awake now.', dawn: 'Dawn chorus — the best hour to find birds.', morning: 'Morning feeding — birds are busy.',
  day: 'Midday lull — try shady trees and water.', golden: 'Golden hour — soft light for great shots.', dusk: 'Dusk — last feeding before roost.',
};

const spriteURLs = new Map<string, string>();
function spriteURL(sp: Species): string {
  if (spriteURLs.has(sp.id)) return spriteURLs.get(sp.id)!;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  c.getContext('2d')!.putImageData(frameImage(renderFrames(sp, defaultParts(sp))[0]), 0, 0);
  const u = c.toDataURL(); spriteURLs.set(sp.id, u); return u;
}

function useProvider(code: string) {
  const [, force] = useState(0);
  useEffect(() => { ensureRegion(code); return onProviderChange(() => force((x) => x + 1)); }, [code]);
  return providerStatus(code);
}

function ago(iso: string) {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}
export function agoTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
function km(a: [number, number], b: [number, number]) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Feed { status: 'idle' | 'loading' | 'ok' | 'offline' | 'error'; list: Obs[]; hidden: number; at: number; error?: string; from: [number, number] | null; near: boolean }
const REFRESH_MS = 5 * 60e3;

function BirdMap({ regionCode, onOpen, onData, refreshKey, onSpots, focusRef }: { regionCode: string; onOpen: (sp: Species) => void; onData: (f: Feed) => void; refreshKey: number; onSpots?: (s: Spot[] | null) => void; focusRef?: React.MutableRefObject<((s: Spot) => void) | null> }) {
  const lastQuery = useRef<{ lat: number; lng: number; radius: number; from: [number, number] | null } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const spotLayer = useRef<Leaflet.LayerGroup | null>(null);
  const spotMarkers = useRef<Map<number, Leaflet.Marker>>(new Map());
  const spotsFor = useRef('');
  const me = useRef<Leaflet.Marker | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [state, setStateMsg] = useState<'idle' | 'loading' | 'ok' | 'offline' | 'error'>('idle');
  const [info, setInfo] = useState<{ n: number; hidden: number }>({ n: 0, hidden: 0 });
  const region = getRegion(regionCode);

  useEffect(() => {
    let live = true;
    import('leaflet').then((mod) => {
      if (!live || !box.current) return;
      const Lf = (mod as any).default ?? mod; L.current = Lf;
      const m = Lf.map(box.current, { zoomControl: false, attributionControl: true }).setView([region.lat, region.lng], 7);
      // Free, keyless OpenStreetMap tiles (CARTO now requires an API key). If they fail, switch to a mirror.
      const ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · sightings: <a href="https://www.inaturalist.org">iNaturalist</a>';
      const SOURCES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'];
      let src = 0, errors = 0;
      const tiles = Lf.tileLayer(SOURCES[0], { maxZoom: 19, subdomains: 'abc', attribution: ATTR, className: 'osm-tiles' }).addTo(m);
      tiles.on('tileerror', () => {
        errors++;
        if (errors >= 6 && src < SOURCES.length - 1) { src++; errors = 0; tiles.setUrl(SOURCES[src]); }
        else if (errors >= 6) setTilesFailed(true);
      });
      tiles.on('tileload', () => setTilesFailed(false));
      // Leaflet measures its box once; re-measure whenever the layout settles or changes (fixes a blank map on iPhone)
      const ro = new ResizeObserver(() => m.invalidateSize());
      ro.observe(box.current!);
      setTimeout(() => m.invalidateSize(), 250); setTimeout(() => m.invalidateSize(), 1000);
      (m as any)._ro = ro;
      spotLayer.current = Lf.layerGroup().addTo(m);
      layer.current = Lf.layerGroup().addTo(m);
      if (focusRef) focusRef.current = (s: Spot) => { m.setView([s.lat, s.lng], Math.max(m.getZoom(), 13)); spotMarkers.current.get(s.id)?.openPopup(); };
      map.current = m;
      m.on('popupopen', (e: any) => {
        const btn = e.popup.getElement()?.querySelector('[data-sp]') as HTMLElement | null;
        btn?.addEventListener('click', () => { const id = btn.dataset.sp!; const sp = obsRef.current.find((o) => o.sp.id === id)?.sp; if (sp) onOpen(sp); });
      });
      // auto-locate if permission was already granted
      navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => { if (p.state === 'granted') locate(); else load(region.lat, region.lng, 40); }).catch(() => load(region.lat, region.lng, 40));
    });
    return () => { live = false; (map.current as any)?._ro?.disconnect(); map.current?.remove(); map.current = null; };
  }, [regionCode]);

  const obsRef = useRef<Obs[]>([]);
  const load = async (lat: number, lng: number, radius: number, from: [number, number] | null = pos) => {
    lastQuery.current = { lat, lng, radius, from };
    if (!navigator.onLine) { setStateMsg('offline'); onData({ status: 'offline', list: [], hidden: 0, at: Date.now(), from, near: !!from }); return; }
    setStateMsg('loading');
    try {
      const { list, hidden } = await nearbySightings(lat, lng, radius, 30);
      obsRef.current = list;
      const Lf = L.current!; const g = layer.current!; g.clearLayers();
      const seen = new Set<string>();
      for (const o of list) {
        const key = `${o.sp.id}|${o.lat.toFixed(3)}|${o.lng.toFixed(3)}`; if (seen.has(key)) continue; seen.add(key);
        const icon = Lf.divIcon({ className: '', html: `<img class="bird-pin" src="${spriteURL(o.sp)}" width="40" height="40" alt="">`, iconSize: [40, 40], iconAnchor: [20, 36] });
        const dist = from ? ` · ${km(from, [o.lat, o.lng]).toFixed(1)} km` : '';
        const when = o.observedAt ? agoTime(o.observedAt) : ago(o.observedOn);
        const esc = (s: string) => s.replace(/[<>&"]/g, '');
        Lf.marker([o.lat, o.lng], { icon, title: o.sp.common }).addTo(g).bindPopup(
          `<div style="display:flex;gap:10px;align-items:center">${o.photo ? `<img src="${esc(o.photo)}" width="56" height="56" style="object-fit:cover;border:2px solid #000">` : ''}
           <div><b>${esc(o.sp.common)}</b><br><i style="color:#4a5560">${esc(o.sp.sci)}</i><br>Seen ${when}${dist}</div></div>
           <button data-sp="${esc(o.sp.id)}" style="margin-top:8px;width:100%;min-height:40px;background:#C6FF1A;border:2px solid #000;font:12px Silkscreen,monospace;text-transform:uppercase">Open BirdDex entry</button>`);
      }
      setInfo({ n: list.length, hidden }); setStateMsg('ok');
      // birding spots near the same centre (cached for a day)
      const sk = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      if (spotsFor.current !== sk) {
        spotsFor.current = sk; onSpots?.(null);
        birdingSpots(lat, lng).then((spots) => {
          const sg = spotLayer.current; if (!sg) return; sg.clearLayers(); spotMarkers.current.clear();
          const esc = (s: string) => s.replace(/[<>&"]/g, '');
          for (const s of spots) {
            const icon = Lf.divIcon({ className: '', html: `<span class="spot-pin" aria-hidden="true"></span>`, iconSize: [30, 34], iconAnchor: [15, 32] });
            const dist = from ? ` · ${km(from, [s.lat, s.lng]).toFixed(1)} km` : '';
            const mk = Lf.marker([s.lat, s.lng], { icon, title: s.name, zIndexOffset: -100 }).addTo(sg).bindPopup(
              `<div><b>${esc(s.name)}</b><br>${s.species} bird species recorded${dist}<br><span style="color:#4a5560">Often seen: ${esc(s.top.join(', '))}</span></div>
               <a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat.toFixed(5)},${s.lng.toFixed(5)}&travelmode=walking" target="_blank" rel="noopener" style="display:block;margin-top:8px;text-align:center;min-height:40px;line-height:36px;background:#C6FF1A;color:#0A0C0F;border:2px solid #000;font:12px Silkscreen,monospace;text-transform:uppercase;text-decoration:none">Directions</a>`);
            spotMarkers.current.set(s.id, mk);
          }
          onSpots?.(spots);
        }).catch(() => onSpots?.([]));
      }
      onData({ status: 'ok', list, hidden, at: Date.now(), from, near: !!from });
    } catch (e) {
      setStateMsg('error');
      const msg = (e as Error)?.name === 'AbortError' ? 'iNaturalist took too long to answer' : /^\d{3}$/.test(String((e as Error)?.message)) ? `iNaturalist answered with error ${(e as Error).message}` : 'Could not reach iNaturalist';
      onData({ status: 'error', list: [], hidden: 0, at: Date.now(), error: msg, from, near: !!from });
    }
  };
  // near-realtime: refresh every 5 minutes while the map is open, and on demand
  useEffect(() => {
    const t = setInterval(() => { const q = lastQuery.current; if (q && document.visibilityState === 'visible') load(q.lat, q.lng, q.radius, q.from); }, REFRESH_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { const q = lastQuery.current; if (refreshKey && q) load(q.lat, q.lng, q.radius, q.from); }, [refreshKey]);

  const locate = () => {
    if (!navigator.geolocation) return;
    sfx.tap();
    navigator.geolocation.getCurrentPosition((p) => {
      const ll: [number, number] = [p.coords.latitude, p.coords.longitude]; // kept in memory only, never saved
      setPos(ll);
      const Lf = L.current!; const m = map.current!;
      if (!me.current) me.current = Lf.marker(ll, { icon: Lf.divIcon({ className: '', html: '<div class="me-pin pulse"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000, title: 'You' }).addTo(m);
      else me.current.setLatLng(ll);
      m.setView(ll, 12);
      load(ll[0], ll[1], 12, ll);
    }, () => load(region.lat, region.lng, 40), { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  };

  return (
    <div className="map-wrap">
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="region" aria-label="Map of recent bird sightings" />
      <div className="map-overlay" style={{ left: 10, top: 'calc(54px + var(--safe-t))', display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '75%' }}>
        {state === 'loading' && <span className="chip">Scanning for birds…</span>}
        {state === 'ok' && <span className="chip sun">{info.n} sightings nearby · 30 days</span>}
        {state === 'ok' && info.hidden > 0 && <span className="chip map-pill">{info.hidden} sensitive hidden</span>}
        {state === 'offline' && <span className="chip">Offline — map needs a connection</span>}
        {state === 'error' && <span className="chip">Couldn’t load sightings</span>}
        {tilesFailed && <span className="chip">Map images couldn’t load — check your connection</span>}
      </div>
      <button className="btn primary small map-overlay" style={{ right: 10, top: 'calc(10px + var(--safe-t))', minHeight: 36 }} onClick={locate} aria-label="Find birds near me">
        <Icon name="map" size={14} color="var(--accent-ink)" /> Near me
      </button>
    </div>
  );
}

export function Explore() {
  const nav = useNav();
  const st = useGame((s) => s);
  const region = getRegion(st.region);
  const status = useProvider(st.region);
  const now = new Date();
  const phase = dayPhase(now, sunTimes(now, region.lat, region.lng));
  const [wx, setWx] = useState<Weather | null>(null);
  const [pickRegion, setPickRegion] = useState(false);
  const open = false; // the drawer has one size: no All / Less expansion
  const [view, setView] = useState<'latest' | 'likely' | 'spots'>('latest');
  const [feed, setFeed] = useState<Feed>({ status: 'idle', list: [], hidden: 0, at: 0, from: null, near: false });
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const focusSpot = useRef<((s: Spot) => void) | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [, tickNow] = useState(0);
  useEffect(() => { const t = setInterval(() => tickNow((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { fetchWeather(region).then(setWx); refreshChallenges(new Date()); }, [st.region]);
  useEffect(() => { gameMusic('explore'); }, []);

  const entries = regionEntries(st.region);
  const caught = new Set(st.sightings.filter(counts).map((s) => s.speciesId));
  const have = entries.filter((e) => caught.has(e.sp.id)).length;
  const likely = useMemo(() => likelyNow(region, now, st.habitat, wx ?? undefined).slice(0, 12), [st.region, status, wx, phase]);
  const fallback = usingSeedFallback(st.region);
  const streak = liveStreak(st.streak, dayKey(now));
  const rank = rankFor(st.xp);
  const openSp = (sp: Species) => nav.open({ name: 'species', id: sp.id });

  return (
    <div className="explore">
      <BirdMap regionCode={st.region} onOpen={openSp} onData={setFeed} refreshKey={refreshKey} onSpots={setSpots} focusRef={focusSpot} />
      {/* HUD: who you are, streak, money */}
      <div className="hud" style={{ right: 110 }}>
        <button className="chip" onClick={() => nav.setTab('you')} aria-label={`Trainer ${st.trainerName}, level ${trainerLevel(st.xp).level}`}>
          <b style={{ color: 'var(--accent)', fontWeight: 400 }}>Lv{trainerLevel(st.xp).level}</b> {st.trainerName || 'Trainer'}
        </button>
        <span className="chip" aria-label={`${streak.days}-day streak`}><Icon name="flame" size={12} color={streak.days ? 'var(--oriole)' : 'var(--ash)'} />{streak.days}</span>
        <FeatherChip label={false} />
      </div>

      <div className="drawer" style={{ height: 276 }}>
        <span className="grab" aria-hidden style={{ display: 'block' }} />
        <div className="drawer-body">
          <div className="row between" style={{ marginBottom: 8 }}>
            <button className="row" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left', minHeight: 44 }} onClick={() => { sfx.tap(); setPickRegion(true); }} aria-label={`Region ${regionLabel(st.region)}. Change`}>
              <span style={{ fontSize: 24 }} aria-hidden>{region.flag}</span>
              <span><b>{region.name}</b> <span className="region-change" aria-hidden>Change <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 4h10v2H10v2H8v2H6V8H4V6H2z" fill="currentColor" /></svg></span><br />
                <span className="small muted">{wx ? `${wx.label}${wx.tempC !== undefined ? ` ${wx.tempC}°C` : ''} · ` : ''}{PHASE_LINE[phase].split(' — ')[0]}</span></span>
            </button>
            <button className="chip" onClick={() => nav.setTab('dex')} aria-label={`BirdDex ${have} of ${entries.length}`}>Dex {have}/{entries.length}</button>
          </div>
          <div className={`live ${feed.status}`} role="status">
            {feed.status === 'ok' && <><span className="live-dot" aria-hidden />Live · {feed.list.length} sightings {feed.near ? 'near you' : `around ${region.name}`} · updated {agoTime(new Date(feed.at).toISOString())}</>}
            {feed.status === 'loading' && <>Checking iNaturalist for new sightings…</>}
            {feed.status === 'idle' && <>Connecting to live sightings…</>}
            {feed.status === 'offline' && <>You're offline. The map will update when you're back online.</>}
            {feed.status === 'error' && <>{feed.error}. <button className="link" style={{ minHeight: 0, padding: 0 }} onClick={() => setRefreshKey((k) => k + 1)}>Retry</button></>}
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <div className="grow"><Segmented label="Show" value={view} onChange={setView} options={[
              { id: 'latest', label: 'Latest' },
              { id: 'likely', label: 'Likely' },
              { id: 'spots', label: 'Spots' },
            ]} /></div>
          </div>
          {view === 'latest' && <MissionCard feed={feed} caught={caught} />}
          {view === 'likely' && (() => {
                const inSeason = entries.filter((e) => !e.sp.sensitive && e.seasonal > 0.6 && e.freq < 0.85).sort((a, b) => b.seasonal - a.seasonal).slice(0, 8);
                if (inSeason.length < 2) return null;
                const month = new Date().toLocaleString(undefined, { month: 'long' });
                return (
                  <section className="season" aria-label={`In season this ${month}`}>
                    <div className="season-head"><span className="mission-tag">In season</span> <span className="small">Passing through {region.name} this {month}</span></div>
                    <div className="bird-cards">
                      {inSeason.map((e) => (
                        <button key={e.sp.id} className={`bird-card ${caught.has(e.sp.id) ? 'caught' : ''}`} onClick={() => openSp(e.sp)}>
                          {e.sp.photo ? <img src={e.sp.photo} alt="" loading="lazy" /> : <span className="ph" style={{ display: 'block', overflow: 'hidden' }}><BirdThumb sp={e.sp} size={84} /></span>}
                          <span className="dexno">{dexNo(e.dex)} {caught.has(e.sp.id) ? <span style={{ color: 'var(--accent)' }}>✓ found</span> : ''}</span>
                          <span className="nm">{e.sp.common}</span>
                        </button>
                      ))}
                    </div>
                    <div className="section-title" style={{ marginTop: 4 }}><span>Likely right now</span></div>
                  </section>
                );
          })()}
          {view === 'spots' ? (
            <div className="spots">
              <p className="small muted" style={{ marginTop: 0 }}>Parks, refuges and preserves near you, ranked by how many bird species people have recorded there.</p>
              {spots === null && <p className="small muted">Finding birding spots…</p>}
              {spots && spots.length === 0 && <p className="small muted">No well-known birding spots found nearby. Try Near me, or zoom to a greener area.</p>}
              {(spots ?? []).map((s) => (
                <div key={s.id} className="srow spot-row">
                  <span className="spot-pin static" aria-hidden />
                  <button className="grow spot-main" onClick={() => { sfx.select(); focusSpot.current?.(s); }} aria-label={`${s.name}: ${s.species} bird species recorded. Show on map`}>
                    <span className="name">{s.name}</span><br />
                    <span className="small" style={{ color: 'var(--lichen)' }}>{s.species} bird species{feed.from ? ` · ${km(feed.from, [s.lat, s.lng]).toFixed(1)} km` : ''}</span><br />
                    <span className="small muted">Often seen: {s.top.join(', ')}</span>
                  </button>
                  <a className="btn small" href={directions(s.lat, s.lng)} target="_blank" rel="noopener" aria-label={`Directions to ${s.name}`}>Go</a>
                </div>
              ))}
              {spots && <p className="small muted">Places from iNaturalist; counts are research-grade bird observations.</p>}
            </div>
          ) : view === 'latest' ? (
            feed.list.length === 0 ? (
              <p className="small muted" style={{ margin: '4px 0' }}>
                {feed.status === 'ok' ? 'No public bird reports here in the last 30 days. Tap Near me, or try a busier area.' : feed.status === 'error' ? 'Live sightings are unavailable right now.' : 'Looking for the latest reports…'}
              </p>
            ) : !open ? (
              <div className="bird-cards">
                {feed.list.slice(0, 20).map((o) => (
                  <button key={o.id} className={`bird-card ${caught.has(o.sp.id) ? 'caught' : ''}`} onClick={() => openSp(o.sp)}>
                    {o.photo ? <img src={o.photo} alt="" loading="lazy" /> : <span className="ph" style={{ display: 'block', overflow: 'hidden' }}><BirdThumb sp={o.sp} size={84} /></span>}
                    <span className="seen">{o.observedAt ? agoTime(o.observedAt) : ago(o.observedOn)}{feed.from ? ` · ${km(feed.from, [o.lat, o.lng]).toFixed(1)} km` : ''}</span>
                    <span className="nm">{o.sp.common}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {feed.list.slice(0, 40).map((o) => (
                  <button key={o.id} className="srow" onClick={() => openSp(o.sp)}>
                    {o.photo ? <img src={o.photo} alt="" width={52} height={52} style={{ objectFit: 'cover', border: '2px solid #000' }} /> : <BirdThumb sp={o.sp} size={52} />}
                    <span className="grow"><span className="name">{o.sp.common}</span>{caught.has(o.sp.id) && <span className="px small" style={{ color: 'var(--accent)' }}> ✓</span>}<br />
                      <span className="small" style={{ color: 'var(--lichen)' }}>{o.observedAt ? agoTime(o.observedAt) : ago(o.observedOn)}</span>
                      <span className="small muted">{feed.from ? ` · ${km(feed.from, [o.lat, o.lng]).toFixed(1)} km` : ''}{o.place ? ` · ${o.place.split(',')[0]}` : ''}</span></span>
                  </button>
                ))}
                <p className="small muted">Real reports from iNaturalist observers in the last 30 days, newest first. Sensitive species are never shown. <button className="link" style={{ minHeight: 0, padding: 0 }} onClick={() => setRefreshKey((k) => k + 1)}>Refresh now</button></p>
              </>
            )
          ) : !open ? (
            <div className="bird-cards">
              {likely.map(({ sp, dex }) => (
                <button key={sp.id} className={`bird-card ${caught.has(sp.id) ? 'caught' : ''}`} onClick={() => openSp(sp)}>
                  {sp.photo ? <img src={sp.photo} alt="" loading="lazy" /> : <span className="ph" style={{ display: 'block', overflow: 'hidden' }}><BirdThumb sp={sp} size={84} /></span>}
                  <span className="dexno">{dexNo(dex)} {caught.has(sp.id) ? <span style={{ color: 'var(--accent)' }}>✓ found</span> : ''}</span>
                  <span className="nm">{sp.common}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <p className="small" style={{ marginTop: 0 }}>{PHASE_LINE[phase]}</p>
              {likely.map(({ sp, rarity, dex }) => (
                <button key={sp.id} className="srow" onClick={() => openSp(sp)}>
                  <BirdThumb sp={sp} size={52} />
                  <span className="grow"><span className="dexno">{dexNo(dex)}</span> <span className="name">{sp.common}</span><br />
                    <span className="row" style={{ gap: 6, display: 'inline-flex', marginTop: 2 }}><Types sp={sp} /> <RarityTag rarity={rarity} showLabel={false} /></span></span>
                  {caught.has(sp.id) ? <span className="px small" style={{ color: 'var(--accent)' }}>✓</span> : <span className="px small muted">NEW</span>}
                </button>
              ))}
              <p className="small muted mt16">
                {status === 'loading' ? 'Updating the local bird list from iNaturalist…'
                  : fallback ? `Offline list: using curated birds from ${getRegion(fallback).name} until the live list loads.`
                    : `${entries.length} species recorded in ${region.name} (iNaturalist research-grade).`}
              </p>
            </>
          )}
        </div>
      </div>

      {pickRegion && (
        <Sheet onClose={() => setPickRegion(false)} label="Choose your region">
          <h3 className="mb8">Choose your region</h3>
          <RegionPicker value={st.region} onPick={(code) => { setRegion(code); setPickRegion(false); nav.toast(`Region: ${regionLabel(code)}`); }} />
        </Sheet>
      )}
    </div>
  );
}

const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}&travelmode=walking`;

/** Turns the freshest nearby sighting of a bird you still need into a 3-hour mission. */
function MissionCard({ feed, caught }: { feed: Feed; caught: Set<string | null> }) {
  const mission = useGame((s) => s.mission);
  const skips = useGame((s) => s.missionSkips);
  const snooze = useGame((s) => s.missionSnoozeUntil);
  const today = new Date(); const dk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const skipped = new Set(skips?.day === dk ? skips.ids : []);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const live = mission && Date.parse(mission.until) > Date.now() ? mission : null;
  if (live) {
    const left = Math.max(0, Date.parse(live.until) - Date.now()), h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60000);
    return (
      <div className="mission on" role="status">
        <div className="grow"><span className="mission-tag">Mission</span> Find a <b>{live.name}</b><br /><span className="small muted">{h ? `${h}h ` : ''}{m}m left · +25 Feathers and +25 XP</span></div>
        <a className="btn small" href={directions(live.lat, live.lng)} target="_blank" rel="noopener">Directions</a>
        <button className="btn small ghost" onClick={() => { sfx.back(); setMission(null); }} aria-label="Drop this mission">✕</button>
      </div>
    );
  }
  if (snooze && Date.parse(snooze) > Date.now()) return null;
  const fresh = feed.list.filter((o) => !skipped.has(o.sp.id) && !caught.has(o.sp.id) && !o.sp.sensitive && (!o.observedAt || Date.now() - Date.parse(o.observedAt) < 48 * 3600e3));
  if (!fresh.length) return null;
  const pick = feed.from ? fresh.slice().sort((a, b) => km(feed.from!, [a.lat, a.lng]) - km(feed.from!, [b.lat, b.lng]))[0] : fresh[0];
  const dist = feed.from ? ` ${km(feed.from, [pick.lat, pick.lng]).toFixed(1)} km away,` : '';
  return (
    <div className="mission">
      <div className="grow"><span className="mission-tag">Mission</span> A <b>{pick.sp.common}</b> was seen{dist} {pick.observedAt ? agoTime(pick.observedAt) : ago(pick.observedOn)}. Go find it!</div>
      <div className="mission-actions">
        <button className="btn small primary" onClick={() => { sfx.select(); setMission({ speciesId: pick.sp.id, name: pick.sp.common, lat: pick.lat, lng: pick.lng }); }}>Accept</button>
        <button className="btn small ghost" onClick={() => { sfx.back(); skipMission(pick.sp.id); }} aria-label={`Not now: skip the ${pick.sp.common} mission`}>Not now</button>
      </div>
    </div>
  );
}
