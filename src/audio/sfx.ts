import { audioContext, noiseBuffer, tvSpeaker } from './context';
import type { Cue } from './cues';

/**
 * The scene's one-off sounds, synthesised like every other sound here (no samples to license):
 * the set switching on, the floor giving way into the dark, channels changing, drips, the text
 * ticking in off the tape. Every voice takes any audio context, so it can also be rendered
 * offline to listen to. Audio failing must never break the page.
 */
export type Sfx = Cue | 'drip' | 'tick' | 'hover' | 'toggle' | 'crackle' | 'glitch';

export interface SfxOptions {
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Loudness; 1 is as designed. */
  level?: number;
}

interface Out {
  /** Straight to the speakers. */
  dry: AudioNode;
  /** Into the echo of the dark. */
  wet: AudioNode;
}

type Voice = (ctx: BaseAudioContext, out: Out, at: number) => void;

const rand = (from: number, to: number) => from + Math.random() * (to - from);
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

/** White noise from `at` for `seconds`, from somewhere in a shared two-second loop. */
function noise(ctx: BaseAudioContext, at: number, seconds: number): AudioBufferSourceNode {
  let buffer = noises.get(ctx);
  if (!buffer) {
    buffer = noiseBuffer(ctx, 2);
    noises.set(ctx, buffer);
  }
  const source = new AudioBufferSourceNode(ctx, { buffer, loop: true });
  source.start(at, Math.random() * 2);
  source.stop(at + seconds);
  return source;
}

/** A gain that swells to `peak` over `attack` seconds, then dies away over `decay`. */
function envelope(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
  const gain = new GainNode(ctx, { gain: 0 });
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return gain;
}

/** An oscillator sounding from `at` to `end`, gliding from `from` to `to` Hz over `glide` seconds. */
function tone(ctx: BaseAudioContext, type: OscillatorType, at: number, end: number, from: number, to = from, glide = end - at): OscillatorNode {
  const osc = new OscillatorNode(ctx, { type, frequency: from });
  if (to !== from) {
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + glide);
  }
  osc.start(at);
  osc.stop(end);
  return osc;
}

const band = (ctx: BaseAudioContext, frequency: number, Q = 1) => new BiquadFilterNode(ctx, { type: 'bandpass', frequency, Q });
const lowpass = (ctx: BaseAudioContext, frequency: number, Q = 0.7) => new BiquadFilterNode(ctx, { type: 'lowpass', frequency, Q });
const highpass = (ctx: BaseAudioContext, frequency: number, Q = 0.7) => new BiquadFilterNode(ctx, { type: 'highpass', frequency, Q });

/** A burst of band-limited noise: a click, a crack, a grain of grit. */
function burst(ctx: BaseAudioContext, out: AudioNode, at: number, seconds: number, frequency: number, Q: number, peak: number) {
  noise(ctx, at, seconds + 0.01)
    .connect(band(ctx, frequency, Q))
    .connect(envelope(ctx, at, peak, 0.001, seconds))
    .connect(out);
}

/** A falling sine: something heavy landing. */
function thump(ctx: BaseAudioContext, out: AudioNode, at: number, from: number, to: number, seconds: number, peak: number) {
  tone(ctx, 'sine', at, at + seconds + 0.05, from, to, seconds)
    .connect(envelope(ctx, at, peak, 0.003, seconds))
    .connect(out);
}

/** The set switching on: the switch, the degaussing coil's buzz dying away, the tube's whine, and its glass crackling with static. */
function powerOn(ctx: BaseAudioContext, { dry }: Out, at: number) {
  burst(ctx, dry, at, 0.012, 2600, 1.6, 0.5);
  thump(ctx, dry, at, 160, 70, 0.08, 0.45);
  burst(ctx, dry, at + 0.045, 0.02, 1400, 3, 0.3);
  // Degaussing: mains buzz through the coil round the tube, at once, dying away over a second.
  const coil = at + 0.06;
  const dull = lowpass(ctx, 900, 1.2);
  dull.frequency.setValueAtTime(900, coil);
  dull.frequency.exponentialRampToValueAtTime(220, coil + 1.05);
  tone(ctx, 'sawtooth', coil, coil + 1.25, 50)
    .connect(dull)
    .connect(envelope(ctx, coil, 0.3, 0.015, 1.1))
    .connect(dry);
  tone(ctx, 'sine', coil, coil + 0.9, 100)
    .connect(envelope(ctx, coil, 0.22, 0.01, 0.75))
    .connect(dry);
  // The tube charging up: a thin whine climbing out of hearing.
  tone(ctx, 'sine', at + 0.08, at + 1.6, 7500, 15000, 0.4)
    .connect(envelope(ctx, at + 0.08, 0.016, 0.12, 1.3))
    .connect(dry);
  // Static over the picture as it opens, and the glass crackling.
  const hiss = new GainNode(ctx, { gain: 0 });
  hiss.gain.setValueAtTime(0, at + 0.12);
  hiss.gain.linearRampToValueAtTime(0.16, at + 0.3);
  hiss.gain.exponentialRampToValueAtTime(0.0001, at + 1);
  noise(ctx, at + 0.12, 0.95)
    .connect(highpass(ctx, 1800))
    .connect(band(ctx, 4200, 0.7))
    .connect(hiss)
    .connect(dry);
  for (let i = 0; i < 12; i++) burst(ctx, dry, at + rand(0.1, 1.2), rand(0.002, 0.005), rand(2500, 6500), 1.5, rand(0.12, 0.35));
}

/** The floor giving way into another world: the slab cracking, rubble, a drop through the floor of hearing, a rush and a warped, sinking shimmer. */
function floorBreak(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  noise(ctx, at, 0.09)
    .connect(highpass(ctx, 700))
    .connect(envelope(ctx, at, 0.9, 0.001, 0.08))
    .connect(dry);
  burst(ctx, dry, at + 0.035, 0.14, 1800, 0.9, 0.5);
  for (let i = 0; i < 14; i++) {
    burst(ctx, i % 3 === 0 ? wet : dry, at + 0.02 + Math.pow(Math.random(), 1.6) * 0.5, rand(0.025, 0.07), rand(500, 3000), rand(1.5, 3), rand(0.08, 0.3));
  }
  thump(ctx, dry, at + 0.01, 72, 26, 1.5, 0.85);
  tone(ctx, 'triangle', at, at + 0.7, 140, 50, 0.5)
    .connect(envelope(ctx, at, 0.3, 0.005, 0.55))
    .connect(dry);

  // The rush down into the dark: noise through a narrowing band falling away, swirled by a flanger.
  const start = at + 0.15;
  const sweep = band(ctx, 4200, 5);
  sweep.frequency.setValueAtTime(4200, start);
  sweep.frequency.exponentialRampToValueAtTime(180, start + 2.65);
  const rush = new GainNode(ctx, { gain: 0 });
  rush.gain.setValueAtTime(0.0001, start);
  rush.gain.exponentialRampToValueAtTime(0.3, start + 0.6);
  rush.gain.exponentialRampToValueAtTime(0.0001, start + 2.95);
  const air = noise(ctx, start, 3);
  air.connect(sweep).connect(rush);
  const swirl = new DelayNode(ctx, { maxDelayTime: 0.02, delayTime: 0.006 });
  tone(ctx, 'sine', start, start + 3.1, 0.35)
    .connect(new GainNode(ctx, { gain: 0.003 }))
    .connect(swirl.delayTime);
  const feedback = new GainNode(ctx, { gain: 0.55 });
  rush.connect(dry);
  rush.connect(swirl);
  swirl.connect(feedback).connect(swirl);
  swirl.connect(dry);
  swirl.connect(new GainNode(ctx, { gain: 0.5 })).connect(wet);
  air.onended = () => feedback.disconnect();

  // A shimmer from somewhere else: a chord of tritones sinking an octave, wavering harder as it goes.
  const shimmer = new GainNode(ctx, { gain: 0 });
  shimmer.gain.setValueAtTime(0.0001, at + 0.2);
  shimmer.gain.exponentialRampToValueAtTime(0.06, at + 0.8);
  shimmer.gain.exponentialRampToValueAtTime(0.0001, at + 3.3);
  const wobble = new GainNode(ctx, { gain: 0 });
  wobble.gain.setValueAtTime(0, at + 0.2);
  wobble.gain.linearRampToValueAtTime(45, at + 3);
  tone(ctx, 'sine', at + 0.2, at + 3.4, 6.2).connect(wobble);
  for (const frequency of [523.25, 739.99, 987.77, 1396.91]) {
    const voice = tone(ctx, 'triangle', at + 0.2, at + 3.4, frequency);
    voice.detune.setValueAtTime(0, at + 0.2);
    voice.detune.linearRampToValueAtTime(-1200, at + 3.2);
    wobble.connect(voice.detune);
    voice.connect(shimmer);
  }
  shimmer.connect(new GainNode(ctx, { gain: 0.3 })).connect(dry);
  shimmer.connect(wet);
}

/** A channel changing on an old set: the tuner's click, a breath of static under the picture's sync buzz, the click of it catching. */
function channel(ctx: BaseAudioContext, { dry }: Out, at: number) {
  burst(ctx, dry, at, 0.008, 3200, 2, 0.35);
  thump(ctx, dry, at, 220, 120, 0.04, 0.18);
  const hiss = new GainNode(ctx, { gain: 0 });
  hiss.gain.setValueAtTime(0, at + 0.012);
  hiss.gain.linearRampToValueAtTime(0.12, at + 0.03);
  hiss.gain.setValueAtTime(0.12, at + 0.15);
  hiss.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  const set = tvSpeaker(ctx);
  noise(ctx, at + 0.012, 0.22).connect(set.input);
  set.output.connect(hiss).connect(dry);
  tone(ctx, 'sawtooth', at + 0.02, at + 0.2, 59.94)
    .connect(lowpass(ctx, 1200))
    .connect(envelope(ctx, at + 0.02, 0.08, 0.01, 0.15))
    .connect(dry);
  burst(ctx, dry, at + 0.19, 0.008, 2800, 2, 0.2);
}

/** Crashing into the booth: a body through planks onto old mattresses, splinters and grit settling, and the boom of the pillar below. */
function landing(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  thump(ctx, dry, at, 95, 42, 0.3, 0.75);
  noise(ctx, at, 0.15)
    .connect(lowpass(ctx, 380))
    .connect(envelope(ctx, at, 0.5, 0.003, 0.12))
    .connect(dry);
  for (let i = 0; i < 4; i++) burst(ctx, dry, at + rand(0.03, 0.25), rand(0.03, 0.06), rand(250, 700), 1.2, rand(0.05, 0.12));
  for (const [frequency, peak] of [
    [58, 0.22],
    [87, 0.12],
    [131, 0.05],
  ]) {
    tone(ctx, 'sine', at + 0.02, at + 1.6, frequency)
      .connect(envelope(ctx, at + 0.02, peak, 0.01, 1.4))
      .connect(wet);
  }
}

/** The slide projector jolted on: its rocker switch, the fan motor spinning up to speed, the lamp catching with a tick. */
function projector(ctx: BaseAudioContext, { dry }: Out, at: number) {
  burst(ctx, dry, at, 0.01, 2200, 2, 0.35);
  thump(ctx, dry, at, 130, 70, 0.06, 0.3);
  tone(ctx, 'sawtooth', at + 0.03, at + 1.3, 22, 96, 0.9)
    .connect(lowpass(ctx, 600, 1))
    .connect(envelope(ctx, at + 0.03, 0.09, 0.4, 0.8))
    .connect(dry);
  const whir = band(ctx, 300, 1.2);
  whir.frequency.setValueAtTime(300, at + 0.05);
  whir.frequency.exponentialRampToValueAtTime(1400, at + 1);
  noise(ctx, at + 0.05, 1.2)
    .connect(whir)
    .connect(envelope(ctx, at + 0.05, 0.06, 0.5, 0.65))
    .connect(dry);
  burst(ctx, dry, at + 0.18, 0.006, 3400, 3, 0.18);
  tone(ctx, 'sine', at + 0.2, at + 1.2, 100)
    .connect(envelope(ctx, at + 0.2, 0.08, 0.1, 0.9))
    .connect(dry);
}

/** A carousel projector changing slides: ka-, the slide lifting out of the gate, the tray turning a notch, -chunk as the next one drops in. */
function slide(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  burst(ctx, dry, at, 0.012, 1900, 2.5, 0.4);
  thump(ctx, dry, at, 180, 90, 0.05, 0.25);
  noise(ctx, at + 0.02, 0.1)
    .connect(band(ctx, 3200, 1.5))
    .connect(envelope(ctx, at + 0.02, 0.08, 0.02, 0.07))
    .connect(dry);
  burst(ctx, dry, at + 0.12, 0.006, 4200, 3, 0.18);
  burst(ctx, dry, at + 0.15, 0.006, 3600, 3, 0.12);
  burst(ctx, dry, at + 0.24, 0.014, 1500, 2, 0.45);
  thump(ctx, dry, at + 0.24, 140, 75, 0.07, 0.35);
  burst(ctx, wet, at + 0.25, 0.02, 2000, 1.5, 0.08);
}

/** The rope snapping and the sheet dropping: fibres tearing, the cloth flapping down, a soft heap, and the dark outside opening up. */
function sheet(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  noise(ctx, at, 0.05)
    .connect(highpass(ctx, 1200))
    .connect(envelope(ctx, at, 0.45, 0.001, 0.045))
    .connect(dry);
  tone(ctx, 'triangle', at, at + 0.25, 220, 140, 0.2)
    .connect(band(ctx, 400, 3))
    .connect(envelope(ctx, at, 0.12, 0.003, 0.2))
    .connect(dry);
  const flap = new GainNode(ctx, { gain: 0.5 });
  tone(ctx, 'sine', at + 0.04, at + 0.6, 14)
    .connect(new GainNode(ctx, { gain: 0.5 }))
    .connect(flap.gain);
  noise(ctx, at + 0.04, 0.55)
    .connect(band(ctx, 900, 0.8))
    .connect(flap)
    .connect(envelope(ctx, at + 0.04, 0.3, 0.12, 0.4))
    .connect(dry);
  noise(ctx, at + 0.5, 0.15)
    .connect(lowpass(ctx, 500))
    .connect(envelope(ctx, at + 0.5, 0.25, 0.005, 0.13))
    .connect(dry);
  thump(ctx, dry, at + 0.5, 90, 50, 0.12, 0.2);
  noise(ctx, at + 0.3, 1.6)
    .connect(band(ctx, 300, 0.6))
    .connect(envelope(ctx, at + 0.3, 0.08, 0.5, 1))
    .connect(wet);
}

/** The loop's seam, in the black: the tape rewinding with a chattering squeal, then catching again. */
function seam(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  const squeal = band(ctx, 500, 7);
  squeal.frequency.setValueAtTime(500, at);
  squeal.frequency.exponentialRampToValueAtTime(5200, at + 0.55);
  squeal.frequency.exponentialRampToValueAtTime(900, at + 0.8);
  const chatter = new GainNode(ctx, { gain: 0.5 });
  tone(ctx, 'square', at, at + 0.9, 26)
    .connect(new GainNode(ctx, { gain: 0.5 }))
    .connect(chatter.gain);
  noise(ctx, at, 0.9)
    .connect(squeal)
    .connect(chatter)
    .connect(envelope(ctx, at, 0.25, 0.05, 0.8))
    .connect(dry);
  tone(ctx, 'sawtooth', at, at + 0.8, 180, 620, 0.6)
    .connect(lowpass(ctx, 1400))
    .connect(envelope(ctx, at, 0.05, 0.05, 0.7))
    .connect(dry);
  thump(ctx, dry, at + 0.85, 140, 60, 0.15, 0.35);
  burst(ctx, dry, at + 0.85, 0.03, 1800, 1.5, 0.25);
  burst(ctx, wet, at + 0.9, 0.03, 3000, 2, 0.15);
}

/** The bulb catching: its switch, the filament's ping and fizz, a warm swell, and the buzz of it burning. */
function bulb(ctx: BaseAudioContext, { dry, wet }: Out, at: number) {
  burst(ctx, dry, at, 0.008, 2400, 2, 0.3);
  for (const [frequency, peak, decay] of [
    [3800, 0.06, 0.25],
    [5700, 0.03, 0.15],
  ]) {
    const ping = envelope(ctx, at + 0.03, peak, 0.002, decay);
    tone(ctx, 'sine', at + 0.03, at + 0.4, frequency).connect(ping);
    ping.connect(dry);
    ping.connect(wet);
  }
  noise(ctx, at + 0.02, 0.15)
    .connect(highpass(ctx, 5000))
    .connect(envelope(ctx, at + 0.02, 0.12, 0.004, 0.12))
    .connect(dry);
  tone(ctx, 'sine', at + 0.04, at + 0.9, 70, 100, 0.4)
    .connect(envelope(ctx, at + 0.04, 0.35, 0.12, 0.6))
    .connect(dry);
  tone(ctx, 'sawtooth', at + 0.05, at + 1.7, 100)
    .connect(band(ctx, 1000, 1.5))
    .connect(envelope(ctx, at + 0.05, 0.05, 0.08, 1.5))
    .connect(dry);
}

/** The camera settling on the next monitor: a flick of static, the tuner sliding, a beep as it locks on. */
function tune(ctx: BaseAudioContext, { dry }: Out, at: number) {
  const set = tvSpeaker(ctx);
  noise(ctx, at, 0.08).connect(set.input);
  set.output.connect(envelope(ctx, at, 0.05, 0.002, 0.07)).connect(dry);
  tone(ctx, 'sine', at, at + 0.12, 1600, 820, 0.08)
    .connect(envelope(ctx, at, 0.07, 0.003, 0.09))
    .connect(dry);
  tone(ctx, 'sine', at + 0.09, at + 0.25, 1046.5)
    .connect(envelope(ctx, at + 0.09, 0.06, 0.004, 0.12))
    .connect(dry);
  tone(ctx, 'sine', at + 0.09, at + 0.2, 2093)
    .connect(envelope(ctx, at + 0.09, 0.02, 0.004, 0.08))
    .connect(dry);
}

/** One drop into still water: a plink rising in pitch, ringing round the dark. */
function drop(ctx: BaseAudioContext, { dry, wet }: Out, at: number, peak: number) {
  const from = rand(900, 1500);
  const plink = envelope(ctx, at, 0.22 * peak, 0.001, 0.07);
  tone(ctx, 'sine', at, at + 0.12, from, from * 1.9, 0.035).connect(plink);
  plink.connect(new GainNode(ctx, { gain: 0.4 })).connect(dry);
  plink.connect(wet);
  noise(ctx, at, 0.01)
    .connect(highpass(ctx, 3000))
    .connect(envelope(ctx, at, 0.05 * peak, 0.0005, 0.004))
    .connect(dry);
}

/** A bubble coming up through water: a sine flicking up in pitch. */
function bubble(ctx: BaseAudioContext, out: AudioNode, at: number, from: number, peak: number) {
  const seconds = rand(0.03, 0.06);
  tone(ctx, 'sine', at, at + seconds + 0.03, from, from * 2.2, seconds)
    .connect(envelope(ctx, at, peak, 0.002, seconds))
    .connect(out);
}

/** The tapes rising out of the water: a slosh, bubbles, water running off them, plastic knocking plastic. */
function tapes(ctx: BaseAudioContext, out: Out, at: number) {
  const slosh = lowpass(ctx, 400, 0.8);
  slosh.frequency.setValueAtTime(400, at);
  slosh.frequency.linearRampToValueAtTime(1100, at + 0.3);
  slosh.frequency.linearRampToValueAtTime(500, at + 0.8);
  const body = envelope(ctx, at, 0.25, 0.08, 0.6);
  noise(ctx, at, 0.9).connect(slosh).connect(body);
  body.connect(out.dry);
  body.connect(out.wet);
  for (let i = 0; i < 10; i++) bubble(ctx, i % 2 ? out.dry : out.wet, at + rand(0.05, 1.3), rand(300, 700), rand(0.06, 0.14));
  for (let i = 0; i < 4; i++) drop(ctx, out, at + rand(0.6, 1.6), 0.5);
  burst(ctx, out.dry, at + 0.2, 0.01, 2300, 4, 0.15);
  burst(ctx, out.dry, at + 0.5, 0.01, 2600, 4, 0.12);
}

const TICK_NOTES = [1568, 1760, 2093, 2349, 2637, 3136];

/** A character landing as it decodes: a tiny data blip and click, on a random note. */
function tick(ctx: BaseAudioContext, { dry }: Out, at: number) {
  tone(ctx, 'square', at, at + 0.03, pick(TICK_NOTES))
    .connect(lowpass(ctx, 5000))
    .connect(envelope(ctx, at, 0.035, 0.001, 0.014))
    .connect(dry);
  burst(ctx, dry, at, 0.004, 6000, 1.2, 0.04);
}

/** The pointer over a control: a soft, rising blip. */
function hover(ctx: BaseAudioContext, { dry }: Out, at: number) {
  tone(ctx, 'sine', at, at + 0.06, 2400, 2900, 0.025)
    .connect(envelope(ctx, at, 0.05, 0.002, 0.04))
    .connect(dry);
  burst(ctx, dry, at, 0.004, 5200, 1.5, 0.04);
}

/** A switch flicked down, and springing back. */
function toggle(ctx: BaseAudioContext, { dry }: Out, at: number) {
  burst(ctx, dry, at, 0.008, 3000, 2, 0.25);
  thump(ctx, dry, at, 190, 95, 0.05, 0.25);
  burst(ctx, dry, at + 0.07, 0.006, 3600, 2, 0.12);
}

/** The room's failing lamp: the filament crackling as it dips, and a breath of buzz. */
function crackle(ctx: BaseAudioContext, { dry }: Out, at: number) {
  const pops = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < pops; i++) burst(ctx, dry, at + rand(0, 0.09), rand(0.002, 0.004), rand(2000, 6000), 1.4, rand(0.05, 0.15));
  tone(ctx, 'sawtooth', at, at + 0.1, 100)
    .connect(band(ctx, 900, 2))
    .connect(envelope(ctx, at, 0.04, 0.005, 0.06))
    .connect(dry);
}

const GLITCH_NOTES = [80, 160, 320, 640, 1280, 2560];

/** A crashed window tearing: a square wave jumping between notes, cut up, with noise in the cuts. */
function glitch(ctx: BaseAudioContext, { dry }: Out, at: number) {
  const seconds = rand(0.09, 0.22);
  const osc = tone(ctx, 'square', at, at + seconds, 320);
  const gate = new GainNode(ctx, { gain: 0 });
  const cuts = new GainNode(ctx, { gain: 0 });
  for (let t = 0; t < seconds; t += rand(0.012, 0.025)) {
    osc.frequency.setValueAtTime(pick(GLITCH_NOTES) * rand(0.9, 1.1), at + t);
    const on = Math.random() < 0.7;
    gate.gain.setValueAtTime(on ? 1 : 0, at + t);
    cuts.gain.setValueAtTime(on ? 0 : 1, at + t);
  }
  gate.gain.setValueAtTime(0, at + seconds);
  cuts.gain.setValueAtTime(0, at + seconds);
  osc
    .connect(highpass(ctx, 120))
    .connect(gate)
    .connect(new GainNode(ctx, { gain: 0.06 }))
    .connect(dry);
  noise(ctx, at, seconds)
    .connect(band(ctx, rand(1500, 4000), 1))
    .connect(cuts)
    .connect(new GainNode(ctx, { gain: 0.08 }))
    .connect(dry);
}

const VOICES: Record<Sfx, Voice> = {
  'power-on': powerOn,
  'floor-break': floorBreak,
  landing,
  projector,
  slide,
  sheet,
  channel,
  seam,
  bulb,
  tapes,
  tune,
  drip: (ctx, out, at) => drop(ctx, out, at, 1),
  tick,
  hover,
  toggle,
  crackle,
  glitch,
};

export const isSfx = (name: string): name is Sfx => Object.hasOwn(VOICES, name);

/** Each voice's place in the mix (gain), set by ear and by measuring them offline against the music. */
const MIX: Record<Sfx, number> = {
  'power-on': 1.6,
  'floor-break': 1,
  landing: 1,
  projector: 2.2,
  slide: 1.6,
  sheet: 1.4,
  channel: 1.25,
  seam: 1,
  bulb: 1,
  tapes: 2.5,
  tune: 2,
  drip: 2,
  tick: 2,
  hover: 1.8,
  toggle: 1,
  crackle: 2.5,
  glitch: 1,
};

/**
 * The least time (s) between two of the same sound: ticks chatter instead of buzzing, and a
 * floor scrolled back and forth over breaks once a moment, not on every crossing.
 */
const SPACING: Record<Sfx, number> = {
  'power-on': 1,
  'floor-break': 1.5,
  landing: 0.8,
  projector: 1.5,
  slide: 0.12,
  sheet: 1,
  channel: 0.15,
  seam: 1,
  bulb: 0.8,
  tapes: 1.5,
  tune: 0.12,
  drip: 0.05,
  tick: 0.03,
  hover: 0.05,
  toggle: 0.05,
  crackle: 0.05,
  glitch: 0.08,
};

export class Spacer {
  private readonly last = new Map<Sfx, number>();

  /** Whether `name` may sound at `now` (seconds); if so, it counts as sounding then. */
  allow(name: Sfx, now: number): boolean {
    const last = this.last.get(name);
    if (last !== undefined && now - last < SPACING[name]) return false;
    this.last.set(name, now);
    return true;
  }
}

/** Impulse response of the dark below: two and a half seconds of noise, darkening as it dies away. */
function cavern(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2.5);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      low += 0.3 * (Math.random() * 2 - 1 - low);
      data[i] = low * Math.pow(1 - i / length, 3);
    }
  }
  return buffer;
}

/** How loud the scene's sounds sit against the music. */
const LEVEL = 0.8;

/** Where every voice and bed plays: a shared echo, and a compressor holding them together. */
export class SfxBus {
  /** The dry input; the beds (beds.ts) play into it too. */
  readonly input: GainNode;
  private readonly send: GainNode;
  private readonly awake: GainNode;
  private readonly spacer = new Spacer();

  constructor(
    readonly ctx: BaseAudioContext,
    destination: AudioNode = ctx.destination,
  ) {
    this.awake = new GainNode(ctx, { gain: 1 });
    const glue = new DynamicsCompressorNode(ctx, { threshold: -16, knee: 10, ratio: 4, attack: 0.003, release: 0.25 });
    this.input = new GainNode(ctx, { gain: LEVEL });
    this.input.connect(glue).connect(this.awake).connect(destination);
    this.send = new GainNode(ctx, { gain: 0.6 });
    this.send.connect(new ConvolverNode(ctx, { buffer: cavern(ctx) })).connect(this.input);
  }

  /** Plays `name` at `at` (audio clock seconds), unless the same sound only just played. */
  play(name: Sfx, opts: SfxOptions = {}, at = this.ctx.currentTime + 0.005): void {
    if (!this.spacer.allow(name, at)) return;
    const level = (opts.level ?? 1) * MIX[name];
    const pan = Math.max(-1, Math.min(1, opts.pan ?? 0));
    const dry = new GainNode(this.ctx, { gain: level });
    dry.connect(new StereoPannerNode(this.ctx, { pan })).connect(this.input);
    const wet = new GainNode(this.ctx, { gain: level });
    wet.connect(new StereoPannerNode(this.ctx, { pan: pan * 0.5 })).connect(this.send);
    VOICES[name](this.ctx, { dry, wet }, at);
  }

  /** Fades every sound out while the tab is hidden, and back in when it shows again. */
  setAwake(on: boolean) {
    this.awake.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
  }
}

let bus: SfxBus | null = null;

/** The bus once a sound has made it, without touching the audio (for code running every frame). */
export function currentSfxBus(): SfxBus | null {
  return bus;
}

/** Plays one of the scene's sounds now. The first one makes the bus (it comes with PLAY). */
export function playSfx(name: Sfx, opts?: SfxOptions): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    bus ??= new SfxBus(ctx);
    bus.play(name, opts);
  } catch {
    // Silence is fine.
  }
}
