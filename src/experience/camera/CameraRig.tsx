import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { content } from '@/content';
import { damp } from '@/lib/math';
import { useExperience } from '@/store/useExperience';
import { handheldOffset, parallaxOffset } from './handheld';
import { cameraPoseAt } from './paths';

const shift = new Vector3();
const aim = new Vector3();
const target = new Vector3();

/** Places the camera on the keyframed path, then lets it breathe like a camcorder in hand. */
export function CameraRig() {
  // Mouse only: on touch, a finger dragging to scroll should not steer the camera.
  const pointer = useRef({ x: 0, y: 0 });
  const lean = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: 1 - (event.clientY / window.innerHeight) * 2,
      };
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) pointer.current = { x: 0, y: 0 };
    };
    window.addEventListener('pointermove', move);
    document.addEventListener('pointerout', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
    };
  }, []);

  useFrame(({ camera }) => {
    const { p, time, setCameraPose } = useExperience.getState();
    const pose = cameraPoseAt(p, content.projects.length);
    // The store keeps the path pose; the sway below is only how the lens wobbles around it.
    setCameraPose(pose);

    // Scene time, not frame delta: a frozen clock (tests) freezes the lean as well.
    const dt = Math.max(0, time - lean.current.time);
    lean.current = {
      x: damp(lean.current.x, pointer.current.x, 2.5, dt),
      y: damp(lean.current.y, pointer.current.y, 2.5, dt),
      time,
    };
    const sway = handheldOffset(time);
    const [px, py] = parallaxOffset(lean.current.x, lean.current.y);

    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    // Offsets are in camera space (right, up, back), so they read the same in every chapter.
    shift.set(sway.position[0] + px, sway.position[1] + py, sway.position[2]).applyQuaternion(camera.quaternion);
    aim.set(...sway.target).applyQuaternion(camera.quaternion).add(target.set(...pose.target));
    camera.position.add(shift);
    camera.lookAt(aim);
  });
  return null;
}
