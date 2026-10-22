'use client';

import { Loader } from './Loader';

/**
 * Fixed HTML layer above the canvas. It ignores the pointer; interactive children
 * opt back in with pointer-events-auto. Visible UI pieces carry data-overlay-item
 * so tests can mask them without masking the whole screen.
 */
export function Overlay() {
  return (
    <div data-testid="overlay" className="pointer-events-none fixed inset-0 z-10">
      <Loader />
    </div>
  );
}
