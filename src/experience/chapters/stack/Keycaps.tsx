import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
  SRGBColorSpace,
} from 'three';
import { playKeyClick } from '@/audio/clicks';
import { content } from '@/content';
import type { StackItem } from '@/content/schema';
import { damp, smoothstep } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { MODELS, useModel } from '@/experience/assets';
import { keycapState } from '../depths/choreography';
import { useChapterFrame } from '../useChapterFrame';

const ITEMS = content.stack;
/** depths.glb models one keycap true size (18 mm); here they are big as moths round a giant bulb. */
const KEY_SCALE = 16;
/** Half the modelled cap's height (10.5 mm): each cap turns around its middle. */
const HALF_HEIGHT = 0.00525 * KEY_SCALE;
/** Key travel when the pointer presses one: 4 mm, at scale. */
const TRAVEL = 0.004 * KEY_SCALE;
const noRaycast = () => undefined;

function paintLegend(canvas: HTMLCanvasElement, item: StackItem, seed: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-plex').trim() || 'monospace';
  // Cream PBT, a little darker toward the rim of the dish.
  const plastic = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.72);
  plastic.addColorStop(0, '#efe6cf');
  plastic.addColorStop(1, '#cfc4a8');
  ctx.fillStyle = plastic;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2b2824';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Long names break at their last space, so the legend can stay big.
  const space = item.name.lastIndexOf(' ');
  const lines = item.name.length > 6 && space > 0 ? [item.name.slice(0, space), item.name.slice(space + 1)] : [item.name];
  const longest = Math.max(...lines.map((line) => line.length));
  const size = Math.min(h * 0.3, (w * 0.8) / (0.6 * longest));
  ctx.font = `600 ${size}px ${family}`;
  lines.forEach((line, k) => ctx.fillText(line, w / 2, h * 0.44 + (k - (lines.length - 1) / 2) * size * 0.95));
  ctx.globalAlpha = 0.65;
  ctx.font = `500 ${h * 0.075}px ${family}`;
  ctx.fillText(item.category.toUpperCase(), w / 2, h * 0.84);
  // Years of fingers: the legend worn through in specks.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-atop';
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = '#e6dcc2';
  for (let i = 0; i < 260; i++) {
    const r = 1.2 + rand() * 3.6;
    ctx.beginPath();
    ctx.arc(w * (0.3 + rand() * 0.4), h * (0.25 + rand() * 0.6), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** The keycaps, one per tool: copies of the modelled cap, each with its own printed legend. */
class KeycapKit {
  readonly root = new Group();
  private readonly pivots: Group[] = [];
  private readonly caps: Object3D[] = [];
  private readonly canvases: HTMLCanvasElement[] = [];
  private readonly legends: CanvasTexture[] = [];
  private readonly press: number[] = ITEMS.map(() => 0);
  private hovered = -1;

  constructor(scene: Group) {
    const template = scene.getObjectByName('Keycap');
    if (!template) return;
    const hitGeometry = new BoxGeometry(0.34, 0.22, 0.34);
    const hitMaterial = new MeshBasicMaterial({ visible: false });
    ITEMS.forEach((_, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const legend = new CanvasTexture(canvas);
      legend.colorSpace = SRGBColorSpace;
      // glTF UVs start at the top, like the canvas.
      legend.flipY = false;
      legend.anisotropy = 4;
      const cap = template.clone();
      cap.scale.setScalar(KEY_SCALE);
      cap.position.set(0, -HALF_HEIGHT, 0);
      cap.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        mesh.raycast = noRaycast;
        const material = mesh.material as MeshStandardMaterial;
        if (material.userData.runtime !== 'keycap-legend') return;
        const printed = material.clone();
        printed.map = legend;
        printed.color.set('#ffffff');
        printed.roughness = 0.5;
        mesh.material = printed;
      });
      // One invisible box per key is all the pointer sees, so moving over a cap never flickers.
      const hit = new Mesh(hitGeometry, hitMaterial);
      hit.userData.key = i;
      const pivot = new Group();
      pivot.add(cap, hit);
      this.pivots.push(pivot);
      this.caps.push(cap);
      this.canvases.push(canvas);
      this.legends.push(legend);
      this.root.add(pivot);
    });
  }

  paint() {
    this.canvases.forEach((canvas, i) => {
      paintLegend(canvas, ITEMS[i], i + 1);
      this.legends[i].needsUpdate = true;
    });
  }

  /** The pointer is over key `index`; true if that key just went down. */
  hover(index: number): boolean {
    const changed = index !== this.hovered;
    this.hovered = index;
    return changed;
  }

  /** The pointer left the keys; true if one was down. */
  release(): boolean {
    const wasDown = this.hovered >= 0;
    this.hovered = -1;
    return wasDown;
  }

  update(p: number, time: number, delta: number) {
    this.pivots.forEach((pivot, i) => {
      const { position, scale, angle } = keycapState(i, ITEMS.length, p);
      pivot.visible = scale > 0.001;
      if (!pivot.visible) return;
      pivot.position.set(...position);
      pivot.scale.setScalar(scale);
      // Face out from the bulb, the legend upright; a moth's flutter on top.
      pivot.rotation.set(Math.PI / 2 + 0.12 * Math.sin(time * 1.7 + i * 2.1), angle, 0.1 * Math.sin(time * 2.3 + i), 'YXZ');
      this.press[i] = damp(this.press[i], i === this.hovered ? 1 : 0, 28, delta);
      this.caps[i].position.y = -HALF_HEIGHT - TRAVEL * this.press[i];
    });
  }

  dispose() {
    for (const legend of this.legends) legend.dispose();
  }
}

function keyOf(object: Object3D): number {
  const key = object.userData.key;
  return typeof key === 'number' ? key : -1;
}

function setPointer(on: boolean) {
  if (on) document.documentElement.dataset.cursor = 'pointer';
  else if (document.documentElement.dataset.cursor === 'pointer') delete document.documentElement.dataset.cursor;
}

/** The stack (spec §3.8): one keycap per tool, circling the bulb like moths. Hover one to press it. */
export function Keycaps() {
  const ref = useRef<Group>(null);
  const fill = useRef<PointLight>(null);
  const { scene } = useModel(MODELS.depths);
  const kit = useMemo(() => new KeycapKit(scene), [scene]);

  useEffect(() => {
    kit.paint();
    void document.fonts?.ready.then(() => kit.paint());
    return () => kit.dispose();
  }, [kit]);

  useChapterFrame('depths', ref);
  useFrame((_, delta) => {
    const { p, time } = useExperience.getState();
    kit.update(p, time, Math.min(delta, 0.1));
    // A soft warm light from the camera's side, so the legends read against the bulb behind them.
    const { chapter, t } = resolve(p);
    const level = chapter.id === 'stack' ? 1 : chapter.id === 'problem' ? smoothstep(0.8, 1, t) : chapter.id === 'contact' ? 1 - smoothstep(0, 0.2, t) : 0;
    if (fill.current) fill.current.intensity = 3.5 * level;
  });

  const live = () => resolve(useExperience.getState().p).chapter.id === 'stack';
  const onOver = (event: ThreeEvent<PointerEvent>) => {
    const index = keyOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    if (kit.hover(index)) playKeyClick(true);
    setPointer(true);
  };
  const onOut = (event: ThreeEvent<PointerEvent>) => {
    if (keyOf(event.object) < 0) return;
    if (kit.release() && live()) playKeyClick(false);
    setPointer(false);
  };

  return (
    <group ref={ref}>
      <pointLight ref={fill} position={[0.6, -177.2, 3.6]} color="#ffd9a8" intensity={0} distance={9} decay={2} />
      <primitive object={kit.root} onPointerOver={onOver} onPointerOut={onOut} />
    </group>
  );
}
