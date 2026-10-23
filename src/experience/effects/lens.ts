/** One lens for the whole film: post depth of field and particle bokeh share it. */
export const LENS = {
  /** Metres either side of the focus distance before the blur is at its strongest. */
  focusRange: 3.5,
  /** Size of the post-process bokeh. */
  bokehScale: 3,
  /** How wide out-of-focus particles open up, as a fraction of the viewport height per dioptre. */
  aperture: 0.005,
} as const;
