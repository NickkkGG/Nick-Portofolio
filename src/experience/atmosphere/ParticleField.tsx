import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Points, type ShaderMaterial, Vector3 } from 'three';
import { useChapterFrame } from '@/experience/chapters/useChapterFrame';
import { focusDistance } from '@/experience/camera/paths';
import type { Vec3 } from '@/experience/camera/types';
import { LENS } from '@/experience/effects/lens';
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
  /** Optional share of `opacity` at global p, for motes only seen while a light is on them. */
  opacityAt?: (p: number) => number;
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
uniform float uFocus;
uniform float uAperture;
attribute float aSeed;
varying float vAlpha;
varying float vDisc;

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
  float sharp = uPointSize * (0.5 + aSeed) * projectionMatrix[1][1] * uViewportHeight * 0.5 / dist;
  // Thin-lens circle of confusion: out of the focus plane a mote opens into a soft disc,
  // biggest right in front of the lens.
  float coc = uAperture * uViewportHeight * abs(1.0 / dist - 1.0 / uFocus);
  float size = max(sharp + coc, 1e-3);
  gl_PointSize = min(64.0, size);
  vDisc = clamp(coc / size, 0.0, 1.0);
  float blink = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed * 2.5) + aSeed * 40.0));
  // Fade out far away (fog) and right in front of the lens; a wide disc spreads its light thinner.
  vAlpha = uOpacity * blink * (1.0 - smoothstep(25.0, 80.0, dist)) * smoothstep(0.05, 0.5, dist) * pow(clamp(sharp / size, 1e-4, 1.0), 1.5);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uBrightness;
varying float vAlpha;
varying float vDisc;

void main() {
  float d = length(gl_PointCoord - 0.5);
  // In focus: a soft glowing speck. Out of focus: a flat bokeh disc with a faint rim.
  float speck = 1.0 - smoothstep(0.0, 0.5, d);
  float disc = (1.0 - smoothstep(0.4, 0.5, d)) * (0.7 + 0.3 * smoothstep(0.25, 0.45, d));
  float a = mix(speck * speck, disc, vDisc);
  gl_FragColor = vec4(uColor * uBrightness, a * vAlpha);
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
  opacityAt,
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
        uFocus: { value: 4 },
        uAperture: { value: LENS.aperture },
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
    const { p, time, cameraPose } = useExperience.getState();
    shader.uniforms.uTime.value = time;
    shader.uniforms.uOpacity.value = opacityAt ? opacity * opacityAt(p) : opacity;
    shader.uniforms.uViewportHeight.value = viewport.height * gl.getPixelRatio();
    if (cameraPose) shader.uniforms.uFocus.value = focusDistance(cameraPose);
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={material} args={[params]} />
    </points>
  );
}
