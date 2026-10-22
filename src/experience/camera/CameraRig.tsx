import { useFrame } from '@react-three/fiber';
import { content } from '@/content';
import { useExperience } from '@/store/useExperience';
import { cameraPoseAt } from './paths';

/** Places the camera on the keyframed path for the current progress. */
export function CameraRig() {
  useFrame(({ camera }) => {
    const { p, setCameraPose } = useExperience.getState();
    const pose = cameraPoseAt(p, content.projects.length);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    setCameraPose(pose);
  });
  return null;
}
