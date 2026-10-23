import { useFrame } from '@react-three/fiber';
import { type RefObject, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial } from 'three';
import type { Vec3 } from '@/experience/camera/types';
import { useExperience } from '@/store/useExperience';
import { DUST_COUNT, DUST_LIFETIME, dustParticle } from './dust';

export interface DustBurst {
  time: number;
  point: Vec3;
  normal: Vec3;
}

/** Bursts on screen at once; an older one is gone long before a sixth knock lands. */
export const MAX_BURSTS = 6;

const vertexShader = /* glsl */ `
uniform float uViewportHeight;
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uViewportHeight * 0.5 / max(-mv.z, 0.05), 1.0, 64.0);
  vAlpha = aAlpha;
}
`;

function fragmentShader(soft: boolean) {
  return /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = ${soft ? '1.0 - smoothstep(0.0, 0.5, d)' : '1.0 - smoothstep(0.32, 0.5, d)'};
  if (a <= 0.0) discard;
  gl_FragColor = vec4(uColor, a * vAlpha);
}
`;
}

function makeLayer(soft: boolean, color: [number, number, number]) {
  const count = MAX_BURSTS * DUST_COUNT;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSize', new BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('aAlpha', new BufferAttribute(new Float32Array(count), 1));
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader: fragmentShader(soft),
    uniforms: { uColor: { value: color }, uViewportHeight: { value: 720 } },
    transparent: true,
    depthWrite: false,
    blending: soft ? AdditiveBlending : NormalBlending,
  });
  return { geometry, material };
}

/** Plaster dust and paint flakes shaken off the wall by each knock. */
export function KnockDust({ bursts }: { bursts: RefObject<DustBurst[]> }) {
  // Dust catches the lamp light; flakes are old paint, darker than the air around them.
  const dust = useMemo(() => makeLayer(true, [0.55, 0.5, 0.42]), []);
  const flakes = useMemo(() => makeLayer(false, [0.36, 0.33, 0.27]), []);

  useFrame(({ gl, size }) => {
    const { time } = useExperience.getState();
    const live = bursts.current.filter((b) => time - b.time < DUST_LIFETIME).slice(-MAX_BURSTS);
    for (const layer of [dust, flakes]) {
      const flakeLayer = layer === flakes;
      const pos = layer.geometry.getAttribute('position') as BufferAttribute;
      const sizeAttr = layer.geometry.getAttribute('aSize') as BufferAttribute;
      const alpha = layer.geometry.getAttribute('aAlpha') as BufferAttribute;
      let n = 0;
      for (const burst of live) {
        for (let i = 0; i < DUST_COUNT; i++) {
          const p = dustParticle(i, time - burst.time, burst.point, burst.normal);
          if (p.flake !== flakeLayer) continue;
          pos.setXYZ(n, p.position[0], p.position[1], p.position[2]);
          sizeAttr.setX(n, p.size);
          alpha.setX(n, p.alpha * (flakeLayer ? 0.9 : 0.7));
          n++;
        }
      }
      layer.geometry.setDrawRange(0, n);
      pos.needsUpdate = sizeAttr.needsUpdate = alpha.needsUpdate = n > 0;
      layer.material.uniforms.uViewportHeight.value = size.height * gl.getPixelRatio();
    }
  });

  return (
    <>
      <points geometry={dust.geometry} material={dust.material} frustumCulled={false} renderOrder={3} />
      <points geometry={flakes.geometry} material={flakes.material} frustumCulled={false} renderOrder={3} />
    </>
  );
}
