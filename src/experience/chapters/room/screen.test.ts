import { describe, expect, it } from 'vitest';
import { screenMode, typed, WHOS_THERE, whosThereText } from './screen';

describe('monitor screen', () => {
  it('types text one character at a time', () => {
    expect(typed('abc', -1, 10)).toBe('');
    expect(typed('abc', 0.05, 10)).toBe('');
    expect(typed('abc', 0.15, 10)).toBe('a');
    expect(typed('abc', 0.25, 10)).toBe('ab');
    expect(typed('abc', 10, 10)).toBe('abc');
  });

  it('shows code until the fifth knock, then glitches, types the question and goes back', () => {
    expect(screenMode(5, null)).toBe('code');
    expect(screenMode(9.9, 10)).toBe('code');
    expect(screenMode(10.1, 10)).toBe('glitch');
    expect(screenMode(11, 10)).toBe('whos-there');
    expect(screenMode(14, 10)).toBe('whos-there');
    expect(screenMode(25, 10)).toBe('code');
  });

  it("types who's there? while the question is on screen", () => {
    expect(whosThereText(11, 10).length).toBeGreaterThan(0);
    expect(whosThereText(11, 10).length).toBeLessThan(WHOS_THERE.length);
    expect(whosThereText(14, 10)).toBe(WHOS_THERE);
    expect(WHOS_THERE).toBe("who's there?");
  });
});
