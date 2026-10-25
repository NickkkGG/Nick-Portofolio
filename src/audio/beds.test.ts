import { describe, expect, it } from 'vitest';
import { CHAPTERS, type ChapterId } from '@/timeline/chapters';
import { BEAM_OUT_T } from '@/experience/chapters/booth/slides';
import { bedLevels } from './beds';

const at = (id: ChapterId, t: number) => {
  const chapter = CHAPTERS.find((c) => c.id === id)!;
  return chapter.start + (chapter.end - chapter.start) * t;
};

describe('the sound under each chapter', () => {
  it('static hisses only among the project monitors, louder when they surge', () => {
    const calm = bedLevels(at('spiral', 0.5), 0, 0);
    expect(calm.static).toBeGreaterThan(0.2);
    for (const id of ['room', 'fall', 'stack', 'contact'] as const) expect(bedLevels(at(id, 0.5), 0, 0).static).toBe(0);
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
    expect(bedLevels(at('stack', 0.08), 0, 0).hum).toBe(0);
  });

  it('a drone holds in the dark coming down off the pillar, until the bulb lights', () => {
    expect(bedLevels(at('stack', 0.08), 0, 0).dark).toBeGreaterThan(0.3);
    expect(bedLevels(at('stack', 0.5), 0, 0).dark).toBeLessThan(0.05);
    expect(bedLevels(at('contact', 0.5), 0, 0).dark).toBe(0);
  });

  it('the first monitor hisses in gently once the beam finds it, so the static never cuts in', () => {
    expect(bedLevels(at('about', 0.5), 0, 0).static).toBe(0);
    expect(bedLevels(at('about', BEAM_OUT_T), 0, 0).static).toBeCloseTo(0, 6);
    expect(bedLevels(at('about', 0.92), 0, 0).static).toBeGreaterThan(0);
    expect(bedLevels(at('about', 0.92), 0, 0).static).toBeLessThan(0.5 * bedLevels(at('spiral', 0.5), 0, 0).static);
  });

  it('the projector fan hums in the booth once its lamp is on, and stays behind as the camera floats out', () => {
    expect(bedLevels(at('about', 0.005), 0, 0).projector).toBe(0);
    expect(bedLevels(at('about', 0.5), 0, 0).projector).toBeGreaterThan(0.3);
    expect(bedLevels(at('about', 0.99), 0, 0).projector).toBeLessThan(bedLevels(at('about', 0.5), 0, 0).projector);
    expect(bedLevels(at('spiral', 0.2), 0, 0).projector).toBe(0);
    for (const id of ['room', 'fall', 'stack', 'contact'] as const) expect(bedLevels(at(id, 0.5), 0, 0).projector).toBe(0);
  });

  it('fades in and out at the chapter edges instead of cutting, and carries on through the booth window', () => {
    expect(bedLevels(at('spiral', 0.999), 0, 0).static).toBeLessThan(0.05);
    expect(bedLevels(at('fall', 0.001), 0, 0).wind).toBeLessThan(0.05);
    const out = bedLevels(at('about', 0.9999), 0, 0);
    const into = bedLevels(at('spiral', 0.0001), 0, 0);
    expect(Math.abs(out.static - into.static)).toBeLessThan(0.02);
    expect(Math.abs(out.projector - into.projector)).toBeLessThan(0.02);
  });

  it('never goes past full', () => {
    for (let p = 0; p < 1; p += 0.003) for (const level of Object.values(bedLevels(p, p * 97, 1))) expect(level).toBeLessThanOrEqual(1);
  });
});
