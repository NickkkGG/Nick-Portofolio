import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  type PointLight,
  SRGBColorSpace,
} from 'three';
import { playTapeClunk, playTapeSlide } from '@/audio/clicks';
import { content } from '@/content';
import { type ContactLink, scribbledHref } from '@/content/schema';
import { damp, smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { MODELS, useModel } from '@/experience/assets';
import { CASSETTE_SCALE, cassettePose } from '../depths/choreography';
import { useChapterFrame } from '../useChapterFrame';

const LINKS = content.contact;
const PARTS = ['Cassette_Shell', 'Cassette_Window', 'Cassette_Reels', 'Cassette_Label'];
/** How far the tape sits out of its sleeve at rest, and how far it slides out on hover (model metres). */
const REST_OUT = 0.014;
const SLIDE_OUT = 0.11;
const HANDWRITING = '"Marker Felt", "Noteworthy", "Segoe Print", "Bradley Hand", "Ink Free", "Comic Sans MS", cursive';
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

/** The label on the tape itself, seen once it slides out: the address, in a hurry. */
function paintLabel(canvas: HTMLCanvasElement, link: ContactLink, seed: number) {
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
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const text = scribbledHref(link.href);
  ctx.font = `${Math.min(h * 0.42, (w * 0.86) / (0.55 * text.length))}px ${HANDWRITING}`;
  ctx.save();
  ctx.translate(w * 0.06, h * 0.4);
  ctx.rotate((rand() - 0.5) * 0.05);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

interface Tape {
  pivot: Group;
  cassette: Group;
  hit: Mesh;
  slide: number;
}

/** The four tapes, each in its sleeve, copied from depths.glb with their own hand-written labels. */
class TapeKit {
  readonly root = new Group();
  private readonly tapes: Tape[] = [];
  private readonly canvases: { sticker: HTMLCanvasElement; label: HTMLCanvasElement }[] = [];
  private readonly textures: CanvasTexture[] = [];
  private hovered = -1;

  constructor(scene: Group) {
    const sleeve = scene.getObjectByName('Cassette_Sleeve');
    const hitGeometry = new BoxGeometry(1, 0.118, 0.04);
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
      if (sleeve) pivot.add(sleeve.clone());
      const paper = new Mesh(new PlaneGeometry(0.13, 0.055), new MeshStandardMaterial({ map: stickerMap, roughness: 0.9 }));
      paper.position.set(-0.012, 0.014, 0.0164);
      paper.rotation.z = (i % 2 ? 1 : -1) * 0.025;
      pivot.add(paper);
      pivot.traverse((child) => {
        if ((child as Mesh).isMesh) child.raycast = noRaycast;
      });
      // One invisible box per tape is all the pointer sees; it grows as the tape slides out.
      const hit = new Mesh(hitGeometry, hitMaterial);
      hit.userData.tape = i;
      pivot.add(hit);
      this.tapes.push({ pivot, cassette, hit, slide: 0 });
      this.canvases.push({ sticker, label });
      this.textures.push(stickerMap, labelMap);
      this.root.add(pivot);
    });
  }

  paint() {
    this.canvases.forEach(({ sticker, label }, i) => {
      paintSticker(sticker, LINKS[i], i + 1);
      paintLabel(label, LINKS[i], i + 1);
    });
    for (const texture of this.textures) texture.needsUpdate = true;
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

  update(t: number, time: number, delta: number) {
    this.tapes.forEach((tape, i) => {
      const { position, yaw, tilt } = cassettePose(i, this.tapes.length, t, time);
      tape.pivot.position.set(...position);
      tape.pivot.rotation.set(tilt, yaw, 0.03 * Math.sin(time * 0.6 + i));
      tape.slide = damp(tape.slide, i === this.hovered ? 1 : 0, 9, delta);
      const out = REST_OUT + SLIDE_OUT * tape.slide;
      tape.cassette.position.x = out;
      // Sleeve plus whatever of the tape sticks out of it.
      const left = -0.1;
      const right = 0.1 + out;
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

/** Contact (spec §3.9): VHS tapes rise out of the water, one per link; hover slides one out, click plays it. */
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

  useChapterFrame('contact', ref);
  useFrame((_, delta) => {
    const { p, time } = useExperience.getState();
    const { chapter, t } = resolve(p);
    const local = chapter.id === 'contact' ? t : chapter.id === 'loop' ? 1 : 0;
    kit.update(local, time, Math.min(delta, 0.1));
    if (fill.current) fill.current.intensity = 5 * smoothstep(0, 0.25, local);
  });

  const live = () => {
    const { chapter, t } = resolve(useExperience.getState().p);
    return chapter.id === 'contact' && t > 0.25;
  };
  const onOver = (event: ThreeEvent<PointerEvent>) => {
    const index = tapeOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    if (kit.hover(index)) playTapeSlide(true);
    setPointer(true);
  };
  const onOut = (event: ThreeEvent<PointerEvent>) => {
    if (tapeOf(event.object) < 0) return;
    if (kit.release() && live()) playTapeSlide(false);
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
      <pointLight ref={fill} position={[0, -178, 4.2]} color="#f2e6d0" intensity={0} distance={10} decay={2} />
      <primitive object={kit.root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
    </group>
  );
}
