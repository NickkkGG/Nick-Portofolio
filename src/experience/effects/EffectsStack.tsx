import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer } from '@react-three/postprocessing';
import type { DepthOfFieldEffect } from 'postprocessing';
import { useRef } from 'react';
import { useExperience } from '@/store/useExperience';
import { atmosphereAt } from '@/experience/atmosphere/atmosphere';
import { focusDistance } from '@/experience/camera/paths';
import { fadeAt } from '@/timeline/loop';
import { glassAt } from '@/timeline/transitions';
import { Glass, type GlassEffect } from './GlassEffect';
import { LENS } from './lens';
import { Vhs, type VhsEffect } from './VhsEffect';

export function EffectsStack() {
  const vhs = useRef<VhsEffect>(null);
  const dof = useRef<DepthOfFieldEffect>(null);
  const glass = useRef<GlassEffect>(null);

  useFrame(() => {
    const { time, vhsBase, vhsSpike, p, cameraPose } = useExperience.getState();
    if (dof.current && cameraPose) dof.current.cocMaterial.focusDistance = focusDistance(cameraPose);
    if (glass.current) {
      const pane = glassAt(p);
      glass.current.uniforms.get('uAmount')!.value = pane.amount;
      glass.current.uniforms.get('uSeed')!.value = pane.seed;
      glass.current.uniforms.get('uTime')!.value = time;
    }
    const effect = vhs.current;
    if (!effect) return;
    effect.uniforms.get('uTime')!.value = time;
    effect.uniforms.get('uIntensity')!.value = Math.min(1, vhsBase + vhsSpike * (1 - vhsBase));
    effect.uniforms.get('uFade')!.value = fadeAt(p);
    effect.uniforms.get('uExposure')!.value = atmosphereAt(p).exposure;
  });

  // One pass per effect, in this order: the lens blurs, the highlights glow, chapter
  // changes pass through the glass, then the tape. Merged into one pass, postprocessing
  // sorts the convolution VHS effect before Bloom, so bloom would glow through the blackout.
  return (
    <EffectComposer multisampling={4} mergeMode="none">
      <DepthOfField ref={dof} focusRange={LENS.focusRange} bokehScale={LENS.bokehScale} />
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.6} />
      <Glass ref={glass} />
      <Vhs ref={vhs} />
    </EffectComposer>
  );
}
