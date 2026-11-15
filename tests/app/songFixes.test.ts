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

  it('offers nothing for a problem with no mechanical fix', () => {
    const text = ':q 3.x |';
    expect(parseSong(text).issues.flatMap(issue => songFixes(text, issue))).toEqual([]);
  });
});
