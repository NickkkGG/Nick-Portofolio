import { helixSlots, SPIRAL, slotKeyframeT } from '@/experience/chapters/spiral/helix';
import { lerp, smoothstep } from '@/lib/math';
import { getChapter } from '@/timeline/chapters';
import { LOOP_TELEPORT_P } from '@/timeline/loop';
import { wrapProgress } from '@/timeline/resolve';
import type { CameraPose, Vec3 } from './types';

export interface CameraKeyframe {
  p: number;
  position: Vec3;
  target: Vec3;
}

const ROOM_START: Pick<CameraKeyframe, 'position' | 'target'> = { position: [0.9, 1.5, 1.6], target: [0, 1.1, -1] };

// Initial values from the milestone 1 plan; tunable later in debug mode.
const BEFORE_SPIRAL: CameraKeyframe[] = [
  { p: 0, ...ROOM_START },
  { p: 0.09, position: [0.5, 1.35, 0.9], target: [0, 0.9, -0.8] },
  { p: 0.1, position: [0.4, 1.3, 0.8], target: [0, 0.2, -0.4] },
  { p: 0.13, position: [0.3, -4, 0.5], target: [0, 2, 0] },
  { p: 0.21, position: [0.2, -30, 0.4], target: [0, -22, 0] },
  { p: 0.255, position: [3, -58, 3], target: [0, -80, 0] },
  { p: 0.26, position: [4, -76, 6], target: [0, -80, 0] },
];

const AFTER_SPIRAL: CameraKeyframe[] = [
  { p: 0.6, position: [0, -177, 7], target: [0, -179.5, 0] },
  { p: 0.72, position: [0, -178, 4], target: [0, -178, 0] },
  { p: 0.82, position: [3, -177, 3], target: [0, -177.5, 0] },
  { p: 0.92, position: [0, -178.5, 7], target: [0, -178.8, 0] },
  // Teleport: both keyframes share p; the later one wins from LOOP_TELEPORT_P onwards.
  { p: LOOP_TELEPORT_P, position: [0, -215, 7], target: [0, -230, 0] },
  { p: LOOP_TELEPORT_P, position: [0.9, 30, 1.6], target: [0, 0, -1] },
  { p: 0.985, position: [0.9, 3.4, 1.6], target: [0, 0.6, -1] },
  { p: 1, ...ROOM_START },
];

const cache = new Map<number, CameraKeyframe[]>();

export function buildKeyframes(projectCount: number): CameraKeyframe[] {
  const cached = cache.get(projectCount);
  if (cached) return cached;
  const spiral = getChapter('spiral');
  const span = spiral.end - spiral.start;
  const viewRadius = SPIRAL.radius + SPIRAL.cameraDistance;
  // The camera parks in front of each monitor, then moves quickly to the next one;
  // between monitors nothing would be in frame (they sit 14 m and 90° apart).
  const interval = projectCount > 1 ? (span * 0.9) / (projectCount - 1) : 0;
  const hold = Math.min(0.3 * interval, 0.02);
  const slots: CameraKeyframe[] = helixSlots(projectCount).flatMap((slot, i) => {
    const p = spiral.start + span * slotKeyframeT(i, projectCount);
    const pose: Pick<CameraKeyframe, 'position' | 'target'> = {
      position: [viewRadius * Math.sin(slot.angle), slot.position[1] + SPIRAL.cameraLift, viewRadius * Math.cos(slot.angle)],
      target: slot.position,
    };
    return hold > 0 ? [{ p: p - hold, ...pose }, { p: p + hold, ...pose }] : [{ p, ...pose }];
  });
  const keyframes = [...BEFORE_SPIRAL, ...slots, ...AFTER_SPIRAL];
  cache.set(projectCount, keyframes);
  return keyframes;
}

const mix = (a: Vec3, b: Vec3, e: number): Vec3 => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];

/** Camera pose at global progress `p`: eased interpolation between keyframes. */
export function cameraPoseAt(p: number, projectCount: number): CameraPose {
  const keyframes = buildKeyframes(projectCount);
  const x = wrapProgress(p);
  let index = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].p <= x) index = i;
  }
  const from = keyframes[index];
  const to = keyframes[index + 1];
  const e = smoothstep(from.p, to.p, x);
  return { position: mix(from.position, to.position, e), target: mix(from.target, to.target, e) };
}
