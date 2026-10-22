// TEMPORARY blockout — replaced in milestone 7 (spec §7)
import { useRef } from 'react';
import type { Group } from 'three';
import { smoothstep } from '@/lib/math';
import { useChapterFrame } from '../useChapterFrame';

const CASSETTE_X = [-1.2, -0.4, 0.4, 1.2];
const CASSETTE_Y = -178.6;

export function ContactBlockout() {
  const ref = useRef<Group>(null);
  const cassettes = useRef<Group>(null);

  useChapterFrame('contact', ref, (t) => {
    if (cassettes.current) cassettes.current.position.y = -1.5 * (1 - smoothstep(0, 0.3, t));
  });

  return (
    <group ref={ref}>
      {/* Soft fill from the camera side so the cassette labels read; the bulb backlights the rest. */}
      <pointLight position={[0, -178, 4]} color="#e8e6d9" intensity={1.2} distance={10} decay={0} />
      <mesh position={[0, -179.525, 0]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>
      <group ref={cassettes}>
        {CASSETTE_X.map((x) => (
          <group key={x} position={[x, CASSETTE_Y, 1.6]}>
            <mesh>
              <boxGeometry args={[0.6, 0.35, 0.08]} />
              <meshStandardMaterial color="#141414" roughness={0.5} />
            </mesh>
            {/* Paper label, handwritten in milestone 7 */}
            <mesh position={[0, 0.06, 0.041]}>
              <planeGeometry args={[0.45, 0.12]} />
              <meshStandardMaterial color="#e8e6d9" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
