import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, Group, type Mesh, type MeshStandardMaterial, type Object3D, type PointLight, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { content } from '@/content';
import type { Vec3 } from '@/experience/camera/types';
import { smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { problemPose } from '../depths/choreography';
import { DEPTHS_MODEL } from '../depths/Depths';
import { useChapterFrame } from '../useChapterFrame';

/** One problem per tool in the stack: each one becomes that tool's keycap. */
const COUNT = content.stack.length;
/** depths.glb has ten problem models: error windows, warning signs, broken shards. */
const MODELS = 10;
const SIZE = 1.5;
const MESSAGES = ['FATAL ERROR', 'SEGFAULT', '404', 'BUILD FAILED', 'NaN', 'TIMEOUT', 'OUT OF MEMORY', 'ACCESS DENIED', 'undefined', 'NO SIGNAL'];
const RED = new Color('#ff2414');
const WARM = new Color('#ffb35c');

const vertexShader = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// A crashed program's window: its error in red, torn by glitches, until the bulb warms it.
const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uAtlas;
uniform float uRow;
uniform float uTime;
uniform float uSeed;
uniform float uWarmth;
uniform float uLevel;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  float frame = floor(uTime * 12.0);
  // Now and then a band of the picture slips sideways.
  float band = floor(uv.y * 18.0);
  float torn = step(0.86, hash(vec2(band, frame + uSeed * 7.0)));
  uv.x += torn * (hash(vec2(band * 3.1, frame)) - 0.5) * 0.25;
  vec2 cell = vec2(uv.x, (uRow + clamp(uv.y, 0.0, 1.0)) / ${MESSAGES.length}.0);
  float text = texture2D(uAtlas, cell).r;
  float ghost = texture2D(uAtlas, cell + vec2(0.014, 0.0)).r;
  float noise = hash(floor(uv * vec2(120.0, 80.0)) + frame);
  float scan = 0.8 + 0.2 * sin(uv.y * 320.0);
  vec3 red = vec3(1.0, 0.06, 0.035);
  vec3 color = (red * (0.1 + 0.08 * noise) + red * text * 2.2 + vec3(0.35, 0.0, 0.55) * ghost * 0.5) * scan;
  color = mix(color, vec3(1.0, 0.7, 0.4) * (0.2 + text * 1.4), uWarmth);
  gl_FragColor = vec4(color * uLevel, 1.0);
  #include <fog_fragment>
}
`;

function paintMessages(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-vt323').trim() || 'monospace';
  const row = canvas.height / MESSAGES.length;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  MESSAGES.forEach((message, i) => {
    const size = Math.min(row * 0.62, (canvas.width * 0.9) / (0.52 * message.length));
    ctx.font = `${size}px ${family}`;
    ctx.fillText(message, canvas.width / 2, row * (i + 0.52));
    // A line of fake stack trace under it.
    ctx.globalAlpha = 0.55;
    ctx.font = `${row * 0.12}px ${family}`;
    ctx.fillText(`at 0x${(0x7f3a2c + i * 0x1d4f).toString(16).toUpperCase()}  (${i + 1}:${(i * 37) % 91})`, canvas.width / 2, row * (i + 0.86));
    ctx.globalAlpha = 1;
  });
}

/** The ten problems, cloned from depths.glb, with glowing red parts and live error screens. */
class ProblemKit {
  readonly root = new Group();
  private readonly items: Object3D[] = [];
  private readonly glows = new Map<string, MeshStandardMaterial>();
  private readonly screens: ShaderMaterial[] = [];
  private readonly canvas = document.createElement('canvas');
  private readonly atlas: CanvasTexture;

  constructor(scene: Group) {
    this.canvas.width = 512;
    this.canvas.height = 128 * MESSAGES.length;
    this.atlas = new CanvasTexture(this.canvas);
    // glTF UVs start at the top, like the canvas.
    this.atlas.flipY = false;
    for (let i = 0; i < COUNT; i++) {
      const source = scene.getObjectByName(`Problem_${i % MODELS}`);
      if (!source) continue;
      const item = source.clone();
      item.position.set(0, 0, 0);
      item.scale.setScalar(SIZE);
      item.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const material = mesh.material as MeshStandardMaterial;
        if (material.userData.runtime === 'problem-screen') mesh.material = this.screen(i);
        else if (material.userData.runtime === 'problem-glow') mesh.material = this.glow(material);
      });
      this.items.push(item);
      this.root.add(item);
    }
  }

  private glow(source: MeshStandardMaterial): MeshStandardMaterial {
    let material = this.glows.get(source.uuid);
    if (!material) {
      material = source.clone();
      material.emissive.copy(RED);
      this.glows.set(source.uuid, material);
    }
    return material;
  }

  private screen(i: number): ShaderMaterial {
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        { uAtlas: { value: null }, uRow: { value: i % MESSAGES.length }, uTime: { value: 0 }, uSeed: { value: i }, uWarmth: { value: 0 }, uLevel: { value: 1 } },
      ]),
    });
    // merge() clones uniform values; the texture must stay shared.
    material.uniforms.uAtlas.value = this.atlas;
    this.screens.push(material);
    return material;
  }

  paint() {
    paintMessages(this.canvas);
    this.atlas.needsUpdate = true;
  }

  /** Problem-local t: circling closer, freezing, warming, shrinking away into keycaps. */
  update(t: number, time: number, eye: Vec3 | undefined) {
    const appear = smoothstep(0, 0.08, t);
    this.items.forEach((item, i) => {
      const pose = problemPose(i, COUNT, t);
      const [x, y, z] = pose.position;
      item.position.set(x, y, z);
      item.scale.setScalar(SIZE * pose.problemScale * appear);
      item.visible = pose.problemScale * appear > 0.001;
      // Turned to the camera, so their errors read, but never quite still until the bulb lights.
      const restless = 1 - pose.warmth;
      const yaw = eye ? Math.atan2(eye[0] - x, eye[2] - z) : 0;
      item.rotation.set(
        restless * 0.35 * Math.sin(time * 0.9 + i * 1.7),
        yaw + restless * 0.5 * Math.sin(time * 0.6 + i),
        restless * 0.3 * Math.sin(time * 1.3 + i * 2.1),
      );
    });
    const warmth = smoothstep(0.7, 0.8, t);
    // A slow, uneasy pulse in the red; steady once warm.
    const level = (1 - warmth) * (0.75 + 0.25 * Math.sin(time * 2.6)) + warmth * 1.2;
    for (const material of this.glows.values()) {
      material.emissive.copy(RED).lerp(WARM, warmth);
      material.emissiveIntensity = 1.8 * level;
    }
    for (const material of this.screens) {
      material.uniforms.uTime.value = time;
      material.uniforms.uWarmth.value = warmth;
      material.uniforms.uLevel.value = 0.9 + 0.3 * level;
    }
  }

  dispose() {
    this.atlas.dispose();
    for (const material of this.screens) material.dispose();
    for (const material of this.glows.values()) material.dispose();
  }
}

/** The problems (spec §3.7): red, restless, closing in on the character until the bulb lights. */
export function Problem() {
  const ref = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const { scene } = useGLTF(DEPTHS_MODEL);
  const kit = useMemo(() => new ProblemKit(scene), [scene]);

  useEffect(() => {
    kit.paint();
    void document.fonts?.ready.then(() => kit.paint());
    return () => kit.dispose();
  }, [kit]);

  useChapterFrame('problem', ref, (t) => {
    const { time, cameraPose } = useExperience.getState();
    kit.update(t, time, cameraPose?.position);
    if (light.current) {
      const red = smoothstep(0, 0.1, t) * (1 - smoothstep(0.62, 0.78, t));
      light.current.intensity = red * (9 + 3 * Math.sin(time * 2.6));
    }
  });

  return (
    <group ref={ref}>
      {/* The problems' own red glow, filling the dark around the character. */}
      <pointLight ref={light} position={[0, -178.8, 0.4]} color="#ff2a1a" intensity={0} distance={18} decay={2} />
      <primitive object={kit.root} />
    </group>
  );
}
