const ROOM = {
  seconds: 0.4,
  preDelay: 0.006,
  decay: 0.08,
  // How much of each new noise sample passes the one pole low pass: lower is a darker, softer room
  wallBrightness: 0.35,
  level: 0.22,
  switchTime: 0.02,
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

export class DrumRoom {
  readonly input: AudioNode;
  private wet: GainNode;

  constructor(private context: BaseAudioContext, out: AudioNode, enabled: boolean) {
    const reverb = context.createConvolver();
    reverb.buffer = roomImpulse(context);
    this.wet = context.createGain();
    this.wet.gain.value = enabled ? ROOM.level : 0;
    reverb.connect(this.wet);
    this.wet.connect(out);
    this.input = reverb;
  }

  setEnabled(enabled: boolean) {
    this.wet.gain.setTargetAtTime(enabled ? ROOM.level : 0, this.context.currentTime, ROOM.switchTime);
  }
}
