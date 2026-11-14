import { vi } from 'vitest';

export type FakeParam = ReturnType<typeof param>;
export interface FakeSource { kind: 'oscillator' | 'noise'; type: string; frequency: FakeParam; detune: FakeParam; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: (to: unknown) => void; buffer?: unknown; loop?: boolean }
export interface FakeCompressor { threshold: FakeParam; knee: FakeParam; ratio: FakeParam; attack: FakeParam; release: FakeParam; connect: (to: unknown) => void; outputs: unknown[] }
export interface FakeGain { gain: FakeParam; connect: (to: unknown) => void; disconnect: (from: unknown) => void; outputs: unknown[] }

const param = (value = 0) => ({
  value,
  setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
});

export function fakeAudio() {
  vi.useFakeTimers();
  const clock = { now: 0 };
  const sources: FakeSource[] = [], gains: FakeGain[] = [], buffers: unknown[] = [], filters: { type: string }[] = [];
  const shapers: { curve: Float32Array | null; outputs: unknown[] }[] = [], compressors: FakeCompressor[] = [];
  const convolvers: { buffer: unknown; outputs: unknown[] }[] = [];
  const source = (kind: FakeSource['kind']): FakeSource => {
    const s: FakeSource = { kind, type: '', frequency: param(), detune: param(), start: vi.fn(), stop: vi.fn(), connect() {} };
    sources.push(s); return s;
  };
  class AudioContext {
    destination = {};
    sampleRate = 8000;
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    createGain() { const g: FakeGain = { gain: param(1), outputs: [], connect(to) { g.outputs.push(to); }, disconnect(from) { g.outputs = g.outputs.filter(o => o !== from); } }; gains.push(g); return g; }
    createOscillator() { return source('oscillator'); }
    createBufferSource() { const s = source('noise'); s.buffer = null; return s; }
    createBiquadFilter() { const f = { type: '', frequency: param(), Q: param(), connect() {} }; filters.push(f); return f; }
    createWaveShaper() { const w = { curve: null, oversample: 'none', outputs: [] as unknown[], connect(to: unknown) { w.outputs.push(to); } }; shapers.push(w); return w; }
    createDynamicsCompressor() {
      const c: FakeCompressor = { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), outputs: [], connect(to) { c.outputs.push(to); } };
      compressors.push(c); return c;
    }
    createConvolver() { const c = { buffer: null as unknown, outputs: [] as unknown[], connect(to: unknown) { c.outputs.push(to); } }; convolvers.push(c); return c; }
    createBuffer(_channels: number, length: number) { const data = new Float32Array(length); const b = { getChannelData: () => data }; buffers.push(b); return b; }
  }
  vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
  const advance = (time: number) => { while (clock.now < time - 1e-9) { clock.now = Math.min(time, clock.now + 0.025); vi.advanceTimersByTime(25); } };
  return { clock, sources, gains, buffers, filters, shapers, compressors, convolvers, advance };
}

export const startedAt = (s: FakeSource) => s.start.mock.calls[0][0] as number;
export const cancelled = (s: FakeSource) => s.stop.mock.calls.length > 1 && (s.stop.mock.calls.at(-1)![0] as number) <= startedAt(s);

// Records only when each source plays, so a long run stays within memory
export function countingAudio() {
  vi.useFakeTimers();
  const clock = { now: 0 };
  let live: { start: number; stop: number }[] = [];
  let started = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const source = () => {
    const played = { start: 0, stop: Infinity };
    return {
      ...node(), type: '', buffer: null, loop: false, onended: null, frequency: param(), detune: param(),
      start(when: number) { played.start = when; live.push(played); started++; },
      stop(when: number) { played.stop = when; },
    };
  };
  class AudioContext {
    destination = {};
    sampleRate = 8000;
    get currentTime() { return clock.now; }
    resume() { return Promise.resolve(); }
    createGain() { return { ...node(), gain: param() }; }
    createOscillator() { return source(); }
    createBufferSource() { return source(); }
    createBiquadFilter() { return { ...node(), type: '', frequency: param(), Q: param() }; }
    createConvolver() { return { ...node(), buffer: null }; }
    createWaveShaper() { return { ...node(), curve: null, oversample: 'none' }; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  }
  vi.stubGlobal('window', { AudioContext, setInterval, clearInterval });
  const advance = (time: number) => { while (clock.now < time - 1e-9) { clock.now = Math.min(time, clock.now + 0.025); vi.advanceTimersByTime(25); } };
  const liveAt = (time: number) => {
    live = live.filter(played => played.stop > time);
    return live.filter(played => played.start <= time).length;
  };
  return { advance, liveAt, started: () => started };
}
