import { describe, expect, it } from 'vitest';
import { formatLoading, loaderState } from './loaderState';

const input = (sceneReady: boolean, active: boolean, loaded: number, total: number, errors: string[] = []) => ({
  sceneReady,
  active,
  loaded,
  total,
  errors,
});

describe('loaderState', () => {
  it('waits for the scene even when nothing is loading', () => {
    expect(loaderState(input(false, false, 0, 0))).toEqual({ status: 'loading', percent: 0 });
  });

  it('is ready once the scene exists and nothing is pending', () => {
    expect(loaderState(input(true, false, 0, 0))).toEqual({ status: 'ready', percent: 100 });
    expect(loaderState(input(true, false, 4, 4))).toEqual({ status: 'ready', percent: 100 });
  });

  it('reports progress but never 100 while still loading', () => {
    expect(loaderState(input(true, true, 3, 4))).toEqual({ status: 'loading', percent: 75 });
    expect(loaderState(input(true, true, 4, 4))).toEqual({ status: 'loading', percent: 99 });
  });

  it('reports an error with the progress so far', () => {
    expect(loaderState(input(true, false, 1, 2, ['a.glb']))).toEqual({ status: 'error', percent: 50 });
  });

  it('formats the tape counter with three digits', () => {
    expect(formatLoading(87)).toBe('LOADING TAPE 087%');
    expect(formatLoading(0)).toBe('LOADING TAPE 000%');
    expect(formatLoading(100)).toBe('LOADING TAPE 100%');
  });
});
