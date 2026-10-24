import { describe, expect, it } from 'vitest';
import { CHAPTERS, type ChapterId } from '@/timeline/chapters';
import { bedLevels } from './beds';

const at = (id: ChapterId, t: number) => {
  const chapter = CHAPTERS.find((c) => c.id === id)!;
  return chapter.start + (chapter.end - chapter.start) * t;
};

describe('the sound under each chapter', () => {
  it('static hisses only among the project monitors, louder when they surge', () => {
    const calm = bedLevels(at('spiral', 0.5), 0, 0);
    expect(calm.static).toBeGreaterThan(0.2);
    for (const id of ['room', 'fall', 'problem', 'contact'] as const) expect(bedLevels(at(id, 0.5), 0, 0).static).toBe(0);
    let loudest = 0;
    for (let time = 0; time < 30; time += 0.01) loudest = Math.max(loudest, bedLevels(at('spiral', 0.5), time, 0).static);
    expect(loudest).toBeGreaterThan(calm.static + 0.2);
  });

  it('the fall roars, louder the faster the scroll', () => {
    const still = bedLevels(at('fall', 0.5), 0, 0).wind;
    const fast = bedLevels(at('fall', 0.5), 0, 0.2).wind;
    expect(still).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(still * 1.8);
    expect(bedLevels(at('room', 0.5), 0, 0.2).wind).toBe(0);
  });

  it('the room has its mains hum, and so has the end of the loop that already shows it', () => {
    expect(bedLevels(at('room', 0.3), 0, 0).hum).toBeGreaterThan(0);
    expect(bedLevels(at('loop', 0.95), 0, 0).hum).toBeGreaterThan(0);
    expect(bedLevels(at('spiral', 0.5), 0, 0).hum).toBe(0);
  });

  it('the loop falls back through the dark onto the roof with the wind in its ears', () => {
    expect(bedLevels(at('loop', 0.6), 0, 0).wind).toBeGreaterThan(0.2);
    expect(bedLevels(at('loop', 0.2), 0, 0).wind).toBe(0);
  });

  it('the lit bulb hums over the stack and the contact tapes, and not before it lights', () => {
    expect(bedLevels(at('stack', 0.5), 0, 0).hum).toBeGreaterThan(0);
    expect(bedLevels(at('contact', 0.5), 0, 0).hum).toBeGreaterThan(0);
    expect(bedLevels(at('problem', 0.3), 0, 0).hum).toBe(0);
  });

  it('a drone holds in the dark until the bulb lights', () => {
    expect(bedLevels(at('problem', 0.3), 0, 0).dark).toBeGreaterThan(0.3);
    expect(bedLevels(at('problem', 0.9), 0, 0).dark).toBeLessThan(0.05);
    expect(bedLevels(at('stack', 0.5), 0, 0).dark).toBe(0);
  });

  it('fades in and out at the chapter edges instead of cutting', () => {
    expect(bedLevels(at('spiral', 0.001), 0, 0).static).toBeLessThan(0.05);
    expect(bedLevels(at('spiral', 0.999), 0, 0).static).toBeLessThan(0.05);
    expect(bedLevels(at('fall', 0.001), 0, 0).wind).toBeLessThan(0.05);
  });

  it('never goes past full', () => {
    for (let p = 0; p < 1; p += 0.003) for (const level of Object.values(bedLevels(p, p * 97, 1))) expect(level).toBeLessThanOrEqual(1);
  });
});
