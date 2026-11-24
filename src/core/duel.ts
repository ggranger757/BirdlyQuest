// Friend duels (v1.38): your team packed into a short code that fits in a QR code or a link. No server: your friend's
// phone reads the code and battles your birds (played by the computer), exactly as they are: species, level,
// fieldcraft and colours. (Three bytes per bird once held armor; v1.45 writes them as 0 and ignores them,
// so codes shared before then still read.)

export interface DuelBird { id: string; level: number; quality: number; parts?: number[] }
export interface DuelCard { name: string; trainerLevel: number; birds: DuelBird[] }
const VERSION = 1;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Pack a team into a URL-safe code. */
export function encodeDuel(card: DuelCard): string {
  const out: number[] = [VERSION];
  const name = new TextEncoder().encode(card.name.trim().slice(0, 16) || 'Birder').slice(0, 24);
  out.push(name.length, ...name, clampByte(card.trainerLevel), Math.min(3, card.birds.length));
  for (const b of card.birds.slice(0, 3)) {
    const id = new TextEncoder().encode(b.id).slice(0, 32);
    const parts = (b.parts ?? []).slice(0, 24);
    out.push(id.length, ...id, clampByte(b.level), clampByte(b.quality), 0, 0, 0, parts.length, ...parts.map(clampByte));
  }
  out.push(out.reduce((a, n) => (a + n) & 0xff, 0)); // checksum
  return b64url(Uint8Array.from(out));
}

/** Read a code (or a whole duel link). Returns null if it isn't a valid duel. */
export function decodeDuel(input: string): DuelCard | null {
  try {
    const m = input.trim().match(/duel=([A-Za-z0-9_-]+)/);
    const bytes = unb64url(m ? m[1] : input.trim());
    if (bytes.length < 6 || bytes[0] !== VERSION) return null;
    const sum = bytes.slice(0, -1).reduce((a, n) => (a + n) & 0xff, 0);
    if (sum !== bytes[bytes.length - 1]) return null;
    let i = 1;
    const take = (n: number) => { if (i + n > bytes.length - 1) throw new Error('short'); const s = bytes.slice(i, i + n); i += n; return s; };
    const byte = () => take(1)[0];
    const name = new TextDecoder().decode(take(byte())).slice(0, 16) || 'Birder';
    const trainerLevel = Math.min(50, byte()), n = Math.min(3, byte());
    const birds: DuelBird[] = [];
    for (let k = 0; k < n; k++) {
      const id = new TextDecoder().decode(take(byte()));
      const level = Math.max(1, Math.min(50, byte())), quality = Math.min(100, byte());
      byte(); byte(); byte();   // retired armor bytes
      const parts = Array.from(take(byte()));
      birds.push({ id, level, quality, parts: parts.length ? parts : undefined });
    }
    return birds.length ? { name, trainerLevel, birds } : null;
  } catch { return null; }
}

/** The link a friend's phone camera opens. */
export function duelLink(code: string, base: string): string { return `${base.replace(/#.*$/, '')}#duel=${code}`; }
