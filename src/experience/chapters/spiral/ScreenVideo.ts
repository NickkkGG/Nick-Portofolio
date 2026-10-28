import { SRGBColorSpace, VideoTexture } from 'three';
import { heldVideoTime } from './signal';

/** The visitor's touches that let a browser play a video it refused to autoplay. */
const TOUCHES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * A project screen's preview: a muted, looping, inline video kept off the page, and the
 * texture the screen samples it through. It runs and rests as the frame loop says. A browser
 * that refuses to autoplay it gets asked again at the visitor's next touch; a file that fails
 * never becomes ready, so the screen keeps its static.
 */
export class ScreenVideo {
  readonly texture: VideoTexture;
  private readonly video = document.createElement('video');
  private loaded = false;
  private failed = false;
  /** A frame of it has reached the texture. */
  private framed = false;
  /** Holding still for a frozen clock rather than playing. */
  private holding = false;
  private starting = false;
  /** play() was refused: waiting for a touch. */
  private refused = false;
  private frameCallback = 0;

  constructor(private readonly src: string) {
    const video = this.video;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('error', this.fail);
    video.addEventListener('loadeddata', this.frameArrived);
    video.addEventListener('seeked', this.frameArrived);
    document.addEventListener('visibilitychange', this.rest);
    this.texture = new VideoTexture(video);
    this.texture.colorSpace = SRGBColorSpace;
    // glTF UVs start at the top, like the video.
    this.texture.flipY = false;
  }

  /** Whether the screen can show it: its frames are coming and nothing has failed. */
  get ready(): boolean {
    const video = this.video;
    return !this.failed && this.framed && video.readyState >= video.HAVE_CURRENT_DATA && (this.holding || !video.paused);
  }

  /** Starts the download; once is enough. */
  load() {
    if (this.loaded) return;
    this.loaded = true;
    this.video.src = this.src;
    if ('requestVideoFrameCallback' in this.video) this.frameCallback = this.video.requestVideoFrameCallback(this.onFrame);
  }

  /** Every frame: run or rest, or for a frozen clock hold the frame at `frozenAt` seconds into its loop. */
  update(run: boolean, frozenAt: number | null) {
    const video = this.video;
    this.holding = frozenAt !== null;
    if (!this.loaded || this.failed) return;
    if (frozenAt !== null) {
      if (!video.paused) video.pause();
      if (run) this.hold(frozenAt);
    } else if (run && !document.hidden) this.start();
    else if (!video.paused) video.pause();
  }

  dispose() {
    const video = this.video;
    video.removeEventListener('error', this.fail);
    video.removeEventListener('loadeddata', this.frameArrived);
    video.removeEventListener('seeked', this.frameArrived);
    document.removeEventListener('visibilitychange', this.rest);
    for (const type of TOUCHES) window.removeEventListener(type, this.touched);
    if (this.frameCallback) video.cancelVideoFrameCallback(this.frameCallback);
    video.pause();
    // Lets go of the download and the decoder.
    video.removeAttribute('src');
    video.load();
    this.texture.dispose();
  }

  private start() {
    const video = this.video;
    if (!video.paused || this.starting || this.refused) return;
    this.starting = true;
    video.play().then(
      () => {
        this.starting = false;
      },
      (error: unknown) => {
        this.starting = false;
        // An AbortError only means it was paused again before it got going.
        if (error instanceof DOMException && error.name === 'NotAllowedError') this.waitForTouch();
      },
    );
  }

  private hold(at: number) {
    const video = this.video;
    const target = heldVideoTime(at, video.duration);
    if (!video.seeking && Math.abs(video.currentTime - target) > 0.01) video.currentTime = target;
  }

  private waitForTouch() {
    this.refused = true;
    for (const type of TOUCHES) window.addEventListener(type, this.touched, { passive: true });
  }

  private readonly touched = () => {
    for (const type of TOUCHES) window.removeEventListener(type, this.touched);
    this.refused = false;
    // Played inside the touch, where the browser allows it; the frame loop rests it again if it is not wanted.
    this.start();
  };

  private readonly onFrame = () => {
    this.frameArrived();
    this.frameCallback = this.video.requestVideoFrameCallback(this.onFrame);
  };

  private readonly frameArrived = () => {
    this.framed = true;
    this.texture.needsUpdate = true;
  };

  private readonly fail = () => {
    this.failed = true;
  };

  private readonly rest = () => {
    if (document.hidden && !this.video.paused) this.video.pause();
  };
}
