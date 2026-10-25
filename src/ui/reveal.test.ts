import { describe, expect, it } from 'vitest';
import { revealFraction, TEXT_WINDOWS, typedCount } from './reveal';

describe('reveal', () => {
  it('the room intro is fully shown at the start and types out later', () => {
    expect(revealFraction(0, TEXT_WINDOWS.roomIntro)).toBe(1);
    expect(revealFraction(0.65, TEXT_WINDOWS.roomIntro)).toBeCloseTo(0.5);
    expect(revealFraction(0.8, TEXT_WINDOWS.roomIntro)).toBe(0);
  });

  it('the STACK title types in once the bulb is up out of the frame, as the wall comes together, and stays up until the glass', () => {
    expect(revealFraction(0.49, TEXT_WINDOWS.stackTitle)).toBe(0);
    expect(revealFraction(0.56, TEXT_WINDOWS.stackTitle)).toBeCloseTo(0.5);
    expect(revealFraction(0.62, TEXT_WINDOWS.stackTitle)).toBe(1);
    expect(revealFraction(0.9, TEXT_WINDOWS.stackTitle)).toBe(1);
    expect(revealFraction(0.99, TEXT_WINDOWS.stackTitle)).toBeLessThan(0.5);
    // The hint about pointing at the tiles follows it in.
    expect(revealFraction(0.55, TEXT_WINDOWS.stackHint)).toBe(0);
    expect(revealFraction(0.7, TEXT_WINDOWS.stackHint)).toBe(1);
  });

  it('typedCount rounds and clamps', () => {
    expect(typedCount(10, 0.55)).toBe(6);
    expect(typedCount(10, 1.2)).toBe(10);
    expect(typedCount(10, -1)).toBe(0);
  });
});
