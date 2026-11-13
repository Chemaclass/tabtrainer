export interface SpeedPracticeConfig { repetitions: number; increase: number; target: number }
export interface SpeedPracticeProgress { speed: number; completed: number }

export function isSpeedPracticeConfig(value: unknown): value is SpeedPracticeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Number.isInteger(v.repetitions) && Number(v.repetitions) >= 1 && Number(v.repetitions) <= 20
    && Number.isInteger(v.increase) && Number(v.increase) >= 1 && Number(v.increase) <= 20
    && Number.isInteger(v.target) && Number(v.target) >= 30 && Number(v.target) <= 130;
}

export function advanceSpeedPractice(state: SpeedPracticeProgress, config: SpeedPracticeConfig): SpeedPracticeProgress {
  if (state.speed >= config.target) return state;
  const completed = state.completed + 1;
  if (completed < config.repetitions) return { ...state, completed };
  return { speed: Math.min(config.target, state.speed + config.increase), completed: 0 };
}
