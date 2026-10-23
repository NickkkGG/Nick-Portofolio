'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import { DebugStats } from '@/debug/DebugStats';
import { AtmosphereDriver } from './atmosphere/AtmosphereDriver';
import { Backdrop } from './atmosphere/Backdrop';
import { Particles } from './atmosphere/Particles';
import { useExperience } from '@/store/useExperience';
import { CameraRig } from './camera/CameraRig';
import { Chapters } from './chapters/Chapters';
import { EffectsStack } from './effects/EffectsStack';
import { FrameClock } from './FrameClock';

/** Mounted inside the Suspense boundary: the scene is ready once every model has loaded. */
function SceneReady() {
  const setSceneReady = useExperience((s) => s.setSceneReady);
  useEffect(() => setSceneReady(), [setSceneReady]);
  return null;
}

export default function Experience() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.05, far: 400, position: [0.9, 1.5, 1.6] }}
    >
      <color attach="background" args={['#050607']} />
      <fogExp2 attach="fog" args={['#050607', 0.015]} />
      <ambientLight intensity={0.04} />
      {/* Mount order is useFrame order: clock, then camera, then everything that follows it. */}
      <FrameClock />
      <CameraRig />
      <AtmosphereDriver />
      <Backdrop />
      <Suspense fallback={null}>
        <Chapters />
        <SceneReady />
      </Suspense>
      <Particles />
      <EffectsStack />
      <DebugStats />
    </Canvas>
  );
}
