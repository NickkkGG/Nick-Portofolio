// TEMPORARY blockout — replaced in milestone 4 (spec §7)
import { useRef } from 'react';
import { AdditiveBlending, type Group, type Mesh } from 'three';
import { content } from '@/content';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { cameraPoseAt } from '@/experience/camera/paths';
import { smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { useChapterFrame } from '../useChapterFrame';

const DEBRIS = (() => {
  const rand = mulberry32(7);
  return Array.from({ length: 40 }, () => ({
    x: rand() * 4 - 2,
    z: rand() * 4 - 2,
    y0: -rand(),
    size: 0.2 + rand() * 0.4,
    spin: 0.5 + rand() * 2,
  }));
})();

// Additive and round, so the hole reads as light spilling through rather than a white square.
const HOLE_GLOW = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float glow = 1.0 - smoothstep(0.0, 1.0, r);
      vec3 lamp = vec3(1.0, 0.82, 0.6) * 2.2 * glow * glow * glow;
      vec3 moon = vec3(0.35, 0.5, 0.75) * 0.5 * glow;
      gl_FragColor = vec4(lamp + moon, 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
};

export function FallBlockout() {
  const ref = useRef<Group>(null);
  const debris = useRef<(Mesh | null)[]>([]);
  const character = useRef<Mesh>(null);

  useChapterFrame('fall', ref, (t, p) => {
    // Debris falls slower than the camera, so it rains down toward the lens.
    const drop = 40 * smoothstep(0.1, 1, t);
    DEBRIS.forEach((d, i) => {
      const mesh = debris.current[i];
      if (!mesh) return;
      mesh.position.set(d.x, d.y0 - drop, d.z);
      mesh.rotation.set(t * d.spin * Math.PI * 2, t * d.spin * Math.PI, 0);
    });
    if (character.current) {
      character.current.visible = t >= 0.15;
      character.current.position.set(...cameraPoseAt(p, content.projects.length).target);
    }
  });

  return (
    <group ref={ref}>
      {/* The broken floor seen from below: the room's lamp glowing through the hole. */}
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <shaderMaterial args={[HOLE_GLOW]} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#cfe8ff" intensity={3} distance={80} decay={0} />
      <LightShaft
        group="fall"
        from={[0, -0.05, 0]}
        toward={[0, -60, 0]}
        length={45}
        radiusStart={2.8}
        radiusEnd={5.5}
        color="#cfe8ff"
        intensity={0.1}
        nearFade={[2, 12]}
      />
      {DEBRIS.map((d, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            debris.current[i] = mesh;
          }}
        >
          <boxGeometry args={[d.size, d.size * 0.5, d.size]} />
          <meshStandardMaterial color="#5a5852" roughness={0.9} />
        </mesh>
      ))}
      <mesh ref={character} rotation={[-Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>
    </group>
  );
}
