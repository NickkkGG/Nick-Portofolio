import { describe, expect, it } from 'vitest';
import { displayState, fadeAt, LOOP_TELEPORT_P, nextLoopIndex } from './loop';
import { chapterP } from './resolve';

const loopP = (t: number) => chapterP('loop', t);

describe('loop', () => {
  it('nextLoopIndex counts wraps', () => {
    expect(nextLoopIndex(0.98, 0.02, 1)).toBe(2);
    expect(nextLoopIndex(0.02, 0.98, 2)).toBe(1);
    expect(nextLoopIndex(0.02, 0.98, 1)).toBe(1);
    expect(nextLoopIndex(0.4, 0.45, 3)).toBe(3);
  });

  it('LOOP_TELEPORT_P sits 30% into the loop chapter', () => {
    expect(LOOP_TELEPORT_P).toBeCloseTo(loopP(0.3));
  });

  it('displayState shows the room once the camera arrives back', () => {
    const spiral = displayState(chapterP('spiral', 0.8));
    expect(spiral.chapterId).toBe('spiral');
    expect(spiral.t).toBeCloseTo(0.8);
    expect(displayState(loopP(0.95))).toEqual({ chapterId: 'room', t: 0 });
    const falling = displayState(loopP(0.5));
    expect(falling.chapterId).toBe('loop');
    expect(falling.t).toBeCloseTo(0.5);
  });

  it('fadeAt blacks out around the teleport only', () => {
    expect(fadeAt(LOOP_TELEPORT_P)).toBe(1);
    expect(fadeAt(loopP(0.2))).toBeCloseTo(0.5);
    expect(fadeAt(0)).toBe(0);
    expect(fadeAt(0.5)).toBe(0);
    expect(fadeAt(loopP(0.6))).toBe(0);
  });
});
