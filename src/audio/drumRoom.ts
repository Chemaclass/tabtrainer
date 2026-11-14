const ROOM = {
  seconds: 0.4,
  preDelay: 0.006,
  decay: 0.08,
  // How much of each new noise sample passes the one pole low pass: lower is a darker, softer room
  wallBrightness: 0.35,
  level: 0.22,
  channels: 2,
};

export function roomImpulse(context: BaseAudioContext): AudioBuffer {
  const { sampleRate } = context;
  const length = Math.ceil(ROOM.seconds * sampleRate);
  const silentStart = Math.round(ROOM.preDelay * sampleRate);
  const impulse = context.createBuffer(ROOM.channels, length, sampleRate);
  for (let channel = 0; channel < ROOM.channels; channel++) {
    const samples = impulse.getChannelData(channel);
    let darkened = 0;
    for (let i = silentStart; i < length; i++) {
      const noise = Math.random() * 2 - 1;
      darkened += (noise - darkened) * ROOM.wallBrightness;
      const seconds = (i - silentStart) / sampleRate;
      samples[i] = darkened * Math.exp(-seconds / ROOM.decay);
    }
  }
  return impulse;
}

// Switching off unplugs the drums from the reverb, so it stops costing CPU and its tail rings out on its own
export class DrumRoom {
  private reverb: ConvolverNode;
  private enabled = false;

  constructor(context: BaseAudioContext, private drums: AudioNode, out: AudioNode, enabled: boolean) {
    this.reverb = context.createConvolver();
    this.reverb.buffer = roomImpulse(context);
    const wet = context.createGain();
    wet.gain.value = ROOM.level;
    this.reverb.connect(wet);
    wet.connect(out);
    this.setEnabled(enabled);
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) this.drums.connect(this.reverb);
    else this.drums.disconnect(this.reverb);
  }
}
