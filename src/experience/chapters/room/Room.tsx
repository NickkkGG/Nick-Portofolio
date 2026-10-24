import { useTexture } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Box3,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  FrontSide,
  type Group,
  type Material,
  type Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  type PointLight,
  type RectAreaLight,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { playKnock, prepareKnock } from '@/audio/knock';
import { content } from '@/content';
import { MODELS, ROOM_LIGHTMAPS, useKtx2, useModel } from '@/experience/assets';
import { LightShaft } from '@/experience/atmosphere/LightShaft';
import { cameraPoseAt } from '@/experience/camera/paths';
import type { Vec3 } from '@/experience/camera/types';
import { Character } from '@/experience/character/Character';
import { glanceAt } from '@/experience/character/glance';
import { roomMix } from '@/experience/character/poses';
import { lampLevel } from '@/experience/flicker';
import { useExperience } from '@/store/useExperience';
import { useChapterFrame } from '../useChapterFrame';
import { canKnock, type KnockHit, knockTarget, KNUCKLES, knucklePoint, lampNervousness, roomT } from './knock';
import { type DustBurst, KnockDust, MAX_BURSTS } from './KnockDust';
import { type AtlasMaps, bakeLighting, roomLight, type Sway } from './lighting';
import { RoomScreen } from './RoomScreen';

RectAreaLightUniformsLib.init();

/** The lightmaps are KTX2 (ROOM_LIGHTMAPS); the probe stays WebP, an equirect for three's PMREM. */
const MAPS = {
  probe: '/models/room-probe.webp',
  smudge: '/models/crt-smudge.webp',
};

/** Light levels on top of the bake; tune here. Colours are sRGB. */
const LOOK = {
  lamp: { color: '#ffb35c', gain: 2.2, highlight: 1.2 },
  screen: { color: '#cfe8ff', gain: 2.2, highlight: 2.2 },
  moon: { gain: 2.6, highlight: 0.35 },
  /** Light every surface gets anyway, in the bake's units (a white wall's brightness). */
  ambient: 0.03,
  reflections: 0.9,
};
const LAMP_COLOR = new Color(LOOK.lamp.color);
const SCREEN_COLOR = new Color(LOOK.screen.color);

/** Where blender/scripts/room.py put the bulb, the screen and the window, and where the moonlight goes. */
interface Layout {
  lampBulb: Vec3;
  moonDir: Vec3;
  screen: Vec3;
  /** Inside face of the window, where the moon beam starts. */
  window: Vec3;
}

function centerOf(scene: Group, name: string): Vector3 {
  const object = scene.getObjectByName(name);
  return object ? new Box3().setFromObject(object).getCenter(new Vector3()) : new Vector3();
}

function readLayout(scene: Group): Layout {
  const screen = centerOf(scene, 'CRT_Screen');
  const glass = centerOf(scene, 'Window_Glass');
  return {
    lampBulb: scene.userData.lamp_bulb as Vec3,
    moonDir: scene.userData.moon_dir as Vec3,
    screen: [screen.x, screen.y, screen.z],
    window: [glass.x + 0.1, glass.y + 0.1, glass.z],
  };
}

/** Clouds drift past the moon: its light breathes slowly. */
function moonLevel(time: number): number {
  return 0.86 + 0.14 * (0.5 + 0.5 * Math.sin(time * 0.11) * Math.sin(time * 0.037 + 1.0));
}

/** The tube's brightness: never quite steady. */
function screenPower(time: number): number {
  return 0.93 + 0.05 * Math.sin(time * 1.7) * Math.sin(time * 0.53) + 0.02 * Math.sin(time * 7.1);
}

/** Once the camera has dropped through the floor, the chair, the figure on it and the rug under it have gone through it too. */
function fallenThrough(): boolean {
  return cameraPoseAt(useExperience.getState().p, content.projects.length).position[1] < 0;
}

/** What stood over the hole, in room.glb: the chair's parts and the rug. */
const OVER_THE_HOLE = ['Chair_Base', 'Chair_Lift', 'Chair_Seat', 'Chair_Piping', 'Rug'];

function lampNow(): number {
  const { p, time, knock } = useExperience.getState();
  return lampLevel(time, { nervous: lampNervousness(roomT(p)), knocks: knock.knocks });
}

const normalScratch = new Vector3();

function toHits(event: Pick<ThreeEvent<MouseEvent>, 'intersections'>): KnockHit[] {
  return event.intersections.map((hit) => {
    normalScratch.copy(hit.face?.normal ?? new Vector3(0, 0, 1)).transformDirection(hit.object.matrixWorld);
    return {
      distance: hit.distance,
      knockable: hit.object.userData.knock === 1,
      point: [hit.point.x, hit.point.y, hit.point.z],
      normal: [normalScratch.x, normalScratch.y, normalScratch.z],
    };
  });
}

function setKnockCursor(on: boolean) {
  if (on) document.documentElement.dataset.cursor = 'knock';
  else delete document.documentElement.dataset.cursor;
}

type MapKey = keyof typeof MAPS | keyof typeof ROOM_LIGHTMAPS;
type Scales = Record<'A' | 'B', AtlasMaps['scale']> & { probe: number };

/**
 * The room's live look, applied to the exported scene: baked-light materials, the glowing
 * bulb, the tube, the glass. Applying twice is harmless (React Strict Mode renders twice).
 */
class RoomDressing {
  /** The CRT's glass, which RoomScreen turns into a live picture. */
  screen: Mesh | null = null;
  private readonly bulb = new MeshStandardMaterial({ color: '#2a2016', emissive: LAMP_COLOR, emissiveIntensity: 3, roughness: 0.15, transparent: true, opacity: 0.9 });
  private readonly filament = new MeshBasicMaterial({ color: new Color(LAMP_COLOR).multiplyScalar(30), toneMapped: false });
  private readonly overTheHole: Object3D[];

  constructor(scene: Group, textures: Record<MapKey, Texture>, scales: Scales) {
    for (const key of ['aBase', 'aLamp', 'aScreen', 'bBase', 'bLamp', 'bScreen'] as const) {
      const map = textures[key];
      map.flipY = false;
      map.colorSpace = SRGBColorSpace;
      map.channel = 1;
      map.needsUpdate = true;
    }
    const probe = textures.probe;
    probe.mapping = EquirectangularReflectionMapping;
    probe.colorSpace = SRGBColorSpace;
    const maps: Record<'A' | 'B', AtlasMaps> = {
      A: { base: textures.aBase, lamp: textures.aLamp, screen: textures.aScreen, scale: scales.A },
      B: { base: textures.bBase, lamp: textures.bLamp, screen: textures.bScreen, scale: scales.B },
    };
    const led = new MeshBasicMaterial({ color: new Color('#38ff6a').multiplyScalar(4), toneMapped: false });
    const glass = new MeshStandardMaterial({
      color: '#9fb4c4',
      roughness: 0.06,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      envMap: probe,
      envMapIntensity: scales.probe * 1.5,
    });
    this.overTheHole = OVER_THE_HOLE.map((name) => scene.getObjectByName(name)).filter((part) => part !== undefined);
    const cache = new Map<string, Material>();
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const source = (mesh.userData.sourceMaterial as Material | undefined) ?? (mesh.material as Material);
      mesh.userData.sourceMaterial = source;
      const runtime = mesh.userData.runtime as string | undefined;
      if (runtime === 'screen') {
        this.screen = mesh;
        return;
      }
      if (runtime === 'bulb') return void (mesh.material = this.bulb);
      if (runtime === 'filament') return void (mesh.material = this.filament);
      if (runtime === 'led') return void (mesh.material = led);
      if (runtime === 'glass') {
        mesh.material = glass;
        mesh.renderOrder = 1;
        return;
      }
      const atlas = mesh.userData.atlas as 'A' | 'B' | undefined;
      if (!atlas) return;
      const key = `${source.uuid}-${atlas}`;
      let baked = cache.get(key);
      if (!baked) {
        const sway: Sway = runtime === 'cobweb' ? (source.name === 'Cobweb0' ? 'triangle' : 'quad') : 'none';
        const standard = bakeLighting(source as MeshStandardMaterial, maps[atlas], sway);
        // Seen from below, as the camera drops out of the room, the floor is the slab under it
        // (fall/slab.ts), broken open where the figure went through.
        if (source.name === 'Floor') standard.side = FrontSide;
        standard.envMap = probe;
        standard.envMapIntensity = scales.probe * LOOK.reflections;
        if (runtime === 'decal' || runtime === 'cobweb') {
          // Thin layers on the walls: drawn over them, never hiding them, webs seen from both sides.
          standard.depthWrite = false;
          standard.polygonOffset = true;
          standard.polygonOffsetFactor = -2;
          standard.side = DoubleSide;
        }
        baked = standard;
        cache.set(key, baked);
      }
      mesh.material = baked;
    });
  }

  /** The bare bulb glows with the lamp's flicker; what stood over the hole is gone once the camera is through the floor. */
  update(level: number, fallen: boolean) {
    this.bulb.emissiveIntensity = 0.4 + 5 * level;
    this.filament.color.copy(LAMP_COLOR).multiplyScalar(2 + 40 * level * level);
    for (const part of this.overTheHole) part.visible = !fallen;
  }
}

/** The opening room (spec §3.3): Blender assets with baked light, the lamp, the monitor, the ghost knock. */
export function Room() {
  const ref = useRef<Group>(null);
  const lampLight = useRef<PointLight>(null);
  const screenLight = useRef<RectAreaLight>(null);
  const bursts = useRef<DustBurst[]>([]);
  const { scene } = useModel(MODELS.room);
  const maps = useTexture(MAPS);
  const lightmaps = useKtx2(ROOM_LIGHTMAPS);
  const textures = useMemo(() => ({ ...maps, ...lightmaps }), [maps, lightmaps]);

  const scales = useMemo(() => JSON.parse(String(scene.userData.lightmaps)) as Scales, [scene]);
  const layout = useMemo(() => readLayout(scene), [scene]);
  const dressing = useMemo(() => new RoomDressing(scene, textures, scales), [scene, textures, scales]);

  useLayoutEffect(() => {
    const [x, y, z] = layout.screen;
    screenLight.current?.lookAt(x, y, z + 1);
  }, [layout]);

  useEffect(() => () => setKnockCursor(false), []);
  // Set up at PLAY, so even the first knock is heard in full.
  useEffect(
    () =>
      useExperience.subscribe(
        (s) => s.started,
        (started) => {
          if (started) prepareKnock();
        },
        { fireImmediately: true },
      ),
    [],
  );

  useChapterFrame('room', ref, () => {
    const { time } = useExperience.getState();
    const level = lampNow();
    const power = screenPower(time);
    roomLight.uLampColor.value.copy(LAMP_COLOR).multiplyScalar(level * LOOK.lamp.gain);
    roomLight.uScreenColor.value.copy(SCREEN_COLOR).multiplyScalar(power * LOOK.screen.gain);
    roomLight.uBaseColor.value.setScalar(moonLevel(time) * LOOK.moon.gain);
    roomLight.uAmbient.value.setScalar(LOOK.ambient);
    roomLight.uTime.value = time;
    dressing.update(level, fallenThrough());
    if (lampLight.current) lampLight.current.intensity = LOOK.lamp.highlight * level;
    if (screenLight.current) screenLight.current.intensity = LOOK.screen.highlight * power;
  });

  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const store = useExperience.getState();
    if (!canKnock(store.p)) return;
    event.stopPropagation();
    const target = knockTarget(toHits(event));
    if (!target || !store.knockAt(target.point)) return;
    // Knock-knock: each knuckle shakes its own puff off the wall, the second a smaller one.
    const puffs = KNUCKLES.map(({ delay, dust }, k) => ({ time: store.time + delay, point: knucklePoint(target.point, target.normal, k), normal: target.normal, amount: dust }));
    bursts.current = [...bursts.current, ...puffs].slice(-MAX_BURSTS);
    if (store.cameraPose) playKnock(target.point, store.cameraPose);
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    setKnockCursor(canKnock(useExperience.getState().p) && knockTarget(toHits(event)) !== null);
  };

  const { lampBulb, moonDir, screen, window } = layout;
  const toMoon = new Vector3(...moonDir).normalize().multiplyScalar(-6);
  return (
    <group ref={ref}>
      <primitive object={scene} onClick={onClick} onPointerMove={onPointerMove} onPointerOut={() => setKnockCursor(false)} />
      {dressing.screen && (
        <RoomScreen mesh={dressing.screen} probe={textures.probe} probeScale={scales.probe} smudge={textures.smudge} power={() => screenPower(useExperience.getState().time)} />
      )}
      <KnockDust bursts={bursts} />

      {/* Real-time lights only add highlights to baked surfaces, and light the character. */}
      <pointLight ref={lampLight} position={lampBulb} color={LOOK.lamp.color} intensity={0} distance={7} decay={2} />
      <rectAreaLight ref={screenLight} position={[screen[0], screen[1], screen[2] + 0.02]} width={0.37} height={0.28} color={LOOK.screen.color} intensity={0} />
      <directionalLight position={toMoon} color="#8fb3e6" intensity={LOOK.moon.highlight} />

      {/* The moon, in line with the window from the opening camera. */}
      <mesh position={[-64, 4, -43]}>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial color="#d2def4" toneMapped={false} />
      </mesh>
      <LightShaft
        group="room"
        from={window}
        toward={[window[0] + moonDir[0] * 3, window[1] + moonDir[1] * 3, window[2] + moonDir[2] * 3]}
        length={2.5}
        radiusStart={0.55}
        radiusEnd={0.95}
        color="#88aee0"
        intensity={0.2}
      />
      <LightShaft group="room" from={[screen[0], screen[1], screen[2] + 0.02]} toward={[screen[0], screen[1] - 0.06, 0.6]} length={1.3} radiusStart={0.2} radiusEnd={0.62} color="#cfe8ff" intensity={0.06} />

      {/* At the desk, typing: on the chair (room.py), facing the monitor. A knock turns the head for a while. */}
      <Character
        position={[0, 0, 0.03]}
        rotation={[0, Math.PI, 0]}
        pose={() => roomMix(useExperience.getState().time)}
        place={(figure) => {
          figure.visible = !fallenThrough();
        }}
        look={() => {
          const { knock, time } = useExperience.getState();
          return glanceAt(knock.heard, time);
        }}
      />
    </group>
  );
}
