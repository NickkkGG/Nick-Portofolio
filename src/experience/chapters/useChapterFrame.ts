import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type { Object3D } from 'three';
import { useExperience } from '@/store/useExperience';
import { localProgress } from '@/timeline/resolve';
import { isVisible, type VisibilityGroup } from '@/timeline/visibility';

/**
 * Shows `ref` only while its group is in range, and for chapter groups calls
 * `onFrame` with the chapter-local t and the global p every visible frame.
 */
export function useChapterFrame(
  group: VisibilityGroup,
  ref: RefObject<Object3D | null>,
  onFrame?: (t: number, p: number) => void,
): void {
  useFrame(() => {
    const object = ref.current;
    if (!object) return;
    const { p } = useExperience.getState();
    const visible = isVisible(group, p);
    object.visible = visible;
    if (visible && group !== 'depths' && onFrame) onFrame(localProgress(p, group), p);
  });
}
