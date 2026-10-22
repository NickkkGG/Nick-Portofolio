// TEMPORARY blockout — replaced in milestone 6 (spec §7)
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { content } from '@/content';
import { useChapterFrame } from '../useChapterFrame';

const COUNT = content.stack.length;

/** Keycaps (one per tool) orbiting the bulb like moths around a lamp. */
export function StackBlockout() {
  const ref = useRef<Group>(null);
  const keycaps = useRef<(Mesh | null)[]>([]);

  useChapterFrame('stack', ref, (t) => {
    keycaps.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = (i * 2 * Math.PI) / COUNT + 2 * Math.PI * t;
      mesh.position.set(1.6 * Math.sin(angle), -177.5 + 0.25 * Math.sin(2 * angle), 1.6 * Math.cos(angle));
      mesh.rotation.y = angle;
    });
  });

  return (
    <group ref={ref}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            keycaps.current[i] = mesh;
          }}
        >
          <boxGeometry args={[0.3, 0.12, 0.3]} />
          <meshStandardMaterial color="#d9d2bf" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
