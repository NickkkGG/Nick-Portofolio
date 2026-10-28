import { describe, expect, it } from 'vitest';
import { birthTimes, decodeChar, FLICKER, GLYPHS, SETTLE, STAGGER, textSeed } from './decode';

describe('decoding text off the tape', () => {
  it('a character scrambles first, then settles on itself', () => {
    expect(decodeChar('A', 0, 0, 3).settled).toBe(false);
    expect(decodeChar('A', SETTLE - 0.01, 0, 3).settled).toBe(false);
    expect(decodeChar('A', SETTLE + 0.001, 0, 3)).toEqual({ char: 'A', settled: true });
  });

  it('scrambles through tape glyphs, and the glyph changes as the clock runs', () => {
    const seen = new Set<string>();
    for (let time = 0; time < 1; time += FLICKER) {
      const { char } = decodeChar('A', 0.05, 4, time);
      expect(GLYPHS).toContain(char);
      seen.add(char);
    }
    expect(seen.size).toBeGreaterThan(4);
  });

  it('is the same at the same moment, so frozen screenshots hold still', () => {
    expect(decodeChar('Q', 0.1, 7, 12.345)).toEqual(decodeChar('Q', 0.1, 7, 12.345));
  });

  it('different lines scramble differently, so lines decoding together do not show the same noise', () => {
    const line = (text: string) => Array.from({ length: 6 }, (_, i) => decodeChar('A', 0.05, i, 3, textSeed(text)).char).join('');
    expect(line('Project 01')).not.toBe(line('01 / 06'));
    expect(line('Project 01')).not.toBe(line('CH-03 / WORK'));
    expect(textSeed('Project 01')).toBe(textSeed('Project 01'));
  });

  it('leaves spaces alone', () => {
    expect(decodeChar(' ', 0, 2, 1)).toEqual({ char: ' ', settled: true });
    // The space that keeps a tag's words together is a space too.
    expect(decodeChar('\u00a0', 0, 2, 1)).toEqual({ char: '\u00a0', settled: true });
  });
});

describe('when each character appears', () => {
  it('a line that shows up at once decodes from left to right', () => {
    const born = birthTimes([], 4, 4, 10);
    expect(born).toEqual([10, 10 + STAGGER, 10 + 2 * STAGGER, 10 + 3 * STAGGER]);
  });

  it('characters typed in later by the scroll start their own decode', () => {
    expect(birthTimes([10, 10.02], 3, 5, 11)).toEqual([10, 10.02, 11, undefined, undefined]);
  });

  it('typing back out forgets them, so they decode again next time', () => {
    expect(birthTimes([1, 2, 3], 1, 3, 5)).toEqual([1, undefined, undefined]);
  });
});
