import { describe, expect, it } from 'vitest';
import { revealFraction, TEXT_WINDOWS, typedCount } from './reveal';

describe('reveal', () => {
  it('the room intro is fully shown at the start and types out later', () => {
    expect(revealFraction(0, TEXT_WINDOWS.roomIntro)).toBe(1);
    expect(revealFraction(0.65, TEXT_WINDOWS.roomIntro)).toBeCloseTo(0.5);
    expect(revealFraction(0.8, TEXT_WINDOWS.roomIntro)).toBe(0);
  });

  it('the about headline types in only after the bulb lights', () => {
    expect(revealFraction(0.5, TEXT_WINDOWS.problemHeadline)).toBe(0);
    expect(revealFraction(0.785, TEXT_WINDOWS.problemHeadline)).toBeCloseTo(0.5);
    expect(revealFraction(0.9, TEXT_WINDOWS.problemHeadline)).toBe(1);
  });

  it('typedCount rounds and clamps', () => {
    expect(typedCount(10, 0.55)).toBe(6);
    expect(typedCount(10, 1.2)).toBe(10);
    expect(typedCount(10, -1)).toBe(0);
  });
});
