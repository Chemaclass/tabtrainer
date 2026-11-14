import { describe, expect, it } from 'vitest';
import { startupPlan, type StartupInput } from '../../src/app/startup';

const groove = './songs/bass/songs/02-groove.txt';
const roots = './songs/bass/exercises/01-roots.txt';
const texts: Record<string, string> = { ['demo:' + groove]: 'title: Groove', ['demo:' + roots]: 'title: Roots', 'lib:My riff': 'title: My riff' };
const songbook = { paths: [roots, groove], text: (ref: string) => texts[ref] };
const plan = (input: Partial<StartupInput>) => startupPlan({ search: '', historyPick: null, draft: null, last: null, lastPick: '', ...input }, songbook);
const unchanged = (picked: string) => ({ text: 'same', base: 'same', picked });
const edited = (picked: string) => ({ text: 'edited', base: 'same', picked });

describe('startup plan', () => {
  it('starts on the first bundled song when nothing is stored', () => {
    expect(plan({})).toEqual({ kind: 'first' });
  });

  it('opens the song of a share link', () => {
    expect(plan({ search: '?song=bass/groove' })).toEqual({ kind: 'open', ref: 'demo:' + groove });
  });

  it('ignores a share link to a song that does not exist', () => {
    expect(plan({ search: '?song=bass/gone' })).toEqual({ kind: 'first' });
  });

  it('reopens a saved song on reload of the practice view', () => {
    expect(plan({ search: '?view=practice', historyPick: 'lib:My riff' })).toEqual({ kind: 'open', ref: 'lib:My riff' });
  });

  it('does not reopen a saved song that was removed', () => {
    expect(plan({ search: '?view=practice', historyPick: 'lib:Gone' })).toEqual({ kind: 'first' });
  });

  it('does not reopen a bundled song from history without a link', () => {
    expect(plan({ search: '?view=practice', historyPick: 'demo:' + groove })).toEqual({ kind: 'first' });
  });

  it('does not reopen a saved song outside the practice view', () => {
    expect(plan({ search: '?view=library', historyPick: 'lib:My riff' })).toEqual({ kind: 'first' });
  });

  it('recovers a draft when nothing is requested', () => {
    expect(plan({ draft: unchanged('lib:My riff') })).toEqual({ kind: 'recover', draft: unchanged('lib:My riff'), offer: null, followLink: false });
  });

  it('recovers a draft of the linked song and follows the link version', () => {
    expect(plan({ search: '?song=bass/groove', draft: edited('demo:' + groove) })).toEqual({ kind: 'recover', draft: edited('demo:' + groove), offer: null, followLink: true });
  });

  it('recovers edits to another song and offers the linked one', () => {
    expect(plan({ search: '?song=bass/groove', draft: edited('lib:My riff') })).toEqual({ kind: 'recover', draft: edited('lib:My riff'), offer: 'demo:' + groove, followLink: false });
  });

  it('opens the linked song over an unchanged draft of another song', () => {
    expect(plan({ search: '?song=bass/groove', draft: unchanged('lib:My riff') })).toEqual({ kind: 'open', ref: 'demo:' + groove });
  });

  it('recovers an unchanged draft of the linked song', () => {
    expect(plan({ search: '?song=bass/groove', draft: unchanged('demo:' + groove) })).toEqual({ kind: 'recover', draft: unchanged('demo:' + groove), offer: null, followLink: true });
  });

  it('matches a draft of a renumbered bundled song to the link', () => {
    const draft = unchanged('demo:./songs/bass/songs/07-groove.txt');
    expect(plan({ search: '?song=bass/groove', draft })).toEqual({ kind: 'recover', draft: unchanged('demo:' + groove), offer: null, followLink: true });
  });

  it('reloads the last text with its song as the baseline', () => {
    expect(plan({ last: 'title: Groove\nmore', lastPick: 'demo:' + groove })).toEqual({ kind: 'last', text: 'title: Groove\nmore', ref: 'demo:' + groove, base: 'title: Groove' });
  });

  it('reloads the last text unpicked when its song is gone', () => {
    expect(plan({ last: 'title: Old', lastPick: 'lib:Gone' })).toEqual({ kind: 'last', text: 'title: Old', ref: '', base: 'title: Old' });
  });

  it('follows a renumbered bundled song for the last text', () => {
    expect(plan({ last: 'title: Roots', lastPick: 'demo:./songs/bass/exercises/05-roots.txt' })).toEqual({ kind: 'last', text: 'title: Roots', ref: 'demo:' + roots, base: 'title: Roots' });
  });
});
