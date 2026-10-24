import type { CameraPose, Vec3 } from '@/experience/camera/types';
import { KNUCKLES } from '@/experience/chapters/room/knock';
import { audioContext, noiseBuffer } from './context';

/**
 * A knock from inside the wall, synthesised (no sample to license): a dull knuckle
 * thump plus a dry wooden click, muffled by plaster, placed where the visitor clicked
 * and given a short tail of the small room. Audio failing must never break the page.
 */
let room: ConvolverNode | null = null;

function audio(): AudioContext | null {
  const context = audioContext();
  if (context && !room) {
    room = context.createConvolver();
    room.buffer = roomTail(context);
    const wet = context.createGain();
    wet.gain.value = 0.35;
    room.connect(wet).connect(context.destination);
  }
  return context;
}

/** Impulse response of a small, bare room: half a second of darkening noise. */
function roomTail(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.55);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      low += 0.18 * (Math.random() * 2 - 1 - low);
      data[i] = low * Math.pow(1 - i / length, 3);
    }
  }
  return buffer;
}

function hit(ctx: AudioContext, out: AudioNode, at: number, strength: number) {
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(150, at);
  thump.frequency.exponentialRampToValueAtTime(70, at + 0.09);
  const body = ctx.createGain();
  body.gain.setValueAtTime(0.0001, at);
  body.gain.exponentialRampToValueAtTime(0.9 * strength, at + 0.003);
  body.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  thump.connect(body).connect(out);
  thump.start(at);
  thump.stop(at + 0.2);

  // The knuckle on the plaster itself, high enough that laptop speakers carry it.
  const knuckle = ctx.createOscillator();
  knuckle.type = 'triangle';
  knuckle.frequency.setValueAtTime(290, at);
  knuckle.frequency.exponentialRampToValueAtTime(170, at + 0.06);
  const rap = ctx.createGain();
  rap.gain.setValueAtTime(0.0001, at);
  rap.gain.exponentialRampToValueAtTime(0.5 * strength, at + 0.002);
  rap.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  knuckle.connect(rap).connect(out);
  knuckle.start(at);
  knuckle.stop(at + 0.12);

  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(ctx, 0.06);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 700 + Math.random() * 300;
  band.Q.value = 1.4;
  const snap = ctx.createGain();
  snap.gain.setValueAtTime(0.0001, at);
  snap.gain.exponentialRampToValueAtTime(0.55 * strength, at + 0.002);
  snap.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  click.connect(band).connect(snap).connect(out);
  click.start(at);
}

let warm: PannerNode | null = null;

/**
 * Gets the knock ready at PLAY: the room's echo, and the browser's HRTF data, which it only
 * starts loading when the first spatial sound is made. Without this the first knock plays
 * while the data is still loading, and its first knuckle comes out at a third of its loudness.
 * Safari keeps that data only while some HRTF panner is alive, and a knock after the last one
 * is collected loads it again and loses its first knuckle: so the warm panner is kept for good.
 */
export function prepareKnock(): void {
  try {
    const ctx = audio();
    if (!ctx || warm) return;
    warm = new PannerNode(ctx, { panningModel: 'HRTF' });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    warm.connect(mute).connect(ctx.destination);
  } catch {
    // No sound is better than a broken room.
  }
}

/** Knock-knock at `position`, heard from the camera. */
export function playKnock(position: Vec3, listener: CameraPose): void {
  try {
    const ctx = audio();
    if (!ctx || !room) return;
    const l = ctx.listener;
    const [lx, ly, lz] = listener.position;
    const fx = listener.target[0] - lx;
    const fy = listener.target[1] - ly;
    const fz = listener.target[2] - lz;
    if (l.positionX) {
      l.positionX.value = lx;
      l.positionY.value = ly;
      l.positionZ.value = lz;
      l.forwardX.value = fx;
      l.forwardY.value = fy;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
    const panner = new PannerNode(ctx, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 1,
      rolloffFactor: 0.8,
      positionX: position[0],
      positionY: position[1],
      positionZ: position[2],
    });
    // Plaster swallows the highs.
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 2200;
    muffle.connect(panner);
    panner.connect(ctx.destination);
    panner.connect(room);
    const now = ctx.currentTime + 0.01;
    for (const { delay, strength } of KNUCKLES) hit(ctx, muffle, now + delay, strength);
  } catch {
    // No sound is better than a broken room.
  }
}
