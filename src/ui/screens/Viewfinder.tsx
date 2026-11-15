import { MerlinTip } from '../MerlinTip';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useGame, setState, logEvent } from '../../app/store';
import { getRegion } from '../../data/geo';
import { likelyNow } from '../../core/rarity';
import { normalize, fromFile, exifDate, analyze, canvas } from '../../app/photo';
import { Sprite, Icon, RarityTag, TopBar, RefThumb } from '../components';
import { sfx, haptic } from '../../app/audio';

type CamState = 'ask' | 'starting' | 'live' | 'denied' | 'none' | 'busy';

export function Viewfinder() {
  const nav = useNav();
  const regionCode = useGame((s) => s.region);
  const habitat = useGame((s) => s.habitat);
  const grid = useGame((s) => s.settings.grid);
  const asked = useGame((s) => s.log.some((l) => l.e === 'camera_granted'));
  const region = getRegion(regionCode);
  const short = useMemo(() => likelyNow(region, new Date(), habitat).slice(0, 5), [regionCode, habitat]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<CamState>(asked ? 'starting' : 'ask');
  const [reticle, setReticle] = useState<{ x: number; y: number } | null>(null);
  const [exposure, setExposure] = useState(0); // -2..2 EV
  const [zoom, setZoom] = useState(1);
  const [hwExposure, setHwExposure] = useState<{ min: number; max: number } | null>(null);
  const [hwZoom, setHwZoom] = useState<{ min: number; max: number } | null>(null);
  const [freeze, setFreeze] = useState<string | null>(null);
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
      if (caps.zoom) setHwZoom({ min: caps.zoom.min, max: caps.zoom.max });
      setCam('live');
      logEvent('camera_granted');
    } catch (e: any) {
      setCam(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : e?.name === 'NotReadableError' ? 'busy' : 'none');
    }
  };
  useEffect(() => { if (cam === 'starting') start(); return () => streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  // hardware exposure / zoom when the device supports it; otherwise apply in software (preview AND capture)
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0]; if (!track) return;
    const adv: any = {};
    if (hwExposure) adv.exposureCompensation = Math.max(hwExposure.min, Math.min(hwExposure.max, exposure));
    if (hwZoom) adv.zoom = Math.max(hwZoom.min, Math.min(hwZoom.max, zoom));
    if (Object.keys(adv).length) track.applyConstraints({ advanced: [adv] } as any).catch(() => {});
  }, [exposure, zoom, hwExposure, hwZoom]);
  const swFilter = !hwExposure && exposure ? `brightness(${Math.pow(2, exposure / 2).toFixed(2)})` : undefined;
  const swZoom = hwZoom ? 1 : zoom;

  // the square you see on screen is exactly what gets captured
  const viewRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frameCrop = () => {
    const v = videoRef.current, box = viewRef.current, fr = frameRef.current;
    if (!v || !v.videoWidth) return null;
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
  }, [cam, swZoom]);

  const tapFocus = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    setReticle({ x, y }); sfx.tap();
    const track = streamRef.current?.getVideoTracks()[0];
    track?.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x, y }] } as any] }).catch(() => {});
  };

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
      <TopBar title={regionCode} onBack={nav.back} backIcon="close"
        right={<button className="icon-btn" aria-pressed={grid} aria-label="Toggle grid" onClick={() => setState((s) => ({ ...s, settings: { ...s.settings, grid: !s.settings.grid } }))}><Icon name="grid" size={20} filled={grid} /></button>} />
      <div className="cam-view" ref={viewRef} onPointerDown={tapFocus}>
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
        <div className="cam-tip"><MerlinTip id="camera" placement="inline" /></div>
        {/* exposure slider: right edge, thumb-reachable */}
        <input type="range" min={-2} max={2} step={0.5} value={exposure} onChange={(e) => setExposure(Number(e.target.value))} aria-label="Exposure"
          onPointerDown={(e) => e.stopPropagation()} className="cam-exposure" />
        {small && <div className="chip cam-small" role="status">Small in frame — get closer if you can</div>}

        {/* controls float over the bottom of the camera */}
        <div className="cam-controls" onPointerDown={(e) => e.stopPropagation()}>
          <div className="cam-likely" role="list" aria-label="Likely birds right now">
            <span className="px cam-likely-label">Likely</span>
            {short.map(({ sp }) => (
              <div key={sp.id} role="listitem" className="cam-chip">
                <RefThumb sp={sp} size={52} />
                <span className="cam-chip-name">{sp.common}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn ghost small cam-side" onClick={() => setZoom((z) => (z >= 3 ? 1 : z + 1))} aria-label={`Zoom ${zoom} times`}>{zoom}×</button>
            <button className="shutter ready" onClick={shoot} disabled={cam !== 'live'} aria-label="Shutter"><Icon name="photo" size={22} color="var(--ink)" /></button>
            <button className="btn ghost small cam-side" onClick={() => fileRef.current?.click()} aria-label="Import a photo from today">Import</button>
          </div>
          <button className="link cam-flew" onClick={() => nav.replace({ name: 'quicklog' })}>It flew off? Log it without a photo</button>
          {importErr && <p className="small" role="alert" style={{ color: 'var(--oriole)', margin: 0 }}>{importErr}</p>}
        </div>
        {importInput}
      </div>
    </div>
  );
}
