---
name: new-groove
description: "Use to add a bundled Jam groove to TabTrainer. Argument: the genre or feel it should have."
x-claude: {argument-hint: "<genre | feel>"}
---

# Add a bundled groove

1. Name the genre's feel in one line before writing: where the kick and snare land, the hat grid (eighths, triplets or sixteenths), what the keys play, and where the bass rests. If the request names a recording, write an original pattern in its style and say so.
2. List `src/grooves/` and pick the next `NN`. Read `src/grooves/01-blues-shuffle.txt`, a groove close in feel, and the "Groove format" section of `docs/grooves.md`. Follow the `bundled-grooves` rule.
3. Write the file. Choose a tempo and a `swing` value that suit the genre, a default progression that is idiomatic for it, and a grid size that fits the fastest notes. Check each bass degree against every chord in the progression.
4. Run `npx vitest run tests/grooves.test.ts`. Fix each issue at the line it names.
5. Check it in the browser at `jam/<name>/`: the groove shows in the list with its genre and tempo, the chords follow a key change, and a few progression presets and the swing slider still sound right. Audio starts only after a real click.
