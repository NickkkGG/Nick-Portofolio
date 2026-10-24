import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type MeshStandardMaterial,
  Path,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mulberry32 } from '@/lib/random';

/**
 * The room's floor slab as the camera drops out of it: the underside, the broken edge round the
 * hole the figure went through, rebar poking out. The room stands on top (room.py: x -3..3,
 * z -1.18..3) and draws only the upper face of its floor. World metres.
 */
export const SLAB = {
  thickness: 0.2,
  /** A little past the room's walls, the way a floor runs on under them. */
  x: [-3.3, 3.3],
  z: [-1.48, 3.3],
  /** Where the floor gave way: under the chair, wide enough for the figure and the camera after it. */
  hole: { center: [0.17, 0.36], radius: 1 },
} as const;

/** Metres per repeat of the concrete textures (depths.py: Concrete and ConcreteInner). */
const TILE = { face: 1.2, broken: 0.6 };

/** The hole's ragged edge, (x, z) round it: a lumpy circle with three cracks run out into the floor. */
export function holeOutline(): [number, number][] {
  const rand = mulberry32(5);
  const count = 40;
  const rough = Array.from({ length: count }, () => rand() - 0.5);
  const cracks = new Set([5, 17, 26]);
  const [cx, cz] = SLAB.hole.center;
  return rough.map((_, i) => {
    const lump = (rough[(i + count - 1) % count] + 2 * rough[i] + rough[(i + 1) % count]) / 4;
    const r = SLAB.hole.radius * (1 + 0.35 * lump + (cracks.has(i) ? 0.3 : 0));
    const a = (i / count) * Math.PI * 2;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });
}

/** The underside, facing down, with the hole cut out of it. */
export function undersideGeometry(outline: [number, number][]): BufferGeometry {
  const [x0, x1] = SLAB.x;
  const [z0, z1] = SLAB.z;
  const shape = new Shape([new Vector2(x0, z0), new Vector2(x1, z0), new Vector2(x1, z1), new Vector2(x0, z1)]);
  shape.holes.push(new Path(outline.map(([x, z]) => new Vector2(x, z))));
  const geometry = new ShapeGeometry(shape);
  // The shape's x, y become world x, z, and its face turns to look down.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, -SLAB.thickness, 0);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE.face, uv.getY(i) / TILE.face);
  return geometry;
}

/**
 * The slab's concrete. Its underside and broken edges hardly face the lights and would read as
 * black cut-outs: the light pouring through the hole catches in the dust and falls back on the
 * concrete round it, and further out only the teal of the world below reaches it. Both are let
 * into the concrete itself, through its own colours.
 */
export function slabMaterial(concrete: MeshStandardMaterial): MeshStandardMaterial {
  const material = concrete.clone();
  material.emissive.set('#ffffff');
  material.emissiveMap = material.map;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uHole: { value: new Vector2(...SLAB.hole.center) },
      uRadius: { value: SLAB.hole.radius },
      uSpill: { value: new Color('#e6cfae').multiplyScalar(0.55) },
      uVoid: { value: new Color('#4d7d80').multiplyScalar(0.12) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uHole;\nuniform float uRadius;\nuniform vec3 uSpill;\nuniform vec3 uVoid;\nvarying vec2 vFloor;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float near = exp(-1.6 * max(distance(vFloor, uHole) - uRadius, 0.0));
        totalEmissiveRadiance *= uVoid + uSpill * near;`,
      );
  };
  return material;
}

/** A band of quads from the floor down to the underside along `points`, each facing the way `facing` points from its middle. */
function band(points: [number, number][], closed: boolean, facing: (mid: [number, number]) => [number, number]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const t = SLAB.thickness;
  let along = 0;
  const edges = closed ? points.length : points.length - 1;
  for (let i = 0; i < edges; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[(i + 1) % points.length];
    const length = Math.hypot(bx - ax, bz - az);
    let nx = -(bz - az) / length;
    let nz = (bx - ax) / length;
    const [fx, fz] = facing([(ax + bx) / 2, (az + bz) / 2]);
    if (nx * fx + nz * fz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const u0 = along / TILE.broken;
    const u1 = (along + length) / TILE.broken;
    const v = t / TILE.broken;
    positions.push(ax, 0, az, bx, 0, bz, bx, -t, bz, ax, 0, az, bx, -t, bz, ax, -t, az);
    for (let k = 0; k < 6; k++) normals.push(nx, 0, nz);
    uvs.push(u0, 0, u1, 0, u1, v, u0, 0, u1, v, u0, v);
    along += length;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** The broken edge round the hole, facing into it. */
export function rimGeometry(outline: [number, number][]): BufferGeometry {
  const [cx, cz] = SLAB.hole.center;
  return band(outline, true, ([x, z]) => [cx - x, cz - z]);
}

/** The slab's outer edge, facing out. */
export function edgeGeometry(): BufferGeometry {
  const [x0, x1] = SLAB.x;
  const [z0, z1] = SLAB.z;
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  return band(
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    true,
    ([x, z]) => [x - cx, z - cz],
  );
}

/** Bars snapped with the floor, sticking out of the broken edge into the hole and bent down by the fall. */
export function rebarGeometries(outline: [number, number][]): BufferGeometry[] {
  const rand = mulberry32(9);
  const [cx, cz] = SLAB.hole.center;
  const bars: BufferGeometry[] = [];
  for (let i = 2; i < outline.length; i += 5) {
    const [x, z] = outline[i];
    const inward = new Vector3(cx - x, 0, cz - z).normalize();
    const reach = 0.12 + rand() * 0.25;
    const y = -SLAB.thickness * (0.3 + 0.4 * rand());
    const start = new Vector3(x, y, z).addScaledVector(inward, -0.05);
    const bend = start.clone().addScaledVector(inward, reach * 0.6);
    const end = start.clone().addScaledVector(inward, reach).add(new Vector3(0, -reach * (0.3 + rand() * 0.6), 0));
    bars.push(new TubeGeometry(new QuadraticBezierCurve3(start, bend, end), 8, 0.009, 5));
  }
  return bars;
}
