export type LoaderStatus = 'loading' | 'ready' | 'error';

export interface LoaderInput {
  sceneReady: boolean;
  active: boolean;
  loaded: number;
  total: number;
  errors: string[];
}

export function loaderState({ sceneReady, active, loaded, total, errors }: LoaderInput): {
  status: LoaderStatus;
  percent: number;
} {
  const progress = total > 0 ? Math.floor((loaded / total) * 100) : 0;
  if (errors.length > 0) return { status: 'error', percent: progress };
  if (!sceneReady || active || loaded < total) return { status: 'loading', percent: Math.min(99, progress) };
  return { status: 'ready', percent: 100 };
}

export function formatLoading(percent: number): string {
  return `LOADING TAPE ${String(Math.round(percent)).padStart(3, '0')}%`;
}
