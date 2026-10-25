import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  type Camera,
  CanvasTexture,
  type Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  type PointLight,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { playFocusLock, playTapeClunk, playTapeSlide } from '@/audio/clicks';
import { content } from '@/content';
import { type ContactLink, scribbledHref } from '@/content/schema';
import { damp, smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { MODELS, useModel } from '@/experience/assets';
import {
  CASSETTE_HALF_HEIGHT,
  CASSETTE_REACH,
  CASSETTE_SCALE,
  cassettePose,
  FLOOR_Y,
  HOVER,
  TAPES_UP_T,
  type TapeLayout,
  tapeLayout,
} from '../depths/choreography';
import { tapeSplashes } from '../depths/splashes';
import { useChapterFrame } from '../useChapterFrame';
import { focusBrackets, type ScreenRect } from '../focus';

const LINKS = content.contact;
const PARTS = ['Cassette_Shell', 'Cassette_Window', 'Cassette_Reels', 'Cassette_Label'];
/** How far the tape sits out of its sleeve at rest, and how far more it slides out on hover (model metres). */
const REST_OUT = 0.014;
const SLIDE_OUT = CASSETTE_REACH / CASSETTE_SCALE - REST_OUT;
/** The sleeve's ends, either side of the tape's centre (model metres). */
const SLEEVE_END = 0.1;
/** The sticker sits toward the sleeve's closed end. */
const STICKER_X = -0.012;
const HANDWRITING = '"Marker Felt", "Noteworthy", "Segoe Print", "Bradley Hand", "Ink Free", "Comic Sans MS", cursive';
/** The invisible box the pointer sees round each tape (model metres); its width follows the slide. */
const HIT = { height: 0.118, depth: 0.04 } as const;
/** While one tape is picked the others dim by this much, and the fill light leans its way, this much brighter. */
const DIM = 0.4;
const FOCUS_LIGHT = 2.5;
const noRaycast = () => undefined;

function openLink(href: string) {
  if (href.startsWith('mailto:')) window.location.href = href;
  else window.open(href, '_blank', 'noopener,noreferrer');
}

function rng(seed: number) {
  let s = seed * 7919 + 17;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** The sticker on the card sleeve: lined paper and the link's name in marker. */
function paintSticker(canvas: HTMLCanvasElement, link: ContactLink, seed: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const rand = rng(seed);
  ctx.fillStyle = '#efe7d2';
  ctx.fillRect(0, 0, w, h);
  // Foxing and grime from years in a box.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(120, 90, 40, ${0.02 + rand() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, 4 + rand() * 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(70, 110, 170, 0.35)';
  ctx.lineWidth = 2;
  for (let y = h * 0.3; y < h; y += h * 0.22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200, 60, 60, 0.45)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, 0);
  ctx.lineTo(w * 0.08, h);
  ctx.stroke();
  ctx.save();
  ctx.translate(w * 0.52, h * 0.5);
  ctx.rotate((rand() - 0.5) * 0.08);
  ctx.fillStyle = '#16161c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.min(h * 0.5, (w * 0.8) / (0.6 * link.label.length))}px ${HANDWRITING}`;
  ctx.fillText(link.label, 0, -h * 0.04);
  ctx.restore();
  ctx.fillStyle = 'rgba(30, 50, 120, 0.8)';
  ctx.font = `${h * 0.14}px ${HANDWRITING}`;
  ctx.textAlign = 'right';
  ctx.fillText('T-120  SP', w * 0.95, h * 0.9);
}

/**
 * The label on the tape itself, seen once it slides out: the address, in a hurry, written
 * at the end that leaves the sleeve first (`side`: +1 right, -1 left).
 */
function paintLabel(canvas: HTMLCanvasElement, link: ContactLink, seed: number, side: 1 | -1) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const rand = rng(seed + 50);
  ctx.fillStyle = '#f3efe4';
  ctx.fillRect(0, 0, w, h);
  // The printed stripes of a blank tape label.
  ['#d8402f', '#e9a23b', '#3f7fbf'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, h * (0.8 + i * 0.065), w, h * 0.05);
  });
  ctx.fillStyle = '#1c1c22';
  ctx.textAlign = side > 0 ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  const text = scribbledHref(link.href);
  // Only about two thirds of the label ever leave the sleeve.
  ctx.font = `${Math.min(h * 0.42, (w * 0.64) / (0.55 * text.length))}px ${HANDWRITING}`;
  ctx.save();
  ctx.translate(side > 0 ? w * 0.95 : w * 0.05, h * 0.4);
  ctx.rotate((rand() - 0.5) * 0.05);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

interface Tape {
  pivot: Group;
  cassette: Group;
  sleeve: Object3D | null;
  paper: Mesh;
  hit: Mesh;
  slide: number;
  /** Which end of the sleeve is open: the tape slides out to the right (+1) or left (-1). */
  side: 1 | -1;
  /** Its own copies of its materials, and their colours as modelled: they dim while another is picked. */
  paints: { material: MeshStandardMaterial; color: Color }[];
  /** Whether its bottom edge was under the water last frame; null before the first. */
  under: boolean | null;
}

/** The four tapes, each in its sleeve, copied from depths.glb with their own hand-written labels. */
class TapeKit {
  readonly root = new Group();
  private readonly tapes: Tape[] = [];
  private readonly canvases: { sticker: HTMLCanvasElement; label: HTMLCanvasElement }[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly corner = new Vector3();
  private hovered = -1;
  private lastT = 0;

  constructor(scene: Group) {
    const sleeve = scene.getObjectByName('Cassette_Sleeve');
    const hitGeometry = new BoxGeometry(1, HIT.height, HIT.depth);
    const hitMaterial = new MeshBasicMaterial({ visible: false });
    LINKS.forEach((_, i) => {
      const sticker = document.createElement('canvas');
      sticker.width = 512;
      sticker.height = 216;
      const label = document.createElement('canvas');
      label.width = 512;
      label.height = 112;
      const stickerMap = new CanvasTexture(sticker);
      stickerMap.colorSpace = SRGBColorSpace;
      stickerMap.anisotropy = 4;
      const labelMap = new CanvasTexture(label);
      labelMap.colorSpace = SRGBColorSpace;
      // glTF UVs start at the top, like the canvas.
      labelMap.flipY = false;
      labelMap.anisotropy = 4;

      const cassette = new Group();
      for (const name of PARTS) {
        const part = scene.getObjectByName(name)?.clone();
        if (!part) continue;
        if (name === 'Cassette_Label') (part as Mesh).material = new MeshStandardMaterial({ map: labelMap, roughness: 0.85 });
        cassette.add(part);
      }
      const pivot = new Group();
      pivot.scale.setScalar(CASSETTE_SCALE);
      pivot.add(cassette);
      const sleeveCopy = sleeve?.clone() ?? null;
      if (sleeveCopy) pivot.add(sleeveCopy);
      const paper = new Mesh(new PlaneGeometry(0.13, 0.055), new MeshStandardMaterial({ map: stickerMap, roughness: 0.9 }));
      paper.position.set(STICKER_X, 0.014, 0.0164);
      paper.rotation.z = (i % 2 ? 1 : -1) * 0.025;
      pivot.add(paper);
      const paints: Tape['paints'] = [];
      pivot.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        mesh.raycast = noRaycast;
        const material = (mesh.material as MeshStandardMaterial).clone();
        mesh.material = material;
        paints.push({ material, color: material.color.clone() });
      });
      // One invisible box per tape is all the pointer sees; it grows as the tape slides out.
      const hit = new Mesh(hitGeometry, hitMaterial);
      hit.userData.tape = i;
      pivot.add(hit);
      this.tapes.push({ pivot, cassette, sleeve: sleeveCopy, paper, hit, slide: 0, side: 1, paints, under: null });
      this.canvases.push({ sticker, label });
      this.textures.push(stickerMap, labelMap);
      this.root.add(pivot);
    });
  }

  paint() {
    this.canvases.forEach(({ sticker, label }, i) => {
      paintSticker(sticker, LINKS[i], i + 1);
      paintLabel(label, LINKS[i], i + 1, this.tapes[i].side);
    });
    for (const texture of this.textures) texture.needsUpdate = true;
  }

  /** Opens tape `i`'s sleeve on `side`: the sleeve turns end for end, the sticker stays upright. */
  private open(i: number, side: 1 | -1) {
    const tape = this.tapes[i];
    tape.side = side;
    if (tape.sleeve) tape.sleeve.rotation.y = side > 0 ? 0 : Math.PI;
    tape.paper.position.x = side * STICKER_X;
    const { label } = this.canvases[i];
    paintLabel(label, LINKS[i], i + 1, side);
    this.textures[2 * i + 1].needsUpdate = true;
  }

  /** The pointer is over tape `index`; true if it just started to slide out. */
  hover(index: number): boolean {
    const changed = index !== this.hovered;
    this.hovered = index;
    return changed;
  }

  /** The pointer left the tapes; true if one was out. */
  release(): boolean {
    const wasOut = this.hovered >= 0;
    this.hovered = -1;
    return wasOut;
  }

  /** The tape under the pointer, or -1. */
  get picked(): number {
    return this.hovered;
  }

  /** How far the most picked tape is out (0..1), and where across it waits. */
  focus(): { x: number; amount: number } {
    let best = { x: 0, amount: 0 };
    for (const tape of this.tapes) if (tape.slide > best.amount) best = { x: tape.pivot.position.x, amount: tape.slide };
    return best;
  }

  /** Where the tape under the pointer is on the screen, sleeve and slid-out tape together. */
  rectOf(camera: Camera, width: number, height: number): ScreenRect | null {
    if (this.hovered < 0) return null;
    const { hit } = this.tapes[this.hovered];
    hit.updateWorldMatrix(true, false);
    // The rig has already moved the camera this frame (Experience.tsx mounts it first), but its
    // matrices only catch up at render: without this the brackets trail the handheld sway.
    camera.updateMatrixWorld();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let k = 0; k < 8; k++) {
      this.corner.set(k & 1 ? 0.5 : -0.5, (k & 2 ? 0.5 : -0.5) * HIT.height, (k & 4 ? 0.5 : -0.5) * HIT.depth);
      this.corner.applyMatrix4(hit.matrixWorld).project(camera);
      const x = ((this.corner.x + 1) / 2) * width;
      const y = ((1 - this.corner.y) / 2) * height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  update(t: number, time: number, delta: number, layout: TapeLayout) {
    // A jump (the menu, Home) moves the tapes at once: no rings on the water for that.
    const jumped = Math.abs(t - this.lastT) > 0.05;
    this.lastT = t;
    this.tapes.forEach((tape, i) => {
      tape.slide = damp(tape.slide, i === this.hovered ? 1 : 0, 9, delta);
    });
    this.tapes.forEach((tape, i) => {
      const { position, yaw, tilt, roll, side } = cassettePose(i, this.tapes.length, t, time, layout);
      if (side !== tape.side) this.open(i, side);
      // Picked: grown, come forward and squared up to the camera, while the others dim.
      const picked = tape.slide;
      tape.pivot.position.set(position[0], position[1], position[2] + HOVER.forward * picked);
      tape.pivot.rotation.set(tilt * (1 - picked), yaw * (1 - picked), roll * (1 - picked));
      tape.pivot.scale.setScalar(CASSETTE_SCALE * (1 + (HOVER.grow - 1) * picked));
      let others = 0;
      this.tapes.forEach((other, j) => {
        if (j !== i) others = Math.max(others, other.slide);
      });
      for (const { material, color } of tape.paints) material.color.copy(color).multiplyScalar(1 - DIM * others);
      // Coming up through the water, or going back under it: the floor rings (depths/splashes.ts).
      const under = position[1] - CASSETTE_HALF_HEIGHT < FLOOR_Y;
      if (tape.under !== null && under !== tape.under && !jumped) tapeSplashes.add(position[0], position[2], time);
      tape.under = under;
      const out = REST_OUT + SLIDE_OUT * tape.slide;
      tape.cassette.position.x = side * out;
      // Sleeve plus whatever of the tape sticks out of its open end.
      const left = side > 0 ? -SLEEVE_END : -SLEEVE_END - out;
      const right = side > 0 ? SLEEVE_END + out : SLEEVE_END;
      tape.hit.scale.x = right - left;
      tape.hit.position.x = (left + right) / 2;
    });
  }

  dispose() {
    for (const texture of this.textures) texture.dispose();
  }
}

function tapeOf(object: Object3D): number {
  const tape = object.userData.tape;
  return typeof tape === 'number' ? tape : -1;
}

function setPointer(on: boolean) {
  if (on) document.documentElement.dataset.cursor = 'pointer';
  else if (document.documentElement.dataset.cursor === 'pointer') delete document.documentElement.dataset.cursor;
}

/**
 * Contact (spec §3.9): VHS tapes rise out of the water, one per link. Hover picks one: it slides
 * out toward the middle, grows and comes forward, the others dim and the camcorder locks focus
 * on it (ui/FocusBrackets.tsx). Click plays it.
 */
export function Cassettes() {
  const ref = useRef<Group>(null);
  const fill = useRef<PointLight>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new TapeKit(scene), [scene]);

  useEffect(() => {
    kit.paint();
    void document.fonts?.ready.then(() => kit.paint());
    return () => kit.dispose();
  }, [kit]);

  // The tapes are all but in their places by then, facing the camera (camera/paths.ts).
  const live = () => {
    const { chapter, t } = resolve(useExperience.getState().p);
    return chapter.id === 'contact' && t > TAPES_UP_T - 0.05;
  };
  useChapterFrame('contact', ref);
  useFrame(({ camera, size }, delta) => {
    const { p, time } = useExperience.getState();
    const { chapter, t } = resolve(p);
    const local = chapter.id === 'contact' ? t : chapter.id === 'loop' ? 1 : 0;
    kit.update(local, time, Math.min(delta, 0.1), tapeLayout(size.width / size.height));
    const focus = kit.focus();
    if (fill.current) {
      fill.current.intensity = 5 * smoothstep(0, 0.3, local) + FOCUS_LIGHT * focus.amount;
      fill.current.position.x = 0.7 * focus.x * focus.amount;
    }
    // Scrolled away with a tape out: it goes back in its sleeve.
    if (!live() && kit.release()) useExperience.getState().setTape(null);
    const rect = kit.rectOf(camera, size.width, size.height);
    if (rect) focusBrackets.lock(`tape-${kit.picked}`, rect);
    else focusBrackets.release('tape-');
  });

  const onOver = (event: ThreeEvent<PointerEvent>) => {
    const index = tapeOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    if (kit.hover(index)) {
      playTapeSlide(true);
      playFocusLock();
    }
    useExperience.getState().setTape(index);
    setPointer(true);
  };
  const onOut = (event: ThreeEvent<PointerEvent>) => {
    if (tapeOf(event.object) < 0) return;
    if (kit.release() && live()) playTapeSlide(false);
    useExperience.getState().setTape(null);
    setPointer(false);
  };
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const index = tapeOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    playTapeClunk();
    openLink(LINKS[index].href);
  };

  return (
    <group ref={ref}>
      {/* Soft light from the camera's side so the stickers read; the bulb backlights the rest. */}
      <pointLight ref={fill} position={[0, -178, 5]} color="#f2e6d0" intensity={0} distance={10} decay={2} />
      <primitive object={kit.root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
    </group>
  );
}
