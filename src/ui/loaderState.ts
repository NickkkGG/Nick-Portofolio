import { clamp01, lerp } from '@/lib/math';

export type LoaderStatus = 'loading' | 'ready' | 'error';

export interface LoaderInput {
  sceneReady: boolean;
  active: boolean;
  loaded: number;
  total: number;
  errors: string[];
  /** 0..1: how far the scene has warmed up behind the loader (shaders, then its first full frame). */
  warmup: number;
}

/** Downloads fill most of the counter; warming the scene up fills the rest. */
const DOWNLOAD_SHARE = 0.7;

export function loaderState({ sceneReady, active, loaded, total, errors, warmup }: LoaderInput): {
  status: LoaderStatus;
  percent: number;
} {
  const downloaded = total > 0 ? loaded / total : 0;
  const progress = Math.floor((downloaded * DOWNLOAD_SHARE + clamp01(warmup) * (1 - DOWNLOAD_SHARE)) * 100);
  if (errors.length > 0) return { status: 'error', percent: progress };
  if (!sceneReady || active || loaded < total) return { status: 'loading', percent: Math.min(99, progress) };
  return { status: 'ready', percent: 100 };
}

export function formatLoading(percent: number): string {
  return `LOADING TAPE ${String(Math.round(percent)).padStart(3, '0')}%`;
}

/** Tungsten heating up: barely-there red, deep red, orange, then a warm white (sRGB 0-255). */
const HEAT: [level: number, rgb: [number, number, number]][] = [
  [0, [58, 12, 6]],
  [0.35, [170, 36, 12]],
  [0.7, [255, 110, 34]],
  [1, [255, 222, 168]],
];

/** The loader filament's colour at `level` 0..1 of the loading. */
export function filamentHeat(level: number): string {
  const x = clamp01(level);
  let i = 1;
  while (i < HEAT.length - 1 && HEAT[i][0] < x) i++;
  const [l0, c0] = HEAT[i - 1];
  const [l1, c1] = HEAT[i];
  const t = (x - l0) / (l1 - l0);
  const [r, g, b] = c0.map((c, k) => Math.round(lerp(c, c1[k], t)));
  return `rgb(${r}, ${g}, ${b})`;
}
