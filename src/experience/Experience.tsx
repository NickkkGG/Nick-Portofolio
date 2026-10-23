'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { DebugStats } from '@/debug/DebugStats';
import { AtmosphereDriver } from './atmosphere/AtmosphereDriver';
import { Backdrop } from './atmosphere/Backdrop';
import { Particles } from './atmosphere/Particles';
import { CameraRig } from './camera/CameraRig';
import { Chapters } from './chapters/Chapters';
import { EffectsStack } from './effects/EffectsStack';
import { FrameClock } from './FrameClock';
import { StableLights } from './StableLights';
import { Warmup } from './Warmup';

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
      {/* Inside the boundary, both mount once every model has loaded, after every chapter's light. */}
      <Suspense fallback={null}>
        <Chapters />
        <StableLights />
        <Warmup />
      </Suspense>
      <Particles />
      <EffectsStack />
      <DebugStats />
    </Canvas>
  );
}
