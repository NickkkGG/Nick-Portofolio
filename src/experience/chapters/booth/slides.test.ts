import { describe, expect, it } from 'vitest';
import { getChapter, LOOP_LENGTH_VH } from '@/timeline/chapters';
import { chapterP } from '@/timeline/resolve';
import { BEAM_OUT_T, firstMonitorPower, gateDrop, lampLevel, SHEET_DROP_T, sheetDrop, shutter, slideAt, slideFocus, slideNumber, SLIDES, standUp } from './slides';

/** Screens of scroll for a stretch of the about chapter's t. */
const screens = (dt: number) => {
  const { start, end } = getChapter('about');
  return (dt * (end - start) * LOOP_LENGTH_VH) / 100;
};

describe('the booth slides', () => {
  it('six slides share the stretch from the projector warming up to the blank', () => {
    expect(slideAt(SLIDES.from - 0.001, 6).index).toBe(-1);
    expect(slideAt(SLIDES.from + 0.001, 6).index).toBe(0);
    expect(slideAt(SLIDES.to - 0.001, 6).index).toBe(5);
    expect(slideAt(SLIDES.to + 0.001, 6).index).toBe(6);
  });

  it('each of six slides stays on the sheet for about half a screen of scroll, most of it sharp', () => {
    const span = (SLIDES.to - SLIDES.from) / 6;
    expect(screens(span)).toBeGreaterThan(0.45);
    expect(screens(span)).toBeLessThan(0.6);
    let sharp = 0;
    for (let k = 0; k < 1000; k++) if (slideFocus(k / 1000) === 1 && shutter(k / 1000) === 1) sharp++;
    expect(screens((span * sharp) / 1000)).toBeGreaterThan(0.38);
  });

  it('even eight slides stay readable for a third of a screen', () => {
    expect(screens((SLIDES.to - SLIDES.from) / 8)).toBeGreaterThan(0.33);
  });

  it('local runs 0 to 1 across each slide', () => {
    const span = (SLIDES.to - SLIDES.from) / 6;
    const mid = slideAt(SLIDES.from + 2.5 * span, 6);
    expect(mid.index).toBe(2);
    expect(mid.local).toBeCloseTo(0.5);
  });

  it('a slide drops into the dark gate, then comes up blurred and pulls into focus', () => {
    expect(shutter(0)).toBe(0);
    expect(shutter(0.03)).toBeGreaterThan(0);
    expect(shutter(0.06)).toBe(1);
    expect(slideFocus(0.06)).toBe(0);
    expect(slideFocus(0.11)).toBeGreaterThan(0);
    expect(slideFocus(0.11)).toBeLessThan(1);
    expect(slideFocus(0.16)).toBe(1);
    expect(slideFocus(0.9)).toBe(1);
  });

  it('a slide drops into the gate from above and settles before the light is full on it', () => {
    expect(gateDrop(0)).toBeGreaterThan(0.03);
    expect(gateDrop(0.03)).toBeLessThan(gateDrop(0));
    expect(gateDrop(0.06)).toBe(0);
    expect(gateDrop(0.5)).toBe(0);
  });

  it('the lamp is off as the figure crashes in, then warms up before the first slide', () => {
    expect(lampLevel(0)).toBe(0);
    expect(lampLevel(0.02)).toBeGreaterThan(0);
    expect(lampLevel(SLIDES.from)).toBe(1);
    expect(lampLevel(0.95)).toBe(1);
  });

  it('after the blank the rope snaps and the sheet falls, faster and faster', () => {
    expect(SHEET_DROP_T).toBeGreaterThan(SLIDES.to);
    expect(sheetDrop(SHEET_DROP_T)).toBe(0);
    expect(sheetDrop(SHEET_DROP_T + 0.01)).toBeLessThan(0.25);
    expect(sheetDrop(BEAM_OUT_T)).toBe(1);
    expect(sheetDrop(0.5)).toBe(0);
  });

  it('the figure gets up once the beam is out of the window', () => {
    expect(standUp(BEAM_OUT_T)).toBe(0);
    expect(standUp(0.9)).toBeGreaterThan(0);
    expect(standUp(0.95)).toBe(1);
    expect(standUp(0.5)).toBe(0);
  });

  it('numbers the slide in the gate for the on-screen display, and nothing else', () => {
    const span = (SLIDES.to - SLIDES.from) / 6;
    expect(slideNumber(chapterP('about', SLIDES.from + 0.5 * span), 6)).toBe(1);
    expect(slideNumber(chapterP('about', SLIDES.from + 5.5 * span), 6)).toBe(6);
    expect(slideNumber(chapterP('about', 0.03), 6)).toBeNull();
    expect(slideNumber(chapterP('about', 0.83), 6)).toBeNull();
    expect(slideNumber(chapterP('spiral', 0.5), 6)).toBeNull();
  });

  it('the menu lands on the first slide, already in the gate and sharp', () => {
    const { index, local } = slideAt(getChapter('about').entry, 6);
    expect(index).toBe(0);
    expect(shutter(local)).toBe(1);
    expect(slideFocus(local)).toBe(1);
  });

  it('the first monitor stays dark until the beam finds it, then is on for the whole work', () => {
    expect(firstMonitorPower(chapterP('about', 0.5))).toBe(0);
    expect(firstMonitorPower(chapterP('about', BEAM_OUT_T - 0.01))).toBe(0);
    expect(firstMonitorPower(chapterP('about', BEAM_OUT_T + 0.05))).toBe(1);
    expect(firstMonitorPower(chapterP('spiral', 0.5))).toBe(1);
    expect(firstMonitorPower(chapterP('fall', 0.95))).toBe(0);
  });
});
