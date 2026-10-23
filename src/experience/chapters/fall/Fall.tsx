import { useMemo, useRef } from 'react';
import { AdditiveBlending, Group, type Mesh, type Object3D } from 'three';
import { content } from '@/content';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { cameraPoseAt } from '@/experience/camera/paths';
import { smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { MODELS, useModel } from '@/experience/assets';
import { useChapterFrame } from '../useChapterFrame';

/** depths.glb has six broken pieces of the room's floor slab, Fall_Chunk_0..5. */
const SHAPES = 6;
const DEBRIS = (() => {
  const rand = mulberry32(7);
  return Array.from({ length: 40 }, (_, i) => ({
    x: rand() * 4 - 2,
    z: rand() * 4 - 2,
    y0: -rand(),
    scale: 0.35 + rand() * 0.6,
    spin: 0.5 + rand() * 2,
    shape: i % SHAPES,
  }));
})();

/** The broken floor: copies of the slab pieces, each tumbling down its own way. */
class FallKit {
  readonly root = new Group();
  private readonly pieces: Object3D[] = [];

  constructor(scene: Group) {
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

/** The fall (spec §3.5): through the broken floor, the room's lamp glowing in the hole above, slab pieces raining down. */
export function Fall() {
  const ref = useRef<Group>(null);
  const character = useRef<Mesh>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new FallKit(scene), [scene]);

  useChapterFrame('fall', ref, (t, p) => {
    kit.update(t);
    if (character.current) {
      character.current.visible = t >= 0.15;
      character.current.position.set(...cameraPoseAt(p, content.projects.length).target);
    }
  });

  return (
    <group ref={ref}>
      {/* The broken floor seen from below: the room's lamp glowing through the hole. */}
      <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <shaderMaterial args={[HOLE_GLOW]} />
      </mesh>
      <pointLight position={[0, 0.5, 0]} color="#cfe8ff" intensity={3} distance={80} decay={0} />
      {/* The undersides the camera sees catch the teal glow of the world below. */}
      <hemisphereLight args={['#9fc4d8', '#3d6e70', 1.6]} />
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
      {/* TEMPORARY placeholder — the character arrives in milestone 2 */}
      <mesh ref={character} rotation={[-Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.55, 6, 12]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.9} />
      </mesh>
    </group>
  );
}
