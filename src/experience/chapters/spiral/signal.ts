import { smoothstep } from '@/lib/math';

/**
 * A project screen's reception of its preview video: NO SIGNAL static until the camera
 * parks in front of it and the video has frames, then a second of tuning in (the picture
 * rolls, its lines tear, the static thins) until it locks. When the camera moves on it
 * breaks back to static, faster, and the video rests.
 */

/** Seconds from static to a locked picture. */
export const TUNE_IN_S = 1.1;
/** Seconds from the picture back to static. */
export const DROP_OUT_S = 0.3;

/** Picture heights it rolls through before the vertical hold catches. */
const ROLLS = 2;
/** The farthest a line tears sideways, as a share of the picture's width. */
const TEAR = 0.12;

export interface Reception {
  /** 0 all static … 1 the picture locked in. */
  level: number;
  /** Heading for the picture, rather than falling back to static. */
  tuning: boolean;
}

export const NO_SIGNAL: Reception = { level: 0, tuning: false };

/** In sight, switched on, and the camera closer to this screen than to its neighbours. */
export function wantsPicture(focus: number, power: number, onScreen: boolean): boolean {
  return onScreen && power > 0.5 && focus > 0.5;
}

/**
 * The reception `dt` seconds on: towards the picture while it is wanted and the video has
 * frames, back to static otherwise. A frozen clock passes Infinity and settles at once.
 */
export function tune(reception: Reception, dt: number, wanted: boolean, ready: boolean): Reception {
  const tuning = wanted && ready;
  const step = dt > 0 ? dt : 0;
  const level = tuning ? Math.min(1, reception.level + step / TUNE_IN_S) : Math.max(0, reception.level - step / DROP_OUT_S);
  return { level, tuning };
}

/** For the shader: how much picture shows through the static, how far it has rolled, how hard its lines tear. */
export function receptionLook({ level, tuning }: Reception): { picture: number; roll: number; tear: number } {
  return {
    picture: smoothstep(0.15, 0.85, level),
    // Rolling slows to a stop as it locks; dropping out only tears.
    roll: tuning ? ROLLS * (1 - level) ** 2 : 0,
    tear: TEAR * (1 - level),
  };
}

/** The video runs while its picture is wanted or still on screen, and rests once the screen is static. */
export function videoRuns(reception: Reception, wanted: boolean): boolean {
  return wanted || reception.level > 0;
}

/** Where in its loop the video holds for a frozen clock, so screenshots show the same frame. */
export function heldVideoTime(time: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return ((time % duration) + duration) % duration;
}
