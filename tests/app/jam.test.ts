import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { Jam, MIXER_PARTS, Mixer, bundledGrooves, grooveSlug, jamKeys } from '../../src/app/jam';
import { parseGroove } from '../../src/core/groove';

const files = Object.fromEntries(readdirSync('src/grooves').map(name => [`./grooves/${name}`, readFileSync(`src/grooves/${name}`, 'utf8')]));
const minor = { './grooves/02-minor-vamp.txt': 'title: Minor vamp\ntempo: 100\nkey: Bbm\nprogression: i iv\nkick: x...' };

let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('bundled grooves', () => {
  it('names each groove after its file without the order number', () => {
    expect(grooveSlug('./grooves/01-blues-shuffle.txt')).toBe('blues-shuffle');
    expect(bundledGrooves(files).map(g => g.slug)).toContain('blues-shuffle');
  });
  it('offers twelve keys in the mode of the groove', () => {
    const blues = parseGroove(files['./grooves/01-blues-shuffle.txt']).groove;
    expect(jamKeys(blues)).toHaveLength(12);
    expect(jamKeys(blues)).toContain('C');
    expect(jamKeys(parseGroove(minor['./grooves/02-minor-vamp.txt']).groove).every(k => k.endsWith('m'))).toBe(true);
  });
});

describe('jam', () => {
  it('starts on the first groove with its own key and tempo', () => {
    const jam = new Jam(bundledGrooves(files));
    expect([jam.slug, jam.key, jam.tempo]).toEqual(['blues-shuffle', 'A', 80]);
    expect(jam.timeline().bars.map(b => b.chord.name).slice(0, 4)).toEqual(['A7', 'D7', 'A7', 'A7']);
  });
  it('renames the chords when the key changes', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(jam.setKey('C')).toBe(true);
    expect(jam.timeline().bars.map(b => b.chord.name).slice(0, 2)).toEqual(['C7', 'F7']);
    expect(jam.setKey('C')).toBe(false);
    expect(jam.setKey('Cm')).toBe(false);
    expect(jam.key).toBe('C');
  });
  it('keeps the tempo between 40 and 220 bpm', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.setTempo(10); expect(jam.tempo).toBe(40);
    jam.setTempo(500); expect(jam.tempo).toBe(220);
    expect(jam.setTempo(NaN)).toBe(false); expect(jam.tempo).toBe(220);
  });
  it('remembers key and tempo for each groove across reloads', () => {
    const grooves = bundledGrooves({ ...files, ...minor });
    const jam = new Jam(grooves);
    jam.setKey('C'); jam.setTempo(120);
    jam.choose('minor-vamp'); jam.setTempo(70);
    expect(JSON.parse(stored.get('tabtrainer:jam') ?? '{}')).toEqual({ 'blues-shuffle': { key: 'C', tempo: 120 }, 'minor-vamp': { key: 'Bbm', tempo: 70 } });
    const reloaded = new Jam(grooves);
    expect([reloaded.key, reloaded.tempo]).toEqual(['C', 120]);
    reloaded.choose('minor-vamp');
    expect([reloaded.key, reloaded.tempo]).toEqual(['Bbm', 70]);
  });
  it('ignores unknown grooves and saved values that do not fit', () => {
    stored.set('tabtrainer:jam', JSON.stringify({ 'blues-shuffle': { key: 'Gb', tempo: 999 } }));
    const jam = new Jam(bundledGrooves(files));
    expect(jam.choose('polka')).toBe(false);
    expect([jam.slug, jam.key, jam.tempo]).toEqual(['blues-shuffle', 'F#', 220]);
    stored.set('tabtrainer:jam', JSON.stringify({ 'blues-shuffle': 'broken', other: { key: 'G', tempo: 90 } }));
    const kept = new Jam(bundledGrooves(files));
    expect([kept.key, kept.tempo]).toEqual(['A', 80]);
    kept.setTempo(100);
    expect(JSON.parse(stored.get('tabtrainer:jam') ?? '{}').other).toEqual({ key: 'G', tempo: 90 });
    stored.set('tabtrainer:jam', '{bad');
    expect(new Jam(bundledGrooves(files)).key).toBe('A');
  });
});

describe('mixer', () => {
  const gains = (mixer: Mixer) => MIXER_PARTS.map(part => mixer.gain(part));

  it('starts from the instrument last used in the library and mutes the backing bass for a bass player', () => {
    expect(new Mixer().plays).toBe('bass');
    expect(gains(new Mixer())).toEqual([1, 0, 1]);
    stored.set('tabtrainer:family', JSON.stringify('guitar'));
    expect(new Mixer().plays).toBe('guitar');
    expect(gains(new Mixer())).toEqual([1, 1, 1]);
  });
  it('mutes the bass when I play bass and turns it back on for guitar, leaving the other parts alone', () => {
    stored.set('tabtrainer:family', JSON.stringify('guitar'));
    const mixer = new Mixer();
    mixer.setMuted('keys', true);
    expect(mixer.setPlays('bass')).toBe(true);
    expect(gains(mixer)).toEqual([1, 0, 0]);
    expect(mixer.setPlays('bass')).toBe(false);
    mixer.setMuted('bass', false);
    expect(mixer.gain('bass')).toBe(1);
    mixer.setPlays('guitar');
    expect(gains(mixer)).toEqual([1, 1, 0]);
  });
  it('follows the library instrument until the player makes a mixer choice', () => {
    const mixer = new Mixer('guitar');
    expect([mixer.plays, mixer.gain('bass')]).toEqual(['guitar', 1]);
    expect(mixer.followLibrary('bass')).toBe(true);
    expect([mixer.plays, mixer.gain('bass')]).toEqual(['bass', 0]);
    expect(stored.has('tabtrainer:jamMixer')).toBe(false);
    mixer.setVolume('keys', 50);
    expect(mixer.followLibrary('guitar')).toBe(false);
    expect(new Mixer('guitar').plays).toBe('bass');
  });
  it('changes only the volume of one part, from 0 to 100', () => {
    const mixer = new Mixer();
    expect(mixer.setVolume('drums', 40)).toBe(true);
    expect(mixer.setVolume('drums', 40)).toBe(false);
    expect(gains(mixer)).toEqual([0.4, 0, 1]);
    mixer.setVolume('keys', 250); mixer.setVolume('bass', -5);
    expect(MIXER_PARTS.map(p => mixer.level(p).volume)).toEqual([40, 0, 100]);
    expect(mixer.setVolume('keys', NaN)).toBe(false);
    mixer.setMuted('drums', true);
    expect(mixer.level('drums')).toEqual({ volume: 40, muted: true });
    expect(mixer.gain('drums')).toBe(0);
  });
  it('remembers the parts and the instrument across reloads', () => {
    const mixer = new Mixer();
    mixer.setPlays('guitar'); mixer.setVolume('keys', 55); mixer.setMuted('drums', true);
    stored.set('tabtrainer:family', JSON.stringify('bass'));
    const reloaded = new Mixer();
    expect(reloaded.plays).toBe('guitar');
    expect(MIXER_PARTS.map(p => reloaded.level(p))).toEqual([{ volume: 100, muted: true }, { volume: 100, muted: false }, { volume: 55, muted: false }]);
  });
  it('ignores saved values that do not fit and keeps the jam preference working', () => {
    stored.set('tabtrainer:jam', JSON.stringify({ 'blues-shuffle': { key: 'C', tempo: 120 } }));
    stored.set('tabtrainer:jamMixer', JSON.stringify({ plays: 'banjo', parts: { drums: { volume: 300, muted: 'yes' }, bass: 'loud', keys: { volume: 30 } } }));
    const mixer = new Mixer();
    expect(mixer.plays).toBe('bass');
    expect(MIXER_PARTS.map(p => mixer.level(p))).toEqual([{ volume: 100, muted: false }, { volume: 100, muted: true }, { volume: 30, muted: false }]);
    stored.set('tabtrainer:jamMixer', '[1]');
    expect(gains(new Mixer())).toEqual([1, 0, 1]);
    expect(new Jam(bundledGrooves(files)).key).toBe('C');
  });
});
