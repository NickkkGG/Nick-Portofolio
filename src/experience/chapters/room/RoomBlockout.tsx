// TEMPORARY blockout — replaced in milestone 3 (spec §7)
import { useRef } from 'react';
import type { Group } from 'three';
import { useChapterFrame } from '../useChapterFrame';

const WALL = '#1b1d1c';

/** 6 × 6 m room, 3 m high, character at the origin facing −Z toward the desk. */
export function RoomBlockout() {
  const ref = useRef<Group>(null);
  useChapterFrame('room', ref);
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#141615" roughness={0.95} />
      </mesh>
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.5, -3]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.5, 3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[-3, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>
      <mesh position={[3, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>

      {/* Desk, monitor and its glowing screen */}
      <mesh position={[0, 0.375, -1.2]}>
        <boxGeometry args={[1.4, 0.75, 0.7]} />
        <meshStandardMaterial color="#3a2f25" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1, -1.35]}>
        <boxGeometry args={[0.55, 0.42, 0.45]} />
        <meshStandardMaterial color="#b8ad93" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1, -1.124]}>
        <planeGeometry args={[0.46, 0.33]} />
        <meshStandardMaterial color="#000000" emissive="#cfe8ff" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0, 1, -1]} color="#cfe8ff" intensity={1.2} distance={4} />

      {/* Chair and character placeholder */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#202022" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0.25]}>
        <boxGeometry args={[0.5, 0.7, 0.08]} />
        <meshStandardMaterial color="#202022" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1, 0.05]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>

      {/* Desk lamp */}
      <mesh position={[0.55, 1.05, -1.25]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#000000" emissive="#ffb35c" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0.55, 1.05, -1.25]} color="#ffb35c" intensity={2} distance={6} />
    </group>
  );
}
