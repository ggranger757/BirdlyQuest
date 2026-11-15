import { describe, it, expect } from 'vitest';
import { factSentences } from '../src/data/facts';

describe('fun facts', () => {
  it('splits a Wikipedia summary into whole sentences and skips the definition line', () => {
    const s = factSentences('<p>The <b>blue jay</b> is a passerine bird in the family Corvidae, native to eastern North America. Blue jays are known for their intelligence and complex social systems. They can mimic the calls of hawks such as the red-shouldered hawk.</p>');
    expect(s).toEqual(['Blue jays are known for their intelligence and complex social systems.', 'They can mimic the calls of hawks such as the red-shouldered hawk.']);
  });
  it('keeps the only sentence when there is just one', () => {
    expect(factSentences('The kea is a large species of parrot found in the alpine regions of New Zealand.')).toHaveLength(1);
  });
});
