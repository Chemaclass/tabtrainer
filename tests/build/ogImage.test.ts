import { describe, expect, it } from 'vitest';
import { CARD_HEIGHT, CARD_WIDTH, cardPng, cardSvg, grooveCard, songCard, woffToSfnt } from '../../src/build/ogImage';
import { parseSong } from '../../src/core/parser';
import { parseGroove } from '../../src/core/groove';
import { deflateSync } from 'node:zlib';

const song = (header: string, body: string) => parseSong(`title: Ode <to> Joy\n${header}tempo: 90\nkey: D\ninstrument: bass4\n\n${body}\n`).song;

describe('share card', () => {
  it('names the song, its details and the first notes', () => {
    const card = songCard(song('artist: Beethoven\nlevel: easy\n', '"D" :q 7.2 7.2 8.2 10.2 | :h 10.2 8.2 |'), 'bass');
    expect(card).toMatchObject({ kicker: 'bass tab', title: 'Ode <to> Joy', details: ['Beethoven', 'Key D', '90 BPM', 'Easy'] });
    expect(card.staff).toMatchObject({ strings: 4, columns: [{ notes: [{ string: 2, fret: 7 }], chord: 'D' }, {}, {}, {}, 'bar', {}, {}, 'bar'] });
  });
  it('leaves out the app as artist and skips rests', () => {
    const card = songCard(song('artist: TabTrainer\n', ':q r 3.4 r r |'), 'bass');
    expect(card.details).toEqual(['Key D', '90 BPM']);
    expect(card.staff).toMatchObject({ columns: [{ notes: [{ string: 4, fret: 3 }] }, 'bar'] });
  });
  it('skips bars with no notes and brackets tied notes the way the tab does', () => {
    const card = songCard(song('', ':w r | :w r | :h 3.4 :h ~3.4 |'), 'bass');
    expect(card.staff).toMatchObject({ columns: [{ notes: [{ fret: 3 }] }, { notes: [{ fret: 3, tie: true }] }, 'bar'] });
    expect(cardSvg(card, 'example.com')).toContain('>(3)</text>');
  });
  it('shows a dead note as x, not as an open string', () => {
    const card = songCard(song('', ':q x.4 3.4 x.3 3.4 |'), 'bass');
    expect(card.staff).toMatchObject({ columns: [{ notes: [{ string: 4, dead: true }] }, {}, {}, {}, 'bar'] });
    expect(cardSvg(card, 'example.com')).toContain('>x</text>');
    expect(cardSvg(card, 'example.com')).not.toContain('>0</text>');
  });
  it('moves a chord written on a rest to the next note', () => {
    expect(songCard(song('', '"Am" :q r 5.3 "D7" 5.2 |'), 'bass').staff).toMatchObject({ columns: [{ chord: 'Am' }, { chord: 'D7' }, 'bar'] });
  });
  it('charts the first eight chords of a groove in its key', () => {
    const groove = parseGroove('title: Shuffle\ngenre: blues\ntempo: 80\nkey: A\ntime: 4/4\nprogression: I7 IV7\nkick: x...\n').groove;
    expect(grooveCard(groove)).toEqual({ kicker: 'blues groove', title: 'Shuffle', details: ['Key A', '80 BPM', '4/4'], staff: { chords: ['A7', 'D7', 'A7', 'D7', 'A7', 'D7', 'A7', 'D7'] } });
  });
  it('escapes the text and shortens a title too long for two lines', () => {
    const svg = cardSvg(songCard(song('', ':q 3.4 |'), 'bass'), 'example.com');
    expect(svg).toContain('>Ode &lt;to&gt; Joy</text>');
    const long = cardSvg({ kicker: 'bass tab', title: 'word '.repeat(40).trim(), details: [], staff: { chords: [] } }, 'example.com');
    expect(long.match(/font-size="64"[^>]*>[^<]*<\/text>/g)).toHaveLength(2);
    expect(long).toContain('…</text>');
    const oneWord = cardSvg({ kicker: 'bass tab', title: 'a'.repeat(40) + ' ' + 'b'.repeat(41) + ' ccc', details: [], staff: { chords: [] } }, 'example.com');
    const lines = [...oneWord.matchAll(/font-size="64"[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
    expect(lines).toHaveLength(2);
    expect(lines.every(line => line.length <= 29 && /[ab]/.test(line))).toBe(true);
  });
  it('renders a card at the size link previews expect', () => {
    const png = cardPng(cardSvg(songCard(song('', ':q 3.4 5.3 |'), 'bass'), 'example.com'));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([CARD_WIDTH, CARD_HEIGHT]);
  });
  it('unpacks each WOFF table back into the font', () => {
    const table = Buffer.from('glyph '.repeat(20));
    const packed = deflateSync(table);
    const woff = Buffer.alloc(44 + 20 + packed.length);
    woff.writeUInt32BE(0x774f4646, 0);
    woff.writeUInt32BE(0x00010000, 4);
    woff.writeUInt16BE(1, 12);
    woff.write('glyf', 44, 'latin1');
    woff.writeUInt32BE(64, 48);
    woff.writeUInt32BE(packed.length, 52);
    woff.writeUInt32BE(table.length, 56);
    woff.writeUInt32BE(1234, 60);
    packed.copy(woff, 64);
    const font = woffToSfnt(woff);
    expect(font.readUInt32BE(0)).toBe(0x00010000);
    expect(font.readUInt16BE(4)).toBe(1);
    expect(font.subarray(12, 16).toString('latin1')).toBe('glyf');
    expect([font.readUInt32BE(16), font.readUInt32BE(20), font.readUInt32BE(24)]).toEqual([1234, 28, table.length]);
    expect(font.subarray(28, 28 + table.length)).toEqual(table);
  });
});
