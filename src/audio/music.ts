import { audioContext, noiseBuffer } from './context';
import type { Mood } from './mood';

/**
 * The soundtrack, synthesised like every other sound here (no recording to license): a slow
 * lo-fi chord loop on a worn tape. Detuned pads, a soft bass, a sparse electric piano through
 * an echo, and hiss, all wavering with the tape's wow and flutter. The story sets the mood
 * (mood.ts). Audio failing must never break the page.
 */

const BEAT = 60 / 68;
const EIGHTH = BEAT / 2;
/** Each chord lasts two bars of four. */
const CHORD_EIGHTHS = 16;
const CHORD = CHORD_EIGHTHS * EIGHTH;
/** Notes are scheduled this far ahead of the audio clock (s); the scheduler wakes every TICK ms. */
const AHEAD = 0.5;
const TICK = 120;
const VOLUME = 0.8;
/** Seconds to fade in on PLAY, and out when switched off or the tab is hidden. */
const FADE_IN = 5;
const FADE_OUT = 0.8;

interface Chord {
  bass: number;
  pad: number[];
}

/** Dm9, Bbmaj9, Fmaj9, Cadd9 (MIDI notes): the pad's voices barely move from one to the next. */
const PROGRESSION: Chord[] = [
  { bass: 38, pad: [53, 57, 60, 64] },
  { bass: 34, pad: [53, 57, 60, 62] },
  { bass: 41, pad: [52, 55, 57, 60] },
  { bass: 36, pad: [52, 55, 60, 62] },
];
/** The pedal: a low D held under every chord. */
const PEDAL = 38;
/** D minor pentatonic over two octaves: the melody's notes. */
const SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81];
const STEPS = [-2, -1, -1, 1, 1, 2];

const DEFAULT_MOOD: Mood = { tone: 3200, pad: 1400, notes: 0.16, pedal: 0, level: 1 };

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Impulse response of a big dark space: three seconds of noise, darkening as it dies away. */
function hall(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 3.2);
  const onset = ctx.sampleRate * 0.012;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      low += 0.22 * (Math.random() * 2 - 1 - low);
      data[i] = low * Math.pow(1 - i / length, 2.5) * Math.min(1, i / onset);
    }
  }
  return buffer;
}

/** The soundtrack's player. Takes any audio context, so it can also be rendered offline to listen to. */
export class Tape {
  /** Switches the music on and off; `level` follows the mood. */
  private readonly fade: GainNode;
  private readonly level: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly padTone: BiquadFilterNode;
  private readonly pads: GainNode;
  private readonly bassBus: GainNode;
  private readonly keys: GainNode;
  /** Wow and flutter, in cents, fed into every oscillator's detune. */
  private readonly wobble: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private walk = 3;
  private mood = DEFAULT_MOOD;

  constructor(private readonly ctx: BaseAudioContext) {
    this.fade = new GainNode(ctx, { gain: 0 });
    this.level = new GainNode(ctx, { gain: VOLUME });
    this.fade.connect(this.level).connect(ctx.destination);
    this.tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: DEFAULT_MOOD.tone, Q: 0.5 });
    this.tone.connect(this.fade);

    const reverb = new ConvolverNode(ctx, { buffer: hall(ctx) });
    reverb.connect(new GainNode(ctx, { gain: 0.55 })).connect(this.tone);

    this.padTone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: DEFAULT_MOOD.pad, Q: 0.7 });
    this.pads = new GainNode(ctx, { gain: 1 });
    this.pads.connect(this.padTone);
    this.padTone.connect(this.tone);
    this.padTone.connect(new GainNode(ctx, { gain: 0.7 })).connect(reverb);

    this.bassBus = new GainNode(ctx, { gain: 1 });
    this.bassBus.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 420 })).connect(this.tone);

    // The piano echoes a dotted quarter behind itself, each repeat duller than the last.
    this.keys = new GainNode(ctx, { gain: 1 });
    const echo = new DelayNode(ctx, { maxDelayTime: 2, delayTime: 3 * EIGHTH });
    const dull = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 2200 });
    const feedback = new GainNode(ctx, { gain: 0.32 });
    this.keys.connect(this.tone);
    this.keys.connect(new GainNode(ctx, { gain: 0.45 })).connect(reverb);
    this.keys.connect(echo);
    echo.connect(dull).connect(feedback).connect(echo);
    dull.connect(new GainNode(ctx, { gain: 0.5 })).connect(this.tone);

    this.wobble = new GainNode(ctx, { gain: 1 });
    for (const [frequency, cents] of [
      [0.45, 7],
      [6.1, 2.2],
    ]) {
      const lfo = new OscillatorNode(ctx, { frequency });
      lfo.connect(new GainNode(ctx, { gain: cents })).connect(this.wobble);
      lfo.start();
    }

    // Tape hiss, under everything and untouched by the tone.
    const hiss = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx, 3), loop: true });
    hiss
      .connect(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 1800 }))
      .connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 7000 }))
      .connect(new GainNode(ctx, { gain: 0.012 }))
      .connect(this.fade);
    hiss.start();
  }

  start() {
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(1, now + FADE_IN);
    if (this.timer !== null) return;
    if (this.next < now) {
      // Back after a pause: a fresh chord at once.
      this.step = Math.ceil(this.step / CHORD_EIGHTHS) * CHORD_EIGHTHS;
      this.next = now + 0.05;
    }
    this.timer = setInterval(() => this.cue(), TICK);
    this.cue();
  }

  stop() {
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(0, now + FADE_OUT);
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  setMood(mood: Mood) {
    const now = this.ctx.currentTime;
    this.tone.frequency.setTargetAtTime(mood.tone, now, 1.2);
    this.padTone.frequency.setTargetAtTime(mood.pad, now, 1.2);
    this.level.gain.setTargetAtTime(VOLUME * mood.level, now, 0.6);
    this.mood = mood;
  }

  /** Schedules every note that starts before `until` (audio clock seconds). */
  cue(until = this.ctx.currentTime + AHEAD) {
    while (this.next < until) {
      this.play(this.step, this.next);
      this.next += EIGHTH;
      this.step += 1;
    }
  }

  private play(step: number, at: number) {
    const inChord = step % CHORD_EIGHTHS;
    if (inChord === 0) {
      const chord = PROGRESSION[Math.floor(step / CHORD_EIGHTHS) % PROGRESSION.length];
      for (const note of chord.pad) this.pad(hz(note), at);
      this.bass(hz(this.mood.pedal > 0.5 ? PEDAL : chord.bass), at);
      return;
    }
    // The melody leans on the beats and leaves the chord's first bar mostly to the pads.
    const chance = this.mood.notes * (inChord % 2 === 0 ? 1.3 : 0.6) * (inChord < 4 ? 0.4 : 1);
    if (Math.random() >= chance) return;
    this.walk = Math.min(SCALE.length - 1, Math.max(0, this.walk + STEPS[Math.floor(Math.random() * STEPS.length)]));
    this.key(hz(SCALE[this.walk]), at + (Math.random() - 0.5) * 0.02, 0.45 + Math.random() * 0.4);
  }

  /** Starts `osc` at `at`, stops it at `end`, wavering with the tape until then. */
  private run(osc: OscillatorNode, at: number, end: number) {
    this.wobble.connect(osc.detune);
    osc.onended = () => {
      try {
        this.wobble.disconnect(osc.detune);
      } catch {
        // Already gone.
      }
      osc.disconnect();
    };
    osc.start(at);
    osc.stop(end);
  }

  /** One pad voice: two detuned saws swelling in, holding the chord, fading under the next one. */
  private pad(frequency: number, at: number) {
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.045, at + 2.4);
    env.gain.setValueAtTime(0.045, at + CHORD - 0.4);
    env.gain.linearRampToValueAtTime(0, at + CHORD + 2.6);
    env.connect(this.pads);
    for (const detune of [-7, 6]) {
      const osc = new OscillatorNode(this.ctx, { type: 'sawtooth', frequency, detune });
      osc.connect(env);
      this.run(osc, at, at + CHORD + 2.7);
    }
  }

  /** The bass: a round low note, with its octave on top so small speakers still carry the line. */
  private bass(frequency: number, at: number) {
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.08, at + 0.08);
    env.gain.exponentialRampToValueAtTime(0.04, at + CHORD * 0.6);
    env.gain.linearRampToValueAtTime(0, at + CHORD + 0.4);
    env.connect(this.bassBus);
    const low = new OscillatorNode(this.ctx, { type: 'sine', frequency });
    low.connect(env);
    const octave = new OscillatorNode(this.ctx, { type: 'triangle', frequency: frequency * 2 });
    octave.connect(new GainNode(this.ctx, { gain: 0.45 })).connect(env);
    this.run(low, at, at + CHORD + 0.5);
    this.run(octave, at, at + CHORD + 0.5);
  }

  /** An electric piano note: FM, a soft body and a bell-like tine that dies at once. */
  private key(frequency: number, at: number, velocity: number) {
    const ctx = this.ctx;
    const end = at + 2.7;
    const carrier = new OscillatorNode(ctx, { frequency });
    const body = new OscillatorNode(ctx, { frequency });
    const bodyDepth = new GainNode(ctx, { gain: 0 });
    bodyDepth.gain.setValueAtTime(frequency * 2.2 * velocity, at);
    bodyDepth.gain.exponentialRampToValueAtTime(frequency * 0.15, at + 1.4);
    body.connect(bodyDepth).connect(carrier.frequency);
    const tine = new OscillatorNode(ctx, { frequency: frequency * 7 });
    const tineDepth = new GainNode(ctx, { gain: 0 });
    tineDepth.gain.setValueAtTime(frequency * 1.2 * velocity, at);
    tineDepth.gain.exponentialRampToValueAtTime(frequency * 0.01, at + 0.12);
    tine.connect(tineDepth).connect(carrier.frequency);
    const env = new GainNode(ctx, { gain: 0.0001 });
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.15 * velocity, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.05 * velocity, at + 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 2.6);
    carrier.connect(env).connect(this.keys);
    for (const osc of [carrier, body, tine]) this.run(osc, at, end);
  }
}

let tape: Tape | null = null;

/** Plays the soundtrack, fading in; carries on where it was if it was only paused. */
export function startMusic(mood: Mood): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    tape ??= new Tape(ctx);
    tape.setMood(mood);
    tape.start();
  } catch {
    // Silence is fine.
  }
}

/** Fades the soundtrack out; notes already under way die away under the fade. */
export function stopMusic(): void {
  try {
    tape?.stop();
  } catch {
    // Silence is fine.
  }
}

export function setMusicMood(mood: Mood): void {
  try {
    tape?.setMood(mood);
  } catch {
    // Silence is fine.
  }
}
