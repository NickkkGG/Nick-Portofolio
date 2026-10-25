import { lerp, smoothstep } from '@/lib/math';
import { CHAPTERS, type ChapterId } from '@/timeline/chapters';
import { resolve } from '@/timeline/resolve';

export type Rgb = [number, number, number];

/** The air of a chapter: sky gradient behind everything, fog, and overall exposure. */
export interface Atmosphere {
  top: Rgb;
  horizon: Rgb;
  bottom: Rgb;
  fog: Rgb;
  fogDensity: number;
  exposure: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const preset = (top: string, horizon: string, bottom: string, fog: string, fogDensity: number, exposure: number): Atmosphere => ({
  top: hexToRgb(top),
  horizon: hexToRgb(horizon),
  bottom: hexToRgb(bottom),
  fog: hexToRgb(fog),
  fogDensity,
  exposure,
});

/** Colours are sRGB; the scene converts them to linear. */
export const ATMOSPHERES: Record<ChapterId, Atmosphere> = {
  room: preset('#1a2e3a', '#0d1a20', '#050708', '#0c1418', 0.008, 1.65),
  // Clear air all the way down, blue-grey even straight below, so the fall never drops into black.
  fall: preset('#2e4c5b', '#17313b', '#0b181e', '#10222a', 0.012, 1.4),
  // The booth hangs in the same teal dark as the pillar, only dimmer: inside, the projector does the lighting.
  about: preset('#17403e', '#0a1f20', '#030707', '#0b2122', 0.012, 1.5),
  spiral: preset('#1d5a56', '#0d2b2c', '#030a0b', '#0f2f30', 0.016, 1.4),
  stack: preset('#4a3010', '#1e1306', '#050302', '#24170a', 0.02, 1.45),
  contact: preset('#3a2710', '#181006', '#040302', '#1c1308', 0.018, 1.45),
  loop: preset('#000000', '#000000', '#000000', '#000000', 0.03, 1),
};

const mixRgb = (a: Rgb, b: Rgb, e: number): Rgb => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];

function mix(a: Atmosphere, b: Atmosphere, e: number): Atmosphere {
  if (e <= 0) return a;
  if (e >= 1) return b;
  return {
    top: mixRgb(a.top, b.top, e),
    horizon: mixRgb(a.horizon, b.horizon, e),
    bottom: mixRgb(a.bottom, b.bottom, e),
    fog: mixRgb(a.fog, b.fog, e),
    fogDensity: lerp(a.fogDensity, b.fogDensity, e),
    exposure: lerp(a.exposure, b.exposure, e),
  };
}

/**
 * Atmosphere at global progress `p`. Each chapter keeps its own preset and blends
 * into the next one over its last 15%. The loop chapter is dark until the hidden
 * teleport, then already holds the room's air so the loop seam is invisible.
 */
export function atmosphereAt(p: number): Atmosphere {
  const { chapter, t } = resolve(p);
  if (chapter.id === 'loop') return mix(ATMOSPHERES.loop, ATMOSPHERES.room, smoothstep(0.25, 0.45, t));
  const next = CHAPTERS[CHAPTERS.findIndex((c) => c.id === chapter.id) + 1];
  return mix(ATMOSPHERES[chapter.id], ATMOSPHERES[next.id], smoothstep(0.85, 1, t));
}
