import { describe, expect, it } from 'vitest';
import { CHAPTERS, getChapter, LOOP_LENGTH_VH } from './chapters';
import { chapterEntryP, chapterP, chapterStartP, localProgress, resolve, wrapProgress } from './resolve';

/** A chapter's length in screens of scroll. */
const screens = (id: Parameters<typeof getChapter>[0]) => ((getChapter(id).end - getChapter(id).start) * LOOP_LENGTH_VH) / 100;

describe('timeline', () => {
  it('chapters cover [0,1) without gaps', () => {
    expect(CHAPTERS[0].start).toBe(0);
    expect(CHAPTERS.at(-1)!.end).toBe(1);
    for (let i = 1; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].start).toBe(CHAPTERS[i - 1].end);
    }
  });

  it('the story introduces its owner between the fall and the work', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['room', 'fall', 'about', 'spiral', 'problem', 'stack', 'contact', 'loop']);
  });

  it('codes and labels match the spec', () => {
    const osd = (id: Parameters<typeof getChapter>[0]) => `${getChapter(id).code} / ${getChapter(id).label}`;
    expect(osd('room')).toBe('CH-01 / ROOM');
    expect(osd('fall')).toBe('CH-02 / FALL');
    expect(osd('about')).toBe('CH-03 / ABOUT');
    expect(osd('spiral')).toBe('CH-04 / WORK');
    expect(osd('problem')).toBe('CH-05 / IDEAS');
    expect(osd('contact')).toBe('CH-07 / CONTACT');
    expect(osd('loop')).toBe('CH-08 / LOOP');
  });

  it('one loop is 17 screens: the room and the work keep their length, the fall is shorter', () => {
    expect(LOOP_LENGTH_VH).toBe(1700);
    expect(screens('room')).toBeCloseTo(1.4);
    expect(screens('fall')).toBeCloseTo(1.7);
    expect(screens('about')).toBeCloseTo(4);
    expect(screens('spiral')).toBeCloseTo(4.2);
  });

  it('resolve is end-exclusive', () => {
    const fall = getChapter('fall');
    expect(resolve(0)).toMatchObject({ chapter: { id: 'room' }, t: 0 });
    expect(resolve(fall.start)).toMatchObject({ chapter: { id: 'fall' }, t: 0 });
    expect(resolve(fall.end)).toMatchObject({ chapter: { id: 'about' }, t: 0 });
    const fallMid = resolve((fall.start + fall.end) / 2);
    expect(fallMid.chapter.id).toBe('fall');
    expect(fallMid.t).toBeCloseTo(0.5);
    const loopEnd = resolve(0.999);
    expect(loopEnd.chapter.id).toBe('loop');
    expect(loopEnd.t).toBeCloseTo((0.999 - getChapter('loop').start) / (1 - getChapter('loop').start));
  });

  it('resolve wraps values outside [0,1)', () => {
    expect(resolve(1).chapter.id).toBe('room');
    const before = resolve(-0.01);
    expect(before.chapter.id).toBe('loop');
    expect(before.t).toBeCloseTo(localProgress(0.99, 'loop'));
    const after = resolve(1 + chapterP('fall', 0.5));
    expect(after.chapter.id).toBe('fall');
    expect(after.t).toBeCloseTo(0.5);
  });

  it('localProgress clamps outside the chapter', () => {
    expect(localProgress(0.05, 'spiral')).toBe(0);
    expect(localProgress(0.75, 'spiral')).toBe(1);
    expect(localProgress(chapterP('spiral', 0.5), 'spiral')).toBeCloseTo(0.5);
  });

  it('chapterP turns chapter-local t back into p', () => {
    const about = getChapter('about');
    expect(chapterP('about', 0)).toBe(about.start);
    expect(chapterP('about', 1)).toBe(about.end);
    expect(chapterP('about', 0.25)).toBeCloseTo(about.start + 0.25 * (about.end - about.start));
  });

  it('wrapProgress', () => {
    expect(wrapProgress(1.25)).toBeCloseTo(0.25);
    expect(wrapProgress(-0.25)).toBeCloseTo(0.75);
    expect(wrapProgress(0)).toBe(0);
  });

  it('a jump to a chapter lands a hair past its start, but in the booth on the first slide', () => {
    expect(chapterEntryP('spiral')).toBeCloseTo(getChapter('spiral').start + 0.002);
    expect(chapterEntryP('room')).toBeCloseTo(0.002);
    expect(getChapter('about').entry).toBeGreaterThan(0);
    expect(chapterEntryP('about')).toBeCloseTo(chapterP('about', getChapter('about').entry));
  });

  it('chapterStartP', () => {
    expect(chapterStartP('about')).toBeCloseTo(3.1 / 17);
  });
});
