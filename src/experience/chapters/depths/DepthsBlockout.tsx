// TEMPORARY blockout — replaced in milestone 6 (spec §7)
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, MeshStandardMaterial, PointLight } from 'three';
import { smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { useChapterFrame } from '../useChapterFrame';

const BULB: [number, number, number] = [0, -177.5, 0];

/** Off until the idea, steady through stack and contact, out at the start of the loop. */
function bulbIntensity(p: number): number {
  const { chapter, t } = resolve(p);
  switch (chapter.id) {
    case 'problem':
      return 3 * smoothstep(0.6, 0.8, t);
    case 'stack':
    case 'contact':
      return 3;
    case 'loop':
      return 3 * (1 - smoothstep(0, 0.15, t));
    default:
      return 0;
  }
}

/** Floor and bulb shared by the problem, stack and contact chapters. */
export function DepthsBlockout() {
  const ref = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const glass = useRef<MeshStandardMaterial>(null);
  useChapterFrame('depths', ref);

  useFrame(() => {
    const intensity = bulbIntensity(useExperience.getState().p);
    if (light.current) light.current.intensity = intensity;
    if (glass.current) glass.current.emissiveIntensity = intensity;
  });

  return (
    <group ref={ref}>
      <mesh position={[0, -180, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0f2a2a" roughness={0.35} />
      </mesh>
      <mesh position={BULB}>
        <sphereGeometry args={[0.12, 20, 20]} />
        <meshStandardMaterial ref={glass} color="#000000" emissive="#ffb35c" emissiveIntensity={0} />
      </mesh>
      <mesh position={[0, BULB[1] + 3, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 6, 6]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <pointLight ref={light} position={BULB} color="#ffb35c" intensity={0} distance={30} decay={0} />
    </group>
  );
}
