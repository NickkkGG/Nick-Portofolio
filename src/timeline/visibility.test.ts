import { describe, expect, it } from 'vitest';
import { displayState } from './loop';
import { isVisible } from './visibility';

describe('visibility', () => {
  it('room is visible at the start and after the teleport', () => {
    expect(isVisible('room', 0)).toBe(true);
    expect(isVisible('room', 0.11)).toBe(true);
    expect(isVisible('room', 0.95)).toBe(true);
    expect(isVisible('room', 0.5)).toBe(false);
  });

  it('depths stays lit from problem to the teleport', () => {
    expect(isVisible('depths', 0.6)).toBe(true);
    expect(isVisible('depths', 0.9)).toBe(true);
    expect(isVisible('depths', 0.95)).toBe(false);
  });

  it('the chapter shown in the UI is always rendered', () => {
    for (let i = 0; i < 1000; i++) {
      const p = i / 1000;
      expect(isVisible(displayState(p).chapterId, p), `p=${p}`).toBe(true);
    }
  });
});
