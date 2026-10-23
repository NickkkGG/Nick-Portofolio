import { audioContext, noiseBuffer } from './context';

/**
 * Small synthesised sounds for the last chapters (no samples to license): a mechanical
 * key going down and coming back up, and a VHS tape sliding in its card sleeve. Audio
 * failing must never break the page.
 */
function burst(ctx: AudioContext, at: number, seconds: number, frequency: number, q: number, gain: number, out: AudioNode = ctx.destination) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, seconds);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = frequency;
  band.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  source.connect(band).connect(env).connect(out);
  source.start(at);
}

function thock(ctx: AudioContext, at: number, from: number, to: number, seconds: number, gain: number) {
  const tone = ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(from, at);
  tone.frequency.exponentialRampToValueAtTime(to, at + seconds);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  tone.connect(env).connect(ctx.destination);
  tone.start(at);
  tone.stop(at + seconds + 0.02);
}

/** A key bottoming out (`down`), or springing back up. */
export function playKeyClick(down: boolean): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.005;
    if (down) {
      burst(ctx, now, 0.025, 3800 + Math.random() * 600, 2.2, 0.35);
      thock(ctx, now, 210, 120, 0.06, 0.4);
    } else {
      burst(ctx, now, 0.018, 4600 + Math.random() * 600, 2.8, 0.18);
    }
  } catch {
    // Silence is fine.
  }
}

/** Cardboard and plastic: a tape sliding half out of its sleeve, or back in. */
export function playTapeSlide(out: boolean): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.005;
    burst(ctx, now, 0.16, out ? 1500 : 1100, 0.8, 0.12);
    burst(ctx, now + 0.14, 0.03, 2600, 3, 0.22);
  } catch {
    // Silence is fine.
  }
}

/** A tape pushed into a deck: the heavy clunk before it plays. */
export function playTapeClunk(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.005;
    thock(ctx, now, 140, 60, 0.18, 0.6);
    burst(ctx, now, 0.05, 1800, 1.5, 0.3);
    burst(ctx, now + 0.09, 0.04, 3200, 2.5, 0.2);
  } catch {
    // Silence is fine.
  }
}
