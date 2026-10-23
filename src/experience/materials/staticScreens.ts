import { ShaderMaterial, UniformsLib, UniformsUtils } from 'three';

const vertexShader = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

// Hundreds of far screens: each picks its own brightness and channel noise from where it stands.
const fragmentShader = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uSurge;
uniform float uFloor;
varying vec2 vUv;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 cell = floor(vWorld.xz * 0.37 + vWorld.y * 0.21);
  float alive = step(0.35, hash(cell));
  float frame = floor(uTime * (12.0 + 12.0 * hash(cell + 3.1)));
  float noise = hash(floor(vUv * vec2(90.0, 70.0)) + frame + cell * 7.0);
  float roll = 1.0 - smoothstep(0.0, 0.1, abs(fract(vUv.y + uTime * (0.05 + 0.1 * hash(cell))) - 0.5));
  vec2 c = vUv - 0.5;
  float tube = 1.0 - smoothstep(0.3, 0.6, length(c));
  float level = max(alive * (0.15 + 0.6 * hash(cell + 9.0)), uFloor) + uSurge * 0.9;
  vec3 color = vec3(0.55, 0.85, 1.0) * (0.25 + noise * 0.75 + 0.3 * roll) * tube * level * 1.6;
  gl_FragColor = vec4(color, 1.0);
  #include <fog_fragment>
}
`;

/**
 * Far-off screens (TV towers, sunken monitors): static whose brightness and channel noise
 * come from where each screen stands, so hundreds of them share one material. uSurge
 * flashes them all at once; uFloor keeps even the dead ones faintly on.
 */
export function createStaticScreens(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    fog: true,
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 }, uSurge: { value: 0 }, uFloor: { value: 0 } }]),
  });
}
