import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workspace } from '../../src/app/workspace';

let stored: Map<string, string>;
const saved = (key: string) => { const value = stored.get('tabtrainer:' + key); return value === undefined ? undefined : JSON.parse(value); };
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('workspace', () => {
  it('starts on the library with the saved instrument and category', () => {
    stored.set('tabtrainer:family', '"guitar"'); stored.set('tabtrainer:libraryKind', '"songs"');
    const workspace = Workspace.fromQuery('');
    expect([workspace.screen, workspace.family, workspace.kind, workspace.picked]).toEqual(['library', 'guitar', 'songs', '']);
  });

  it('lets the link choose the screen, instrument and category', () => {
    stored.set('tabtrainer:family', '"bass"');
    expect(Workspace.fromQuery('?song=guitar/strum').screen).toBe('practice');
    expect(Workspace.fromQuery('?view=practice').screen).toBe('practice');
    const library = Workspace.fromQuery('?view=library&kind=mine&instrument=guitar');
    expect([library.screen, library.family, library.kind]).toEqual(['library', 'guitar', 'mine']);
  });

  it('falls back to bass exercises for unknown values', () => {
    const workspace = Workspace.fromQuery('?kind=drums&instrument=kazoo');
    expect([workspace.family, workspace.kind]).toEqual(['bass', 'exercises']);
  });

  it('saves a chosen instrument only when it changes', () => {
    const workspace = Workspace.fromQuery('');
    expect(workspace.chooseFamily('bass')).toBe(false);
    expect(saved('family')).toBeUndefined();
    expect(workspace.chooseFamily('guitar')).toBe(true);
    expect([workspace.family, saved('family')]).toEqual(['guitar', 'guitar']);
  });

  it('shows the instrument of a history entry without saving it', () => {
    const workspace = Workspace.fromQuery('');
    workspace.visitFamily('guitar');
    expect(workspace.family).toBe('guitar');
    expect(saved('family')).toBeUndefined();
  });

  it('saves the library category', () => {
    const workspace = Workspace.fromQuery('');
    workspace.chooseKind('songs');
    expect([workspace.kind, saved('libraryKind')]).toEqual(['songs', 'songs']);
  });

  it('adopts the instrument of the song when it enters practice', () => {
    const workspace = Workspace.fromQuery('');
    workspace.enter('practice', 'guitar');
    expect([workspace.screen, workspace.family, saved('family')]).toEqual(['practice', 'guitar', 'guitar']);
    workspace.enter('library', 'bass');
    expect([workspace.screen, workspace.family]).toEqual(['library', 'guitar']);
  });

  it('enters practice without a song and keeps the instrument', () => {
    const workspace = Workspace.fromQuery('');
    workspace.enter('practice', null);
    expect([workspace.screen, workspace.family, saved('family')]).toEqual(['practice', 'bass', undefined]);
  });

  it('follows the instrument of an edited song only on the practice screen', () => {
    const workspace = Workspace.fromQuery('');
    expect(workspace.followSong('guitar')).toBe(false);
    expect(workspace.family).toBe('bass');
    workspace.enter('practice', null);
    expect(workspace.followSong('bass')).toBe(false);
    expect(workspace.followSong('guitar')).toBe(true);
    expect([workspace.family, saved('family')]).toEqual(['guitar', 'guitar']);
  });

  it('opens a song on the practice screen and saves the pick, not the category', () => {
    const workspace = Workspace.fromQuery('');
    workspace.openSong('demo:./songs/bass/songs/01-groove.txt', 'songs');
    expect([workspace.screen, workspace.picked, workspace.kind]).toEqual(['practice', 'demo:./songs/bass/songs/01-groove.txt', 'songs']);
    expect([saved('picked'), saved('libraryKind')]).toEqual(['demo:./songs/bass/songs/01-groove.txt', undefined]);
  });

  it('picks a saved song without leaving the screen', () => {
    const workspace = Workspace.fromQuery('');
    workspace.pick('lib:My riff', 'mine');
    expect([workspace.screen, workspace.picked, workspace.kind, saved('picked')]).toEqual(['library', 'lib:My riff', 'mine', 'lib:My riff']);
  });

  it('forgets the pick for a new or opened file', () => {
    const workspace = Workspace.fromQuery('?view=practice');
    workspace.openSong('demo:./songs/bass/songs/01-groove.txt', 'songs');
    workspace.unpick();
    expect([workspace.picked, workspace.kind, saved('picked')]).toEqual(['', 'mine', '']);
  });

  it('restores a pick on start without saving it', () => {
    const workspace = Workspace.fromQuery('');
    workspace.restore('lib:My riff');
    expect([workspace.picked, saved('picked')]).toEqual(['lib:My riff', undefined]);
  });

  it('describes the library as a route', () => {
    const workspace = Workspace.fromQuery('?kind=songs&instrument=guitar');
    expect(workspace.route('develop')).toEqual({ screen: 'library', kind: 'songs', family: 'guitar' });
  });

  it('describes practice as a route with the pick and version', () => {
    const workspace = Workspace.fromQuery('');
    workspace.openSong('demo:./songs/bass/songs/01-groove.txt', 'songs');
    expect(workspace.route('develop')).toEqual({ screen: 'practice', picked: 'demo:./songs/bass/songs/01-groove.txt', version: 'develop' });
  });
});
