import { describe, expect, it } from 'vitest';
import { parseSong } from '../src/core/parser';
import { serializeSong } from '../src/core/serialize';
import { withVersion } from '../src/core/model';
import { buildTimeline } from '../src/core/timeline';

const SRC = `title: Two ways
instrument: bass4
tempo: 90
key: C
time: 4/4

== Bass line
@Verse
"C" :q 3.3 3.3 5.2 3.3 |
[2/4] :h 3.3 |

== Melody + chords
@Verse
"C" :h (3.3 5.2) :q 5.1 7.1 |
[2/4] :8 5.1 7.1 :q 5.1 |
`;

describe('song versions', () => {
  const { song, issues } = parseSong(SRC);
  it('parses each "== Name" block as its own version', () => {
    expect(issues).toEqual([]);
    expect(song.versions.map(v => v.name)).toEqual(['Bass line', 'Melody + chords']);
    expect(song.versions.map(v => v.bars.length)).toEqual([2, 2]);
    // bar numbers and time signatures restart for every version
    expect(song.versions[1].bars[0]).toMatchObject({ index: 1, beats: 4, section: 'Verse' });
    expect(song.versions[1].bars[1].beats).toBe(2);
    // the shown bars default to the first version
    expect(song.bars).toBe(song.versions[0].bars);
  });
  it('durations reset per version', () => {
    // version 2 starts with ":h" explicitly; its first event must not inherit version 1's last duration
    expect(song.versions[1].bars[0].events[0].value).toBe('h');
  });
  it('switches versions with withVersion()', () => {
    const v2 = withVersion(song, 1);
    expect(v2.bars).toBe(song.versions[1].bars);
    expect(buildTimeline(v2).notes.filter(n => n.bar === 1)).toHaveLength(4);
    expect(withVersion(song, 99).bars).toBe(song.versions[1].bars);
  });
  it('round-trips through the serializer', () => {
    const text = serializeSong(song);
    expect(text).toContain('== Bass line');
    expect(text).toContain('== Melody + chords');
    const again = parseSong(text);
    expect(again.issues).toEqual([]);
    expect(again.song.versions.map(v => v.bars.map(b => b.events))).toEqual(song.versions.map(v => v.bars.map(b => b.events)));
  });
  it('treats a song without markers as one "Main" version', () => {
    const r = parseSong(':q 3.4 3.4 3.4 3.4 |');
    expect(r.song.versions).toHaveLength(1);
    expect(r.song.versions[0].name).toBe('Main');
    expect(serializeSong(r.song)).not.toContain('==');
  });
  it('keeps bars written before the first marker as their own version', () => {
    const r = parseSong(':q 3.4 3.4 3.4 3.4 |\n== Alt\n:q 5.4 5.4 5.4 5.4 |');
    expect(r.song.versions.map(v => v.name)).toEqual(['Main', 'Alt']);
  });
  it('warns about duplicate version names', () => {
    const r = parseSong('== A\n:w 3.4 |\n== A\n:w 5.4 |');
    expect(r.issues.some(i => /already a version/.test(i.message))).toBe(true);
  });
});

describe('levels', () => {
  const SRC = `title: Two ways
level: easy
instrument: bass4
tempo: 90
key: C
time: 4/4

== Bass line
"C" :q 3.3 3.3 5.2 3.3 |

== Melody + chords
level: hard
"C" :h (3.3 5.2) :q 5.1 7.1 |
`;
  const { song, issues } = parseSong(SRC);
  it('reads the song level and a version level', () => {
    expect(issues).toEqual([]);
    expect(song.meta.level).toBe('easy');
    expect(song.versions.map(v => v.level)).toEqual([undefined, 'hard']);
  });
  it('shows the version level when that version is picked', () => {
    expect(withVersion(song, 0).meta.level).toBe('easy');
    expect(withVersion(song, 1).meta.level).toBe('hard');
  });
  it('keeps levels through a round trip', () => {
    const again = parseSong(serializeSong(song)).song;
    expect(again.meta.level).toBe('easy');
    expect(again.versions[1].level).toBe('hard');
  });
  it('rejects an unknown level', () => {
    expect(parseSong(SRC.replace('level: easy', 'level: brutal')).issues[0].message).toContain('Level must be one of');
  });
});
