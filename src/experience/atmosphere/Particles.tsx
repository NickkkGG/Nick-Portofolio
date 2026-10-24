import { lampLevel } from '@/experience/chapters/booth/slides';
import { localProgress } from '@/timeline/resolve';
import { ParticleField, type ParticleFieldProps } from './ParticleField';

/** Every chapter's floating particles; tune here. Boxes are in world metres. */
const FIELDS: (ParticleFieldProps & { name: string })[] = [
  {
    name: 'room-dust',
    group: 'room',
    count: 500,
    seed: 11,
    // The room runs from the back wall behind the desk (z = -1.18) to z = 3.
    min: [-2.9, 0.05, -1.12],
    max: [2.9, 2.9, 2.9],
    color: '#ffe7c4',
    size: 0.004,
    drift: [0.01, 0.006, -0.004],
    sway: 0.05,
    opacity: 0.55,
    twinkle: 0.5,
    brightness: 1.6,
  },
  {
    name: 'fall-rush',
    group: 'fall',
    count: 4800,
    seed: 12,
    // Along the whole drop, which drifts over to the booth: down to just above its roof.
    min: [-5, -82, -5],
    max: [5, 2, 19],
    color: '#bcd8e6',
    size: 0.018,
    drift: [0, 2.5, 0],
    sway: 0.1,
    opacity: 0.6,
    brightness: 1.4,
  },
  {
    // Motes in the projector's beam, between the lens and the sheet: lit only while the lamp is.
    name: 'booth-beam-dust',
    group: 'about',
    count: 240,
    seed: 18,
    min: [-0.8, -84.6, 11.45],
    max: [0.95, -83.4, 13.85],
    color: '#ffe2b8',
    size: 0.0035,
    drift: [0.004, 0.003, -0.003],
    sway: 0.04,
    opacity: 0.32,
    twinkle: 0.5,
    brightness: 1.2,
    opacityAt: (p) => lampLevel(localProgress(p, 'about')),
  },
  {
    // Dust still settling from the crash, down through the hole in the roof.
    name: 'booth-crash-dust',
    group: 'about',
    count: 90,
    seed: 19,
    min: [-1.6, -85.2, 13.3],
    max: [-0.5, -82.6, 14.4],
    color: '#cfe6e0',
    size: 0.006,
    drift: [0, -0.08, 0],
    sway: 0.05,
    opacity: 0.45,
    brightness: 1.3,
  },
  {
    name: 'spiral-snow',
    group: 'spiral',
    count: 6000,
    seed: 13,
    min: [-18, -175, -18],
    max: [18, -65, 18],
    color: '#a6e3d8',
    size: 0.025,
    drift: [0.05, -0.35, 0.02],
    sway: 0.3,
    opacity: 0.55,
    twinkle: 0.4,
    brightness: 1.6,
  },
  {
    name: 'spiral-bokeh',
    group: 'spiral',
    count: 220,
    seed: 14,
    min: [-18, -175, -18],
    max: [18, -65, 18],
    color: '#3fb5a6',
    size: 0.16,
    drift: [0.02, -0.1, 0],
    sway: 0.5,
    opacity: 0.18,
    brightness: 1.2,
  },
  {
    name: 'problem-sparks',
    group: 'problem',
    count: 280,
    seed: 15,
    min: [-7, -183, -7],
    max: [7, -170, 7],
    color: '#ff3a26',
    size: 0.025,
    drift: [0, 0.4, 0],
    sway: 0.25,
    opacity: 0.8,
    twinkle: 0.7,
    brightness: 2.2,
  },
  {
    name: 'depths-moths',
    group: 'depths',
    count: 220,
    seed: 16,
    min: [-4, -181, -4],
    max: [4, -174, 4],
    color: '#ffd18a',
    size: 0.018,
    drift: [0.02, 0.05, 0],
    sway: 0.4,
    opacity: 0.6,
    twinkle: 0.6,
    brightness: 1.6,
  },
  {
    // Above the ceiling only: from inside the room the ceiling hides it, so the loop seam stays clean.
    name: 'loop-descent',
    group: 'loop',
    count: 1500,
    seed: 17,
    min: [-6, 3.2, -6],
    max: [6, 40, 6],
    color: '#9fb8c8',
    size: 0.018,
    drift: [0, 1.5, 0],
    sway: 0.1,
    opacity: 0.5,
    brightness: 1.3,
  },
];

export function Particles() {
  return (
    <>
      {FIELDS.map(({ name, ...field }) => (
        <ParticleField key={name} {...field} />
      ))}
    </>
  );
}
