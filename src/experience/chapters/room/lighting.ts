import { Color, type MeshStandardMaterial, type Texture } from 'three';

/**
 * Lighting shared by every baked surface in the room, updated once per frame.
 * Colours are linear and already include the light's brightness.
 */
export const roomLight = {
  /** Moonlight and night sky through the window. */
  uBaseColor: { value: new Color(1, 1, 1) },
  /** The desk lamp: its colour times the flicker. */
  uLampColor: { value: new Color(0, 0, 0) },
  /** The monitor's glow. */
  uScreenColor: { value: new Color(0, 0, 0) },
  /** A faint lift so the darkest corners never crush to pure black (bake units). */
  uAmbient: { value: new Color(0, 0, 0) },
  uTime: { value: 0 },
};

export interface AtlasMaps {
  base: Texture;
  lamp: Texture;
  screen: Texture;
  /** The bake's encoding scales: texel 1.0 means this much light. */
  scale: { base: number; lamp: number; screen: number };
}

export type Sway = 'none' | 'triangle' | 'quad';

const SWAY_SHAPE: Record<Sway, string> = {
  none: '0.0',
  // Pinned along the card's edges, billowing most in the middle.
  triangle: 'clamp(27.0 * uv.x * uv.y * (1.0 - uv.x - uv.y), 0.0, 1.0)',
  quad: '16.0 * uv.x * (1.0 - uv.x) * uv.y * (1.0 - uv.y)',
};

/**
 * Turns a glTF material into a baked-light material: diffuse light comes only from the
 * three lightmaps (mixed live, so the lamp can flicker and change colour), the probe
 * only adds reflections, and real-time lights only add highlights.
 */
export function bakeLighting(material: MeshStandardMaterial, maps: AtlasMaps, sway: Sway = 'none'): MeshStandardMaterial {
  const baked = material.clone();
  baked.lightMap = maps.base;
  // The base map is mixed in below with everything else; three's own lightmap term stays off.
  baked.lightMapIntensity = 0;
  baked.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, roomLight, {
      uLampMap: { value: maps.lamp },
      uScreenMap: { value: maps.screen },
      uScales: { value: [maps.scale.base, maps.scale.lamp, maps.scale.screen] },
    });
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uBaseColor;
uniform vec3 uLampColor;
uniform vec3 uScreenColor;
uniform vec3 uAmbient;
uniform sampler2D uLampMap;
uniform sampler2D uScreenMap;
uniform float uScales[3];`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
// Baked diffuse light (white albedo) -> irradiance three.js expects: x PI.
irradiance += PI * (
  uBaseColor * texture2D(lightMap, vLightMapUv).rgb * uScales[0] +
  uLampColor * texture2D(uLampMap, vLightMapUv).rgb * uScales[1] +
  uScreenColor * texture2D(uScreenMap, vLightMapUv).rgb * uScales[2] +
  uAmbient
);
// The bake already holds the bounce light; the probe only reflects.
iblIrradiance = vec3(0.0);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
reflectedLight.directDiffuse = vec3(0.0);`,
      );
    if (sway !== 'none') {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
// Draughts from the window keep the old webs breathing.
float sway = ${SWAY_SHAPE[sway]};
transformed += objectNormal * sway * 0.018 * (sin(uTime * 0.9 + position.x * 3.1) * 0.6 + sin(uTime * 2.3 + position.z * 4.7) * 0.4);`,
        );
    }
  };
  baked.customProgramCacheKey = () => `room-baked-${sway}`;
  return baked;
}
