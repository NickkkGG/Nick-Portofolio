'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import { useExperience } from '@/store/useExperience';
import { LOOP_LENGTH_VH } from '@/timeline/chapters';
import { chapterStartP, wrapProgress } from '@/timeline/resolve';
import type { ScrollApi } from './types';

/**
 * Turns page scroll into the story's progress `p` with Lenis in infinite mode.
 * Renders the spacer that gives the page one loop of scroll length.
 */
export function ScrollDriver() {
  useEffect(() => {
    const store = useExperience.getState;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    store().setScroll(0, { programmatic: true });

    const lenis = new Lenis({ infinite: true, autoRaf: true, autoResize: false });
    lenis.stop();

    // Programmatic moves (jumps, resizes) must never count as a loop.
    let jumping = false;
    lenis.on('scroll', (instance: Lenis) => store().setScroll(instance.progress, { programmatic: jumping }));

    const jumpTo = (p: number) => {
      if (!store().started) return;
      const target = wrapProgress(p);
      const wasJumping = jumping;
      jumping = true;
      lenis.scrollTo(target * lenis.limit, { immediate: true, force: true });
      store().setScroll(target, { programmatic: true });
      jumping = wasJumping;
    };

    const api: ScrollApi = {
      start: () => lenis.start(),
      stop: () => lenis.stop(),
      jumpTo,
      toChapter: (id) => {
        store().spikeVhs(0.8);
        jumpTo(chapterStartP(id) + 0.002);
      },
    };
    store().registerScroll(api);

    // Lenis keeps pixels while one loop is 14 screens, so re-apply p after a resize.
    const onResize = () => {
      const { p } = store();
      jumping = true;
      lenis.resize();
      jumpTo(p);
      jumping = false;
    };
    // Native keyboard scrolling stops at the document's ends, which breaks the infinite
    // loop, and its jumps would be counted as loops. Keys move the story through Lenis.
    const onKeyDown = (event: KeyboardEvent) => {
      const onControl = (event.target as Element | null)?.closest?.('a, button, input, textarea, select');
      if (onControl && (event.key === ' ' || event.key === 'Enter')) return;
      const command = event.metaKey || event.ctrlKey;
      const line = window.innerHeight * 0.1;
      const screen = window.innerHeight * 0.875;
      let delta = 0;
      switch (event.key) {
        case 'Home':
          event.preventDefault();
          api.toChapter('room');
          return;
        case 'End':
          event.preventDefault();
          return;
        case 'ArrowUp':
          if (command) {
            event.preventDefault();
            api.toChapter('room');
            return;
          }
          delta = -line;
          break;
        case 'ArrowDown':
          if (command) {
            event.preventDefault();
            return;
          }
          delta = line;
          break;
        case 'PageUp':
          delta = -screen;
          break;
        case 'PageDown':
          delta = screen;
          break;
        case ' ':
          delta = event.shiftKey ? -screen : screen;
          break;
        default:
          return;
      }
      event.preventDefault();
      if (store().started) lenis.scrollTo(lenis.scroll + delta);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      lenis.destroy();
      store().registerScroll(null);
    };
  }, []);

  return <div aria-hidden data-testid="scroll-spacer" style={{ height: `${LOOP_LENGTH_VH + 100}vh` }} />;
}
