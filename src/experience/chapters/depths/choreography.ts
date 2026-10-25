import type { Vec3 } from '@/experience/camera/types';
import { clamp01, lerp, smoothstep } from '@/lib/math';
import { resolve } from '@/timeline/resolve';

/** Where the bulb hangs once it is down, and how far above that it waits in the dark. */
export const BULB_Y = -177.5;
const DROP = 6;
/** Stack-local t: the bulb comes down out of the dark as the camera arrives, then catches. */
const BULB_DOWN = { from: 0.03, to: 0.13 } as const;
export const BULB_LIGHTS_T = 0.13;

/** Dark as the camera comes down off the pillar, lit over the tiles and the tapes, out at the start of the loop. */
export function bulbIntensity(p: number): number {
  const { chapter, t } = resolve(p);
  switch (chapter.id) {
    case 'stack':
      return 3 * smoothstep(BULB_LIGHTS_T, BULB_LIGHTS_T + 0.12, t);
    case 'contact':
      return 3;
    case 'loop':
      return 3 * (1 - smoothstep(0, 0.15, t));
    default:
      return 0;
  }
}

/** How much of what the bulb gives off it the camera looks through over the wall. */
const HAZE_OVER_WALL = 0.45;

/**
 * How thick the bulb's light hangs in the dust, 0..1: thinned once the wall of tiles is up, the
 * camera reading the wall through it, and full again as the camera pulls back over the tapes.
 */
export function bulbHaze(p: number): number {
  const { chapter, t } = resolve(p);
  const lit = bulbIntensity(p) / 3;
  if (chapter.id === 'stack') return lit * (1 - (1 - HAZE_OVER_WALL) * smoothstep(0.4, TILES_UP_T, t));
  if (chapter.id === 'contact') return lit * (1 - (1 - HAZE_OVER_WALL) * (1 - smoothstep(0, 0.25, t)));
  return lit;
}

/** Metres above its hanging point: the bulb comes down out of the dark just before it lights. */
export function bulbDrop(p: number): number {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'stack') return DROP * (1 - smoothstep(BULB_DOWN.from, BULB_DOWN.to, t));
  return chapter.id === 'spiral' ? DROP : 0;
}

/** The tool tiles (stack/Tiles.tsx): glazed ceramic, true to a big wall tile, and the air between them. Metres. */
export const TILE = { size: 0.42, thickness: 0.045, gap: 0.08 } as const;
/** The wall the tiles make: this far behind the bulb, its middle at this height. */
const WALL = { z: -2.2, y: -178.75 } as const;
/** Stack-local t at which the first tile starts into the wall, and how long each one takes. */
const GATHER = { from: 0.24, flight: 0.2 } as const;
/** Stack-local t by which every tile is in the wall, facing the camera. */
export const TILES_UP_T = 0.6;
/** Contact-local t by which the tiles have gone up into the dark. */
const TILES_GONE_T = 0.18;
/** A hovered tile, picked: grown about its middle, and come this far toward the camera (metres). */
export const TILE_HOVER = { grow: 1.1, forward: 0.3 } as const;

/** How much bigger than true a short list's tiles may be drawn. */
const MAX_GROW = 1.4;
/** Across `n` tiles at true size, with the air between them. */
const span = (n: number) => n * TILE.size + (n - 1) * TILE.gap;

/**
 * How much wall the camera frames (camera/paths.ts) on a screen of `aspect` (width / height),
 * in metres: on a wide one the longest list's wall (24 tiles, 8 by 3) at true size, on a
 * narrow one what its width allows, and a little taller, the title being a few lines deep.
 */
function wallRoom(aspect: number): { width: number; height: number } {
  return { width: Math.min(span(8), 2.5 * aspect), height: aspect < 1 ? 1.55 : span(3) };
}

interface WallShape {
  rows: number;
  columns: number;
  scale: number;
}
/** Every tile asks for the same wall each frame: the last one worked out. */
let lastShape: { count: number; aspect: number; shape: WallShape } = { count: 0, aspect: 0, shape: { rows: 1, columns: 1, scale: 1 } };

/**
 * Rows and columns for `count` tiles on a screen of `aspect`, and how much bigger than true
 * they are drawn: the shape that lets them be biggest, then the one with fewest gaps in its
 * last row, then the one closest to the room's own shape.
 */
function wallShape(count: number, aspect: number): WallShape {
  if (lastShape.count === count && lastShape.aspect === aspect) return lastShape.shape;
  const room = wallRoom(aspect);
  const shapes = Array.from({ length: count }, (_, k) => {
    const columns = k + 1;
    const rows = Math.ceil(count / columns);
    return { rows, columns, scale: Math.min(MAX_GROW, room.width / span(columns), room.height / span(rows)) };
  });
  const gaps = ({ rows, columns }: WallShape) => rows * columns - count;
  const off = ({ rows, columns }: WallShape) => Math.abs(Math.log(span(columns) / span(rows) / (room.width / room.height)));
  const shape = shapes.reduce((best, next) => {
    if (Math.abs(next.scale - best.scale) > 1e-6) return next.scale > best.scale ? next : best;
    if (gaps(next) !== gaps(best)) return gaps(next) < gaps(best) ? next : best;
    return off(next) < off(best) ? next : best;
  });
  lastShape = { count, aspect, shape };
  return shape;
}

/** How much bigger (or smaller) than true the tiles of a wall of `count` are drawn on a screen of `aspect`. */
export function tileScale(count: number, aspect: number): number {
  return wallShape(count, aspect).scale;
}

const signed = (n: number, salt: number) => 2 * hash(n, salt) - 1;

/** About where the camera hangs over the wall (camera/paths.ts). */
const EYE: Vec3 = [0, -178.6, 1.4];
/** Where on a tile the bulb glints, up from its middle as a share of its size: along its top edge, well clear of the name. */
const GLINT_AT = 0.45;

/** Euler angles (X, Y) turning a tile at `at` to face halfway between the camera and the bulb: the bulb glints in its glaze. */
function glinting(at: Vec3): [number, number] {
  const unit = ([x, y, z]: Vec3): Vec3 => {
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };
  const eye = unit([EYE[0] - at[0], EYE[1] - at[1], EYE[2] - at[2]]);
  const bulb = unit([-at[0], BULB_Y - at[1], -at[2]]);
  const [x, y, z] = unit([eye[0] + bulb[0], eye[1] + bulb[1], eye[2] + bulb[2]]);
  return [Math.atan2(-y, z), Math.asin(x)];
}

/**
 * Where tile `i` of `count` hangs in the wall on a screen of `aspect`, read left to right, top
 * to bottom, the last row centred under the rest: a little out of true, as if the grout gave up
 * long ago, and each tipped to catch the bulb for the camera.
 */
export function tileSlot(i: number, count: number, aspect: number): { position: Vec3; rotation: Vec3 } {
  const { rows, columns, scale } = wallShape(count, aspect);
  const row = Math.floor(i / columns);
  const inRow = row < rows - 1 ? columns : count - columns * (rows - 1);
  const step = (TILE.size + TILE.gap) * scale;
  const position: Vec3 = [
    ((i % columns) - (inRow - 1) / 2) * step + 0.02 * scale * signed(i, 3),
    WALL.y + ((rows - 1) / 2 - row) * step + 0.02 * scale * signed(i, 4),
    WALL.z + 0.05 * signed(i, 5),
  ];
  const [x, y] = glinting([position[0], position[1] + GLINT_AT * TILE.size * scale, position[2]]);
  // How far it tips out of true moves its glint, more so on a smaller tile: tipped in proportion.
  return { position, rotation: [x + 0.012 * scale * signed(i, 6), y + 0.03 * signed(i, 7), 0.05 * signed(i, 8)] };
}

/** Where tile `i` drifts in the dark beyond the wall before it comes in, turned every which way. */
function scattered(i: number, time: number): { position: Vec3; rotation: Vec3 } {
  return {
    position: [
      2.2 * signed(i, 11) + 0.15 * Math.sin(time * 0.23 + i),
      WALL.y + 0.3 + 0.9 * signed(i, 12) + 0.1 * Math.sin(time * 0.31 + 2 * i),
      WALL.z - 0.7 - 2.2 * hash(i, 13) + 0.1 * Math.cos(time * 0.19 + 3 * i),
    ],
    rotation: [2.8 * signed(i, 14) + 0.6 * Math.sin(time * 0.2 + i), Math.PI * signed(i, 15) + 0.6 * Math.sin(time * 0.17 + 2 * i), 1.5 * signed(i, 16)],
  };
}

/** Stack-local t at which tile `i` of `count` starts into the wall: the middle of the wall first. */
function gatherStart(i: number, count: number, aspect: number): number {
  const slots = Array.from({ length: count }, (_, k) => tileSlot(k, count, aspect).position);
  const off = ([x, y]: Vec3) => Math.hypot(x, y - WALL.y);
  const rank = slots.filter((slot) => off(slot) < off(slots[i])).length;
  const spread = TILES_UP_T - GATHER.flight - GATHER.from;
  return GATHER.from + (count > 1 ? (spread * rank) / (count - 1) : 0);
}

export interface TileState {
  position: Vec3;
  /** Euler angles, XYZ. */
  rotation: Vec3;
  scale: number;
}

/**
 * Tile `i` of `count` at global p and scene `time`, on a screen of `aspect`: drifting in the dark beyond the wall while
 * the camera comes down, then, one after another, flying in to hang in the wall facing the
 * bulb and the camera, where it keeps floating. As the contact starts the tiles go up into
 * the dark. Scrolling back takes the wall apart again.
 */
export function tileState(i: number, count: number, p: number, time: number, aspect: number): TileState {
  const { chapter, t } = resolve(p);
  const slot = tileSlot(i, count, aspect);
  const size = tileScale(count, aspect);
  if (chapter.id === 'spiral') return { ...scattered(i, time), scale: size };
  if (chapter.id !== 'stack' && chapter.id !== 'contact') return { ...slot, scale: 0 };
  const u = chapter.id === 'stack' ? clamp01((t - gatherStart(i, count, aspect)) / GATHER.flight) : 1;
  const come = smoothstep(0, 1, u);
  const settled = smoothstep(0.7, 1, u);
  const from = scattered(i, time);
  const mix = (a: Vec3, b: Vec3): Vec3 => [lerp(a[0], b[0], come), lerp(a[1], b[1], come), lerp(a[2], b[2], come)];
  const position = mix(from.position, slot.position);
  const rotation = mix(from.rotation, slot.rotation);
  // A little arc on the way in, then the float of something hanging in still air.
  position[1] += 0.25 * Math.sin(Math.PI * u) + 0.015 * Math.sin(time * 0.9 + 1.3 * i) * settled;
  rotation[0] += 0.012 * size * Math.sin(time * 0.7 + i) * settled;
  rotation[1] += 0.035 * Math.sin(time * 0.5 + 2 * i) * settled;
  if (chapter.id === 'stack') return { position, rotation, scale: size };
  // Up and away into the dark, tumbling, before the tapes come up.
  const away = smoothstep(0, TILES_GONE_T, t);
  return {
    position: [position[0] * (1 + 0.5 * away), position[1] + 3.2 * away * away, position[2] - 1.2 * away],
    rotation: [rotation[0] + 1.2 * signed(i, 17) * away, rotation[1] + 1.5 * signed(i, 18) * away, rotation[2]],
    scale: size * (1 - smoothstep(0.55, 1, away)),
  };
}

/** depths.glb models a VHS tape true size; the contact chapter shows them at this scale. */
export const CASSETTE_SCALE = 3;
/** The sleeve's outside, at that scale. */
export const CASSETTE_WIDTH = 0.193 * CASSETTE_SCALE;
export const CASSETTE_HALF_HEIGHT = (0.109 * CASSETTE_SCALE) / 2;
/** How far a hovered tape sticks out of its sleeve, at that scale (Cassettes.tsx). */
export const CASSETTE_REACH = 0.134 * CASSETTE_SCALE;
/** A hovered tape, picked: grown about its middle, and come this far toward the camera (metres). */
export const HOVER = { grow: 1.12, forward: 0.22 } as const;
/** Under the water in the bulb's pool of light, where every tape comes up from. */
const RISE_FROM: Vec3 = [0, -181.2, 0.8];
/** Contact-local t at which the first tape starts up, and how long each takes to its place. */
const RISE = { start: 0.08, travel: 0.22 } as const;
/** Contact-local t by which every tape is in its place, turned to the camera. */
export const TAPES_UP_T = 0.45;
/** Well in front of the bulb, close enough to the camera for the stickers to read. */
const TAPE_Z = 3;
/** Wings: the columns' centres either side of the bulb, and the top row's height. */
const WING_X = 1;
const WING_TOP_Y = -178.4;
/** Centre to centre down a column: the sleeve's height and a hand's width of air. */
const ROW_STEP = 0.5;
const COLUMN_STEP = 0.42;
/** One column, on a narrow screen: further back, so a picked tape slid out still fits across it, and under the tagline's lines. */
const COLUMN_Z = 1.5;
const COLUMN_MID_Y = -178.78;

/**
 * Wide screens: two columns of tapes either side of the bulb, read left to right, top to
 * bottom. Narrow screens: one column down the middle.
 */
export type TapeLayout = 'wings' | 'column';

export function tapeLayout(aspect: number): TapeLayout {
  return aspect < 0.95 ? 'column' : 'wings';
}

/**
 * Where the lens should focus over the contact on a screen of `aspect`, and how far it has
 * come over to there (0..1): one column of tapes stands further back than the camera looks.
 * Null where what the camera looks at is the subject.
 */
export function tapeFocus(p: number, aspect: number): { at: Vec3; weight: number } | null {
  const { chapter, t } = resolve(p);
  if (chapter.id !== 'contact' || tapeLayout(aspect) !== 'column') return null;
  const weight = smoothstep(0.05, 0.35, t) * (1 - smoothstep(0.9, 1, t));
  return weight > 0 ? { at: [0, COLUMN_MID_Y, COLUMN_Z], weight } : null;
}

/**
 * Where tape `i` of `count` waits once it is up, and which way it slides out (+1 right, -1
 * left): always toward the middle, so a hovered tape never runs off the edge of the screen.
 * In one column they take turns, each set off to the side by half the slide, so the tape and
 * its sleeve end up about the middle.
 */
function tapeSlot(i: number, count: number, layout: TapeLayout): { x: number; y: number; z: number; side: 1 | -1 } {
  if (layout === 'column') {
    const side = i % 2 === 0 ? 1 : -1;
    return { x: (-side * CASSETTE_REACH) / 2, y: COLUMN_MID_Y + ((count - 1) / 2 - i) * COLUMN_STEP, z: COLUMN_Z, side };
  }
  const right = i % 2 === 1;
  const x = right ? WING_X : -WING_X;
  return { x, y: WING_TOP_Y - Math.floor(i / 2) * ROW_STEP, z: TAPE_Z - 0.1 * Math.abs(x), side: right ? -1 : 1 };
}

/**
 * Tape `i` of `count` at contact-local t: one after another the tapes come up out of the
 * water under the bulb, rise past their places a little and settle into them, spreading out
 * as they go, turning to face the camera and banking into the turn. Then they bob. A
 * hovered tape slides out on its `side` (Cassettes.tsx).
 */
export function cassettePose(
  i: number,
  count: number,
  t: number,
  time = 0,
  layout: TapeLayout = 'wings',
): { position: Vec3; yaw: number; tilt: number; roll: number; side: 1 | -1 } {
  const { x, y, z, side } = tapeSlot(i, count, layout);
  const step = count > 1 ? (TAPES_UP_T - RISE.travel - RISE.start) / (count - 1) : 0;
  const u = clamp01((t - RISE.start - i * step) / RISE.travel);
  // Up out of the water fast and easing into place, a little past it halfway.
  const up = 1 - (1 - u) ** 3;
  const spread = smoothstep(0.25, 1, u);
  const settled = smoothstep(0.6, 1, u);
  const away = x === 0 ? 1 : Math.sign(x);
  const bob = 0.025 * Math.sin(time * 1.1 + i * 1.7) * settled;
  return {
    position: [x * spread, lerp(RISE_FROM[1], y, up) + 0.12 * Math.sin(Math.PI * u) + bob, lerp(RISE_FROM[2], z, smoothstep(0.1, 1, u))],
    yaw: -0.16 * x + 0.9 * away * (1 - smoothstep(0.2, 0.9, u)),
    tilt: 0.3 * (1 - smoothstep(0.05, 0.6, u)) + 0.04 * Math.sin(time * 0.8 + i * 2.3) * settled,
    roll: -0.3 * away * Math.sin(Math.PI * spread) + 0.03 * Math.sin(time * 0.6 + i),
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
