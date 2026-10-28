import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { chapterP, localProgress } from '@/timeline/resolve';
import { isVisible } from '@/timeline/visibility';
import { BEAM_OUT_T, firstMonitorPower } from '../booth/slides';
import { monitorFocus } from './helix';
import {
  DROP_OUT_S,
  heldVideoTime,
  NO_SIGNAL,
  type Reception,
  receptionLook,
  tune,
  TUNE_IN_S,
  videoRuns,
  wantsPicture,
} from './signal';

/** `seconds` of frames at 60 fps. */
function run(from: Reception, seconds: number, wanted: boolean, ready: boolean): Reception {
  let reception = from;
  for (let i = 0; i < Math.round(seconds * 60); i++) reception = tune(reception, 1 / 60, wanted, ready);
  return reception;
}

const LOCKED: Reception = { level: 1, tuning: true };

describe('a project screen tuning in to its preview', () => {
  it('shows static until the camera parks in front of it', () => {
    expect(run(NO_SIGNAL, 3, false, true)).toEqual(NO_SIGNAL);
  });

  it('shows static while the video has no frames yet, or never gets any', () => {
    expect(run(NO_SIGNAL, 3, true, false)).toEqual(NO_SIGNAL);
  });

  it('takes about a second to lock the picture in', () => {
    expect(TUNE_IN_S).toBeGreaterThanOrEqual(0.9);
    expect(TUNE_IN_S).toBeLessThanOrEqual(1.3);
    const almost = run(NO_SIGNAL, TUNE_IN_S - 0.1, true, true);
    expect(almost.level).toBeGreaterThan(0.8);
    expect(almost.level).toBeLessThan(1);
    expect(almost.tuning).toBe(true);
    expect(run(NO_SIGNAL, TUNE_IN_S + 0.05, true, true)).toEqual(LOCKED);
  });

  it('breaks back to static quickly once the camera moves on', () => {
    expect(DROP_OUT_S).toBeLessThan(0.5);
    const going = run(LOCKED, DROP_OUT_S - 0.1, false, true);
    expect(going.level).toBeGreaterThan(0);
    expect(going.tuning).toBe(false);
    expect(run(LOCKED, DROP_OUT_S + 0.05, false, true)).toEqual(NO_SIGNAL);
  });

  it('loses the picture when the video stops giving frames', () => {
    expect(run(LOCKED, 1, true, false)).toEqual(NO_SIGNAL);
  });

  it('settles at once for a frozen clock, and never runs backwards', () => {
    expect(tune(NO_SIGNAL, Infinity, true, true)).toEqual(LOCKED);
    expect(tune(LOCKED, Infinity, false, true)).toEqual(NO_SIGNAL);
    expect(tune({ level: 0.4, tuning: true }, -2, true, true).level).toBe(0.4);
    expect(tune({ level: 0.4, tuning: true }, Number.NaN, true, true).level).toBe(0.4);
  });
});

describe('what the screen draws', () => {
  it('static shows none of the picture; a locked picture is whole and still', () => {
    expect(receptionLook(NO_SIGNAL).picture).toBe(0);
    expect(receptionLook(LOCKED)).toEqual({ picture: 1, roll: 0, tear: 0 });
  });

  it('while tuning in, the picture rolls up and slows to a stop, its lines tear less, and the static thins', () => {
    let before = receptionLook({ level: 0.2, tuning: true });
    expect(before.roll).toBeGreaterThan(0.5);
    for (const level of [0.4, 0.6, 0.8, 0.95]) {
      const look = receptionLook({ level, tuning: true });
      expect(look.roll, `level ${level}`).toBeLessThan(before.roll);
      expect(look.tear, `level ${level}`).toBeLessThan(before.tear);
      expect(look.picture, `level ${level}`).toBeGreaterThan(before.picture);
      before = look;
    }
  });

  it('dropping out tears the picture into static without rolling it', () => {
    const look = receptionLook({ level: 0.5, tuning: false });
    expect(look.roll).toBe(0);
    expect(look.tear).toBeGreaterThan(0);
    expect(look.picture).toBeGreaterThan(0);
    expect(look.picture).toBeLessThan(1);
  });
});

describe('the video behind the screen', () => {
  it('runs while its picture is wanted, so it has frames by the time the static clears', () => {
    expect(videoRuns(NO_SIGNAL, true)).toBe(true);
  });

  it('keeps running while the picture breaks up, and rests once the screen is static', () => {
    expect(videoRuns({ level: 0.3, tuning: false }, false)).toBe(true);
    expect(videoRuns(NO_SIGNAL, false)).toBe(false);
  });

  it('holds the frame at that moment of its loop for a frozen clock', () => {
    expect(heldVideoTime(20, 12)).toBeCloseTo(8);
    expect(heldVideoTime(3, 12)).toBeCloseTo(3);
    // Before its metadata arrives the length is unknown.
    expect(heldVideoTime(5, Number.NaN)).toBe(0);
  });
});

describe('when the first monitor wants its preview', () => {
  const count = content.projects.length;
  const first = (p: number) =>
    wantsPicture(monitorFocus(localProgress(p, 'spiral'), 0, count), firstMonitorPower(p), isVisible('spiral', p));

  it('from the moment the beam switches it on, seen through the booth window', () => {
    expect(first(chapterP('about', BEAM_OUT_T - 0.01))).toBe(false);
    expect(first(chapterP('about', 0.95))).toBe(true);
  });

  it('while the camera is parked in front of it', () => {
    expect(first(chapterP('spiral', 0.1))).toBe(true);
    expect(first(chapterP('spiral', 0.17))).toBe(true);
  });

  it('no longer at the next monitor, nor anywhere the project world is out of sight', () => {
    expect(first(chapterP('spiral', 0.26))).toBe(false);
    expect(first(chapterP('stack', 0.5))).toBe(false);
    // Back in the room after the loop it counts as the monitor ahead again, but nobody sees it.
    expect(first(chapterP('room', 0.5))).toBe(false);
  });

  it('never while it is switched off', () => {
    expect(wantsPicture(1, 0, true)).toBe(false);
  });
});
