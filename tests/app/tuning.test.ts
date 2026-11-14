import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTRUMENTS, customInstrument } from '../../src/core/instruments';
import { TunerTuning, isTunings, readTuning, standardTuning, tuningKey } from '../../src/app/tuning';
import { pref, setPref } from '../../src/app/storage';

const names = (t: TunerTuning) => t.strings.map((_, i) => t.name(i));

describe('standard tunings', () => {
  it('knows bass with 4, 5 and 6 strings and guitar with 6', () => {
    expect(standardTuning('bass', 4)).toEqual([43, 38, 33, 28]);
    expect(standardTuning('bass', 5)?.at(-1)).toBe(23);
    expect(standardTuning('bass', 6)?.[0]).toBe(48);
    expect(standardTuning('guitar', 6)).toEqual([64, 59, 55, 50, 45, 40]);
    expect(standardTuning('guitar', 4)).toBeNull();
  });
});

describe('choosing the tuning', () => {
  it('uses standard bass E A D G when nothing is open', () => {
    const tuning = new TunerTuning('bass', null, {});
    expect(names(tuning)).toEqual(['G2', 'D2', 'A1', 'E1']);
    expect(tuning.key).toBe('bass4');
    expect(tuning.isStandard).toBe(true);
  });

  it('uses standard guitar E A D G B E for guitar', () => {
    expect(names(new TunerTuning('guitar', null, {}))).toEqual(['E4', 'B3', 'G3', 'D3', 'A2', 'E2']);
  });

  it('takes the string count and family from the open song', () => {
    const tuning = new TunerTuning('guitar', INSTRUMENTS.bass5, {});
    expect(tuning.key).toBe('bass5');
    expect(names(tuning).at(-1)).toBe('B0');
  });

  it('uses a saved tuning for the same family and string count', () => {
    const halfDown = [42, 37, 32, 27];
    expect(new TunerTuning('bass', null, { bass4: halfDown }).strings).toEqual(halfDown);
    expect(new TunerTuning('bass', INSTRUMENTS.bass4, { bass4: halfDown }).strings).toEqual(halfDown);
    expect(new TunerTuning('bass', INSTRUMENTS.bass5, { bass4: halfDown }).isStandard).toBe(true);
  });

  it('prefers a song in a non-standard tuning over the saved one', () => {
    const dropD = customInstrument('D2 A2 D3 G3', 'bass');
    const tuning = new TunerTuning('bass', dropD, { bass4: [42, 37, 32, 27] });
    expect(names(tuning)).toEqual(['G2', 'D2', 'A1', 'D1']);
    expect(tuning.isStandard).toBe(false);
  });

  it('ignores a saved tuning with the wrong number of strings', () => {
    expect(new TunerTuning('bass', null, { bass4: [40, 35] }).isStandard).toBe(true);
  });

  it('treats a tuning with no standard, such as ukulele, as its own standard', () => {
    const tuning = new TunerTuning('guitar', INSTRUMENTS.ukulele, {});
    expect(tuning.key).toBe(tuningKey('guitar', 4));
    expect(tuning.isStandard).toBe(true);
  });
});

describe('changing a string by a half step', () => {
  it('drops the low E to D and back', () => {
    const tuning = new TunerTuning('bass', null, {});
    expect(tuning.shift(3, -1)).toBe(true); expect(tuning.shift(3, -1)).toBe(true);
    expect(tuning.name(3)).toBe('D1');
    expect(tuning.frequency(3)).toBeCloseTo(36.71, 2);
    expect(tuning.isStandard).toBe(false);
    tuning.shift(3, 1); tuning.shift(3, 1);
    expect(tuning.isStandard).toBe(true);
  });

  it('stops an octave away from standard', () => {
    const tuning = new TunerTuning('guitar', null, {});
    for (let i = 0; i < 12; i++) expect(tuning.shift(0, 1)).toBe(true);
    expect(tuning.shift(0, 1)).toBe(false);
    expect(tuning.name(0)).toBe('E5');
  });

  it('resets to standard', () => {
    const tuning = new TunerTuning('bass', null, { bass4: [42, 37, 32, 27] });
    tuning.reset();
    expect(tuning.isStandard).toBe(true);
  });

  it('saves a changed tuning and forgets a standard one', () => {
    const tuning = new TunerTuning('bass', null, { guitar6: [64, 59, 55, 50, 45, 38] });
    tuning.shift(0, -1);
    const saved = tuning.saveInto({ guitar6: [64, 59, 55, 50, 45, 38] });
    expect(saved).toEqual({ guitar6: [64, 59, 55, 50, 45, 38], bass4: [42, 38, 33, 28] });
    tuning.reset();
    expect(tuning.saveInto(saved)).toEqual({ guitar6: [64, 59, 55, 50, 45, 38] });
  });
});

describe('reading against a string', () => {
  const bass = [43, 38, 33, 28];

  it('compares with the nearest string in auto mode', () => {
    const reading = readTuning(43, bass, null)!;
    expect(reading).toMatchObject({ target: 3, targetName: 'E1', heard: 'F1', direction: 'down' });
    expect(reading.cents).toBeCloseTo(74, 0);
    expect(reading.targetFrequency).toBeCloseTo(41.2, 1);
  });

  it('compares with the locked string even when another is nearer', () => {
    const reading = readTuning(43, bass, 2)!;
    expect(reading).toMatchObject({ target: 2, targetName: 'A1', direction: 'up' });
    expect(reading.cents).toBeCloseTo(-426, 0);
  });

  it('calls within 5 cents in tune', () => {
    expect(readTuning(41.2 * 2 ** (4 / 1200), bass, null)!.direction).toBe('in-tune');
    expect(readTuning(41.2 * 2 ** (-6 / 1200), bass, null)!.direction).toBe('up');
  });

  it('falls back to the nearest string when the lock is out of range', () => {
    expect(readTuning(55, bass, 9)!.target).toBe(2);
    expect(readTuning(55, [], null)).toBeNull();
  });
});

describe('saved tunings preference', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts only lists of whole MIDI notes', () => {
    expect(isTunings({ bass4: [42, 37, 32, 27] })).toBe(true);
    expect(isTunings({ bass4: [42.5] })).toBe(false);
    expect(isTunings({ bass4: [] })).toBe(false);
    expect(isTunings({ bass4: [200] })).toBe(false);
    expect(isTunings([])).toBe(false);
    expect(isTunings(null)).toBe(false);
  });

  it('round trips through storage and rejects bad data', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) });
    expect(setPref('tunings', { bass4: [42, 37, 32, 27] })).toBe(true);
    expect(pref('tunings', {})).toEqual({ bass4: [42, 37, 32, 27] });
    values.set('tabtrainer:tunings', '{"bass4":["E"]}');
    expect(pref('tunings', {})).toEqual({});
  });
});
