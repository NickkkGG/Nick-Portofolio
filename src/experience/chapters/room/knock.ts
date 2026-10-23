import type { Vec3 } from '@/experience/camera/types';
import { smoothstep } from '@/lib/math';
import { displayState } from '@/timeline/loop';
import { resolve } from '@/timeline/resolve';

/** The ghost knock (spec §3.4): how worked up the room is, and when it last heard a knock. */
export interface KnockState {
  tension: number;
  lastKnock: number | null;
  /** Recent knock times, for the lamp's flicker. */
  knocks: number[];
  /** When the monitor last typed "who's there?". */
  whosThereAt: number | null;
}

export const INITIAL_KNOCK: KnockState = { tension: 0, lastKnock: null, knocks: [], whosThereAt: null };

export const TENSION_MAX = 5;
const DECAY_SECONDS = 10;
/** Faster knocks are ignored: each knock flickers the lamp, and flickers stay under 3 per second. */
const COOLDOWN = 0.9;
const REMEMBERED = 8;
/** Thin things on a wall (posters, stains, webs) still knock the wall behind them. */
const ON_WALL = 0.06;

/** One click knocks twice, knock-knock: when each knuckle lands after the click (s), and how hard. */
export const KNUCKLES = [
  { delay: 0, strength: 1 },
  { delay: 0.3, strength: 0.85 },
] as const;
/** The second knuckle lands this far along the wall from the first (m). */
const KNUCKLE_STEP = 0.03;

/** Where knuckle `k` lands for a click at `point` on a wall facing `normal`. */
export function knucklePoint(point: Vec3, normal: Vec3, k: number): Vec3 {
  const [nx, , nz] = normal;
  // Sideways along the wall; on a floor or ceiling, along x.
  const length = Math.hypot(nx, nz);
  const side: Vec3 = length > 0.01 ? [nz / length, 0, -nx / length] : [1, 0, 0];
  return [point[0] + side[0] * KNUCKLE_STEP * k, point[1] - 0.012 * k, point[2] + side[2] * KNUCKLE_STEP * k];
}

export interface KnockHit {
  distance: number;
  knockable: boolean;
  point: Vec3;
  normal: Vec3;
}

/** Tension at `now`: one less for every ten seconds since the last knock. */
export function tensionAt(state: KnockState, now: number): number {
  if (state.lastKnock === null) return 0;
  return Math.max(0, state.tension - Math.floor((now - state.lastKnock) / DECAY_SECONDS));
}

/** A knock at `now`. The fifth in a row makes the monitor answer, and the tension lets go. */
export function knock(state: KnockState, now: number): { state: KnockState; accepted: boolean; whosThere: boolean } {
  if (state.lastKnock !== null && now - state.lastKnock < COOLDOWN) return { state, accepted: false, whosThere: false };
  const tension = tensionAt(state, now) + 1;
  const whosThere = tension >= TENSION_MAX;
  return {
    state: {
      tension: whosThere ? 0 : tension,
      lastKnock: now,
      knocks: [...state.knocks, now].slice(-REMEMBERED),
      whosThereAt: whosThere ? now : state.whosThereAt,
    },
    accepted: true,
    whosThere,
  };
}

/** Knocking works in the room until its floor starts to give (t < 0.6). */
export function canKnock(p: number): boolean {
  const { chapterId, t } = displayState(p);
  return chapterId === 'room' && t < 0.6;
}

/** The wall a click lands on: the first knockable hit, if nothing solid stands in front of it. */
export function knockTarget(hits: readonly KnockHit[]): KnockHit | null {
  if (hits.length === 0) return null;
  const nearest = Math.min(...hits.map((h) => h.distance));
  const wall = [...hits].sort((a, b) => a.distance - b.distance).find((h) => h.knockable);
  return wall && wall.distance - nearest <= ON_WALL ? wall : null;
}

/** The room's own clock: its chapter's t, calm (0) again once the loop lands back in it. */
export function roomT(p: number): number {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'room') return t;
  return chapter.id === 'loop' ? 0 : 1;
}

/** How nervous the lamp is: steady at first, stuttering as the floor nears its break. */
export function lampNervousness(t: number): number {
  return smoothstep(0.2, 0.9, t);
}
