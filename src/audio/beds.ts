import { bulbIntensity } from '@/experience/chapters/depths/choreography';
import { surgeLevel } from '@/experience/chapters/spiral/motion';
import { clamp01, smoothstep } from '@/lib/math';
import { displayState } from '@/timeline/loop';
import { noiseBuffer } from './context';

/** The steady sounds under the chapters. */
export type Bed = 'hum' | 'wind' | 'static' | 'dark';

/** In over the first `edge` of a chapter, out over its last. */
const edges = (t: number, edge = 0.06) => smoothstep(0, edge, t) * (1 - smoothstep(1 - edge, 1, t));

/**
 * How loud each bed is (0..1) at progress `p`, scene time `time`, with the scroll moving at
 * `speed` (progress per second): the mains hum of the room's tube and lamp, and later of the
 * lit bulb; the roar of the fall and of the loop's drop back onto the roof (harder the faster
 * the visitor falls); the static of the project monitors (surging with their picture); and a
 * drone in the dark that lets go once the bulb lights.
 */
export function bedLevels(p: number, time: number, speed: number): Record<Bed, number> {
  const levels: Record<Bed, number> = { hum: 0, wind: 0, static: 0, dark: 0 };
  const { chapterId, t } = displayState(p);
  const lit = bulbIntensity(p) / 3;
  const rush = 0.35 + 0.65 * clamp01(speed / 0.08);
  switch (chapterId) {
    case 'room':
      levels.hum = 0.5 * (1 - smoothstep(0.9, 1, t));
      break;
    case 'fall':
      levels.wind = edges(t) * rush;
      break;
    case 'spiral':
      levels.static = edges(t) * (0.4 + 0.55 * surgeLevel(time));
      break;
    case 'problem':
      levels.dark = edges(t) * 0.6 * (1 - lit);
      levels.hum = 0.25 * lit;
      break;
    case 'stack':
    case 'contact':
      levels.hum = 0.25 * lit;
      break;
    case 'loop':
      levels.hum = 0.25 * lit;
      levels.wind = rush * smoothstep(0.35, 0.5, t) * (1 - smoothstep(0.8, 0.9, t));
      break;
  }
  return levels;
}

/** A looping noise source, started at once. */
function loopedNoise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const source = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx, seconds), loop: true });
  source.start();
  return source;
}

/** Sparse clicks and pops, looped: the crackle on a dead channel. */
function crackle(ctx: BaseAudioContext): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2.3), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) if (Math.random() < 0.0009) data[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * Math.random());
  const source = new AudioBufferSourceNode(ctx, { buffer, loop: true });
  source.start();
  return source;
}

/** The beds as running noise and tones, each behind its own fader (see bedLevels). */
export class Beds {
  private readonly faders: Record<Bed, GainNode>;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly last: Record<Bed, number> = { hum: -1, wind: -1, static: -1, dark: -1 };

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
  ) {
    const fader = () => {
      const gain = new GainNode(ctx, { gain: 0 });
      gain.connect(out);
      return gain;
    };
    this.faders = { hum: fader(), wind: fader(), static: fader(), dark: fader() };

    // Mains hum off the tube and the lamp: a 50 Hz buzz, its harmonics carrying it on small speakers.
    const hum = new GainNode(ctx, { gain: 0.027 });
    const buzz = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 50 });
    buzz.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 400, Q: 0.7 })).connect(hum);
    const body = new OscillatorNode(ctx, { frequency: 100 });
    body.connect(new GainNode(ctx, { gain: 0.6 })).connect(hum);
    buzz.start();
    body.start();
    this.sources.push(buzz, body);
    hum.connect(this.faders.hum);

    // The fall: air rushing past, the filter breathing in slow gusts.
    const air = loopedNoise(ctx, 4);
    const rush = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 700, Q: 0.8 });
    const gust = new OscillatorNode(ctx, { frequency: 0.13 });
    gust.connect(new GainNode(ctx, { gain: 380 })).connect(rush.frequency);
    gust.start();
    air.connect(rush).connect(new GainNode(ctx, { gain: 0.19 })).connect(this.faders.wind);
    this.sources.push(air, gust);

    // A dead channel: band-limited hiss with its crackle.
    const hiss = loopedNoise(ctx, 3);
    hiss
      .connect(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 900 }))
      .connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 3200, Q: 0.6 }))
      .connect(new GainNode(ctx, { gain: 0.14 }))
      .connect(this.faders.static);
    const pops = crackle(ctx);
    pops.connect(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1200 })).connect(new GainNode(ctx, { gain: 0.18 })).connect(this.faders.static);
    this.sources.push(hiss, pops);

    // The dark: two saws a breath apart, far down, beating slowly.
    const drone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 320 });
    for (const frequency of [55, 55.35]) {
      const saw = new OscillatorNode(ctx, { type: 'sawtooth', frequency });
      saw.connect(drone);
      saw.start();
      this.sources.push(saw);
    }
    drone.connect(new GainNode(ctx, { gain: 0.03 })).connect(this.faders.dark);
  }

  /** Eases every bed toward its level from `at` (audio clock seconds); small changes are left alone. */
  set(levels: Record<Bed, number>, at = this.ctx.currentTime) {
    for (const bed of Object.keys(levels) as Bed[]) {
      if (Math.abs(levels[bed] - this.last[bed]) < 0.004) continue;
      this.last[bed] = levels[bed];
      this.faders[bed].gain.setTargetAtTime(levels[bed], at, 0.05);
    }
  }

  stop() {
    for (const source of this.sources) source.stop();
    for (const gain of Object.values(this.faders)) gain.disconnect();
  }
}
