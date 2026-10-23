import { describe, expect, it } from 'vitest';
import { filamentHeat, formatLoading, loaderState } from './loaderState';

const input = (sceneReady: boolean, active: boolean, loaded: number, total: number, warmup = 0, errors: string[] = []) => ({
  sceneReady,
  active,
  loaded,
  total,
  warmup,
  errors,
});

/** Relative brightness of an `rgb(r, g, b)` string. */
const luma = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('loaderState', () => {
  it('waits for the scene even when nothing is loading', () => {
    expect(loaderState(input(false, false, 0, 0))).toEqual({ status: 'loading', percent: 0 });
  });

  it('is ready once the scene exists and nothing is pending', () => {
    expect(loaderState(input(true, false, 0, 0, 1))).toEqual({ status: 'ready', percent: 100 });
    expect(loaderState(input(true, false, 4, 4, 1))).toEqual({ status: 'ready', percent: 100 });
  });

  it('downloads fill most of the counter and warming the scene up fills the rest', () => {
    expect(loaderState(input(false, true, 3, 4))).toEqual({ status: 'loading', percent: 52 });
    expect(loaderState(input(false, false, 4, 4))).toEqual({ status: 'loading', percent: 70 });
    expect(loaderState(input(false, false, 4, 4, 0.5))).toEqual({ status: 'loading', percent: 85 });
  });

  it('never shows 100 before the scene is ready', () => {
    expect(loaderState(input(false, false, 4, 4, 1))).toEqual({ status: 'loading', percent: 99 });
    expect(loaderState(input(true, true, 4, 4, 1))).toEqual({ status: 'loading', percent: 99 });
  });

  it('reports an error with the progress so far', () => {
    expect(loaderState(input(true, false, 1, 2, 0, ['a.glb']))).toEqual({ status: 'error', percent: 35 });
  });

  it('formats the tape counter with three digits', () => {
    expect(formatLoading(87)).toBe('LOADING TAPE 087%');
    expect(formatLoading(0)).toBe('LOADING TAPE 000%');
    expect(formatLoading(100)).toBe('LOADING TAPE 100%');
  });
});

describe('filamentHeat', () => {
  it('runs from a cold dull red to a warm white as it heats', () => {
    const cold = filamentHeat(0);
    const hot = filamentHeat(1);
    const [r0, g0] = cold.match(/\d+/g)!.map(Number);
    expect(r0).toBeGreaterThan(g0 * 2);
    expect(luma(cold)).toBeLessThan(40);
    expect(luma(hot)).toBeGreaterThan(200);
  });

  it('only ever gets brighter, and clamps outside 0..1', () => {
    let previous = -1;
    for (let level = 0; level <= 1; level += 0.05) {
      const now = luma(filamentHeat(level));
      expect(now, `level ${level}`).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
    expect(filamentHeat(-1)).toBe(filamentHeat(0));
    expect(filamentHeat(2)).toBe(filamentHeat(1));
  });
});
