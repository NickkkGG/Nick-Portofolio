import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BOOTH } from '@/experience/chapters/booth/layout';
import { BULB_Y, CASSETTE_HALF_HEIGHT, CASSETTE_REACH, CASSETTE_WIDTH, cassettePose } from '@/experience/chapters/depths/choreography';
import { helixSlots, slotKeyframeT } from '@/experience/chapters/spiral/helix';
import { getChapter } from '@/timeline/chapters';
import { LOOP_TELEPORT_P } from '@/timeline/loop';
import { chapterP } from '@/timeline/resolve';
import { buildKeyframes, cameraPoseAt, focusDistance, monitorView } from './paths';
import type { CameraPose, Vec3 } from './types';

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Where `point` lands on a 16:9 screen seen from `pose` through the site's 50° lens, -1..1 each way. */
function onScreen(pose: CameraPose, point: Vec3): [number, number] {
  const camera = new PerspectiveCamera(50, 16 / 9, 0.05, 400);
  camera.position.set(...pose.position);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  const v = new Vector3(...point).project(camera);
  return [v.x, v.y];
}
const LANDING_P = getChapter('about').start;
const insideBooth = ([x, y, z]: Vec3) =>
  Math.abs(x) < BOOTH.halfWidth && y > BOOTH.floorY && y < BOOTH.ceilingY && z > BOOTH.frontZ && z < BOOTH.backZ;

describe('camera paths', () => {
  it('room start pose is pulled back to show the whole desk corner', () => {
    expect(cameraPoseAt(0, 6)).toEqual({ position: [1.6, 1.75, 2.6], target: [-0.25, 1, -1] });
  });

  it('the loop drops straight down onto the room start pose', () => {
    const above = cameraPoseAt(LOOP_TELEPORT_P, 6).position;
    expect([above[0], above[2]]).toEqual([1.6, 2.6]);
  });

  it('the loop seam is invisible to the camera', () => {
    const end = cameraPoseAt(0.9999999, 6);
    const start = cameraPoseAt(0, 6);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(end.position[i] - start.position[i])).toBeLessThan(1e-4);
      expect(Math.abs(end.target[i] - start.target[i])).toBeLessThan(1e-4);
    }
  });

  it('the camera has landed and holds still on the room start pose before the loop wraps', () => {
    const start = cameraPoseAt(0, 6);
    for (const p of [chapterP('loop', 0.96), 0.9995]) expect(cameraPoseAt(p, 6)).toEqual(start);
  });

  it('the path is continuous except at the two cuts: the crash into the booth and the loop teleport', () => {
    for (const count of [6, 9]) {
      for (const { p } of buildKeyframes(count)) {
        if (p === LOOP_TELEPORT_P || p === LANDING_P) continue;
        const before = cameraPoseAt(p - 1e-7, count);
        const after = cameraPoseAt(p + 1e-7, count);
        expect(distance(before.position, after.position), `count=${count} p=${p}`).toBeLessThan(1e-3);
        expect(distance(before.target, after.target), `count=${count} p=${p}`).toBeLessThan(1e-3);
      }
    }
  });

  it('through the fall the camera drops alongside the figure, a little below it, looking at it from the side', () => {
    for (const t of [0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9]) {
      const { position, target } = cameraPoseAt(chapterP('fall', t), 6);
      const across = Math.hypot(target[0] - position[0], target[2] - position[2]);
      const up = (Math.atan2(target[1] - position[1], across) * 180) / Math.PI;
      expect(across, `t=${t}`).toBeGreaterThan(2);
      expect(across, `t=${t}`).toBeLessThan(4.5);
      expect(up, `t=${t}`).toBeGreaterThan(0);
      expect(up, `t=${t}`).toBeLessThan(30);
    }
  });

  it('in the contact chapter the camera comes in close: the tapes fill most of the frame, all in it, clear of the title', () => {
    for (const t of [0.5, 0.65, 0.9]) {
      const pose = cameraPoseAt(chapterP('contact', t), 6);
      const sleeves: [number, number][] = [];
      const reach: [number, number][] = [];
      for (let i = 0; i < 4; i++) {
        const { position, side } = cassettePose(i, 4, t, 0, 'wings');
        const [x, y, z] = position;
        for (const dy of [-CASSETTE_HALF_HEIGHT, CASSETTE_HALF_HEIGHT]) {
          for (const dx of [-CASSETTE_WIDTH / 2, CASSETTE_WIDTH / 2]) sleeves.push(onScreen(pose, [x + dx, y + dy, z]));
          // The tape slid out of its sleeve on hover.
          reach.push(onScreen(pose, [x + side * (CASSETTE_WIDTH / 2 + CASSETTE_REACH), y + dy, z]));
        }
      }
      const xs = sleeves.map(([x]) => x);
      const ys = sleeves.map(([, y]) => y);
      expect(Math.max(...reach.map(([x]) => Math.abs(x))), `t=${t}`).toBeLessThan(0.97);
      expect(Math.min(...ys), `t=${t}`).toBeGreaterThan(-0.9);
      // The chapter's title and the tape hint sit across the top of the screen.
      expect(Math.max(...ys), `t=${t}`).toBeLessThan(0.62);
      // Over 60% of the width: close enough to read the stickers.
      expect(Math.max(...xs) - Math.min(...xs), `t=${t}`).toBeGreaterThan(1.2);
      // The bulb hangs under the tape hint, whose line runs at about 0.55: its glow never sits on
      // the words, the handheld sway and the swing of its wire included.
      expect(onScreen(pose, [0, BULB_Y, 0])[1], `t=${t}`).toBeLessThan(0.37);
    }
  });

  it('the crash cuts from above the booth roof to inside the booth, under the glitch', () => {
    const above = cameraPoseAt(LANDING_P - 1e-7, 6).position;
    expect(above[1]).toBeGreaterThan(BOOTH.ceilingY);
    expect(insideBooth(cameraPoseAt(LANDING_P, 6).position)).toBe(true);
  });

  it('over the slides the camera stays in the booth, looking at the sheet', () => {
    for (let t = 0; t <= 0.78; t += 0.02) {
      const pose = cameraPoseAt(chapterP('about', t), 6);
      expect(insideBooth(pose.position), `t=${t}`).toBe(true);
      expect(pose.target, `t=${t}`).toEqual(BOOTH.sheet.center);
    }
  });

  it('the camera leaves the booth through its window, and arrives in front of the first monitor', () => {
    const { center, width, height } = BOOTH.window;
    let crossed = false;
    for (let t = 0.78; t <= 1; t += 0.0005) {
      const [x, y, z] = cameraPoseAt(chapterP('about', t), 6).position;
      if (z > BOOTH.frontZ + 0.02 || z < BOOTH.frontZ - 0.02) continue;
      crossed = true;
      expect(Math.abs(x - center[0]), `t=${t}`).toBeLessThan(width / 2 - 0.2);
      expect(Math.abs(y - center[1]), `t=${t}`).toBeLessThan(height / 2 - 0.2);
    }
    expect(crossed).toBe(true);
    const first = monitorView(helixSlots(6)[0]);
    const arrived = cameraPoseAt(getChapter('spiral').start, 6);
    expect(distance(arrived.position, first.position)).toBeLessThan(0.6);
    expect(arrived.target).toEqual(first.target);
  });

  it('the teleport jumps from the depths to above the room', () => {
    expect(cameraPoseAt(LOOP_TELEPORT_P - 1e-7, 6).position[1]).toBeLessThan(-200);
    expect(cameraPoseAt(LOOP_TELEPORT_P, 6).position[1]).toBeCloseTo(30);
  });

  it('the camera glides through the keyframes it passes instead of stopping at each one', () => {
    const speed = (p: number) => distance(cameraPoseAt(p + 1e-4, 6).position, cameraPoseAt(p - 1e-4, 6).position) / 2e-4;
    // The fall: from the room floor past -4, -11, -34, -58 and -72 m, all one way down.
    for (const t of [0.1875, 0.36, 0.6, 0.82, 0.93]) expect(speed(chapterP('fall', t)), `t=${t}`).toBeGreaterThan(150);
    // Into the stack chapter the camera keeps creeping toward the bulb.
    expect(speed(chapterP('stack', 0))).toBeGreaterThan(5);
  });

  it('where the camera turns back it slows to a stop there, never swinging past the keyframe', () => {
    // As the contact starts it reaches (3, -177, 3) and heads back toward (0, -178.5, 7).
    for (let p = chapterP('stack', 0.4); p < chapterP('contact', 0.8); p += 0.002) {
      const [x, y] = cameraPoseAt(p, 6).position;
      expect(x, `p=${p}`).toBeLessThanOrEqual(3 + 1e-9);
      expect(y, `p=${p}`).toBeLessThanOrEqual(-177 + 1e-9);
    }
  });

  it('the camera holds still in front of each monitor', () => {
    const { start, end } = getChapter('spiral');
    const interval = (end - start) * (slotKeyframeT(1, 6) - slotKeyframeT(0, 6)); // p between two of six monitors
    for (let i = 0; i < 6; i++) {
      const at = start + (end - start) * slotKeyframeT(i, 6);
      const parked = cameraPoseAt(at, 6);
      for (const offset of [-0.25 * interval, 0.25 * interval]) {
        const near = cameraPoseAt(at + offset, 6);
        expect(distance(near.position, parked.position), `slot ${i} offset ${offset}`).toBeLessThan(1e-9);
        expect(distance(near.target, parked.target), `slot ${i} offset ${offset}`).toBeLessThan(1e-9);
      }
    }
  });

  it('the camera has left the last monitor before the spiral chapter ends', () => {
    const { start, end } = getChapter('spiral');
    for (const count of [6, 9]) {
      const views = helixSlots(count).map(monitorView);
      const slots = buildKeyframes(count).filter((k) => views.some((view) => distance(view.position, k.position) < 1e-9));
      expect(slots.length).toBe(2 * count);
      for (const { p } of slots) {
        expect(p).toBeGreaterThan(start);
        expect(p).toBeLessThan(end);
      }
    }
  });

  it('each slot keyframe looks at its monitor', () => {
    const slots = helixSlots(6);
    const { start, end } = getChapter('spiral');
    slots.forEach((slot, i) => {
      const { target } = cameraPoseAt(start + (end - start) * slotKeyframeT(i, 6), 6);
      target.forEach((value, axis) => expect(value).toBeCloseTo(slot.position[axis], 6));
    });
  });

  it('the lens focuses on what the camera looks at', () => {
    expect(focusDistance({ position: [0, 0, 0], target: [3, 4, 0] })).toBe(5);
    const pose = cameraPoseAt(0.05, 6);
    expect(focusDistance(pose)).toBeCloseTo(distance(pose.position, pose.target), 10);
  });

  it('the lens never focuses closer than half a metre', () => {
    expect(focusDistance({ position: [0, 0, 0], target: [0, 0, 0] })).toBe(0.5);
  });
});
