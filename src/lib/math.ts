export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Hermite ease between `edge0` and `edge1`, clamped to 0..1 (same as GLSL smoothstep). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
