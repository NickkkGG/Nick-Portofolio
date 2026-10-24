let context: AudioContext | null = null;

/**
 * The page's one AudioContext, made on first use. The visitor has already clicked PLAY
 * by then, so it is allowed to start. Null where there is no Web Audio (server, old browsers).
 */
export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/**
 * The little paper speaker of an old set: it loses the deep lows and the top, and its cone
 * rings around 1.2 kHz. What goes into `input` comes out of `output` sounding like it.
 */
export function tvSpeaker(ctx: BaseAudioContext): { input: AudioNode; output: AudioNode } {
  const input = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 160, Q: 0.7 });
  const output = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1200, Q: 0.9, gain: 5 });
  input.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5000, Q: 0.7 })).connect(output);
  return { input, output };
}

/** A buffer of white noise, `seconds` long. */
export function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
