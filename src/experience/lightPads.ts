import { DirectionalLight, Group, HemisphereLight, type Light, type Object3D, PointLight, RectAreaLight, SpotLight } from 'three';

/**
 * The kinds of light three.js counts when it builds a material's shader: each material
 * gets a program for exactly so many point lights, so many spots, and so on.
 */
export type LightKind = 'point' | 'spot' | 'directional' | 'hemisphere' | 'rectArea';

export function lightKind(light: Light): LightKind | null {
  if ((light as PointLight).isPointLight) return 'point';
  if ((light as SpotLight).isSpotLight) return 'spot';
  if ((light as DirectionalLight).isDirectionalLight) return 'directional';
  if ((light as HemisphereLight).isHemisphereLight) return 'hemisphere';
  if ((light as RectAreaLight).isRectAreaLight) return 'rectArea';
  return null;
}

/** Name of the stand-ins' group, so the warm-up can leave them out. */
export const LIGHT_PADS = 'LightPads';

/** Far above the world: spots and suns aim at the origin from here, never at their own position. */
const PARKED_Y = 1000;

function standIn(kind: LightKind): Light {
  const light =
    kind === 'point'
      ? new PointLight('#000000', 0)
      : kind === 'spot'
        ? new SpotLight('#000000', 0)
        : kind === 'directional'
          ? new DirectionalLight('#000000', 0)
          : kind === 'hemisphere'
            ? new HemisphereLight('#000000', '#000000', 0)
            : new RectAreaLight('#000000', 0);
  light.position.set(0, PARKED_Y, 0);
  light.visible = false;
  return light;
}

/** Whether the renderer reaches `object`: it and every parent are visible. */
function shown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Unlit stand-ins for the chapters' lights. Every chapter hides its group, lights included,
 * when it is out of range, so the number of lights of each kind changed at every chapter
 * overlap and three.js rebuilt the shader of everything on screen (a freeze of a few hundred
 * milliseconds). For each light that is hidden, a stand-in of its kind is shown instead,
 * so the counts never change and each material is compiled once.
 */
export class LightPads {
  readonly root = new Group();
  private lights: { light: Light; kind: LightKind }[] = [];
  private pads = new Map<LightKind, Light[]>();

  constructor() {
    this.root.name = LIGHT_PADS;
  }

  /** Finds every light in `scene` (call once they all exist) and makes one stand-in for each. */
  collect(scene: Object3D) {
    this.root.clear();
    this.pads.clear();
    this.lights = [];
    scene.traverse((object) => {
      const kind = (object as Light).isLight ? lightKind(object as Light) : null;
      if (!kind || this.isStandIn(object)) return;
      this.lights.push({ light: object as Light, kind });
      const pad = standIn(kind);
      this.root.add(pad);
      this.pads.set(kind, [...(this.pads.get(kind) ?? []), pad]);
    });
  }

  /** Shows as many stand-ins of each kind as there are lights of that kind hidden this frame. */
  balance() {
    const hidden = new Map<LightKind, number>();
    for (const { light, kind } of this.lights) {
      if (!shown(light)) hidden.set(kind, (hidden.get(kind) ?? 0) + 1);
    }
    for (const [kind, pads] of this.pads) {
      const count = hidden.get(kind) ?? 0;
      pads.forEach((pad, i) => (pad.visible = i < count));
    }
  }

  private isStandIn(object: Object3D): boolean {
    for (let o: Object3D | null = object; o; o = o.parent) if (o === this.root) return true;
    return false;
  }
}
