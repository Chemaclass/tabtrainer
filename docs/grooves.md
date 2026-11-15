# Grooves

## Groove format

A groove is a backing loop to improvise over in Jam. Bundled grooves live in `src/grooves/`. The headers work like the [song format](../README.md#song-format), then each part gets one line of steps.

In Jam, open **My grooves** and choose **Edit text**, **New** or **Open file**. The loop plays what you type from the next bar. When a line has a problem, the list names it and the last working version keeps playing. **Save** keeps the groove in this browser, and **Download** saves it as a `.txt` file.

```text
title: My shuffle
genre: blues
about: A twelve bar shuffle to practise blues lines.
tempo: 80
key: A                 # the chords follow any key
time: 4/4
swing: 66              # 50 is straight, 66 is a triplet shuffle, up to 75
progression: I7 IV7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7
voice: keys            # keys, organ or drive
kit: blues             # rock, blues, funk, reggae, jazz, metal or electronic
fill: on               # a tom fill at the end of the progression, off by default

hat:   xoXoxoXo        # one bar of 8 steps, repeated every bar
snare: ..X...X. | ..X..oX.
kick:  X...x... | X...x..o
keys:  ..X-..X-
bass:  1 - 3 - 5 - 6 - | b7 - 6 - 5 - >b1 -
```

| Syntax | Meaning |
| --- | --- |
| `genre:` | the style shown in the groove list, such as `blues`, `rock`, `reggae` or `funk` |
| `about:` | one line on what the groove practises, shown under the title |
| `swing:` | how late the off beat notes land: `50` is straight, `66` is a triplet, up to `75`. The Jam screen starts from this value, and its swing slider stops at the triplet |
| `progression:` | the chords the groove plays by default. The Jam screen can swap them for another progression |
| `voice:` | the sound of the keys part: `keys` (electric piano, the default), `organ`, or `drive`, a distorted voice for power chords |
| `kit:` | the drum sound and feel: `rock` (the default), `blues`, `funk`, `reggae`, `jazz`, `metal` or `electronic`. Each kit tunes the drums and how loosely they sit on the beat |
| `fill:` | `on` plays a tom fill over the last two beats of the progression, in place of the drum lines there. `off` is the default |
| `I7 iv bVII` | one chord per bar as a roman numeral: upper case is major, lower case is minor, `b` or `#` shifts it. Numerals count from the major scale of the key's root, so a minor key uses `i iv v bIII bVI bVII` |
| `7 maj7 m7 m7b5 dim sus4 5` | chord qualities after the numeral |
| `kick snare rim hat halfhat openhat pedalhat ride bell crash hightom midtom lowtom` | drum lines (`rim` is a cross stick, `pedalhat` the hi-hat closed by the foot, `bell` the bell of the ride): `X` accent, `x` hit, `o` soft hit, `.` silence. A closed or pedal hi-hat stops an open or half open one |
| `keys` | chord stabs: `X` accent, `x` stab, `-` hold the stab, `.` silence |
| `bass` | chord degrees separated by spaces: `1 2 3 5 6 b7 8`, `-` hold, `.` silence. `3` and `5` follow the chord, so `3` is the minor third of a minor chord and the root of a power chord. `b7` is the major seventh of a maj7 chord. Each bar moves by whole octaves to stay between E1 and G3, the range of a 4 string bass |
| `>5 >b1` | approach notes in the bass: `>` plays a degree of the next chord, in the octave nearest its root, so a walking line leads into the chord change. `>b1` is a half step below the next root, or a half step above when that falls below the bass range |
| `\|` | starts the next bar of a part; a part shorter than the progression repeats |
| `# ...` | comment, on its own line or after a space (`#IV` is a numeral) |

The steps in a bar set its grid. In 4/4 that is 8 for eighths, 12 for triplets or 16 for sixteenths. Swing moves the off beat eighths, or the off beat sixteenths when no part plays eighths. With another progression, each part repeats its bars over the new chords.
