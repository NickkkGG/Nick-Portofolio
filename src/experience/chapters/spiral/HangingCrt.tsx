import { useFrame } from '@react-three/fiber';
import { type Ref, useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, type Group, type Mesh, type Object3D, ShaderMaterial, SRGBColorSpace, type Texture, UniformsLib, UniformsUtils } from 'three';
import type { Vec3 } from '@/experience/camera/types';
import { useExperience } from '@/store/useExperience';
import { localProgress } from '@/timeline/resolve';
import { isVisible } from '@/timeline/visibility';
import { hangingSway, surgeLevel } from './motion';
import { ScreenVideo } from './ScreenVideo';
import { NO_SIGNAL, receptionLook, tune, videoRuns, wantsPicture } from './signal';

/** The model is a true-size 19" CRT; the project world's monitors are giants. */
export const CRT_SCALE = 4.5;
/** Its cable rises 10 m in the model, so the hang point sits this far above the screen. */
const CABLE = 10 * CRT_SCALE;

const vertexShader = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// Live TV static on a curved tube behind smudged glass: noise, scanlines, a rolling bar,
// the channel label, and the dark world mirrored in the glass. A project's preview video
// comes through the static as the set tunes in (signal.ts).
const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uFocus;
uniform float uSeed;
uniform float uSurge;
uniform float uPower;
uniform float uEnvScale;
uniform float uPicture;
uniform float uRoll;
uniform float uTear;
uniform sampler2D uLabel;
uniform sampler2D uEnv;
uniform sampler2D uSmudge;
uniform sampler2D uVideo;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// The white of the game's sky stays a bright screen, not a lamp.
const float PICTURE_GAIN = 0.6;
// The picture's share of the tube face: all of the frame shows, in a thin dark border.
const float PICTURE_SIZE = 0.9;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The preview as the tube draws it: rolling and torn sideways while the set tunes in, with
// the blanking bar between two frames rolling through, and a little snow left once it locks.
vec3 picture(vec2 uv, float frame, float noise) {
  vec2 f = 0.5 + (uv - 0.5) / PICTURE_SIZE;
  float row = floor(f.y * 240.0);
  float tear = uTear * ((hash(vec2(row, frame)) - 0.5) * 0.7 + 0.5 * sin(f.y * 23.0 + uTime * 37.0));
  float y = fract(f.y + uRoll);
  vec3 color = texture2D(uVideo, vec2(f.x + tear, y)).rgb;
  color *= mix(1.0, smoothstep(0.0, 0.03, y) * smoothstep(1.0, 0.97, y), min(1.0, uRoll * 4.0));
  // Scanlines on the video's own rows, so its pixel art never beats against them: one per two
  // rows where the screen is big enough to draw that, one per four where not, none when tiny.
  float rate = fwidth(f.y) * 240.0;
  float fine = 0.5 + 0.5 * cos(f.y * 240.0 * 2.0 * PI);
  float coarse = 0.5 + 0.5 * cos(f.y * 120.0 * 2.0 * PI);
  float lines = mix(fine, coarse, smoothstep(0.35, 0.6, rate)) * (1.0 - smoothstep(0.8, 1.3, rate));
  // The snow never takes a dark pixel below black.
  return max(color * (1.0 - 0.25 * lines) + 0.05 * (noise - 0.5), 0.0);
}

// Where the tube face lights up: the whole 4:3 frame with rounded corners, darker towards its edges.
float face(vec2 uv) {
  vec2 d = abs(uv - 0.5) / PICTURE_SIZE;
  float edge = length(max(d - 0.44, 0.0)) - 0.06;
  return (1.0 - smoothstep(-0.012, 0.0, edge)) * (1.0 - 0.6 * dot(d, d));
}

void main() {
  vec2 c = vUv - 0.5;
  vec2 uv = 0.5 + c * (1.0 + 0.12 * dot(c, c));
  float frame = floor(uTime * 24.0);
  float noise = hash(floor(uv * vec2(260.0, 200.0)) + frame * 1.37 + uSeed * 17.0);
  float scan = 0.8 + 0.2 * sin(uv.y * 200.0 * PI);
  float bar = 1.0 - smoothstep(0.0, 0.08, abs(fract(uv.y + uTime * 0.11 + uSeed) - 0.5));
  vec3 color = vec3(0.12 + 0.55 * noise) * scan + 0.18 * bar;
  vec4 label = texture2D(uLabel, uv);
  color = mix(color, label.rgb * (0.85 + 0.15 * hash(vec2(frame, uSeed))), label.a * (1.0 - uSurge));
  // A surge: every screen tears into bright static at once.
  color = mix(color, vec3(0.25 + 0.9 * noise), uSurge);
  float tube = 1.0 - smoothstep(0.32, 0.72, length(c * vec2(1.0, 1.25)));
  float glow = max(uFocus, uSurge * 0.8);
  color *= tube * mix(0.3, 2.0, glow);
  if (uPicture > 0.0) {
    vec3 shown = mix(picture(uv, frame, noise), vec3(0.25 + 0.9 * noise), uSurge);
    // The tube's own flicker and the rolling bar of the static stay on the picture.
    shown *= (0.96 + 0.04 * hash(vec2(frame, uSeed + 3.0))) * (1.0 + 0.08 * bar);
    color = mix(color, shown * face(uv) * mix(0.3, PICTURE_GAIN, glow), uPicture);
  }
  color *= vec3(0.82, 0.95, 1.0);
  // Switched off, the tube is dark glass: only the world mirrored in it.
  color *= uPower;

  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec2 smudge = texture2D(uSmudge, vUv * vec2(1.3, 1.0) + uSeed * 0.37).rg;
  vec3 env = textureLod(uEnv, equirectUv(reflect(-v, n)), mix(1.5, 5.5, smudge.r)).rgb * uEnvScale;
  float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  color = color * (1.0 - 0.3 * smudge.g) + env * (fresnel * 1.4 + 0.05 * smudge.r);
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
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
  // A long title shrinks to fit across the screen.
  ctx.font = `${Math.min(92, (92 * canvas.width * 0.84) / ctx.measureText(title).width)}px ${family}`;
  // Dark caption box behind the text, like a TV's own on-screen display.
  const boxWidth = Math.min(canvas.width * 0.9, ctx.measureText(title).width + 60);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect((canvas.width - boxWidth) / 2, canvas.height * 0.3, boxWidth, canvas.height * 0.46);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, canvas.width / 2, canvas.height * 0.44);
  ctx.font = `54px ${family}`;
  ctx.fillText(channel, canvas.width / 2, canvas.height * 0.66);
}

/** One hanging monitor: its own copy of the model, its own picture, its own swing. */
class CrtRig {
  readonly root: Group;
  private readonly screen: ShaderMaterial;
  private readonly canvas = document.createElement('canvas');
  private readonly label: CanvasTexture;
  private video: ScreenVideo | null = null;
  private reception = NO_SIGNAL;
  private lastTime: number | null = null;

  constructor(template: Group, seed: number, env: Texture, envScale: number, smudge: Texture) {
    this.root = template.clone(true);
    this.root.scale.setScalar(CRT_SCALE);
    this.root.position.set(0, -CABLE, 0);
    this.canvas.width = 512;
    this.canvas.height = 384;
    this.label = new CanvasTexture(this.canvas);
    this.label.colorSpace = SRGBColorSpace;
    // glTF UVs start at the top, like the canvas.
    this.label.flipY = false;
    this.screen = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uFocus: { value: 0 },
          uSeed: { value: seed },
          uSurge: { value: 0 },
          uPower: { value: 1 },
          uEnvScale: { value: envScale },
          uPicture: { value: 0 },
          uRoll: { value: 0 },
          uTear: { value: 0 },
          uLabel: { value: null },
          uEnv: { value: null },
          uSmudge: { value: null },
          uVideo: { value: null },
        },
      ]),
    });
    // merge() clones uniform values; textures must stay shared, so set them afterwards.
    this.screen.uniforms.uLabel.value = this.label;
    this.screen.uniforms.uEnv.value = env;
    this.screen.uniforms.uSmudge.value = smudge;
    this.root.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.isMesh && mesh.userData.runtime === 'screen') mesh.material = this.screen;
    });
  }

  paint(title: string, channel: string) {
    paintLabel(this.canvas, title, channel);
    this.label.needsUpdate = true;
  }

  update(time: number, focus: number, surge: number, power: number) {
    this.screen.uniforms.uTime.value = time;
    this.screen.uniforms.uFocus.value = focus;
    this.screen.uniforms.uSurge.value = surge * power;
    this.screen.uniforms.uPower.value = power;
  }

  /** Gives the screen a preview to tune in to, or takes it away. */
  tuneTo(video: ScreenVideo | null) {
    this.video = video;
    this.reception = NO_SIGNAL;
    this.lastTime = null;
    this.screen.uniforms.uVideo.value = video?.texture ?? null;
    this.screen.uniforms.uPicture.value = 0;
  }

  /** Moves the reception on: towards the preview while it is wanted, back to static when not. */
  receive(time: number, frozen: boolean, wanted: boolean, onScreen: boolean) {
    const video = this.video;
    if (!video) return;
    if (onScreen) video.load();
    const dt = frozen ? Infinity : this.lastTime === null ? 0 : time - this.lastTime;
    this.lastTime = time;
    this.reception = tune(this.reception, dt, wanted, video.ready);
    video.update(videoRuns(this.reception, wanted), frozen ? time : null);
    const { picture, roll, tear } = receptionLook(this.reception);
    this.screen.uniforms.uPicture.value = picture;
    this.screen.uniforms.uRoll.value = roll;
    this.screen.uniforms.uTear.value = tear;
  }

  dispose() {
    this.screen.dispose();
    this.label.dispose();
  }
}

export interface HangingCrtProps {
  template: Group;
  env: Texture;
  envScale: number;
  smudge: Texture;
  /** Where the screen's centre hangs. */
  position: Vec3;
  /** Rotation around Y; the screen faces local +Z. */
  angle: number;
  seed: number;
  title: string;
  channel: string;
  /** Screen brightness from the spiral chapter's local t: 0 dim, 1 focused. */
  focusAt: (t: number) => number;
  /** Whether the set is on at global p, 0..1: the first one waits for the booth's beam. */
  powerAt?: (p: number) => number;
  /** Main monitors mark the spot in front of the screen where their glow on the cables comes from. */
  glowRef?: Ref<Object3D>;
  /** A live project's video, which the screen tunes in to while the camera is at it (signal.ts). */
  preview?: string;
}

/** An old CRT hanging from its cable, showing NO SIGNAL static until a project's preview tunes in. */
export function HangingCrt({ template, env, envScale, smudge, position, angle, seed, title, channel, focusAt, powerAt, glowRef, preview }: HangingCrtProps) {
  const pivot = useRef<Group>(null);
  const rig = useMemo(() => new CrtRig(template, seed, env, envScale, smudge), [template, seed, env, envScale, smudge]);

  useEffect(() => {
    rig.paint(title, channel);
    void document.fonts?.ready.then(() => rig.paint(title, channel));
    return () => rig.dispose();
  }, [rig, title, channel]);

  // Made here rather than with the rig: Strict Mode runs effects twice, and each run gets its own.
  useEffect(() => {
    if (!preview) return;
    const video = new ScreenVideo(preview);
    rig.tuneTo(video);
    return () => {
      rig.tuneTo(null);
      video.dispose();
    };
  }, [rig, preview]);

  useFrame(() => {
    const { p, time, frozen } = useExperience.getState();
    const focus = focusAt(localProgress(p, 'spiral'));
    const power = powerAt ? powerAt(p) : 1;
    rig.update(time, focus, surgeLevel(time), power);
    if (preview) {
      const onScreen = isVisible('spiral', p);
      rig.receive(time, frozen, wantsPicture(focus, power, onScreen), onScreen);
    }
    const [x, z] = hangingSway(time, seed, CABLE);
    pivot.current?.rotation.set(x, angle, z);
  });

  // The pivot is the top of the cable, so the whole monitor swings from there.
  return (
    <group ref={pivot} position={[position[0], position[1] + CABLE, position[2]]} rotation={[0, angle, 0]}>
      <primitive object={rig.root} />
      {glowRef && <object3D ref={glowRef} position={[0, -CABLE, 1.9]} />}
    </group>
  );
}
