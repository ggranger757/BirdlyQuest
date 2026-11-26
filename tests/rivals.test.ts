import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { RIVALS, WANDERERS, WANDERER_PERSONA, wandererFor, wandererFace } from '../src/core/trials';
import { SCENES } from '../src/render/diorama';

describe('Field Trials cast', () => {
  it('30 portrait rivals climb to Professor Woods at Lv50', () => {
    expect(RIVALS.length).toBe(31);
    expect(RIVALS.slice(0, 5).map((r) => r.id)).toEqual(['pip', 'wren', 'gale', 'mara', 'hawkins']);   // saved progress depends on this
    expect(RIVALS.at(-1)!.merlin).toBe(true); expect(RIVALS.at(-1)!.level).toBe(50);
    for (let i = 1; i < RIVALS.length; i++) expect(RIVALS[i].level).toBeGreaterThan(RIVALS[i - 1].level);
    for (let i = 1; i < RIVALS.length; i++) expect(RIVALS[i].coins).toBeGreaterThan(RIVALS[i - 1].coins - 1);
  });
  it('every rival has a real scene, music and complete lines', () => {
    for (const r of RIVALS) {
      expect(SCENES[r.scene]).toBeTruthy(); expect(existsSync(`public/${r.music}`)).toBe(true);
      expect(r.send.length && r.faint.length && r.taunt.length && r.charge.length && r.line && r.win && r.lose && r.bio && r.motive && r.low).toBeTruthy();
      expect(new Set(r.styles).size).toBe(r.styles.length);
    }
    expect(new Set(RIVALS.map((r) => r.id)).size).toBe(RIVALS.length);
  });
  it('30 named wanderers, each with their own portrait; all 60 portraits used once', () => {
    expect(WANDERERS.length).toBe(30);
    const faces = [...RIVALS.filter((r) => r.face).map((r) => r.face!), ...WANDERERS.map((n) => WANDERER_PERSONA[n].face)];
    expect(faces.length).toBe(60); expect(new Set(faces).size).toBe(60);
    const files = readdirSync('public/trainers').map((f) => `trainers/${f}`);
    expect(new Set(faces)).toEqual(new Set(files));
  });
  it('a wanderer’s name and portrait always match', () => {
    for (const k of ['s1', 'abc', 'Friend Name', 'xyz123']) expect(wandererFace(k)).toBe(WANDERER_PERSONA[wandererFor(k)].face);
  });
});
