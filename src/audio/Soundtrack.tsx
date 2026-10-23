'use client';

import { useEffect } from 'react';
import { useExperience } from '@/store/useExperience';
import { type Mood, moodAt } from './mood';
import { setMusicMood, startMusic, stopMusic } from './music';

const STORAGE_KEY = 'music';

/** The visitor's choice from an earlier visit; music is on unless they switched it off. */
export function readMusicChoice(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveMusicChoice(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Private windows may refuse; the switch still works for this visit.
  }
}

/** Rounded, so scrolling only retunes the music when the mood really moves. */
const moodKey = (m: Mood) => [Math.round(m.tone / 50), Math.round(m.pad / 50), m.notes.toFixed(2), m.pedal.toFixed(1), m.level.toFixed(2)].join('|');

/**
 * Runs the soundtrack: it starts with PLAY (inside that click, so the browser lets it sound),
 * follows the story's mood as the visitor scrolls, and goes quiet while the tab is hidden.
 */
export function Soundtrack() {
  useEffect(() => {
    useExperience.getState().setMusic(readMusicChoice());
    const apply = () => {
      const { started, music, p } = useExperience.getState();
      if (started && music && document.visibilityState === 'visible') startMusic(moodAt(p));
      else stopMusic();
    };
    let last = '';
    const unsubscribePlay = useExperience.subscribe((s) => s.started && s.music, apply);
    const unsubscribeMood = useExperience.subscribe(
      (s) => s.p,
      (p) => {
        const mood = moodAt(p);
        const key = moodKey(mood);
        if (key === last) return;
        last = key;
        setMusicMood(mood);
      },
    );
    document.addEventListener('visibilitychange', apply);
    return () => {
      unsubscribePlay();
      unsubscribeMood();
      document.removeEventListener('visibilitychange', apply);
      stopMusic();
    };
  }, []);
  return null;
}
