# How the code fits together

This page shows where new code goes in TabTrainer and how to test it. To run the app, see [Development](../README.md#development) in the README.

## The layers

The code under `src/` is split into layers. An arrow means "may import from".

```mermaid
flowchart TD
  main["main.ts<br>builds the objects and wires them to the page"]
  ui["ui/<br>DOM code, one folder per region of the page"]
  render["render/<br>draws the tab with VexFlow"]
  audio["audio/<br>plays sound with Web Audio"]
  build["build/<br>pages made at build time"]
  app["app/<br>what the app knows and decides, without the page"]
  core["core/<br>song model, parser, timeline, instruments"]
  main --> ui & render & audio & build & app & core
  ui --> render & audio & build & app & core
  render & audio & build --> app
  app --> audio
  app & audio & render & build --> core
```

- `src/core/` imports no other layer and never touches `document` or `window`.
- `src/app/` never touches `document` or `window`, and imports nothing from `ui`, `render` or `build`. It may use `localStorage`, so saved songs and preferences live here.
- `src/audio/`, `src/render/` and `src/build/` import nothing from `ui`.
- `src/ui/` holds the DOM code. `src/ui/dom.ts` has the shared element lookups, such as `byId`.
- `src/main.ts` holds no logic of its own, and nothing imports it.

`npm run lint` fails when code breaks one of these rules. The rules live in `eslint.config.js`.

The page itself is `index.html`: every button, panel and dialog starts there, and the code in `src/ui/` finds it by `id`. `src/styles.ts` imports the CSS in order.

## Where does it go?

| You want to add | Files to touch |
| --- | --- |
| A player control | The markup in `index.html`. The DOM code in a file under `src/ui/player/`, such as `src/ui/player/timingPanel.ts` for the metronome. What the sound does in `src/audio/player.ts`. One call in `src/main.ts` to build it. |
| A preference that survives a reload | A field in the `Preferences` interface and a check in `validators`, both in `src/app/storage.ts`. Read it with `pref('name', fallback)` and save it with `setPref('name', value)` from the code that owns the control. `src/ui/player/timingPanel.ts` does this for `metronome`. |
| A header line in the song format | The parser in `src/core/parser.ts` (the `HEADER` pattern and the line that reads it), the serializer in `src/core/serialize.ts`, and `HEADER_ORDER` in `src/core/songRules.ts` if bundled songs need it. Then document it in the [Song format](../README.md#song-format) section of the README and in the help dialog (`<dialog id="help">`) in `index.html`, with the same example. |
| A mark on a note in the song format | The `Note` fields in `src/core/model.ts` (or the `NoteEvent` fields for a mark on a whole chord), `parseNote` or the body loop in `src/core/parser.ts`, the rules they share in `src/core/technique.ts` (such as which note a hammer-on starts from, or how a slide or bend moves the pitch in `pitchPlan`), `noteTok` in `src/core/serialize.ts`, the `TimedNote` fields in `src/core/timeline.ts`, the fret label or a mark above the tab in `src/render/tab.ts` (with its room from `markRoom` in `src/app/sheetLayout.ts`), and the sound in `src/audio/synth.ts`, called from `schedulePass` in `src/audio/player.ts`. Then document it in the [Song format](../README.md#song-format) section of the README and in the help dialog in `index.html`. A dead note (`x.3`), a palm mute (`_0.6`) and a hammer-on (`h7.3`) show each step. |
| A dialog | A `<dialog>` in `index.html`. The DOM code in the folder of the region that opens it, under `src/ui/`. `src/ui/shell/helpDialogs.ts` shows how the help dialogs open and close. One call in `src/main.ts` if it needs objects from elsewhere. |
| A link to GitHub (an issue, a file, a proposal) | `REPOSITORY` in `src/app/repository.ts`. The wording and the URL as a pure function in `src/app/`, such as `src/app/feedback.ts` for the issue forms, with a test in `tests/app/`. The DOM code in `src/ui/`, such as `src/ui/shell/feedbackDialog.ts`. Issue links open a form from `.github/ISSUE_TEMPLATE/`, since blank issues are off. |
| A Jam mood, or a change to one | The mood itself in `MOODS` in `src/core/moods.ts`: its scale, eight bar loops with a plain name and a plain job per bar, tempo range and starting tempo, fitting genres, mood note and the sentence on why it sounds that way. `tests/core/moods.test.ts` checks the music in all twelve keys and `tests/core/moodFit.test.ts` checks each fitting groove's bass. What the Jam does with a mood (`applyMood`, `clearMood`, `grooveFor`) lives in `src/app/jam.ts`, the texts the page shows and the scale and groove groups in `src/app/jamMood.ts`, and the `?mood=` link in `src/app/jamLink.ts`. Old loop slugs map to their eight bar loops through `RETIRED_LOOPS` in `src/core/moods.ts`. The chips (Free first, for no mood), the mood title and the recipe are drawn by `src/ui/jam/moodStage.ts`, the bar jobs and share caption by `src/ui/jam/jamView.ts`, and the mood note legend by `src/ui/jam/jamFretboard.ts`. The [Moods](grooves.md#moods) section of the groove docs lists every mood. |
| An instrument | An entry in `INSTRUMENTS` in `src/core/instruments.ts`. Then search for an existing id, such as `bass5`, to find the lists that name each instrument: the `instrument:` line in the README and the help dialog, the header table in [What the file needs](../CONTRIBUTING.md#what-the-file-needs), and the pickers. |

Any decision that does not need the page goes in `src/app/` or `src/core/`, so a test can check it. The file in `src/ui/` then only reads the page, calls that code, and shows the result.

## How to test it

- Code in `src/core/`, `src/app/`, `src/audio/` and `src/build/` gets a test in the matching folder under `tests/`, such as `tests/app/storage.test.ts` for `src/app/storage.ts`. The tests run in Node with Vitest, with no page.
- Code in `src/ui/` has no unit tests. Check it in the browser with `npm run dev`, on a wide screen and a phone-sized one, in light and dark. Sound starts only after a real click, not a scripted one.

Run one test file:

```bash
npm test -- tests/app/screenAwake.test.ts
```

Run the tests whose name matches some text:

```bash
npm test -- -t "counts a source once"
```

Before you send a pull request, run the checks in [Code changes](../CONTRIBUTING.md#code-changes).

## A worked example: keep the screen on

[Pull request #133](https://github.com/Chemaclass/tabtrainer/pull/133) keeps the phone screen on while a song plays, the Jam loop runs or the score scrolls on its own. The screen-on part touched these files.

1. `src/app/screenAwake.ts`: the decision. `ScreenAwake` remembers which sources are running (`'player'`, `'jam'`, `'scroll'`) and says whether the screen should stay on. It knows nothing about the browser.
2. `tests/app/screenAwake.test.ts`: tests for that decision, such as "stays awake while continuous scrolling runs after the player pauses".
3. `src/ui/player/wakeLock.ts`: the browser part. `screenWakeLock()` asks `navigator.wakeLock` to keep the screen on when `ScreenAwake` says so, lets go when it doesn't, and asks again when the tab comes back into view.
4. `src/ui/player/scrollControls.ts`: one new argument, so continuous scrolling can say when it starts and stops.
5. `src/main.ts`: the wiring. It builds the lock once and connects each source to it:

   ```ts
   const awake = screenWakeLock();
   player.on(state => awake.keep('player', state.playing));
   loop.on(state => awake.keep('jam', state.playing));
   ```

The rule lives in `src/app/` with a test, the browser call lives in `src/ui/`, and `src/main.ts` only connects them. Most features follow the same path.

## Colours, spacing and type

The design tokens live in `:root` in `src/style.css`, and `[data-theme="dark"]` sets the dark values of the colours. Use a token instead of a number in new CSS. When you touch an older rule, swap a literal for a token only when the values match exactly, so nothing on the page moves.

| Tokens | Values | Use them for |
| --- | --- | --- |
| `--space-1` to `--space-6` | 4, 8, 12, 16, 24, 32 px | `padding`, `margin` and `gap` |
| `--radius-s`, `--radius-m`, `--radius-pill` | 6, 12, 999 px | `border-radius`: buttons, cards, round pills |
| `--text-xs` to `--text-xl` | 12, 14, 16, 20, 28 px | `font-size`, or the size in a `font` shorthand |

The neutral colours carry the page: `--page` for the background, `--ink` for text, `--mut` and `--faint` for quieter text, `--rule` for lines, `--wash` and `--hover` for filled areas. The player bar at the bottom has its own set starting with `--deck`.

Three colours carry meaning. Keep to these meanings, so a player can read the page at a glance.

| Colour | Tokens | Means | Examples |
| --- | --- | --- | --- |
| Amber | `--led`, `--led-text`, `--track-fill`, `--cur` | Where you are and how far you got, the main action, the selected option and warnings | The current line of the score, the filled part of a slider or progress bar, an exercise in progress, the target string in the tuner, a warning in the song text |
| Red | `--playing`, `--error`, `--problem-wash`, `--problem-text` | The note sounding now, or something to fix | The note that plays, a line the parser cannot read, a missing step in a song proposal |
| Green | `--ok`, `--ok-text` | Done or right | A finished exercise, a string in tune, a passed check |

On a light background use the `-text` token for words and thin borders; the plain one is for fills and for text on dark panels.

A focus ring is a 2px `--ink` outline, 2px away from the control. Bars and notes in the score show focus with a blue stroke instead, the same blue that marks a picked bar or note.
