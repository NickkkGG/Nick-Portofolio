import { bulbIntensity } from '@/experience/chapters/depths/choreography';
import { lerp, smoothstep } from '@/lib/math';
import type { ChapterId } from '@/timeline/chapters';
import { fadeAt, LOOP_ARRIVE_T, LOOP_TELEPORT_T } from '@/timeline/loop';
import { resolve } from '@/timeline/resolve';

/** How the soundtrack plays at a point of the story (music.ts). */
export interface Mood {
  /** Cutoff of the tape's tone (Hz): how muffled everything sounds. */
  tone: number;
  /** Cutoff of the pads' own filter (Hz): how bright the chords are. */
  pad: number;
  /** Chance of a melody note on each eighth. */
  notes: number;
  /** 0..1: how much the bass holds a low D under every chord instead of following it. */
  pedal: number;
  /** 0..1 loudness. */
  level: number;
}

const MOODS: Record<ChapterId, Mood> = {
  // Late at night at the desk: warm, close, a few notes.
  room: { tone: 3200, pad: 1400, notes: 0.16, pedal: 0, level: 1 },
  // Falling: the chords open up over a held low note, the melody holds its breath.
  fall: { tone: 4200, pad: 2200, notes: 0.04, pedal: 1, level: 1 },
  // The booth: as if through its plank walls, sparse, so the slides can be read over it.
  about: { tone: 2600, pad: 1200, notes: 0.1, pedal: 0.3, level: 0.85 },
  // The projects: brighter, the melody wanders between the monitors.
  spiral: { tone: 3800, pad: 1800, notes: 0.26, pedal: 0, level: 1 },
  // The problems circling in the dark: muffled and tense until the bulb lights (see moodAt).
  problem: { tone: 1900, pad: 850, notes: 0.06, pedal: 1, level: 0.9 },
  stack: { tone: 3600, pad: 1650, notes: 0.24, pedal: 0, level: 1 },
  contact: { tone: 3400, pad: 1500, notes: 0.18, pedal: 0, level: 1 },
  loop: { tone: 2300, pad: 1100, notes: 0.05, pedal: 0.5, level: 1 },
};

/** Once the idea's bulb is lit, the problem chapter sounds like the chapters after it. */
const LIT = MOODS.stack;

function mix(a: Mood, b: Mood, k: number): Mood {
  return {
    tone: lerp(a.tone, b.tone, k),
    pad: lerp(a.pad, b.pad, k),
    notes: lerp(a.notes, b.notes, k),
    pedal: lerp(a.pedal, b.pedal, k),
    level: lerp(a.level, b.level, k),
  };
}

/** The soundtrack's mood at global progress `p`. */
export function moodAt(p: number): Mood {
  const { chapter, t } = resolve(p);
  const mood = MOODS[chapter.id];
  if (chapter.id === 'problem') return mix(mood, LIT, bulbIntensity(p) / 3);
  if (chapter.id !== 'loop') return mood;
  // It sinks with the picture into the blackout, then drifts back to the room's sound as the
  // camera comes down into it, so the loop seam sounds the same on both sides.
  const home = mix(mood, MOODS.room, smoothstep(LOOP_TELEPORT_T, LOOP_ARRIVE_T, t));
  return { ...home, level: home.level * (1 - 0.75 * fadeAt(p)) };
}
