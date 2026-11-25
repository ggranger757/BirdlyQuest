import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { lensScene, SCENES } from '../src/render/diorama';

describe('lens step backdrop', () => {
  it('stays for 3 discoveries, then changes', () => {
    const ids = Array.from({ length: 9 }, (_, n) => lensScene(n, 'day').id);
    expect(ids[0]).toBe(ids[1]); expect(ids[1]).toBe(ids[2]);
    expect(ids[3]).not.toBe(ids[2]); expect(ids[3]).toBe(ids[5]);
    expect(ids[6]).not.toBe(ids[5]);
  });
  it('uses night scenes after dark', () => {
    expect(lensScene(0, 'night').id).not.toBe(lensScene(0, 'day').id);
  });
  it('every backdrop in the rotation exists', () => {
    for (const ph of ['day', 'night'] as const)
      for (let n = 0; n < 60; n++) { const s = lensScene(n, ph); expect(SCENES[s.id]).toBeTruthy(); expect(existsSync(`public/bg/${s.id}/0.png`)).toBe(true); }
  });
});
