import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  Group,
  type HemisphereLight,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  type Object3D,
  MeshStandardMaterial,
  type PointLight,
  SRGBColorSpace,
} from 'three';
import { MODELS, useModel } from '@/experience/assets';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { surgeLevel } from '@/experience/chapters/spiral/motion';
import { createStaticScreens } from '@/experience/materials/staticScreens';
import { useExperience } from '@/store/useExperience';
import { useChapterFrame } from '../useChapterFrame';
import { BULB_Y, bulbDrop, bulbHaze, bulbIntensity, CORD, dripRipples, FLOOR_Y, lampSwing } from './choreography';
import { mergeRipples, tapeSplashes } from './splashes';
import { WetFloor } from './wetFloor';

const WARM = new Color('#ffb35c');
/** The dark down here before the bulb, and once it is lit. sRGB. */
const AIR_DARK = { sky: new Color().setRGB(0.29, 0.07, 0.06, SRGBColorSpace), ground: new Color().setRGB(0.03, 0.01, 0.01, SRGBColorSpace) };
const AIR_LIT = { sky: new Color().setRGB(0.29, 0.19, 0.08, SRGBColorSpace), ground: new Color().setRGB(0.05, 0.03, 0.015, SRGBColorSpace) };
/** Brightness of the water's mirror; the Fresnel term keeps it subtle straight down. */
const MIRROR = 1.6;
/** Light falling through cracks far above, out between the other pillars: (x, z, width). */
const FAR_SHAFTS: [number, number, number][] = [
  [-22, 16, 1.2],
  [26, -14, 1.0],
  [-14, -30, 1.5],
  [31, 21, 1.1],
  [6, -38, 1.7],
];

/** An old filament never burns quite steady. */
function filamentShimmer(time: number): number {
  return 0.93 + 0.05 * Math.sin(time * 23) * Math.sin(time * 7.3) + 0.02 * Math.sin(time * 61);
}

/** The flooded floor's parts, taken from depths.glb and given their live materials. */
class DepthsKit {
  readonly floor: Mesh;
  readonly props = new Group();
  readonly bulb = new Group();
  private readonly water: WetFloor;
  private readonly glass = new MeshStandardMaterial({ color: '#2a2016', emissive: WARM, emissiveIntensity: 0, roughness: 0.12, transparent: true, opacity: 0.88 });
  private readonly filament = new MeshBasicMaterial({ color: '#000000', toneMapped: false });
  private readonly screens = createStaticScreens();

  constructor(scene: Group) {
    const floor = scene.getObjectByName('Depths_Floor') as Mesh;
    this.water = new WetFloor(floor.material as MeshStandardMaterial, FLOOR_Y);
    this.floor = floor.clone();
    this.floor.material = this.water.material;
    this.floor.onBeforeRender = (renderer, world, camera) => this.water.reflect(renderer, world, camera, this.floor);

    for (const object of scene.children) {
      if (object.name === 'Depths_Debris' || object.name.startsWith('Depths_Crt_')) {
        this.props.add(this.withScreen(object.clone(), this.screens));
      } else if (object.name.startsWith('Bulb_')) {
        const copy = object.clone() as Mesh;
        if (object.name === 'Bulb_Glass') copy.material = this.glass;
        if (object.name === 'Bulb_Filament') copy.material = this.filament;
        this.bulb.add(copy);
      }
    }
  }

  private withScreen(object: Object3D, screen: Material): Object3D {
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh && (mesh.material as Material).userData.runtime === 'tower-screen') mesh.material = screen;
    });
    return object;
  }

  /** `level` 0..1: how brightly the bulb burns. */
  update(time: number, level: number) {
    this.glass.emissiveIntensity = 0.05 + 2.4 * level;
    this.filament.color.copy(WARM).multiplyScalar(0.02 + 24 * level);
    this.screens.uniforms.uTime.value = time;
    this.screens.uniforms.uSurge.value = surgeLevel(time) * 0.6;
    // The sunken sets never quite die: each keeps a faint picture glowing in the water.
    this.screens.uniforms.uFloor.value = 0.3;
    // Drips from far above, and rings where the tapes come up through the water (contact/Cassettes.tsx).
    this.water.update(time, mergeRipples(dripRipples(time), tapeSplashes.ripples(time)), MIRROR);
  }

  dispose() {
    this.water.dispose();
  }
}

/** The flooded floor under the pillar (spec §3.7-3.9): wet concrete, debris, dead TVs and the bulb. Nobody down here. */
export function Depths() {
  const ref = useRef<Group>(null);
  const lamp = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new DepthsKit(scene), [scene]);
  useEffect(() => () => kit.dispose(), [kit]);
  useChapterFrame('depths', ref);

  useFrame(() => {
    const { p, time } = useExperience.getState();
    const lit = bulbIntensity(p) / 3;
    const level = lit * filamentShimmer(time);
    kit.update(time, level);
    if (light.current) light.current.intensity = 22 * level;
    if (lamp.current) {
      const [x, z] = lampSwing(time);
      lamp.current.position.y = BULB_Y + CORD + bulbDrop(p);
      lamp.current.rotation.set(x, 0, z);
    }
    if (hemi.current) {
      // The dark around is red with the problems, warm once the bulb is lit.
      hemi.current.color.lerpColors(AIR_DARK.sky, AIR_LIT.sky, lit);
      hemi.current.groundColor.lerpColors(AIR_DARK.ground, AIR_LIT.ground, lit);
    }
  });

  return (
    <group ref={ref}>
      <hemisphereLight ref={hemi} args={['#4a1210', '#050202', 0.9]} />
      {FAR_SHAFTS.map(([x, z, width]) => (
        <LightShaft
          key={`${x}:${z}`}
          group="depths"
          from={[x, -140, z]}
          toward={[x * 1.05, -180, z * 1.05]}
          length={40}
          radiusStart={width}
          radiusEnd={width * 2.6}
          color="#d9a46a"
          intensity={0.03}
          nearFade={[4, 20]}
        />
      ))}
      <primitive object={kit.floor} />
      <primitive object={kit.props} />
      {/* Everything below hangs from the top of the cord, so it swings as one. */}
      <group ref={lamp} position={[0, BULB_Y + CORD, 0]}>
        <group position={[0, -CORD, 0]}>
          <primitive object={kit.bulb} />
          <pointLight ref={light} color="#ffb35c" intensity={0} distance={40} decay={2} />
          {/* Light pouring off the bulb into the dust: it starts at the glass, with no rim. */}
          <LightShaft
            group="depths"
            from={[0, -0.04, 0]}
            toward={[0, -3, 0]}
            length={2.4}
            radiusStart={0.06}
            radiusEnd={2.3}
            color="#ffb35c"
            intensity={0}
            intensityAt={(p) => 0.18 * bulbHaze(p)}
            fadeIn={0.3}
          />
        </group>
      </group>
    </group>
  );
}
