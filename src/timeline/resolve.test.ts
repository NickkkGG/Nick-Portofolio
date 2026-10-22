import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter } from './chapters';
import { chapterStartP, localProgress, resolve, wrapProgress } from './resolve';

describe('timeline', () => {
  it('chapters cover [0,1) without gaps', () => {
    expect(CHAPTERS[0].start).toBe(0);
    expect(CHAPTERS.at(-1)!.end).toBe(1);
    for (let i = 1; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].start).toBe(CHAPTERS[i - 1].end);
    }
  });

  it('codes and labels match the spec', () => {
    const osd = (id: Parameters<typeof getChapter>[0]) => `${getChapter(id).code} / ${getChapter(id).label}`;
    expect(osd('room')).toBe('CH-01 / ROOM');
    expect(osd('spiral')).toBe('CH-03 / WORK');
    expect(osd('problem')).toBe('CH-04 / ABOUT');
    expect(osd('contact')).toBe('CH-06 / CONTACT');
    expect(osd('loop')).toBe('CH-07 / LOOP');
  });

  it('resolve is end-exclusive', () => {
    expect(resolve(0)).toMatchObject({ chapter: { id: 'room' }, t: 0 });
    expect(resolve(0.1)).toMatchObject({ chapter: { id: 'fall' }, t: 0 });
    const fallMid = resolve(0.18);
    expect(fallMid.chapter.id).toBe('fall');
    expect(fallMid.t).toBeCloseTo(0.5);
    const loopEnd = resolve(0.999);
    expect(loopEnd.chapter.id).toBe('loop');
    expect(loopEnd.t).toBeCloseTo(0.9875);
  });

  it('resolve wraps values outside [0,1)', () => {
    expect(resolve(1).chapter.id).toBe('room');
    const before = resolve(-0.01);
    expect(before.chapter.id).toBe('loop');
    expect(before.t).toBeCloseTo(0.875);
    const after = resolve(1.18);
    expect(after.chapter.id).toBe('fall');
    expect(after.t).toBeCloseTo(0.5);
  });

  it('localProgress clamps outside the chapter', () => {
    expect(localProgress(0.05, 'spiral')).toBe(0);
    expect(localProgress(0.7, 'spiral')).toBe(1);
    expect(localProgress(0.41, 'spiral')).toBeCloseTo(0.5);
  });

  it('wrapProgress', () => {
    expect(wrapProgress(1.25)).toBeCloseTo(0.25);
    expect(wrapProgress(-0.25)).toBeCloseTo(0.75);
    expect(wrapProgress(0)).toBe(0);
  });

  it('chapterStartP', () => {
    expect(chapterStartP('problem')).toBe(0.56);
  });
});
