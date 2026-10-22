// TEMPORARY blockout — replaced in milestone 5 (spec §7)
import { useRef } from 'react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { content } from '@/content';
import { smoothstep } from '@/lib/math';
import { useChapterFrame } from '../useChapterFrame';
import { focusedIndex, helixSlots, SPIRAL } from './helix';

const SLOTS = helixSlots(content.projects.length);
const STANDING_Y = SPIRAL.platformY + 0.475;

export function SpiralBlockout() {
  const ref = useRef<Group>(null);
  const character = useRef<Mesh>(null);
  const screens = useRef<(MeshStandardMaterial | null)[]>([]);

  useChapterFrame('spiral', ref, (t) => {
    if (character.current) {
      character.current.position.y = STANDING_Y + 9.5 * (1 - smoothstep(0, 0.1, t));
    }
    const focused = focusedIndex(t, SLOTS.length);
    screens.current.forEach((material, i) => {
      if (material) material.emissiveIntensity = i === focused ? 2.5 : 0.5;
    });
  });

  return (
    <group ref={ref}>
      <mesh position={[0, (SPIRAL.platformY - 160) / 2, 0]}>
        <cylinderGeometry args={[2, 2, 160 + SPIRAL.platformY, 24]} />
        <meshStandardMaterial color="#0f2a2a" roughness={0.6} />
      </mesh>
      <mesh position={[0, SPIRAL.platformY - 0.15, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.3, 32]} />
        <meshStandardMaterial color="#16302e" roughness={0.4} />
      </mesh>
      <mesh ref={character} position={[0.6, STANDING_Y, 0.6]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>
      {SLOTS.map((slot, i) => (
        <group key={i} position={slot.position} rotation={[0, slot.angle, 0]}>
          <mesh>
            <boxGeometry args={[1.2, 1, 1]} />
            <meshStandardMaterial color="#b8ad93" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.51]}>
            <planeGeometry args={[1, 0.75]} />
            <meshStandardMaterial
              ref={(material) => {
                screens.current[i] = material;
              }}
              color="#000000"
              emissive="#cfe8ff"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 3, 6]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
