import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TempoMap } from '../../src/core/tempoMap';
import { parseSong } from '../../src/core/parser';
import { buildTimeline } from '../../src/core/timeline';

const changing = () => new TempoMap([
  { bar: 1, start: 0, length: 4, beats: 4, beatValue: 4 },
  { bar: 2, start: 4, length: 4, beats: 4, beatValue: 4, tempo: 60 },
], 120);

describe('tempo map', () => {
  it('measures time across tempo changes and starts inside a later bar', () => {
    const clock = changing();
    expect(clock.secondsBetween(0, 6)).toBe(4);
    expect(clock.secondsBetween(3, 6)).toBe(2.5);
    expect(clock.secondsBetween(5, 7)).toBe(2);
    expect(clock.tempoAt(3.99)).toBe(120);
    expect(clock.tempoAt(4)).toBe(60);
    expect(clock.tempoAt(20)).toBe(60);
  });
  it('finds the written beat after elapsed playback time', () => {
    const clock = changing();
    expect(clock.advance(0, 2)).toBe(4);
    expect(clock.advance(0, 3)).toBe(5);
    expect(clock.advance(3, 2.5)).toBe(6);
    expect(clock.advance(5, 2)).toBe(7);
  });
  it('uses a first-bar override and defaults to the header without changes', () => {
    const clock = new TempoMap([{ bar: 1, start: 0, length: 4, beats: 4, beatValue: 4, tempo: 90 }], 120);
    expect(clock.secondsBetween(0, 3)).toBe(2);
    expect(new TempoMap([], 120).secondsBetween(0, 3)).toBe(1.5);
  });
  it('plays the trimmed Orion excerpt at 78 BPM, changing to 130 at the Bridge', () => {
    const { song, issues } = parseSong(readFileSync('src/songs/bass/songs/09-orion.txt', 'utf8'));
    expect(issues).toEqual([]);
    const timeline = buildTimeline(song), clock = new TempoMap(timeline.bars, song.meta.tempo);
    expect(song.bars).toHaveLength(80);
    expect(song.bars[0]).toMatchObject({ section: 'Interlude Bass Break', beats: 6, beatValue: 8 });
    expect(song.bars.at(-1)).toMatchObject({ beats: 3, beatValue: 4 });
    expect(clock.tempoAt(0)).toBe(78);
    expect(timeline.bars[76]).toMatchObject({ tempo: 130, start: 229 });
    expect(clock.tempoAt(228.9)).toBe(78);
    expect(clock.secondsBetween(229, timeline.total)).toBeCloseTo(15 * 60 / 130);
  });
});
