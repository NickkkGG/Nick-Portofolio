import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, type Mesh, type ShaderMaterial, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '@/experience/camera/types';
import { useChapterFrame } from '@/experience/chapters/useChapterFrame';
import { useExperience } from '@/store/useExperience';
import type { VisibilityGroup } from '@/timeline/visibility';

export interface LightShaftProps {
  group: VisibilityGroup;
  /** Where the beam starts (the window, the hole, the bulb). */
  from: Vec3;
  /** A point the beam travels toward; the beam ends after `length` metres. */
  toward: Vec3;
  length: number;
  radiusStart: number;
  radiusEnd: number;
  color: string;
  intensity: number;
  /** Optional per-frame intensity, e.g. to follow a flickering bulb. */
  intensityAt?: (p: number) => number;
}

const vertexShader = /* glsl */ `
uniform float uLength;
varying float vAlong;
varying float vAngle;
varying float vFacing;

void main() {
  vAlong = -position.y / uLength;
  vAngle = atan(position.z, position.x);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;

// Brightest at the source, fading along the beam and toward its silhouette edges,
// with faint drifting streaks so the light feels like it moves through dust.
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
varying float vAlong;
varying float vAngle;
varying float vFacing;

void main() {
  // pow() of a non-positive base is undefined; interpolation can dip just below zero,
  // and on Metal that NaN then spreads through bloom and blacks out the whole frame.
  float along = pow(clamp(1.0 - vAlong, 1e-4, 1.0), 1.3);
  float edges = pow(clamp(vFacing, 1e-4, 1.0), 1.6);
  float streaks = 0.75 + 0.25 * sin(vAngle * 11.0 + uTime * 0.35) * sin(vAngle * 5.0 - uTime * 0.2 + vAlong * 3.0);
  gl_FragColor = vec4(uColor, uIntensity * along * edges * streaks);
}
`;

/** A fake volumetric beam: an open cone with additive, soft-edged light. */
export function LightShaft({ group, from, toward, length, radiusStart, radiusEnd, color, intensity, intensityAt }: LightShaftProps) {
  const ref = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  useChapterFrame(group, ref);

  const geometry = useMemo(() => {
    const g = new CylinderGeometry(radiusStart, radiusEnd, length, 48, 1, true);
    g.translate(0, -length / 2, 0); // source at the origin, beam along −Y
    return g;
  }, [radiusStart, radiusEnd, length]);

  const orientation = useMemo(() => {
    const direction = new Vector3(...toward).sub(new Vector3(...from)).normalize();
    return new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), direction);
  }, [from, toward]);

  const params = useMemo(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
        uLength: { value: length },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    }),
    // A shaft is configured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(() => {
    const shader = material.current;
    if (!shader) return;
    const { p, time } = useExperience.getState();
    shader.uniforms.uTime.value = time;
    if (intensityAt) shader.uniforms.uIntensity.value = intensityAt(p);
  });

  return (
    <mesh ref={ref} geometry={geometry} position={from} quaternion={orientation} frustumCulled={false} renderOrder={2}>
      <shaderMaterial ref={material} args={[params]} />
    </mesh>
  );
}
