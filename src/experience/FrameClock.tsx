import { useFrame } from '@react-three/fiber';
import { useExperience } from '@/store/useExperience';

/** Advances the store clock once per rendered frame (clamped after tab switches). */
export function FrameClock() {
  useFrame((_, delta) => useExperience.getState().tick(Math.min(delta, 0.1)));
  return null;
}
