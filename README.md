# TabTrainer

**Practise tabs the way you'd practise with a teacher: slow it down, loop the hard bar, and follow the red notes.**

TabTrainer is a free, open-source web app for learning songs on electric bass. Write or open a song as plain text and get standard notation and tab together, synth playback, and practice tools.

👉 **Try it:** https://chemaclass.github.io/tabtrainer/

![TabTrainer showing notation and tab for a bass exercise](docs/screenshot.png)

## Features

- **Notation + tab** drawn together and aligned note for note (key signatures, ties, triplets, chords).
- **Playback** with a simple synth: play/pause/resume, speed 30–130 %, loop any range of bars.
- **Follow along:** the notes being played light up red, and the page keeps the current line in view.
- **Hands-free auto-scroll** at a speed you choose (`S` to toggle, `↑`/`↓` to adjust).
- **Double-click any note** to start playing from there.
- **Editor with live preview:** errors and warnings point to the exact line.
- **Any bass:** 4, 5 or 6 strings, or any custom tuning. Guitar (`guitar6`) and ukulele files open too.
- **Your songs stay yours:** they're saved in your browser, and you can download and open them as `.txt` files. No account, no server.

## Song format

Songs are plain text: a header, then bars separated by `|`.

```text
title: My groove
instrument: bass4      # bass4, bass5, bass6
tuning: D2 A2 D3 G3    # optional: any tuning, low to high
tempo: 90
key: C                 # C, Ab, F#m, ...
time: 4/4

@Verse
"C" :q 3.3 3.3 :8 5.2 5.2 :q 3.3 |
(3.3 5.2):h r:h |
[3/4] :8t 3.3 5.3 7.3 :q ~7.3 r |
```

| Syntax | Meaning |
| --- | --- |
| `3.4` | fret 3 on string 4 (string 1 = highest-pitched) |
| `:q` | duration for the following notes: `w h q 8 16 32`, add `.` for dotted, `t` for triplet |
| `3.4:8` | duration for a single note |
| `(3.4 5.3)` | notes struck together |
| `r` | rest |
| `~5.3` | tied: keep the note ringing, don't pick it again |
| `"Am7"` | chord name above the next note |
| `{let ring}` | text above the next note |
| `[3/4]` | time signature from this bar on |
| `@Chorus` | section name (on its own line) |
| `# ...` | comment |

## Development

```bash
npm install
npm run dev      # http://localhost:5173/tabtrainer/
npm test         # parser, timeline and demo-song tests
npm run build    # production build in dist/
```

Built with TypeScript, Vite and [VexFlow](https://www.vexflow.com/). Every push to `main` is tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`.

```
src/
  core/     song model, text parser/serializer, timeline, instruments
  render/   notation + tab rendering (VexFlow)
  audio/    Web Audio player (scheduling, loop, speed)
  ui/       local library and preferences
  songs/    bundled demo exercises, one folder per instrument (original, MIT-licensed)
```

## Contributing

Ideas and pull requests are welcome, especially new exercises, instrument presets and practice features. Please only contribute songs you wrote yourself or that are in the public domain: transcriptions of copyrighted songs can't be included in this repository, but you can always keep them in your own library.

## License

[MIT](LICENSE)
