import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, type Mesh, ShaderMaterial, SRGBColorSpace, type Texture } from 'three';
import flickerSource from '@/experience/flicker.ts?raw';
import { useExperience } from '@/store/useExperience';
import { screenMode, whosThereText } from './screen';
import knockSource from './knock.ts?raw';
import screenSource from './screen.ts?raw';

/** The site's own code, typed out forever: the lamp's flicker, the knock, this screen. */
const CODE = [
  ['src/experience/flicker.ts', flickerSource],
  ['src/experience/chapters/room/knock.ts', knockSource],
  ['src/experience/chapters/room/screen.ts', screenSource],
]
  .map(([path, source]) => `// ${path}\n${source}`)
  .join('\n\n');
const LINES = CODE.split('\n');
/** Character offset where each line begins. */
const LINE_START: number[] = [];
for (let i = 0, at = 0; i < LINES.length; at += LINES[i].length + 1, i++) LINE_START.push(at);
const TYPE_CPS = 26;
/** The visit starts mid-file, so the screen is already full of code. */
const TYPE_FROM = 1900;
const ROWS = 22;
const WIDTH = 1024;
const HEIGHT = 768;

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// A tired colour tube behind dusty, fingerprinted glass that mirrors the room.
const fragmentShader = /* glsl */ `
#include <common>
uniform sampler2D uText;
uniform sampler2D uEnv;
uniform sampler2D uSmudge;
uniform float uEnvScale;
uniform float uTime;
uniform float uGlitch;
uniform float uPower;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 c = vUv - 0.5;
  vec2 uv = 0.5 + c * (1.0 + 0.09 * dot(c, c));
  float row = floor(uv.y * 180.0);
  float frame = floor(uTime * 30.0);
  uv.x += uGlitch * (hash(vec2(row, frame)) - 0.5) * 0.12 * step(0.6, hash(vec2(frame, row * 0.1)));
  uv.y += uGlitch * 0.04 * sin(frame * 1.7);

  vec3 text = texture2D(uText, uv).rgb;
  vec2 px = vec2(1.6 / ${WIDTH}.0, 1.6 / ${HEIGHT}.0);
  vec3 halo = (
    texture2D(uText, uv + vec2(px.x, 0.0)).rgb + texture2D(uText, uv - vec2(px.x, 0.0)).rgb +
    texture2D(uText, uv + vec2(0.0, px.y)).rgb + texture2D(uText, uv - vec2(0.0, px.y)).rgb
  ) * 0.25;
  vec3 color = text * 1.4 + halo * 0.9;
  // Scanlines and the RGB phosphor triads.
  color *= 0.72 + 0.28 * sin(uv.y * ${HEIGHT}.0 * PI);
  float triad = gl_FragCoord.x * 2.0944;
  color *= vec3(1.0) + 0.14 * vec3(sin(triad), sin(triad + 2.0944), sin(triad + 4.1888));
  // Black is never black on a tube; a slow bright band rolls through it.
  color += vec3(0.012, 0.022, 0.026);
  color *= 1.0 + 0.1 * (1.0 - smoothstep(0.0, 0.12, abs(fract(uv.y - uTime * 0.06) - 0.5)));
  color += (hash(uv * 811.0 + frame) - 0.5) * (0.03 + 0.4 * uGlitch);
  float tube = smoothstep(0.52, 0.42, abs(c.x)) * smoothstep(0.52, 0.42, abs(c.y));
  color *= tube * uPower;

  // The glass: reflections of the room, blurred where fingers smeared it, specks of dust.
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec3 r = reflect(-v, n);
  vec2 smudge = texture2D(uSmudge, vUv * vec2(1.3, 1.0) + 0.17).rg;
  vec3 env = textureLod(uEnv, equirectUv(r), mix(1.5, 5.5, smudge.r)).rgb * uEnvScale;
  float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
  color *= 1.0 - 0.35 * smudge.g;
  color += env * (fresnel * 1.4 + 0.05 * smudge.r) + smudge.g * vec3(0.012);
  gl_FragColor = vec4(color, 1.0);
}
`;

function fontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-vt323').trim() || 'monospace';
}

function drawCode(ctx: CanvasRenderingContext2D, chars: number, cursorOn: boolean) {
  const at = chars % CODE.length;
  const line = Math.max(0, LINE_START.findLastIndex((start) => start <= at));
  const column = at - LINE_START[line];
  const lineHeight = HEIGHT / ROWS;
  ctx.fillStyle = '#05090a';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.font = `${Math.round(lineHeight * 0.92)}px ${fontFamily()}`;
  ctx.textBaseline = 'top';
  const first = Math.max(0, line - ROWS + 2);
  for (let i = first; i <= line; i++) {
    const text = i === line ? LINES[i].slice(0, column) : LINES[i];
    const y = (i - first) * lineHeight + 8;
    const comment = text.trimStart().startsWith('//') || text.trimStart().startsWith('*') || text.trimStart().startsWith('/*');
    ctx.fillStyle = comment ? '#5f7f86' : '#cfe8ff';
    ctx.fillText(text, 28, y);
    if (i === line && cursorOn) {
      const w = ctx.measureText(text).width;
      ctx.fillStyle = '#cfe8ff';
      ctx.fillRect(28 + w + 2, y + 2, lineHeight * 0.45, lineHeight * 0.8);
    }
  }
}

function drawQuestion(ctx: CanvasRenderingContext2D, text: string, cursorOn: boolean) {
  ctx.fillStyle = '#020303';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.font = `120px ${fontFamily()}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8f4ff';
  ctx.fillText(text, 90, HEIGHT / 2);
  if (cursorOn) ctx.fillRect(90 + ctx.measureText(text).width + 8, HEIGHT / 2 - 45, 50, 90);
}

/** The CRT's live picture: owns the canvas, its texture and the tube shader. */
class CrtScreen {
  readonly material: ShaderMaterial;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private drawn = '';

  constructor(probe: Texture, probeScale: number, smudge: Texture) {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    // glTF UVs start at the top, like the canvas.
    this.texture.flipY = false;
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uText: { value: this.texture },
        uEnv: { value: probe },
        uSmudge: { value: smudge },
        uEnvScale: { value: probeScale },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uPower: { value: 1 },
      },
    });
  }

  /** Shows the picture on `mesh`; the returned function puts the old material back. */
  attach(mesh: Mesh): () => void {
    const previous = mesh.material;
    mesh.material = this.material;
    return () => {
      mesh.material = previous;
      this.material.dispose();
      this.texture.dispose();
    };
  }

  update(time: number, whosThereAt: number | null, power: number) {
    const mode = screenMode(time, whosThereAt);
    const cursorOn = Math.floor(time * 1.6) % 2 === 0;
    const question = mode === 'whos-there' && whosThereAt !== null ? whosThereText(time, whosThereAt) : null;
    const typedChars = TYPE_FROM + Math.floor(time * TYPE_CPS);
    const key = question === null ? `c${typedChars}${cursorOn}` : `q${question}${cursorOn}`;
    const ctx = key !== this.drawn ? this.canvas.getContext('2d') : null;
    if (ctx) {
      if (question === null) drawCode(ctx, typedChars, cursorOn);
      else drawQuestion(ctx, question, cursorOn);
      this.texture.needsUpdate = true;
      this.drawn = key;
    }
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uGlitch.value = mode === 'glitch' ? 1 : 0;
    this.material.uniforms.uPower.value = power;
  }
}

export interface RoomScreenProps {
  mesh: Mesh;
  probe: Texture;
  probeScale: number;
  smudge: Texture;
  /** Brightness of the tube this frame, shared with the room's screen light. */
  power: () => number;
}

/** Puts the living monitor on the room's CRT glass mesh. */
export function RoomScreen({ mesh, probe, probeScale, smudge, power }: RoomScreenProps) {
  const screen = useMemo(() => new CrtScreen(probe, probeScale, smudge), [probe, probeScale, smudge]);
  useEffect(() => screen.attach(mesh), [screen, mesh]);
  useFrame(() => {
    const { time, knock } = useExperience.getState();
    screen.update(time, knock.whosThereAt, power());
  });
  return null;
}
