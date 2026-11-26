import type { Theme } from '../../core/model';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useGame, setState, exportBackup, importBackup, resetAll, getState, PIPELINE_VERSION, setRegion, setTrainer } from '../../app/store';
import { RegionPicker } from './RegionPicker';
import { getJSON, providerStatus, regionEntries, ensureRegion } from '../../data/provider';
import { regionLabel, getRegion } from '../../data/geo';
import { music, currentTheme } from '../../app/audio';
import type { Habitat } from '../../data/types';
import { TopBar, Sheet, Icon, Sprite } from '../components';
import { photoKeys } from '../../app/db';
import { SPECIES } from '../../data/species';
import { FRAMES } from '../../core/pixel/archetypes';
import { HEX, NAMES } from '../../core/palette';
import { renderFrames, defaultParts, silhouette } from '../../core/pixel/sprite';
import { dayKey } from '../../core/xp';

declare const __APP_VERSION__: string;

function Toggle({ label, on, set, hint }: { label: string; on: boolean; set: (v: boolean) => void; hint?: string }) {
  return (
    <label className="srow" style={{ cursor: 'pointer' }}>
      <span className="grow"><span className="name">{label}</span>{hint && <><br /><span className="small muted">{hint}</span></>}</span>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
    </label>
  );
}

const THEMES: { id: Theme; label: string; bg: string; accent: string; card: string; ink: string; font?: string }[] = [
  { id: 'neon', label: 'Neon (default)', bg: '#0A0C0F', accent: '#C6FF1A', card: '#EEF3EA', ink: '#0A0C0F' },
  { id: 'dusk', label: 'Dusk', bg: 'linear-gradient(135deg, #1A1446, #1C0E33)', accent: 'linear-gradient(135deg, #9FB8FF, #C9A2FF)', card: '#F1EEFF', ink: '#0B0820' },
  { id: 'ember', label: 'Ember', bg: 'linear-gradient(135deg, #2A0F08, #1E0B05)', accent: 'linear-gradient(135deg, #FF6A45, #FFB347)', card: '#FFF2EA', ink: '#1A0700' },
  { id: 'field', label: 'Field guide (light)', bg: '#EADCBC', accent: '#111111', card: '#FBF5E6', ink: '#17110A' },
];

export function Settings() {
  const nav = useNav();
  const st = useGame((s) => s);
  const [taps, setTaps] = useState(0);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pick, setPick] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof st.settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  useEffect(() => { if (taps >= 5) { setTaps(0); nav.open({ name: 'debug' }); } }, [taps]);

  const download = async (photos: boolean) => {
    const blob = await exportBackup(photos);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `birdlyquest-backup-${dayKey(new Date())}.json`; a.click();
    setMsg('Backup downloaded. Keep it somewhere safe.');
  };

  return (
    <div className="overlay">
      <TopBar title="Settings" onBack={nav.back} />
      <div className="screen">
        <div className="label mb8">Trainer</div>
        <div className="panel">
          <label className="small muted" htmlFor="tn">Trainer name</label>
          <input id="tn" defaultValue={st.trainerName} maxLength={16} onBlur={(e) => setTrainer(e.target.value.trim() || 'Birder')}
            style={{ width: '100%', minHeight: 48, padding: '8px 12px', background: 'var(--well)', border: '2px solid var(--smoke)', fontSize: 16 }} />
          <div className="small muted mt16">Region</div>
          <button className="srow" onClick={() => setPick(true)}>
            <span style={{ fontSize: 26 }} aria-hidden>{getRegion(st.region).flag}</span>
            <span className="grow name">{regionLabel(st.region)}</span><span className="small" style={{ color: 'var(--accent)' }}>Change ›</span>
          </button>
          <label className="small muted mt8" htmlFor="hab" style={{ display: 'block' }}>Where you bird most</label>
          <select id="hab" className="filter" style={{ width: '100%' }} value={st.habitat} onChange={(e) => setState((s) => ({ ...s, habitat: e.target.value as Habitat }))}>
            <option value="urban">City & gardens</option><option value="woodland">Parks & woods</option><option value="water">Water, wetland & shore</option>
          </select>
        </div>

        <div className="label mb8">Play</div>
        <div className="panel">
          <Toggle label="Title music" on={st.settings.music} set={(v) => { set({ music: v }); if (!v) music(null); }} hint="The main theme on the title screen. It never plays while you are in the game unless you turn on the option below." />
          <Toggle label="Music during play" on={st.settings.gameMusic} set={(v) => { set({ gameMusic: v }); music(v ? 'explore' : null); }} hint="Off by default. Sound effects and jingles still play." />
          <Toggle label="Sound effects" on={st.settings.sound} set={(v) => set({ sound: v })} hint="Every sound has a visual equivalent." />
          <Toggle label="Haptics" on={st.settings.haptics} set={(v) => set({ haptics: v })} />
        </div>

        <div className="label mb8">Help</div>
        <div className="panel">
          <p className="small" style={{ marginTop: 0 }}>Professor Woods can walk you through the app again.</p>
          <button className="btn block" onClick={() => { setState((x) => ({ ...x, tourOn: true })); nav.closeAll(); nav.setTab('explore'); }}>Replay Professor Woods’ tour</button>
        </div>

        <div className="label mb8">Theme</div>
        <div className="panel">
          <div role="radiogroup" aria-label="Colour theme" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {THEMES.map((t) => (
              <button key={t.id} role="radio" aria-checked={((st.settings.theme as string) === 'forest' ? 'ember' : st.settings.theme ?? 'neon') === t.id} className={`theme-card ${((st.settings.theme as string) === 'forest' ? 'ember' : st.settings.theme ?? 'neon') === t.id ? 'on' : ''}`}
                onClick={() => set({ theme: t.id })}>
                <span className="theme-swatch" style={{ background: t.bg }}><i style={{ background: t.accent }} /><b style={{ background: t.card, color: t.ink, fontFamily: t.font }}>Aa</b></span>
                <span className="small">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>Every theme meets WCAG 2.1 AA contrast (Section 508).</p>
        </div>

        <div className="label mb8">Accessibility</div>
        <div className="panel">
          <label className="small muted" htmlFor="motion">Motion</label>
          <select id="motion" className="filter" style={{ width: '100%' }} value={st.settings.motion} onChange={(e) => set({ motion: e.target.value as any })}>
            <option value="system">Follow system setting</option><option value="reduced">Reduced — crossfades, no idle animation</option><option value="full">Full animation</option>
          </select>
          <Toggle label="Readable body font" on={st.settings.dyslexiaFont} set={(v) => set({ dyslexiaFont: v })} hint="Switches body text to Atkinson Hyperlegible." />
        </div>

        <div className="label mb8">Your journal</div>
        <div className="panel">
          <p className="small" style={{ marginTop: 0 }}>Everything is stored on this phone only: no account, no server. Photos are private and have location data stripped.</p>
          <button className="btn block" onClick={() => download(true)}>Download backup (with photos)</button>
          <button className="btn block mt8" onClick={() => download(false)}>Download backup (sprites only, small)</button>
          <button className="btn ghost block mt8" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const n = await importBackup(f); setMsg(`Restored ${n} catches.`); } catch (err) { setMsg(String((err as Error).message)); }
          }} />
          {msg && <p className="small" role="status">{msg}</p>}
        </div>

        <div className="label mb8">Birds first</div>
        <div className="panel small">
          <p style={{ marginTop: 0 }}>BirdlyQuest donates nothing by existing. If you want to help birds, here are three organisations doing the work:</p>
          <ul style={{ paddingLeft: 18 }}>
            <li><a href="https://www.birdlife.org" target="_blank" rel="noopener">BirdLife International</a></li>
            <li><a href="https://www.birds.cornell.edu" target="_blank" rel="noopener">Cornell Lab of Ornithology</a></li>
            <li><a href="https://www.audubon.org" target="_blank" rel="noopener">National Audubon Society</a></li>
          </ul>
          <p>Never chase, bait, or play calls near a nest. Field Mode has no call button on purpose.</p>
        </div>

        <div className="label mb8">Credits & data</div>
        <div className="panel small">
          <p style={{ marginTop: 0 }}>Local bird lists, map sightings and reference photos come from <a href="https://www.inaturalist.org" target="_blank" rel="noopener">iNaturalist</a> research-grade observations. Map tiles © OpenStreetMap contributors. Countries and regions: countries-states-cities-database (ODbL). A curated set of species and facts works offline. Weather by <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> (non-commercial). Reference photos from <a href="https://www.inaturalist.org" target="_blank" rel="noopener">iNaturalist</a> contributors, each under its own Creative Commons licence and credited where shown. Call recordings link out to <a href="https://xeno-canto.org" target="_blank" rel="noopener">Xeno-canto</a>.</p>
          <p>Fonts: Silkscreen, Inter, Atkinson Hyperlegible (SIL Open Font License).</p>
        </div>

        <details className="advanced">
          <summary className="label">Advanced</summary>
          <div className="panel">
            <Toggle label="Viewfinder grid" on={st.settings.grid} set={(v) => set({ grid: v })} />
            <Toggle label="Reference photos" on={st.settings.refPhotos} set={(v) => set({ refPhotos: v })} hint="Real photos of each species from iNaturalist, credited to the photographer." />
          </div>
          <div className="label mb8">Live data</div>
          <LiveCheck region={st.region} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn small grow" onClick={() => nav.open({ name: 'lab' })}>Sprite lab</button>
            <button className="btn small grow" onClick={() => nav.open({ name: 'debug' })}>Diagnostics</button>
          </div>
        </details>

        <button className="btn danger block" onClick={() => setConfirm(true)}>Delete everything</button>
        <p className="small muted mt16" onClick={() => setTaps((t) => t + 1)} style={{ textAlign: 'center' }}>BirdlyQuest v{__APP_VERSION__} · pipeline v{PIPELINE_VERSION}</p>
      </div>
      {pick && (
        <Sheet onClose={() => setPick(false)} label="Choose your region">
          <h3 className="mb8">Choose your region</h3>
          <RegionPicker value={st.region} onPick={(c) => { setRegion(c); setPick(false); }} />
        </Sheet>
      )}
      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label="Delete everything">
          <h3 className="mb8">Delete your whole journal?</h3>
          <p className="small">Every discovery, photo, sprite, badge and setting on this phone will be erased. This cannot be undone. Download a backup first if you might want it.</p>
          <button className="btn danger block" onClick={async () => { await resetAll(); location.reload(); }}>Delete everything</button>
          <button className="btn ghost block mt8" onClick={() => setConfirm(false)}>Keep my journal</button>
        </Sheet>
      )}
    </div>
  );
}

// TEC-9: debug panel behind a five-tap gesture
export function Debug() {
  const nav = useNav();
  const st = useGame((s) => s);
  const [info, setInfo] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = await navigator.storage?.persisted?.().catch(() => false);
      const photos = (await photoKeys().catch(() => [])).length;
      const sw = navigator.serviceWorker?.controller ? 'active' : 'not controlling';
      setInfo({
        storage: est ? `${((est.usage ?? 0) / 1e6).toFixed(1)} MB of ${((est.quota ?? 0) / 1e6).toFixed(0)} MB` : 'n/a',
        persisted: String(persisted), photos: String(photos), serviceWorker: sw, online: String(navigator.onLine),
      });
    })();
  }, []);
  const t = (window as any).__lastPipeline as Record<string, number> | undefined;
  return (
    <div className="overlay">
      <TopBar title="Debug" onBack={nav.back} />
      <div className="screen small" style={{ fontFamily: 'ui-monospace, monospace' }}>
        <div className="label mb8">Last pipeline (ms)</div>
        <pre className="panel" style={{ whiteSpace: 'pre-wrap' }}>{t ? Object.entries(t).map(([k, v]) => `${k.padEnd(10)} ${v.toFixed(1)}`).join('\n') : 'No discovery this session.'}</pre>
        <div className="label mb8">Cache & device</div>
        <pre className="panel">{Object.entries(info).map(([k, v]) => `${k.padEnd(14)} ${v}`).join('\n')}</pre>
        <div className="label mb8">State</div>
        <pre className="panel">{`sightings ${st.sightings.length}\nxp ${st.xp}\nfeathers ${st.feathers}\nsessions ${st.sessions}\nfirst discovery ${st.firstCatchSeconds ?? '–'}s`}</pre>
        <div className="label mb8">Player journey (this phone)</div>
        <pre className="panel">{(() => {
          const real = st.sightings.filter((x) => x.mode !== 'seen').sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
          const t0 = Date.parse(st.installStartedAt);
          const mins = (iso?: string) => (iso ? `${Math.round((Date.parse(iso) - t0) / 60000)} min after install` : '–');
          const days = new Set(st.log.map((l) => l.t.slice(0, 10))).size;
          const n = (e: string) => st.log.filter((l) => l.e === e).length;
          return [
            `first discovery   ${mins(real[0]?.capturedAt)}`,
            `second discovery  ${mins(real[1]?.capturedAt)}`,
            `discoveries       ${real.length} (+${st.sightings.length - real.length} seen-only)`,
            `days active       ${days}`,
            `sessions          ${st.sessions}`,
            `missions started  ${n('mission_start')}`,
            `chapters claimed  ${Object.keys(st.chapters ?? {}).length}`,
            `tips dismissed    ${(st.tipsSeen ?? []).length}`,
          ].join('\n');
        })()}</pre>
        <div className="label mb8">Events (local only)</div>
        <pre className="panel" style={{ maxHeight: 240, overflow: 'auto' }}>{st.log.slice(-40).reverse().map((l) => `${l.t.slice(11, 19)} ${l.e} ${l.d !== undefined ? JSON.stringify(l.d) : ''}`).join('\n')}</pre>
      </div>
    </div>
  );
}

// TEC-7: sprite lab — every species, every frame, plus the silhouette test (ART-5)
export function Lab() {
  const nav = useNav();
  const [frame, setFrame] = useState(0);
  const [sil, setSil] = useState(false);
  return (
    <div className="overlay">
      <TopBar title="Sprite lab" onBack={nav.back} />
      <div className="screen">
        <div className="label mb8">FIELD 32</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
          {HEX.map((h, i) => <div key={i} title={`${NAMES[i]} ${h}`} style={{ aspectRatio: '1', background: h, border: '2px solid var(--ink)' }} />)}
        </div>
        <div className="hscroll mt16">
          {FRAMES.map((f, i) => <button key={f} className="filter" aria-pressed={!sil && frame === i} onClick={() => { setFrame(i); setSil(false); }}>{f}</button>)}
          <button className="filter" aria-pressed={sil} onClick={() => setSil(true)}>Silhouette test</button>
        </div>
        <p className="small muted">{SPECIES.length} species. 1× and 3× shown. Silhouette test: every sprite filled with one colour must still read as its family.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {SPECIES.map((sp) => (
            <div key={sp.id} className="panel flat" style={{ margin: 0, padding: 4, background: sil ? 'var(--paper)' : undefined }}>
              <div className="row" style={{ alignItems: 'flex-end', gap: 4 }}>
                <LabFrame sp={sp} frame={frame} sil={sil} scale={1} />
                <LabFrame sp={sp} frame={frame} sil={sil} scale={3} />
              </div>
              <div style={{ fontSize: 10, color: sil ? 'var(--ink)' : undefined }}>{sp.common}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LabFrame({ sp, frame, sil, scale }: { sp: (typeof SPECIES)[number]; frame: number; sil: boolean; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current!.getContext('2d')!;
    const f = sil ? silhouette(sp) : renderFrames(sp, defaultParts(sp))[frame];
    const img = new ImageData(32, 32);
    for (let i = 0; i < 1024; i++) {
      if (f[i] === 255) continue;
      const h = sil ? '#14121F' : HEX[f[i]];
      img.data.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255], i * 4);
    }
    g.clearRect(0, 0, 32, 32); g.putImageData(img, 0, 0);
  }, [frame, sil]);
  return <canvas ref={ref} width={32} height={32} className="pix" style={{ width: 32 * scale, height: 32 * scale }} aria-label={sp.common} />;
}

export { getState, Icon, Sprite };

/** Tests the live iNaturalist connection from this phone and explains the result in plain words. */
function LiveCheck({ region }: { region: string }) {
  const [res, setRes] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setRes(null);
    const r = getRegion(region);
    const lines: string[] = [];
    let ok = true;
    if (!navigator.onLine) { setRes({ ok: false, lines: ['This phone is offline. Connect to the internet and try again.'] }); setBusy(false); return; }
    try {
      const t0 = performance.now();
      const j = await getJSON(`https://api.inaturalist.org/v1/observations?lat=${r.lat.toFixed(2)}&lng=${r.lng.toFixed(2)}&radius=100&taxon_id=3&per_page=5&order_by=observed_on`, 12000);
      const n = j.total_results ?? 0;
      lines.push(`✓ iNaturalist reachable (${Math.round(performance.now() - t0)} ms). ${n.toLocaleString()} bird observations around ${r.name}. No login or key needed.`);
      const latest = j.results?.[0];
      if (latest) lines.push(`✓ Newest report: ${latest.taxon?.preferred_common_name ?? latest.taxon?.name} on ${latest.observed_on}.`);
    } catch (e) {
      ok = false;
      lines.push(`✗ Could not load data from iNaturalist (${(e as Error)?.name === 'AbortError' ? 'timed out' : (e as Error)?.message || 'network error'}). Try another network, or turn off any content blocker for this site.`);
    }
    const prov = providerStatus(region);
    lines.push(prov === 'live' || prov === 'cached' ? `✓ Local BirdDex list loaded (${regionEntries(region).length} species).` : 'ℹ The local BirdDex list is still using the offline curated list. It will switch to live data on the next load.');
    lines.push(`App version ${__APP_VERSION__}. If this is older than the latest upload, close and reopen the app to update.`);
    setRes({ ok, lines }); setBusy(false);
    if (ok) ensureRegion(region, true);
  };
  return (
    <div className="panel">
      <p className="small" style={{ marginTop: 0 }}>Bird lists and map sightings come live from iNaturalist. It's public data: no account, login or API key is needed.</p>
      <button className="btn block" onClick={run} disabled={busy}>{busy ? 'Checking…' : 'Check live data'}</button>
      {res && <div className="small mt8" role="status" style={{ color: res.ok ? 'var(--lichen)' : 'var(--oriole)' }}>{res.lines.map((l) => <div key={l} style={{ marginTop: 4 }}>{l}</div>)}</div>}
    </div>
  );
}
