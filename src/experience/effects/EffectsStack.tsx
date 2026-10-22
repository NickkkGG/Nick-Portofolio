import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useRef } from 'react';
import { useExperience } from '@/store/useExperience';
import { fadeAt } from '@/timeline/loop';
import { Vhs, type VhsEffect } from './VhsEffect';

export function EffectsStack() {
  const vhs = useRef<VhsEffect>(null);

  useFrame(() => {
    const effect = vhs.current;
    if (!effect) return;
    const { time, vhsBase, vhsSpike, p } = useExperience.getState();
    effect.uniforms.get('uTime')!.value = time;
    effect.uniforms.get('uIntensity')!.value = Math.min(1, vhsBase + vhsSpike * (1 - vhsBase));
    effect.uniforms.get('uFade')!.value = fadeAt(p);
  });

  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.6} />
      <Vhs ref={vhs} />
    </EffectComposer>
  );
}
