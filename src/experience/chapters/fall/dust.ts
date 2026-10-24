import type { Vec3 } from '@/experience/camera/types';
import { clamp01, smoothstep } from '@/lib/math';

/**
 * Near the end of the fall the figure turns to dust, from the fingers and toes in, the chest
 * last, and the wind takes it. Fall-local t: where it starts, where the last of the figure goes
 * (just before the camera rises over it to the booth roof), and how long a flake lasts.
 */
export const DUST = { start: 0.6, end: 0.9, life: 0.15 } as const;

/** How far the dust has eaten into the figure at fall-local t: 0 whole, 1 all gone. Scrolling back puts it together again. */
export function dustFront(t: number): number {
  return clamp01((t - DUST.start) / (DUST.end - DUST.start));
}

/** The middle of the chest at rest (character.glb, in an A-pose), where the dust gets to last. */
const CORE: Vec3 = [0, 1.12, 0.04];
/** Height counts for less, so the hands and the feet go about together. */
const TALL = 0.45;
/** How far out from the chest the fingertips and toes are, so measured. */
const REACH = 0.58;

const fract = (x: number) => x - Math.floor(x);

/**
 * When the point of the figure at `rest` (bind pose, metres) turns to dust, 0..1 along the front:
 * how far it is from the chest, broken up into patches. The figure's shader works out the same
 * for every pixel (DUST_THRESHOLD_GLSL), so the flakes come off where the surface goes.
 */
export function dustThreshold([x, y, z]: readonly [number, number, number]): number {
  const inward = clamp01(1 - Math.hypot(x - CORE[0], (y - CORE[1]) * TALL, z - CORE[2]) / REACH);
  const patches = 0.5 + 0.25 * Math.sin(17.3 * x + 5.1 * y) * Math.sin(13.7 * z - 9.1 * y + 1.3) + 0.25 * Math.sin(23.1 * y + 7.7 * x - 4.3 * z);
  return Math.min(0.99, 0.85 * inward + 0.14 * patches);
}

/** dustThreshold in GLSL. */
export const DUST_THRESHOLD_GLSL = /* glsl */ `
float dustThreshold(vec3 rest) {
  vec3 d = rest - vec3(${CORE.join(', ')});
  d.y *= ${TALL.toFixed(2)};
  float inward = clamp(1.0 - length(d) / ${REACH.toFixed(2)}, 0.0, 1.0);
  float patches = 0.5 + 0.25 * sin(17.3 * rest.x + 5.1 * rest.y) * sin(13.7 * rest.z - 9.1 * rest.y + 1.3)
    + 0.25 * sin(23.1 * rest.y + 7.7 * rest.x - 4.3 * rest.z);
  return min(0.99, 0.85 * inward + 0.14 * patches);
}
`;

/** Which way the wind takes the dust: off to the left of a camera beside the figure, a little toward it. */
const WIND: Vec3 = [-0.7, 0, 0.71];

export interface Flake {
  offset: Vec3;
  size: number;
  ash: number;
}

/**
 * A flake `age` (fall-local t) after it came off the figure: how far it has drifted from where it
 * was, how big it still is (0..1), and how far it has gone grey (0..1). Left behind by the fall it
 * streams up past the figure and off to the side, and it swirls in the scene clock's time, so the
 * dust stirs even while the scroll holds still. Not off yet, or crumbled away: size 0. Written
 * into `out`, so thousands a frame make no garbage.
 */
export function flakeAt(age: number, seed: number, time: number, out: Flake = { offset: [0, 0, 0], size: 0, ash: 0 }): Flake {
  if (age < 0 || age >= DUST.life) {
    out.size = 0;
    return out;
  }
  const gust = 0.6 + 0.8 * fract(seed * 7.13);
  const up = (5 + 2.5 * fract(seed * 5.31)) * age + 25 * age * age;
  const side = 4 * gust * age;
  const turn = time * (1.2 + 1.3 * fract(seed * 3.7)) + seed * 40;
  const swirl = 0.015 + 0.5 * age;
  out.offset[0] = WIND[0] * side + swirl * Math.cos(turn);
  out.offset[1] = up + 0.5 * swirl * Math.sin(1.3 * turn);
  out.offset[2] = WIND[2] * side + swirl * Math.sin(turn);
  out.size = 1 - smoothstep(0.35 * DUST.life, DUST.life, age);
  out.ash = smoothstep(0, 0.4 * DUST.life, age);
  return out;
}
