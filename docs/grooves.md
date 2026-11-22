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

## Moods

The Jam opens with a question: "How do you want it to feel?" Each mood chip sets chords, a key, a tempo and a scale that carry that feeling. A mood starts at its own starting tempo, so it sounds the same whatever was open before. The one exception is a tempo you set by hand with the slider or the tempo keys on the groove that is playing: when it is inside the new mood's range, it stays. When a mood moves to another groove, it starts at its own tempo there. Every loop has eight bars, two phrases of four, apart from the twelve bar blues. One sentence says why it sounds that way, in frets rather than theory words. The note that gives the mood its colour shows in amber on the fretboard.

A mood decides the chords; the key, tempo, scale and groove stay yours. While a mood is on, the Progression list becomes Loop and offers only that mood's loops, each with a plain name, such as "Pull and hold". The stage button plays the next one. The first chip, Free, means no mood: it is pressed whenever no mood is on, and tapping it gives back the groove's own chords, keeping the key's home note and the tempo. Tapping the chip that is already pressed does nothing.

| Mood | Scale | Loops | Tempo | Starts at | Grooves |
| --- | --- | --- | --- | --- | --- |
| Happy | major | `I V vi IV \| I V IV V`, `I IV I V \| vi IV I V`, `I vi IV V \| I vi ii V` | 100 to 140 | 120 | rock, bossa |
| Sad | natural minor | `i bVI bIII bVII \| i bVI iv v`, `i iv i v \| bVI bIII iv v`, `i bVII bVI bVII \| i bVII bVI v` | 56 to 88 | 66 | ballad, rock |
| Melancholic | major, with the minor iv | `I iii IV iv \| I vi IV iv`, `I IV iv I \| vi IV iv V`, `Imaj7 vi7 IV iv \| Imaj7 iii IV iv` | 60 to 96 | 72 | ballad, bossa |
| Exciting | Mixolydian | `I I bVII IV \| I I IV bVII`, `I bVII IV I \| I bVII IV bVII`, `I IV bVII IV \| I IV bVII bVII` | 120 to 176 | 148 | rock, metal |
| Epic | natural minor | `i i bVI bVII \| i bIII bVI bVII`, `i bVII bVI bVII \| bIII bVII bVI bVII`, `i i bVI bVI \| bIII bIII bVII bVII` | 120 to 180 | 160 | metal, rock |
| Dark | Phrygian | `i bII i bII \| i bII bIII bII`, `i bII bvii i \| iv bIII bII bII`, `i i bII bII \| i i bvii bII` | 80 to 130 | 100 | metal, rock |
| Tense | harmonic minor | `i iv V7 i \| bVI iv V7 V7`, `i bVI V7 i \| iv iim7b5 V7 V7`, `i V7 i V7 \| iv iv V7 V7` | 90 to 140 | 112 | rock, bossa |
| Dreamy | Lydian | `Imaj7 Imaj7 II II \| Imaj7 Imaj7 vi II`, `Imaj7 II Imaj7 II \| vi II Imaj7 II`, `Imaj7 II iii II \| Imaj7 II vii II` | 70 to 110 | 76 | ballad, bossa, reggae |
| Bluesy | blues | 12 bar blues, minor blues | 60 to 130 | 80 | blues, rock |
| Funky | Dorian | `i7 i7 i7 IV7 \| i7 i7 IV7 IV7`, `i7 IV7 i7 IV7 \| i7 IV7 bVIImaj7 IV7`, `i7 i7 IV7 IV7 \| i7 i7 v7 IV7` | 88 to 116 | 98 | funk, reggae |

A groove fits a mood by its `genre:`, so a groove you write with `genre: funk` fits Funky too. Picking a mood moves to the first groove of the first genre in its list, so a mood sounds the same whatever was open. Your own groove, or groove text you are editing, stays when its genre fits. While a mood is on, the groove list puts the grooves that fit it first, under "Fits Sad", and tags each of your own grooves that fits. The Scale list puts the scales that carry the mood note first; pick another and the legend says which note it leaves out. Changing the progression in the groove text turns the mood off and says so. Choosing a groove by hand keeps the mood, even on a groove that does not fit.

`tests/core/moodFit.test.ts` checks every pair in the Grooves column. It plays every loop over every bundled groove of that genre, in all twelve keys. Each bass note must be a tone of its chord or a note of the mood scale. A new groove that fails a mood comes out of that mood's list.

A shared link carries the mood as `?mood=sad`, before the key, tempo, chords and swing. When the linked chords are not one of the mood's loops, the link opens the chords with no mood. A link that names only a mood, such as `?mood=sad`, opens that mood on its first loop. A mood link with no tempo opens at the mood's starting tempo; a tempo in the link wins. A saved setup or link with a loop from before the loops had eight bars opens the eight bar loop that replaced it, usually the one that starts with the same bars (`RETIRED_LOOPS` in `src/core/moods.ts`).
