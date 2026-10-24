import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { helixSlots } from '@/experience/chapters/spiral/helix';
import { BOOTH } from './layout';
import { projectorCamera, SHEET_FALL, sheetFall, throwOnto } from './projector';

const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

describe('the projector', () => {
  const camera = projectorCamera();

  it('sits at the lens, aimed at the middle of the sheet', () => {
    expect(camera.position.toArray()).toEqual([...BOOTH.lens]);
    const ahead = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toSheet = new Vector3(...BOOTH.sheet.center).sub(camera.position).normalize();
    expect(ahead.dot(toSheet)).toBeCloseTo(1, 6);
  });

  it('throws a 3:2 picture that fills most of the sheet and leaves cloth round it', () => {
    const z = BOOTH.sheet.center[2];
    const hits = CORNERS.map(([x, y]) => throwOnto(camera, x, y, z));
    for (const hit of hits) {
      expect(Math.abs(hit.x - BOOTH.sheet.center[0])).toBeLessThan(BOOTH.sheet.width / 2 - 0.08);
      expect(Math.abs(hit.y - BOOTH.sheet.center[1])).toBeLessThan(BOOTH.sheet.height / 2 - 0.1);
    }
    // Across and up through its middle: the lens stands a little to the right, so the edges keystone.
    const width = throwOnto(camera, 1, 0, z).x - throwOnto(camera, -1, 0, z).x;
    const height = throwOnto(camera, 0, 1, z).y - throwOnto(camera, 0, -1, z).y;
    expect(width).toBeGreaterThan(1.8);
    expect(width / height).toBeCloseTo(1.5, 1);
  });

  it('is a little wider than the window, so the frame cuts the beam once the sheet is down', () => {
    const z = BOOTH.window.center[2];
    const left = throwOnto(camera, -1, 0, z);
    const right = throwOnto(camera, 1, 0, z);
    expect(right.x - left.x).toBeGreaterThan(BOOTH.window.width);
  });

  it('has the first monitor well inside its throw', () => {
    const monitor = new Vector3(...helixSlots(1)[0].position).project(camera);
    expect(Math.abs(monitor.x)).toBeLessThan(0.4);
    expect(Math.abs(monitor.y)).toBeLessThan(0.4);
  });
});

describe('the falling sheet', () => {
  it('hangs until the rope snaps and is all down once the drop is over', () => {
    for (const u of [0, 0.5, 1]) {
      expect(sheetFall(0, u)).toBe(0);
      expect(sheetFall(1, u)).toBe(1);
    }
  });

  it('comes down left end first, where the rope snapped', () => {
    expect(sheetFall(0.5, 0)).toBeGreaterThan(sheetFall(0.5, 1));
    expect(sheetFall(0.15, 1)).toBe(0);
  });

  it('falls far enough to bring its top edge to the floor', () => {
    const top = BOOTH.sheet.center[1] + BOOTH.sheet.height / 2;
    expect(top - SHEET_FALL).toBeLessThanOrEqual(BOOTH.floorY);
  });
});
