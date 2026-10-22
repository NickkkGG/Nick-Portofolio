// TEMPORARY blockout — replaced in milestone 6 (spec §7)
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { DoubleSide, type Group, type MeshStandardMaterial, type PointLight } from 'three';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { useChapterFrame } from '../useChapterFrame';

const BULB: [number, number, number] = [0, -177.5, 0];
const WIRE = 6;
/** The lamp swings from the top of its wire, like a pendulum of that length (~4.9 s). */
const SWING_HZ = 1 / (2 * Math.PI * Math.sqrt(WIRE / 9.8));

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

/** An old filament never burns quite steady. */
function flicker(time: number): number {
  return 0.93 + 0.05 * Math.sin(time * 23) * Math.sin(time * 7.3) + 0.02 * Math.sin(time * 61);
}

/** Floor and the hanging lamp shared by the problem, stack and contact chapters. */
export function DepthsBlockout() {
  const ref = useRef<Group>(null);
  const lamp = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const glass = useRef<MeshStandardMaterial>(null);
  useChapterFrame('depths', ref);

  useFrame(() => {
    const { p, time } = useExperience.getState();
    const intensity = bulbIntensity(p) * flicker(time);
    if (light.current) light.current.intensity = intensity;
    if (glass.current) glass.current.emissiveIntensity = intensity;
    if (lamp.current) {
      const phase = time * SWING_HZ * 2 * Math.PI;
      lamp.current.rotation.set(0.018 * Math.sin(phase + 1.2), 0, 0.035 * Math.sin(phase));
    }
  });

  return (
    <group ref={ref}>
      <mesh position={[0, -180, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0f2a2a" roughness={0.35} />
      </mesh>
      {/* Everything below hangs from the top of the wire, so it swings as one. */}
      <group ref={lamp} position={[0, BULB[1] + WIRE, 0]}>
        <group position={[0, -WIRE, 0]}>
          <mesh>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial ref={glass} color="#000000" emissive="#ffb35c" emissiveIntensity={0} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.05, 0.3, 0.28, 32, 1, true]} />
            <meshStandardMaterial color="#1c1a17" metalness={0.6} roughness={0.45} side={DoubleSide} />
          </mesh>
          <mesh position={[0, WIRE / 2, 0]}>
            <cylinderGeometry args={[0.01, 0.01, WIRE, 6]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          <pointLight ref={light} color="#ffb35c" intensity={0} distance={30} decay={0} />
          <LightShaft
            group="depths"
            from={[0, -0.04, 0]}
            toward={[0, -3, 0]}
            length={2.46}
            radiusStart={0.3}
            radiusEnd={2.3}
            color="#ffb35c"
            intensity={0}
            intensityAt={(p) => 0.05 * bulbIntensity(p)}
          />
        </group>
      </group>
    </group>
  );
}
