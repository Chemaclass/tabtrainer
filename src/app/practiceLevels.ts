export const PRACTICE_LEVELS = ['Learn', 'Develop', 'Challenge'] as const;

export function hasPracticeLevels(names: readonly string[]): boolean {
  return names.length === PRACTICE_LEVELS.length && names.every((name, index) => name.trim().toLowerCase() === PRACTICE_LEVELS[index].toLowerCase());
}

/** The level after the one shown, when the song has practice levels and one is left. */
export function nextLevel(names: readonly string[], index: number): { index: number; name: string } | null {
  if (!hasPracticeLevels(names) || index < 0 || index >= names.length - 1) return null;
  return { index: index + 1, name: names[index + 1].trim() };
}
