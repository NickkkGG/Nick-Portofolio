import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { LightPads } from './lightPads';

/**
 * Keeps the number of lights of each kind constant (see LightPads). Mounted after every
 * chapter, so it finds all their lights, and fills in for the hidden ones after the
 * chapters have shown or hidden their groups for the frame.
 */
export function StableLights() {
  const scene = useThree((s) => s.scene);
  const pads = useMemo(() => new LightPads(), []);
  useLayoutEffect(() => pads.collect(scene), [pads, scene]);
  useFrame(() => pads.balance());
  return <primitive object={pads.root} />;
}
