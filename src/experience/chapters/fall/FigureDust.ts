import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  Points,
  ShaderMaterial,
  type SkinnedMesh,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { mulberry32 } from '@/lib/random';
import { DUST, DUST_THRESHOLD_GLSL, dustFront, dustThreshold, type Flake, flakeAt } from './dust';

/** Flakes the figure breaks into, shared out over its surface by area. */
const FLAKES = 4200;
/** A flake's width in metres, smallest to biggest. */
const FLAKE_SIZE = [0.008, 0.028] as const;
/** The grey the surface goes at the dust's edge, inside where it has gone, and the flakes as they drift off (sRGB). */
const ASH_EDGE = '#5d5853';
const ASH_INSIDE = '#2c2926';
const ASH = '#47423d';
/** The fall's light on the flakes, roughly as it falls on the figure (linear). */
const FLAKE_LIGHT = new Color(0.5, 0.62, 0.72);

/** Fine value noise, so the dust's edge crumbles instead of running in smooth lines. */
const CRUMB_GLSL = /* glsl */ `
float crumbHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float crumb(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(crumbHash(i), crumbHash(i + vec3(1, 0, 0)), f.x), mix(crumbHash(i + vec3(0, 1, 0)), crumbHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(crumbHash(i + vec3(0, 0, 1)), crumbHash(i + vec3(1, 0, 1)), f.x), mix(crumbHash(i + vec3(0, 1, 1)), crumbHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}
`;

/**
 * One of the figure's materials, crumbling: behind the dust's front the surface is gone, just
 * ahead of it, ash. Its inside shows through the holes as ash too, not as a hollow shell; while
 * the figure is whole, the inside is left out as before.
 */
function crumbling(source: MeshStandardMaterial, front: { value: number }): MeshStandardMaterial {
  const material = source.clone();
  material.side = DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDustFront = front;
    shader.uniforms.uAshEdge = { value: new Color(ASH_EDGE) };
    shader.uniforms.uAshInside = { value: new Color(ASH_INSIDE) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uDustFront;\nuniform vec3 uAshEdge;\nuniform vec3 uAshInside;\nvarying vec3 vRest;\n${DUST_THRESHOLD_GLSL}\n${CRUMB_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float dust = dustThreshold(vRest) + 0.05 * (crumb(vRest * 70.0) - 0.5);
        if (dust < uDustFront || (!gl_FrontFacing && uDustFront <= 0.0)) discard;
        diffuseColor.rgb = mix(diffuseColor.rgb, uAshEdge, step(0.0001, uDustFront) * (1.0 - smoothstep(uDustFront, uDustFront + 0.05, dust)));
        if (!gl_FrontFacing) diffuseColor.rgb = uAshInside;`,
      );
  };
  return material;
}

const flakeVertex = /* glsl */ `
uniform float uViewportHeight;
attribute vec2 aState;
attribute float aSeed;
varying vec2 vUv;
varying float vAsh;
varying float vSeed;

void main() {
  vUv = uv;
  vAsh = aState.y;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aState.x <= 0.0 ? 0.0 : max(1.5, aState.x * projectionMatrix[1][1] * uViewportHeight * 0.5 / max(-mv.z, 0.05));
}
`;

const flakeFragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform vec3 uAsh;
uniform vec3 uLight;
uniform float uTime;
varying vec2 vUv;
varying float vAsh;
varying float vSeed;

void main() {
  // A chip, not a dot: a squashed diamond, each turned its own way.
  vec2 c = gl_PointCoord - 0.5;
  float a = vSeed * 6.283;
  c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
  if (abs(c.x) * 1.1 + abs(c.y) * (1.6 + vSeed) > 0.55) discard;
  vec3 surface = texture2D(uMap, vUv).rgb * uColor;
  // Tumbling as it goes, a flake catches the light and loses it.
  float tumble = 0.7 + 0.3 * sin(uTime * (3.0 + 4.0 * vSeed) + vSeed * 50.0);
  gl_FragColor = vec4(mix(surface, uAsh, vAsh) * uLight * tumble, 1.0);
}
`;

/** The flakes of one of the figure's meshes, with the surface each came from. */
interface FlakeSet {
  mesh: SkinnedMesh;
  points: Points;
  vertex: Uint32Array;
  /** Fall-local t when each comes off. */
  off: Float32Array;
  seed: Float32Array;
  size: Float32Array;
  position: BufferAttribute;
  state: BufferAttribute;
}

/** The surface area round each vertex (a third of each triangle it is in), at rest. */
function vertexAreas(geometry: BufferGeometry): Float32Array {
  const position = geometry.getAttribute('position');
  const areas = new Float32Array(position.count);
  const index = geometry.index;
  const triangles = index ? index.count / 3 : position.count / 3;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let i = 0; i < triangles; i++) {
    const [ia, ib, ic] = index ? [index.getX(i * 3), index.getX(i * 3 + 1), index.getX(i * 3 + 2)] : [i * 3, i * 3 + 1, i * 3 + 2];
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    const third = b.sub(a).cross(c.sub(a)).length() / 6;
    areas[ia] += third;
    areas[ib] += third;
    areas[ic] += third;
  }
  return areas;
}

/** Picks `count` vertices, each as likely as the surface round it is big. */
function pickVertices(areas: Float32Array, count: number, rand: () => number): Uint32Array {
  const cumulative = new Float64Array(areas.length);
  let sum = 0;
  areas.forEach((area, i) => {
    sum += area;
    cumulative[i] = sum;
  });
  const picked = new Uint32Array(count);
  for (let k = 0; k < count; k++) {
    const x = rand() * sum;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    picked[k] = lo;
  }
  return picked;
}

const white = (() => {
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

/**
 * The falling figure turning to dust (dust.ts): its own crumbling copies of the figure's materials,
 * and the flakes, taken from all over its surface, each the colour of where it came from, going
 * grey as the wind takes it. `dress` is given the figure at commit and returns the undo.
 */
export class FigureDust {
  readonly root = new Group();
  private readonly front = { value: 0 };
  private readonly sets: FlakeSet[] = [];
  private figure: Object3D | null = null;
  private readonly flake: Flake = { offset: [0, 0, 0], size: 0, ash: 0 };
  private readonly at = new Vector3();

  readonly dress = (figure: Object3D): (() => void) => {
    const meshes: SkinnedMesh[] = [];
    figure.traverse((object) => {
      if ((object as SkinnedMesh).isSkinnedMesh) meshes.push(object as SkinnedMesh);
    });
    const originals = meshes.map((mesh) => mesh.material as MeshStandardMaterial);
    const crumbled = originals.map((material) => crumbling(material, this.front));
    meshes.forEach((mesh, i) => (mesh.material = crumbled[i]));

    const areas = meshes.map((mesh) => vertexAreas(mesh.geometry));
    const total = areas.reduce((sum, a) => sum + a.reduce((s, x) => s + x, 0), 0);
    const rand = mulberry32(23);
    meshes.forEach((mesh, i) => {
      const area = areas[i].reduce((s, x) => s + x, 0);
      const count = Math.round((FLAKES * area) / total);
      if (count === 0) return;
      this.sets.push(this.flakes(mesh, originals[i], pickVertices(areas[i], count, rand), rand));
    });
    for (const set of this.sets) this.root.add(set.points);
    this.figure = figure;

    return () => {
      meshes.forEach((mesh, i) => (mesh.material = originals[i]));
      for (const material of crumbled) material.dispose();
      for (const set of this.sets) {
        this.root.remove(set.points);
        set.points.geometry.dispose();
        (set.points.material as Material).dispose();
      }
      this.sets.length = 0;
      this.figure = null;
    };
  };

  private flakes(mesh: SkinnedMesh, source: MeshStandardMaterial, vertex: Uint32Array, rand: () => number): FlakeSet {
    const count = vertex.length;
    const rest = mesh.geometry.getAttribute('position');
    const uvs = mesh.geometry.getAttribute('uv');
    const uv = new Float32Array(count * 2);
    const off = new Float32Array(count);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    vertex.forEach((v, k) => {
      if (uvs) {
        uv[k * 2] = uvs.getX(v);
        uv[k * 2 + 1] = uvs.getY(v);
      }
      off[k] = DUST.start + dustThreshold([rest.getX(v), rest.getY(v), rest.getZ(v)]) * (DUST.end - DUST.start);
      seed[k] = rand();
      size[k] = FLAKE_SIZE[0] + rand() * (FLAKE_SIZE[1] - FLAKE_SIZE[0]);
    });
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(new Float32Array(count * 3), 3);
    const state = new BufferAttribute(new Float32Array(count * 2), 2);
    geometry.setAttribute('position', position);
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.setAttribute('aState', state);
    geometry.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const material = new ShaderMaterial({
      vertexShader: flakeVertex,
      fragmentShader: flakeFragment,
      uniforms: {
        uViewportHeight: { value: 720 },
        uMap: { value: source.map ?? white },
        uColor: { value: source.color.clone() },
        uAsh: { value: new Color(ASH) },
        uLight: { value: FLAKE_LIGHT },
        uTime: { value: 0 },
      },
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { mesh, points, vertex, off, seed, size, position, state };
  }

  /**
   * Fall-local t, whether the story is in the fall at all (the chapter's group stays drawn a
   * little past it, where the figure is placed by another chapter's camera), the scene clock,
   * and the drawing buffer's height in pixels.
   */
  update(t: number, falling: boolean, time: number, viewportHeight: number) {
    this.front.value = dustFront(t);
    const active = falling && this.figure !== null && t > DUST.start && t < DUST.end + DUST.life;
    this.root.visible = active;
    if (!active || !this.figure) return;
    // The figure was posed and placed this frame, after the last render: bring its bones up to date.
    this.figure.updateWorldMatrix(true, false);
    this.figure.updateMatrixWorld(true);
    for (const set of this.sets) {
      const positions = set.position.array as Float32Array;
      const states = set.state.array as Float32Array;
      for (let k = 0; k < set.vertex.length; k++) {
        const flake = flakeAt(t - set.off[k], set.seed[k], time, this.flake);
        states[k * 2] = flake.size * set.size[k];
        if (flake.size === 0) continue;
        states[k * 2 + 1] = flake.ash;
        set.mesh.getVertexPosition(set.vertex[k], this.at).applyMatrix4(set.mesh.matrixWorld);
        positions[k * 3] = this.at.x + flake.offset[0];
        positions[k * 3 + 1] = this.at.y + flake.offset[1];
        positions[k * 3 + 2] = this.at.z + flake.offset[2];
      }
      set.position.needsUpdate = true;
      set.state.needsUpdate = true;
      const uniforms = (set.points.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = time;
      uniforms.uViewportHeight.value = viewportHeight;
    }
  }
}
