import type { Vec3 } from '@/experience/camera/types';
import { lerp, smoothstep } from '@/lib/math';
import { resolve } from '@/timeline/resolve';

/** Where the bulb hangs once it is down, and how far above that it waits in the dark. */
export const BULB_Y = -177.5;
const DROP = 6;
/** Keycaps orbit the bulb at this radius, like moths round a lamp. */
const ORBIT = 1.6;
/** Contact-local t by which the keycaps have flown off into the dark. */
const KEYCAP_EXIT = 0.2;

/** Off until the idea, steady through stack and contact, out at the start of the loop. */
export function bulbIntensity(p: number): number {
  const { chapter, t } = resolve(p);
  switch (chapter.id) {
    case 'problem':
      return 3 * smoothstep(0.6, 0.8, t);
    case 'stack':
    case 'contact':
      return 3;
    case 'loop':
      return 3 * (1 - smoothstep(0, 0.15, t));
    default:
      return 0;
  }
}

/** Metres above its hanging point: the bulb comes down out of the dark just before it lights. */
export function bulbDrop(p: number): number {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'problem') return DROP * (1 - smoothstep(0.55, 0.7, t));
  return chapter.id === 'spiral' ? DROP : 0;
}

function orbitAngle(i: number, count: number, t: number): number {
  return (i * 2 * Math.PI) / count + 2 * Math.PI * t;
}

/** Where keycap `i` of `count` is at stack-local t: one turn round the bulb, bobbing. */
export function keycapPose(i: number, count: number, t: number): Vec3 {
  const angle = orbitAngle(i, count, t);
  return [ORBIT * Math.sin(angle), BULB_Y + 0.25 * Math.sin(2 * angle), ORBIT * Math.cos(angle)];
}

/**
 * Problem `i` of `count` at problem-local t (spec §3.7): circling the character, closer and
 * faster, until the bulb lights at 0.7; frozen while it warms from red (0.7-0.8); then it
 * shrinks away as a keycap grows in its place, ending on the keycap's first orbit position.
 */
export function problemPose(i: number, count: number, t: number): { position: Vec3; warmth: number; problemScale: number; keycapScale: number } {
  const tt = Math.min(t, 0.7);
  const r = 3.5 - 2.3 * smoothstep(0, 0.6, tt);
  const angle = (i * 2 * Math.PI) / count + 6 * Math.PI * tt;
  const circling: Vec3 = [r * Math.sin(angle), -179 + 0.4 * Math.sin(i + 4 * tt), r * Math.cos(angle)];
  const become = smoothstep(0.8, 1, t);
  const orbit = keycapPose(i, count, 0);
  return {
    position: [lerp(circling[0], orbit[0], become), lerp(circling[1], orbit[1], become), lerp(circling[2], orbit[2], become)],
    warmth: smoothstep(0.7, 0.8, t),
    problemScale: 1 - become,
    keycapScale: become,
  };
}

export interface KeycapState {
  position: Vec3;
  scale: number;
  /** Around Y: the keycap's face looks out from the bulb along this angle. */
  angle: number;
}

/**
 * Keycap `i` of `count` at global p: it grows out of its problem (problem t 0.8-1), circles
 * the bulb through the stack chapter, then keeps circling into contact as it flies off,
 * up and out into the dark, before the tapes arrive.
 */
export function keycapState(i: number, count: number, p: number): KeycapState {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'problem') {
    const pose = problemPose(i, count, t);
    return { position: pose.position, scale: pose.keycapScale, angle: orbitAngle(i, count, 0) };
  }
  if (chapter.id === 'stack') return { position: keycapPose(i, count, t), scale: 1, angle: orbitAngle(i, count, t) };
  if (chapter.id === 'contact' && t < KEYCAP_EXIT) {
    const leave = smoothstep(0, KEYCAP_EXIT, t);
    const [x, y, z] = keycapPose(i, count, 1 + t);
    const out = 1 + 1.5 * leave;
    return { position: [x * out, y + 2.5 * leave, z * out], scale: 1 - leave, angle: orbitAngle(i, count, 1 + t) };
  }
  return { position: keycapPose(i, count, 0), scale: 0, angle: 0 };
}

/** depths.glb models a VHS tape true size; the contact chapter shows them at this scale. */
export const CASSETTE_SCALE = 3;
/** The sleeve's outside, at that scale. */
export const CASSETTE_WIDTH = 0.193 * CASSETTE_SCALE;
export const CASSETTE_HALF_HEIGHT = (0.109 * CASSETTE_SCALE) / 2;
/** How far a hovered tape sticks out of its sleeve, at that scale (Cassettes.tsx). */
export const CASSETTE_REACH = 0.134 * CASSETTE_SCALE;
/** Out of sight under the water, where each tape waits to come up. */
const CASSETTE_SUNK_Y = -181.2;
/** Well in front of the character, close enough to the camera for the stickers to read. */
const TAPE_Z = 3;
/** Wings: the columns' centres either side of the character, and the top row's height. */
const WING_X = 1;
const WING_TOP_Y = -178.4;
/** Centre to centre down a column: the sleeve's height and a hand's width of air. */
const ROW_STEP = 0.5;
const COLUMN_STEP = 0.42;
const COLUMN_MID_Y = -178.65;

/**
 * Wide screens: two columns of tapes either side of the character, read left to right,
 * top to bottom, each opening away from it. Narrow screens: one column in front of it.
 */
export type TapeLayout = 'wings' | 'column';

export function tapeLayout(aspect: number): TapeLayout {
  return aspect < 0.95 ? 'column' : 'wings';
}

/** Where tape `i` of `count` waits once it is up, and which way it slides out (+1 right, -1 left). */
function tapeSlot(i: number, count: number, layout: TapeLayout): { x: number; y: number; side: 1 | -1 } {
  if (layout === 'column') return { x: 0, y: COLUMN_MID_Y + ((count - 1) / 2 - i) * COLUMN_STEP, side: 1 };
  const right = i % 2 === 1;
  return { x: right ? WING_X : -WING_X, y: WING_TOP_Y - Math.floor(i / 2) * ROW_STEP, side: right ? 1 : -1 };
}

/**
 * Tape `i` of `count` at contact-local t: it rises out of the water, one after another,
 * into its place beside the character, turned toward the camera, bobbing. A hovered tape
 * slides out on its `side`, away from every other tape.
 */
export function cassettePose(
  i: number,
  count: number,
  t: number,
  time = 0,
  layout: TapeLayout = 'wings',
): { position: Vec3; yaw: number; tilt: number; side: 1 | -1 } {
  const { x, y, side } = tapeSlot(i, count, layout);
  const rise = smoothstep(0.03 * i, 0.25 + 0.03 * i, t);
  const bob = 0.025 * Math.sin(time * 1.1 + i * 1.7);
  return {
    position: [x, lerp(CASSETTE_SUNK_Y, y, rise) + bob * rise, TAPE_Z - 0.1 * Math.abs(x)],
    yaw: -0.16 * x,
    tilt: 0.04 * Math.sin(time * 0.8 + i * 2.3),
    side,
  };
}

export const MAX_RIPPLES = 4;
/** Seconds a drip's rings stay on the water. */
export const RIPPLE_LIFE = 3.2;
const DRIP_EVERY = 0.9;

export interface Ripple {
  x: number;
  z: number;
  /** Seconds since the drip hit the water. */
  age: number;
}

function hash(n: number, salt: number): number {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Drips from the cables far above, ringing out on the water around the character: roughly
 * one every DRIP_EVERY seconds, on an uneven beat, each somewhere new. Newest first.
 */
export function dripRipples(time: number): Ripple[] {
  const latest = Math.floor(time / DRIP_EVERY);
  const ripples: Ripple[] = [];
  for (let k = latest; k > latest - MAX_RIPPLES - 2 && ripples.length < MAX_RIPPLES; k--) {
    const age = time - (k + 0.5 * hash(k, 0)) * DRIP_EVERY;
    if (age < 0 || age >= RIPPLE_LIFE) continue;
    const angle = 2 * Math.PI * hash(k, 1);
    const r = 1.2 + 5 * Math.sqrt(hash(k, 2));
    ripples.push({ x: r * Math.sin(angle), z: r * Math.cos(angle), age });
  }
  return ripples;
}

export const FLOOR_Y = -180;
/** A dead CRT lying on its side in the water is the character's seat: its top, metres. */
export const SEAT_TOP = FLOOR_Y + 0.46;
const SITTING: Vec3 = [0, SEAT_TOP + 0.45, 0];
const STANDING: Vec3 = [0, FLOOR_Y + 0.475, 0.5];
const HUNCH = 0.3;

/**
 * Where the character is and how far it leans forward (radians): hunched on the dead TV
 * through the problems, getting up early in the stack chapter, standing from then on.
 */
export function characterPose(p: number): { position: Vec3; lean: number } {
  const { chapter, t } = resolve(p);
  const up = chapter.id === 'stack' ? smoothstep(0.05, 0.45, t) : chapter.id === 'contact' || chapter.id === 'loop' ? 1 : 0;
  return {
    position: [lerp(SITTING[0], STANDING[0], up), lerp(SITTING[1], STANDING[1], up), lerp(SITTING[2], STANDING[2], up)],
    lean: HUNCH * (1 - up),
  };
}
