// Runs in the page before the app, so the player keeps time without an audio device: every node is a no-op and the clock follows wall time.
export function stubAudioContext() {
  const node: object = new Proxy(function () {}, {
    get: (_, key) => (typeof key === 'symbol' || key === 'then' ? undefined : key === 'value' ? 0 : node),
    set: () => true,
    apply: () => node,
  });
  class StubAudioContext {
    sampleRate = 44100;
    baseLatency = 0;
    outputLatency = 0;
    destination = node;
    state = 'running';
    startedAt = performance.now();
    constructor() {
      return new Proxy(this, {
        get: (context, key) => (key in context || typeof key === 'symbol' || !key.startsWith('create') ? Reflect.get(context, key) : () => node),
      });
    }
    get currentTime() { return (performance.now() - this.startedAt) / 1000; }
    resume() { return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBuffer(channels: number, length: number, sampleRate: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (channel: number) => data[channel] };
    }
  }
  Object.defineProperty(window, 'AudioContext', { value: StubAudioContext, configurable: true });
}
