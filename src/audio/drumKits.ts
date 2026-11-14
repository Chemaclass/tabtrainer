import type { DrumKitName } from '../core/groove';

export interface KickTuning { startFrequency: number; endFrequency: number; pitchDrop: number; decay: number; clickLevel: number }
export interface SnareTuning { lowMode: number; highMode: number; bodyDecay: number; snapLevel: number; wireLevel: number; wireDecay: number }
export interface HatTuning { fundamental: number; closedDecay: number; halfDecay: number; openDecay: number }
export interface CymbalTuning { rideDecay: number; crashDecay: number }
export interface TomTuning { high: number; mid: number; low: number; decay: number }
export interface DrummerFeel {
  // How far hits drift from the grid, as a multiple of the default humanize time
  looseness: number;
  hatLagSeconds: number;
}

export interface DrumKitTuning {
  kick: KickTuning;
  snare: SnareTuning;
  hat: HatTuning;
  cymbal: CymbalTuning;
  tom: TomTuning;
  feel: DrummerFeel;
}

const ROCK: DrumKitTuning = {
  kick: { startFrequency: 150, endFrequency: 50, pitchDrop: 0.05, decay: 0.12, clickLevel: 0.4 },
  snare: { lowMode: 185, highMode: 330, bodyDecay: 0.05, snapLevel: 0.6, wireLevel: 0.5, wireDecay: 0.1 },
  hat: { fundamental: 40, closedDecay: 0.025, halfDecay: 0.1, openDecay: 0.35 },
  cymbal: { rideDecay: 0.4, crashDecay: 0.7 },
  tom: { high: 200, mid: 150, low: 105, decay: 0.12 },
  feel: { looseness: 1, hatLagSeconds: 0 },
};

const BLUES: DrumKitTuning = {
  kick: { startFrequency: 130, endFrequency: 48, pitchDrop: 0.06, decay: 0.14, clickLevel: 0.3 },
  snare: { lowMode: 175, highMode: 315, bodyDecay: 0.055, snapLevel: 0.55, wireLevel: 0.5, wireDecay: 0.12 },
  hat: { fundamental: 38, closedDecay: 0.03, halfDecay: 0.11, openDecay: 0.4 },
  cymbal: { rideDecay: 0.45, crashDecay: 0.75 },
  tom: { high: 190, mid: 145, low: 100, decay: 0.13 },
  feel: { looseness: 1.6, hatLagSeconds: 0.006 },
};

const FUNK: DrumKitTuning = {
  kick: { startFrequency: 160, endFrequency: 55, pitchDrop: 0.035, decay: 0.07, clickLevel: 0.5 },
  snare: { lowMode: 220, highMode: 390, bodyDecay: 0.035, snapLevel: 0.7, wireLevel: 0.45, wireDecay: 0.07 },
  hat: { fundamental: 42, closedDecay: 0.02, halfDecay: 0.08, openDecay: 0.3 },
  cymbal: { rideDecay: 0.35, crashDecay: 0.6 },
  tom: { high: 220, mid: 165, low: 120, decay: 0.09 },
  feel: { looseness: 0.5, hatLagSeconds: 0 },
};

const REGGAE: DrumKitTuning = {
  kick: { startFrequency: 110, endFrequency: 45, pitchDrop: 0.08, decay: 0.25, clickLevel: 0.2 },
  snare: { lowMode: 260, highMode: 450, bodyDecay: 0.04, snapLevel: 0.75, wireLevel: 0.35, wireDecay: 0.08 },
  hat: { fundamental: 40, closedDecay: 0.025, halfDecay: 0.1, openDecay: 0.35 },
  cymbal: { rideDecay: 0.4, crashDecay: 0.7 },
  tom: { high: 260, mid: 190, low: 140, decay: 0.1 },
  feel: { looseness: 1.8, hatLagSeconds: 0.012 },
};

const JAZZ: DrumKitTuning = {
  kick: { startFrequency: 120, endFrequency: 60, pitchDrop: 0.04, decay: 0.09, clickLevel: 0.25 },
  snare: { lowMode: 200, highMode: 350, bodyDecay: 0.04, snapLevel: 0.4, wireLevel: 0.55, wireDecay: 0.16 },
  hat: { fundamental: 36, closedDecay: 0.03, halfDecay: 0.12, openDecay: 0.45 },
  cymbal: { rideDecay: 0.6, crashDecay: 0.9 },
  tom: { high: 240, mid: 180, low: 130, decay: 0.1 },
  feel: { looseness: 1.4, hatLagSeconds: 0 },
};

const METAL: DrumKitTuning = {
  kick: { startFrequency: 180, endFrequency: 55, pitchDrop: 0.03, decay: 0.08, clickLevel: 0.8 },
  snare: { lowMode: 190, highMode: 340, bodyDecay: 0.045, snapLevel: 0.75, wireLevel: 0.55, wireDecay: 0.09 },
  hat: { fundamental: 44, closedDecay: 0.022, halfDecay: 0.09, openDecay: 0.35 },
  cymbal: { rideDecay: 0.4, crashDecay: 0.9 },
  tom: { high: 180, mid: 135, low: 95, decay: 0.14 },
  feel: { looseness: 0.4, hatLagSeconds: 0 },
};

const ELECTRONIC: DrumKitTuning = {
  kick: { startFrequency: 120, endFrequency: 45, pitchDrop: 0.09, decay: 0.35, clickLevel: 0.15 },
  snare: { lowMode: 180, highMode: 330, bodyDecay: 0.06, snapLevel: 0.5, wireLevel: 0.6, wireDecay: 0.13 },
  hat: { fundamental: 40, closedDecay: 0.018, halfDecay: 0.07, openDecay: 0.3 },
  cymbal: { rideDecay: 0.35, crashDecay: 0.6 },
  tom: { high: 220, mid: 160, low: 110, decay: 0.2 },
  feel: { looseness: 0, hatLagSeconds: 0 },
};

export const DRUM_KIT_TUNINGS: Record<DrumKitName, DrumKitTuning> = {
  rock: ROCK,
  blues: BLUES,
  funk: FUNK,
  reggae: REGGAE,
  jazz: JAZZ,
  metal: METAL,
  electronic: ELECTRONIC,
};
