import { describe, expect, it } from 'vitest';
import { showKnockHint } from './knockHint';

describe('knock hint', () => {
  it('appears after five quiet seconds in the room', () => {
    expect(showKnockHint(10, 4.9, 0.01)).toBe(true);
    expect(showKnockHint(10, 5.1, 0.01)).toBe(false);
  });

  it('only where a knock would work', () => {
    expect(showKnockHint(60, 0, 0.07)).toBe(false);
    expect(showKnockHint(60, 0, 0.3)).toBe(false);
    expect(showKnockHint(60, 0, 0.9995)).toBe(true);
  });
});
