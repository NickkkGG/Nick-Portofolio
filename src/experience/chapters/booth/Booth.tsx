import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Color,
  DataTexture,
  DoubleSide,
  Frustum,
  Group,
  type Material,
  Matrix4,
  Mesh,
  type MeshStandardMaterial,
  type Object3D,
  PointLight,
  type ShaderMaterial,
  SpotLight,
  type Texture,
  Vector3,
} from 'three';
import { content } from '@/content';
import { BOOTH_AO, MODELS, PORTRAIT, useKtx2, useModel } from '@/experience/assets';
import { Character } from '@/experience/character/Character';
import { boothMix } from '@/experience/character/poses';
import { smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { helixSlots } from '../spiral/helix';
import { useChapterFrame } from '../useChapterFrame';
import { beamGeometry, createBeamMaterial } from './beamMaterial';
import { BOOTH } from './layout';
import { projectorCamera, SHEET_FALL, sheetFall } from './projector';
import { createSheetMaterial } from './sheetMaterial';
import { SlideReel } from './slideCanvas';
import { BEAM_OUT_T, gateDrop, lampLevel, SHEET_DROP_T, sheetDrop, shutter, slideAt, slideFocus } from './slides';

const SLIDES = content.about.slides;
const SHEET = new Vector3(...BOOTH.sheet.center);
const FIRST_MONITOR = new Vector3(...helixSlots(1)[0].position);
const SHEET_TOP = BOOTH.sheet.center[1] + BOOTH.sheet.height / 2;
/** The rope and pegs come to rest this far above the floor, on the heap of cloth. */
const REST = 0.05;

/** Light levels; tune here. Colours are sRGB. */
const LOOK = {
  /** The lamp as it catches, a deep orange filament, and hot, tungsten white. */
  lampCold: new Color('#ff7a2e'),
  lampHot: new Color('#ffe4bf'),
  /** The slide's light on the sheet. */
  sheet: 1.05,
  /** The same light in the dusty air of the beam. */
  beam: 0.55,
  /** The sheet's light thrown back into the booth, with a floor so the room never goes black between slides. */
  bounce: 16,
  bounceFloor: 0.4,
  /** How much of the room's light the sheet gets back. */
  bounceBack: 0.05,
  /** Through the vents of the projector's body. */
  leak: 0.9,
  /** Out of the window onto the first monitor, once the sheet is down. */
  throwOut: 5,
  /** Cold light down through the hole in the roof. */
  hole: 5,
  /** The faint teal that comes in through the gaps between the boards. */
  ambient: new Color('#0b1e1d'),
};

/** A flat normal, in case the sheet comes without its weave. */
function flatNormal(): DataTexture {
  const texture = new DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

/** The booth's parts, taken from booth.glb, given their AO and live materials, and the light of the show. */
class BoothKit {
  readonly reel: SlideReel;
  readonly sheet: ShaderMaterial;
  readonly beam: Mesh;
  readonly lights = new Group();
  private readonly beamMaterial: ShaderMaterial;
  private readonly frustum = new Frustum();
  private readonly lens: MeshStandardMaterial[] = [];
  /** What each of the model's meshes wears in the booth; put on at commit, by the kit React keeps (dress). */
  private readonly dressing = new Map<Mesh, Material>();
  private readonly hanging = new Group();
  private readonly parts: Object3D[] = [];
  private readonly ropeEnds: Object3D | undefined;
  private readonly cables: Object3D | undefined;
  /** The lit sheet as a light: a wide, soft cone back into the booth (an area light would cost every material in the film). */
  private readonly bounce = new SpotLight('#ffffff', 0, 6, 1.4, 0.5, 1.5);
  private readonly leak = new PointLight('#ffffff', 0, 2.5, 2);
  private readonly hole = new SpotLight('#a8e6dc', LOOK.hole, 7, 0.42, 0.8, 1.4);
  private readonly throwOut = new SpotLight('#ffffff', 0, 14, 0.34, 0.35, 1);
  private readonly lamp = new Color();
  private readonly flat = flatNormal();

  constructor(
    private readonly scene: Group,
    ao: Texture,
    portrait: HTMLImageElement | null,
  ) {
    ao.flipY = false;
    ao.channel = 1;
    this.reel = new SlideReel(SLIDES, portrait);
    const dressed = new Map<string, Material>();
    let weave: Texture | null = null;
    let sheet: Mesh | undefined;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const source = (mesh.userData.sourceMaterial as Material | undefined) ?? (mesh.material as Material);
      mesh.userData.sourceMaterial = source;
      const runtime = source.userData.runtime as string | undefined;
      if (runtime === 'booth-sheet') {
        weave = (source as MeshStandardMaterial).normalMap;
        sheet = mesh;
        return;
      }
      // Baked AO on the second UV set, for the shed and everything standing in it; materials
      // they share with the rest (the pegs, the cables) get a copy of their own.
      const baked = Boolean(mesh.userData.ao ?? mesh.parent?.userData.ao);
      if (!runtime && !baked) {
        this.dressing.set(mesh, source);
        return;
      }
      const key = `${source.uuid}${baked ? '-ao' : ''}`;
      let material = dressed.get(key) as MeshStandardMaterial | undefined;
      if (!material) {
        material = (source as MeshStandardMaterial).clone();
        if (baked) {
          material.aoMap = ao;
          material.aoMapIntensity = 1;
        }
        if (runtime === 'booth-lens') this.lens.push(material);
        if (runtime === 'cobweb') {
          // Thin webs in the corners: seen from both sides, never hiding what is behind them.
          material.side = DoubleSide;
          material.depthWrite = false;
        }
        dressed.set(key, material);
      }
      this.dressing.set(mesh, material);
    });

    this.sheet = createSheetMaterial(this.reel.texture, weave ?? this.flat);
    if (sheet) this.dressing.set(sheet, this.sheet);

    const projector = projectorCamera();
    this.sheet.uniforms.uProjector.value.multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse);
    this.beamMaterial = createBeamMaterial(projector, this.reel.texture);
    this.beam = new Mesh(beamGeometry(projector), this.beamMaterial);
    this.beam.renderOrder = 2;
    this.frustum.setFromProjectionMatrix(new Matrix4().multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse));

    // The rope and its pegs come down with the sheet's top edge, tilting as its left end goes first.
    this.hanging.position.set(SHEET.x, SHEET_TOP, SHEET.z);
    for (const name of ['Booth_Rope', 'Booth_Pegs']) {
      const part = scene.getObjectByName(name);
      if (part) this.parts.push(part);
    }
    this.ropeEnds = scene.getObjectByName('Booth_RopeEnds');
    this.cables = scene.getObjectByName('Booth_Cables');

    this.bounce.position.set(SHEET.x, SHEET.y, SHEET.z + 0.08);
    this.bounce.target.position.set(SHEET.x, BOOTH.floorY + 0.6, BOOTH.backZ);
    this.leak.position.set(BOOTH.lens[0], BOOTH.lens[1] + 0.12, BOOTH.lens[2] + 0.3);
    const [hx, hy, hz] = BOOTH.roofHole;
    this.hole.position.set(hx, hy + 1.2, hz);
    this.hole.target.position.set(hx + 0.15, BOOTH.floorY, hz - 0.2);
    const lens = new Vector3(...BOOTH.lens);
    this.throwOut.position.copy(lens).addScaledVector(FIRST_MONITOR.clone().sub(lens).normalize(), 0.15);
    this.throwOut.target.position.copy(FIRST_MONITOR);
    this.lights.add(this.bounce, this.bounce.target, this.leak, this.hole, this.hole.target, this.throwOut, this.throwOut.target);
  }

  /**
   * Puts the booth's materials on the shared model and hangs the rope and pegs from this kit's
   * pivot. Done at commit rather than while rendering: React may build a kit and throw it away
   * (Strict Mode, a suspended sibling), and that one must not leave its materials on the model.
   */
  dress() {
    for (const [mesh, material] of this.dressing) mesh.material = material;
    for (const [mesh, material] of this.dressing) {
      // The sheet falls a long way out of the bounds it was exported with.
      if (material === this.sheet) mesh.frustumCulled = false;
    }
    this.scene.add(this.hanging);
    for (const part of this.parts) this.hanging.attach(part);
  }

  /** About-chapter t (0 in the fall, 1 in the work), the scene clock, where the camera is, and whether it is still falling. */
  update(t: number, time: number, eye: Vector3, falling: boolean) {
    const { index, local } = slideAt(t, SLIDES.length);
    const through = this.reel.show(index);
    const turning = index >= 0;
    const warm = lampLevel(t);
    const drop = sheetDrop(t);
    const flicker = 0.965 + 0.02 * Math.sin(time * 13.1) * Math.sin(time * 4.7) + 0.015 * Math.sin(time * 31.7);
    const level = warm * warm * (turning ? shutter(local) : 1) * flicker;
    this.lamp.copy(LOOK.lampCold).lerp(LOOK.lampHot, warm);

    const sheet = this.sheet.uniforms;
    sheet.uLight.value.copy(this.lamp).multiplyScalar(LOOK.sheet * level);
    sheet.uAmbient.value.copy(LOOK.ambient).add(this.lamp.clone().multiplyScalar(LOOK.bounceBack * level * (LOOK.bounceFloor + through)));
    // Slides buckle a little in the lamp's heat: the focus breathes.
    sheet.uFocus.value = turning ? slideFocus(local) * (0.975 + 0.025 * Math.sin(time * 0.9)) : 1;
    sheet.uGate.value = turning ? gateDrop(local) : 0;
    sheet.uDrop.value = drop;
    sheet.uTime.value = time;

    const left = Math.min(sheetFall(drop, 0) * SHEET_FALL, SHEET_TOP - BOOTH.floorY - REST);
    const right = Math.min(sheetFall(drop, 1) * SHEET_FALL, SHEET_TOP - BOOTH.floorY - REST);
    const beam = this.beamMaterial.uniforms;
    // Like an eye in the dark, the haze reads about as strong whatever the slide lets through.
    beam.uLight.value.copy(this.lamp).multiplyScalar((LOOK.beam * level) / (1 + 3 * through));
    beam.uGate.value = sheet.uGate.value;
    beam.uTime.value = time;
    beam.uSheetTop.value.set(SHEET_TOP - left, SHEET_TOP - right);
    beam.uEndZ.value = FIRST_MONITOR.z - 0.1;
    beam.uInside.value = this.frustum.containsPoint(eye) ? 1 : 0;

    this.hanging.position.y = SHEET_TOP - (left + right) / 2;
    this.hanging.rotation.z = Math.atan2(left - right, BOOTH.sheet.width);
    if (this.ropeEnds) this.ropeEnds.visible = t >= SHEET_DROP_T;
    // The cables the shed hangs in run 45 m up, right where the end of the fall drops: left out
    // of it so the figure falls through clear air, and back once it is inside, behind the walls.
    if (this.cables) this.cables.visible = !falling;

    this.bounce.color.copy(this.lamp);
    this.bounce.intensity = LOOK.bounce * level * (LOOK.bounceFloor + through) * (1 - drop);
    this.leak.color.copy(this.lamp);
    this.leak.intensity = LOOK.leak * warm * flicker;
    this.throwOut.color.copy(this.lamp);
    this.throwOut.intensity = LOOK.throwOut * level * smoothstep(SHEET_DROP_T, BEAM_OUT_T, t);
    for (const glass of this.lens) {
      glass.emissive.copy(this.lamp);
      glass.emissiveIntensity = 0.2 + 4 * level;
    }
  }

  dispose() {
    this.reel.dispose();
    this.sheet.dispose();
    this.beamMaterial.dispose();
    this.beam.geometry.dispose();
    this.flat.dispose();
  }
}

/** Hunched on the crate from the crash on, getting up once the sheet is down; not there while still falling. */
function inBooth(figure: Group) {
  const { chapter } = resolve(useExperience.getState().p);
  figure.visible = chapter.id === 'about' || chapter.id === 'spiral';
}

/**
 * The projection booth (chapter ABOUT): a plank shed hanging in the cables across from the
 * first monitor, where the figure crashes in and a carousel projector shows who they are, one
 * slide at a time, on a sheet over the window. After a blank the rope snaps, the sheet falls,
 * and the beam goes out of the window onto the first monitor, which tunes in.
 */
export function Booth() {
  const ref = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const { scene } = useModel(MODELS.booth);
  const { ao } = useKtx2(BOOTH_AO);
  const portrait = useTexture(PORTRAIT);
  const kit = useMemo(() => new BoothKit(scene, ao, (portrait.image as HTMLImageElement | undefined) ?? null), [scene, ao, portrait]);

  useLayoutEffect(() => kit.dress(), [kit]);
  useEffect(() => {
    void document.fonts?.ready.then(() => kit.reel.paint());
    return () => kit.dispose();
  }, [kit]);

  useChapterFrame('about', ref, (t, p) => kit.update(t, useExperience.getState().time, camera.position, resolve(p).chapter.id === 'fall'));

  return (
    <group ref={ref}>
      <hemisphereLight args={['#2a5e58', '#060a0a', 0.7]} />
      <primitive object={kit.lights} />
      <primitive object={scene} />
      <primitive object={kit.beam} />
      <Character
        position={BOOTH.seat}
        rotation={[0, Math.PI, 0]}
        pose={() => {
          const { p, time } = useExperience.getState();
          return boothMix(p, time);
        }}
        place={inBooth}
      />
    </group>
  );
}
