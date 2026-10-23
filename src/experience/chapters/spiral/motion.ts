import { flickerDips } from '@/experience/flicker';

const GRAVITY = 9.8;

/** Seed -> phase in 0..2PI, so neighbouring monitors never swing in step. */
const phase = (seed: number, k: number) => ((Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1) * 2 * Math.PI;

/**
 * Tilt (about X and Z, radians) of a monitor hanging on a cable `length` metres long.
 * It swings at the cable's pendulum period, a few centimetres at the screen, and
 * traces a slow ellipse rather than a line. Pure in time, so a frozen clock freezes it.
 */
export function hangingSway(time: number, seed: number, length: number): [number, number] {
  const omega = Math.sqrt(GRAVITY / length);
  const reach = 0.16 + 0.08 * Math.abs(Math.sin(seed * 3.7));
  const amplitude = reach / length;
  return [
    amplitude * Math.sin(omega * time + phase(seed, 1)),
    amplitude * 0.45 * Math.sin(omega * 1.03 * time + phase(seed, 2)),
  ];
}

/** How far into a surge's flash `x` seconds from its centre is: 1 in the core, 0 outside. */
const pulse = (x: number) => (x <= 0.05 ? 1 : x >= 0.09 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (x - 0.05)) / 0.04));

/**
 * Power surges through the project world (spec §3.6): every screen bursts into static at
 * once, now and then. Built on the same generator as the lamp, so never more than three
 * flashes in any second. 0 = no surge, 1 = full static.
 */
export function surgeLevel(time: number): number {
  let level = 0;
  for (const d of flickerDips(time - 0.1, time + 0.1, { nervous: 0.15, seed: 77 })) level = Math.max(level, pulse(Math.abs(time - d)));
  return level;
}
