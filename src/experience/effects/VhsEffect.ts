import { wrapEffect } from '@react-three/postprocessing';
import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';
import { VHS_BASE_DEFAULT } from '@/store/useExperience';
import { vhsFragment } from './shaders/vhs.glsl';

export class VhsEffect extends Effect {
  constructor() {
    super('VhsEffect', vhsFragment, {
      // Samples neighbouring pixels for the chroma bleed.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uIntensity', new Uniform(VHS_BASE_DEFAULT)],
        ['uFade', new Uniform(0)],
        ['uExposure', new Uniform(1)],
      ]),
    });
  }
}

export const Vhs = wrapEffect(VhsEffect);
