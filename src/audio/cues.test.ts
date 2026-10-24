import { describe, expect, it } from 'vitest';
import { CHAPTERS, type ChapterId } from '@/timeline/chapters';
import { LOOP_ARRIVE_T, LOOP_TELEPORT_T } from '@/timeline/loop';
import { lampNervousness } from '@/experience/chapters/room/knock';
import { flickerDips } from '@/experience/flicker';
import { BEAM_OUT_T, PROJECTOR_ON_T, SHEET_DROP_T, SLIDES } from '@/experience/chapters/booth/slides';
import { type Ambient, ambientSounds, dripsBetween, glitchesBetween, scrollCues } from './cues';

const at = (id: ChapterId, t: number) => {
  const chapter = CHAPTERS.find((c) => c.id === id)!;
  return chapter.start + (chapter.end - chapter.start) * t;
};
const PROJECTS = 6;
const SLIDES_COUNT = 6;
const cues = (from: number, to: number, programmatic = false) => scrollCues(from, to, programmatic, PROJECTS, SLIDES_COUNT);

describe('sounds the scroll sets off', () => {
  it('scrolling down out of the room breaks the floor into another world', () => {
    expect(cues(at('room', 0.95), at('fall', 0.02))).toEqual(['floor-break']);
  });

  it('the fall ends crashing into the booth', () => {
    expect(cues(at('fall', 0.98), at('about', 0.002))).toEqual(['landing']);
  });

  it('out through the booth window the work starts without switching channel', () => {
    expect(cues(at('about', 0.995), at('spiral', 0.005))).toEqual([]);
  });

  it('the projector starts once the dust is settling', () => {
    expect(cues(at('about', PROJECTOR_ON_T - 0.005), at('about', PROJECTOR_ON_T + 0.005))).toEqual(['projector']);
    expect(cues(at('about', PROJECTOR_ON_T + 0.005), at('about', PROJECTOR_ON_T - 0.005))).toEqual([]);
  });

  it('the carousel clicks at every slide change, either way, and at the blank after the last', () => {
    const span = (SLIDES.to - SLIDES.from) / 6;
    const change = SLIDES.from + 2 * span;
    expect(cues(at('about', change - 0.005), at('about', change + 0.005))).toEqual(['slide']);
    expect(cues(at('about', change + 0.005), at('about', change - 0.005))).toEqual(['slide']);
    expect(cues(at('about', SLIDES.to - 0.005), at('about', SLIDES.to + 0.005))).toEqual(['slide']);
    // One click a step, however many slides a fast scroll skips.
    expect(cues(at('about', 0.2), at('about', 0.6))).toEqual(['slide']);
  });

  it('the rope snaps scrolling on, and the beam finds the first monitor, which tunes in', () => {
    expect(cues(at('about', SHEET_DROP_T - 0.005), at('about', SHEET_DROP_T + 0.005))).toEqual(['sheet']);
    expect(cues(at('about', SHEET_DROP_T + 0.005), at('about', SHEET_DROP_T - 0.005))).toEqual([]);
    expect(cues(at('about', BEAM_OUT_T - 0.005), at('about', BEAM_OUT_T + 0.005))).toEqual(['tune']);
  });

  it('every other chapter change switches channel, and so does scrolling back up', () => {
    expect(cues(at('spiral', 0.99), at('problem', 0.01))).toEqual(['channel']);
    expect(cues(at('problem', 0.99), at('stack', 0.01))).toEqual(['channel']);
    expect(cues(at('fall', 0.02), at('room', 0.95))).toEqual(['channel']);
    expect(cues(at('spiral', 0.002), at('fall', 0.98))).toEqual(['channel']);
  });

  it('a jump (the nav, keys) only switches channel, whatever it skips', () => {
    expect(cues(at('room', 0.1), at('contact', 0.01), true)).toEqual(['channel']);
    expect(cues(at('room', 0.1), at('room', 0.5), true)).toEqual([]);
  });

  it('the bulb lights once, on the way down', () => {
    expect(cues(at('problem', 0.58), at('problem', 0.66))).toEqual(['bulb']);
    expect(cues(at('problem', 0.66), at('problem', 0.58))).toEqual([]);
  });

  it('the tapes come up out of the water', () => {
    expect(cues(at('contact', 0.05), at('contact', 0.1))).toEqual(['tapes']);
  });

  it('each new monitor on the pillar tunes in', () => {
    const tuned = [];
    for (let t = 0.01; t < 0.99; t += 0.002) tuned.push(...cues(at('spiral', t), at('spiral', t + 0.002)));
    expect(tuned.every((c) => c === 'tune')).toBe(true);
    expect(tuned.length).toBe(PROJECTS - 1);
  });

  it('falls back through the ceiling at the loop seam, and the room switches back on after', () => {
    expect(cues(at('loop', LOOP_TELEPORT_T - 0.02), at('loop', LOOP_TELEPORT_T + 0.02))).toEqual(['seam']);
    expect(cues(at('loop', LOOP_ARRIVE_T - 0.01), at('loop', LOOP_ARRIVE_T + 0.01))).toEqual(['channel']);
    // Round the loop's end: the room again, no switch.
    expect(cues(0.998, 0.002)).toEqual([]);
  });

  it('no movement, no sound', () => {
    expect(cues(0.4, 0.4)).toEqual([]);
    expect(cues(at('room', 0.2), at('room', 0.3))).toEqual([]);
  });
});

describe('sounds on the clock', () => {
  it('each drip on the water is heard once, about one a second', () => {
    let heard = 0;
    for (let t = 0; t < 60; t += 1 / 60) heard += dripsBetween(t, t + 1 / 60).length;
    expect(heard).toBeGreaterThan(50);
    expect(heard).toBeLessThan(80);
    const some = dripsBetween(10, 14);
    for (const drip of some) expect(Math.hypot(drip.x, drip.z)).toBeGreaterThan(1);
  });

  it('the problems glitch now and then, never in a steady beat', () => {
    const times: number[] = [];
    for (let t = 0; t < 120; t += 1 / 60) times.push(...glitchesBetween(t, t + 1 / 60));
    expect(times.length).toBeGreaterThan(25);
    expect(times.length).toBeLessThan(80);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.8);
  });
});

describe('the sounds of the place, frame by frame', () => {
  /** Every ambient sound over `seconds` of frames at a fixed progress `p`. */
  const listen = (p: number, seconds: number, knocks: number[] = [], start = 100) => {
    const heard: Ambient[] = [];
    for (let time = start; time < start + seconds; time += 1 / 60) heard.push(...ambientSounds(p, time, time + 1 / 60, knocks));
    return heard;
  };
  const named = (sounds: Ambient[], name: Ambient['name']) => sounds.filter((s) => s.name === name);

  it("the room's lamp crackles each time it dips, and nowhere else", () => {
    const p = at('room', 0.85);
    const crackles = named(listen(p, 30), 'crackle');
    expect(crackles.length).toBe(flickerDips(100, 130, { nervous: lampNervousness(0.85) }).length);
    expect(crackles.length).toBeGreaterThan(5);
    expect(named(listen(at('spiral', 0.5), 30), 'crackle')).toEqual([]);
  });

  it('a knock makes the lamp crackle right after it', () => {
    const crackles = named(listen(at('room', 0.05), 1, [100.2]), 'crackle');
    expect(crackles.some((c) => c.at > 100.2 && c.at < 100.35)).toBe(true);
  });

  it('drips fall below, under the pillar, and not up in the room or among the monitors', () => {
    for (const id of ['problem', 'stack', 'contact'] as const) expect(named(listen(at(id, 0.5), 10), 'drip').length, id).toBeGreaterThan(5);
    for (const id of ['room', 'fall', 'spiral'] as const) expect(named(listen(at(id, 0.5), 10), 'drip'), id).toEqual([]);
  });

  it('the problems glitch in the dark until the bulb lights', () => {
    expect(named(listen(at('problem', 0.3), 20), 'glitch').length).toBeGreaterThan(4);
    expect(named(listen(at('problem', 0.9), 20), 'glitch')).toEqual([]);
  });

  it('places every sound within the stereo field and at a sane loudness', () => {
    for (const sound of [...listen(at('room', 0.85), 10), ...listen(at('problem', 0.3), 10)]) {
      expect(Math.abs(sound.pan)).toBeLessThanOrEqual(1);
      expect(sound.level).toBeGreaterThan(0);
      expect(sound.level).toBeLessThanOrEqual(1);
    }
  });

  it('a jump of the clock (a tab coming back, a test setting it) plays nothing', () => {
    expect(ambientSounds(at('stack', 0.5), 100, 105, [])).toEqual([]);
    expect(ambientSounds(at('stack', 0.5), 100, 99, [])).toEqual([]);
  });
});
