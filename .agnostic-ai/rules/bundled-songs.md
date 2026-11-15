---
name: bundled-songs
description: What a bundled song file must contain and how it is named.
globs: src/songs/**
---

- Only original exercises or public domain songs. Never add or transcribe a copyrighted song, even a short riff. Users keep those in their own library.
- One exception: a common practice pattern, such as a scale or chromatic walk, taken from a teacher's free lesson. Credit the teacher in `artist:`, say so in `about:` and link the lesson in `listen:`.
- `src/songs/<bass|guitar>/<exercises|songs>/NN-name.txt`: the folder sets the picker group, `NN` sets the order, easiest first. Renumber later files when inserting.
- Header order: `title`, `artist`, `about`, `level`, `listen` (optional), `instrument`, `tempo`, `key`, `time`. Exercises use `artist: TabTrainer` unless credited as above; songs use `<Composer> (public domain)` or `Traditional (public domain)`.
- `about:` is one sentence saying what the song trains, written for the player.
- `level:` is `easy`, `medium` or `hard`. When versions differ, put a `level:` line under each `== Name` line too.
- `tests/songs.test.ts` fails on any parser warning, a missing `about:` or `level:`, fewer than 4 bars or a broken round trip. Every bar must add up to its time signature.
