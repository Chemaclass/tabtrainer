# TabTrainer

Practise electric bass and guitar from tab with rhythm. Slow a song down, loop the bars you miss, and follow each note as it plays.

It's a free web app with no account. Your songs stay in your browser, and it works offline once you've opened it.

**Try it:** https://chemaclass.github.io/tabtrainer/

![TabTrainer showing the tab with rhythm for a bass exercise](docs/screenshot.png)

## What you can do

- **Practise:** exercises and songs for bass (4, 5 or 6 strings) and guitar, with stems, beams, ties and triplets under the frets, and hammer-ons, pull-offs, slides, bends, dead notes and palm mutes that you can see and hear.
- **Slow down and loop:** play from 30 to 130% speed, loop any bars, and raise the speed after a set number of loops.
- **Follow along:** the playing note turns red and the page scrolls with it. Add a metronome or a count-in.
- **Keep your place:** the library shows how far you got on each song and takes you back to it.
- **Play hands free:** the main controls have keys, and `?` lists them. A two-button page turner pedal works as a foot switch.
- **Jam:** improvise over a looping groove in blues, rock, funk, reggae, jazz, bossa or metal, in any key.
- **Fretboard:** see where the notes of any key and scale sit on your instrument.
- **Write your own:** write a song or groove in plain text. The score updates as you type, and a groove plays what you type.

## Add your song

Anyone can add an exercise or a public domain song to the site, without Git:

1. Open your song in TabTrainer, or [write a new one](https://chemaclass.github.io/tabtrainer/?view=library&kind=mine&new=1).
2. Open **File** and choose **Add to TabTrainer**.
3. Fix anything the checklist shows, tick the box that says the music is yours or public domain, then press **Open GitHub** and send it.

Once we accept it, everyone can practise it. [CONTRIBUTING.md](CONTRIBUTING.md) has the full steps, what we accept, and how to send code.

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
:8 5.3 h7.3 p5.3 /9.3^1 x.3 _5.3 |   # h, p: hammer-on, pull-off; /: slide; ^1: bend; x: dead note; _: palm mute
```

| Syntax | Meaning |
| --- | --- |
| `3.4` | fret 3 on string 4 (string 1 is the highest) |
| `:q` | length of the next notes: `w h q 8 16 32`, add `.` for dotted or `t` for triplet |
| `3.4:8` | length of one note |
| `(3.4 5.3)` | notes played together |
| `r` | rest |
| `~5.3` | tie: let the note ring without picking it again |
| `5.3 h7.3` | hammer-on: pick fret 5, then press fret 7 on the same string without picking again |
| `7.3 p5.3` | pull-off: pick fret 7, then lift that finger so fret 5 sounds without picking again |
| `5.3 /7.3` `7.3 \5.3` | slide: pick the first note, then slide the same finger up (`/`) or down (`\`) the string to the second without picking again |
| `/7.3` `\5.3` | slide into the note from two frets lower or higher, and pick it as usual |
| `7.3^1` `7.3^1/2` | bend: push the string until the note sounds a whole step (two frets) or a half step (one fret) higher. Also `^1/4`, `^3/2` and `^2` |
| `7.3^1r` | bend, then let the string back down within the same note |
| `7.3^1 ~7.3` | bend and hold: the tie keeps the bend |
| `7.3^1 ~7.3^1r` | bend, hold, then let it down on the tie |
| `x.3` | dead note on string 3: mute the string with the fretting hand and pick it, for a click with no pitch |
| `_0.6` `_(0.6 2.5)` | palm mute: rest the side of the picking hand on the strings near the bridge, for a short, dark note or chord |
| `"Am7"` | chord name above the next note |
| `{let ring}` | text above the next note |
| `[3/4]` | time signature from this bar on |
| `[tempo=130]` | quarter-note tempo from this bar on, before its first note |
| `@Chorus` | section name, on its own line |
| `== Bass line` | starts another version of the song, such as a solo arrangement |
| `# ...` | comment |

Grooves for Jam use their own format: see [docs/grooves.md](docs/grooves.md).

## Development

```bash
npm install
npm run dev        # http://localhost:5173/tabtrainer/
npm run check      # lint, tests and production build
npm run e2e        # browser test of the built site (first run: npx playwright install chromium)
npm run render-song -- <file>  # PNG of a song or groove in song-preview/ (build first)
```

It's TypeScript, Vite and [VexFlow](https://www.vexflow.com/), with no server. CI checks every pull request, and GitHub Pages publishes `main`. A pull request that changes a song gets a comment with its rendered tab. [How the code fits together](docs/architecture.md) shows where new code goes.

## License

[MIT](LICENSE)
