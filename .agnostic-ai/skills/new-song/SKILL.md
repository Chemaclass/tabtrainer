---
name: new-song
description: "Use to add a bundled exercise or public domain song to TabTrainer. Argument: what it should train, or the song's name."
x-claude: {argument-hint: "<what it trains | public domain song>"}
---

# Add a bundled song

1. Decide the group: an exercise (original, trains one skill) or a song (public domain melody or bass line). If the request names a song, confirm it is public domain: composer dead over 70 years and no modern arrangement copied. Otherwise stop and say why.
2. List `src/songs/<instrument>/<group>/` and pick the place by difficulty. Use the next `NN`, or renumber later files when it belongs earlier.
3. Read two neighbouring files in that folder and match their header, comments and section style. Follow the `bundled-songs` rule.
4. Write the file. Keep fingerings playable: stay within about four frets per hand position, prefer open strings in low positions, and check each note against the `key:` line. Use `@Section` lines for the parts the `about:` line names.
5. Run `npx vitest run tests/songs.test.ts`. Fix each issue at the line it names; a short bar gets filled with a rest and fails the test.
6. Ask the `song-reviewer` agent to check the file, and fix what it finds.
7. Check it in the browser: pick it in the song list, play it, and confirm the notation, tab and highlight follow along.
