import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  ShaderMaterial,
  type Texture,
} from 'three';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { lampLevel } from '@/experience/flicker';
import { lerp } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { useExperience } from '@/store/useExperience';
import { MODELS, useModel } from '@/experience/assets';
import { useChapterFrame } from '../useChapterFrame';

/** The room's ceiling is at 3 m (blender/scripts/room.py); the roof sits just above it, out of sight from inside. */
const ROOF_Y = 3.03;
/** Room footprint (x -3..3, z -1.18..3) plus its walls. */
const ROOF = { x0: -3.25, x1: 3.25, z0: -1.4, z1: 3.25 };
const LAMP = new Color('#ffb35c');

type Point = [x: number, z: number];

/** A crack wandering across the roof between two points. */
function crackPath(seed: number, from: Point, to: Point, steps: number, wander: number): Point[] {
  const rand = mulberry32(seed);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const free = i === 0 || i === steps ? 0 : 1;
    return [lerp(from[0], to[0], t) + free * (rand() - 0.5) * wander, lerp(from[1], to[1], t) + free * (rand() - 0.5) * wander];
  });
}

/** A flat strip along `path` just above the roof, `width(t)` wide; uv.x runs along it, uv.y across. */
function strip(path: Point[], width: (t: number) => number, lift: number): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  path.forEach(([x, z], i) => {
    const [nx, nz] = path[Math.min(i + 1, path.length - 1)];
    const [px, pz] = path[Math.max(i - 1, 0)];
    const length = Math.hypot(nx - px, nz - pz) || 1;
    const t = i / (path.length - 1);
    const half = width(t) / 2;
    // Perpendicular to the path, in the roof's plane.
    const ox = (-(nz - pz) / length) * half;
    const oz = ((nx - px) / length) * half;
    positions.push(x + ox, ROOF_Y + lift, z + oz, x - ox, ROOF_Y + lift, z - oz);
    uvs.push(t, 0, t, 1);
    if (i > 0) {
      const k = i * 2;
      index.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

const glowShader = {
  uniforms: { uColor: { value: new Color() } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Soft light spilling out of the crack onto the concrete either side of it.
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
      float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
      gl_FragColor = vec4(uColor * pow(across, 3.0) * ends, 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
};

/**
 * The roof the loop falls back through: moonlit concrete with a low parapet, rubble, and a
 * crack glowing with the room's lamp below. Nothing here is a light (it would reach into the
 * room), and everything sits above the ceiling, so from inside the room the loop seam stays clean.
 */
class RoofKit {
  readonly root = new Group();
  private readonly core = new MeshBasicMaterial({ color: '#000000', toneMapped: false, side: DoubleSide });
  private readonly glow = new ShaderMaterial(glowShader);
  private readonly maps: Texture[] = [];

  constructor(scene: Group) {
    const source = (scene.getObjectByName('Depths_Floor') as Mesh | undefined)?.material as MeshStandardMaterial | undefined;
    if (source) {
      const concrete = source.clone();
      for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
        const texture = concrete[key]?.clone();
        if (!texture) continue;
        texture.repeat.set(2.4, 2);
        texture.needsUpdate = true;
        concrete[key] = texture;
        this.maps.push(texture);
      }
      // No lights up here: the moonlight is painted on.
      concrete.color.set('#7d7f84');
      concrete.emissive.set('#3a4a5e');
      concrete.emissiveMap = concrete.map;
      concrete.emissiveIntensity = 0.8;
      const { x0, x1, z0, z1 } = ROOF;
      const slab = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0), concrete);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((x0 + x1) / 2, ROOF_Y, (z0 + z1) / 2);
      this.root.add(slab);
      // A low parapet round the edge.
      const wall = 0.22;
      for (const [w, d, x, z] of [
        [x1 - x0, wall, (x0 + x1) / 2, z0 + wall / 2],
        [x1 - x0, wall, (x0 + x1) / 2, z1 - wall / 2],
        [wall, z1 - z0, x0 + wall / 2, (z0 + z1) / 2],
        [wall, z1 - z0, x1 - wall / 2, (z0 + z1) / 2],
      ]) {
        const parapet = new Mesh(new BoxGeometry(w, 0.32, d), concrete);
        parapet.position.set(x, ROOF_Y + 0.16, z);
        this.root.add(parapet);
      }
    }

    // Rubble: a few small pieces of slab lying about.
    const rand = mulberry32(31);
    for (let i = 0; i < 9; i++) {
      const piece: Object3D | undefined = scene.getObjectByName(`Fall_Chunk_${i % 6}`)?.clone();
      if (!piece) continue;
      piece.scale.setScalar(0.25 + rand() * 0.35);
      piece.position.set(lerp(-2.6, 2.6, rand()), ROOF_Y + 0.02, lerp(-0.9, 2.8, rand()));
      piece.rotation.set((rand() - 0.5) * 0.4, rand() * 6.28, (rand() - 0.5) * 0.4);
      this.root.add(piece);
    }

    // The crack: from the back wall to where the camera comes down (x 1.6, z 2.6), widest there.
    const main = crackPath(5, [-2.2, 0.1], [1.75, 2.75], 34, 0.16);
    const open = (t: number) => 0.012 + 0.07 * Math.exp(-(((t - 0.92) / 0.14) ** 2));
    const thin = (t: number) => 0.016 * (1 - t) + 0.004;
    const cracks: [Point[], (t: number) => number][] = [
      [main, open],
      [crackPath(8, main[12], [-0.6, 1.9], 9, 0.1), thin],
      [crackPath(9, main[24], [1.9, 0.6], 10, 0.1), thin],
    ];
    for (const [path, width] of cracks) {
      this.root.add(new Mesh(strip(path, width, 0.004), this.core));
      this.root.add(new Mesh(strip(path, (t) => width(t) * 9 + 0.05, 0.006), this.glow));
    }
  }

  /** `lamp` 0..1: the room's lamp under the crack. */
  update(lamp: number) {
    this.core.color.copy(LAMP).multiplyScalar(0.3 + 5 * lamp);
    this.glow.uniforms.uColor.value.copy(LAMP).multiplyScalar(0.05 + 0.5 * lamp);
  }

  dispose() {
    for (const texture of this.maps) texture.dispose();
    this.glow.dispose();
  }
}

/** The loop (spec §3.10): falling back onto the room from above, toward the glowing crack. */
export function LoopRoof() {
  const ref = useRef<Group>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new RoofKit(scene), [scene]);
  useEffect(() => () => kit.dispose(), [kit]);
  useChapterFrame('loop', ref);
  useFrame(() => kit.update(lampLevel(useExperience.getState().time)));

  return (
    <group ref={ref}>
      <primitive object={kit.root} />
      {/* The lamp's light leaking up out of the crack into the dust. */}
      <LightShaft
        group="loop"
        from={[1.6, ROOF_Y + 0.02, 2.55]}
        toward={[1.7, 12, 2.7]}
        length={6}
        radiusStart={0.15}
        radiusEnd={1.3}
        color="#ffb35c"
        intensity={0.05}
      />
    </group>
  );
}
