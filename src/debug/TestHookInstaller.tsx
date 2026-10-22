'use client';

import { useEffect } from 'react';
import { createTestHook } from './testHook';
import { useDebugMode } from './useDebugMode';

/** Installs `window.__experience` in debug modes so tests can drive the story. */
export function TestHookInstaller() {
  const mode = useDebugMode();
  useEffect(() => {
    if (mode === 'off') return;
    window.__experience = createTestHook();
    return () => {
      delete window.__experience;
    };
  }, [mode]);
  return null;
}
