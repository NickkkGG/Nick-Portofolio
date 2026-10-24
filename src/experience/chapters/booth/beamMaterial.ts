import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Frustum,
  Matrix4,
  type PerspectiveCamera,
  ShaderMaterial,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { BOOTH } from './layout';
import { GATE_GLSL } from './sheetMaterial';

const vertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/*
 * The projector's light in the dusty air, traced through the beam: along the camera's ray,
 * between where it enters and leaves the projector's frustum, each step adds the light the
 * slide lets through at that point. So the letters throw their own rays through the dust.
 * The sheet stops the light; once it is down, only the window lets it out, as far as the
 * first monitor. Drawn additively on the frustum's faces: the near side from outside the
 * beam, the far side from inside it.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D uSlide;
uniform mat4 uProjector;
uniform vec4 uPlanes[6];
uniform vec3 uLens;
uniform vec3 uLight;
uniform float uDensity;
uniform float uGate;
uniform float uTime;
uniform float uInside;
uniform float uSheetZ;
uniform vec2 uSheetSpan;
uniform vec2 uSheetTop;
uniform float uWallZ;
uniform vec4 uWindow;
uniform float uEndZ;
varying vec3 vWorld;

${GATE_GLSL}

const int STEPS = 16;

float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// The stretch of the ray (from o along d) inside the frustum, three's planes facing in.
vec2 chord(vec3 o, vec3 d) {
  float near = 0.0;
  float far = 1e4;
  for (int i = 0; i < 6; i++) {
    float dist = dot(uPlanes[i].xyz, o) + uPlanes[i].w;
    float rate = dot(uPlanes[i].xyz, d);
    if (abs(rate) < 1e-6) {
      if (dist < 0.0) far = -1.0;
      continue;
    }
    float t = -dist / rate;
    if (rate > 0.0) near = max(near, t);
    else far = min(far, t);
  }
  return vec2(near, far);
}

// Whether the lens's light gets to p: the hanging sheet stops it, past the wall only the window lets it through.
float reaches(vec3 p) {
  vec3 ray = p - uLens;
  if (p.z < uSheetZ) {
    vec3 q = uLens + ray * ((uSheetZ - uLens.z) / ray.z);
    float across = clamp((q.x - uSheetSpan.x) / (uSheetSpan.y - uSheetSpan.x), 0.0, 1.0);
    if (q.x > uSheetSpan.x && q.x < uSheetSpan.y && q.y < mix(uSheetTop.x, uSheetTop.y, across)) return 0.0;
  }
  if (p.z < uWallZ) {
    vec3 q = uLens + ray * ((uWallZ - uLens.z) / ray.z);
    if (abs(q.x - uWindow.x) > uWindow.z || abs(q.y - uWindow.y) > uWindow.w) return 0.0;
  }
  return smoothstep(uEndZ, uEndZ + 0.5, p.z);
}

void main() {
  if (gl_FrontFacing == (uInside > 0.5)) discard;
  vec3 eye = cameraPosition;
  vec3 dir = normalize(vWorld - eye);
  vec2 span = chord(eye, dir);
  if (span.y <= span.x) discard;
  float stepLength = (span.y - span.x) / float(STEPS);
  float jitter = ign(gl_FragCoord.xy);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    float t = span.x + (float(i) + jitter) * stepLength;
    vec3 p = eye + dir * t;
    vec4 clip = uProjector * vec4(p, 1.0);
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    vec3 light = textureLod(uSlide, uv + vec2(0.0, uGate), 2.5).rgb * gateOpening(uv, 0.01);
    // The eye takes the haze in less than the light that makes it: a dark slide still shows its
    // cone, and the bare gate does not fill the booth with fog.
    light = light / (0.35 + light);
    // The light spreads with the cone, so it is thickest near the lens.
    float spread = 1.0 / (0.25 + dot(p - uLens, p - uLens));
    float dust = 0.7 + 0.3 * sin(p.x * 9.0 + uTime * 0.4) * sin(p.y * 7.0 - uTime * 0.3 + p.z * 5.0);
    // Flying through the beam never whites out the lens.
    float near = smoothstep(0.15, 0.9, t);
    sum += light * min(spread, 3.0) * dust * near * reaches(p);
  }
  gl_FragColor = vec4(uLight * sum * stepLength * uDensity, 1.0);
}
`;

/** The beam's frustum as a closed mesh, from just in front of the lens out to the far plane. */
export function beamGeometry(projector: PerspectiveCamera): BufferGeometry {
  const corners = [-1, 1].flatMap((z) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, y]) => new Vector3(x, y, z).unproject(projector)),
  );
  // Near quad 0..3, far quad 4..7, each counter-clockwise as the lens sees it; triangles wound to face out.
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const positions: number[] = [];
  for (const [a, b, c, d] of quads) {
    for (const i of [a, c, b, a, d, c]) positions.push(...corners[i].toArray());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The beam's material: `projector` is projector.ts's camera, `slide` the reel's texture. */
export function createBeamMaterial(projector: PerspectiveCamera, slide: Texture): ShaderMaterial {
  const viewProjection = new Matrix4().multiplyMatrices(projector.projectionMatrix, projector.matrixWorldInverse);
  const planes = new Frustum().setFromProjectionMatrix(viewProjection).planes.map((plane) => new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant));
  const { window } = BOOTH;
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: {
      uSlide: { value: slide },
      uProjector: { value: viewProjection },
      uPlanes: { value: planes },
      uLens: { value: projector.position.clone() },
      uLight: { value: new Color(0, 0, 0) },
      uDensity: { value: 1 },
      uGate: { value: 0 },
      uTime: { value: 0 },
      uInside: { value: 0 },
      uSheetZ: { value: BOOTH.sheet.center[2] },
      uSheetSpan: { value: new Vector2(BOOTH.sheet.center[0] - BOOTH.sheet.width / 2, BOOTH.sheet.center[0] + BOOTH.sheet.width / 2) },
      uSheetTop: { value: new Vector2() },
      uWallZ: { value: BOOTH.frontZ },
      uWindow: { value: new Vector4(window.center[0], window.center[1], window.width / 2, window.height / 2) },
      uEndZ: { value: 0 },
    },
  });
  return material;
}
