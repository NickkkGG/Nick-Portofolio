import { useMemo, useRef } from 'react';
import { AdditiveBlending, Group, type Material, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { content } from '@/content';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { cameraPoseAt } from '@/experience/camera/paths';
import { Character } from '@/experience/character/Character';
import { fallMix } from '@/experience/character/poses';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { MODELS, useModel } from '@/experience/assets';
import { useChapterFrame } from '../useChapterFrame';
import { fallingFigure } from './figure';
import { edgeGeometry, holeOutline, rebarGeometries, rimGeometry, slabMaterial, undersideGeometry } from './slab';

/** depths.glb has six broken pieces of the room's floor slab, Fall_Chunk_0..5. */
const SHAPES = 6;
// A handful of small pieces, so they read as the floor coming apart around the figure
// rather than a wall of slabs between it and the camera. They start under the slab, round
// where the camera drops through after the figure but never in its face.
const DEBRIS = (() => {
  const rand = mulberry32(7);
  return Array.from({ length: 16 }, (_, i) => {
    const a = rand() * Math.PI * 2;
    const r = 0.7 + rand() * 0.9;
    return {
      x: 0.32 + r * Math.cos(a),
      z: 0.57 + r * Math.sin(a),
      y0: -0.25 - rand() * 0.75,
      scale: 0.2 + rand() * 0.35,
      spin: 0.5 + rand() * 2,
      shape: i % SHAPES,
    };
  });
})();

function materialNamed(scene: Group, name: string): Material {
  let found: Material | undefined;
  scene.traverse((object) => {
    const material = (object as Mesh).material;
    if (!found && material && !Array.isArray(material) && material.name === name) found = material;
  });
  return found ?? new MeshStandardMaterial();
}

/** The broken floor: the slab it broke out of, and copies of its pieces, each tumbling down its own way. */
class FallKit {
  readonly root = new Group();
  private readonly pieces: Object3D[] = [];

  constructor(scene: Group) {
    const outline = holeOutline();
    const face = slabMaterial(materialNamed(scene, 'Concrete') as MeshStandardMaterial);
    const broken = slabMaterial(materialNamed(scene, 'ConcreteInner') as MeshStandardMaterial);
    const rebar = materialNamed(scene, 'Rebar');
    this.root.add(new Mesh(undersideGeometry(outline), face), new Mesh(rimGeometry(outline), broken), new Mesh(edgeGeometry(), broken));
    for (const bar of rebarGeometries(outline)) this.root.add(new Mesh(bar, rebar));
    for (const d of DEBRIS) {
      const piece = scene.getObjectByName(`Fall_Chunk_${d.shape}`)?.clone() ?? new Group();
      piece.scale.setScalar(d.scale);
      this.pieces.push(piece);
      this.root.add(piece);
    }
  }

  /** Fall-local t: debris falls slower than the camera, so it rains down toward the lens. */
  update(t: number) {
    const drop = 40 * smoothstep(0.1, 1, t);
    DEBRIS.forEach((d, i) => {
      const piece = this.pieces[i];
      piece.position.set(d.x, d.y0 - drop, d.z);
      piece.rotation.set(t * d.spin * Math.PI * 2, t * d.spin * Math.PI, t * d.spin * 0.7);
    });
  }
}

// Additive and round, so the hole reads as light spilling through rather than a white square.
const HOLE_GLOW = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  // Right under the hole the glow would fill the frame white: it opens up as the camera drops away.
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float glow = 1.0 - smoothstep(0.0, 1.0, r);
      vec3 lamp = vec3(1.0, 0.82, 0.6) * 2.2 * glow * glow * glow;
      vec3 moon = vec3(0.35, 0.5, 0.75) * 0.5 * glow;
      gl_FragColor = vec4((lamp + moon) * smoothstep(0.8, 5.0, vDepth), 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
};

/**
 * Upright, leaning back with its arms up for the hole, its pelvis on the point the camera
 * looks at (figure.ts): coming through the hole above the camera, then falling beside it,
 * until it goes through the booth roof as the chapter ends. Shown from when the camera is
 * through the floor until then.
 */
function placeFalling(figure: Group) {
  const { p, time } = useExperience.getState();
  const { chapter, t } = resolve(p);
  figure.visible = chapter.id === 'fall' && t >= 0.15;
  const pose = cameraPoseAt(p, content.projects.length);
  const { position, rotation } = fallingFigure(pose.target, pose.position, time);
  figure.rotation.set(...rotation, 'YXZ');
  figure.position.set(...position);
}

/** The fall (spec §3.5): through the broken floor, the room's lamp glowing in the hole above, slab pieces raining down. */
export function Fall() {
  const ref = useRef<Group>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new FallKit(scene), [scene]);

  useChapterFrame('fall', ref, (t) => kit.update(t));

  return (
    <group ref={ref}>
      {/* The broken floor seen from below: the room's lamp glowing through the hole. */}
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <shaderMaterial args={[HOLE_GLOW]} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#cfe8ff" intensity={3} distance={80} decay={0} />
      {/* The undersides the camera sees catch the teal glow of the world below. */}
      <hemisphereLight args={['#9fc4d8', '#5b8e92', 1.6]} />
      <LightShaft
        group="fall"
        from={[0, -0.05, 0]}
        toward={[0, -60, 0]}
        length={45}
        radiusStart={2.8}
        radiusEnd={5.5}
        color="#cfe8ff"
        intensity={0.1}
        nearFade={[2, 12]}
      />
      <primitive object={kit.root} />
      <Character pose={() => fallMix(useExperience.getState().time)} place={placeFalling} />
    </group>
  );
}
