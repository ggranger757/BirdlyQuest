import { MerlinTip } from '../MerlinTip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNav, pushBackGuard } from '../nav';
import { useGame, setState, logEvent } from '../../app/store';
import { getRegion } from '../../data/geo';
import { likelyNow } from '../../core/rarity';
import { normalize, fromFile, exifDate, analyze, canvas } from '../../app/photo';
import { Sprite, Icon, RarityTag, TopBar, RefThumb } from '../components';
import { sfx, haptic } from '../../app/audio';
import { CamRail, BirdPeek, warmPeekPhotos } from '../CamControls';

const SW_ZOOM_MAX = 4;   // software zoom beyond 4× is mostly upscaled blur
const HW_ZOOM_CAP = 10;  // keep the rail usable on phones that report 50–100× digital zoom
const fmtZoom = (z: number) => `${z < 10 ? z.toFixed(1) : Math.round(z)}×`;
const fmtEv = (v: number) => (Math.abs(v) < 0.05 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`);

type CamState = 'ask' | 'starting' | 'live' | 'denied' | 'none' | 'busy';

export function Viewfinder() {
  const nav = useNav();
  const regionCode = useGame((s) => s.region);
  const habitat = useGame((s) => s.habitat);
  const grid = useGame((s) => s.settings.grid);
  const asked = useGame((s) => s.log.some((l) => l.e === 'camera_granted'));
  const region = getRegion(regionCode);
  const short = useMemo(() => likelyNow(region, new Date(), habitat).slice(0, 5), [regionCode, habitat]);
  useEffect(() => { warmPeekPhotos(short.map((l) => l.sp)); }, [short]); // tap → the real bird, instantly
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<CamState>(asked ? 'starting' : 'ask');
  const [reticle, setReticle] = useState<{ x: number; y: number } | null>(null);
  const [exposure, setExposure] = useState(0); // -2..2 EV
  const [zoom, setZoom] = useState(1);
  const [hwExposure, setHwExposure] = useState<{ min: number; max: number } | null>(null);
  const [hwZoom, setHwZoom] = useState<{ min: number; max: number } | null>(null);
  const [freeze, setFreeze] = useState<string | null>(null);
  const [hud, setHud] = useState<string | null>(null);       // big transient readout while zooming / brightening
  const hudTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [peek, setPeek] = useState<number | null>(null);     // index into `short` of the bird card open over the camera
  const [small, setSmall] = useState(false);
  const [importErr, setImportErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const start = async () => {
    setCam('starting');
    if (!navigator.mediaDevices?.getUserMedia) { setCam('none'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream; await v.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const caps: any = track.getCapabilities?.() ?? {};
      if (caps.exposureCompensation) setHwExposure({ min: caps.exposureCompensation.min, max: caps.exposureCompensation.max });
      if (caps.zoom) {
        setHwZoom({ min: caps.zoom.min, max: caps.zoom.max });
        const cur = (track.getSettings?.() as any)?.zoom;
        setZoom(typeof cur === 'number' ? cur : Math.max(caps.zoom.min, 1));
      }
      setCam('live');
      logEvent('camera_granted');
    } catch (e: any) {
      setCam(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : e?.name === 'NotReadableError' ? 'busy' : 'none');
    }
  };
  useEffect(() => { if (cam === 'starting') start(); return () => streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // ranges: hardware when the device exposes it, otherwise software (applied to preview AND capture)
  const zoomRange = hwZoom ? { min: hwZoom.min, max: Math.max(hwZoom.min + 0.1, Math.min(hwZoom.max, HW_ZOOM_CAP)) } : { min: 1, max: SW_ZOOM_MAX };
  const evRange = hwExposure ? { min: Math.max(hwExposure.min, -3), max: Math.min(hwExposure.max, 3) } : { min: -2, max: 2 };
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const rangeRef = useRef(zoomRange); rangeRef.current = zoomRange;

  const flashHud = useCallback((text: string) => {
    setHud(text);
    clearTimeout(hudTimer.current);
    hudTimer.current = setTimeout(() => setHud(null), 900);
  }, []);
  useEffect(() => () => clearTimeout(hudTimer.current), []);

  // the zoom gauge only shows while it's in use: touching the view or zooming reveals it,
  // and it fades out ~1.6s after the last touch (it stays while a finger is on it)
  const [railOn, setRailOn] = useState(false);
  const railTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const railHeld = useRef(false);
  const showRail = useCallback(() => {
    setRailOn(true);
    clearTimeout(railTimer.current);
    if (!railHeld.current) railTimer.current = setTimeout(() => setRailOn(false), 1600);
  }, []);
  const holdRail = useCallback((held: boolean) => { railHeld.current = held; showRail(); }, [showRail]);
  useEffect(() => () => clearTimeout(railTimer.current), []);

  const changeZoom = useCallback((z: number) => {
    const r = rangeRef.current;
    const nz = Math.round(Math.max(r.min, Math.min(r.max, z)) * 10) / 10;
    if (nz === zoomRef.current) return;
    zoomRef.current = nz;
    setZoom(nz); flashHud(fmtZoom(nz)); showRail();
  }, [flashHud, showRail]);
  const changeExposure = (v: number) => { setExposure(v); flashHud(`☀ ${fmtEv(v)}`); };

  // hardware constraints: dragging fires many updates, so keep one applyConstraints in flight and coalesce the rest
  const hwBusy = useRef(false), hwDirty = useRef(false);
  const want = useRef({ exposure, zoom, hwExposure, hwZoom }); want.current = { exposure, zoom, hwExposure, hwZoom };
  const pushHw = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0]; if (!track) return;
    if (hwBusy.current) { hwDirty.current = true; return; }
    const w = want.current, adv: any = {};
    if (w.hwExposure) adv.exposureCompensation = Math.max(w.hwExposure.min, Math.min(w.hwExposure.max, w.exposure));
    if (w.hwZoom) adv.zoom = Math.max(w.hwZoom.min, Math.min(w.hwZoom.max, w.zoom));
    if (!Object.keys(adv).length) return;
    hwBusy.current = true;
    track.applyConstraints({ advanced: [adv] } as any).catch(() => {}).finally(() => {
      hwBusy.current = false;
      if (hwDirty.current) { hwDirty.current = false; pushHw(); }
    });
  }, []);
  useEffect(pushHw, [exposure, zoom, hwExposure, hwZoom]);
  const swFilter = !hwExposure && exposure ? `brightness(${Math.pow(2, exposure / 2).toFixed(2)})` : undefined;
  const swZoom = hwZoom ? 1 : zoom;
  const swZoomRef = useRef(swZoom); swZoomRef.current = swZoom;

  // the square you see on screen is exactly what gets captured
  const viewRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frameCrop = () => {
    const v = videoRef.current, box = viewRef.current, fr = frameRef.current;
    if (!v || !v.videoWidth) return null;
    const swZoom = swZoomRef.current; // read live: the distance-cue interval holds an old closure
    const side0 = Math.min(v.videoWidth, v.videoHeight) / swZoom;
    const centre = { x: (v.videoWidth - side0) / 2, y: (v.videoHeight - side0) / 2, s: side0 };
    if (!box || !fr) return centre;
    const b = box.getBoundingClientRect(), f = fr.getBoundingClientRect();
    if (!b.width || !f.width) return centre;
    const scale = Math.max(b.width / v.videoWidth, b.height / v.videoHeight);
    const ox = (b.width - v.videoWidth * scale) / 2, oy = (b.height - v.videoHeight * scale) / 2;
    const cx = b.width / 2, cy = b.height / 2;
    const unzoom = (px: number, c: number) => c + (px - c) / swZoom;            // undo the CSS scale() zoom
    const fx = unzoom(f.left - b.left, cx), fy = unzoom(f.top - b.top, cy), fs = f.width / swZoom;
    const x = (fx - ox) / scale, y = (fy - oy) / scale, sz = fs / scale;
    const sMax = Math.min(sz, v.videoWidth, v.videoHeight);
    return { x: Math.max(0, Math.min(v.videoWidth - sMax, x)), y: Math.max(0, Math.min(v.videoHeight - sMax, y)), s: sMax };
  };

  // CAM-4 distance cue: sample the frame every ~1.2s
  useEffect(() => {
    if (cam !== 'live') return;
    let n = 0;
    const iv = setInterval(async () => {
      const v = videoRef.current; if (!v || !v.videoWidth) return;
      const cr = frameCrop(); if (!cr) return;
      const c = canvas(128, 128); const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(v, cr.x, cr.y, cr.s, cr.s, 0, 0, 128, 128);
      const a = await analyze(g.getImageData(0, 0, 128, 128).data, 128);
      const area = a.bbox.w * a.bbox.h;
      n = area < 0.05 && a.score.separation > 4 ? n + 1 : 0;
      setSmall(n >= 2);
    }, 1200);
    return () => clearInterval(iv);
  }, [cam]);

  const tapFocus = (clientX: number, clientY: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    setReticle({ x, y }); sfx.tap();
    const track = streamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x, y }] } as any] }).catch(() => {});
  };

  // Live-view gestures: tap = focus · one-finger drag up/down = zoom in/out · pinch = zoom.
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gest = useRef<{ mode: 'tap' | 'drag' | 'pinch' | 'none'; x0: number; y0: number; z0: number; d0: number }>({ mode: 'none', x0: 0, y0: 0, z0: 1, d0: 1 });
  const dist = () => { const [a, b] = [...pts.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const onViewDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (peek !== null) return;
    // buttons inside the view (Merlin's tip, etc.) keep their own clicks
    if ((e.target as HTMLElement).closest('button, a, input, [role="slider"]')) return;
    showRail();
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) gest.current = { mode: 'tap', x0: e.clientX, y0: e.clientY, z0: zoomRef.current, d0: 1 };
    else if (pts.current.size === 2) {
      gest.current = { mode: 'pinch', x0: 0, y0: 0, z0: zoomRef.current, d0: dist() };
      for (const id of pts.current.keys()) { try { e.currentTarget.setPointerCapture(id); } catch { /* finger already lifted */ } }
    }
  };
  const onViewMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (g.mode === 'tap') {
      const mx = e.clientX - g.x0, my = e.clientY - g.y0;
      if (Math.hypot(mx, my) > 10) {
        g.mode = Math.abs(my) >= Math.abs(mx) ? 'drag' : 'none';
        // capture only once it's a real drag, so taps still reach their targets
        if (g.mode === 'drag') e.currentTarget.setPointerCapture?.(e.pointerId);
      }
    }
    if (g.mode === 'drag') {
      // ~55% of the view height sweeps the whole zoom range, on a log scale so every step feels the same
      const r = rangeRef.current, h = e.currentTarget.clientHeight || 600;
      const k = Math.log(r.max / r.min) / (h * 0.55);
      changeZoom(g.z0 * Math.exp((g.y0 - e.clientY) * k));
    } else if (g.mode === 'pinch' && pts.current.size >= 2) {
      changeZoom(g.z0 * (dist() / g.d0));
    }
  };
  const onViewUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    const wasTap = gest.current.mode === 'tap' && pts.current.size === 1;
    pts.current.delete(e.pointerId);
    if (wasTap) tapFocus(e.clientX, e.clientY, e.currentTarget);
    // lifting one finger of a pinch must not turn the other into a sudden drag
    gest.current.mode = 'none';
  };
  const onViewCancel = (e: React.PointerEvent<HTMLDivElement>) => { pts.current.delete(e.pointerId); gest.current.mode = 'none'; };

  // brightness button: each tap steps 0 → +1 → +2 → −1 → back to 0 (clamped to what the camera allows)
  const nextBrightness = () => {
    const steps = [0, 1, 2, -1].map((v) => Math.max(evRange.min, Math.min(evRange.max, v)));
    const i = steps.findIndex((v) => Math.abs(v - exposure) < 0.05);
    changeExposure(steps[(i + 1) % steps.length]); sfx.tap(); haptic(6);
  };

  // Likely-bird card over the live camera. It owns one history entry, so the phone's Back
  // gesture returns to the camera instead of closing it.
  const guardOn = useRef(false);
  const peekOpen = peek !== null;
  useEffect(() => {
    if (!peekOpen) return;
    const off = pushBackGuard(nav.stack.length, () => { guardOn.current = false; setPeek(null); });
    guardOn.current = true;
    return () => { if (guardOn.current) { off(); guardOn.current = false; } };
  }, [peekOpen]);
  const openPeek = (i: number) => { sfx.select(); haptic(8); setPeek(i); };
  const closePeek = useCallback(() => {
    sfx.tap();
    if (guardOn.current) { guardOn.current = false; history.back(); } // popstate → guard → setPeek(null)
    else setPeek(null);
  }, []);

  const shoot = async () => {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    sfx.shutter(); haptic(14);
    const crop = frameCrop()!;
    const shot = await normalize(v, v.videoWidth, v.videoHeight, crop, swFilter);
    setFreeze(shot.preview); // CAM-5: the freeze shows the actual captured image
    setTimeout(() => { setFreeze(null); nav.open({ name: 'catch', job: { mode: 'field', shot, returnTo: 'journal' } }); }, 220);
  };

  const onImport = async (f: File | undefined) => {
    setImportErr('');
    if (!f) return;
    const taken = await exifDate(f);
    if (!taken) { setImportErr("That photo has no capture date, so we can't check it's from today. Live photos earn full credit."); return; }
    if (Date.now() - taken.getTime() > 24 * 3600e3) { setImportErr(`That photo is from ${taken.toLocaleDateString()}. Imports must be from the last 24 hours — this keeps discoveries honest.`); return; }
    try {
      const { bmp, w, h } = await fromFile(f);
      const shot = await normalize(bmp, w, h);
      shot.takenAt = taken;
      nav.open({ name: 'catch', job: { mode: 'import', shot, returnTo: 'journal' } });
    } catch { setImportErr("We couldn't read that file. Try a JPEG straight from your camera app."); }
  };

  const importInput = <input ref={fileRef} type="file" accept="image/jpeg,image/*" hidden onChange={(e) => onImport(e.target.files?.[0])} />;
  const importNote = <p className="small muted">Imports earn 50% XP, no Fieldcraft credit, and are tagged “Archived”. Only photos taken in the last 24 hours are accepted. This keeps discoveries honest while still letting you use a better camera.</p>;

  if (cam === 'ask') {
    return (
      <div className="overlay">
        <TopBar title="Field Mode" onBack={nav.back} backIcon="close" />
        <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
          <Icon name="photo" size={64} color="var(--accent)" />
          <h2>BirdlyQuest needs your camera to discover real birds.</h2>
          <p className="muted small">Photos stay on this phone. Location is never read from them.</p>
          <button className="btn primary big block" onClick={start}>Allow camera</button>
          <button className="btn ghost block" onClick={() => nav.replace({ name: 'quicklog' })}>Saw a bird? Log it without a photo</button>
          <button className="btn ghost block" onClick={() => nav.replace({ name: 'sketch' })}>Sketch it instead</button>
        </div>
      </div>
    );
  }

  if (cam === 'denied' || cam === 'none' || cam === 'busy') {
    const copy = cam === 'denied'
      ? ['Camera is switched off for BirdlyQuest.', 'Turn it on in your browser’s site settings, or sketch the bird — sketches count too.']
      : cam === 'busy' ? ['The camera is busy.', 'Close other apps and try once more.']
        : ['No camera found on this device.', 'Sketch the bird or import a photo from today instead.'];
    return (
      <div className="overlay">
        <TopBar title="Field Mode" onBack={nav.back} backIcon="close" />
        <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
          <h2>{copy[0]}</h2><p className="muted">{copy[1]}</p>
          <button className="btn primary big block" onClick={() => nav.replace({ name: 'sketch' })}><Icon name="pencil" size={20} /> Sketch it</button>
          <button className="btn block" onClick={() => fileRef.current?.click()}>Import today’s photo</button>
          {cam !== 'denied' && <button className="btn ghost block" onClick={start}>Try again</button>}
          {importErr && <p className="small" role="alert" style={{ color: 'var(--oriole)' }}>{importErr}</p>}
          {importNote}{importInput}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" style={{ background: '#000' }}>
      <TopBar title={peek !== null ? 'Likely bird' : regionCode} onBack={peek !== null ? closePeek : nav.back} backIcon={peek !== null ? 'back' : 'close'}
        right={<button className="icon-btn" aria-pressed={grid} aria-label="Toggle grid" onClick={() => setState((s) => ({ ...s, settings: { ...s.settings, grid: !s.settings.grid } }))}><Icon name="grid" size={20} filled={grid} /></button>} />
      <div className={`cam-view${peek !== null ? ' peeking' : ''}`} ref={viewRef}
        onPointerDown={onViewDown} onPointerMove={onViewMove} onPointerUp={onViewUp} onPointerCancel={onViewCancel}>
        <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: swZoom > 1 ? `scale(${swZoom})` : undefined, filter: swFilter }} />
        {/* the capture square: centred in the space above the controls */}
        <div className="cam-frame" ref={frameRef} aria-hidden>
          {grid && (
            <svg viewBox="0 0 3 3" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden>
              <path d="M1 0V3M2 0V3M0 1H3M0 2H3" stroke="rgba(247,244,233,.55)" strokeWidth="0.008" />
            </svg>
          )}
          <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
        </div>
        {reticle && <div className="reticle locked" style={{ left: `calc(${reticle.x * 100}% - 32px)`, top: `calc(${reticle.y * 100}% - 32px)` }}><i /><i /><i /><i /></div>}
        {freeze && <img src={freeze} alt="" className="cam-freeze" />}
        {freeze && <div className="flash" />}
        {cam === 'starting' && <p className="px" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>Waking the camera…</p>}
        {peek === null && <div className="cam-tip"><MerlinTip id="camera" placement="inline" /></div>}
        {/* zoom gauge: left edge, appears only while zooming / touching the view */}
        {cam === 'live' && peek === null && (
          <CamRail side="left" label="Zoom" icon="zoom" value={zoom} min={zoomRange.min} max={zoomRange.max} step={0.1} reset={Math.max(1, zoomRange.min)} log
            format={fmtZoom} onChange={changeZoom} idle={!railOn} onActive={holdRail} />
        )}
        {hud && <div className="cam-hud px" aria-hidden>{hud}</div>}
        {hud === null && peek === null && cam === 'live' && <div className="cam-gesture-hint small" aria-hidden>Drag up/down or pinch to zoom</div>}
        {small && <div className="chip cam-small" role="status">Small in frame — get closer if you can</div>}

        {/* controls float over the bottom of the camera */}
        <div className="cam-controls" onPointerDown={(e) => e.stopPropagation()}>
          <div className="cam-likely" role="list" aria-label="Likely birds right now">
            <span className="px cam-likely-label">Likely</span>
            {short.map(({ sp }, i) => (
              <div key={sp.id} role="listitem">
                <button className="cam-chip" onClick={() => openPeek(i)} aria-label={`${sp.common}: show ID tips`}>
                  <RefThumb sp={sp} size={40} />
                  <span className="cam-chip-name">{sp.common}</span>
                  <span className="cam-chip-info" aria-hidden>i</span>
                </button>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn ghost small cam-side" onClick={() => fileRef.current?.click()} aria-label="Import a photo from today">Import</button>
            <button className="shutter ready" onClick={shoot} disabled={cam !== 'live'} aria-label="Shutter"><Icon name="photo" size={22} color="var(--ink)" /></button>
            <button className={`btn ghost small cam-side cam-bright${exposure ? ' on' : ''}`} onClick={nextBrightness}
              aria-label={`Brightness ${fmtEv(exposure)}. Tap to change`}>
              <Icon name="sun" size={16} /> {fmtEv(exposure)}
            </button>
          </div>
          <button className="link cam-flew" onClick={() => nav.replace({ name: 'quicklog' })}>It flew off? Log it without a photo</button>
          {importErr && <p className="small" role="alert" style={{ color: 'var(--oriole)', margin: 0 }}>{importErr}</p>}
        </div>
        {importInput}

        {peek !== null && short[peek] && (
          <>
            {/* the live view stays visible above the card; tapping it goes straight back to the camera */}
            <button className="cam-peek-return" onPointerDown={(e) => e.stopPropagation()} onClick={closePeek} aria-label="Back to camera">
              <span className="chip">Tap to return to camera</span>
            </button>
            <BirdPeek list={short} index={peek} onIndex={setPeek} onClose={closePeek}
              onMore={(id) => nav.open({ name: 'species', id })} />
          </>
        )}
      </div>
    </div>
  );
}
