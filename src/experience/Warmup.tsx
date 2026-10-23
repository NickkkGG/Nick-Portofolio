import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { type Material, type Object3D, type Scene, type WebGLRenderer, WebGLRenderTarget } from 'three';
import { useExperience } from '@/store/useExperience';
import { LIGHT_PADS } from './lightPads';
import { revealAll } from './revealAll';

/** Share of the warm-up the shaders take; the first full frame is the rest. */
const COMPILE_SHARE = 0.8;

/** The stand-in lights stay out of it: with every real light shown, the counts are already full. */
const keepHidden = (scene: Scene): Object3D[] => {
  const pads = scene.getObjectByName(LIGHT_PADS);
  return pads ? [pads] : [];
};

/** Resolves once every material's program has compiled, reporting the share done (as three's compileAsync waits). */
function whenCompiled(gl: WebGLRenderer, materials: Set<Material>, onProgress: (done: number) => void): Promise<void> {
  const total = Math.max(1, materials.size);
  return new Promise((resolve) => {
    const check = () => {
      for (const material of materials) {
        const program = (gl.properties.get(material) as { currentProgram?: { isReady(): boolean } }).currentProgram;
        if (!program || program.isReady()) materials.delete(material);
      }
      onProgress(1 - materials.size / total);
      if (materials.size === 0) resolve();
      else setTimeout(check, 16);
    };
    check();
  });
}

/**
 * The scene is ready only once it has been warmed up behind the loader: every shader of the
 * film compiled, then one frame drawn with every object in view at once, so each texture is
 * uploaded and each GPU pipeline built (the wet floor's mirror too). Without it the first
 * sight of each chapter froze the scroll for a few hundred milliseconds.
 */
export function Warmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setWarmup = useExperience((s) => s.setWarmup);
  const setSceneReady = useExperience((s) => s.setSceneReady);
  const stage = useRef<'compiling' | 'drawing' | 'done'>('compiling');
  const undo = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Labels painted on canvases are painted again once the fonts arrive: upload those.
      await document.fonts?.ready;
      if (cancelled) return;
      // A program depends on whether it draws into a render target (no tone mapping there),
      // and the composer always does: compile with one bound.
      const target = new WebGLRenderTarget(1, 1);
      const previous = gl.getRenderTarget();
      gl.setRenderTarget(target);
      const restore = revealAll(scene, keepHidden(scene));
      const materials = gl.compile(scene, camera);
      restore();
      gl.setRenderTarget(previous);
      target.dispose();
      await whenCompiled(gl, materials, (done) => setWarmup(COMPILE_SHARE * done));
      if (!cancelled) stage.current = 'drawing';
    })();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, setWarmup]);

  // The frame's last update, so no chapter shows or hides its group again before the composer
  // draws. While the shaders compile in the background nothing is drawn (the loader covers it,
  // and drawing would compile them on the spot); then everything at once, for one frame.
  useFrame(({ scene: root }) => {
    if (stage.current === 'compiling') {
      root.visible = false;
      undo.current = () => {
        root.visible = true;
      };
    } else if (stage.current === 'drawing') {
      undo.current = revealAll(root, keepHidden(root));
      stage.current = 'done';
    }
  });

  // Right after the composer's render (priority 1): back to normal, and once that full frame
  // is drawn, PLAY can show.
  useFrame(() => {
    if (!undo.current) return;
    undo.current();
    undo.current = null;
    if (stage.current === 'done') setSceneReady();
  }, 2);

  return null;
}
