import { describe, expect, it } from 'vitest';
import { hasPracticeLevels, nextLevel } from '../../src/app/practiceLevels';

describe('practice levels', () => {
  it('recognizes the ordered progressive levels', () => {
    expect(hasPracticeLevels([' Learn ', 'develop', 'CHALLENGE'])).toBe(true);
  });
  it('does not classify other arrangements as practice levels', () => {
    expect(hasPracticeLevels(['Learn', 'Challenge', 'Develop'])).toBe(false);
    expect(hasPracticeLevels(['Learn', 'Develop'])).toBe(false);
    expect(hasPracticeLevels(['Easy', 'Medium', 'Hard'])).toBe(false);
  });
});

describe('next level', () => {
  const levels = ['Learn', 'Develop', 'Challenge'];
  it('steps up one level until the last', () => {
    expect(nextLevel(levels, 0)).toEqual({ index: 1, name: 'Develop' });
    expect(nextLevel(levels, 1)).toEqual({ index: 2, name: 'Challenge' });
    expect(nextLevel(levels, 2)).toBeNull();
  });
  it('offers nothing for other arrangements', () => {
    expect(nextLevel(['Simple', 'Full'], 0)).toBeNull();
    expect(nextLevel([], 0)).toBeNull();
  });
});
