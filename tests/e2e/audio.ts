/** Listening to what the page plays, for the sound tests. */

declare global {
  interface Window {
    /** [audio time (s), loudness (RMS)] every 10 ms of what the page sends to its speakers. */
    __levels?: [number, number][];
    /** The page's audio context, once it has one. */
    __audio?: BaseAudioContext;
  }
}

/**
 * Taps everything the page plays: every context's destination becomes a gain node that
 * passes the sound on and feeds an AudioWorklet, which measures it on the audio thread.
 */
export function tapSpeakers() {
  const levels: [number, number][] = [];
  window.__levels = levels;
  const speakers = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination')?.get;
  if (!speakers) return;
  const taps = new WeakMap<BaseAudioContext, GainNode>();
  const meter = `registerProcessor('meter', class extends AudioWorkletProcessor {
    constructor() { super(); this.sum = 0; this.n = 0; this.from = 0; }
    process(inputs) {
      const [left, right] = inputs[0];
      if (this.n === 0) this.from = currentTime;
      for (let i = 0; i < 128; i++) {
        const l = left ? left[i] : 0, r = right ? right[i] : l;
        this.sum += (l * l + r * r) / 2;
      }
      this.n += 128;
      if (this.n >= 480) { this.port.postMessage([this.from, Math.sqrt(this.sum / this.n)]); this.sum = 0; this.n = 0; }
      return true;
    }
  });`;
  Object.defineProperty(BaseAudioContext.prototype, 'destination', {
    get(this: BaseAudioContext) {
      let tap = taps.get(this);
      if (!tap) {
        window.__audio ??= this;
        const out = speakers.call(this) as AudioDestinationNode;
        const node = this.createGain();
        tap = node;
        taps.set(this, node);
        node.connect(out);
        const url = URL.createObjectURL(new Blob([meter], { type: 'application/javascript' }));
        void this.audioWorklet.addModule(url).then(() => {
          const worklet = new AudioWorkletNode(this, 'meter', { channelCount: 2, channelCountMode: 'explicit' });
          const silent = this.createGain();
          silent.gain.value = 0;
          node.connect(worklet).connect(silent).connect(out);
          worklet.port.onmessage = (event: MessageEvent<[number, number]>) => levels.push(event.data);
        });
      }
      return tap;
    },
  });
}

export const db = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-9));
