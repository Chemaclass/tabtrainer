import { describe, expect, it } from 'vitest';
import { PassagePlayback, beatInBar } from '../../src/app/passagePlayback';
import { Passage } from '../../src/app/passage';
import { parseSong } from '../../src/core/parser';
import { buildTimeline } from '../../src/core/timeline';

const timeline = buildTimeline(parseSong('title: Four bars\ninstrument: bass4\n:q 3.3 5.3 7.3 8.3 | 3.3 r r r | 5.3 r r r | 7.3 r r r |\n').song);

function setup({ playing = false } = {}) {
  const calls: string[] = [];
  const player = {
    bars: timeline.bars, range: null as [number, number] | null, pausedAt: null as number | null, playing,
    setRange(range: [number, number] | null, loop: boolean) { this.range = range; calls.push(`range ${range} ${loop}`); },
    barRange(first: number, last: number): [number, number] { const z = timeline.bars[last - 1]; return [timeline.bars[first - 1].start, z.start + z.length]; },
    seek(beat: number) { this.pausedAt = beat; calls.push(`seek ${beat}`); },
    seekNote(key: string) { const note = this.noteAtKey(key); if (note) this.pausedAt = note.beat; calls.push(`seekNote ${key}`); return !!note; },
    noteAtKey: (key: string) => timeline.notes.find(note => note.key === key),
    stop() { this.pausedAt = null; calls.push('stop'); playback.deselect(); },
  };
  const passage = new Passage();
  passage.setSong(timeline.bars.length, true);
  const playback = new PassagePlayback(player, passage);
  return { player, passage, playback, calls };
}

describe('passage playback', () => {
  it('selects a bar and moves the player to its start', () => {
    const { playback, passage, calls } = setup();
    expect(playback.selectBar(3)).toBe(true);
    expect(passage.snapshot().selected).toBe(3);
    expect(playback.selectedNote).toBeNull();
    expect(calls).toEqual(['range null false', 'seek 8']);
  });

  it('ignores a bar outside the song', () => {
    const { playback, calls } = setup();
    expect(playback.selectBar(9)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('selects a note in its bar and moves the player to it', () => {
    const { playback, passage, calls } = setup();
    expect(playback.selectNote('2000', 1)).toBe(true);
    expect(playback.selectedNote).toEqual({ key: '2000', beat: 2, bar: 1 });
    expect(passage.snapshot().selected).toBe(1);
    expect(calls).toEqual(['range null false', 'seekNote 2000']);
  });

  it('refuses a note that is not in the given bar', () => {
    const { playback, calls } = setup();
    expect(playback.selectNote('2000', 2)).toBe(false);
    expect(playback.selectNote('missing', 1)).toBe(false);
    expect(playback.selectedNote).toBeNull();
    expect(calls).toEqual([]);
  });

  it('drops the selected note when a bar is selected', () => {
    const { playback } = setup();
    playback.selectNote('2000', 1);
    playback.selectBar(2);
    expect(playback.selectedNote).toBeNull();
  });

  it('gives the player the bar range and its repeat', () => {
    const { playback, passage, player, calls } = setup();
    passage.setRange(2, 3, true);
    playback.apply();
    expect(player.range).toEqual([4, 12]);
    expect(calls).toContain('range 4,12 true');
  });

  it('moves a stopped player into a new range and selects its first bar', () => {
    const { playback, passage, calls } = setup();
    passage.setRange(2, 3, false);
    playback.apply();
    expect(calls).toEqual(['range 4,12 false', 'seek 4']);
    expect(passage.snapshot().selected).toBe(2);
  });

  it('keeps a paused position that is already inside the range', () => {
    const { playback, passage, player, calls } = setup();
    player.pausedAt = 5;
    passage.setRange(2, 3, false);
    playback.apply();
    expect(calls).toEqual(['range 4,12 false']);
  });

  it('does not seek while playing', () => {
    const { playback, passage, calls } = setup({ playing: true });
    passage.setRange(2, 3, true);
    playback.apply();
    expect(calls).toEqual(['range 4,12 true']);
  });

  it('drops a selected note that falls outside the new range', () => {
    const { playback, passage } = setup();
    playback.selectNote('2000', 1);
    passage.setRange(2, 3, false);
    playback.apply();
    expect(playback.selectedNote).toBeNull();
  });

  it('clears the player range when the passage is the whole song', () => {
    const { playback, player } = setup();
    playback.apply();
    expect(player.range).toBeNull();
  });

  it('keeps the selected note on stop', () => {
    const { playback, passage, calls } = setup();
    playback.selectNote('2000', 1); calls.length = 0;
    playback.stop();
    expect(playback.selectedNote).toEqual({ key: '2000', beat: 2, bar: 1 });
    expect(passage.snapshot().selected).toBe(1);
    expect(calls).toEqual(['stop', 'range null false', 'seekNote 2000']);
  });

  it('keeps the selected bar on stop', () => {
    const { playback, passage, calls } = setup();
    playback.selectBar(3); calls.length = 0;
    playback.stop();
    expect(passage.snapshot().selected).toBe(3);
    expect(calls).toEqual(['stop', 'range null false', 'seek 8']);
  });

  it('stops with nothing selected', () => {
    const { playback, passage, calls } = setup();
    playback.stop();
    expect(passage.snapshot().selected).toBe(0);
    expect(calls).toEqual(['stop']);
  });

  it('forgets the note and the bar when deselected', () => {
    const { playback, passage } = setup();
    playback.selectNote('2000', 1);
    playback.deselect();
    expect(playback.selectedNote).toBeNull();
    expect(passage.snapshot().selected).toBe(0);
  });
});

describe('beat in bar', () => {
  it('counts from one inside the bar', () => {
    expect(beatInBar(8, 8, 4)).toBe(1);
    expect(beatInBar(9.5, 8, 4)).toBe(2.5);
  });

  it('scales by the bar beat value', () => {
    expect(beatInBar(9, 8, 8)).toBe(3);
    expect(beatInBar(8.5, 8, 16)).toBe(3);
  });

  it('rounds to three decimals', () => {
    expect(beatInBar(8 + 1 / 3, 8, 4)).toBe(1.333);
  });
});
