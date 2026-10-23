import { type ThreeElements, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type AnimationAction, AnimationMixer, type Group, LoopOnce, type Mesh, type Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODELS, useModel } from '@/experience/assets';
import type { Vec3 } from '@/experience/camera/types';
import { Gaze } from './gaze';
import { blendedOffset, type Clip, type ClipMix } from './poses';

/** Inside a chapter group that is showing (useChapterFrame hides whole chapters). */
function shown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

type Props = Omit<ThreeElements['group'], 'ref'> & {
  /** The clips to blend this frame, from the scroll and the scene clock. */
  pose: () => ClipMix[];
  /** Runs first each frame, to move the whole figure (down the fall) or hide it. */
  place?: (figure: Group) => void;
  /** Where to look this frame, and how much (0..1), over the clips: a glance at a knock. */
  look?: () => { point: Vec3; weight: number } | null;
};

/**
 * One copy of the character (blender/scripts/character.py), posed every frame by `pose`.
 * Clip times come from the scene clock rather than the mixer's own, so a frozen clock
 * freezes the figure and the loop seam shows the same pose on both sides.
 */
export function Character({ pose, place, look, ...props }: Props) {
  const outer = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const { scene, animations } = useModel(MODELS.character);
  const figure = useMemo(() => {
    const copy = clone(scene);
    // Bounds come from the rest pose; a seated or falling figure would be culled wrongly.
    copy.traverse((o) => {
      if ((o as Mesh).isMesh) o.frustumCulled = false;
    });
    return copy;
  }, [scene]);
  const rig = useMemo(() => {
    const mixer = new AnimationMixer(figure);
    const actions = new Map<Clip, AnimationAction>();
    for (const clipData of animations) {
      const action = mixer.clipAction(clipData);
      if (clipData.name === 'StandUp') {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions.set(clipData.name as Clip, action);
    }
    return { mixer, actions };
  }, [figure, animations]);
  // Made while the figure still stands in its rest pose.
  const gaze = useMemo(() => {
    const neck = figure.getObjectByName('neck_01');
    const head = figure.getObjectByName('head');
    return neck && head ? new Gaze(neck, head, figure) : null;
  }, [figure]);
  // Started on mount, not when the mixer is made: Strict Mode mounts twice, stopping in between.
  useEffect(() => {
    for (const action of rig.actions.values()) {
      action.play();
      action.enabled = false;
    }
    return () => {
      rig.mixer.stopAllAction();
    };
  }, [rig]);

  useFrame(() => {
    const root = outer.current;
    const body = inner.current;
    if (!root?.parent || !body || !shown(root.parent)) return;
    place?.(root);
    if (!root.visible) return;
    const mix = pose();
    for (const action of rig.actions.values()) action.enabled = false;
    for (const { clip, weight, time } of mix) {
      const action = rig.actions.get(clip);
      if (!action || weight <= 0) continue;
      action.enabled = true;
      action.setEffectiveWeight(weight);
      action.time = time;
    }
    rig.mixer.update(0);
    body.position.set(...blendedOffset(mix));
    const glance = look?.();
    if (glance && gaze) gaze.apply(glance.point, glance.weight, root);
  });

  return (
    <group ref={outer} {...props}>
      <group ref={inner}>
        <primitive object={figure} />
      </group>
    </group>
  );
}
