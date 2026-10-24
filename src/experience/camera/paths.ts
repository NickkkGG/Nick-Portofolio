import { BOOTH } from '@/experience/chapters/booth/layout';
import { helixSlots, SPIRAL, slotKeyframeT } from '@/experience/chapters/spiral/helix';
import { getChapter } from '@/timeline/chapters';
import { LOOP_TELEPORT_P } from '@/timeline/loop';
import { chapterP as at, wrapProgress } from '@/timeline/resolve';
import type { CameraPose, Vec3 } from './types';

export interface CameraKeyframe {
  p: number;
  position: Vec3;
  target: Vec3;
}

// Pulled back behind the character's right shoulder: desk, monitor, lamp and the
// moonlit window all in frame, then the camera creeps in as the floor starts to give.
const ROOM_START: Pick<CameraKeyframe, 'position' | 'target'> = { position: [1.6, 1.75, 2.6], target: [-0.25, 1, -1] };

const SHEET = BOOTH.sheet.center;
/** The first monitor, which the booth window faces. */
const FIRST_MONITOR = helixSlots(1)[0].position;

/** In the booth, over the figure's right shoulder, the projector just behind and the sheet filling the frame. */
const BOOTH_VIEW: Pick<CameraKeyframe, 'position' | 'target'> = { position: [-0.12, -83.5, 13.8], target: SHEET };

const BEFORE_SPIRAL: CameraKeyframe[] = [
  { p: 0, ...ROOM_START },
  { p: at('room', 0.9), position: [0.75, 1.45, 1.35], target: [0, 0.9, -0.9] },
  { p: at('fall', 0), position: [0.4, 1.3, 0.8], target: [0, 0.2, -0.4] },
  { p: at('fall', 0.1875), position: [0.3, -4, 0.5], target: [0, 2, 0] },
  { p: at('fall', 0.6875), position: [0.2, -30, 0.4], target: [0, -22, 0] },
  // Drifting over the booth hanging in the dark, down onto the patch of roof the figure is about to go through.
  { p: at('fall', 0.97), position: [2.4, -70, 16], target: BOOTH.roofHole },
  { p: at('fall', 1), position: [0.6, -79.6, 14.6], target: BOOTH.roofHole },
  // The crash: both keyframes share p and the later one wins, so the picture cuts inside under the glitch.
  { p: at('about', 0), ...BOOTH_VIEW },
  { p: at('about', 0.1), ...BOOTH_VIEW },
  // Over the slides the camera leans in a little, never enough to lose the edges of the sheet.
  { p: at('about', 0.78), position: [-0.05, -83.56, 13.35], target: SHEET },
  // Held back while the sheet comes down, so the whole drop and the window behind it are in frame.
  { p: at('about', 0.87), position: [0.0, -83.66, 13.1], target: FIRST_MONITOR },
  // Then into the beam past the figure getting up, and with it out of the window to the first monitor.
  { p: at('about', 0.93), position: [0.1, -83.8, 12.2], target: FIRST_MONITOR },
  { p: at('about', 1), position: [0.05, -83.85, 10.95], target: FIRST_MONITOR },
];

const AFTER_SPIRAL: CameraKeyframe[] = [
  { p: at('problem', 0.25), position: [0, -177, 7], target: [0, -179.5, 0] },
  { p: at('stack', 0), position: [0, -178, 4], target: [0, -178, 0] },
  { p: at('contact', 0), position: [3, -177, 3], target: [0, -177.5, 0] },
  // Contact: round to the front while the tapes rise, so they are never seen piled up
  // edge-on, then easing in, focused on them rather than on the bulb.
  // Looking almost level, so the bulb hangs below the tagline instead of behind it.
  { p: at('contact', 0.3), position: [0.25, -178.2, 6.5], target: [0, -178.5, 2.9] },
  { p: at('loop', 0), position: [0, -178.3, 6], target: [0, -178.45, 2.9] },
  // Teleport: both keyframes share p; the later one wins from LOOP_TELEPORT_P onwards.
  { p: LOOP_TELEPORT_P, position: [0, -215, 7], target: [0, -230, 0] },
  { p: LOOP_TELEPORT_P, position: [1.6, 30, 2.6], target: [-0.25, 0, -1] },
  { p: at('loop', 0.8125), position: [1.6, 3.5, 2.6], target: [-0.25, 0.6, -1] },
  // Land a moment before the wrap and hold still, so the seam falls on a settled frame.
  { p: at('loop', 0.95), ...ROOM_START },
  { p: 1, ...ROOM_START },
];

/** Where the camera stands to look at the monitor in `slot`: out from the pillar, a little above it. */
export function monitorView(slot: { position: Vec3; angle: number }): Pick<CameraKeyframe, 'position' | 'target'> {
  const viewRadius = SPIRAL.radius + SPIRAL.cameraDistance;
  return {
    position: [viewRadius * Math.sin(slot.angle), slot.position[1] + SPIRAL.cameraLift, viewRadius * Math.cos(slot.angle)],
    target: slot.position,
  };
}

const cache = new Map<number, CameraKeyframe[]>();

export function buildKeyframes(projectCount: number): CameraKeyframe[] {
  const cached = cache.get(projectCount);
  if (cached) return cached;
  const spiral = getChapter('spiral');
  const span = spiral.end - spiral.start;
  // The camera parks in front of each monitor, then moves quickly to the next one;
  // between monitors nothing would be in frame (they sit 14 m and 90° apart).
  const interval = projectCount > 1 ? span * (slotKeyframeT(1, projectCount) - slotKeyframeT(0, projectCount)) : 0;
  const hold = Math.min(0.3 * interval, 0.02);
  const slots: CameraKeyframe[] = helixSlots(projectCount).flatMap((slot, i) => {
    const p = spiral.start + span * slotKeyframeT(i, projectCount);
    const pose = monitorView(slot);
    return hold > 0 ? [{ p: p - hold, ...pose }, { p: p + hold, ...pose }] : [{ p, ...pose }];
  });
  const keyframes = [...BEFORE_SPIRAL, ...slots, ...AFTER_SPIRAL];
  cache.set(projectCount, keyframes);
  return keyframes;
}

/** Rate of change of each of the six numbers (position xyz, target xyz) at a keyframe, per unit of p. */
type Slopes = [number, number, number, number, number, number];

const channels = (k: CameraKeyframe): Slopes => [...k.position, ...k.target];

/**
 * Fritsch-Carlson slopes for one continuous run of keyframes: where the path keeps going
 * the same way the camera glides through a keyframe; where it turns back, or holds still
 * on either side, it slows to a stop there. It never swings past a keyframe, and each run
 * starts and ends at rest (the room start, the cuts).
 */
function monotoneSlopes(run: CameraKeyframe[]): Slopes[] {
  const values = run.map(channels);
  return run.map((key, k) => {
    const slopes: Slopes = [0, 0, 0, 0, 0, 0];
    if (k === 0 || k === run.length - 1) return slopes;
    const h0 = key.p - run[k - 1].p;
    const h1 = run[k + 1].p - key.p;
    for (let c = 0; c < 6; c++) {
      const d0 = (values[k][c] - values[k - 1][c]) / h0;
      const d1 = (values[k + 1][c] - values[k][c]) / h1;
      if (d0 * d1 <= 0) continue;
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      slopes[c] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
    return slopes;
  });
}

const pathCache = new Map<number, { keyframes: CameraKeyframe[]; slopes: Slopes[] }>();

/** Keyframes and their slopes; each cut (two keyframes sharing a p) splits the path in runs. */
function buildPath(projectCount: number) {
  const cached = pathCache.get(projectCount);
  if (cached) return cached;
  const keyframes = buildKeyframes(projectCount);
  const slopes: Slopes[] = [];
  let start = 0;
  for (let i = 1; i <= keyframes.length; i++) {
    if (i < keyframes.length && keyframes[i].p !== keyframes[i - 1].p) continue;
    slopes.push(...monotoneSlopes(keyframes.slice(start, i)));
    start = i;
  }
  const path = { keyframes, slopes };
  pathCache.set(projectCount, path);
  return path;
}

/** Cubic Hermite between two keyframes, `s` 0..1 across the segment; a hold stays exactly put. */
function hermite(v0: number, v1: number, m0: number, m1: number, h: number, s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return v0 + (v1 - v0) * (3 * s2 - 2 * s3) + h * (m0 * (s3 - 2 * s2 + s) + m1 * (s3 - s2));
}

/** Camera pose at global progress `p`: a smooth, monotone spline through the keyframes. */
export function cameraPoseAt(p: number, projectCount: number): CameraPose {
  const { keyframes, slopes } = buildPath(projectCount);
  const x = wrapProgress(p);
  let index = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].p <= x) index = i;
  }
  const from = keyframes[index];
  const to = keyframes[index + 1];
  const h = to.p - from.p;
  const s = h > 0 ? Math.min(1, Math.max(0, (x - from.p) / h)) : 1;
  const a = channels(from);
  const b = channels(to);
  const v = a.map((value, c) => hermite(value, b[c], slopes[index][c], slopes[index + 1][c], h, s));
  return { position: [v[0], v[1], v[2]], target: [v[3], v[4], v[5]] };
}

/** How far the lens focuses: on whatever the camera looks at, never closer than half a metre. */
export function focusDistance(pose: CameraPose): number {
  const [x, y, z] = pose.position;
  const [tx, ty, tz] = pose.target;
  return Math.max(0.5, Math.hypot(tx - x, ty - y, tz - z));
}
