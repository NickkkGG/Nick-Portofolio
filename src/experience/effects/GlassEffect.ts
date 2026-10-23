import { wrapEffect } from '@react-three/postprocessing';
import { Effect, EffectAttribute } from 'postprocessing';
import { RepeatWrapping, TextureLoader, Uniform } from 'three';
import { glassFragment } from './shaders/glass.glsl';

/** The same fingerprints as on the CRTs' glass. */
const SMUDGE = '/models/crt-smudge.webp';

export class GlassEffect extends Effect {
  constructor() {
    const smudge = new TextureLoader().load(SMUDGE);
    smudge.wrapS = smudge.wrapT = RepeatWrapping;
    super('GlassEffect', glassFragment, {
      // Samples around each pixel for the dispersion and the smear.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uAmount', new Uniform(0)],
        ['uTime', new Uniform(0)],
        ['uSeed', new Uniform(0)],
        ['uSmudge', new Uniform(smudge)],
      ]),
    });
  }
}

export const Glass = wrapEffect(GlassEffect);
