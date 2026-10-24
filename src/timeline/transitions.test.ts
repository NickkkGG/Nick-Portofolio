import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter, LOOP_LENGTH_VH } from './chapters';
import { chapterP } from './resolve';
import { BOUNDARY_SPIKE, boundarySpike, FLOOR_BREAK_SPIKE, glassAt, LANDING_SPIKE, WINDOW_SPIKE } from './transitions';

const start = (id: Parameters<typeof getChapter>[0]) => getChapter(id).start;
/** One screen of scroll, in p. */
const screen = 100 / LOOP_LENGTH_VH;

describe('boundarySpike', () => {
  it('crossing into the fall gives the biggest tape glitch', () => {
    expect(boundarySpike(start('fall') - 0.001, start('fall') + 0.001)).toBe(FLOOR_BREAK_SPIKE);
    expect(FLOOR_BREAK_SPIKE).toBe(0.9);
  });

  it('landing in the booth knocks the tape hard, enough to hide the figure getting up', () => {
    expect(boundarySpike(start('about') - 0.001, start('about') + 0.001)).toBe(LANDING_SPIKE);
    expect(LANDING_SPIKE).toBeGreaterThan(0.5);
    expect(LANDING_SPIKE).toBeLessThan(FLOOR_BREAK_SPIKE);
  });

  it('floating out of the booth window into the work barely skips, either way', () => {
    expect(boundarySpike(start('spiral') - 0.001, start('spiral') + 0.001)).toBe(WINDOW_SPIKE);
    expect(boundarySpike(start('spiral') + 0.001, start('spiral') - 0.001)).toBe(WINDOW_SPIKE);
    expect(WINDOW_SPIKE).toBeLessThan(BOUNDARY_SPIKE);
  });

  it('crossing any other chapter boundary, either way, gives a light skip (the glass does the rest)', () => {
    expect(BOUNDARY_SPIKE).toBe(0.15);
    expect(boundarySpike(start('problem') - 0.001, start('problem') + 0.001)).toBe(BOUNDARY_SPIKE);
    expect(boundarySpike(start('problem') + 0.001, start('problem') - 0.001)).toBe(BOUNDARY_SPIKE);
    expect(boundarySpike(start('fall') + 0.001, start('fall') - 0.001)).toBe(BOUNDARY_SPIKE);
    expect(boundarySpike(start('about') + 0.001, start('about') - 0.001)).toBe(BOUNDARY_SPIKE);
  });

  it('a fast scroll over several boundaries keeps the strongest one', () => {
    expect(boundarySpike(0.05, chapterP('about', 0.5))).toBe(FLOOR_BREAK_SPIKE);
    expect(boundarySpike(chapterP('fall', 0.5), chapterP('spiral', 0.5))).toBe(LANDING_SPIKE);
  });

  it('no boundary crossed, or a loop wrap, gives nothing', () => {
    expect(boundarySpike(chapterP('spiral', 0.3), chapterP('spiral', 0.31))).toBe(0);
    expect(boundarySpike(0.99, 0.01)).toBe(0);
    expect(boundarySpike(0.01, 0.99)).toBe(0);
  });
});

describe('glassAt', () => {
  it('is clear glass, nothing at all, away from chapter changes', () => {
    for (const chapter of CHAPTERS) {
      for (const t of [0.4, 0.5, 0.6]) {
        expect(glassAt(chapterP(chapter.id, t)).amount, `${chapter.id} t=${t}`).toBe(0);
      }
    }
    expect(glassAt(0).amount).toBe(0);
    expect(glassAt(0.9995).amount).toBe(0);
  });

  it('thickens toward each chapter change and is thickest on it', () => {
    for (const chapter of CHAPTERS.slice(1)) {
      const b = chapter.start;
      const at = glassAt(b).amount;
      expect(at, chapter.id).toBeGreaterThan(0.2);
      expect(glassAt(b - 0.005).amount, chapter.id).toBeLessThan(at);
      expect(glassAt(b - 0.005).amount, chapter.id).toBeGreaterThan(0);
      expect(glassAt(b + 0.005).amount, chapter.id).toBeLessThan(at);
      expect(glassAt(b + 0.005).amount, chapter.id).toBeGreaterThan(0);
    }
  });

  it('is the same either side of the change, except where the floor gives way and where the figure lands', () => {
    for (const id of ['spiral', 'problem', 'stack', 'contact', 'loop'] as const) {
      const b = start(id);
      expect(Math.abs(glassAt(b - 0.004).amount - glassAt(b + 0.004).amount), id).toBeLessThan(1e-9);
    }
  });

  it('creeps in slowly over the last 0.42 screens of the room, and clears quickly once the camera drops', () => {
    const b = start('fall');
    // Over the last of the room the glass rises a little every step of the scroll, never in a jump.
    let previous = 0;
    for (let p = b - 0.42 * screen + 0.001; p <= b; p += 0.001) {
      const amount = glassAt(p).amount;
      expect(amount, `p=${p}`).toBeGreaterThan(previous);
      expect(amount - previous, `p=${p}`).toBeLessThan(0.06);
      previous = amount;
    }
    expect(glassAt(b - 0.28 * screen).amount).toBeGreaterThan(0.05);
    expect(glassAt(b + 0.21 * screen).amount).toBe(0);
    expect(glassAt(b - 0.14 * screen).amount).toBeGreaterThan(glassAt(b + 0.14 * screen).amount);
  });

  it('the landing hits the glass at once and clears slowly with the dust', () => {
    const b = start('about');
    expect(glassAt(b).amount).toBeGreaterThan(0.6);
    expect(glassAt(b - 0.008).amount).toBeLessThan(glassAt(b + 0.008).amount);
  });

  it('the big descents go through the thickest glass; the booth window only brushes it', () => {
    const at = (id: 'spiral' | 'problem' | 'stack') => glassAt(start(id)).amount;
    expect(at('problem')).toBe(1);
    expect(at('stack')).toBeLessThan(at('problem'));
    expect(at('spiral')).toBeLessThan(0.5);
  });

  it('each chapter change has its own pane, so no two look the same', () => {
    const seeds = new Set(CHAPTERS.slice(1).map((chapter) => glassAt(chapter.start).seed));
    expect(seeds.size).toBe(CHAPTERS.length - 1);
  });
});
