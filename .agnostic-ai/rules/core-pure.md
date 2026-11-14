---
name: core-pure
description: Keep src/core free of browser APIs, tested, and its song format documented.
globs: src/core/**
---

`src/core/` runs in Node under Vitest. Never use `document`, `window`, Web Audio or VexFlow there; that code belongs in `src/render/`, `src/audio/` or `src/ui/`. Logic that needs no page, such as storage or routes, goes in `src/app/`.

Each core change needs a test in `tests/core/`. Parser changes keep `serializeSong(parseSong(text))` round-tripping: extend `src/core/serialize.ts` with any new syntax.

The song format is documented twice: the "Song format" section of `README.md` and the help dialog (`<dialog id="help">`) in `index.html`. A syntax change updates the parser, the serializer and both docs in the same commit, with the same example.
