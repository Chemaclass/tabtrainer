import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { JAM_SWING, Jam, MIXER_PARTS, Mixer, NEW_GROOVE_TEXT, bundledGrooves, jamKeys, playableGroove } from '../../src/app/jam';
import { grooveSlug, mineGrooveSlug } from '../../src/app/jamLink';
import type { Saved } from '../../src/app/storage';
import { parseGroove } from '../../src/core/groove';

const files = Object.fromEntries(readdirSync('src/grooves').filter(name => name.endsWith('.txt')).map(name => [`./grooves/${name}`, readFileSync(`src/grooves/${name}`, 'utf8')]));
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
  it('picks the scale from the genre and the key', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(jam.scale).toBe('minor-pentatonic');
    expect(jam.scales).toEqual(['minor-pentatonic', 'blues', 'major', 'major-pentatonic']);
    jam.choose('jazz-swing');
    expect(jam.scale).toBe('major');
    jam.choose('funk-sixteenths');
    expect(jam.scale).toBe('minor');
  });
  it('remembers the chosen scale per groove and drops one that no longer fits the key', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(jam.setScale('blues')).toBe(true);
    expect(jam.setScale('blues')).toBe(false);
    expect(jam.setScale('mixolydian')).toBe(false);
    expect(new Jam(bundledGrooves(files)).scale).toBe('blues');
    jam.choose('jazz-swing');
    expect(jam.setScale('major-pentatonic')).toBe(true);
    expect(jam.setProgression('minor-blues')).toBe(true);
    expect(jam.scale).toBe('minor');
    expect(jam.setProgression('one-chord')).toBe(true);
    const reloaded = new Jam(bundledGrooves(files));
    reloaded.choose('jazz-swing');
    expect(reloaded.scale).toBe('major-pentatonic');
  });
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
  it('opens a linked groove with its key, tempo, progression and swing over the saved ones', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.choose('funk-sixteenths'); jam.setTempo(120);
    jam.choose('blues-shuffle');
    expect(jam.open('funk-sixteenths', { key: 'E', tempo: 96, progression: 'one-chord', swing: 58 })).toBe(true);
    expect(jam.setup).toEqual({ key: 'Em', tempo: 96, progression: 'one-chord', swing: 58 });
    expect(jam.timeline().bars.every(b => b.chord.name.startsWith('E'))).toBe(true);
    expect(new Jam(bundledGrooves(files)).open('funk-sixteenths')).toBe(true);
    expect(jam.open('blues-shuffle', { key: 'Ebm' })).toBe(true);
    expect(jam.key).toBe('Eb');
  });
  it('falls back to the saved setup for an unknown key, tempo, progression or swing', () => {
    const jam = new Jam(bundledGrooves(files));
    const saved = { ...jam.setup };
    expect(jam.open('blues-shuffle', { key: 'H', tempo: 999, progression: 'nope', swing: 10 })).toBe(false);
    expect(jam.open('blues-shuffle', { tempo: 0 })).toBe(false);
    expect(jam.setup).toEqual(saved);
  });
  it('ignores the setup of an unknown groove', () => {
    const jam = new Jam(bundledGrooves(files));
    const saved = { slug: jam.slug, ...jam.setup };
    expect(jam.open('no-such-groove', { key: 'E', tempo: 96 })).toBe(false);
    expect({ slug: jam.slug, ...jam.setup }).toEqual(saved);
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
    expect(JSON.parse(stored.get('tabtrainer:jam') ?? '{}')).toEqual({
      'blues-shuffle': { key: 'C', tempo: 120, progression: 'groove', swing: 66 },
      'minor-vamp': { key: 'Bbm', tempo: 70, progression: 'groove', swing: 50 },
    });
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

describe('jam progression and swing', () => {
  const offBeats = (jam: Jam) => jam.timeline().drums.filter(h => h.drum === 'hat' && h.bar === 0).map(h => +(h.beat % 1).toFixed(4)).filter(f => f > 0);

  it('lists the grooves grouped by genre and opens one by its slug', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(jam.list.map(g => g.slug)).toEqual(['blues-shuffle', 'rock-straight-eighths', 'reggae-one-drop', 'funk-sixteenths', 'jazz-swing', 'bossa-nova', 'metal-gallop']);
    expect(jam.choose('reggae-one-drop')).toBe(true);
    expect([jam.groove.genre, jam.key, jam.tempo, jam.swing]).toEqual(['reggae', 'Am', 74, 58]);
  });
  it('keeps grooves of one genre together', () => {
    const extra = { './grooves/05-blues-slow.txt': 'title: Slow blues\ngenre: blues\nprogression: I7\nkick: x...' };
    expect(new Jam(bundledGrooves({ ...files, ...extra })).list.map(g => g.slug).slice(0, 2)).toEqual(['blues-shuffle', 'blues-slow']);
  });
  it('plays ii V I in Bb with the bass and keys on its chords, the blues walk falling from the major seventh of Bbmaj7', () => {
    const jam = new Jam(bundledGrooves(files));
    expect(jam.setProgression('ii-v-i')).toBe(true);
    expect(jam.setKey('Bb')).toBe(true);
    const t = jam.timeline();
    expect(t.bars.map(b => b.chord.name)).toEqual(['Cm7', 'F7', 'Bbmaj7', 'Bbmaj7']);
    expect(t.bars.map(({ bar }) => t.bass.find(h => h.bar === bar)!.midi[0] % 12)).toEqual([0, 5, 10, 9]);
    expect(t.bars.map(({ bar }) => t.keys.find(h => h.bar === bar)!.midi.map(m => m % 12).sort((a, b) => a - b))).toEqual([[0, 3, 7, 10], [0, 3, 5, 9], [2, 5, 9, 10], [2, 5, 9, 10]]);
    expect(jam.setProgression('ii-v-i')).toBe(false);
    expect(jam.setProgression('polka')).toBe(false);
  });
  it('switches the key list to the mode of the progression and keeps the tonic', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.setProgression('minor-blues');
    expect(jam.key).toBe('Am');
    expect(jam.keys.every(k => k.endsWith('m'))).toBe(true);
    expect(jam.timeline().bars[0].chord.name).toBe('Am7');
    jam.setProgression('groove');
    expect(jam.key).toBe('A');
  });
  it('moves the rock off beats from straight to the triplet and back', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.choose('rock-straight-eighths');
    expect(jam.swing).toBe(50);
    expect(offBeats(jam)).toEqual([0.5, 0.5, 0.5, 0.5]);
    jam.setSwing(100);
    expect(jam.swing).toBe(JAM_SWING.max);
    expect(offBeats(jam)).toEqual(Array(4).fill(+(2 / 3).toFixed(4)));
    jam.setSwing(0);
    expect(offBeats(jam)).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(jam.setSwing(NaN)).toBe(false);
  });
  it('remembers progression and swing for each groove', () => {
    const grooves = bundledGrooves(files);
    const jam = new Jam(grooves);
    jam.setProgression('ii-v-i'); jam.setSwing(60);
    jam.choose('funk-sixteenths');
    expect([jam.progression, jam.swing]).toEqual(['groove', 54]);
    jam.setProgression('one-chord');
    const reloaded = new Jam(grooves);
    expect([reloaded.progression, reloaded.swing]).toEqual(['ii-v-i', 60]);
    reloaded.choose('funk-sixteenths');
    expect([reloaded.progression, reloaded.swing, reloaded.key]).toEqual(['one-chord', 54, 'Em']);
  });
  it('ignores a saved progression or swing that does not fit', () => {
    stored.set('tabtrainer:jam', JSON.stringify({ 'blues-shuffle': { progression: 'polka', swing: 'lots' } }));
    const jam = new Jam(bundledGrooves(files));
    expect([jam.progression, jam.swing]).toEqual(['groove', 66]);
  });
});

describe('my grooves', () => {
  const mine = 'title: Mine\ngenre: rock\ntempo: 120\nkey: G\ntime: 4/4\nprogression: I V\nkick: x...x...\n';
  const saved = (text = mine): Saved[] => [{ title: 'Mine', text, updated: 1 }];

  it('starts from a template that plays without issues', () => {
    const { playable, issues } = playableGroove(NEW_GROOVE_TEXT);
    expect(issues).toEqual([]);
    expect(playable?.title).toBe('My groove');
  });
  it('refuses to play a groove with any issue', () => {
    const { playable, issues } = playableGroove(mine.replace('x...x...', 'x..'));
    expect(playable).toBeNull();
    expect(issues[0].line).toBe(7);
  });
  it('lists saved grooves after the bundled ones and opens them by their slug', () => {
    const jam = new Jam(bundledGrooves(files), () => saved());
    const last = jam.list[jam.list.length - 1];
    expect([last.slug, last.mine, last.text]).toEqual([mineGrooveSlug('Mine'), true, mine]);
    expect(jam.open(mineGrooveSlug('Mine'))).toBe(true);
    expect([jam.groove.title, jam.key, jam.tempo]).toEqual(['Mine', 'G', 120]);
  });
  it('picks up a saved groove and falls back to the first one when the chosen groove is deleted', () => {
    let items: Saved[] = [];
    const jam = new Jam(bundledGrooves(files), () => items);
    items = saved();
    jam.refreshMine();
    expect(jam.choose(mineGrooveSlug('Mine'))).toBe(true);
    items = saved(mine.replace('tempo: 120', 'tempo: 90'));
    jam.refreshMine();
    expect([jam.slug, jam.entry.groove.tempo]).toEqual([mineGrooveSlug('Mine'), 90]);
    items = [];
    jam.refreshMine();
    expect(jam.slug).toBe('blues-shuffle');
  });
  it('plays a draft with its own headers and follows the ones the player changes', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.setProgression('ii-v-i');
    const draft = playableGroove(mine).playable!;
    jam.preview(draft);
    expect([jam.previewing, jam.groove.title, jam.key, jam.tempo, jam.progression]).toEqual([true, 'Mine', 'G', 120, 'groove']);
    jam.setKey('D');
    jam.preview(playableGroove(mine.replace('tempo: 120', 'tempo: 130')).playable!);
    expect([jam.key, jam.tempo]).toEqual(['D', 130]);
    jam.preview(playableGroove(mine.replace('key: G', 'key: Em')).playable!);
    expect(jam.key).toBe('Em');
    expect(jam.timeline().bars.map(bar => bar.chord.name)).toEqual(['E', 'B']);
  });
  it('keeps the chosen setup when the draft is the groove as written', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.setTempo(70);
    jam.setKey('C');
    jam.preview(playableGroove(jam.entry.text).playable!);
    expect([jam.previewing, jam.tempo, jam.key]).toEqual([true, 70, 'C']);
  });
  it('remembers the setup a draft plays with once it is saved', () => {
    let items: Saved[] = [];
    const jam = new Jam(bundledGrooves(files), () => items);
    jam.preview(playableGroove(mine).playable!);
    jam.preview(playableGroove(mine.replace('tempo: 120', 'tempo: 130')).playable!);
    items = saved(mine.replace('tempo: 120', 'tempo: 130'));
    jam.refreshMine();
    expect(jam.keepDraftAs(mineGrooveSlug('Mine'))).toBe(true);
    expect(jam.keepDraftAs('nowhere')).toBe(false);
    expect([jam.previewing, jam.slug, jam.tempo]).toEqual([false, mineGrooveSlug('Mine'), 130]);
    const reloaded = new Jam(bundledGrooves(files), () => items);
    reloaded.choose(mineGrooveSlug('Mine'));
    expect([reloaded.tempo, reloaded.key]).toEqual([130, 'G']);
  });
  it('keeps the choices of the replaced groove while a draft plays and restores them after', () => {
    const jam = new Jam(bundledGrooves(files));
    jam.setTempo(100);
    jam.preview(playableGroove(mine).playable!);
    jam.setTempo(150);
    expect(jam.endPreview()).toBe(true);
    expect(jam.endPreview()).toBe(false);
    expect([jam.groove.title, jam.tempo]).toEqual(['Blues shuffle in A', 100]);
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
  it('turns the drum room on by default and remembers turning it off', () => {
    const mixer = new Mixer();
    expect(mixer.room).toBe(true);
    expect(mixer.setRoom(false)).toBe(true);
    expect(mixer.setRoom(false)).toBe(false);
    expect(new Mixer().room).toBe(false);
    stored.set('tabtrainer:jamMixer', JSON.stringify({ room: 'quiet' }));
    expect(new Mixer().room).toBe(true);
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
