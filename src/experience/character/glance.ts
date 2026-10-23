import type { Vec3 } from '@/experience/camera/types';
import { smoothstep } from '@/lib/math';

/** Something the character heard: when (scene seconds) and where. */
export interface Heard {
  at: number;
  point: Vec3;
}

/**
 * How a knock turns the head, in seconds: a beat to react, a quick turn, a wary look
 * at the wall, then slowly back to the screen.
 */
export const GLANCE = { react: 0.12, turn: 0.4, hold: 1.7, back: 1 } as const;

/** How far a neck turns (rad): either side of the body, and up and down from level. The eyes do the rest. */
export const REACH = { yaw: 1.3, up: 0.35, down: 0.4 } as const;

const turnedBy = (age: number) => smoothstep(GLANCE.react, GLANCE.react + GLANCE.turn, age);

function backBy(age: number): number {
  const from = GLANCE.react + GLANCE.turn + GLANCE.hold;
  return smoothstep(from, from + GLANCE.back, age);
}

/** How far the head is turned to a knock heard `age` seconds ago: 0 on the screen, 1 on the knock. */
export function glanceWeight(age: number): number {
  return turnedBy(age) * (1 - backBy(age));
}

const mix = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] * (1 - k) + b[0] * k, a[1] * (1 - k) + b[1] * k, a[2] * (1 - k) + b[2] * k];

/**
 * Where the character looks at `now`, and how much: at the latest knock. If the head was
 * still turned to the one before, it swings across from there rather than back to the screen first.
 */
export function glanceAt(heard: readonly Heard[], now: number): { point: Vec3; weight: number } | null {
  const last = heard.at(-1);
  if (!last || now < last.at) return null;
  const age = now - last.at;
  const prev = heard.at(-2);
  const carried = prev ? glanceWeight(last.at - prev.at) : 0;
  const turned = turnedBy(age);
  const weight = (carried + (1 - carried) * turned) * (1 - backBy(age));
  if (weight <= 0) return null;
  return { point: prev && carried > 0 ? mix(prev.point, last.point, turned) : last.point, weight };
}

/** Heading of a direction about the vertical: 0 along +z, positive toward +x. */
export const yawOf = (v: Vec3) => Math.atan2(v[0], v[2]);

/** Elevation of a direction above level. */
export const pitchOf = (v: Vec3) => Math.asin(Math.max(-1, Math.min(1, v[1] / (Math.hypot(v[0], v[1], v[2]) || 1))));

/** An angle brought into -π..π. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, x));

/**
 * The turn that points a face looking along `face` at `toward`: a yaw about the vertical,
 * then a pitch, no further than a neck reaches from the body's forward `body`.
 */
export function headTurn(face: Vec3, toward: Vec3, body: Vec3): { yaw: number; pitch: number } {
  const bodyYaw = yawOf(body);
  const yaw = bodyYaw + clamp(wrapAngle(yawOf(toward) - bodyYaw), -REACH.yaw, REACH.yaw);
  const pitch = clamp(pitchOf(toward), -REACH.down, REACH.up);
  return { yaw: wrapAngle(yaw - yawOf(face)), pitch: pitch - pitchOf(face) };
}
