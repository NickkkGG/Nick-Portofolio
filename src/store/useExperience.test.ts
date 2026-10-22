import { beforeEach, describe, expect, it } from 'vitest';
import type { ScrollApi } from '@/scroll/types';
import { initialExperienceState, useExperience } from './useExperience';

const store = () => useExperience.getState();

describe('experience store', () => {
  beforeEach(() => {
    useExperience.setState(initialExperienceState);
  });

  it('play starts once, spikes the VHS and starts scrolling', () => {
    let starts = 0;
    const api: ScrollApi = { start: () => starts++, stop: () => {}, jumpTo: () => {}, toChapter: () => {} };
    store().registerScroll(api);
    store().play();
    store().play();
    expect(starts).toBe(1);
    expect(store().started).toBe(true);
    expect(store().vhsSpike).toBe(1);
  });

  it('a forward wrap increments loopIndex and spikes the VHS', () => {
    store().setScroll(0.98);
    store().setScroll(0.02);
    expect(store().loopIndex).toBe(2);
    expect(store().vhsSpike).toBeGreaterThanOrEqual(0.6);
  });

  it('programmatic jumps never change loopIndex', () => {
    store().setScroll(0.98);
    store().setScroll(0.02, { programmatic: true });
    expect(store().loopIndex).toBe(1);
  });

  it('tick advances time and decays the spike unless frozen', () => {
    store().spikeVhs(1);
    store().tick(0.5);
    expect(store().time).toBe(0.5);
    expect(store().vhsSpike).toBeCloseTo(0.4);
    store().setFrozen(true);
    store().tick(0.5);
    expect(store().time).toBe(0.5);
    expect(store().vhsSpike).toBeCloseTo(0.4);
    expect(store().frame).toBe(2);
  });

  it('setScroll wraps p', () => {
    store().setScroll(1.02);
    expect(store().p).toBeCloseTo(0.02);
  });
});
