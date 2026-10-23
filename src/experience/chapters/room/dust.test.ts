import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/experience/camera/types';
import { DUST_COUNT, DUST_LIFETIME, dustParticle } from './dust';

const wall: Vec3 = [0.5, 2.2, -1.18];
const outOfWall: Vec3 = [0, 0, 1];
const along = (p: Vec3, o: Vec3, n: Vec3) => (p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2];
const all = (age: number, origin = wall, normal = outOfWall) => Array.from({ length: DUST_COUNT }, (_, i) => dustParticle(i, age, origin, normal));

describe('knock dust', () => {
  it('every speck starts where the wall was knocked', () => {
    for (const p of all(0)) expect(Math.hypot(p.position[0] - wall[0], p.position[1] - wall[1], p.position[2] - wall[2])).toBeLessThan(0.03);
  });

  it('falls toward the floor', () => {
    const ys = all(2).map((p) => p.position[1]);
    expect(ys.reduce((a, b) => a + b, 0) / ys.length).toBeLessThan(wall[1] - 0.3);
  });

  it('puffs out of the wall, never into it', () => {
    for (const age of [0.05, 0.3, 1, 3]) for (const p of all(age)) expect(along(p.position, wall, outOfWall)).toBeGreaterThanOrEqual(-1e-9);
    const leftWall: Vec3 = [-3, 1.6, -0.4];
    for (const p of all(0.5, leftWall, [1, 0, 0])) expect(p.position[0]).toBeGreaterThanOrEqual(-3);
  });

  it('settles on the floor instead of falling through it', () => {
    const low: Vec3 = [0.5, 0.25, -1.18];
    const settled = all(DUST_LIFETIME * 0.9, low);
    for (const p of settled) expect(p.position[1]).toBeGreaterThanOrEqual(0);
    expect(settled.some((p) => p.position[1] < 0.01)).toBe(true);
  });

  it('shows up at once and is gone after its lifetime', () => {
    expect(all(0.2).filter((p) => p.alpha > 0).length).toBeGreaterThan(DUST_COUNT * 0.9);
    for (const p of all(DUST_LIFETIME + 0.01)) expect(p.alpha).toBe(0);
    for (const p of all(-0.5)) expect(p.alpha).toBe(0);
  });

  it('is a mix of fine dust and a few bigger paint flakes', () => {
    const sizes = all(0.2).map((p) => p.size);
    const smallest = Math.min(...sizes);
    const big = sizes.filter((s) => s > 3 * smallest).length;
    expect(big).toBeGreaterThan(DUST_COUNT * 0.08);
    expect(big).toBeLessThan(DUST_COUNT * 0.5);
  });
});
