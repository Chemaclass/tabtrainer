import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftSession } from '../src/ui/draftSession';

afterEach(() => vi.unstubAllGlobals());
function draft() {
  let text = 'title: Song\noriginal';
  const session = new DraftSession(() => text);
  session.accept();
  return { session, edit: () => { text += '\nchanged'; } };
}
describe('draft session', () => {
  it('recovers the saved baseline and persists unfinished text', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const { session, edit } = draft(); edit();
    session.recover({ text: 'unused', base: 'title: Song\noriginal', picked: 'lib:Song' });
    expect(session.hasChanges()).toBe(true);
    session.persist('lib:Song');
    expect(JSON.parse(values.get('tabtrainer:draft')!)).toEqual({ text: 'title: Song\noriginal\nchanged', base: 'title: Song\noriginal', picked: 'lib:Song' });
    expect(session.save(() => true)).toEqual({ status: 'saved', title: 'Song' });
    expect(session.hasChanges()).toBe(false);
  });
  it('keeps changes when storage fails or overwrite is cancelled', () => {
    const { session, edit } = draft(); edit();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw Error('full'); } });
    session.persist(''); expect(session.stored).toBe(false);
    expect(session.save(() => true)).toEqual({ status: 'failed' }); expect(session.hasChanges()).toBe(true);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ Song: { title: 'Song', text: 'old', updated: 1 } }), setItem: vi.fn() });
    expect(session.save(() => false)).toEqual({ status: 'cancelled' }); expect(session.hasChanges()).toBe(true);
  });
  it('opens one confirmation and replaces only with the latest requested action', () => {
    const { session, edit } = draft(); edit();
    const first = vi.fn(), latest = vi.fn(), confirm = vi.fn();
    session.replace(first, null, confirm); session.replace(latest, null, confirm);
    expect(confirm).toHaveBeenCalledTimes(1);
    session.resolve('discard', () => false, vi.fn());
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce();
  });
  it('cancels navigation when saving fails and permits it after saving succeeds', () => {
    const { session, edit } = draft(); edit();
    const action = vi.fn(), cancel = vi.fn();
    session.replace(action, cancel, vi.fn()); session.resolve('save', () => false, vi.fn());
    expect(cancel).toHaveBeenCalledOnce(); expect(action).not.toHaveBeenCalled();
    session.replace(action, cancel, vi.fn()); session.resolve('save', () => true, vi.fn());
    expect(action).toHaveBeenCalledOnce();
  });
  it('invalidates pending file reads when another navigation starts', () => {
    const { session } = draft(); const generation = session.beginNavigation();
    expect(session.isCurrent(generation)).toBe(true);
    session.replace(vi.fn(), null, vi.fn()); expect(session.isCurrent(generation)).toBe(false);
  });
});
