/**
 * Analog-horror tape look (spec §3.12): CRT bulge, rolling tracking band, chroma
 * bleed (sharp luma, smeared YIQ chroma; not an RGB split), scanlines, grain,
 * vignette, and a blackout fade. Runs inside a postprocessing EffectPass, which
 * provides inputBuffer, resolution and texelSize.
 *
 * The tape records the picture after the tone curve, as a camcorder would. Smeared
 * before it, in linear HDR, a bright bulb's chroma swamped the dark beside it and
 * printed a hard red ghost on its right edge.
 */
export const vhsFragment = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uFade;
uniform float uExposure;

// Filmic tone curve (Narkowicz ACES fit): bright lamps and screens roll off softly
// instead of clipping, and exposure lifts the dark rooms without flattening them.
vec3 acesFilm(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 rgbToYiq(vec3 c) {
  return vec3(
    dot(c, vec3(0.299, 0.587, 0.114)),
    dot(c, vec3(0.596, -0.274, -0.322)),
    dot(c, vec3(0.211, -0.523, 0.312))
  );
}

vec3 yiqToRgb(vec3 c) {
  return vec3(
    c.x + 0.956 * c.y + 0.621 * c.z,
    c.x - 0.272 * c.y - 0.647 * c.z,
    c.x - 1.106 * c.y + 1.703 * c.z
  );
}

// What the tape sees at uv: the frame after exposure and the tone curve.
vec3 tapeSignal(vec2 uv) {
  return acesFilm(texture2D(inputBuffer, uv).rgb * uExposure);
}

// The CRT bulge is computed here instead of as a UV-transform hook: postprocessing
// does not allow an effect that both transforms UVs and samples neighbouring pixels,
// and it detects such hooks by name anywhere in this source, comments included.
vec2 crtWarp(vec2 uv) {
  vec2 c = uv - 0.5;
  float k = 0.035 * (0.5 + uIntensity);
  return 0.5 + c * (1.0 + k * dot(c, c));
}

void mainImage(const in vec4 inputColor, const in vec2 screenUv, out vec4 outputColor) {
  vec2 uv = crtWarp(screenUv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outputColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float bandY = fract(uTime * 0.07);
  float band = (1.0 - smoothstep(0.0, 0.06, abs(uv.y - bandY))) * uIntensity;
  float shift = (hash(vec2(floor(uv.y * 240.0), floor(uTime * 24.0))) - 0.5) * 0.02 * band;
  vec2 sampleUv = vec2(uv.x + shift, uv.y);

  vec3 own = rgbToYiq(tapeSignal(sampleUv));
  float luma = own.x;
  vec2 chroma = own.yz;
  float spacing = (1.5 + 4.0 * uIntensity) * texelSize.x;
  for (int i = 1; i < 5; i++) {
    chroma += rgbToYiq(tapeSignal(sampleUv - vec2(float(i) * spacing, 0.0))).yz;
  }
  chroma /= 5.0;
  // Colour bleeds across the edges of lit things, but never lights up the dark beside
  // them: a dust mote or a bulb would trail a red tail. No stronger than this pixel's
  // own colour, or than its brightness allows.
  float bleed = length(chroma);
  float cap = max(length(own.yz), 1.8 * luma);
  if (bleed > cap) chroma *= cap / bleed;
  vec3 color = clamp(yiqToRgb(vec3(luma, chroma)), 0.0, 1.0);

  color *= 1.0 - 0.08 * (0.5 + 0.5 * sin(uv.y * resolution.y * 3.14159265));
  // Grain goes on in display (gamma) space: added in linear space, the sRGB encode
  // would lift the blacks to a foggy grey.
  vec3 display = pow(max(color, vec3(1e-6)), vec3(1.0 / 2.2));
  display += (hash(uv * resolution + floor(uTime * 24.0)) - 0.5) * (0.04 + 0.06 * uIntensity);
  color = pow(max(display, vec3(1e-6)), vec3(2.2));
  color *= mix(1.0, 1.0 - smoothstep(0.25, 0.85, length(uv - 0.5)), 0.6);
  color = mix(color, vec3(0.0), uFade);

  outputColor = vec4(max(color, vec3(0.0)), inputColor.a);
}
`;
