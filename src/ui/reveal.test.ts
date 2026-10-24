import { describe, expect, it } from 'vitest';
import { revealFraction, TEXT_WINDOWS, typedCount } from './reveal';

describe('reveal', () => {
  it('the room intro is fully shown at the start and types out later', () => {
    expect(revealFraction(0, TEXT_WINDOWS.roomIntro)).toBe(1);
    expect(revealFraction(0.65, TEXT_WINDOWS.roomIntro)).toBeCloseTo(0.5);
    expect(revealFraction(0.8, TEXT_WINDOWS.roomIntro)).toBe(0);
  });

  it('the IDEAS motto types in as the bulb lights, then stays up to the end of the chapter', () => {
    expect(revealFraction(0.55, TEXT_WINDOWS.ideasMotto)).toBe(0);
    expect(revealFraction(0.64, TEXT_WINDOWS.ideasMotto)).toBeCloseTo(0.5);
    expect(revealFraction(0.7, TEXT_WINDOWS.ideasMotto)).toBe(1);
    expect(revealFraction(0.94, TEXT_WINDOWS.ideasMotto)).toBe(1);
  });

  it('typedCount rounds and clamps', () => {
    expect(typedCount(10, 0.55)).toBe(6);
    expect(typedCount(10, 1.2)).toBe(10);
    expect(typedCount(10, -1)).toBe(0);
  });
});
