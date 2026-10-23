import type { Vec3 } from '@/experience/camera/types';
import { mulberry32 } from '@/lib/random';

/** Specks shaken loose by one knock: fine plaster dust and a few flakes of old paint. */
export const DUST_COUNT = 140;
/** Seconds until the last speck has faded. */
export const DUST_LIFETIME = 4.5;
const FLOOR = 0.003;

interface Speck {
  flake: boolean;
  size: number;
  /** Launch speed out of the wall, sideways along it, and up/down along it (m/s). */
  out: number;
  side: number;
  lift: number;
  /** Air drag (1/s) and the speed it settles at when falling (m/s). */
  drag: number;
  fall: number;
  life: number;
}

const specks: Speck[] = Array.from({ length: DUST_COUNT }, (_, i) => {
  const rand = mulberry32(i * 7919 + 13);
  const flake = rand() < 0.18;
  return flake
    ? { flake, size: 0.018 + 0.02 * rand(), out: 0.2 + 0.3 * rand(), side: (rand() - 0.5) * 0.3, lift: 0.2 * rand(), drag: 1.6, fall: 0.6 + 0.4 * rand(), life: 3.5 + rand() }
    : { flake, size: 0.005 + 0.006 * rand(), out: 0.15 + 0.45 * rand(), side: (rand() - 0.5) * 0.5, lift: -0.1 + 0.4 * rand(), drag: 3.5, fall: 0.15 + 0.2 * rand(), life: 2.5 + 2 * rand() };
});

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Speck `index` of a knock at `origin` on a surface facing `normal`, `age` seconds on.
 * Linear drag makes it puff out, slow down and drift to the floor at its settling speed.
 */
export function dustParticle(index: number, age: number, origin: Vec3, normal: Vec3): { position: Vec3; size: number; alpha: number; flake: boolean } {
  const s = specks[index % DUST_COUNT];
  const n = normalize(normal);
  const side = Math.abs(n[1]) < 0.99 ? normalize(cross([0, 1, 0], n)) : ([1, 0, 0] as Vec3);
  const along = cross(n, side);
  const t = Math.max(0, age);
  const slow = (1 - Math.exp(-s.drag * t)) / s.drag; // distance per unit launch speed
  const sink = s.fall * (t - slow); // gravity's share once drag has settled the speed
  const position: Vec3 = [0, 1, 2].map((k) => origin[k] + n[k] * s.out * slow + side[k] * s.side * slow + along[k] * s.lift * slow) as Vec3;
  position[1] = Math.max(FLOOR, position[1] - sink);
  // Never back through the surface it came off.
  const into = dot([position[0] - origin[0], position[1] - origin[1], position[2] - origin[2]], n);
  if (into < 0) for (let k = 0; k < 3; k++) position[k] -= n[k] * into;
  const alpha = age < 0 || age >= s.life ? 0 : smooth(0, 0.06, age + 0.02) * (1 - smooth(s.life - 0.8, s.life, age));
  return { position, size: s.size, alpha, flake: s.flake };
}
