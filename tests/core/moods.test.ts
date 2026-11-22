import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGroove } from '../../src/core/groove';
import { OWN_PROGRESSION, PROGRESSION_PRESETS, chordAt, isMinorProgression, keyTonic, numerals, parseNumeral } from '../../src/core/harmony';
import { MOODS, RETIRED_LOOPS, barRows, currentLoopSlug, isMoodId, jamProgression, moodById, moodFits, moodNoteText, type Mood, type MoodId, type MoodLoop } from '../../src/core/moods';
import { isProgressionSlug, progressions, spellChordTones } from '../../src/core/progressions';
import { harmonyScaleId, isScaleId, scaleById, scaleNotes } from '../../src/core/scales';
import { keyRootName, pitchClass } from '../../src/core/theory';

const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const jamKeysFor = (loop: MoodLoop) => (isMinorProgression(numerals(loop.bars)) ? MINOR_KEYS : MAJOR_KEYS);
const loopsOf = (mood: Mood) => mood.loops.map(loop => ({ mood, loop }));
const allLoops = MOODS.flatMap(loopsOf);
const words = (text: string) => text.split(' ').length;

const groovesGenres = readdirSync('src/grooves')
  .filter(f => f.endsWith('.txt'))
  .map(f => parseGroove(readFileSync(`src/grooves/${f}`, 'utf8')).groove.genre);

// Chords a mood plays on purpose although their tones leave its scale
const BORROWED: Partial<Record<MoodId, readonly string[]>> = {
  // The minor iv brings the flat sixth into a major key: that is the mood
  melancholic: ['iv'],
  // Every blues chord is a seventh chord with a tone the blues scale lacks
  bluesy: ['I7', 'IV7', 'V7', 'iv7', 'bVI7'],
};

describe('mood table', () => {
  it('names an existing scale for every mood', () => {
    for (const mood of MOODS) {
      for (const id of [mood.scale, ...mood.alsoScales]) expect(isScaleId(id), mood.id).toBe(true);
    }
  });
  it('writes every progression in numerals parseNumeral reads', () => {
    for (const mood of MOODS) {
      for (const numeral of [...mood.progressions, ...mood.loops.map(l => l.bars)].flatMap(bars => bars.split(' '))) {
        expect(parseNumeral(numeral), `${mood.id}: ${numeral}`).toHaveProperty('numeral');
      }
    }
  });
  it('gives every mood a progression and a reason', () => {
    for (const mood of MOODS) {
      expect(mood.progressions.length, mood.id).toBeGreaterThan(0);
      expect(mood.why, mood.id).not.toBe('');
    }
  });
  it('knows its mood ids, in the order the chips show them', () => {
    expect(MOODS.map(mood => mood.id)).toEqual(['happy', 'sad', 'melancholic', 'exciting', 'epic', 'dark', 'tense', 'dreamy', 'bluesy', 'funky']);
    expect(isMoodId('dark')).toBe(true);
    expect(isMoodId('melancholic')).toBe(true);
    expect(isMoodId('angry')).toBe(false);
    expect(moodById('dreamy').scale).toBe('lydian');
    expect(() => moodById('angry' as MoodId)).toThrow();
  });
  it('explains every mood without theory terms, counting distances in frets', () => {
    for (const mood of MOODS) {
      const texts = [mood.why, mood.tempo.outside, ...mood.loops.flatMap(l => l.jobs)];
      for (const text of texts) expect(text, mood.id).not.toMatch(/\b(root|second|third|fourth|fifth|sixth|seventh|half step|whole step|raised|flat|vamp|resolve)/i);
    }
  });
  it('writes no dashes other than a hyphen in any mood text', () => {
    for (const mood of MOODS) {
      const texts = [mood.name, mood.why, mood.tempo.outside, mood.note.label, mood.note.contrast, ...mood.loops.flatMap(l => l.jobs)];
      for (const text of texts) expect(text, mood.id).not.toMatch(/[‒-―]/);
    }
  });
});

describe('mood loops', () => {
  it('gives every mood at least two loops of four, eight or twelve bars', () => {
    for (const mood of MOODS) {
      expect(mood.loops.length, mood.id).toBeGreaterThanOrEqual(2);
      for (const loop of mood.loops) expect([4, 8, 12], `${mood.id}: ${loop.bars}`).toContain(numerals(loop.bars).length);
    }
  });
  it('ends every eight bar loop away from home, with a second half of its own', () => {
    const eightBars = allLoops.filter(({ loop }) => numerals(loop.bars).length === 8);
    expect(eightBars.length).toBeGreaterThanOrEqual(3);
    for (const { mood, loop } of eightBars) {
      const bars = loop.bars.split(' ');
      expect(numerals(loop.bars)[7].degree, `${mood.id}: ${loop.bars}`).not.toBe(0);
      expect(bars.slice(4).join(' '), `${mood.id}: ${loop.bars}`).not.toBe(bars.slice(0, 4).join(' '));
    }
  });
  it('names an eight bar loop in two rows of four', () => {
    expect(barRows('I bVII IV I')).toBe('I bVII IV I');
    expect(barRows('I I bVII IV I I IV bVII')).toBe('I I bVII IV | I I IV bVII');
    expect(moodById('exciting').loops[0]).toMatchObject({ slug: 'exciting-i-i-bvii-iv-i-i-iv-bvii', name: 'I I bVII IV | I I IV bVII' });
  });
  it('gives every bar a job of at most seven words', () => {
    for (const { mood, loop } of allLoops) {
      expect(loop.jobs, `${mood.id}: ${loop.bars}`).toHaveLength(numerals(loop.bars).length);
      for (const job of loop.jobs) {
        expect(words(job), `${mood.id}: ${job}`).toBeLessThanOrEqual(7);
        expect(job, `${mood.id}: ${job}`).toMatch(/^[A-Z].*\.$/);
      }
    }
  });
  it('starts every loop on the home chord', () => {
    for (const { mood, loop } of allLoops) expect(numerals(loop.bars)[0].degree, `${mood.id}: ${loop.bars}`).toBe(0);
  });
  it('gives every loop its own slug, reusing the Jam preset where the numerals match', () => {
    const slugs = allLoops.map(({ loop }) => loop.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(moodById('happy').loops.map(l => l.slug)).toEqual(['i-v-vi-iv', 'i-iv-v', 'happy-i-vi-iv-v']);
    expect(moodById('epic').loops[1]).toMatchObject({ slug: 'i-bvii-bvi-bvii', name: 'i bVII bVI bVII' });
    expect(moodById('bluesy').loops.map(l => l.slug)).toEqual(['12-bar-blues', 'minor-blues']);
    expect(moodById('sad').loops[0]).toMatchObject({ slug: 'sad-i-bvi-biii-bvii', name: 'i bVI bIII bVII' });
  });
  it('keeps every chord tone in the mood scale, apart from the chords a mood borrows, in every key', () => {
    for (const { mood, loop } of allLoops) {
      const progression = numerals(loop.bars);
      for (const key of jamKeysFor(loop)) {
        const scale = scaleNotes(keyTonic(key)!, mood.scale).map(n => n.pitchClass);
        progression.forEach((numeral, bar) => {
          if (BORROWED[mood.id]?.includes(numeral.text)) return;
          const stray = chordAt(progression, key, bar).tones.filter(tone => !scale.includes(tone));
          expect(stray, `${mood.id}: ${numeral.text} in ${key}`).toEqual([]);
        });
      }
    }
  });
  it('borrows only chords that really leave the scale', () => {
    for (const [id, borrowed] of Object.entries(BORROWED)) {
      const mood = moodById(id as MoodId);
      const scale = scaleById(mood.scale).intervals;
      for (const text of borrowed) {
        const [numeral] = numerals(text);
        const chord = chordAt([numeral], 'C', 0);
        expect(chord.tones.some(tone => !scale.includes(tone)), `${id}: ${text}`).toBe(true);
        expect(mood.loops.some(l => l.bars.split(' ').includes(text)), `${id}: ${text}`).toBe(true);
      }
    }
  });
  it('plays a minor key for a minor scale and a major key for a major one', () => {
    for (const { mood, loop } of allLoops) {
      if (mood.id === 'bluesy') continue;
      const minorScale = scaleById(mood.scale).intervals.includes(3);
      expect(isMinorProgression(numerals(loop.bars)), `${mood.id}: ${loop.bars}`).toBe(minorScale);
    }
  });
});

describe('retired mood loops', () => {
  it('opens each retired loop as the loop of its mood that starts with the same bars', () => {
    for (const retired of RETIRED_LOOPS) {
      const current = currentLoopSlug(retired.slug);
      const loop = moodById(retired.mood).loops.find(l => l.slug === current);
      expect(loop, retired.slug).toBeDefined();
      const oldBars = retired.slug.slice(retired.mood.length + 1).split('-');
      expect(loop!.bars.toLowerCase().split(' ').slice(0, oldBars.length), retired.slug).toEqual(oldBars);
    }
  });
  it('keeps any other slug as it is', () => {
    for (const slug of ['exciting-i-i-bvii-iv-i-i-iv-bvii', 'i-v-vi-iv', OWN_PROGRESSION, 'nope']) expect(currentLoopSlug(slug)).toBe(slug);
  });
});

describe('mood tempo', () => {
  it('starts every mood inside its own range', () => {
    for (const { id, tempo } of MOODS) expect(tempo.start, id).toSatisfy((start: number) => start >= tempo.min && start <= tempo.max);
  });
});

describe('jam progressions', () => {
  const own = numerals('I7 IV7 I7 V7');

  it('resolves the groove own chords and the presets as before', () => {
    expect(jamProgression(OWN_PROGRESSION, own)?.map(n => n.text)).toEqual(['I7', 'IV7', 'I7', 'V7']);
    for (const { slug } of PROGRESSION_PRESETS) expect(jamProgression(slug, own), slug).not.toBeNull();
  });
  it('resolves every mood loop by its slug', () => {
    for (const { loop } of allLoops) expect(jamProgression(loop.slug, own)?.map(n => n.text).join(' '), loop.slug).toBe(loop.bars);
  });
  it('knows nothing of an unknown slug', () => {
    expect(jamProgression('sad-i-ii', own)).toBeNull();
  });
});

describe('mood tempo and grooves', () => {
  it('keeps every tempo range inside the Jam slider, with a word that matches it', () => {
    for (const { id, tempo } of MOODS) {
      expect(tempo.min, id).toBeGreaterThanOrEqual(40);
      expect(tempo.max, id).toBeLessThanOrEqual(220);
      expect(tempo.min, id).toBeLessThan(tempo.max);
      if (tempo.word === 'Slow') expect(tempo.max, id).toBeLessThanOrEqual(110);
      if (tempo.word === 'Fast') expect(tempo.min, id).toBeGreaterThanOrEqual(120);
      expect(tempo.outside, id).toMatch(/^(Slower|Faster) and /);
    }
  });
  it('names only genres a bundled groove has, at least one per mood', () => {
    for (const mood of MOODS) {
      expect(mood.genres.length, mood.id).toBeGreaterThan(0);
      for (const genre of mood.genres) expect(groovesGenres, `${mood.id}: ${genre}`).toContain(genre);
    }
  });
  it('fits a groove by its genre', () => {
    expect(moodFits(moodById('funky'), 'funk')).toBe(true);
    expect(moodFits(moodById('sad'), 'blues')).toBe(false);
  });
});

describe('mood notes', () => {
  const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six'];
  const keysOf = (mood: Mood) => [...new Set(mood.loops.flatMap(jamKeysFor))];

  it('names a note of the mood scale and of every other scale it offers, or for a borrowed note a tone of a chord in every loop', () => {
    for (const mood of MOODS) {
      const semitones = moodNoteText(mood, 'C').pitchClass;
      const scales = [mood.scale, ...mood.alsoScales].map(id => scaleById(id).intervals);
      if (scales.every(intervals => intervals.includes(semitones))) continue;
      expect(mood.id).toBe('melancholic');
      expect(scales.some(intervals => intervals.includes(semitones)), mood.id).toBe(false);
      for (const loop of mood.loops) {
        const progression = numerals(loop.bars);
        const holds = progression.some((_, bar) => chordAt(progression, 'C', bar).tones.includes(semitones));
        expect(holds, `${mood.id}: ${loop.bars}`).toBe(true);
      }
    }
  });
  it('names the right note, spelled as the Jam fretboard spells it, in every key', () => {
    for (const mood of MOODS) {
      for (const key of keysOf(mood)) {
        const rootSpelling = keyRootName(key);
        const root = keyTonic(key)!;
        const note = moodNoteText(mood, rootSpelling);
        const scaleNote = scaleNotes(root, mood.scale, rootSpelling).find(n => n.pitchClass === note.pitchClass);
        if (scaleNote) {
          expect(note.name, `${mood.id} in ${key}`).toBe(scaleNote.name);
          continue;
        }
        const harmony = scaleNotes(root, harmonyScaleId(mood.scale), rootSpelling);
        const chordSpellings = mood.loops.flatMap(loop => {
          const progression = numerals(loop.bars);
          return progression.flatMap((_, bar) => spellChordTones(chordAt(progression, key, bar), rootSpelling, harmony));
        });
        const spelled = chordSpellings.filter(t => t.pitchClass === note.pitchClass).map(t => t.name);
        expect(new Set(spelled), `${mood.id} in ${key}`).toEqual(new Set([note.name]));
      }
    }
  });
  it('says the true distance from the root in every key', () => {
    for (const mood of MOODS) {
      for (const key of keysOf(mood)) {
        const rootSpelling = keyRootName(key);
        const note = moodNoteText(mood, rootSpelling);
        const r = /^(\S+) is the \w+ note\. (One|Two|Three|Four|Five|Six) frets? (above|below) (\S+), (.+)\.$/.exec(note.sentence);
        expect(r, note.sentence).not.toBeNull();
        const [, name, count, direction, rootName, contrast] = r!;
        const frets = NUMBER_WORDS.indexOf(count.toLowerCase()) + 1;
        const semitones = pitchClass(note.pitchClass - keyTonic(key)!);
        expect(name, note.sentence).toBe(note.name);
        expect(rootName, note.sentence).toBe(rootSpelling);
        expect(pitchClass(direction === 'above' ? frets : -frets), note.sentence).toBe(semitones);
        const notCount = /^not (\w+)/.exec(contrast)?.[1];
        if (notCount) expect(Math.abs(NUMBER_WORDS.indexOf(notCount) + 1 - frets), note.sentence).toBe(1);
      }
    }
  });
  it('writes the legend sentences the design shows', () => {
    expect(moodNoteText(moodById('sad'), 'A').sentence).toBe('C is the sad note. Three frets above A, not four.');
    expect(moodNoteText(moodById('happy'), 'C').sentence).toBe('E is the happy note. Four frets above C, not three.');
    expect(moodNoteText(moodById('tense'), 'A').sentence).toBe('G# is the tense note. One fret below A, so it pulls up into it.');
    expect(moodNoteText(moodById('bluesy'), 'A').sentence).toBe('Eb is the blue note. Six frets above A, one fret below the fifth.');
    expect(moodNoteText(moodById('melancholic'), 'C').sentence).toBe('Ab is the melancholic note. Four frets below C, not three, and it comes with the minor chord.');
    expect(moodNoteText(moodById('exciting'), 'E').sentence).toBe('D is the exciting note. Two frets below E, not one.');
    expect(moodNoteText(moodById('epic'), 'E').sentence).toBe('C is the epic note. Four frets below E, not three.');
    expect(moodNoteText(moodById('dreamy'), 'C').sentence).toBe('F# is the dreamy note. Six frets above C, not five.');
    expect(moodNoteText(moodById('funky'), 'E').name).toBe('C#');
    expect(moodNoteText(moodById('dark'), 'Eb').name).toBe('Fb');
  });
});

describe('moods in the Fretboard dialog', () => {
  it('lists the new moods progressions in their keys', () => {
    expect(progressions(0, 'major', moodById('melancholic'))[0].chords.map(c => c.name)).toEqual(['C', 'F', 'Fm']);
    expect(progressions(4, 'mixolydian', moodById('exciting'))[0].chords.map(c => c.name)).toEqual(['E', 'D', 'A']);
  });
  it('keeps the saved slug of the Dark progression whose seventh chord turned minor', () => {
    expect(isProgressionSlug('dark-i-bii-bvii')).toBe(true);
    expect(progressions(4, 'phrygian', moodById('dark'))[1].chords.map(c => c.name)).toEqual(['Em', 'F', 'Dm']);
  });
});
