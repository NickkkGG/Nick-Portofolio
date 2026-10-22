import type { Vec3 } from './types';

type Wave = [amplitude: number, hertz: number, phase: number];

const sum = (time: number, waves: Wave[]) =>
  waves.reduce((total, [amplitude, hertz, phase]) => total + amplitude * Math.sin(time * hertz * 2 * Math.PI + phase), 0);

// Incommensurate frequencies, so the sway never visibly repeats. Metres, camera space.
const POSITION: Wave[][] = [
  [[0.01, 0.11, 0], [0.006, 0.29, 1.7], [0.003, 0.71, 4.1]],
  [[0.008, 0.13, 2.3], [0.005, 0.37, 0.6], [0.002, 0.83, 3.3]],
  [[0.006, 0.07, 5.1], [0.003, 0.23, 2.9]],
];
const TARGET: Wave[][] = [
  [[0.016, 0.09, 0.9], [0.008, 0.31, 2.2], [0.004, 0.67, 5.5]],
  [[0.012, 0.12, 3.7], [0.007, 0.41, 1.1], [0.003, 0.79, 0.2]],
  [[0.008, 0.08, 4.4]],
];

/** Camcorder-in-hand sway at scene time `time`: where the camera and its aim drift to. */
export function handheldOffset(time: number): { position: Vec3; target: Vec3 } {
  const at = (axes: Wave[][]) => axes.map((waves) => sum(time, waves)) as Vec3;
  return { position: at(POSITION), target: at(TARGET) };
}

const clampUnit = (x: number) => Math.min(1, Math.max(-1, x));

/** Camera-space shift for a pointer at (x, y) in -1..1: lean toward where the visitor looks. */
export function parallaxOffset(x: number, y: number): Vec3 {
  return [0.12 * clampUnit(x), 0.06 * clampUnit(y), 0];
}
