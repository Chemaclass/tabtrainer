import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftSession, freeTitle, withTitle, type SaveChoice } from '../../src/app/draftSession';
import { savedGrooves } from '../../src/app/storage';

afterEach(() => vi.unstubAllGlobals());
function memoryStorage(values = new Map<string, string>()) {
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  return values;
}
const savedLibrary = (values: Map<string, string>) => Object.keys(JSON.parse(values.get('tabtrainer:library')!));
function draft() {
  let text = 'title: Song\noriginal';
  const session = new DraftSession(() => text);
  session.accept();
  return { session, edit: () => { text += '\nchanged'; } };
}
describe('draft session', () => {
  it('recovers the saved baseline and persists unfinished text', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const { session, edit } = draft(); edit();
    session.recover({ text: 'unused', base: 'title: Song\noriginal', picked: 'lib:Song' });
    expect(session.hasChanges()).toBe(true);
    session.persist('lib:Song');
    expect(JSON.parse(values.get('tabtrainer:draft')!)).toEqual({ text: 'title: Song\noriginal\nchanged', base: 'title: Song\noriginal', picked: 'lib:Song' });
    expect(await session.save(() => 'replace')).toEqual({ status: 'saved', title: 'Song', text: 'title: Song\noriginal\nchanged' });
    expect(session.hasChanges()).toBe(false);
  });
  it('keeps changes when storage fails or overwrite is cancelled', async () => {
    const { session, edit } = draft(); edit();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw Error('full'); } });
    session.persist(''); expect(session.stored).toBe(false);
    expect(await session.save(() => 'replace')).toEqual({ status: 'failed' }); expect(session.hasChanges()).toBe(true);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ Song: { title: 'Song', text: 'old', updated: 1 } }), setItem: vi.fn() });
    expect(await session.save(() => 'cancel')).toEqual({ status: 'cancelled' }); expect(session.hasChanges()).toBe(true);
  });
  it('replaces the saved song of the same title only when asked to', async () => {
    const values = memoryStorage();
    const { session, edit } = draft();
    await session.save(() => 'replace'); edit();
    const choose = vi.fn((): SaveChoice => 'replace');
    expect(await session.save(choose)).toEqual({ status: 'saved', title: 'Song', text: 'title: Song\noriginal\nchanged' });
    expect(choose).toHaveBeenCalledWith({ title: 'Song', copyTitle: 'Song 2' });
    expect(savedLibrary(values)).toEqual(['Song']);
    expect(session.hasChanges()).toBe(false);
  });
  it('keeps both songs by saving the new one under the next free title', async () => {
    const values = memoryStorage();
    const { session } = draft();
    await session.save(() => 'replace');
    expect(await session.save(() => 'keep-both')).toEqual({ status: 'saved', title: 'Song 2', text: 'title: Song 2\noriginal' });
    expect(savedLibrary(values)).toEqual(['Song', 'Song 2']);
    expect(JSON.parse(values.get('tabtrainer:library')!).Song.text).toBe('title: Song\noriginal');
  });
  it('leaves the library as it was when the question is cancelled', async () => {
    const values = memoryStorage();
    const { session, edit } = draft();
    await session.save(() => 'replace'); edit();
    expect(await session.save(() => 'cancel')).toEqual({ status: 'cancelled' });
    expect(JSON.parse(values.get('tabtrainer:library')!).Song.text).toBe('title: Song\noriginal');
    expect(session.hasChanges()).toBe(true);
  });
  it('saves the text that was asked about and ignores a second save while the question is open', async () => {
    const values = memoryStorage();
    let text = 'title: Song\nfirst';
    const session = new DraftSession(() => text);
    await session.save(() => 'replace');
    let answer: (choice: SaveChoice) => void = () => {};
    const asked = session.save(() => new Promise<SaveChoice>(resolve => { answer = resolve; }));
    const second = vi.fn((): SaveChoice => 'replace');
    expect(await session.save(second)).toEqual({ status: 'cancelled' });
    expect(second).not.toHaveBeenCalled();
    text = 'title: Song\ntyped while asking';
    answer('replace');
    expect(await asked).toEqual({ status: 'saved', title: 'Song', text: 'title: Song\nfirst' });
    expect(JSON.parse(values.get('tabtrainer:library')!).Song.text).toBe('title: Song\nfirst');
    expect(session.hasChanges()).toBe(true);
  });
  it('names a copy after the first free number and writes it into the title line', () => {
    expect(freeTitle('Song', title => ['Song 2', 'Song 3'].includes(title))).toBe('Song 4');
    expect(withTitle('  Title: Old $1\nbody', 'New $&')).toBe('  Title: New $&\nbody');
    expect(withTitle('body', 'New')).toBe('title: New\nbody');
  });
  it('opens one question and replaces only with the latest requested action', async () => {
    const { session, edit } = draft(); edit();
    const first = vi.fn(), latest = vi.fn(), ask = vi.fn();
    session.replace(first, null, ask); session.replace(latest, null, ask);
    expect(ask).toHaveBeenCalledTimes(1);
    await session.resolve('discard', async () => false, vi.fn());
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce();
  });
  it('cancels navigation when saving fails and permits it after saving succeeds', async () => {
    const { session, edit } = draft(); edit();
    const action = vi.fn(), cancel = vi.fn();
    session.replace(action, cancel, vi.fn()); await session.resolve('save', async () => false, vi.fn());
    expect(cancel).toHaveBeenCalledOnce(); expect(action).not.toHaveBeenCalled();
    session.replace(action, cancel, vi.fn()); await session.resolve('save', async () => true, vi.fn());
    expect(action).toHaveBeenCalledOnce();
  });
  it('follows only the latest navigation asked for while saving waits for an answer', async () => {
    const { session, edit } = draft(); edit();
    const first = vi.fn(), latest = vi.fn(), ask = vi.fn();
    session.replace(first, null, ask);
    let saved: (ok: boolean) => void = () => {};
    const resolving = session.resolve('save', () => new Promise<boolean>(resolve => { saved = resolve; }), vi.fn());
    session.replace(latest, null, ask);
    expect(ask).toHaveBeenCalledOnce();
    saved(true); await resolving;
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledOnce();
  });
  it('stays on the draft when the question is cancelled with nothing to follow', async () => {
    const { session, edit } = draft(); edit();
    const action = vi.fn(), stayed = vi.fn(), save = vi.fn(async () => true);
    session.replace(action, null, vi.fn()); await session.resolve('cancel', save, stayed);
    expect(save).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled(); expect(stayed).toHaveBeenCalledOnce();
  });
  it('saves into the store it was given, such as the saved grooves', async () => {
    const values = memoryStorage();
    const session = new DraftSession(() => 'title: Groove\nkick: x...', savedGrooves);
    const choose = vi.fn((): SaveChoice => 'replace');
    expect(await session.save(choose)).toEqual({ status: 'saved', title: 'Groove', text: 'title: Groove\nkick: x...' });
    expect(await session.save(choose)).toEqual({ status: 'saved', title: 'Groove', text: 'title: Groove\nkick: x...' });
    expect(choose).toHaveBeenCalledOnce();
    expect(savedGrooves.list().map(groove => groove.title)).toEqual(['Groove']);
    expect(values.has('tabtrainer:library')).toBe(false);
  });
  it('invalidates pending file reads when another navigation starts', () => {
    const { session } = draft(); const generation = session.beginNavigation();
    expect(session.isCurrent(generation)).toBe(true);
    session.replace(vi.fn(), null, vi.fn()); expect(session.isCurrent(generation)).toBe(false);
  });
});
