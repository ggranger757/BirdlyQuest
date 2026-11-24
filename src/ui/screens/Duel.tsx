// Friend duels (v1.38). Challenge: pick up to three birds and show a QR code (or share the link). Accept: scan a
// friend's QR in the app (where the browser can read QR codes), or with the phone's own camera, which opens
// the duel link, or paste the link. Then pick your team and battle their birds, played by the computer.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '../nav';
import { useGame } from '../../app/store';
import { trainerLevel } from '../../core/xp';
import { encodeDuel, decodeDuel, duelLink, type DuelCard } from '../../core/duel';
import { qrEncode, drawQr } from '../../core/qr';
import { speciesById } from '../../data/provider';
import { birdStyle } from '../../core/trials';
import { useTeam } from './Trials';
import { Sprite, TopBar } from '../components';
import { sfx, haptic } from '../../app/audio';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

export function Duel({ code: incoming }: { code?: string }) {
  const nav = useNav();
  const st = useGame((s) => s);
  const team = useTeam();
  const [tab, setTab] = useState<'challenge' | 'accept'>(incoming ? 'accept' : 'challenge');
  const [picked, setPicked] = useState<string[]>(() => team.slice(0, 3).map((c) => c.sp.id));
  const [card, setCard] = useState<DuelCard | null>(() => (incoming ? decodeDuel(incoming) : null));
  const [code, setCodeIn] = useState(incoming ?? '');
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState<string | null>(incoming && !decodeDuel(incoming) ? 'That duel code didn’t read correctly. Ask your friend to show it again.' : null);

  const mine = team.filter((c) => picked.includes(c.sp.id)).slice(0, 3);
  const myCode = useMemo(() => encodeDuel({
    name: st.trainerName || 'Birder', trainerLevel: trainerLevel(st.xp).level,
    birds: mine.map((c) => ({ id: c.sp.id, level: c.level, quality: c.quality, parts: c.parts })),
  }), [mine.map((c) => c.sp.id).join(), st.trainerName, st.xp]);
  const link = duelLink(myCode, location.href);
  const qrRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (tab === 'challenge' && qrRef.current && mine.length) drawQr(qrRef.current, qrEncode(new TextEncoder().encode(link)), 6); }, [tab, link, mine.length]);

  const toggle = (id: string) => { sfx.select(); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? [...p.slice(1), id] : [...p, id])); };
  const accept = (text: string) => {
    const c = decodeDuel(text);
    if (!c) { sfx.error(); setErr('That isn’t a BirdlyQuest duel code. Try scanning again, or paste the whole link.'); return; }
    sfx.select(); haptic(14); setErr(null); setCard(c); setCodeIn(text); setTab('accept');
  };
  const share = async () => {
    const text = `${st.trainerName || 'A birder'} challenges you to a BirdlyQuest duel!`;
    try { if (navigator.share) { await navigator.share({ title: 'BirdlyQuest duel', text, url: link }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(link); nav.toast('Duel link copied'); } catch { nav.toast('Copy the link from the box below'); }
  };

  return (
    <div className="overlay duel">
      <TopBar title="Duel a friend" onBack={nav.back} />
      <div className="screen">
        <div className="duel-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'challenge'} className={`fcat ${tab === 'challenge' ? 'on' : ''}`} onClick={() => setTab('challenge')}>Challenge</button>
          <button role="tab" aria-selected={tab === 'accept'} className={`fcat ${tab === 'accept' ? 'on' : ''}`} onClick={() => setTab('accept')}>Accept a duel</button>
        </div>

        {tab === 'challenge' && (
          team.length === 0 ? <p className="panel">Photograph a bird first. Then you can challenge your friends.</p> : (
            <>
              <p className="small muted">Pick up to 3 birds. Your friend scans your code and battles them.</p>
              <div className="duel-pick">
                {team.slice(0, 12).map((c) => (
                  <button key={c.sp.id} className={`duel-bird ${picked.includes(c.sp.id) ? 'on' : ''}`} aria-pressed={picked.includes(c.sp.id)} onClick={() => toggle(c.sp.id)}>
                    <span className="duel-bird-art"><Sprite species={c.sp} parts={c.parts} scale={2} mode="static" /></span>
                    <span className="duel-bird-name">{c.sp.common}</span><span className="duel-bird-lv">Lv{c.level}</span>
                  </button>
                ))}
              </div>
              {mine.length > 0 && (
                <div className="duel-qr panel">
                  <canvas ref={qrRef} className="duel-qr-canvas" aria-label="Your duel QR code" />
                  <p className="small">Ask your friend to scan this with their phone camera, or with <b>Accept a duel</b> in their BirdlyQuest.</p>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn primary grow" onClick={share}>Share link</button>
                    <button className="btn grow" onClick={async () => { try { await navigator.clipboard.writeText(link); nav.toast('Duel link copied'); } catch { nav.toast('Copy the link from the box below'); } }}>Copy link</button>
                  </div>
                  <input className="duel-link" readOnly value={link} aria-label="Your duel link" onFocus={(e) => e.currentTarget.select()} />
                </div>
              )}
            </>
          )
        )}

        {tab === 'accept' && (
          card ? <Incoming card={card} onDuel={() => nav.replace({ name: 'trials', duel: code })} onCancel={() => { setCard(null); setCodeIn(''); }} /> : (
            <>
              {canScan() ? <Scanner onCode={accept} /> : (
                <p className="panel small">Scan your friend’s code with your <b>phone’s camera app</b>. It opens BirdlyQuest straight into the duel. Or paste their duel link here:</p>
              )}
              <div className="duel-paste">
                <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a duel link" aria-label="Duel link" />
                <button className="btn primary" disabled={!paste.trim()} onClick={() => accept(paste)}>Open</button>
              </div>
              {err && <p className="small duel-err" role="alert">{err}</p>}
            </>
          )
        )}
      </div>
    </div>
  );
}

function Incoming({ card, onDuel, onCancel }: { card: DuelCard; onDuel: () => void; onCancel: () => void }) {
  const birds = card.birds.map((b) => ({ b, sp: speciesById(b.id) })).filter((x) => x.sp);
  return (
    <div className="duel-incoming panel">
      <span className="thero-kicker">Duel challenge</span>
      <b className="duel-foe">{card.name} <span className="muted">· Trainer Lv{card.trainerLevel}</span></b>
      <div className="duel-foe-team">
        {birds.map(({ b, sp }) => (
          <span key={b.id} className="duel-bird on">
            <span className="duel-bird-art"><Sprite species={sp!} parts={b.parts} scale={2} mode="idle" /></span>
            <span className="duel-bird-name">{sp!.common}</span><span className="duel-bird-lv">Lv{b.level}</span>
          </span>
        ))}
      </div>
      {birds.length < card.birds.length && <p className="small muted">Some of their birds aren’t in your region’s guide yet, so they stay home.</p>}
      <button className="btn primary big block" disabled={!birds.length} onClick={onDuel}>Choose your team &amp; duel!</button>
      <button className="btn ghost block mt8" onClick={onCancel}>Scan a different code</button>
    </div>
  );
}

function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, stop = false, timer = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play();
        const det = new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (stop) return;
          try { const found = await det.detect(v); const hit = found.find((f) => /duel=|^[A-Za-z0-9_-]{20,}$/.test(f.rawValue)); if (hit) { onCode(hit.rawValue); return; } } catch { /* keep looking */ }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch { setMsg('Camera unavailable. Use your phone’s camera app, or paste the link below.'); setOn(false); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [on]);
  return (
    <div className="duel-scan panel">
      {on ? <video ref={video} className="duel-video" playsInline muted aria-label="Camera: point it at your friend’s duel code" />
        : <button className="btn primary big block" onClick={() => { sfx.select(); setOn(true); }}>Scan a duel QR code</button>}
      {on && <button className="btn ghost block mt8" onClick={() => setOn(false)}>Stop scanning</button>}
      {msg && <p className="small duel-err">{msg}</p>}
    </div>
  );
}
