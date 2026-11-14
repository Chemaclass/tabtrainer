import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { FAMILIES, INSTRUMENTS, customInstrument, familyOf } from '../../src/core/instruments';

// folders only: agnostic-ai writes an ignored AGENTS.md into src/songs
const dirs = (p: string) => readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);

describe('instrument families', () => {
  it('lists every bass under bass', () => {
    expect(['bass4', 'bass5', 'bass6'].map(id => familyOf(INSTRUMENTS[id]))).toEqual(['bass', 'bass', 'bass']);
  });
  it('lists guitar and ukulele under guitar', () => {
    expect(familyOf(INSTRUMENTS.guitar6)).toBe('guitar');
    expect(familyOf(INSTRUMENTS.ukulele)).toBe('guitar');
  });
  it('sorts custom tunings by clef', () => {
    expect(familyOf(customInstrument('B0 E1 A1 D2'))).toBe('bass');
    expect(familyOf(customInstrument('D3 A3 D4 G4 B4 E5'))).toBe('guitar');
  });
  it('starts new songs on an instrument of the same family', () => {
    for (const [f, id] of Object.entries(FAMILIES)) expect(familyOf(INSTRUMENTS[id])).toBe(f);
  });
  it('has a demo folder for every family', () => {
    expect(dirs('src/songs').sort()).toEqual(Object.keys(FAMILIES).sort());
  });
  it('splits each family into exercises and songs only', () => {
    for (const f of Object.keys(FAMILIES)) {
      for (const kind of dirs(`src/songs/${f}`)) expect(['exercises', 'songs']).toContain(kind);
    }
  });
});
