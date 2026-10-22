import { useFrame } from '@react-three/fiber';
import { FogExp2, SRGBColorSpace } from 'three';
import { useExperience } from '@/store/useExperience';
import { atmosphereAt } from './atmosphere';

/** Keeps the scene fog in step with the chapter atmosphere. */
export function AtmosphereDriver() {
  useFrame(({ scene }) => {
    const air = atmosphereAt(useExperience.getState().p);
    if (!(scene.fog instanceof FogExp2)) scene.fog = new FogExp2('#000000', air.fogDensity);
    scene.fog.color.setRGB(air.fog[0], air.fog[1], air.fog[2], SRGBColorSpace);
    scene.fog.density = air.fogDensity;
  });
  return null;
}
