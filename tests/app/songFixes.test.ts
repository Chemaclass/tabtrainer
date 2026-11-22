import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { applyEdit, songFixes } from '../../src/app/songFixes';

const fixed = (text: string, label: string) => {
  const issue = parseSong(text).issues.find(found => songFixes(text, found).some(fix => fix.label === label));
  const fix = issue && songFixes(text, issue).find(found => found.label === label);
  if (!fix) throw new Error(`No "${label}" fix`);
  return applyEdit(text, fix.edit);
};

describe('song fixes', () => {
  it('sets an unreadable tempo to 90', () => {
    expect(fixed('tempo: fast\n:q 3.3 |', 'Set to 90')).toBe('tempo: 90\n:q 3.3 |');
  });

  it('brings a tempo out of range to the nearest limit', () => {
    expect(fixed('tempo: 900\n:q 3.3 |', 'Set to 400')).toBe('tempo: 400\n:q 3.3 |');
    expect(fixed(':q 3.3 | [tempo=5] 3.3 |', 'Set to 20')).toBe(':q 3.3 | [tempo=20] 3.3 |');
  });

  it('adds a bar line before the note that runs past the bar', () => {
    expect(fixed(':q 3.3 3.3 3.3 3.3 5.3 |', 'Add |')).toBe(':q 3.3 3.3 3.3 3.3 | 5.3 |');
  });

  it('removes the note that runs past the bar', () => {
    expect(fixed(':q 3.3 3.3 3.3 3.3 5.3 |', 'Remove this note')).toBe(':q 3.3 3.3 3.3 3.3 |');
    expect(fixed(':q 3.3 3.3 3.3 3.3 5.3', 'Remove this note')).toBe(':q 3.3 3.3 3.3 3.3');
  });

  it('leaves the fixed text without the problem', () => {
    for (const label of ['Add |', 'Remove this note']) {
      expect(parseSong(fixed(':q 3.3 3.3 3.3 3.3 5.3 |', label)).issues.filter(issue => issue.code === 'bar-long')).toEqual([]);
    }
  });

  it('swaps a hammer-on that goes down for a pull-off, and back', () => {
    expect(fixed(':q 7.3 h5.3 3.4 3.4 |', 'Change to p5.3')).toBe(':q 7.3 p5.3 3.4 3.4 |');
    expect(fixed(':q 5.3 (p7.3 2.2) 3.4 3.4 |', 'Change to h7.3')).toBe(':q 5.3 (h7.3 2.2) 3.4 3.4 |');
    expect(parseSong(fixed(':q 7.3 _h5.3 3.4 3.4 |', 'Change to p5.3')).issues).toEqual([]);
  });

  it('swaps a slide that goes the wrong way', () => {
    expect(fixed(':q 7.3 /5.3 3.4 3.4 |', 'Change to \\5.3')).toBe(':q 7.3 \\5.3 3.4 3.4 |');
    expect(fixed(':q 5.3 \\7.3 3.4 3.4 |', 'Change to /7.3')).toBe(':q 5.3 /7.3 3.4 3.4 |');
  });

  it('offers no swap for a join that stays on its fret', () => {
    const text = ':q 5.3 h5.3 3.4 3.4 |';
    expect(parseSong(text).issues.flatMap(issue => songFixes(text, issue))).toEqual([]);
  });

  it('offers nothing for a problem with no mechanical fix', () => {
    const text = ':q 3.x |';
    expect(parseSong(text).issues.flatMap(issue => songFixes(text, issue))).toEqual([]);
  });
});
