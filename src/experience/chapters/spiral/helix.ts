import { clamp01, smoothstep } from '@/lib/math';
import type { Vec3 } from '@/experience/camera/types';

/** Layout of the project world: a helix of monitors around the cable pillar (axis x = 0, z = 0). */
export const SPIRAL = {
  topY: -84,
  bottomY: -156,
  radius: 6,
  turns: 1.25,
  platformY: -80,
  cameraDistance: 3.4,
  cameraLift: 0.15,
} as const;

export interface HelixSlot {
  position: Vec3;
  angle: number;
}

export function helixSlots(count: number): HelixSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = count <= 1 ? 0 : (i * SPIRAL.turns * 2 * Math.PI) / (count - 1);
    const y = count <= 1 ? SPIRAL.topY : SPIRAL.topY + (i * (SPIRAL.bottomY - SPIRAL.topY)) / (count - 1);
    return { position: [SPIRAL.radius * Math.sin(angle), y, SPIRAL.radius * Math.cos(angle)], angle };
  });
}

/** Spiral-local t at which the camera sits right in front of monitor `index`. */
export function slotKeyframeT(index: number, count: number): number {
  return count <= 1 ? 0.1 : 0.1 + (0.9 * index) / (count - 1);
}

/** 1 while the camera is parked in front of monitor `index`, easing to 0 by the next monitor. */
export function monitorFocus(t: number, index: number, count: number): number {
  if (count <= 1) return 1;
  const along = clamp01((t - 0.1) / 0.9) * (count - 1);
  return 1 - smoothstep(0, 1, Math.abs(along - index));
}

/** The monitor the camera is closest to at spiral-local t. */
export function focusedIndex(t: number, count: number): number {
  if (count <= 1) return 0;
  return Math.round(clamp01((t - 0.1) / 0.9) * (count - 1));
}
