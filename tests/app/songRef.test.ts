import { describe, expect, it } from 'vitest';
import { bundledPath, bundledRef, isSavedRef, savedRef } from '../../src/app/songRef';

describe('song references', () => {
  it('builds a bundled reference from a path', () => {
    expect(bundledRef('./songs/bass/songs/07-a-dawning.txt')).toBe('demo:./songs/bass/songs/07-a-dawning.txt');
  });

  it('builds a saved reference from a title', () => {
    expect(savedRef('My riff')).toBe('lib:My riff');
  });

  it('gives back the path of a bundled reference', () => {
    expect(bundledPath('demo:./songs/bass/songs/07-a-dawning.txt')).toBe('./songs/bass/songs/07-a-dawning.txt');
  });

  it('has no path for a saved reference or an empty one', () => {
    expect(bundledPath('lib:My riff')).toBeNull();
    expect(bundledPath('')).toBeNull();
  });

  it('tells saved references apart', () => {
    expect(isSavedRef('lib:My riff')).toBe(true);
    expect(isSavedRef('demo:./songs/a.txt')).toBe(false);
  });

  it('round-trips a title that looks like a prefix', () => {
    expect(bundledPath(bundledRef('demo:x'))).toBe('demo:x');
    expect(isSavedRef(savedRef('lib:x'))).toBe(true);
  });
});
