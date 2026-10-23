import {
  type Camera,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  type MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  type Scene,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { MAX_RIPPLES, type Ripple, RIPPLE_LIFE } from './choreography';

/** Clip-space to texture-space. */
const BIAS = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
/** The mirror image is rendered at this fraction of the screen; the water blurs it anyway. */
const RESOLUTION = 0.5;

const declarations = /* glsl */ `
uniform mat4 uReflectMatrix;
varying vec4 vReflectCoord;
varying vec3 vFloorWorld;
`;

const fragmentDeclarations = /* glsl */ `
uniform sampler2D tReflect;
uniform vec2 uReflectTexel;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform float uTime;
uniform float uMirror;
varying vec4 vReflectCoord;
varying vec3 vFloorWorld;

// Slope of the water: a faint breeze everywhere, and rings where drips land.
vec2 waterSlope(vec2 p) {
  vec2 slope = 0.006 * vec2(sin(p.x * 2.3 + uTime * 0.9) + sin(p.y * 3.1 - uTime * 0.7), cos(p.y * 2.7 + uTime * 0.8) + cos(p.x * 1.9 - uTime * 1.1));
  for (int k = 0; k < ${MAX_RIPPLES}; k++) {
    vec4 r = uRipples[k];
    vec2 d = p - r.xy;
    float dist = length(d) + 1e-4;
    float x = dist - r.z * 0.55;
    // A packet of rings running outward, spreading thinner as it goes.
    float envelope = exp(-x * x / (0.015 + 0.05 * r.z)) * r.w;
    slope += (d / dist) * cos(x * 30.0) * envelope * 0.22;
  }
  return slope;
}
`;

const rippleNormal = /* glsl */ `
#include <normal_fragment_maps>
vec2 water = waterSlope(vFloorWorld.xz);
normal = normalize(normal - (viewMatrix * vec4(water.x, 0.0, water.y, 0.0)).xyz);
`;

const mirrorMix = /* glsl */ `
vec3 floorNormal = inverseTransformDirection(normal, viewMatrix);
vec3 toEye = normalize(cameraPosition - vFloorWorld);
vec2 reflectUv = vReflectCoord.xy / vReflectCoord.w + floorNormal.xz * 0.06;
// Where the concrete is rough the water film is thinnest: the mirror goes soft there.
float blur = mix(0.5, 4.0, smoothstep(0.35, 0.95, roughnessFactor));
vec2 spread = uReflectTexel * exp2(blur);
vec3 mirrored = 0.25 * (
  textureLod(tReflect, reflectUv + vec2(spread.x, spread.y * 0.5), blur).rgb +
  textureLod(tReflect, reflectUv + vec2(-spread.x * 0.5, spread.y), blur).rgb +
  textureLod(tReflect, reflectUv + vec2(-spread.x, -spread.y * 0.5), blur).rgb +
  textureLod(tReflect, reflectUv + vec2(spread.x * 0.5, -spread.y), blur).rgb);
float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(toEye, floorNormal), 0.0, 1.0), 5.0);
outgoingLight = outgoingLight * (1.0 - fresnel) + mirrored * fresnel * uMirror;
#include <opaque_fragment>
`;

/**
 * Concrete under a film of still water: the floor's own material, plus a planar mirror
 * of the scene, rippling where drips land. The mirror image is rendered only when the
 * floor itself is drawn (from its onBeforeRender), so it costs nothing off screen.
 */
export class WetFloor {
  readonly material: MeshStandardMaterial;
  private readonly target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
  });
  private readonly mirror = new PerspectiveCamera();
  private readonly uniforms = {
    tReflect: { value: this.target.texture },
    uReflectTexel: { value: new Vector2(1, 1) },
    uReflectMatrix: { value: new Matrix4() },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4()) },
    uTime: { value: 0 },
    uMirror: { value: 1.4 },
  };
  private readonly plane: Plane;
  private readonly size = new Vector2();
  // Scratch, reused every frame.
  private readonly eye = new Vector3();
  private readonly look = new Vector3();
  private readonly offset = new Vector3();
  private readonly rotation = new Matrix4();
  private readonly clip = new Vector4();
  private readonly q = new Vector4();
  private readonly viewPlane = new Plane();

  constructor(source: MeshStandardMaterial, height: number) {
    this.plane = new Plane(new Vector3(0, 1, 0), -height);
    this.material = source.clone();
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = declarations + shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvReflectCoord = uReflectMatrix * vec4(vFloorWorld, 1.0);',
      );
      shader.fragmentShader = (fragmentDeclarations + shader.fragmentShader)
        .replace('#include <normal_fragment_maps>', rippleNormal)
        .replace('#include <opaque_fragment>', mirrorMix);
    };
    this.material.customProgramCacheKey = () => 'wet-floor';
  }

  /** Drips on the water now: newest first, as many as the shader has room for. */
  update(time: number, ripples: Ripple[], mirror: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uMirror.value = mirror;
    this.uniforms.uRipples.value.forEach((slot, k) => {
      const r = ripples[k];
      if (!r) slot.set(0, 0, 0, 0);
      else slot.set(r.x, r.z, r.age, (1 - r.age / RIPPLE_LIFE) ** 2);
    });
  }

  /**
   * Renders the scene mirrored in the water plane, seen from `camera`, into the floor's
   * reflection (after three's Reflector: a mirrored camera with an oblique near plane on the water).
   */
  reflect(renderer: WebGLRenderer, scene: Scene, camera: Camera, floor: { visible: boolean }) {
    // A pass drawing depth or normals for the whole scene does not need the mirror.
    if (scene.overrideMaterial) return;
    renderer.getDrawingBufferSize(this.size).multiplyScalar(RESOLUTION).floor();
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target.setSize(Math.max(1, this.size.x), Math.max(1, this.size.y));
      this.uniforms.uReflectTexel.value.set(1 / Math.max(1, this.size.x), 1 / Math.max(1, this.size.y));
    }

    const normal = this.plane.normal;
    const eye = this.eye.setFromMatrixPosition(camera.matrixWorld);
    if (this.plane.distanceToPoint(eye) <= 0) return;
    this.rotation.extractRotation(camera.matrixWorld);
    this.look.set(0, 0, -1).applyMatrix4(this.rotation).add(eye);
    const mirror = this.mirror;
    mirror.position.copy(eye).sub(this.offset.copy(normal).multiplyScalar(2 * this.plane.distanceToPoint(eye)));
    this.look.sub(this.offset.copy(normal).multiplyScalar(2 * this.plane.distanceToPoint(this.look)));
    mirror.up.set(0, 1, 0).applyMatrix4(this.rotation).reflect(normal);
    mirror.lookAt(this.look);
    mirror.far = (camera as PerspectiveCamera).far;
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);

    this.uniforms.uReflectMatrix.value.copy(BIAS).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

    // Oblique near plane on the water, so nothing below it ends up in the mirror
    // (Lengyel, "Oblique View Frustum Depth Projection and Clipping").
    this.viewPlane.copy(this.plane).applyMatrix4(mirror.matrixWorldInverse);
    const clip = this.clip.set(this.viewPlane.normal.x, this.viewPlane.normal.y, this.viewPlane.normal.z, this.viewPlane.constant);
    const projection = mirror.projectionMatrix.elements;
    this.q.set(
      (Math.sign(clip.x) + projection[8]) / projection[0],
      (Math.sign(clip.y) + projection[9]) / projection[5],
      -1,
      (1 + projection[10]) / projection[14],
    );
    clip.multiplyScalar(2 / clip.dot(this.q));
    projection[2] = clip.x;
    projection[6] = clip.y;
    projection[10] = clip.z + 1 - 0.003;
    projection[14] = clip.w;

    floor.visible = false;
    const previousTarget = renderer.getRenderTarget();
    const xr = renderer.xr.enabled;
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.state.buffers.depth.setMask(true);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(scene, mirror);
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = shadows;
    renderer.setRenderTarget(previousTarget);
    floor.visible = true;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
  }
}
