import { describe, expect, it } from 'vitest';
import { editorWidth } from '../src/app/editorWidth';

describe('editor width', () => {
  it('keeps enough room for both the editor and score', () => {
    expect(editorWidth(100, 1440).value).toBe(240);
    const narrow = editorWidth(900, 900);
    expect(900 - narrow.value).toBeGreaterThanOrEqual(368);
    expect(narrow.value).toBe(narrow.max);
  });
  it('retains a chosen width when there is room and caps wide editors', () => {
    expect(editorWidth(320, 1440).value).toBe(320);
    expect(editorWidth(2000, 1920).value).toBe(720);
  });
});
