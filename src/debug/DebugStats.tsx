import { StatsGl } from '@react-three/drei';
import { useDebugMode } from './useDebugMode';

/** FPS / GPU panel inside the canvas, only in full debug mode. */
export function DebugStats() {
  const mode = useDebugMode();
  // stats-gl's container is unpositioned and would land after the scroll spacer.
  return mode === 'full' ? <StatsGl className="fixed left-6 top-16 z-30" /> : null;
}
