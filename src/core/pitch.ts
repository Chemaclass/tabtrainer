export interface PitchReading { frequency: number; clarity: number }
export interface PitchOptions { minFrequency: number; maxFrequency: number; threshold: number; minLevel: number }

export const PITCH_DEFAULTS: PitchOptions = { minFrequency: 27, maxFrequency: 1400, threshold: 0.12, minLevel: 0.004 };

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Samples to analyse at once: a power of two that holds at least two periods of the lowest note. */
export function analysisSize(sampleRate: number, minFrequency = PITCH_DEFAULTS.minFrequency): number {
  return 2 ** Math.ceil(Math.log2((sampleRate / minFrequency) * 2.2));
}

/** YIN pitch detection. Returns null for silence, noise or a signal without a clear period. */
export function detectPitch(samples: ArrayLike<number>, sampleRate: number, options: Partial<PitchOptions> = {}): PitchReading | null {
  const { minFrequency, maxFrequency, threshold, minLevel } = { ...PITCH_DEFAULTS, ...options };
  const n = samples.length;
  const maxTau = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(n / 2) - 1);
  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  if (maxTau <= minTau + 1 || level(samples) < minLevel) return null;
  const width = n - maxTau - 1;
  const diff = new Float64Array(maxTau + 2);
  const cmnd = new Float64Array(maxTau + 2);
  cmnd[0] = 1;
  let running = 0, found = -1;
  for (let tau = 1; tau <= maxTau + 1; tau++) {
    let sum = 0;
    for (let j = 0; j < width; j++) { const d = samples[j] - samples[j + tau]; sum += d * d; }
    diff[tau] = sum; running += sum;
    cmnd[tau] = running > 0 ? (sum * tau) / running : 1;
    if (found < 0 && tau - 1 >= minTau && cmnd[tau - 1] < threshold && cmnd[tau] >= cmnd[tau - 1]) found = tau - 1;
    if (found >= 0 && tau > found) break;
  }
  if (found < 0) return null;
  const a = diff[found - 1], b = diff[found], c = diff[found + 1];
  const bend = a - 2 * b + c;
  const shift = bend > 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * bend))) : 0;
  return { frequency: sampleRate / (found + shift), clarity: 1 - cmnd[found] };
}

function level(samples: ArrayLike<number>): number {
  let mean = 0;
  for (let i = 0; i < samples.length; i++) mean += samples[i];
  mean /= samples.length;
  let power = 0;
  for (let i = 0; i < samples.length; i++) { const v = samples[i] - mean; power += v * v; }
  return Math.sqrt(power / samples.length);
}

export const midiOf = (frequency: number, a4 = 440) => 69 + 12 * Math.log2(frequency / a4);
export const frequencyOf = (midi: number, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
export const noteName = (midi: number) => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

export interface NoteReading { midi: number; name: string; octave: number; cents: number }

/** The nearest equal-tempered note and how far the frequency is from it, in cents. */
export function nearestNote(frequency: number, a4 = 440): NoteReading {
  const exact = midiOf(frequency, a4), midi = Math.round(exact);
  return { midi, name: NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents: (exact - midi) * 100 };
}

/** The open string closest to the frequency and the cents from it (negative is flat). `strings` are sounding MIDI notes. */
export function nearestString(frequency: number, strings: readonly number[], a4 = 440): { index: number; cents: number } | null {
  if (strings.length === 0) return null;
  const exact = midiOf(frequency, a4);
  let index = 0;
  strings.forEach((midi, i) => { if (Math.abs(exact - midi) < Math.abs(exact - strings[index])) index = i; });
  return { index, cents: (exact - strings[index]) * 100 };
}

/** Steadies a stream of readings: the median of recent ones, restarted when the note changes, dropped after a run of silence. */
export class PitchTracker {
  private recent: number[] = [];
  private misses = 0;
  constructor(private size = 5, private patience = 8) {}

  push(frequency: number | null): number | null {
    if (frequency === null) {
      if (++this.misses >= this.patience) this.recent = [];
      return this.current;
    }
    this.misses = 0;
    const now = this.current;
    if (now !== null && Math.abs(midiOf(frequency) - midiOf(now)) > 0.6) this.recent = [];
    this.recent.push(frequency);
    if (this.recent.length > this.size) this.recent.shift();
    return this.current;
  }
  get current(): number | null {
    if (this.recent.length === 0) return null;
    const sorted = [...this.recent].sort((x, y) => x - y), mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  reset() { this.recent = []; this.misses = 0; }
}
