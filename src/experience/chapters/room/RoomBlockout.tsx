// TEMPORARY blockout — replaced in milestone 3 (spec §7)
import { useRef } from 'react';
import type { Group } from 'three';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { useChapterFrame } from '../useChapterFrame';

const WALL = '#2a2d2b';
const BLIND = '#c9c1ae';

// Window in the left wall (x = −3): z from −1.3 to 0.1, y from 1.0 to 2.2.
const WINDOW = { zMin: -1.3, zMax: 0.1, yMin: 1, yMax: 2.2 };
const SLATS = Array.from({ length: 9 }, (_, i) => WINDOW.yMin + 0.08 + i * 0.13);

/** 6 × 6 m room, 3 m high, character at the origin facing −Z toward the desk. */
export function RoomBlockout() {
  const ref = useRef<Group>(null);
  useChapterFrame('room', ref);
  return (
    <group ref={ref}>
      {/* Fill so walls read in the dark; the moon, lamp and monitor do the shaping. */}
      <hemisphereLight args={['#3a4a58', '#120f0c', 0.42]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#242120" roughness={0.9} />
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
      <mesh position={[3, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={WALL} roughness={0.95} />
      </mesh>

      {/* Left wall, built around the window opening */}
      <group position={[-3, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, WINDOW.yMin / 2, 0]}>
          <planeGeometry args={[6, WINDOW.yMin]} />
          <meshStandardMaterial color={WALL} roughness={0.95} />
        </mesh>
        <mesh position={[0, (WINDOW.yMax + 3) / 2, 0]}>
          <planeGeometry args={[6, 3 - WINDOW.yMax]} />
          <meshStandardMaterial color={WALL} roughness={0.95} />
        </mesh>
        <mesh position={[(-3 - WINDOW.zMin) / 2 + WINDOW.zMin, (WINDOW.yMin + WINDOW.yMax) / 2, 0]}>
          <planeGeometry args={[WINDOW.zMin + 3, WINDOW.yMax - WINDOW.yMin]} />
          <meshStandardMaterial color={WALL} roughness={0.95} />
        </mesh>
        <mesh position={[(WINDOW.zMax + 3) / 2, (WINDOW.yMin + WINDOW.yMax) / 2, 0]}>
          <planeGeometry args={[3 - WINDOW.zMax, WINDOW.yMax - WINDOW.yMin]} />
          <meshStandardMaterial color={WALL} roughness={0.95} />
        </mesh>
      </group>
      {/* Half-open blinds */}
      {SLATS.map((y) => (
        <mesh key={y} position={[-2.97, y, (WINDOW.zMin + WINDOW.zMax) / 2]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.02, 0.05, WINDOW.zMax - WINDOW.zMin]} />
          <meshStandardMaterial color={BLIND} roughness={0.6} />
        </mesh>
      ))}
      {/* The moon, placed in line with the window from the opening camera */}
      <mesh position={[-64, 4, -43]}>
        <sphereGeometry args={[2.5, 24, 24]} />
        <meshBasicMaterial color="#dfe9ff" toneMapped={false} />
      </mesh>
      <spotLight
        position={[-4.5, 2.6, -0.6]}
        target-position={[-0.5, 0, 0.6]}
        color="#8fb3e6"
        intensity={16}
        angle={0.6}
        penumbra={0.7}
        decay={0}
        distance={12}
      />
      <LightShaft
        group="room"
        from={[-3.05, 1.65, -0.6]}
        toward={[-0.4, 0, 0.7]}
        length={3.8}
        radiusStart={0.6}
        radiusEnd={1.4}
        color="#88aee0"
        intensity={0.2}
      />

      {/* Desk, monitor and its glowing screen */}
      <mesh position={[0, 0.375, -1.2]}>
        <boxGeometry args={[1.4, 0.75, 0.7]} />
        <meshStandardMaterial color="#5a4632" roughness={0.75} />
      </mesh>
      <mesh position={[0, 1, -1.35]}>
        <boxGeometry args={[0.55, 0.42, 0.45]} />
        <meshStandardMaterial color="#b8ad93" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1, -1.124]}>
        <planeGeometry args={[0.46, 0.33]} />
        <meshStandardMaterial color="#000000" emissive="#cfe8ff" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0, 1, -0.95]} color="#cfe8ff" intensity={3} distance={5} decay={1} />
      <LightShaft
        group="room"
        from={[0, 1, -1.11]}
        toward={[0, 1, 0.4]}
        length={1.5}
        radiusStart={0.28}
        radiusEnd={0.75}
        color="#cfe8ff"
        intensity={0.07}
      />

      {/* Chair and character placeholder */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#2c2c30" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.85, 0.25]}>
        <boxGeometry args={[0.5, 0.7, 0.08]} />
        <meshStandardMaterial color="#2c2c30" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1, 0.05]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.9} />
      </mesh>

      {/* Shelf with clutter on the back wall */}
      <mesh position={[1.6, 1.6, -2.85]}>
        <boxGeometry args={[1.6, 0.04, 0.3]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.8} />
      </mesh>
      {[1.0, 1.25, 1.5, 1.85, 2.15].map((x, i) => (
        <mesh key={x} position={[x, 1.62 + 0.11 + (i % 2) * 0.04, -2.85]}>
          <boxGeometry args={[0.16, 0.22 + (i % 2) * 0.08, 0.22]} />
          <meshStandardMaterial color={i % 2 ? '#6b5a48' : '#3d4a4f'} roughness={0.85} />
        </mesh>
      ))}

      {/* Desk lamp */}
      <mesh position={[0.55, 1.05, -1.25]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#000000" emissive="#ffb35c" emissiveIntensity={3} />
      </mesh>
      <pointLight position={[0.55, 1.05, -1.25]} color="#ffb35c" intensity={6} distance={6} decay={1} />
    </group>
  );
}
