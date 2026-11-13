# TabTrainer

Practise electric bass and guitar from tab and notation. Slow a song down, loop the bars you miss, and follow each note as it plays.

TabTrainer is a free web app with no account and no server. Your songs stay in your browser.

**Try it:** https://chemaclass.github.io/tabtrainer/

![TabTrainer showing notation and tab for a bass exercise](docs/screenshot.png)

## Features

- **Library:** exercises and songs for bass (4, 5 or 6 strings) and guitar. Search them, filter by level, and pick up where you left off.
- **Notation and tab** drawn together, note for note, with ties, triplets and chord names.
- **Playback:** set the speed from 30 to 130%, loop a range of bars, and raise the speed after a set number of loops. Add a metronome or a one-bar count-in.
- **Start anywhere:** select a note or bar, then press Play. `Space` pauses and resumes. Stop goes back to your selection.
- **Follow along:** the playing note turns red, and the page scrolls with it. Press `S` for continuous scrolling at your own speed.
- **Editor:** write songs in plain text and see the score update as you type. Errors name their line.
- **Your files:** download a song as `.txt` to share it or move it to another device.

## Song format

A song is plain text: a few header lines, then bars separated by `|`.

```text
title: My groove
artist: Jane Doe, John Roe  # optional: who wrote it
about: Eighth notes on the root  # optional: what the song trains
listen: https://www.youtube.com/watch?v=...  # optional: the original
instrument: bass4      # bass4, bass5, bass6, guitar6
tuning: D2 A2 D3 G3    # optional: any tuning, low to high
tempo: 90
key: C                 # C, Ab, F#m, ...
time: 4/4

@Verse                 # section name
"C" :q 3.3 3.3 :8 5.2 5.2 :q 3.3 |
(3.3 5.2):h r:h |      # two notes together, then a rest
[3/4] :8t 3.3 5.3 7.3 :q ~7.3 r |
```

| Syntax | Meaning |
| --- | --- |
| `3.4` | fret 3 on string 4 (string 1 is the highest) |
| `:q` | length of the next notes: `w h q 8 16 32`, add `.` for dotted or `t` for triplet |
| `3.4:8` | length of one note |
| `(3.4 5.3)` | notes played together |
| `r` | rest |
| `~5.3` | tie: let the note ring without picking it again |
| `"Am7"` | chord name above the next note |
| `{let ring}` | text above the next note |
| `[3/4]` | time signature from this bar on |
| `@Chorus` | section name, on its own line |
| `== Bass line` | starts another version of the song, such as a solo arrangement |
| `# ...` | comment |

## Development

```bash
npm install
npm run dev        # http://localhost:5173/tabtrainer/
npm test
npm run lint
npm run typecheck
npm run build      # production build in dist/
```

The app uses TypeScript, Vite and [VexFlow](https://www.vexflow.com/). CI lints, typechecks and tests each push. When it passes on `main`, GitHub Pages publishes the site.

## Contributing

Pull requests with new exercises or practice features are welcome. Only send songs you wrote or that are in the public domain.

## License

[MIT](LICENSE)
