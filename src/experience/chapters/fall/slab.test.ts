import { describe, expect, it } from 'vitest';
import { cameraPoseAt } from '@/experience/camera/paths';
import type { Vec3 } from '@/experience/camera/types';
import { chapterP } from '@/timeline/resolve';
import { holeOutline, SLAB } from './slab';

const OUTLINE = holeOutline();

/** How far (x, z) is inside the hole's edge: negative when it is out on the floor. */
function clearance(x: number, z: number): number {
  let inside = false;
  let nearest = Infinity;
  OUTLINE.forEach(([ax, az], i) => {
    const [bx, bz] = OUTLINE[(i + 1) % OUTLINE.length];
    if (az > z !== bz > z && x < ax + ((z - az) * (bx - ax)) / (bz - az)) inside = !inside;
    const dx = bx - ax;
    const dz = bz - az;
    const s = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    nearest = Math.min(nearest, Math.hypot(x - ax - s * dx, z - az - s * dz));
  });
  return inside ? nearest : -nearest;
}

/** Where `point` of the camera's pose goes through the floor on the way down. */
function throughFloor(point: 'position' | 'target'): Vec3 {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (cameraPoseAt(chapterP('fall', mid), 6)[point][1] > 0) lo = mid;
    else hi = mid;
  }
  return cameraPoseAt(chapterP('fall', lo), 6)[point];
}

describe('the floor slab seen from below', () => {
  it('has floor all round the hole', () => {
    for (const [x, z] of OUTLINE) {
      expect(x - SLAB.x[0]).toBeGreaterThan(1.2);
      expect(SLAB.x[1] - x).toBeGreaterThan(1.2);
      expect(z - SLAB.z[0]).toBeGreaterThan(0.6);
      expect(SLAB.z[1] - z).toBeGreaterThan(0.6);
    }
  });

  it('lets the camera through the hole, clear of its edge', () => {
    const [x, , z] = throughFloor('position');
    expect(clearance(x, z)).toBeGreaterThan(0.2);
  });

  it('lets the figure through the hole, arms and all', () => {
    const [x, , z] = throughFloor('target');
    expect(clearance(x, z)).toBeGreaterThan(0.5);
  });
});
