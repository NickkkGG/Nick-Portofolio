import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  type Camera,
  CanvasTexture,
  Color,
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { playFocusLock, playTileTink } from '@/audio/clicks';
import { content } from '@/content';
import type { StackItem } from '@/content/schema';
import { damp } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { resolve } from '@/timeline/resolve';
import { TILE, TILE_HOVER, TILES_UP_T, tileState } from '../depths/choreography';
import { focusBrackets, type ScreenRect } from '../focus';
import { useChapterFrame } from '../useChapterFrame';

const ITEMS = content.stack;
/** Pixels across a tile's face: sharp enough for a picked tile up close. */
const FACE = 320;
/**
 * Glazes a wall like this was laid in, deep and pale by turns, each with what it was painted in
 * (cream slip on the deep ones), and the clay under it. sRGB.
 */
const GLAZES = [
  { glaze: '#22488a', ink: '#efe6d2', clay: '#c79a77' },
  { glaze: '#e8dfca', ink: '#132a58', clay: '#d9c4a2' },
  { glaze: '#8a2e22', ink: '#f2e2cc', clay: '#b88462' },
  { glaze: '#2f6e5f', ink: '#efe8d6', clay: '#c79a77' },
  { glaze: '#c8942f', ink: '#2e1c0b', clay: '#d9c4a2' },
  { glaze: '#25282a', ink: '#e8dcc4', clay: '#b88462' },
  { glaze: '#efeae0', ink: '#62200f', clay: '#d9c4a2' },
  { glaze: '#2b7a86', ink: '#f2ead8', clay: '#c79a77' },
] as const;
/** While one tile is picked the others dim by this much. */
const DIM = 0.3;
/** How far a picked tile tips away under the pointer, at its edge (radians): the glint slides across it. */
const PRESS = 0.12;

function rng(seed: number) {
  let s = seed * 7919 + 17;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** A line drawn by hand on both canvases at once: never quite straight. */
function wobbly(ctxs: CanvasRenderingContext2D[], points: [number, number][], rand: () => number, jitter: number) {
  for (const ctx of ctxs) ctx.beginPath();
  points.forEach(([x, y], k) => {
    const dx = (rand() - 0.5) * jitter;
    const dy = (rand() - 0.5) * jitter;
    for (const ctx of ctxs) {
      if (k === 0) ctx.moveTo(x + dx, y + dy);
      else ctx.lineTo(x + dx, y + dy);
    }
  });
  for (const ctx of ctxs) ctx.stroke();
}

/**
 * A tile's face, `color`, and its relief, `bump` (mid grey is the glaze): the glaze pooled and
 * thinned unevenly, a border and corner rounds painted by hand, the tool's name in the same
 * ink, crazing where the glaze cracked as it cooled, pinholes, and on some a chipped corner
 * down to the clay.
 */
function paintFace(colorCanvas: HTMLCanvasElement, bumpCanvas: HTMLCanvasElement, item: StackItem, seed: number) {
  const c = colorCanvas.getContext('2d');
  const b = bumpCanvas.getContext('2d');
  if (!c || !b) return;
  const w = colorCanvas.width;
  const rand = rng(seed);
  const { glaze, ink, clay } = GLAZES[(seed - 1) % GLAZES.length];
  const deep = new Color(glaze).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).l < 0.45;
  c.globalAlpha = 1;
  c.fillStyle = glaze;
  c.fillRect(0, 0, w, w);
  for (let k = 0; k < 14; k++) {
    const x = rand() * w;
    const y = rand() * w;
    const g = c.createRadialGradient(x, y, 0, x, y, w * (0.15 + rand() * 0.35));
    g.addColorStop(0, rand() < 0.5 ? 'rgba(60, 40, 20, 0.07)' : 'rgba(255, 250, 235, 0.09)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  }
  // The glaze runs thin over the rims.
  c.strokeStyle = 'rgba(255, 248, 230, 0.16)';
  c.lineWidth = w * 0.05;
  c.strokeRect(0, 0, w, w);
  b.fillStyle = 'rgb(128, 128, 128)';
  b.fillRect(0, 0, w, w);

  // The painter's border and corner rounds, which meet up into circles between tiles.
  c.strokeStyle = ink;
  b.strokeStyle = 'rgb(140, 140, 140)';
  c.globalAlpha = 0.85;
  for (const [inset, width] of [
    [0.085, 0.013],
    [0.12, 0.006],
  ] as const) {
    c.lineWidth = b.lineWidth = w * width;
    const a = w * inset;
    const z = w - a;
    wobbly([c, b], [[a, a], [z, a], [z, z], [a, z], [a, a]], rand, w * 0.006);
  }
  c.lineWidth = b.lineWidth = w * 0.011;
  for (const [x, y, from] of [
    [0, 0, 0],
    [w, 0, Math.PI / 2],
    [w, w, Math.PI],
    [0, w, (3 * Math.PI) / 2],
  ] as const) {
    for (const ctx of [c, b]) {
      ctx.beginPath();
      ctx.arc(x, y, w * 0.07, from, from + Math.PI / 2);
      ctx.stroke();
    }
  }

  // The name, in the same ink, standing a hair proud of the glaze: as big as fits inside the
  // border, a long one squeezed a little first, the strokes fattened by the brush.
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-plex').trim() || 'monospace';
  const room = w * 0.68;
  let size = w * 0.22;
  c.font = `500 ${size}px ${family}`;
  const natural = c.measureText(item.name).width;
  const squeeze = Math.max(0.78, Math.min(1, room / natural));
  size = Math.min(size, (size * room) / (natural * squeeze));
  c.globalAlpha = 0.95;
  c.fillStyle = c.strokeStyle = ink;
  b.fillStyle = b.strokeStyle = 'rgb(150, 150, 150)';
  const tilt = (rand() - 0.5) * 0.04;
  for (const ctx of [c, b]) {
    ctx.font = `500 ${size}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.035;
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(w / 2, w / 2);
    ctx.rotate(tilt);
    ctx.scale(squeeze, 1);
    ctx.fillText(item.name, 0, 0);
    ctx.strokeText(item.name, 0, 0);
    ctx.restore();
  }
  c.globalAlpha = 1;

  // Crazing: fine cracks wandering through the glaze, grooves in the relief. Dirt darkens them
  // in a pale glaze; in a deep one they catch the light.
  c.strokeStyle = deep ? 'rgba(255, 240, 220, 0.13)' : 'rgba(45, 32, 20, 0.17)';
  c.lineWidth = 0.8;
  b.strokeStyle = 'rgb(84, 84, 84)';
  b.lineWidth = 1.2;
  for (let k = 0; k < 24; k++) {
    let x = rand() * w;
    let y = rand() * w;
    let angle = rand() * Math.PI * 2;
    const points: [number, number][] = [[x, y]];
    const steps = 4 + Math.floor(rand() * 9);
    for (let s = 0; s < steps; s++) {
      angle += (rand() - 0.5) * 1.1;
      x += Math.cos(angle) * (6 + rand() * 12);
      y += Math.sin(angle) * (6 + rand() * 12);
      points.push([x, y]);
    }
    wobbly([c, b], points, rand, 0);
  }

  // Pinholes where the glaze bubbled in the kiln.
  for (let k = 0; k < 7; k++) {
    const x = rand() * w;
    const y = rand() * w;
    const r = 0.8 + rand() * 1.4;
    c.fillStyle = deep ? 'rgba(225, 205, 175, 0.35)' : 'rgba(40, 28, 18, 0.35)';
    b.fillStyle = 'rgb(60, 60, 60)';
    for (const ctx of [c, b]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // On about half of them a corner has been knocked off, down to the clay.
  if (rand() < 0.55) {
    const corner = Math.floor(rand() * 4);
    const cx = corner % 2 ? w : 0;
    const cy = corner > 1 ? w : 0;
    const sx = cx === 0 ? 1 : -1;
    const sy = cy === 0 ? 1 : -1;
    const r = w * (0.07 + rand() * 0.07);
    const edge: [number, number][] = [];
    for (let k = 0; k <= 5; k++) {
      const a = (k / 5) * (Math.PI / 2);
      const reach = r * (0.75 + rand() * 0.5);
      edge.push([cx + sx * Math.cos(a) * reach, cy + sy * Math.sin(a) * reach]);
    }
    const chip = (ctx: CanvasRenderingContext2D) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (const [x, y] of edge) ctx.lineTo(x, y);
      ctx.closePath();
    };
    c.fillStyle = clay;
    chip(c);
    c.fill();
    c.save();
    chip(c);
    c.clip();
    for (let k = 0; k < 60; k++) {
      c.fillStyle = rand() < 0.5 ? 'rgba(90, 55, 35, 0.35)' : 'rgba(255, 240, 220, 0.25)';
      c.fillRect(cx + sx * rand() * r * 1.2, cy + sy * rand() * r * 1.2, 1.5, 1.5);
    }
    c.restore();
    c.strokeStyle = 'rgba(40, 25, 15, 0.4)';
    c.lineWidth = 2;
    chip(c);
    c.stroke();
    b.fillStyle = 'rgb(70, 70, 70)';
    chip(b);
    b.fill();
    b.strokeStyle = 'rgb(40, 40, 40)';
    b.lineWidth = 2;
    chip(b);
    b.stroke();
  }
}

/**
 * The glaze's own surface, as a normal map: the slow waves it set in as it cooled, the bulb
 * coming back off it a little wavy. It ran level over the paint and filled the crazing.
 */
function paintGlaze(normal: HTMLCanvasElement, seed: number) {
  const w = normal.width;
  const ctx = normal.getContext('2d');
  if (!ctx) return;
  const rand = rng(seed + 101);
  // Heights, in pixels.
  const height = new Float32Array(w * w);
  for (let n = 0; n < 4; n++) {
    const angle = rand() * Math.PI * 2;
    const k = (2 * Math.PI * (0.8 + rand() * 1.7)) / w;
    const amp = 0.15 + 0.2 * rand();
    const phase = rand() * Math.PI * 2;
    // sin(a + b) taken apart, so each wave costs a few multiplies a pixel.
    const across = Array.from({ length: w }, (_, x) => Math.cos(angle) * k * x);
    const down = Array.from({ length: w }, (_, y) => Math.sin(angle) * k * y + phase);
    const [sinA, cosA] = [across.map(Math.sin), across.map(Math.cos)];
    const [sinB, cosB] = [down.map(Math.sin), down.map(Math.cos)];
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) height[y * w + x] += amp * (sinA[x] * cosB[y] + cosA[x] * sinB[y]);
  }
  const image = ctx.createImageData(w, w);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = height[y * w + Math.min(w - 1, x + 1)] - height[y * w + Math.max(0, x - 1)];
      // The canvas runs down; the texture's v runs up.
      const dy = height[Math.min(w - 1, y + 1) * w + x] - height[Math.max(0, y - 1) * w + x];
      const length = Math.hypot(dx, dy, 2);
      const k = (y * w + x) * 4;
      image.data[k] = 255 * (0.5 - dx / length / 2);
      image.data[k + 1] = 255 * (0.5 + dy / length / 2);
      image.data[k + 2] = 255 * (0.5 + 1 / length);
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * What the glaze sees: an equirect around the wall, three's way round (+z, toward the camera,
 * at u 0.75; up at the top). The dark of the flooded hall, the water catching the light low
 * down, and the haze lit up over the camera. The bulb itself glints off the point light,
 * where each tile is tipped to catch it (depths/choreography.ts). Linear.
 */
function surroundings(): DataTexture {
  const w = 256;
  const h = 128;
  const data = new Uint16Array(w * h * 4);
  // From the middle of the wall the bulb is up and toward the camera.
  const bulb = new Vector3(0, 1.25, 2.2).normalize();
  const dir = new Vector3();
  for (let row = 0; row < h; row++) {
    const lat = ((row + 0.5) / h - 0.5) * Math.PI;
    for (let col = 0; col < w; col++) {
      const lon = ((col + 0.5) / w - 0.5) * 2 * Math.PI;
      dir.set(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat));
      const off = dir.angleTo(bulb);
      let glow = 0.01 + 0.05 * Math.exp(-off / 0.45);
      // The water: broken bands of the bulb's light below the horizon, on the camera's side.
      if (dir.y < -0.02 && dir.z > 0) glow += 0.05 * dir.z * Math.max(0, Math.sin(lat * 40 + Math.sin(lon * 7) * 2)) * Math.exp(dir.y * 3);
      const k = (row * w + col) * 4;
      data[k] = DataUtils.toHalfFloat(glow);
      data[k + 1] = DataUtils.toHalfFloat(glow * 0.62);
      data[k + 2] = DataUtils.toHalfFloat(glow * 0.32);
      data[k + 3] = DataUtils.toHalfFloat(1);
    }
  }
  const texture = new DataTexture(data, w, h, RGBAFormat, HalfFloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** The tiles' backs: unglazed clay pressed with ribs, grout still stuck to it in grey lumps. */
function paintBack(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const rand = rng(97);
  ctx.fillStyle = '#c4977a';
  ctx.fillRect(0, 0, w, w);
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(90, 55, 35, 0.25)' : 'rgba(255, 235, 215, 0.2)';
    ctx.fillRect(rand() * w, rand() * w, 1 + rand(), 1 + rand());
  }
  ctx.strokeStyle = 'rgba(80, 50, 30, 0.35)';
  ctx.lineWidth = 3;
  for (let y = w * 0.12; y < w; y += w * 0.11) {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y);
    ctx.lineTo(w * 0.92, y);
    ctx.stroke();
  }
  for (let k = 0; k < 9; k++) {
    const x = rand() * w;
    const y = rand() * w;
    ctx.fillStyle = `rgba(${150 + rand() * 20}, ${146 + rand() * 20}, ${138 + rand() * 20}, 0.9)`;
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * w * 0.12, y + (rand() - 0.5) * w * 0.12, w * (0.02 + rand() * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

interface Tile {
  mesh: Mesh;
  face: MeshPhysicalMaterial;
  edge: MeshPhysicalMaterial;
  glaze: Color;
  /** How far it is picked, 0..1, eased. */
  picked: number;
}

/** The tiles, one per tool: a rounded slab of clay each, glazed on the face and the rims, bare at the back. */
class TileKit {
  readonly root = new Group();
  private readonly tiles: Tile[] = [];
  private readonly canvases: { color: HTMLCanvasElement; bump: HTMLCanvasElement; glaze: HTMLCanvasElement }[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly surroundings = surroundings();
  private readonly geometry = new RoundedBoxGeometry(TILE.size, TILE.size, TILE.thickness, 3, 0.012);
  private readonly backCanvas = document.createElement('canvas');
  private readonly back: MeshStandardMaterial;
  private readonly corner = new Vector3();
  /** Where on the picked tile the pointer is, -1..1 across and up, eased. */
  private readonly press = { x: 0, y: 0, toX: 0, toY: 0 };
  private hovered = -1;

  constructor() {
    this.backCanvas.width = this.backCanvas.height = 256;
    const backMap = new CanvasTexture(this.backCanvas);
    backMap.colorSpace = SRGBColorSpace;
    this.back = new MeshStandardMaterial({ map: backMap, roughness: 0.95 });
    this.textures.push(backMap);
    ITEMS.forEach((_, i) => {
      const [color, bump, glazed] = [0, 1, 2].map(() => document.createElement('canvas'));
      for (const canvas of [color, bump, glazed]) canvas.width = canvas.height = FACE;
      const map = new CanvasTexture(color);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = 4;
      const bumpMap = new CanvasTexture(bump);
      bumpMap.anisotropy = 4;
      const clearcoatNormalMap = new CanvasTexture(glazed);
      clearcoatNormalMap.anisotropy = 4;
      const { glaze } = GLAZES[i % GLAZES.length];
      // The colour lies under the glass of the glaze: it takes the light, the glass alone shines.
      const envMap = this.surroundings;
      const under = { roughness: 0.6, specularIntensity: 0, clearcoat: 1, envMap };
      const face = new MeshPhysicalMaterial({ ...under, map, bumpMap, bumpScale: 2, clearcoat: 0.7, clearcoatRoughness: 0.1, clearcoatNormalMap });
      const edge = new MeshPhysicalMaterial({ ...under, color: glaze, clearcoatRoughness: 0.14 });
      // Box faces: right, left, top, bottom, front, back.
      const mesh = new Mesh(this.geometry, [edge, edge, edge, edge, face, this.back]);
      mesh.userData.tile = i;
      this.tiles.push({ mesh, face, edge, glaze: new Color(glaze), picked: 0 });
      this.canvases.push({ color, bump, glaze: glazed });
      this.textures.push(map, bumpMap, clearcoatNormalMap);
      this.root.add(mesh);
    });
  }

  paint() {
    paintBack(this.backCanvas);
    this.canvases.forEach(({ color, bump, glaze }, i) => {
      paintFace(color, bump, ITEMS[i], i + 1);
      paintGlaze(glaze, i + 1);
    });
    for (const texture of this.textures) texture.needsUpdate = true;
  }

  /** The pointer is over tile `index`; true if it was not picked yet. */
  hover(index: number): boolean {
    const changed = index !== this.hovered;
    this.hovered = index;
    return changed;
  }

  /** Where on the picked tile the pointer is (its face's uv, 0..1). */
  aim(u: number, v: number) {
    this.press.toX = 2 * u - 1;
    this.press.toY = 2 * v - 1;
  }

  /** The pointer left the tiles; true if one was picked. */
  release(): boolean {
    const was = this.hovered >= 0;
    this.hovered = -1;
    this.press.toX = this.press.toY = 0;
    return was;
  }

  /** The tile under the pointer, or -1. */
  get picked(): number {
    return this.hovered;
  }

  update(p: number, time: number, delta: number, aspect: number) {
    for (const [i, tile] of this.tiles.entries()) tile.picked = damp(tile.picked, i === this.hovered ? 1 : 0, 9, delta);
    this.press.x = damp(this.press.x, this.press.toX, 10, delta);
    this.press.y = damp(this.press.y, this.press.toY, 10, delta);
    this.tiles.forEach((tile, i) => {
      const { position, rotation, scale } = tileState(i, this.tiles.length, p, time, aspect);
      // Picked: grown, come forward and squared up, still tipped to the light, the part under the
      // pointer pressed back a little so the glint slides over it; the others dim.
      const k = tile.picked;
      const press = i === this.hovered ? k : 0;
      tile.mesh.position.set(position[0], position[1], position[2] + TILE_HOVER.forward * k);
      tile.mesh.rotation.set(rotation[0] - PRESS * this.press.y * press, rotation[1] + PRESS * this.press.x * press, rotation[2] * (1 - k));
      tile.mesh.scale.setScalar(scale * (1 + (TILE_HOVER.grow - 1) * k));
      tile.mesh.visible = scale > 0;
      let others = 0;
      this.tiles.forEach((other, j) => {
        if (j !== i) others = Math.max(others, other.picked);
      });
      const level = 1 - DIM * others;
      tile.face.color.setScalar(level);
      tile.edge.color.copy(tile.glaze).multiplyScalar(level);
    });
  }

  /** Where the tile under the pointer is on the screen. */
  rectOf(camera: Camera, width: number, height: number): ScreenRect | null {
    if (this.hovered < 0) return null;
    const { mesh } = this.tiles[this.hovered];
    mesh.updateWorldMatrix(true, false);
    // The rig has already moved the camera this frame (Experience.tsx mounts it first), but its
    // matrices only catch up at render: without this the brackets trail the handheld sway.
    camera.updateMatrixWorld();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let k = 0; k < 8; k++) {
      this.corner.set((k & 1 ? 0.5 : -0.5) * TILE.size, (k & 2 ? 0.5 : -0.5) * TILE.size, (k & 4 ? 0.5 : -0.5) * TILE.thickness);
      this.corner.applyMatrix4(mesh.matrixWorld).project(camera);
      const x = ((this.corner.x + 1) / 2) * width;
      const y = ((1 - this.corner.y) / 2) * height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  dispose() {
    for (const texture of this.textures) texture.dispose();
    this.surroundings.dispose();
    for (const { face, edge } of this.tiles) {
      face.dispose();
      edge.dispose();
    }
    this.back.dispose();
    this.geometry.dispose();
  }
}

function tileOf(object: Object3D): number {
  const tile = object.userData.tile;
  return typeof tile === 'number' ? tile : -1;
}

function setPointer(on: boolean) {
  if (on) document.documentElement.dataset.cursor = 'pointer';
  else if (document.documentElement.dataset.cursor === 'pointer') delete document.documentElement.dataset.cursor;
}

/**
 * Stack: the tools as glazed tiles. They drift in the dark until the bulb lights, then come
 * together in a wall behind it, still floating. Hover picks one: it comes forward, presses
 * back under the pointer, rings, and the camcorder locks focus on it (ui/FocusBrackets.tsx).
 */
export function Tiles() {
  const ref = useRef<Group>(null);
  const kit = useMemo(() => new TileKit(), []);

  useEffect(() => {
    kit.paint();
    void document.fonts?.ready.then(() => kit.paint());
    return () => kit.dispose();
  }, [kit]);

  // The wall is up by then, facing the camera (depths/choreography.ts).
  const live = () => {
    const { chapter, t } = resolve(useExperience.getState().p);
    return chapter.id === 'stack' && t > TILES_UP_T - 0.05;
  };
  useChapterFrame('stack', ref);
  useFrame(({ camera, size }, delta) => {
    const { p, time } = useExperience.getState();
    kit.update(p, time, Math.min(delta, 0.1), size.width / size.height);
    // Scrolled away with a tile picked: it goes back into the wall.
    if (!live() && kit.release()) useExperience.getState().setTile(null);
    const rect = kit.rectOf(camera, size.width, size.height);
    if (rect) focusBrackets.lock(`tile-${kit.picked}`, rect);
    else focusBrackets.release('tile-');
  });

  const pick = (index: number) => {
    if (kit.hover(index)) {
      playTileTink(index);
      playFocusLock();
    }
    useExperience.getState().setTile(index);
  };
  const onOver = (event: ThreeEvent<PointerEvent>) => {
    const index = tileOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    pick(index);
    if (event.uv) kit.aim(event.uv.x, event.uv.y);
    setPointer(true);
  };
  const onMove = (event: ThreeEvent<PointerEvent>) => {
    if (tileOf(event.object) === kit.picked && event.uv) kit.aim(event.uv.x, event.uv.y);
  };
  // Nothing hovers on a touch screen: a tap picks a tile, and it stays picked once the finger
  // lifts, until a tap somewhere else.
  const onTap = (event: ThreeEvent<MouseEvent>) => {
    const index = tileOf(event.object);
    if (index < 0 || !live()) return;
    event.stopPropagation();
    pick(index);
  };
  const onOut = (event: ThreeEvent<PointerEvent>) => {
    if (tileOf(event.object) < 0 || event.pointerType === 'touch') return;
    kit.release();
    useExperience.getState().setTile(null);
    setPointer(false);
  };
  const onMissed = () => {
    if (kit.release()) useExperience.getState().setTile(null);
  };

  return (
    <group ref={ref}>
      <primitive object={kit.root} onPointerOver={onOver} onPointerMove={onMove} onPointerOut={onOut} onClick={onTap} onPointerMissed={onMissed} />
    </group>
  );
}
