import { describe, expect, it } from 'vitest';
import { OpenSong } from '../../src/app/openSong';

const header = 'title: Levels\ninstrument: bass4\ntempo: 80\n';
const threeVersions = `${header}== Learn\n:q 3.3 |\n== Develop\n:q 3.3 | 5.3 |\n== Challenge\n:q 3.3 | 5.3 | 7.3 |\n`;
const twoVersions = `${header}== Learn\n:q 3.3 |\n== Develop\n:q 3.3 | 5.3 |\n`;

describe('open song', () => {
  it('has nothing open before it reads a text', () => {
    const open = new OpenSong();
    expect(open.song).toBeNull();
    expect(open.versions).toEqual([]);
    expect(open.versionSlug()).toBeNull();
    expect(open.choose(1)).toBe(false);
  });

  it('reads a text, shows its first version and reports issues', () => {
    const open = new OpenSong();
    expect(open.read(`${header}:q 3.3 3.9 |\n`, true).issues).toContainEqual(expect.objectContaining({ severity: 'error' }));
    expect(open.song?.meta.title).toBe('Levels');
    expect(open.versionIndex).toBe(0);
  });

  it('shows the chosen version at once and keeps it on the next read', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    expect(open.choose(2)).toBe(true);
    expect(open.song?.bars).toHaveLength(3);
    open.read(threeVersions, false);
    expect(open.versionIndex).toBe(2);
    expect(open.song?.bars).toHaveLength(3);
  });

  it('does not choose the version already shown', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    expect(open.choose(0)).toBe(false);
  });

  it('goes back to the first version on a reset', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    open.choose(1); open.read(threeVersions, false);
    open.read(threeVersions, true);
    expect(open.versionIndex).toBe(0);
  });

  it('keeps the last version when the chosen one is deleted', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    open.choose(2); open.read(threeVersions, false);
    open.read(twoVersions, false);
    expect(open.versionIndex).toBe(1);
    expect(open.song?.bars).toHaveLength(2);
  });

  it('chooses a version by its link slug', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    expect(open.chooseNamed('challenge')).toBe(true);
    expect(open.versionIndex).toBe(2);
    expect(open.chooseNamed('missing')).toBe(false);
    expect(open.chooseNamed(null)).toBe(false);
    expect(open.versionIndex).toBe(2);
  });

  it('names the version in links only when there is more than one', () => {
    const open = new OpenSong();
    open.read(threeVersions, true);
    expect(open.versionSlug()).toBe('learn');
    open.choose(1);
    expect(open.versionSlug()).toBe('develop');
    open.read(`${header}:q 3.3 |\n`, true);
    expect(open.versionSlug()).toBeNull();
  });
});
