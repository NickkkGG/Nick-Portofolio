import { BEAM_OUT_T, lampLevel } from '@/experience/chapters/booth/slides';
import { bulbIntensity } from '@/experience/chapters/depths/choreography';
import { surgeLevel } from '@/experience/chapters/spiral/motion';
import { clamp01, smoothstep } from '@/lib/math';
import { displayState } from '@/timeline/loop';
import { noiseBuffer, tvSpeaker } from './context';

/** The steady sounds under the chapters. */
export type Bed = 'hum' | 'wind' | 'static' | 'dark' | 'projector';

/** In over the first `into` of a chapter, out over its last `out`. */
const edges = (t: number, into = 0.06, out = 0.06) => smoothstep(0, into, t) * (1 - smoothstep(1 - out, 1, t));

/** The projector fan from inside the booth, and what is left of it once the camera is out of the window. */
const FAN = 0.6;
const FAN_OUTSIDE = 0.24;
/** The first monitor's static once the beam finds it, before the work's own surges. */
const FIRST_STATIC = 0.4;

/**
 * How loud each bed is (0..1) at progress `p`, scene time `time`, with the scroll moving at
 * `speed` (progress per second): the mains hum of the room's tube and lamp, and later of the
 * lit bulb; the roar of the fall and of the loop's drop back onto the roof (harder the faster
 * the visitor falls); the booth's projector fan; the static of the project monitors, coming in
 * gently once the projector's beam finds the first one and surging with their picture; and a
 * drone in the dark that lets go once the bulb lights.
 */
export function bedLevels(p: number, time: number, speed: number): Record<Bed, number> {
  const levels: Record<Bed, number> = { hum: 0, wind: 0, static: 0, dark: 0, projector: 0 };
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
    case 'about':
      levels.projector = lampLevel(t) * (FAN - (FAN - FAN_OUTSIDE) * smoothstep(0.9, 1, t));
      levels.static = FIRST_STATIC * smoothstep(BEAM_OUT_T, 1, t);
      break;
    case 'spiral':
      // Already hissing as the camera floats in from the booth; the fan it left behind dies away.
      levels.static = (1 - smoothstep(0.94, 1, t)) * (FIRST_STATIC + 0.4 * surgeLevel(time) * smoothstep(0, 0.12, t));
      levels.projector = FAN_OUTSIDE * (1 - smoothstep(0, 0.06, t));
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

/** The beds as running noise and tones, each behind its own fader (see bedLevels). */
export class Beds {
  private readonly faders: Record<Bed, GainNode>;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly last: Record<Bed, number> = { hum: -1, wind: -1, static: -1, dark: -1, projector: -1 };

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
  ) {
    const fader = () => {
      const gain = new GainNode(ctx, { gain: 0 });
      gain.connect(out);
      return gain;
    };
    this.faders = { hum: fader(), wind: fader(), static: fader(), dark: fader(), projector: fader() };

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

    // A dead channel as an old set plays it: broadband snow through its little speaker, with the
    // picture's 50 Hz buzz under it.
    const set = tvSpeaker(ctx);
    const snow = loopedNoise(ctx, 3);
    snow.connect(set.input);
    const sync = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 50 });
    sync.connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 600, Q: 0.8 })).connect(new GainNode(ctx, { gain: 0.25 })).connect(set.input);
    sync.start();
    set.output.connect(new GainNode(ctx, { gain: 0.085 })).connect(this.faders.static);
    this.sources.push(snow, sync);

    // The dark: two saws a breath apart, far down, beating slowly.
    const drone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 320 });
    for (const frequency of [55, 55.35]) {
      const saw = new OscillatorNode(ctx, { type: 'sawtooth', frequency });
      saw.connect(drone);
      saw.start();
      this.sources.push(saw);
    }
    drone.connect(new GainNode(ctx, { gain: 0.03 })).connect(this.faders.dark);

    // The slide projector: its fan motor's hum, a little unsteady, and the air through its vents.
    const motor = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 96 });
    const wobble = new OscillatorNode(ctx, { frequency: 0.7 });
    wobble.connect(new GainNode(ctx, { gain: 1.2 })).connect(motor.frequency);
    motor.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 520, Q: 0.9 })).connect(new GainNode(ctx, { gain: 0.014 })).connect(this.faders.projector);
    const vent = loopedNoise(ctx, 3);
    vent.connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 850, Q: 0.6 })).connect(new GainNode(ctx, { gain: 0.045 })).connect(this.faders.projector);
    motor.start();
    wobble.start();
    this.sources.push(motor, wobble, vent);
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
