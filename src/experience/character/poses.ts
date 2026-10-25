import type { Vec3 } from '@/experience/camera/types';
import { standUp } from '@/experience/chapters/booth/slides';
import { clamp01, smoothstep } from '@/lib/math';
import { resolve } from '@/timeline/resolve';

/** The character's clips (blender/scripts/character.py) and their lengths in seconds. */
export const CLIPS = { Stand: 4, SitType: 4, Fall: 3, SitHunched: 5, StandUp: 2 } as const;
export type Clip = keyof typeof CLIPS;

/**
 * One clip in the blend: how much of it, where in it (seconds), and where the model stands
 * while it plays. Offsets blend with the weights, so a clip that ends a step forward hands
 * over to one that starts there without a jump.
 */
export interface ClipMix {
  clip: Clip;
  weight: number;
  time: number;
  offset?: Vec3;
}

/** A looping clip at scene time `time` (seconds). */
export function looping(clip: Clip, time: number, weight = 1, offset?: Vec3): ClipMix {
  const length = CLIPS[clip];
  return { clip, weight, time: ((time % length) + length) % length, offset };
}

/** A clip held `k` (0..1) of the way through, as the scroll scrubs it. */
export function scrubbed(clip: Clip, k: number, weight = 1, offset?: Vec3): ClipMix {
  // Never quite the end: three.js wraps a looping clip's last instant back to its start.
  return { clip, weight, time: Math.min(clamp01(k) * CLIPS[clip], CLIPS[clip] - 1e-3), offset };
}

/** Where the model's origin goes for this blend: the weighted mix of the clips' offsets. */
export function blendedOffset(mix: readonly ClipMix[]): Vec3 {
  const out: Vec3 = [0, 0, 0];
  for (const { weight, offset } of mix) {
    if (!offset) continue;
    for (let k = 0; k < 3; k++) out[k] += weight * offset[k];
  }
  return out;
}

/** At the desk, typing, for as long as the room is on screen. */
export function roomMix(time: number): ClipMix[] {
  return [looping('SitType', time)];
}

/** On the way down through the floor. */
export function fallMix(time: number): ClipMix[] {
  return [looping('Fall', time)];
}


/** How long the hand-overs into and out of getting up take, as a share of the rise. */
const HANDOVER = 0.06;
/** Getting up ends a step forward: the standing clip plays from there. */
export const STEP_FORWARD: Vec3 = [0, 0, 0.4];

/** Out of a breathing sit, through getting up (`k` 0..1, as the scroll scrubs it), into standing a step forward. */
function rising(k: number, time: number): ClipMix[] {
  if (k <= 0) return [looping('SitHunched', time)];
  // Out of the breathing loop into the rise, and out of the rise into standing, each eased.
  const intoRise = smoothstep(0, HANDOVER, k);
  const intoStand = smoothstep(1 - HANDOVER, 1, k);
  return [
    looping('SitHunched', time, 1 - intoRise),
    scrubbed('StandUp', k, intoRise - intoStand),
    looping('Stand', time, intoStand, STEP_FORWARD),
  ].filter((m) => m.weight > 0);
}

/**
 * In the booth: hunched on the crate through the slides, getting up once the sheet is down
 * (booth/slides.ts), then standing at the window while the camera tours the monitors.
 */
export function boothMix(p: number, time: number): ClipMix[] {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'spiral') return [looping('Stand', time, 1, STEP_FORWARD)];
  return rising(standUp(t), time);
}
