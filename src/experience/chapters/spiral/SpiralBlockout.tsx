// TEMPORARY blockout — replaced in milestone 5 (spec §7)
import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, type Group, type Mesh, TubeGeometry, Vector3 } from 'three';
import { content } from '@/content';
import { channelLabel } from '@/content/schema';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { useChapterFrame } from '../useChapterFrame';
import { CrtMonitor } from './CrtMonitor';
import { helixSlots, monitorFocus, SPIRAL } from './helix';

const PROJECTS = content.projects;
const SLOTS = helixSlots(PROJECTS.length);
const STANDING_Y = SPIRAL.platformY + 0.475;

/** Dim monitors scattered beyond the pillar, facing inward, so the far side has depth. */
const BACKGROUND = (() => {
  const rand = mulberry32(21);
  return Array.from({ length: 26 }, (_, i) => {
    const angle = rand() * Math.PI * 2;
    const radius = 11 + rand() * 5;
    return {
      position: [radius * Math.sin(angle), -168 + rand() * 98, radius * Math.cos(angle)] as [number, number, number],
      angle: angle + Math.PI,
      seed: 100 + i,
      channel: `CH-${String(7 + Math.floor(rand() * 92)).padStart(2, '0')}`,
      glow: 0.08 + rand() * 0.2,
    };
  });
})();

/** Cables winding down the pillar: the room's cables, grown huge. */
function useCableGeometries() {
  return useMemo(() => {
    const rand = mulberry32(31);
    return Array.from({ length: 18 }, () => {
      const phase = rand() * Math.PI * 2;
      const wobble = rand() * Math.PI * 2;
      const twist = 0.25 + rand() * 0.2;
      const points = Array.from({ length: 48 }, (_, k) => {
        const y = -58 - k * 2.45;
        const a = phase + k * twist;
        const r = 2.15 + 0.35 * Math.sin(k * 0.7 + wobble);
        return new Vector3(r * Math.cos(a), y, r * Math.sin(a));
      });
      return new TubeGeometry(new CatmullRomCurve3(points), 240, 0.07 + rand() * 0.06, 6, false);
    });
  }, []);
}

export function SpiralBlockout() {
  const ref = useRef<Group>(null);
  const character = useRef<Mesh>(null);
  const cables = useCableGeometries();

  useChapterFrame('spiral', ref, (t) => {
    if (character.current) {
      character.current.position.y = STANDING_Y + 9.5 * (1 - smoothstep(0, 0.1, t));
    }
  });

  return (
    <group ref={ref}>
      <hemisphereLight args={['#2b6a64', '#030707', 0.7]} />
      <LightShaft
        group="spiral"
        from={[0, -62, 0]}
        toward={[0, -170, 0]}
        length={108}
        radiusStart={3}
        radiusEnd={14}
        color="#7fe0d0"
        intensity={0.06}
      />

      <mesh position={[0, (SPIRAL.platformY - 160) / 2, 0]}>
        <cylinderGeometry args={[2, 2, 160 + SPIRAL.platformY, 24]} />
        <meshStandardMaterial color="#102624" roughness={0.6} />
      </mesh>
      {cables.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color="#141a1a" roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, SPIRAL.platformY - 0.15, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.3, 32]} />
        <meshStandardMaterial color="#16302e" roughness={0.3} />
      </mesh>
      <mesh ref={character} position={[0.6, STANDING_Y, 0.6]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.9} />
      </mesh>

      {SLOTS.map((slot, i) => (
        <CrtMonitor
          key={`slot-${i}`}
          position={slot.position}
          angle={slot.angle}
          seed={i + 1}
          title={PROJECTS[i].status === 'live' ? PROJECTS[i].title : 'NO SIGNAL'}
          channel={channelLabel(i)}
          focusAt={(t) => Math.max(0.15, monitorFocus(t, i, SLOTS.length))}
          castLight
        />
      ))}
      {BACKGROUND.map((monitor) => (
        <CrtMonitor
          key={monitor.seed}
          position={monitor.position}
          angle={monitor.angle}
          seed={monitor.seed}
          title="NO SIGNAL"
          channel={monitor.channel}
          focusAt={() => monitor.glow}
        />
      ))}
    </group>
  );
}
