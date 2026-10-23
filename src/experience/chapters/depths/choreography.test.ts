import { describe, expect, it } from 'vitest';
import { getChapter } from '@/timeline/chapters';
import {
  bulbDrop,
  bulbIntensity,
  CASSETTE_HALF_HEIGHT,
  CASSETTE_REACH,
  CASSETTE_WIDTH,
  cassettePose,
  characterPose,
  dripRipples,
  keycapPose,
  keycapState,
  MAX_RIPPLES,
  problemPose,
  RIPPLE_LIFE,
  SEAT_TOP,
  tapeLayout,
} from './choreography';

const at = (id: 'problem' | 'stack' | 'contact' | 'loop', t: number) => {
  const c = getChapter(id);
  return c.start + (c.end - c.start) * t;
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const radius = (p: number[]) => Math.hypot(p[0], p[2]);

describe('the bulb', () => {
  it('is dark through the problems, lights with the idea, stays lit, goes out with the loop', () => {
    expect(bulbIntensity(at('problem', 0.3))).toBe(0);
    expect(bulbIntensity(at('problem', 0.9))).toBeGreaterThan(2.5);
    expect(bulbIntensity(at('stack', 0.5))).toBeGreaterThan(2.5);
    expect(bulbIntensity(at('contact', 0.5))).toBeGreaterThan(2.5);
    expect(bulbIntensity(at('loop', 0.3))).toBe(0);
  });

  it('comes down out of the dark on its cord just before it lights', () => {
    expect(bulbDrop(at('problem', 0.3))).toBeGreaterThan(5);
    expect(bulbDrop(at('problem', 0.65))).toBeGreaterThan(0);
    expect(bulbDrop(at('problem', 0.65))).toBeLessThan(bulbDrop(at('problem', 0.6)));
    expect(bulbDrop(at('problem', 0.7))).toBe(0);
    expect(bulbDrop(at('stack', 0.5))).toBe(0);
  });
});

describe('problems into keycaps', () => {
  it('the problems close in on the character as the chapter goes on', () => {
    const early = problemPose(0, 10, 0.05).position;
    const late = problemPose(0, 10, 0.6).position;
    expect(radius(late)).toBeLessThan(radius(early) - 1.5);
  });

  it('they freeze while the bulb lights and turn from red to warm', () => {
    expect(dist(problemPose(3, 10, 0.72).position, problemPose(3, 10, 0.78).position)).toBeLessThan(1e-9);
    expect(problemPose(3, 10, 0.6).warmth).toBe(0);
    expect(problemPose(3, 10, 0.8).warmth).toBe(1);
  });

  it('each problem becomes a keycap exactly where the keycap starts orbiting', () => {
    for (let i = 0; i < 10; i++) {
      const end = problemPose(i, 10, 1);
      expect(end.problemScale).toBe(0);
      expect(end.keycapScale).toBe(1);
      expect(dist(end.position, keycapPose(i, 10, 0))).toBeLessThan(1e-6);
    }
    expect(problemPose(0, 10, 0.5).keycapScale).toBe(0);
  });

  it('keycaps orbit the bulb like moths, a full turn over the stack chapter', () => {
    for (const s of [0, 0.3, 0.7]) expect(radius(keycapPose(2, 10, s))).toBeCloseTo(1.6);
    expect(dist(keycapPose(2, 10, 0), keycapPose(2, 10, 1))).toBeLessThan(1e-6);
    expect(dist(keycapPose(2, 10, 0), keycapPose(2, 10, 0.5))).toBeGreaterThan(2);
  });
});

describe('the keycaps across the chapters', () => {
  const P_STACK = getChapter('stack').start;
  const P_CONTACT = getChapter('contact').start;

  it('are not there before the problems turn', () => {
    expect(keycapState(0, 10, at('problem', 0.5)).scale).toBe(0);
    expect(keycapState(0, 10, 0.3).scale).toBe(0);
  });

  it('grow out of the problems, then orbit at full size without a jump', () => {
    expect(keycapState(4, 10, at('problem', 0.9)).scale).toBeGreaterThan(0);
    expect(keycapState(4, 10, at('problem', 0.9)).scale).toBeLessThan(1);
    const before = keycapState(4, 10, P_STACK - 1e-7);
    const after = keycapState(4, 10, P_STACK);
    expect(dist(before.position, after.position)).toBeLessThan(1e-3);
    expect(Math.abs(before.scale - after.scale)).toBeLessThan(1e-3);
    expect(keycapState(4, 10, at('stack', 0.5)).scale).toBe(1);
  });

  it('keep circling into contact and fly off into the dark early in it', () => {
    const before = keycapState(2, 10, P_CONTACT - 1e-7);
    const after = keycapState(2, 10, P_CONTACT);
    expect(dist(before.position, after.position)).toBeLessThan(1e-3);
    const leaving = keycapState(2, 10, at('contact', 0.1));
    expect(leaving.scale).toBeGreaterThan(0);
    expect(leaving.scale).toBeLessThan(1);
    expect(leaving.position[1]).toBeGreaterThan(after.position[1]);
    expect(keycapState(2, 10, at('contact', 0.3)).scale).toBe(0);
    expect(keycapState(2, 10, at('loop', 0.1)).scale).toBe(0);
  });

  it('face out from the bulb, so the camera reads their legends as they pass', () => {
    const { position, angle } = keycapState(1, 10, at('stack', 0.3));
    expect(Math.sin(angle)).toBeCloseTo(position[0] / radius(position), 6);
    expect(Math.cos(angle)).toBeCloseTo(position[2] / radius(position), 6);
  });
});

describe('the tapes', () => {
  const FLOOR = -180;

  it('start under the water and rise out of it, one after another', () => {
    for (let i = 0; i < 4; i++) expect(cassettePose(i, 4, 0).position[1] + CASSETTE_HALF_HEIGHT).toBeLessThan(FLOOR);
    const early = cassettePose(0, 4, 0.12).position[1];
    const late = cassettePose(3, 4, 0.12).position[1];
    expect(early).toBeGreaterThan(late);
  });

  it('wait in two columns either side of the character once up, clear of the water', () => {
    const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5));
    for (const { position } of poses) {
      expect(position[1] - CASSETTE_HALF_HEIGHT).toBeGreaterThan(FLOOR + 0.5);
      expect(position[2]).toBeGreaterThan(0.8);
      // The character stands at x = 0: the space around it stays open.
      expect(Math.abs(position[0]) - CASSETTE_WIDTH / 2).toBeGreaterThan(0.5);
    }
    // Read left to right, top to bottom.
    expect(poses[0].position[0]).toBeLessThan(0);
    expect(poses[1].position[0]).toBeGreaterThan(0);
    expect(poses[2].position[1]).toBeLessThan(poses[0].position[1] - 2 * CASSETTE_HALF_HEIGHT);
    expect(poses[0].position[0] + poses[1].position[0]).toBeCloseTo(0, 6);
  });

  it('slide out away from every other tape, so a hovered one never runs into a neighbour', () => {
    for (const layout of ['wings', 'column'] as const) {
      const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5, 0, layout));
      poses.forEach((pose, i) => {
        // Its sleeve, plus the tape out of the open end.
        const [x, y] = pose.position;
        const left = x - CASSETTE_WIDTH / 2 - (pose.side < 0 ? CASSETTE_REACH : 0);
        const right = x + CASSETTE_WIDTH / 2 + (pose.side > 0 ? CASSETTE_REACH : 0);
        poses.forEach((other, j) => {
          if (i === j) return;
          const acrossX = Math.min(right, other.position[0] + CASSETTE_WIDTH / 2) - Math.max(left, other.position[0] - CASSETTE_WIDTH / 2);
          const acrossY = 2 * CASSETTE_HALF_HEIGHT - Math.abs(y - other.position[1]);
          expect(acrossX > 0 && acrossY > 0, `${layout}: tape ${i} runs into tape ${j}`).toBe(false);
        });
      });
    }
  });

  it('stack in one column in front of the character on a narrow screen', () => {
    expect(tapeLayout(16 / 10)).toBe('wings');
    expect(tapeLayout(4 / 3)).toBe('wings');
    expect(tapeLayout(9 / 19.5)).toBe('column');
    const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5, 0, 'column'));
    for (let i = 1; i < 4; i++) expect(poses[i - 1].position[1] - poses[i].position[1]).toBeGreaterThan(2 * CASSETTE_HALF_HEIGHT);
    for (const { position } of poses) expect(position[1] - CASSETTE_HALF_HEIGHT).toBeGreaterThan(FLOOR + 0.3);
  });

  it('bob gently while they wait', () => {
    const a = cassettePose(1, 4, 0.5, 0).position[1];
    const b = cassettePose(1, 4, 0.5, 1.3).position[1];
    expect(Math.abs(a - b)).toBeGreaterThan(0.005);
    expect(Math.abs(a - b)).toBeLessThan(0.08);
  });
});

describe('drips on the flooded floor', () => {
  it('ring out one after another, each fading before it is dropped', () => {
    for (const time of [0, 0.4, 3.7, 12.25, 100]) {
      const ripples = dripRipples(time);
      expect(ripples.length).toBeLessThanOrEqual(MAX_RIPPLES);
      for (const r of ripples) {
        expect(r.age).toBeGreaterThanOrEqual(0);
        expect(r.age).toBeLessThan(RIPPLE_LIFE);
        expect(Math.hypot(r.x, r.z)).toBeLessThan(7);
      }
    }
    expect(dripRipples(12.25)).toEqual(dripRipples(12.25));
    expect(dripRipples(40).length).toBeGreaterThan(1);
  });

  it('land in different places', () => {
    const spots = new Set(Array.from({ length: 8 }, (_, k) => dripRipples(k * 1.9 + 0.05).map((r) => `${r.x.toFixed(2)},${r.z.toFixed(2)}`)[0]));
    expect(spots.size).toBeGreaterThan(5);
  });
});

describe('the character down here', () => {
  it('sits hunched on the dead TV through the problems', () => {
    const { position, lean } = characterPose(at('problem', 0.5));
    expect(lean).toBeGreaterThan(0.2);
    expect(position[1] - 0.47).toBeGreaterThan(SEAT_TOP - 0.05);
  });

  it('gets up once the bulb is lit and stands on the floor for the tapes', () => {
    expect(characterPose(at('stack', 0)).lean).toBeCloseTo(characterPose(at('problem', 0.99)).lean, 6);
    const standing = characterPose(at('contact', 0.5));
    expect(standing.lean).toBe(0);
    expect(standing.position[1] - 0.475).toBeCloseTo(-180, 3);
    expect(dist(characterPose(at('stack', 0.9)).position, standing.position)).toBeLessThan(1e-6);
    expect(dist(characterPose(at('loop', 0.2)).position, standing.position)).toBeLessThan(1e-6);
  });
});
