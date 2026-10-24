'use client';

import { useEffect } from 'react';
import { type SoundEvent, useExperience } from '@/store/useExperience';
import { bedLevels, Beds } from './beds';
import { ahead, ambientSounds } from './cues';
import { currentSfxBus, isSfx, playSfx } from './sfx';

/** A bigger step of progress in one frame is a jump (the nav, a key), not speed. */
const MAX_FRAME_STEP = 0.02;

/**
 * Plays the scene's sounds (sfx.ts): the story's cues as the store logs them (PLAY switching
 * the set on, the floor giving way, channels changing), and every frame the beds under the
 * chapters (beds.ts) and the sounds of the place (cues.ts). Quiet while the tab is hidden.
 * The knock plays in the room itself (audio/knock.ts).
 */
export function SoundScape() {
  useEffect(() => {
    const store = useExperience.getState;
    // PLAY's sound is played inside its click, so the browser lets the audio start.
    const heard = new WeakSet<SoundEvent>(store().sounds);
    const unsubscribe = useExperience.subscribe(
      (s) => s.sounds,
      (sounds) => {
        for (const event of sounds) {
          if (heard.has(event)) continue;
          heard.add(event);
          if (isSfx(event.name)) playSfx(event.name);
        }
      },
    );

    let beds: Beds | null = null;
    let last = { p: store().p, time: store().time, at: performance.now() };
    let speed = 0;
    let frame = requestAnimationFrame(function step(now) {
      frame = requestAnimationFrame(step);
      const { started, p, time, knock } = store();
      const bus = currentSfxBus();
      if (started && bus) {
        const dt = Math.max(0.001, (now - last.at) / 1000);
        const moved = Math.min(Math.abs(ahead(last.p, p)), MAX_FRAME_STEP);
        speed += (moved / dt - speed) * Math.min(1, dt * 6);
        beds ??= new Beds(bus.ctx, bus.input);
        beds.set(bedLevels(p, time, speed));
        for (const sound of ambientSounds(p, last.time, time, knock.knocks)) bus.play(sound.name, { pan: sound.pan, level: sound.level });
      }
      last = { p, time, at: now };
    });

    const onVisibility = () => currentSfxBus()?.setAwake(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      beds?.stop();
    };
  }, []);
  return null;
}
