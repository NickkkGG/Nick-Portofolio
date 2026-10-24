import { describe, expect, it } from 'vitest';
import { getChapter } from './chapters';
import { displayState, LOOP_TELEPORT_P } from './loop';
import { chapterP } from './resolve';
import { isVisible } from './visibility';

describe('visibility', () => {
  it('room is visible at the start and after the teleport', () => {
    expect(isVisible('room', 0)).toBe(true);
    expect(isVisible('room', getChapter('room').end + 0.01)).toBe(true);
    expect(isVisible('room', LOOP_TELEPORT_P + 0.005)).toBe(true);
    expect(isVisible('room', 0.5)).toBe(false);
  });

  it('depths stays lit from the ideas to the teleport', () => {
    expect(isVisible('depths', chapterP('problem', 0.2))).toBe(true);
    expect(isVisible('depths', chapterP('contact', 0.9))).toBe(true);
    expect(isVisible('depths', LOOP_TELEPORT_P + 0.005)).toBe(false);
  });

  it('the booth is there from the end of the fall until the camera is past the first monitor', () => {
    expect(isVisible('about', chapterP('fall', 0.85))).toBe(true);
    expect(isVisible('about', chapterP('about', 0.5))).toBe(true);
    expect(isVisible('about', chapterP('spiral', 0.1))).toBe(true);
    expect(isVisible('about', chapterP('fall', 0.3))).toBe(false);
    expect(isVisible('about', chapterP('spiral', 0.5))).toBe(false);
  });

  it('the pillar stays out of the fall and the booth, and shows through the window once the sheet is down', () => {
    for (const t of [0.5, 0.8, 0.9, 0.99]) expect(isVisible('spiral', chapterP('fall', t)), `fall t=${t}`).toBe(false);
    expect(isVisible('spiral', chapterP('about', 0.05))).toBe(false);
    expect(isVisible('spiral', chapterP('about', 0.5))).toBe(false);
    expect(isVisible('spiral', chapterP('about', 0.9))).toBe(true);
    expect(isVisible('spiral', chapterP('spiral', 0.5))).toBe(true);
  });

  it('the chapter shown in the UI is always rendered', () => {
    for (let i = 0; i < 1000; i++) {
      const p = i / 1000;
      expect(isVisible(displayState(p).chapterId, p), `p=${p}`).toBe(true);
    }
  });
});
