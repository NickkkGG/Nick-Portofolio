import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter } from '@/timeline/chapters';
import { LOOP_TELEPORT_P } from '@/timeline/loop';
import { moodAt } from './mood';

const at = (id: Parameters<typeof getChapter>[0], t: number) => {
  const c = getChapter(id);
  return c.start + (c.end - c.start) * t;
};

describe('the soundtrack mood', () => {
  it('every chapter sounds like music: an open tone, a few notes, audible', () => {
    for (const chapter of CHAPTERS) {
      const mood = moodAt(at(chapter.id, 0.5));
      expect(mood.tone, chapter.id).toBeGreaterThan(800);
      expect(mood.pad, chapter.id).toBeLessThan(mood.tone);
      expect(mood.notes, chapter.id).toBeGreaterThanOrEqual(0);
      expect(mood.notes, chapter.id).toBeLessThan(0.5);
      expect(mood.level, chapter.id).toBeGreaterThan(0);
    }
  });

  it('is muffled and tense while the problems circle, and opens once the bulb lights', () => {
    const dark = moodAt(at('problem', 0.3));
    const lit = moodAt(at('problem', 0.9));
    expect(dark.tone).toBeLessThan(lit.tone);
    expect(dark.notes).toBeLessThan(lit.notes);
    expect(dark.pedal).toBeGreaterThan(lit.pedal);
  });

  it('sinks with the picture into the loop blackout, and is back for the room', () => {
    expect(moodAt(LOOP_TELEPORT_P).level).toBeLessThan(0.5);
    expect(moodAt(at('loop', 0.9)).level).toBeGreaterThan(0.9);
  });

  it('sounds the same on both sides of the loop seam', () => {
    expect(moodAt(0.9999)).toEqual(moodAt(0));
    expect(moodAt(0.2)).toEqual(moodAt(1.2));
  });
});
