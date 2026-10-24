import { Color, DoubleSide, Matrix4, ShaderMaterial, type Texture, UniformsLib, UniformsUtils, Vector2, Vector3 } from 'three';
import { BOOTH } from './layout';
import { SHEET_FALL } from './projector';

/**
 * Shared by the sheet and the beam: the gate's opening (a rectangle with rounded corners,
 * its edge as soft as the focus) and the dirt caught in it, a hair and a few specks that
 * stay put while the slides change. `uv` is the picture's, 0..1, 3:2.
 */
export const GATE_GLSL = /* glsl */ `
float gateOpening(vec2 uv, float soft) {
  vec2 p = (uv - 0.5) * vec2(1.5, 1.0);
  vec2 d = abs(p) - vec2(0.75 - 0.028, 0.5 - 0.028);
  float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - 0.028;
  return 1.0 - smoothstep(-soft, soft, dist);
}

const vec3 SPECKS[5] = vec3[5](
  vec3(0.83, 0.16, 0.006),
  vec3(0.12, 0.74, 0.004),
  vec3(0.64, 0.88, 0.003),
  vec3(0.91, 0.62, 0.005),
  vec3(0.33, 0.07, 0.0035)
);

float gateDirt(vec2 uv, float soft) {
  float clear = 1.0;
  // A hair curling in from the lower left corner.
  float s = (uv.x - 0.035) / 0.17;
  float wave = 0.1 + 0.034 * sin(s * 7.0 + 0.6) + 0.025 * s;
  float slope = 1.4 * cos(s * 7.0 + 0.6) + 0.15;
  float hair = abs(uv.y - wave) / sqrt(1.0 + slope * slope);
  float onHair = step(0.0, s) * step(s, 1.0);
  clear *= 1.0 - 0.8 * onHair * (1.0 - smoothstep(0.0011, 0.0011 + soft, hair));
  for (int i = 0; i < 5; i++) {
    vec3 speck = SPECKS[i];
    float d = length((uv - speck.xy) * vec2(1.5, 1.0));
    clear *= 1.0 - 0.7 * (1.0 - smoothstep(speck.z * 0.4, speck.z + soft, d));
  }
  return clear;
}
`;

const vertexShader = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uDrop;
uniform float uFall;
uniform float uFloor;
uniform float uTime;
uniform vec2 uSize;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

// Where a point of the sheet (hanging at \`hung\`, at \`uv\` across it) is once the rope has gone.
// The left end comes down first (projector.ts sheetFall); in the air the cloth billows and
// folds; what reaches the floor heaps up and spreads back into the booth.
vec3 fallen(vec3 hung, vec2 uv) {
  float fall = clamp(uDrop * 1.25 - 0.25 * uv.x, 0.0, 1.0);
  vec3 p = hung;
  p.y -= fall * uFall;
  float rest = uFloor + 0.012;
  float over = max(0.0, rest - p.y);
  float heap = 1.0 - exp(-over * 2.4);
  float lumps = (0.55 + 0.45 * sin(uv.x * 23.0 + uv.y * 17.0)) * (0.6 + 0.4 * sin(over * 13.0));
  p.y = max(p.y, rest) + 0.07 * heap * lumps;
  p.z += 0.42 * heap + 0.035 * sin(over * 16.0 + uv.x * 6.0) * smoothstep(0.0, 0.1, over);
  p.x += 0.04 * heap * sin(uv.y * 11.0 + uv.x * 4.0);
  float air = 4.0 * fall * (1.0 - fall) * (1.0 - smoothstep(0.0, 0.03, over));
  // The air pushes the middle back as it drops, and the slack cloth folds up and down its length.
  p.z += air * (0.16 * sin(PI * uv.x) * sin(PI * clamp(uv.y + 0.15, 0.0, 1.0)) + 0.05 * sin(uv.x * 17.0 + uTime * 3.0 + uv.y * 2.0));
  p.x += air * 0.03 * sin(uv.y * 9.0 + uTime * 2.0);
  // The top edge sags between the pegs once the rope is slack.
  p.y -= air * 0.05 * (1.0 - uv.y) * (0.5 - 0.5 * cos(uv.x * 2.0 * PI * 4.0));
  return p;
}

void main() {
  vUv = uv;
  vec3 hung = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 world = fallen(hung, uv);
  // The fallen shape's own normal, from two neighbours across and down the cloth: the sheet's
  // folds as it hangs stay on top of it.
  float nudge = 0.01;
  vec3 across = fallen(hung + vec3(nudge * uSize.x, 0.0, 0.0), uv + vec2(nudge, 0.0)) - world;
  vec3 down = fallen(hung - vec3(0.0, nudge * uSize.y, 0.0), uv + vec2(0.0, nudge)) - world;
  vec3 shape = normalize(cross(down, across));
  if (dot(shape, n) < 0.0) shape = -shape;
  vec3 plane = n.z < 0.0 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 0.0, 1.0);
  vNormal = normalize(n - plane + shape);
  vWorld = world;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// An old cotton sheet taking the slide from the lens: the folds turn toward or away from the
// light, the weave shows through it, and the room's glow keeps it from going black between slides.
const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uSlide;
uniform sampler2D uWeave;
uniform mat4 uProjector;
uniform vec3 uLens;
uniform vec3 uLight;
uniform vec3 uAmbient;
uniform float uFocus;
uniform float uGate;
uniform float uThrow;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;

${GATE_GLSL}

const vec3 CLOTH = vec3(0.74, 0.71, 0.66);

// The weave as a normal, three's perturbNormal2Arb without stored tangents.
vec3 weave(vec3 n) {
  vec2 uv = vUv * vec2(5.0, 3.5);
  vec3 dp1 = dFdx(vWorld);
  vec3 dp2 = dFdy(vWorld);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, n);
  vec3 dp1perp = cross(n, dp1);
  vec3 t = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 b = dp2perp * duv1.y + dp1perp * duv2.y;
  float scale = inversesqrt(max(max(dot(t, t), dot(b, b)), 1e-12));
  vec3 m = texture2D(uWeave, uv).xyz * 2.0 - 1.0;
  m.xy *= 0.55;
  return normalize(mat3(t * scale, b * scale, n) * m);
}

// The slide out of focus: a disc of taps on a blurrier mip, round on the sheet.
vec3 slide(vec2 uv, float blur) {
  float bias = log2(max(1.0, blur * 1024.0)) - 0.5;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / 8.0) * blur;
    sum += texture2D(uSlide, uv + vec2(cos(a), sin(a) * 1.5) * r, bias).rgb;
  }
  return sum / 8.0;
}

void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  n = weave(n);
  vec4 clip = uProjector * vec4(vWorld, 1.0);
  vec2 ndc = clip.xy / max(clip.w, 1e-4);
  vec2 uv = ndc * 0.5 + 0.5;
  float blur = (1.0 - uFocus) * 0.018;
  float soft = 0.0015 + blur * 0.6;
  // Still dropping into the gate, the slide throws its picture low (the lens turns it over).
  vec3 picture = slide(uv + vec2(0.0, uGate), blur) * gateOpening(uv, soft) * gateDirt(uv, soft) * step(0.0, clip.w);
  // Brightest in the middle of the throw, like every projector.
  float hot = 1.0 - 0.22 * dot(ndc, ndc);
  vec3 toLens = uLens - vWorld;
  float d = length(toLens);
  float facing = max(dot(n, toLens / d), 0.0);
  vec3 lamp = uLight * picture * hot * facing * (uThrow * uThrow) / (d * d);
  vec3 color = CLOTH * (lamp + uAmbient * (0.55 + 0.45 * max(n.z, 0.0)));
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
}
`;

/** The sheet's material: the slide thrown on it from the lens (projector.ts), and its fall. */
export function createSheetMaterial(slide: Texture, weave: Texture | null): ShaderMaterial {
  const lens = new Vector3(...BOOTH.lens);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    fog: true,
    side: DoubleSide,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uSlide: { value: null },
        uWeave: { value: null },
        uProjector: { value: new Matrix4() },
        uLens: { value: lens },
        uLight: { value: new Color(0, 0, 0) },
        uAmbient: { value: new Color(0, 0, 0) },
        uFocus: { value: 1 },
        uGate: { value: 0 },
        uThrow: { value: lens.distanceTo(new Vector3(...BOOTH.sheet.center)) },
        uDrop: { value: 0 },
        uFall: { value: SHEET_FALL },
        uFloor: { value: BOOTH.floorY },
        uTime: { value: 0 },
        uSize: { value: new Vector2(BOOTH.sheet.width, BOOTH.sheet.height) },
      },
    ]),
  });
  // merge() clones uniform values; textures must stay shared, so set them afterwards.
  material.uniforms.uSlide.value = slide;
  material.uniforms.uWeave.value = weave;
  return material;
}
