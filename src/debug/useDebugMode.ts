'use client';

import { useSyncExternalStore } from 'react';

/** off: no debug tools. quiet: test hook only (Playwright). full: hook, leva and stats. */
export type DebugMode = 'off' | 'quiet' | 'full';

export function readDebugMode(search: string): DebugMode {
  const params = new URLSearchParams(search);
  if (!params.has('debug')) return 'off';
  return params.has('quiet') ? 'quiet' : 'full';
}

const subscribe = () => () => {};

/** 'off' on the server and during hydration, then the mode from the URL. */
export function useDebugMode(): DebugMode {
  return useSyncExternalStore(
    subscribe,
    () => readDebugMode(window.location.search),
    () => 'off',
  );
}
