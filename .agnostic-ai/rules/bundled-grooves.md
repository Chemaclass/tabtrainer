---
name: bundled-grooves
description: What a bundled Jam groove file must contain, how it is named, and what makes it sound right.
globs: src/grooves/**
---

- Only original patterns in a genre style. Never copy the drum, bass or keys part of a recording, even a short fill.
- `src/grooves/NN-name.txt`: `name` is the slug in the groove link `jam/name/`, `NN` sets the order in the groove list, which groups grooves by genre. Renaming a file breaks shared links and saved choices.
- Header order: `title`, `genre`, `about`, `tempo`, `key`, `time`, `swing`, `progression`, then `voice` when the keys part is not the electric piano. `genre` is one lower case word (`blues`, `rock`, `reggae`, `funk`, `jazz`, `bossa`, `metal`, `ballad`). `about:` is one sentence saying what the groove practises, written for the player.
- Each groove has drums, `bass` and `keys`. Add a comment line above a grid when it does something a player would not guess, and a count line (`1 & 2 &` or `1 e & a`) above the first grid.
- Write the bass and keys for any progression, not only the default: the Jam screen swaps in presets such as 12 bar blues or ii V I and repeats each part's bars over them. Prefer degrees that follow the chord (`1 3 5 8`); `2`, `6` and `b7` colour every chord they land on. To lead into a chord change, end the bar on an approach step (`>b1`, `>2`, `>5`), which follows whatever chord comes next.
- Keep the genre's feel in the grids: where the kick and snare land, which steps the keys stab, and where the bass leaves space. Name that feel in `about:`.
- `tests/grooves.test.ts` fails on any parser warning, a missing `title`, `genre` or `about`, a grid that does not fit its bar, or bass and keys out of range in any key with any progression. The groove format is documented in the "Groove format" section of `docs/grooves.md` and the "Writing a groove" section of the help dialog in `index.html`; a syntax change updates both with the same example.
