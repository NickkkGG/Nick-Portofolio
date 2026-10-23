import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  EquirectangularReflectionMapping,
  Group,
  type Material,
  type Mesh,
  MeshStandardMaterial,
  type Object3D,
  type PointLight,
  type ShaderMaterial,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { content } from '@/content';
import { channelLabel } from '@/content/schema';
import { CRT_AO, MODELS, useKtx2, useModel } from '@/experience/assets';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { Character } from '@/experience/character/Character';
import { spiralMix } from '@/experience/character/poses';
import { smoothstep } from '@/lib/math';
import { mulberry32 } from '@/lib/random';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { isVisible } from '@/timeline/visibility';
import { createStaticScreens } from '@/experience/materials/staticScreens';
import { useChapterFrame } from '../useChapterFrame';
import { HangingCrt } from './HangingCrt';
import { focusedIndex, helixSlots, monitorFocus, SPIRAL } from './helix';
import { surgeLevel } from './motion';

/** The AO is KTX2 (CRT_AO); the probe stays WebP, an equirect for three's PMREM. */
const MAPS = {
  probe: '/models/spiral-probe.webp',
  smudge: '/models/crt-smudge.webp',
};
type Maps = Record<keyof typeof MAPS | keyof typeof CRT_AO, Texture>;

const PROJECTS = content.projects;
const SLOTS = helixSlots(PROJECTS.length);

/** Dim monitors hanging deeper in the dark, facing inward, so the far side has depth. */
const BACKGROUND = (() => {
  const rand = mulberry32(21);
  return Array.from({ length: 42 }, (_, i) => {
    const angle = rand() * Math.PI * 2;
    // Never on the camera's circle (radius 10.5): from 12.5 m out.
    const radius = 12.5 + rand() * 20.5;
    return {
      position: [radius * Math.sin(angle), -168 + rand() * 98, radius * Math.cos(angle)] as [number, number, number],
      angle: angle + Math.PI + (rand() - 0.5) * 0.8,
      seed: 100 + i,
      channel: `CH-${String(7 + Math.floor(rand() * 92)).padStart(2, '0')}`,
      glow: 0.08 + rand() * 0.2,
    };
  });
})();

const FAR_OBJECTS = ['Far_Pillars', 'Droops', 'Towers'];

/** Distant shafts of light, (x, z, top radius), well away from the camera's circle. */
const FAR_SHAFTS: [number, number, number][] = [
  [-26, 14, 1.4],
  [21, -24, 1.1],
  [34, 18, 1.8],
  [-12, -38, 1.2],
];

/** Gives the exported world its live materials: wet cables that mirror the screens, and the towers' static. */
class SpiralKit {
  readonly crt: Group;
  readonly towers: ShaderMaterial;
  /** The far pillars, slung cables and TV towers: they stay on the horizon down in the depths too. */
  readonly far = new Group();

  constructor(world: Group, crt: Group, maps: Maps, probeScale: number) {
    const { probe, ao } = maps;
    probe.mapping = EquirectangularReflectionMapping;
    probe.colorSpace = SRGBColorSpace;
    ao.flipY = false;
    ao.channel = 1;
    this.towers = createStaticScreens();
    const wet = new Map<string, Material>();
    world.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const source = (mesh.userData.sourceMaterial as Material | undefined) ?? (mesh.material as Material);
      mesh.userData.sourceMaterial = source;
      if (source.userData.runtime === 'tower-screen' || source.name === 'TowerScreen') {
        mesh.material = this.towers;
        return;
      }
      let material = wet.get(source.uuid);
      if (!material) {
        const standard = (source as MeshStandardMaterial).clone();
        // Rubber slick with damp: glossier than its texture, mirroring the screens.
        standard.roughness = 0.55;
        standard.envMap = probe;
        standard.envMapIntensity = probeScale * 1.6;
        material = standard;
        wet.set(source.uuid, material);
      }
      mesh.material = material;
    });

    for (const name of FAR_OBJECTS) {
      const object = world.getObjectByName(name);
      if (object) this.far.add(object);
    }

    this.crt = crt;
    crt.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || mesh.userData.runtime === 'screen') return;
      const standard = mesh.material as MeshStandardMaterial;
      if (standard.userData.dressed) return;
      standard.aoMap = ao;
      standard.aoMapIntensity = 1;
      standard.envMap = probe;
      standard.envMapIntensity = probeScale * 0.8;
      standard.userData.dressed = true;
      standard.needsUpdate = true;
    });
  }

  /** Shows the far world while either chapter is on screen, and runs its screens' static. */
  update(time: number, visible: boolean) {
    this.far.visible = visible;
    if (!visible) return;
    this.towers.uniforms.uTime.value = time;
    this.towers.uniforms.uSurge.value = surgeLevel(time);
  }
}

/** The project world (spec §3.6): the cable pillar, the hanging CRTs, the forest and the TV towers. */
export function Spiral() {
  const ref = useRef<Group>(null);
  const glow = useRef<PointLight>(null);
  const glowSpots = useRef<(Object3D | null)[]>([]);
  const world = useModel(MODELS.spiral);
  const crt = useModel(MODELS.crt);
  const webp = useTexture(MAPS);
  const ao = useKtx2(CRT_AO);
  const maps = useMemo(() => ({ ...webp, ...ao }), [webp, ao]);
  const probeScale = Number(world.scene.userData.probe_scale ?? 1);
  const kit = useMemo(() => new SpiralKit(world.scene, crt.scene, maps, probeScale), [world.scene, crt.scene, maps, probeScale]);

  useFrame(() => {
    const { p, time } = useExperience.getState();
    kit.update(time, isVisible('spiral', p) || isVisible('depths', p));
  });

  useChapterFrame('spiral', ref, (t) => {
    // One light for all the project monitors, in front of the one the camera is at: they hang
    // 14 m and a quarter turn apart, so only that one's glow on the cables is ever in frame.
    // It dies away halfway to the next monitor, where it jumps over.
    const index = focusedIndex(t, SLOTS.length);
    const spot = glowSpots.current[index];
    if (glow.current && spot) {
      spot.getWorldPosition(glow.current.position);
      glow.current.intensity = 5 * smoothstep(0.5, 1, monitorFocus(t, index, SLOTS.length));
    }
  });

  const shared = {
    template: kit.crt,
    env: maps.probe,
    envScale: probeScale,
    smudge: maps.smudge,
  };
  return (
    <>
      <primitive object={kit.far} />
      <group ref={ref}>
        <hemisphereLight args={['#2b6a64', '#030707', 0.7]} />
        {/* Light falling down the shaft from the room, catching the nest and the wet cables. */}
        <spotLight
          position={[0, -58, 0]}
          target-position={[0, -84, 0]}
          color="#9fe8dc"
          intensity={30}
          angle={0.55}
          penumbra={0.8}
          distance={60}
          decay={1}
        />
        <LightShaft
          group="spiral"
          from={[0, -62, 0]}
          toward={[0, -170, 0]}
          length={108}
          radiusStart={3}
          radiusEnd={14}
          color="#7fe0d0"
          intensity={0.06}
        />
        {/* Far shafts piercing the fog between the other pillars: the dark has depth. */}
        {FAR_SHAFTS.map(([x, z, width]) => (
          <LightShaft
            key={`${x}:${z}`}
            group="spiral"
            from={[x, -40, z]}
            toward={[x * 1.08, -180, z * 1.08]}
            length={140}
            radiusStart={width}
            radiusEnd={width * 3.2}
            color="#6fd6c8"
            intensity={0.035}
            nearFade={[4, 20]}
          />
        ))}

        <primitive object={world.scene} />

        {SLOTS.map((slot, i) => (
          <HangingCrt
            key={`slot-${i}`}
            {...shared}
            position={slot.position}
            angle={slot.angle}
            seed={i + 1}
            title={PROJECTS[i].status === 'live' ? PROJECTS[i].title : 'NO SIGNAL'}
            channel={channelLabel(i)}
            focusAt={(t) => Math.max(0.15, monitorFocus(t, i, SLOTS.length))}
            glowRef={(spot) => {
              glowSpots.current[i] = spot;
            }}
          />
        ))}
        <pointLight ref={glow} color="#bfe6ff" intensity={0} distance={9} decay={1} />
        {BACKGROUND.map((monitor) => (
          <HangingCrt
            key={monitor.seed}
            {...shared}
            position={monitor.position}
            angle={monitor.angle}
            seed={monitor.seed}
            title="NO SIGNAL"
            channel={monitor.channel}
            focusAt={() => monitor.glow}
          />
        ))}

        {/* On the pillar, facing the first monitor. Only in the chapter itself: the fall's figure
            lands here as that chapter ends, and the two never show at once. */}
        <Character
          position={[0.6, SPIRAL.platformY, 0.6]}
          pose={() => spiralMix(useExperience.getState().time)}
          place={(figure) => {
            figure.visible = resolve(useExperience.getState().p).chapter.id === 'spiral';
          }}
        />
      </group>
    </>
  );
}
