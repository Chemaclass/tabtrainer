---
name: bundled-songs
description: What a bundled song file must contain and how it is named.
globs: src/songs/**
---

- Only original exercises or public domain songs. Never add or transcribe a copyrighted song, even a short riff. Users keep those in their own library.
- `src/songs/<bass|guitar>/<exercises|songs>/NN-name.txt`: the folder sets the picker group, `NN` sets the order, easiest first. Renumber later files when inserting.
- Header order: `title`, `artist`, `about`, `listen` (optional), `instrument`, `tempo`, `key`, `time`. Exercises use `artist: TabTrainer`; songs use `<Composer> (public domain)` or `Traditional (public domain)`.
- `about:` is one sentence saying what the song trains, written for the player.
- `tests/songs.test.ts` fails on any parser warning, a missing `about:`, fewer than 4 bars or a broken round trip. Every bar must add up to its time signature.
