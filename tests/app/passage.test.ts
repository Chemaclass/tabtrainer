import { describe, expect, it } from 'vitest';
import { Passage } from '../../src/app/passage';

function song() { const passage = new Passage(); passage.setSong(8, true); return passage; }
describe('practice passage', () => {
  it('bounds invalid and reversed ranges and selects their start', () => {
    const passage = song(); passage.setRange(5.9, 2, true);
    expect(passage.range()).toEqual([5, 5]); expect(passage.snapshot().selected).toBe(5);
    passage.setRange(NaN, Infinity, false); expect(passage.range()).toBeNull();
    passage.setRange(-10, 99, true); expect(passage.range()).toEqual([1, 8]);
  });
  it('clears a passage when a bar outside it is selected', () => {
    const passage = song(); passage.setRange(3, 5, true); passage.select(7);
    expect(passage.range()).toBeNull(); expect(passage.snapshot().selected).toBe(7);
    expect(passage.select(9)).toBe(false); expect(passage.snapshot().selected).toBe(7);
  });
  it('builds a passage from the selected bars without reversing it', () => {
    const passage = song(); passage.select(3); passage.startAtSelection(); expect(passage.range()).toEqual([3, 8]);
    passage.select(5); passage.endAtSelection(); expect(passage.range()).toEqual([3, 5]);
    expect(passage.summary()).toBe('Selected bar 5. Bars 3-5, play once.');
  });
  it('retains a valid range across edits and resets it for shorter arrangements', () => {
    const passage = song(); passage.setRange(3, 5, true); passage.setSong(10, false);
    expect(passage.range()).toEqual([3, 5]); expect(passage.snapshot().selected).toBe(0);
    passage.setSong(2, false); expect(passage.range()).toEqual([1, 2]);
    passage.setSong(8, true); expect(passage.range()).toEqual([1, 8]);
    passage.clear(); expect(passage.range()).toBeNull(); expect(passage.summary()).toBe('Whole song, play once.');
  });
});
