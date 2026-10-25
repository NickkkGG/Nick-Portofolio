import { MAX_RIPPLES, type Ripple, RIPPLE_LIFE } from './choreography';

/** Where something broke the water, and when by the scene clock: rings run out from there. */
export class Splashes {
  private readonly marks: { x: number; z: number; at: number }[] = [];

  add(x: number, z: number, at: number) {
    this.marks.unshift({ x, z, at });
    this.marks.length = Math.min(this.marks.length, MAX_RIPPLES);
  }

  /** The rings on the water at `time`, newest first. */
  ripples(time: number): Ripple[] {
    return this.marks.filter(({ at }) => time >= at && time - at < RIPPLE_LIFE).map(({ x, z, at }) => ({ x, z, age: time - at }));
  }
}

/** The tapes coming up through the water (contact/Cassettes.tsx); the floor rings with them (Depths.tsx). */
export const tapeSplashes = new Splashes();

/** Rings from both, the youngest first, as many as the water's shader has room for. */
export function mergeRipples(a: Ripple[], b: Ripple[]): Ripple[] {
  return [...a, ...b].sort((p, q) => p.age - q.age).slice(0, MAX_RIPPLES);
}
