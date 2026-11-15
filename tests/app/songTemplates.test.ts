import { describe, expect, it } from 'vitest';
import { parseSong } from '../../src/core/parser';
import { serializeSong } from '../../src/core/serialize';
import { proposeSong } from '../../src/app/songProposal';
import { hasPracticeLevels } from '../../src/app/practiceLevels';
import { PLACEHOLDER_TITLE, SONG_TEMPLATES, TEMPLATE_INSTRUMENTS, templateInstruments, templateText, titleRange } from '../../src/app/songTemplates';

describe('song templates', () => {
  for (const template of SONG_TEMPLATES) {
    for (const instrument of TEMPLATE_INSTRUMENTS) {
      it(`${template.id} on ${instrument} parses cleanly and round-trips`, () => {
        const text = templateText(template.id, instrument);
        const { song, issues } = parseSong(text);
        expect(issues).toEqual([]);
        expect(song.meta.instrument.id).toBe(instrument);
        expect(song.meta.about).toBeTruthy();
        expect(song.meta.level).toBeTruthy();
        for (const version of song.versions) expect(version.bars.length, version.name).toBeGreaterThan(3);
        const again = parseSong(serializeSong(song));
        expect(again.issues).toEqual([]);
        expect(again.song.versions.map(v => v.bars.map(b => b.events))).toEqual(song.versions.map(v => v.bars.map(b => b.events)));
      });

      it(`${template.id} on ${instrument} only needs its own title before it can be added`, () => {
        expect(proposeSong(templateText(template.id, instrument), 'exercises', []).problems).toEqual(['Give the song its own title.']);
      });
    }
  }

  it('teaches the note format and shows samples with the low E string of each instrument', () => {
    expect(templateText('groove', 'bass4')).toContain('# Notes are fret.string. 3.4 is fret 3 on string 4, your low E string.');
    expect(templateText('groove', 'bass6')).toContain('3.5 is fret 3 on string 5');
    expect(templateText('groove', 'guitar6')).toContain('3.6 is fret 3 on string 6');
    expect(SONG_TEMPLATES[0].sample('bass4')).toBe(':q 3.3 3.3 :8 5.2 5.2');
    expect(SONG_TEMPLATES[0].sample('guitar6')).toBe(':q 3.5 3.5 :8 5.4 5.4');
  });

  it('plays the same notes on every bass, on the E A D G strings', () => {
    const notes = (instrument: 'bass4' | 'bass5' | 'bass6') => {
      const song = parseSong(templateText('blues', instrument)).song;
      return song.bars.flatMap(bar => bar.events.flatMap(event => event.notes.map(note => song.meta.instrument.tuning[note.string - 1] + note.fret)));
    };
    expect(notes('bass5')).toEqual(notes('bass4'));
    expect(notes('bass6')).toEqual(notes('bass4'));
  });

  it('gives the exercise template the three practice levels', () => {
    expect(hasPracticeLevels(parseSong(templateText('levels', 'bass4')).song.versions.map(v => v.name))).toBe(true);
  });

  it('offers the instruments of the chosen family', () => {
    expect(templateInstruments('bass')).toEqual(['bass4', 'bass5', 'bass6']);
    expect(templateInstruments('guitar')).toEqual(['guitar6']);
  });

  it('finds the title so typing replaces it', () => {
    const text = templateText('groove', 'bass4');
    const range = titleRange(text);
    expect(range && text.slice(range.start, range.end)).toBe(PLACEHOLDER_TITLE);
    expect(titleRange('tempo: 90\n')).toBeNull();
  });
});
