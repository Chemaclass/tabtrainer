import { analysisSize, detectPitch, type PitchReading } from '../core/pitch';

export type MicProblem = 'denied' | 'missing' | 'busy' | 'unsupported' | 'failed';

const PROBLEMS: Record<string, MicProblem> = {
  NotAllowedError: 'denied', SecurityError: 'denied', PermissionDeniedError: 'denied',
  NotFoundError: 'missing', DevicesNotFoundError: 'missing', OverconstrainedError: 'missing',
  NotReadableError: 'busy', TrackStartError: 'busy', AbortError: 'busy',
};

/** Listens to the microphone and reports a pitch reading, or null, about twenty times a second. */
export class PitchListener {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private attempt = 0;

  get listening() { return this.stream !== null; }

  /** Resolves null once listening, 'superseded' when stopped or restarted before the microphone answered, or the problem. */
  async start(onReading: (reading: PitchReading | null) => void, onLost: (problem: MicProblem) => void): Promise<MicProblem | 'superseded' | null> {
    if (this.stream) return null;
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    const attempt = ++this.attempt;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (error) {
      if (attempt !== this.attempt) return 'superseded';
      return error instanceof DOMException ? PROBLEMS[error.name] ?? 'failed' : 'failed';
    }
    if (attempt !== this.attempt) { stream.getTracks().forEach(track => track.stop()); return 'superseded'; }
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = Math.min(32768, analysisSize(ctx.sampleRate));
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      this.stream = stream; this.ctx = ctx;
      stream.getTracks().forEach(track => track.addEventListener('ended', () => { if (this.stream === stream) { this.stop(); onLost('missing'); } }));
      void ctx.resume();
      this.timer = setInterval(() => { analyser.getFloatTimeDomainData(samples); onReading(detectPitch(samples, ctx.sampleRate)); }, 50);
      return null;
    } catch {
      stream.getTracks().forEach(track => track.stop());
      this.stop();
      return 'failed';
    }
  }

  stop() {
    this.attempt++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    this.ctx = null;
  }
}
