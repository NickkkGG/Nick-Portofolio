import { BEAM_OUT_T, PROJECTOR_ON_T, SHEET_DROP_T, slideAt } from '@/experience/chapters/booth/slides';
import { bulbIntensity, dripRipples } from '@/experience/chapters/depths/choreography';
import { lampNervousness, roomT } from '@/experience/chapters/room/knock';
import { focusedIndex } from '@/experience/chapters/spiral/helix';
import { flickerDips } from '@/experience/flicker';
import { type ChapterId, getChapter } from '@/timeline/chapters';
import { displayState, LOOP_TELEPORT_P } from '@/timeline/loop';

/** One-off sounds of the story, played by sfx.ts (the knock has its own, audio/knock.ts). */
export type Cue =
  | 'power-on'
  | 'floor-break'
  | 'landing'
  | 'projector'
  | 'slide'
  | 'sheet'
  | 'channel'
  | 'seam'
  | 'bulb'
  | 'tapes'
  | 'tune';

const within = (id: ChapterId, t: number) => {
  const chapter = getChapter(id);
  return chapter.start + (chapter.end - chapter.start) * t;
};
/** The bulb catches as it starts to glow (choreography.ts lights it over problem t 0.6-0.8). */
const BULB_P = within('problem', 0.62);
/** The first tape is halfway up out of the water (cassettePose). */
const TAPES_P = within('contact', 0.07);
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
  if (passes(prevP, p, PROJECTOR_P)) cues.push('projector');
  // The carousel clicks once a step, either way, however many slides a fast scroll skips.
  if (!changed && after.chapterId === 'about' && slideAt(before.t, slides).index !== slideAt(after.t, slides).index) cues.push('slide');
  if (passes(prevP, p, SHEET_P)) cues.push('sheet');
  if (passes(prevP, p, BEAM_P)) cues.push('tune');
  if (passes(prevP, p, LOOP_TELEPORT_P)) cues.push('seam');
  if (passes(prevP, p, BULB_P)) cues.push('bulb');
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

function hash(n: number, salt: number): number {
  const s = Math.sin(n * 91.7 + salt * 47.3) * 24634.6345;
  return s - Math.floor(s);
}

const GLITCH_SLOT = 1.6;

/** When the problems in the dark glitch, after `from` and by `to`: most slots of 1.6 s, at an uneven moment in each. */
export function glitchesBetween(from: number, to: number): number[] {
  const times: number[] = [];
  for (let k = Math.floor(from / GLITCH_SLOT); k <= Math.floor(to / GLITCH_SLOT); k++) {
    if (hash(k, 1) > 0.7) continue;
    const time = (k + hash(k, 2)) * GLITCH_SLOT;
    if (time > from && time <= to) times.push(time);
  }
  return times;
}

export interface Ambient {
  name: 'crackle' | 'drip' | 'glitch';
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
 * crackling each time it dips (flicker.ts, the knocks' stutter included), the problems
 * glitching in the dark until the bulb lights, and drips below the pillar.
 */
export function ambientSounds(p: number, from: number, to: number, knocks: readonly number[]): Ambient[] {
  if (to <= from || to - from > MAX_STEP) return [];
  const { chapterId } = displayState(p);
  const sounds: Ambient[] = [];
  if (chapterId === 'room') {
    const nervous = lampNervousness(roomT(p));
    for (const at of flickerDips(from, to, { nervous, knocks })) sounds.push({ name: 'crackle', at, pan: 0, level: 0.5 + 0.5 * nervous });
  }
  if (chapterId === 'problem' && bulbIntensity(p) < 1) {
    for (const at of glitchesBetween(from, to)) sounds.push({ name: 'glitch', at, pan: 0.7 * Math.sin(at * 12.9898), level: 0.8 });
  }
  if (chapterId === 'problem' || chapterId === 'stack' || chapterId === 'contact') {
    for (const { x, z, at } of dripsBetween(from, to)) {
      sounds.push({ name: 'drip', at, pan: Math.max(-1, Math.min(1, x / 6.2)), level: 1 / (1 + 0.25 * Math.hypot(x, z)) });
    }
  }
  return sounds;
}
