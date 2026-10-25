import { Euler, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { getChapter } from '@/timeline/chapters';
import {
  BULB_LIGHTS_T,
  BULB_Y,
  bulbDrop,
  bulbHaze,
  bulbIntensity,
  bulbPosition,
  CORD,
  lampSwing,
  CASSETTE_HALF_HEIGHT,
  CASSETTE_REACH,
  CASSETTE_WIDTH,
  cassettePose,
  dripRipples,
  FLOOR_Y,
  HOVER,
  MAX_RIPPLES,
  RIPPLE_LIFE,
  TAPES_UP_T,
  TILE,
  TILES_UP_T,
  tapeLayout,
  tileScale,
  tileSlot,
  tileState,
} from './choreography';
import type { Vec3 } from '@/experience/camera/types';
import { TEXT_WINDOWS } from '@/ui/reveal';

const at = (id: 'spiral' | 'stack' | 'contact' | 'loop', t: number) => {
  const c = getChapter(id);
  return c.start + (c.end - c.start) * t;
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Screens: a widescreen monitor, and a phone held upright. */
const WIDE = 16 / 9;
const PHONE = 375 / 812;
/** Which way a tile's face points, turned by these Euler angles (XYZ). */
const facing = ([x, y]: Vec3): Vec3 => [Math.sin(y), -Math.cos(y) * Math.sin(x), Math.cos(y) * Math.cos(x)];

describe('the bulb', () => {
  it('is dark as the camera comes down off the pillar, lights over the tiles, stays lit, goes out with the loop', () => {
    expect(bulbIntensity(at('spiral', 0.9))).toBe(0);
    expect(bulbIntensity(at('stack', 0.05))).toBe(0);
    expect(bulbIntensity(at('stack', 0.5))).toBeGreaterThan(2.5);
    expect(bulbIntensity(at('contact', 0.5))).toBeGreaterThan(2.5);
    expect(bulbIntensity(at('loop', 0.3))).toBe(0);
  });

  it('hangs its light thinner in the dust while the wall of tiles is read through it, full again over the tapes', () => {
    expect(bulbHaze(at('stack', 0.05))).toBe(0);
    expect(bulbHaze(at('stack', 0.3))).toBeCloseTo(1, 5);
    expect(bulbHaze(at('stack', TILES_UP_T))).toBeLessThan(0.5);
    expect(bulbHaze(at('stack', 0.95))).toBeLessThan(0.5);
    const start = getChapter('contact').start;
    expect(Math.abs(bulbHaze(start - 1e-7) - bulbHaze(start))).toBeLessThan(1e-3);
    expect(bulbHaze(at('contact', 0.5))).toBeCloseTo(1, 5);
    expect(bulbHaze(at('loop', 0.3))).toBe(0);
  });

  it('comes down out of the dark on its cord just before it lights', () => {
    expect(bulbDrop(at('spiral', 0.9))).toBeGreaterThan(5);
    const drops = [0.02, 0.07, 0.11].map((t) => bulbDrop(at('stack', t)));
    expect(drops[1]).toBeLessThan(drops[0]);
    expect(drops[2]).toBeLessThan(drops[1]);
    expect(bulbIntensity(at('stack', BULB_LIGHTS_T - 0.01))).toBe(0);
    expect(bulbIntensity(at('stack', BULB_LIGHTS_T + 0.05))).toBeGreaterThan(0);
    expect(bulbDrop(at('stack', BULB_LIGHTS_T + 0.05))).toBe(0);
    expect(bulbDrop(at('contact', 0.5))).toBe(0);
  });

  it('swings on its cord: it is where the lamp, hung from the top of the cord and leaned as it swings, holds it', () => {
    for (const p of [at('spiral', 0.9), at('stack', 0.05), at('stack', 0.8), at('contact', 0.5)]) {
      for (const time of [0, 0.7, 1.9, 3.3, 12.5]) {
        const [x, z] = lampSwing(time);
        const held = new Vector3(0, -CORD, 0).applyEuler(new Euler(x, 0, z)).add(new Vector3(0, BULB_Y + CORD + bulbDrop(p), 0));
        expect(dist(bulbPosition(p, time), held.toArray()), `p=${p} time=${time}`).toBeLessThan(1e-9);
      }
    }
    // A pendulum the length of its cord, a few seconds a swing, out a hand's width or so either way.
    const swing = 2 * Math.PI * Math.sqrt(CORD / 9.8);
    const p = at('stack', 0.8);
    expect(dist(bulbPosition(p, 1.3), bulbPosition(p, 1.3 + swing))).toBeLessThan(1e-9);
    const out = Array.from({ length: 200 }, (_, k) => bulbPosition(p, (k * swing) / 200));
    expect(Math.max(...out.map(([x]) => Math.abs(x)))).toBeGreaterThan(0.1);
    expect(Math.max(...out.map(([x, , z]) => Math.hypot(x, z)))).toBeLessThan(0.3);
  });
});

describe('the tiles', () => {
  const N = 16;
  const BULB: Vec3 = [0, BULB_Y, 0];
  const all = (p: number, time = 0) => Array.from({ length: N }, (_, i) => tileState(i, N, p, time, WIDE));
  const turned = (r: Vec3) => Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]));
  /** Stack-local t at which tile `i` is within 5 cm of its place in the wall. */
  const arrival = (i: number) => {
    for (let t = 0; t <= 1; t += 0.002) if (dist(tileState(i, N, at('stack', t), 0, WIDE).position, tileSlot(i, N, WIDE).position) < 0.05) return t;
    return Number.NaN;
  };

  it('wait scattered in the dark, every which way, while the camera comes down', () => {
    const tiles = all(at('stack', 0.05));
    tiles.forEach((tile, i) => expect(dist(tile.position, tileSlot(i, N, WIDE).position), `tile ${i}`).toBeGreaterThan(0.6));
    // Plenty of them show their backs or their edges.
    expect(tiles.filter((tile) => turned(tile.rotation) > Math.PI / 3).length).toBeGreaterThan(N / 3);
  });

  it('come together into a wall by the time the title is up, facing the camera, tipped back toward the bulb', () => {
    expect(TILES_UP_T).toBeLessThanOrEqual(TEXT_WINDOWS.stackTitle.inEnd);
    all(at('stack', TILES_UP_T)).forEach((tile, i) => {
      expect(dist(tile.position, tileSlot(i, N, WIDE).position), `tile ${i}`).toBeLessThan(0.03);
      // The ones out at the ends turn in a little more, toward the light.
      const [, up, toward] = facing(tile.rotation);
      expect(toward, `tile ${i}`).toBeGreaterThan(0.75);
      expect(up, `tile ${i}`).toBeGreaterThan(0);
      expect(Math.abs(tile.rotation[2]), `tile ${i}`).toBeLessThan(0.1);
      expect(tile.scale).toBe(tileScale(N, WIDE));
    });
  });

  /** The wall's width and height, out to the tiles' edges. */
  const extent = (count: number, aspect: number) => {
    const half = (TILE.size / 2) * tileScale(count, aspect);
    const slots = Array.from({ length: count }, (_, i) => tileSlot(i, count, aspect).position);
    const xs = slots.map(([x]) => x);
    const ys = slots.map(([, y]) => y);
    return { width: Math.max(...xs) - Math.min(...xs) + 2 * half, height: Math.max(...ys) - Math.min(...ys) + 2 * half };
  };

  it('are drawn bigger for a short list, so a few still fill the wall, never past the longest list', () => {
    expect(tileScale(24, WIDE)).toBe(1);
    expect(tileScale(6, WIDE)).toBeGreaterThan(1.3);
    expect(extent(6, WIDE).height).toBeGreaterThan(1.2);
    const longest = extent(24, WIDE);
    for (let count = 1; count <= 24; count++) {
      expect(tileScale(count, WIDE), `${count}`).toBeGreaterThanOrEqual(1);
      expect(extent(count, WIDE).width, `${count}`).toBeLessThan(longest.width + 0.05);
      expect(extent(count, WIDE).height, `${count}`).toBeLessThan(longest.height + 0.05);
    }
  });

  it('on a narrow screen hang in a taller, narrower wall, as big as the screen allows', () => {
    for (const count of [6, 12, 24]) {
      const wide = extent(count, WIDE);
      const tall = extent(count, PHONE);
      expect(tall.width / tall.height, `${count}`).toBeLessThan(wide.width / wide.height);
    }
    for (let count = 1; count <= 24; count++) {
      expect(extent(count, PHONE).width, `${count}`).toBeLessThan(1.25);
      expect(extent(count, PHONE).height, `${count}`).toBeLessThan(1.6);
    }
    // A short list still reads on a phone.
    expect(tileScale(6, PHONE)).toBeGreaterThan(1);
    expect(tileScale(24, PHONE)).toBeGreaterThan(0.5);
  });

  it('fly in one after another, the middle of the wall first', () => {
    const slots = Array.from({ length: N }, (_, i) => tileSlot(i, N, WIDE).position);
    const middle = slots.reduce((sum, s) => sum + s[1], 0) / N;
    const off = (s: Vec3) => Math.hypot(s[0], s[1] - middle);
    const inner = slots.indexOf(slots.reduce((a, b) => (off(b) < off(a) ? b : a)));
    const outer = slots.indexOf(slots.reduce((a, b) => (off(b) > off(a) ? b : a)));
    expect(arrival(inner)).toBeLessThan(arrival(outer) - 0.05);
    const times = slots.map((_, i) => arrival(i));
    expect(new Set(times.map((t) => t.toFixed(3))).size).toBeGreaterThan(N / 2);
  });

  it('never fly through the bulb or its cord', () => {
    for (let t = 0; t <= 1; t += 0.004) {
      all(at('stack', t)).forEach(({ position }, i) => {
        expect(dist(position, BULB), `tile ${i} t=${t}`).toBeGreaterThan(0.45);
        if (position[1] > BULB_Y) expect(Math.hypot(position[0], position[2]), `tile ${i} t=${t}`).toBeGreaterThan(0.35);
      });
    }
  });

  it('hang in centred rows behind the bulb, above the water, with air between them', () => {
    for (const aspect of [WIDE, PHONE]) {
      for (const count of [5, 6, 12, 16, 20, 24]) {
        const slots = Array.from({ length: count }, (_, i) => tileSlot(i, count, aspect).position);
        for (const [x, y, z] of slots) {
          expect(z).toBeLessThan(-0.6);
          expect(y - (TILE.size / 2) * tileScale(count, aspect)).toBeGreaterThan(FLOOR_Y + 0.4);
          expect(Math.abs(x)).toBeLessThan(2.2);
        }
        expect(slots.reduce((sum, s) => sum + s[0], 0) / count).toBeCloseTo(0, 1);
        const size = TILE.size * tileScale(count, aspect);
        slots.forEach((a, i) =>
          slots.forEach((b, j) => {
            if (i < j) expect(Math.abs(a[0] - b[0]) > size + 0.02 || Math.abs(a[1] - b[1]) > size + 0.02, `${aspect.toFixed(2)} ${count}: ${i} and ${j}`).toBe(true);
          }),
        );
      }
    }
  });

  it('keep floating while the scroll holds still', () => {
    const now = tileState(3, N, at('stack', 0.8), 10, WIDE).position;
    const soon = tileState(3, N, at('stack', 0.8), 10.6, WIDE).position;
    expect(dist(now, soon)).toBeGreaterThan(0.005);
    expect(dist(now, soon)).toBeLessThan(0.08);
  });

  it('go up into the dark as the contact starts, gone before the stack chapter stops being drawn', () => {
    const start = getChapter('contact').start;
    const before = tileState(5, N, start - 1e-7, 0, WIDE);
    const after = tileState(5, N, start, 0, WIDE);
    expect(dist(before.position, after.position)).toBeLessThan(1e-3);
    expect(tileState(5, N, at('contact', 0.1), 0, WIDE).position[1]).toBeGreaterThan(after.position[1] + 0.3);
    // The stack chapter's objects are drawn 0.02 of p into the contact (timeline/visibility.ts).
    expect(tileState(5, N, start + 0.019, 0, WIDE).scale).toBe(0);
    expect(tileState(5, N, at('loop', 0.1), 0, WIDE).scale).toBe(0);
  });
});

describe('the tapes', () => {
  const FLOOR = -180;
  /** Contact-local t at which tape `i`'s bottom edge comes up through the water. */
  const surfacing = (i: number, layout: 'wings' | 'column' = 'wings') => {
    for (let t = 0; t <= 1; t += 0.001) if (cassettePose(i, 4, t, 0, layout).position[1] - CASSETTE_HALF_HEIGHT > FLOOR) return t;
    return Number.NaN;
  };

  it('start under the water and come up out of it one after another, all in the middle, under the bulb', () => {
    for (let i = 0; i < 4; i++) expect(cassettePose(i, 4, 0).position[1] + CASSETTE_HALF_HEIGHT).toBeLessThan(FLOOR);
    for (const layout of ['wings', 'column'] as const) {
      const times = [0, 1, 2, 3].map((i) => surfacing(i, layout));
      for (let i = 1; i < 4; i++) expect(times[i], `${layout} ${i}`).toBeGreaterThan(times[i - 1] + 0.02);
      times.forEach((t, i) => {
        const [x, , z] = cassettePose(i, 4, t, 0, layout).position;
        expect(Math.abs(x), `${layout} ${i}`).toBeLessThan(0.1);
        // Back in the bulb's pool of light, where the camera sees the water, not out at its place.
        expect(z, `${layout} ${i}`).toBeLessThan(1.6);
      });
    }
  });

  it('then fly up and out to their places, spreading as they go and never swinging back', () => {
    for (let i = 0; i < 4; i++) {
      const end = cassettePose(i, 4, TAPES_UP_T).position;
      let last = 0;
      for (let t = surfacing(i); t <= TAPES_UP_T; t += 0.005) {
        const spread = Math.abs(cassettePose(i, 4, t).position[0]);
        expect(spread, `tape ${i} t=${t}`).toBeGreaterThanOrEqual(last - 1e-9);
        expect(spread, `tape ${i} t=${t}`).toBeLessThanOrEqual(Math.abs(end[0]) + 1e-9);
        last = spread;
      }
    }
  });

  it('are all in place and turned to the camera before the hint asks to pick one', () => {
    expect(TAPES_UP_T).toBeLessThanOrEqual(TEXT_WINDOWS.contactHint.inEnd);
    for (let i = 0; i < 4; i++) {
      const up = cassettePose(i, 4, TAPES_UP_T);
      const later = cassettePose(i, 4, 0.9);
      expect(dist(up.position, later.position), `tape ${i}`).toBeLessThan(1e-6);
      expect(up.yaw).toBeCloseTo(later.yaw, 6);
      expect(up.roll).toBeCloseTo(later.roll, 6);
    }
  });

  it('wait in two columns either side of the bulb, the middle open for a hovered tape to slide into', () => {
    const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5));
    for (const { position } of poses) {
      expect(position[1] - CASSETTE_HALF_HEIGHT).toBeGreaterThan(FLOOR + 0.5);
      expect(position[2]).toBeGreaterThan(0.8);
      // Grown and slid out, a hovered tape still stops short of the middle.
      expect(Math.abs(position[0]) - (CASSETTE_WIDTH / 2 + CASSETTE_REACH) * HOVER.grow).toBeGreaterThan(0.1);
    }
    // Read left to right, top to bottom.
    expect(poses[0].position[0]).toBeLessThan(0);
    expect(poses[1].position[0]).toBeGreaterThan(0);
    expect(poses[2].position[1]).toBeLessThan(poses[0].position[1] - 2 * CASSETTE_HALF_HEIGHT);
    expect(poses[0].position[0] + poses[1].position[0]).toBeCloseTo(0, 6);
  });

  it('slide out of their sleeves toward the middle, never toward the edge of the screen', () => {
    for (const layout of ['wings', 'column'] as const) {
      for (let i = 0; i < 4; i++) {
        const { position, side } = cassettePose(i, 4, 0.5, 0, layout);
        expect(side * position[0], `${layout} ${i}`).toBeLessThan(0);
      }
    }
  });

  it('slide out without running into another tape, even grown as a hovered one is', () => {
    for (const layout of ['wings', 'column'] as const) {
      const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5, 0, layout));
      poses.forEach((pose, i) => {
        // Its sleeve, plus the tape out of the open end, all grown about the sleeve's centre.
        const [x, y] = pose.position;
        const half = (CASSETTE_WIDTH / 2) * HOVER.grow;
        const reach = CASSETTE_REACH * HOVER.grow;
        const left = x - half - (pose.side < 0 ? reach : 0);
        const right = x + half + (pose.side > 0 ? reach : 0);
        poses.forEach((other, j) => {
          if (i === j) return;
          const acrossX = Math.min(right, other.position[0] + CASSETTE_WIDTH / 2) - Math.max(left, other.position[0] - CASSETTE_WIDTH / 2);
          const acrossY = (1 + HOVER.grow) * CASSETTE_HALF_HEIGHT - Math.abs(y - other.position[1]);
          expect(acrossX > 0 && acrossY > 0, `${layout}: tape ${i} runs into tape ${j}`).toBe(false);
        });
      });
    }
  });

  it('stack in one column on a narrow screen, staggered so each slides out across the middle', () => {
    expect(tapeLayout(16 / 10)).toBe('wings');
    expect(tapeLayout(4 / 3)).toBe('wings');
    expect(tapeLayout(9 / 19.5)).toBe('column');
    const poses = Array.from({ length: 4 }, (_, i) => cassettePose(i, 4, 0.5, 0, 'column'));
    for (let i = 1; i < 4; i++) expect(poses[i - 1].position[1] - poses[i].position[1]).toBeGreaterThan(2 * CASSETTE_HALF_HEIGHT * HOVER.grow);
    for (const { position, side } of poses) {
      expect(position[1] - CASSETTE_HALF_HEIGHT).toBeGreaterThan(FLOOR + 0.3);
      // Slid out, sleeve and tape together sit about the middle.
      const left = position[0] - CASSETTE_WIDTH / 2 - (side < 0 ? CASSETTE_REACH : 0);
      const right = position[0] + CASSETTE_WIDTH / 2 + (side > 0 ? CASSETTE_REACH : 0);
      expect(left + right).toBeCloseTo(0, 6);
    }
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
