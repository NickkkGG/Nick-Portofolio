import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, type Mesh, type ShaderMaterial, SRGBColorSpace } from 'three';
import { useExperience } from '@/store/useExperience';
import { atmosphereAt, type Rgb } from './atmosphere';

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Vertical sky gradient with slowly drifting fog clouds, so no frame is an empty black void.
const fragmentShader = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform float uTime;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float y = dir.y;
  vec3 color = y > 0.0
    ? mix(uHorizon, uTop, smoothstep(0.0, 0.75, y))
    : mix(uHorizon, uBottom, smoothstep(0.0, 0.6, -y));
  float clouds = fbm(dir * 3.0 + vec3(uTime * 0.015, uTime * 0.02, 0.0));
  color *= 0.75 + 0.5 * clouds;
  gl_FragColor = vec4(color, 1.0);
}
`;

const setColor = (target: Color, rgb: Rgb) => target.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

/** Sky dome that always surrounds the camera; colours follow the chapter atmosphere. */
export function Backdrop() {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const params = useMemo(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uBottom: { value: new Color() },
        uTime: { value: 0 },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
    [],
  );

  useFrame(({ camera }) => {
    const shader = material.current;
    if (!shader) return;
    const { p, time } = useExperience.getState();
    const air = atmosphereAt(p);
    setColor(shader.uniforms.uTop.value, air.top);
    setColor(shader.uniforms.uHorizon.value, air.horizon);
    setColor(shader.uniforms.uBottom.value, air.bottom);
    shader.uniforms.uTime.value = time;
    mesh.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[350, 48, 24]} />
      <shaderMaterial ref={material} args={[params]} />
    </mesh>
  );
}
