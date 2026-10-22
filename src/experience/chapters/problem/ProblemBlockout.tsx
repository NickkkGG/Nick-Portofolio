// TEMPORARY blockout — replaced in milestone 6 (spec §7)
import { useRef } from 'react';
import { Color, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import { content } from '@/content';
import { smoothstep } from '@/lib/math';
import { useChapterFrame } from '../useChapterFrame';

const COUNT = content.stack.length;
const RED = new Color('#ff2a2a');
const WARM = new Color('#ffb35c');

export function ProblemBlockout() {
  const ref = useRef<Group>(null);
  const problems = useRef<(Mesh | null)[]>([]);

  useChapterFrame('problem', ref, (t) => {
    // Problems close in faster and faster, then freeze and warm up when the bulb lights.
    const tt = Math.min(t, 0.7);
    const radius = 3.5 - 2.3 * smoothstep(0, 0.6, tt);
    const warmth = smoothstep(0.7, 0.8, t);
    problems.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = (i * 2 * Math.PI) / COUNT + 6 * Math.PI * tt;
      mesh.position.set(radius * Math.sin(angle), -179 + 0.4 * Math.sin(i + 4 * tt), radius * Math.cos(angle));
      (mesh.material as MeshStandardMaterial).emissive.copy(RED).lerp(WARM, warmth);
    });
  });

  return (
    <group ref={ref}>
      <mesh position={[0, -179.4, 0]} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            problems.current[i] = mesh;
          }}
        >
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#000000" emissive="#ff2a2a" emissiveIntensity={1} />
        </mesh>
      ))}
    </group>
  );
}
