import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Points, type ShaderMaterial, Vector3 } from 'three';
import { useChapterFrame } from '@/experience/chapters/useChapterFrame';
import type { Vec3 } from '@/experience/camera/types';
import { mulberry32 } from '@/lib/random';
import { useExperience } from '@/store/useExperience';
import type { VisibilityGroup } from '@/timeline/visibility';

export interface ParticleFieldProps {
  group: VisibilityGroup;
  count: number;
  seed: number;
  min: Vec3;
  max: Vec3;
  color: string;
  /** Particle diameter in metres. */
  size: number;
  /** Metres per second; particles wrap around inside the box. */
  drift?: Vec3;
  /** Metres of slow wobble around the drift path. */
  sway?: number;
  opacity?: number;
  /** 0 = steady, 1 = fully blinking. */
  twinkle?: number;
  /** Above 1 pushes particles into bloom. */
  brightness?: number;
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec3 uMin;
uniform vec3 uSize;
uniform vec3 uDrift;
uniform float uSway;
uniform float uPointSize;
uniform float uViewportHeight;
uniform float uOpacity;
uniform float uTwinkle;
attribute float aSeed;
varying float vAlpha;

void main() {
  vec3 local = fract(position + uDrift * uTime / uSize);
  vec3 world = uMin + local * uSize;
  world += uSway * vec3(
    sin(uTime * 0.5 + aSeed * 6.283),
    sin(uTime * 0.37 + aSeed * 12.1),
    cos(uTime * 0.43 + aSeed * 3.7)
  );
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 0.05);
  gl_PointSize = min(256.0, uPointSize * (0.5 + aSeed) * projectionMatrix[1][1] * uViewportHeight * 0.5 / dist);
  float blink = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.5) + aSeed * 40.0));
  // Fade out far away (fog) and right in front of the lens.
  vAlpha = uOpacity * blink * (1.0 - smoothstep(25.0, 80.0, dist)) * smoothstep(0.05, 0.5, dist);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uBrightness;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(uColor * uBrightness, a * a * vAlpha);
}
`;

/** Soft additive particles drifting through a box of the world, shown with their chapter. */
export function ParticleField({
  group,
  count,
  seed,
  min,
  max,
  color,
  size,
  drift = [0, 0, 0],
  sway = 0,
  opacity = 1,
  twinkle = 0,
  brightness = 1,
}: ParticleFieldProps) {
  const ref = useRef<Points>(null);
  useChapterFrame(group, ref);

  const geometry = useMemo(() => {
    const rand = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand();
      positions[i * 3 + 1] = rand();
      positions[i * 3 + 2] = rand();
      seeds[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    return g;
  }, [count, seed]);

  const material = useRef<ShaderMaterial>(null);
  const params = useMemo(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uMin: { value: new Vector3(...min) },
        uSize: { value: new Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]) },
        uDrift: { value: new Vector3(...drift) },
        uSway: { value: sway },
        uPointSize: { value: size },
        uViewportHeight: { value: 720 },
        uOpacity: { value: opacity },
        uTwinkle: { value: twinkle },
        uColor: { value: new Color(color) },
        uBrightness: { value: brightness },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    // The field is configured once; a new config means a new field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ gl, size: viewport }) => {
    const shader = material.current;
    if (!shader) return;
    shader.uniforms.uTime.value = useExperience.getState().time;
    shader.uniforms.uViewportHeight.value = viewport.height * gl.getPixelRatio();
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} args={[params]} />
    </points>
  );
}
