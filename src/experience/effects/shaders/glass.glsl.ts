/**
 * Chapter changes seen through the face of a CRT (our take on a glass transition): thick
 * curved glass magnifying the middle, slow molten waves in it, dispersion splitting the
 * colours toward the rim, fingerprints frosting the picture where they catch the light,
 * and the rainbow wobble of a set being degaussed. uAmount 0 leaves the picture alone.
 * Runs in its own postprocessing EffectPass (inputBuffer, resolution).
 */
export const glassFragment = /* glsl */ `
uniform float uAmount;
uniform float uTime;
uniform float uSeed;
uniform sampler2D uSmudge;

float glassHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float glassNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(glassHash(i), glassHash(i + vec2(1.0, 0.0)), u.x), mix(glassHash(i + vec2(0.0, 1.0)), glassHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float a = uAmount;
  if (a < 0.001) {
    outputColor = inputColor;
    return;
  }
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 c = (uv - 0.5) * aspect;
  float r = length(c);
  vec2 dir = c / max(r, 1e-4);

  // Uneven thickness: the glass was poured, not ground.
  float thick = 0.7 + 0.6 * glassNoise(c * 1.6 + uSeed * 3.1 + uTime * 0.03);
  // Fingerprints and grime, faint, catching the light here and there.
  float smudge = texture2D(uSmudge, uv * aspect * 0.35 + vec2(uSeed * 0.31, uSeed * 0.17)).r;

  // The tube's face bulges toward the lens and magnifies the middle.
  vec2 bend = -c * 0.3 * a * (1.0 - 0.45 * r * r);
  // Molten waves in the glass, drifting slowly.
  vec2 q = c * 2.4 + uSeed * 4.17;
  vec2 wave = vec2(glassNoise(q + vec2(uTime * 0.11, 0.0)), glassNoise(q + vec2(3.7, uTime * 0.09))) - 0.5;
  // Degauss: rings wobbling out from the middle, like an old set switching on.
  float ring = sin(r * 22.0 - uTime * 6.0 + uSeed * 2.3);
  vec2 offset = (bend + wave * 0.045 * a * thick + dir * ring * 0.003 * a) / aspect;

  // Dispersion (blue bends more than red) and a zoom smear toward the middle, longer at the rim.
  vec2 along = dir / aspect;
  float spread = a * (0.004 + 0.03 * r * r) * thick;
  float smear = a * (0.015 + 0.07 * r) * thick * (0.85 + 0.3 * smudge);
  vec3 color = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    vec2 at = uv + offset - along * (float(i) / 8.0) * smear;
    color.r += texture2D(inputBuffer, at - along * spread * 0.5).r;
    color.g += texture2D(inputBuffer, at).g;
    color.b += texture2D(inputBuffer, at + along * spread).b;
  }
  color /= 9.0;

  // Frosted glass scatters a little light: a thin cool veil, thicker toward the rim.
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += (vec3(0.05, 0.06, 0.075) * (0.4 + 1.6 * r * r) + luma * 0.18) * a * thick * (0.8 + 0.4 * smudge);
  // Purity bands drifting round the colour wheel while the set degausses.
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831853 * (r * 1.4 + ring * 0.08 + vec3(0.0, 0.33, 0.67)) + uTime * 1.7 + uSeed);
  color *= mix(vec3(1.0), 0.75 + 0.5 * rainbow, 0.22 * a);
  // A highlight sliding across the curve of the glass, and glints along its rim.
  float sweep = fract(0.37 * uSeed + uTime * 0.05) * 2.4 - 1.2;
  float streak = exp(-pow((dot(c, normalize(vec2(1.0, 0.65))) - sweep) * 6.0, 2.0));
  color += vec3(0.85, 0.9, 1.0) * streak * 0.22 * a;
  float rim = smoothstep(0.55, 0.95, r) * (0.5 + 0.5 * sin(atan(c.y, c.x) * 7.0 + uSeed * 5.0 + uTime * 0.4));
  color += vec3(0.8, 0.9, 1.0) * rim * 0.12 * a;
  // The glass thickens toward the corners.
  color *= 1.0 - 0.3 * a * smoothstep(0.45, 1.0, r);

  outputColor = vec4(color, inputColor.a);
}
`;
