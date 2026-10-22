import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, type PointLight, type ShaderMaterial, SRGBColorSpace, Texture } from 'three';
import type { Vec3 } from '@/experience/camera/types';
import { useExperience } from '@/store/useExperience';
import { localProgress } from '@/timeline/resolve';

export const CRT = { casing: [2.1, 1.65, 1.6] as Vec3, screen: [1.75, 1.3] as [number, number] };

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Live TV static on a curved tube: noise, scanlines, a rolling bar and the channel label.
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uFocus;
uniform float uSeed;
uniform sampler2D uLabel;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 c = vUv - 0.5;
  vec2 uv = 0.5 + c * (1.0 + 0.12 * dot(c, c));
  float frame = floor(uTime * 24.0);
  float noise = hash(floor(uv * vec2(260.0, 200.0)) + frame * 1.37 + uSeed * 17.0);
  float scan = 0.8 + 0.2 * sin(uv.y * 200.0 * 3.14159);
  float bar = 1.0 - smoothstep(0.0, 0.08, abs(fract(uv.y + uTime * 0.11 + uSeed) - 0.5));
  vec3 color = vec3(0.12 + 0.55 * noise) * scan + 0.18 * bar;
  vec4 label = texture2D(uLabel, uv);
  color = mix(color, label.rgb * (0.85 + 0.15 * hash(vec2(frame, uSeed))), label.a);
  float tube = 1.0 - smoothstep(0.32, 0.72, length(c * vec2(1.0, 1.25)));
  color *= tube * mix(0.3, 2.2, uFocus) * vec3(0.82, 0.95, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

function paintLabel(canvas: HTMLCanvasElement, title: string, channel: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-vt323').trim() || 'monospace';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `92px ${family}`;
  // Dark caption box behind the text, like a TV's own on-screen display.
  const boxWidth = Math.min(canvas.width * 0.9, ctx.measureText(title).width + 60);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect((canvas.width - boxWidth) / 2, canvas.height * 0.3, boxWidth, canvas.height * 0.46);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, canvas.width / 2, canvas.height * 0.44);
  ctx.font = `54px ${family}`;
  ctx.fillText(channel, canvas.width / 2, canvas.height * 0.66);
}

export interface CrtMonitorProps {
  position: Vec3;
  /** Rotation around Y; the screen faces local +Z. */
  angle: number;
  seed: number;
  title: string;
  channel: string;
  /** Screen brightness from the spiral chapter's local t: 0 dim, 1 focused. */
  focusAt: (t: number) => number;
  /** Main monitors throw their glow onto the cables around them. */
  castLight?: boolean;
}

/** An old CRT hanging from its cable, showing NO SIGNAL static until a project tunes in. */
export function CrtMonitor({ position, angle, seed, title, channel, focusAt, castLight = false }: CrtMonitorProps) {
  const material = useRef<ShaderMaterial>(null);
  const light = useRef<PointLight>(null);
  const params = useMemo(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: 0 },
        uSeed: { value: seed },
        uLabel: { value: new Texture() },
      },
    }),
    [seed],
  );

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    let alive = true;
    const draw = () => {
      if (!alive) return;
      paintLabel(canvas, title, channel);
      texture.needsUpdate = true;
      if (material.current) material.current.uniforms.uLabel.value = texture;
    };
    draw();
    void document.fonts?.ready.then(draw);
    return () => {
      alive = false;
      texture.dispose();
    };
  }, [title, channel]);

  useFrame(() => {
    const { p, time } = useExperience.getState();
    const focus = focusAt(localProgress(p, 'spiral'));
    if (material.current) {
      material.current.uniforms.uTime.value = time;
      material.current.uniforms.uFocus.value = focus;
    }
    if (light.current) light.current.intensity = 5 * focus;
  });

  const [w, h, d] = CRT.casing;
  const [sw, sh] = CRT.screen;
  return (
    <group position={position} rotation={[0, angle, 0]}>
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#b8ad93" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.004]}>
        <planeGeometry args={[sw + 0.16, sh + 0.16]} />
        <meshStandardMaterial color="#151515" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.012]}>
        <planeGeometry args={[sw, sh]} />
        <shaderMaterial ref={material} args={[params]} />
      </mesh>
      {/* The cable it hangs from disappears up into the fog. */}
      <mesh position={[0, h / 2 + 20, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 40, 6]} />
        <meshStandardMaterial color="#0d1010" roughness={0.6} />
      </mesh>
      {castLight && <pointLight ref={light} position={[0, 0, d / 2 + 1]} color="#bfe6ff" intensity={0} distance={8} decay={1} />}
    </group>
  );
}
