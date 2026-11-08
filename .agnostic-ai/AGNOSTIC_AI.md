# TabTrainer

A static web app for practising bass and guitar from tab and notation. TypeScript, Vite and VexFlow, no server. GitHub Actions tests every push to `main` and deploys it to GitHub Pages. Paths below start at the repository root.

## Commands

- `npm run dev` serves http://localhost:5173/tabtrainer/
- `npm test` runs the Vitest suite in `tests/`
- `npm run typecheck`, then `npm run build` for the production build in `dist/`

## Layout

- `src/core/`: song model, text parser and serializer, timeline, instruments. Keep it free of DOM code so `tests/` can import it.
- `src/render/notation.ts` draws notation and tab with VexFlow and tags each struck note with `data-key` for the playing-note highlight.
- `src/audio/player.ts` is the Web Audio player. `src/main.ts` wires the page.
- `src/songs/<instrument>/<exercises|songs>/NN-name.txt` are the bundled songs. The folder sets the picker group; the number sets the order, easiest first.

## Bundled songs

- Only original exercises or public domain songs. Never add a transcription of a copyrighted song.
- Every song needs an `about:` line saying what it trains. `tests/songs.test.ts` fails without it, and it fails on any parser warning, so every bar must add up to its time signature.
- The song format is documented in `README.md` and in the help dialog in `index.html`. Change both together.

## Before you finish

Run `npm test`, `npm run typecheck` and `npm run build`. For UI or playback changes, also check the page in a browser. Audio starts only after a real click, not a scripted one.
