'use client';

import { useEffect, useRef } from 'react';
import { focusBrackets } from '@/experience/chapters/focus';

/** Camcorder focus brackets that lock onto the tile or tape under the pointer (the scene moves them). */
export function FocusBrackets() {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusBrackets.attach(element.current);
    return () => focusBrackets.attach(null);
  }, []);
  return (
    <div ref={element} data-overlay-item data-testid="focus-brackets" data-state="off" className="focus-brackets" aria-hidden="true">
      <span className="focus-brackets-frame">
        <span className="tl" />
        <span className="tr" />
        <span className="bl" />
        <span className="br" />
      </span>
    </div>
  );
}
