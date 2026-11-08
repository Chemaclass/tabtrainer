# TabTrainer

A static web app for practising bass and guitar from tab and notation. TypeScript, Vite and VexFlow, no server. GitHub Actions tests every push to `main` and deploys it to GitHub Pages. Paths start at the repository root.

## Commands

- `npm run dev` serves http://localhost:5173/tabtrainer/
- `npm test` runs the Vitest suite in `tests/`
- `npm run typecheck`, then `npm run build` for the production build in `dist/`

## Layout

- `src/core/`: song model, text parser and serializer, timeline, instruments.
- `src/render/notation.ts` draws notation and tab with VexFlow.
- `src/audio/player.ts` is the Web Audio player. `src/main.ts` wires the page.
- `src/ui/` keeps the local song library and preferences in the browser.
- `src/songs/<instrument>/<exercises|songs>/NN-name.txt` are the bundled songs. Add one with the `new-song` skill.

## Before you finish

Run `npm test`, `npm run typecheck` and `npm run build`. For UI or playback changes, also check the page in a browser. Audio starts only after a real click, not a scripted one.
