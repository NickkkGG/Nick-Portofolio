import { beforeEach, describe, expect, it } from 'vitest';
import type { ScrollApi } from '@/scroll/types';
import { initialExperienceState, useExperience } from './useExperience';
import { getChapter } from '@/timeline/chapters';
import { BOUNDARY_SPIKE } from '@/timeline/transitions';

const FALL = getChapter('fall').start;
const IDEAS = getChapter('problem').start;

const store = () => useExperience.getState();

describe('experience store', () => {
  beforeEach(() => {
    useExperience.setState(initialExperienceState);
  });

  it('play starts once, spikes the VHS and starts scrolling', () => {
    let starts = 0;
    const api: ScrollApi = { start: () => starts++, stop: () => {}, jumpTo: () => {}, toChapter: () => {}, raf: () => {} };
    store().registerScroll(api);
    store().play();
    store().play();
    expect(starts).toBe(1);
    expect(store().started).toBe(true);
    expect(store().vhsSpike).toBe(1);
  });

  it('the warm-up only ever moves forward, and the scene being ready completes it', () => {
    expect(store().warmup).toBe(0);
    store().setWarmup(0.4);
    store().setWarmup(0.2);
    expect(store().warmup).toBe(0.4);
    store().setSceneReady();
    expect(store().sceneReady).toBe(true);
    expect(store().warmup).toBe(1);
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

  it('scrolling into the fall glitches the tape hard, other chapter changes a little', () => {
    store().setScroll(FALL - 0.001);
    store().setScroll(FALL + 0.001);
    expect(store().vhsSpike).toBe(0.9);
    useExperience.setState({ vhsSpike: 0 });
    store().setScroll(IDEAS - 0.001);
    store().setScroll(IDEAS + 0.001);
    expect(store().vhsSpike).toBe(BOUNDARY_SPIKE);
  });

  it('programmatic jumps across chapters do not glitch', () => {
    store().setScroll(0.05, { programmatic: true });
    store().setScroll(0.4, { programmatic: true });
    expect(store().vhsSpike).toBe(0);
  });

  it('setScroll wraps p', () => {
    store().setScroll(1.02);
    expect(store().p).toBeCloseTo(0.02);
  });

  it('a knock in the room raises the tension and logs a knock sound where it hit', () => {
    store().setScroll(0.01, { programmatic: true });
    store().tick(3);
    expect(store().knockAt([0.5, 2.2, -1.18])).toBe(true);
    expect(store().knock.knocks).toEqual([3]);
    expect(store().knock.tension).toBe(1);
    expect(store().sounds).toEqual([{ name: 'knock', time: 3, position: [0.5, 2.2, -1.18] }]);
    expect(store().knock.heard).toEqual([{ at: 3, point: [0.5, 2.2, -1.18] }]);
  });

  it('knocks outside the room do nothing', () => {
    store().setScroll(0.3, { programmatic: true });
    expect(store().knockAt([0, 2, -1.18])).toBe(false);
    expect(store().knock.knocks).toEqual([]);
    expect(store().sounds).toEqual([]);
  });

  it('a knock too soon after the last one is not heard', () => {
    store().knockAt([0, 2, -1.18]);
    store().tick(0.3);
    expect(store().knockAt([0, 2, -1.18])).toBe(false);
    expect(store().sounds).toHaveLength(1);
  });

  it('PLAY switches the set on with its sound', () => {
    store().tick(2);
    store().play();
    store().play();
    expect(store().sounds).toEqual([{ name: 'power-on', time: 2 }]);
  });

  it('once playing, scrolling logs the sounds of the story: the floor giving way, a jump switching channel', () => {
    store().play();
    store().tick(1);
    store().setScroll(FALL - 0.001);
    store().setScroll(FALL + 0.001);
    store().setScroll(0.5, { programmatic: true });
    expect(store().sounds.map((s) => s.name)).toEqual(['power-on', 'floor-break', 'channel']);
    expect(store().sounds[1].time).toBe(1);
  });

  it('nothing sounds before PLAY', () => {
    store().setScroll(FALL - 0.001);
    store().setScroll(FALL + 0.001);
    store().setScroll(0.5, { programmatic: true });
    expect(store().sounds).toEqual([]);
  });

  it('playing, scrolling and knocking all count as activity', () => {
    store().tick(2);
    store().play();
    expect(store().lastActivity).toBe(2);
    store().tick(3);
    store().setScroll(0.02);
    expect(store().lastActivity).toBe(5);
    store().tick(4);
    store().knockAt([0, 2, -1.18]);
    expect(store().lastActivity).toBe(9);
  });
});
