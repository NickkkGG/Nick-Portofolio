import { BEAM_OUT_T, PROJECTOR_ON_T, SHEET_DROP_T, slideAt } from '@/experience/chapters/booth/slides';
import { BULB_LIGHTS_T, dripRipples } from '@/experience/chapters/depths/choreography';
import { DUST } from '@/experience/chapters/fall/dust';
import { lampNervousness, roomT } from '@/experience/chapters/room/knock';
import { focusedIndex } from '@/experience/chapters/spiral/helix';
import { flickerDips } from '@/experience/flicker';
import { type ChapterId, getChapter } from '@/timeline/chapters';
import { displayState, LOOP_TELEPORT_P } from '@/timeline/loop';

/** One-off sounds of the story, played by sfx.ts (the knock has its own, audio/knock.ts). */
export type Cue =
  | 'power-on'
  | 'floor-break'
  | 'dust'
  | 'landing'
  | 'projector'
  | 'slide'
  | 'sheet'
  | 'channel'
  | 'seam'
  | 'bulb'
  | 'tiles'
  | 'tapes'
  | 'tune';

const within = (id: ChapterId, t: number) => {
  const chapter = getChapter(id);
  return chapter.start + (chapter.end - chapter.start) * t;
};
/** The falling figure starts to crumble to dust (fall/dust.ts). */
const DUST_P = within('fall', DUST.start);
/** The bulb catches as it starts to glow, once the camera is down off the pillar (choreography.ts). */
const BULB_P = within('stack', BULB_LIGHTS_T);
/** The first tiles touch into the wall behind it (choreography.ts tileState). */
const TILES_P = within('stack', 0.4);
/** The first tape breaks the water under the bulb (cassettePose). */
const TAPES_P = within('contact', 0.12);
/** In the booth (booth/slides.ts): the lamp catching, the rope snapping, the beam reaching the first monitor. */
const PROJECTOR_P = within('about', PROJECTOR_ON_T);
const SHEET_P = within('about', SHEET_DROP_T);
const BEAM_P = within('about', BEAM_OUT_T);

/** How far `p` is ahead of `prevP` round the loop, -0.5..0.5. */
export const ahead = (prevP: number, p: number) => ((p - prevP + 1.5) % 1) - 0.5;

/** Whether going forward from `prevP` to `p` passes `mark`. */
function passes(prevP: number, p: number, mark: number): boolean {
  const step = ahead(prevP, p);
  const along = (mark - prevP + 1) % 1;
  return step > 0 && along > 0 && along <= step;
}

/**
 * The one-off sounds of a scroll from `prevP` to `p`. A chapter change switches channel, except
 * where the story has its own sound for it: the floor giving way under the room, the crash into
 * the booth, and none at all out of the booth window, where the camera never cuts. Jumps (the
 * nav, keys) only switch channel; the beats they skip stay silent.
 */
export function scrollCues(prevP: number, p: number, programmatic: boolean, projects: number, slides: number): Cue[] {
  if (prevP === p) return [];
  const before = displayState(prevP);
  const after = displayState(p);
  const changed = before.chapterId !== after.chapterId;
  if (programmatic) return changed ? ['channel'] : [];
  const forward = ahead(prevP, p) > 0;
  const cues: Cue[] = [];
  if (changed) {
    const through = (a: ChapterId, b: ChapterId) => before.chapterId === a && after.chapterId === b;
    if (forward && through('room', 'fall')) cues.push('floor-break');
    else if (forward && through('fall', 'about')) cues.push('landing');
    else if (!through('about', 'spiral') && !through('spiral', 'about')) cues.push('channel');
  }
  if (passes(prevP, p, DUST_P)) cues.push('dust');
  if (passes(prevP, p, PROJECTOR_P)) cues.push('projector');
  // The carousel clicks once a step, either way, however many slides a fast scroll skips.
  if (!changed && after.chapterId === 'about' && slideAt(before.t, slides).index !== slideAt(after.t, slides).index) cues.push('slide');
  if (passes(prevP, p, SHEET_P)) cues.push('sheet');
  if (passes(prevP, p, BEAM_P)) cues.push('tune');
  if (passes(prevP, p, LOOP_TELEPORT_P)) cues.push('seam');
  if (passes(prevP, p, BULB_P)) cues.push('bulb');
  if (passes(prevP, p, TILES_P)) cues.push('tiles');
  if (passes(prevP, p, TAPES_P)) cues.push('tapes');
  if (!changed && after.chapterId === 'spiral' && focusedIndex(before.t, projects) !== focusedIndex(after.t, projects)) cues.push('tune');
  return cues;
}

/** Drips that hit the water after `from` and by `to` (scene seconds), and when; Depths draws their rings. */
export function dripsBetween(from: number, to: number): { x: number; z: number; at: number }[] {
  if (to <= from) return [];
  return dripRipples(to)
    .filter((ripple) => ripple.age < to - from)
    .map(({ x, z, age }) => ({ x, z, at: to - age }));
}

export interface Ambient {
  name: 'crackle' | 'drip';
  /** The scene time it belongs to. */
  at: number;
  /** -1 (left) .. 1 (right). */
  pan: number;
  level: number;
}

/** Longer steps of the scene clock are jumps (a tab coming back, a test setting it): nothing plays for them. */
const MAX_STEP = 0.25;

/**
 * The sounds of the place from scene time `from` to `to`, at progress `p`: the room's lamp
 * crackling each time it dips (flicker.ts, the knocks' stutter included), and drips below
 * the pillar.
 */
export function ambientSounds(p: number, from: number, to: number, knocks: readonly number[]): Ambient[] {
  if (to <= from || to - from > MAX_STEP) return [];
  const { chapterId } = displayState(p);
  const sounds: Ambient[] = [];
  if (chapterId === 'room') {
    const nervous = lampNervousness(roomT(p));
    for (const at of flickerDips(from, to, { nervous, knocks })) sounds.push({ name: 'crackle', at, pan: 0, level: 0.5 + 0.5 * nervous });
  }
  if (chapterId === 'stack' || chapterId === 'contact') {
    for (const { x, z, at } of dripsBetween(from, to)) {
      sounds.push({ name: 'drip', at, pan: Math.max(-1, Math.min(1, x / 6.2)), level: 1 / (1 + 0.25 * Math.hypot(x, z)) });
    }
  }
  return sounds;
}
