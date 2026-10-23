import { useFrame } from '@react-three/fiber';
import { useExperience } from '@/store/useExperience';

/**
 * First thing each rendered frame: moves the smooth scroll on (so the camera reads this
 * frame's progress, not the last one's), then advances the store clock (clamped after tab switches).
 */
export function FrameClock() {
  useFrame((_, delta) => {
    const store = useExperience.getState();
    store.scroll?.raf(performance.now());
    store.tick(Math.min(delta, 0.1));
  });
  return null;
}
