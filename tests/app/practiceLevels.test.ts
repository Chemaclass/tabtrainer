import { describe, expect, it } from 'vitest';
import { hasPracticeLevels } from '../../src/app/practiceLevels';

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
