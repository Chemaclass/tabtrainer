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
  it('moves the passage start and end to a bar and toggles its repeat', () => {
    const passage = song(); passage.startAt(6); expect(passage.range()).toEqual([6, 8]);
    passage.endAt(3); expect(passage.range()).toEqual([3, 3]);
    passage.endAt(7); expect(passage.range()).toEqual([3, 7]);
    passage.startAt(8); expect(passage.range()).toEqual([8, 8]);
    passage.clear(); passage.toggleRepeat(); expect(passage.snapshot()).toMatchObject({ first: 1, last: 8, repeat: true, active: true });
    passage.toggleRepeat(); expect(passage.range()).toBeNull();
  });
  it('retains a valid range across edits and resets it for shorter arrangements', () => {
    const passage = song(); passage.setRange(3, 5, true); passage.setSong(10, false);
    expect(passage.range()).toEqual([3, 5]); expect(passage.snapshot().selected).toBe(0);
    passage.setSong(2, false); expect(passage.range()).toEqual([1, 2]);
    passage.setSong(8, true); expect(passage.range()).toEqual([1, 8]);
    passage.clear(); expect(passage.range()).toBeNull(); expect(passage.summary()).toBe('Whole song, play once.');
  });
  it('starts a loop on a tapped bar number and extends it to a tap after it', () => {
    const passage = song(); passage.loopTo(5); expect(passage.snapshot()).toMatchObject({ first: 5, last: 5, repeat: true });
    passage.loopTo(8); expect(passage.range()).toEqual([5, 8]); expect(passage.snapshot().repeat).toBe(true);
    passage.loopTo(9); expect(passage.range()).toEqual([5, 8]);
  });
  it('extends a loop to a tap before it and turns a play once passage into a loop', () => {
    const passage = song(); passage.setRange(4, 6, false); passage.loopTo(2);
    expect(passage.snapshot()).toMatchObject({ first: 2, last: 6, repeat: true });
  });
  it('ends the loop at a tap inside it and clears it from a tap on either end', () => {
    const passage = song(); passage.setRange(2, 7, true); passage.loopTo(4); expect(passage.range()).toEqual([2, 4]);
    expect(passage.isLoopEnd(2)).toBe(true); expect(passage.isLoopEnd(3)).toBe(false);
    passage.loopTo(4); expect(passage.range()).toBeNull();
    passage.loopTo(3); passage.loopTo(3); expect(passage.range()).toBeNull();
  });
  it('starts a fresh loop when the whole song repeats', () => {
    const passage = song(); passage.toggleRepeat(); passage.loopTo(6); expect(passage.range()).toEqual([6, 6]);
  });
  it('loops the selected bar on its own', () => {
    const passage = song(); passage.loopSelection(); expect(passage.range()).toBeNull();
    passage.select(3); expect(passage.loopsSelection()).toBe(false);
    passage.loopSelection(); expect(passage.range()).toEqual([3, 3]); expect(passage.loopsSelection()).toBe(true);
  });
});
