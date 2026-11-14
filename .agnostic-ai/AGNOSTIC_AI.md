# TabTrainer

A static web app for practising bass and guitar from tab and notation. TypeScript, Vite and VexFlow, no server. GitHub Actions lints, typechecks and tests each pull request and push (`ci.yml`); `deploy.yml` publishes `main` to GitHub Pages once CI passes. Paths start at the repository root.

## Commands

- `npm run dev` serves http://localhost:5173/tabtrainer/
- `npm test` runs the Vitest suite in `tests/`: one folder per tested `src/` folder (`app`, `audio`, `build`, `core`), plus `tests/songs.test.ts`
- `npm run lint` runs ESLint
- `npm run typecheck`, then `npm run build` for the production build in `dist/`

## Layout

- `src/core/`: song model, text parser and serializer, timeline, instruments.
- `src/render/notation.ts` draws notation and tab with VexFlow.
- `src/audio/player.ts` is the Web Audio player.
- `src/app/`: what the app knows and decides without the page: saved songs and preferences, navigation, catalogue, passage, scrolling. No `document`.
- `src/ui/<shell|library|practice|player|editor|landing>/`: DOM code only, one folder per region of the page, most with their own CSS. `src/ui/dom.ts` holds the shared element lookups.
- `src/main.ts` is the composition root. It builds the objects and wires them to the page; it holds no logic of its own. `src/styles.ts` imports the CSS in order.
- `tests/` mirrors `src/`: `tests/app`, `tests/audio`, `tests/build`, `tests/core`.
- ESLint enforces the layers: `core` imports no other layer, `app` imports no `ui`, `render` or `build`, `audio`, `render` and `build` import no `ui`, and nothing imports `main.ts`.
- `src/songs/<instrument>/<exercises|songs>/NN-name.txt` are the bundled songs. Add one with the `new-song` skill.

## Before you finish

Run `npm run lint`, `npm test`, `npm run typecheck` and `npm run build`. For UI or playback changes, also check the page in a browser. Audio starts only after a real click, not a scripted one.
