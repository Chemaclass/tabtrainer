export function hasPracticeLevels(names: readonly string[]): boolean {
  return names.length === 3 && names.every((name, index) => name.trim().toLowerCase() === ['learn', 'develop', 'challenge'][index]);
}
