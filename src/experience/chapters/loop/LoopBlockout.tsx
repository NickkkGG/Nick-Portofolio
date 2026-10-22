// TEMPORARY blockout — replaced in milestone 7 (spec §7)
import { useRef } from 'react';
import type { Group } from 'three';
import { useChapterFrame } from '../useChapterFrame';

/**
 * The room's ceiling seen from above while falling back in. It faces up, so from
 * inside the room it is back-face culled and never disturbs the loop seam.
 */
export function LoopBlockout() {
  const ref = useRef<Group>(null);
  useChapterFrame('loop', ref);
  return (
    <group ref={ref}>
      <mesh position={[0, 3.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#0f2a2a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, 4]} />
        <meshStandardMaterial color="#000000" emissive="#cfe8ff" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}
